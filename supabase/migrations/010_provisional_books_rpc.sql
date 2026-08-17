-- ============================================================
-- えほんのあと 追加migration【案・未実行】
-- 010_provisional_books_rpc.sql
-- 目的: DBに無い作品（新刊・古い紙芝居など）を、その場で記録できるようにする
-- 既存データへの影響: なし（列の追加・関数の追加のみ）
-- 前提: 009_material_type.sql が先に適用されていること
-- ============================================================
--
-- 【books への直接INSERT権限は開放しない】
--   MVPは匿名認証(signInAnonymously)を使っており、匿名利用者もSupabase上では
--   role=authenticated になる。したがって
--       for insert to authenticated with check (...)
--   は「誰でもbooksに書ける」に等しい。採用しない。
--
--   代わりに security definer の関数（RPC）を1つだけ公開し、
--   その中でしか books に行を作れないようにする。
--   関数が保証すること：
--     ・title 必須（空白のみは不可）
--     ・material_type 必須（picture_book / kamishibai のみ）
--     ・is_active = false を強制（一般検索に出さない）
--     ・created_by = auth.uid() を強制
--     ・care_points / seasonal_tags / event_tags / book_state_links は触れない
--     ・ISBNがあれば正規化し、既存作品があればそれを返す（重複を作らない）
--     ・書名が近い既存作品があるときは、作らずに候補を返す（人が確認する）
-- ============================================================

-- ------------------------------------------------------------
-- A. books に列を追加（すべて任意・既存行は null）
--    ※ source / source_id は books に持たせない。
--      同じ作品が複数の書誌提供元から見つかるため、011の book_sources で1対多にする。
-- ------------------------------------------------------------
alter table public.books
  add column if not exists published_year int,
  add column if not exists created_by     uuid references auth.users (id) on delete set null;

comment on column public.books.published_year is '出版年。改訂版・新装版など版違いの判別に使う';
comment on column public.books.created_by     is '仮登録した利用者。管理用カラム。利用者画面には出さない';

-- ISBNでの重複確認を速くする（UNIQUEではない。重複判定は関数とアプリで行う）
create index if not exists idx_books_isbn       on public.books (isbn) where isbn is not null;
create index if not exists idx_books_created_by on public.books (created_by) where created_by is not null;

-- ------------------------------------------------------------
-- B. ISBNをISBN-13へそろえる関数
--    誤ったISBNは null を返す（間違った値で既存作品に結び付けないため）
-- ------------------------------------------------------------
create or replace function public.normalize_isbn13(p_isbn text)
returns text language plpgsql immutable as $$
declare
  s text; i int; total int := 0; c text; d int; first12 text;
begin
  if p_isbn is null then return null; end if;
  s := upper(regexp_replace(p_isbn, '[^0-9Xx]', '', 'g'));
  if s = '' then return null; end if;

  -- すでに13桁：チェックディジットを検算する
  if s ~ '^[0-9]{13}$' then
    for i in 1..12 loop
      total := total + (substr(s, i, 1))::int * (case when i % 2 = 1 then 1 else 3 end);
    end loop;
    if ((10 - (total % 10)) % 10)::text = substr(s, 13, 1) then
      return s;
    end if;
    return null;
  end if;

  -- 10桁：検算してから13桁へ変換する
  if s ~ '^[0-9]{9}[0-9X]$' then
    for i in 1..9 loop
      total := total + (substr(s, i, 1))::int * (11 - i);
    end loop;
    c := substr(s, 10, 1);
    d := case when c = 'X' then 10 else c::int end;
    if (total + d) % 11 <> 0 then return null; end if;

    first12 := '978' || substr(s, 1, 9);
    total := 0;
    for i in 1..12 loop
      total := total + (substr(first12, i, 1))::int * (case when i % 2 = 1 then 1 else 3 end);
    end loop;
    return first12 || ((10 - (total % 10)) % 10)::text;
  end if;

  return null;
end $$;

comment on function public.normalize_isbn13(text) is
  'ISBNをISBN-13へそろえる。ハイフン等は除去し、チェックディジットが合わないものはnullを返す';

-- 書名の比較用キー（空白と記号をおとした小文字）
-- ※ NFKC相当の完全な正規化はアプリ側(src/lib/catalog/normalize.js)で行う。
--   ここは「取りこぼしを減らす」ための粗い比較。
create or replace function public.book_title_key(p_title text)
returns text language sql immutable as $$
  select lower(regexp_replace(coalesce(p_title, ''), '[[:space:]・･、。，．,.!！?？「」『』（）()【】ー~〜:：;；-]', '', 'g'))
$$;

-- ------------------------------------------------------------
-- C. 未登録作品を仮登録するRPC
--    戻り値 status:
--      'created'    … 新しく仮登録した（book_id を使って記録できる）
--      'existing'   … ISBNが一致する作品が既にあった（その book_id を使う）
--      'candidates' … 似た作品があるので作らなかった（利用者に選んでもらう）
-- ------------------------------------------------------------
create or replace function public.create_provisional_book(
  p_title         text,
  p_material_type text,
  p_author        text    default null,
  p_illustrator   text    default null,
  p_publisher     text    default null,
  p_isbn          text    default null,
  p_published_year int    default null,
  p_force_new     boolean default false   -- 候補を見たうえで「別の作品です」と選んだとき true
)
returns table (book_id uuid, status text, candidates jsonb)
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_title     text := btrim(coalesce(p_title, ''));
  v_isbn      text;
  v_existing  uuid;
  v_cands     jsonb;
  v_recent    int;
  v_new_id    uuid;
begin
  -- 1. 利用者の確認（匿名ログインでも auth.uid() は入る）
  if v_uid is null then
    raise exception '記録するにはログインが必要です' using errcode = '28000';
  end if;

  -- 2. 最低限の入力チェック
  if v_title = '' then
    raise exception 'タイトルを入力してください' using errcode = '22023';
  end if;
  if p_material_type is null or p_material_type not in ('picture_book', 'kamishibai') then
    raise exception '作品の種類（絵本／紙芝居）を選んでください' using errcode = '22023';
  end if;

  -- 3. 作りすぎの抑止（匿名利用者でも呼べるため）
  select count(*) into v_recent
  from public.books
  where created_by = v_uid and created_at > now() - interval '1 day';
  if v_recent >= 50 then
    raise exception '1日に追加できる作品数の上限に達しました。時間をおいてお試しください'
      using errcode = '54000';
  end if;

  -- 4. ISBNが一致する作品が既にあれば、それを使う（重複を作らない）
  v_isbn := public.normalize_isbn13(p_isbn);
  if v_isbn is not null then
    select b.id into v_existing
    from public.books b
    where public.normalize_isbn13(b.isbn) = v_isbn
    order by b.is_active desc, b.created_at
    limit 1;

    if v_existing is not null then
      return query select v_existing, 'existing'::text, '[]'::jsonb;
      return;
    end if;
  end if;

  -- 5. 書名が近い作品があれば、勝手に作らず候補を返す
  --    （ISBNが両方あって異なる場合は版違いなので候補にしない）
  if not p_force_new then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', b.id, 'title', b.title, 'author', b.author,
             'publisher', b.publisher, 'material_type', b.material_type,
             'published_year', b.published_year, 'is_active', b.is_active)), '[]'::jsonb)
      into v_cands
    from public.books b
    where public.book_title_key(b.title) = public.book_title_key(v_title)
      and b.material_type = p_material_type
      and not (v_isbn is not null and public.normalize_isbn13(b.isbn) is not null
               and public.normalize_isbn13(b.isbn) <> v_isbn);

    if jsonb_array_length(v_cands) > 0 then
      return query select null::uuid, 'candidates'::text, v_cands;
      return;
    end if;
  end if;

  -- 6. 仮登録する。利用者が触れるのはここに書いた項目だけ。
  --    is_active=false なので通常の検索には出ない。公開は管理者が行う。
  insert into public.books (
    title, author, illustrator, publisher, isbn,
    material_type, published_year, is_active, created_by
  ) values (
    v_title,
    nullif(btrim(coalesce(p_author, '')), ''),
    nullif(btrim(coalesce(p_illustrator, '')), ''),
    nullif(btrim(coalesce(p_publisher, '')), ''),
    v_isbn,
    p_material_type,
    p_published_year,
    false,
    v_uid
  )
  returning id into v_new_id;

  return query select v_new_id, 'created'::text, '[]'::jsonb;
end $$;

comment on function public.create_provisional_book is
  'DBに無い作品を仮登録する。is_active=false / created_by=auth.uid() を強制し、'
  '保育のタグ（care_points・seasonal_tags・event_tags・book_state_links）には触れない';

-- 実行できるのはログイン済み（匿名を含む）利用者のみ。anonには渡さない。
revoke all on function public.create_provisional_book(text, text, text, text, text, text, int, boolean) from public;
grant execute on function public.create_provisional_book(text, text, text, text, text, text, int, boolean) to authenticated;

revoke all on function public.normalize_isbn13(text) from public;
grant execute on function public.normalize_isbn13(text) to authenticated, anon;

-- ------------------------------------------------------------
-- D. 自分が仮登録した作品を取得できるようにする
--    books_read_all が select to anon,authenticated using(true) のため、
--    読み取りの追加ポリシーは不要。ここでは書き込みポリシーを足していないことを明記する。
--    → 一般利用者が books を直接 INSERT / UPDATE / DELETE する手段は無いまま。
-- ------------------------------------------------------------

-- ============================================================
-- ロールバック（元に戻す場合）
-- ※ 追加した関数・列・索引を落とすだけ。元からあった列・データ・権限は無傷
-- ------------------------------------------------------------
-- drop function if exists public.create_provisional_book(text, text, text, text, text, text, int, boolean);
-- drop function if exists public.book_title_key(text);
-- drop function if exists public.normalize_isbn13(text);
-- drop index if exists public.idx_books_created_by;
-- drop index if exists public.idx_books_isbn;
-- alter table public.books
--   drop column if exists created_by,
--   drop column if exists published_year;
-- ============================================================
