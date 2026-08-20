-- ============================================================
-- えほんのあと 追加migration【案・未実行】
-- 010_provisional_books_rpc.sql
-- 目的: DBに無い作品（新刊・古い紙芝居など）を、その場で記録できるようにする
-- 既存データへの影響: なし（列の追加・テーブルの新設・関数の追加のみ）
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
--     ・追加した利用者は books ではなく非公開テーブルに記録する（下記）
--     ・care_points / seasonal_tags / event_tags / book_state_links は触れない
--     ・ISBNがあれば正規化し、既存作品があればそれを返す（重複を作らない）
--     ・書名が近い既存作品があるときは、作らずに候補を返す（人が確認する）
--
-- ============================================================
-- 【重要】誰が追加したかを books に持たせない
-- ============================================================
--   books は books_read_all により anon / authenticated から SELECT できる。
--   そこに created_by（＝auth.uid()）を置くと、画面に出さなくても
--   Data API を直接叩けば他の利用者のUUID（匿名ユーザーのIDを含む）を取得できてしまう。
--   「利用者画面に出さない」はDB上の秘匿にはならない。
--
--   そこで作品と追加者の対応は public.book_contributions に分離し、
--   一般利用者は自分の行しか読めないようにする。
--   books には作品そのものの情報だけを置く。
--   既存の books_read_all は変更しない。
--
-- ============================================================
-- 【匿名ユーザーの扱い：意図的に許可する】（Master判断 2026-08-18）
-- ============================================================
--   下の
--       grant execute ... to authenticated
--   の意味は次のとおり：
--     ・**未認証の anon role には EXECUTE を付与しない。**
--     ・**Supabase匿名認証(signInAnonymously)で作られた利用者は
--       authenticated role なので、意図的にこのRPCの利用を許可する。**
--       （JWTには is_anonymous: true クレームが付くが、role は authenticated）
--
--   理由：「えほんのあと」はログイン操作なしで使えることが前提であり、
--   現在の利用者は全員が匿名ユーザー。匿名を拒否すると
--   「DBにない新刊・紙芝居でも、その場で追加して記録できる」という
--   本機能の基本要件がそもそも成立しない。
--
--   もし将来、匿名を拒否したくなった場合はこの関数の先頭で
--       if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
--         raise exception '...';
--       end if;
--   を有効にする（現時点では**あえて入れていない**）。
--
--   【作成上限について】
--   1利用者あたり1日10件を上限とする（MVPの目安）。
--   ただしこれは「1つの匿名アカウントからの作りすぎ」を抑えるだけで、
--   匿名アカウントを作り直されれば回避できる。
--   **本格公開時の不正利用対策は別途必要**（レート制限・通報・管理者による一括削除等）。
--
-- ============================================================
-- 【SECURITY DEFINER の安全対策】
-- ============================================================
--   ・search_path を空文字に固定する（set search_path = ''）。
--     呼び出し側のsearch_pathを引き継がないため、同名オブジェクトへの
--     すり替えを防げる。pg_catalog は常に暗黙で参照されるので、
--     btrim/count/now/coalesce 等の組み込み関数はそのまま使える。
--   ・そのうえで public.books / public.book_contributions /
--     public.normalize_isbn13 等をすべて完全修飾する。
--   ・関数の所有者は postgres（SupabaseのSQL Editorで実行した場合の既定）。
--     所有者は books / book_contributions の所有者でもあるため、
--     関数内の書き込みは RLS に阻まれない。
--     ※ 別の所有者で作る場合は、その role に書き込み権限が必要。
-- ============================================================

-- ------------------------------------------------------------
-- A. books に列を追加（作品そのものの情報だけ）
--    ※ created_by は置かない（上記の理由）。
--    ※ source / source_id も置かない。同じ作品が複数の書誌提供元から
--      見つかるため、011の book_sources で1対多にする。
-- ------------------------------------------------------------
alter table public.books
  add column if not exists published_year int;

comment on column public.books.published_year is '出版年。改訂版・新装版など版違いの判別に使う';

-- ------------------------------------------------------------
-- A-2. ISBNの一意制約（部分ユニーク）
-- ------------------------------------------------------------
-- 利用者が仮作品を作れるようになるため、重複防止をDB側でも効かせる。
--   ・ISBNが無い作品（古い紙芝居・自費出版など）は何冊でも登録できる（where句）
--   ・同時実行で同じISBNが2件作られることを、DBが確実に防ぐ
--
-- 【前提】books.isbn には常に ISBN-13 に正規化した値だけを入れる。
--   このRPCは normalize_isbn13() を通した値しか書かない。
--   一括投入スクリプトでも必ず正規化してから入れること
--   （正規化前後の表記が混ざると、この制約では重複を防げない）。
--
-- 【実行前に必ず確認】既存の重複があると、この索引の作成は失敗する。
--   確認用SELECT（データは変更しない）:
--     select isbn, count(*) from public.books
--     where isbn is not null group by isbn having count(*) > 1;
create unique index if not exists uq_books_isbn
  on public.books (isbn) where isbn is not null;

-- ------------------------------------------------------------
-- B. 作品と「追加した利用者」の対応（非公開）
--    一般利用者は自分の行しか読めない。他人のUUIDは取得できない。
-- ------------------------------------------------------------
create table if not exists public.book_contributions (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books (id)     on delete cascade,
  created_by uuid not null references auth.users (id)       on delete cascade,
  created_at timestamptz not null default now(),
  constraint uq_book_contributions_book unique (book_id)
);

comment on table public.book_contributions is
  '仮登録した作品と追加者の対応。booksは全員が読めるため、利用者のIDはこちらに分離する。'
  '管理用テーブル。利用者画面には出さない';

create index if not exists idx_book_contributions_user
  on public.book_contributions (created_by, created_at desc);

alter table public.book_contributions enable row level security;

-- 自分が追加した分だけ読める（他人の行は見えない＝他人のUUIDを取得できない）
drop policy if exists "contrib_select_own" on public.book_contributions;
create policy "contrib_select_own" on public.book_contributions
  for select to authenticated using (created_by = auth.uid());

-- 管理者はすべて確認・修正できる
drop policy if exists "contrib_admin_all" on public.book_contributions;
create policy "contrib_admin_all" on public.book_contributions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ※ INSERT用のポリシーは意図的に作らない。
--   この表に書けるのは security definer の create_provisional_book() だけ。

-- ------------------------------------------------------------
-- C. ISBNをISBN-13へそろえる関数
--    誤ったISBNは null を返す（間違った値で既存作品に結び付けないため）
-- ------------------------------------------------------------
create or replace function public.normalize_isbn13(p_isbn text)
returns text language plpgsql immutable set search_path = '' as $$
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
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(coalesce(p_title, ''), '[[:space:]・･、。，．,.!！?？「」『』（）()【】ー~〜:：;；-]', '', 'g'))
$$;

-- ------------------------------------------------------------
-- D. 未登録作品を仮登録するRPC
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
language plpgsql security definer set search_path = '' as $$
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
  --    非公開の book_contributions で数える。
  --    ※ 匿名アカウントを作り直されれば回避できる。本格公開時の対策は別途必要。
  select count(*) into v_recent
  from public.book_contributions c
  where c.created_by = v_uid
    and c.created_at > now() - interval '1 day';
  if v_recent >= 10 then
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
  --    ※ 返すのは作品の情報だけ。追加者のIDは含めない。
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
  --
  --    同時実行対策：4のチェックの直後に他の人が同じISBNで作ることがある。
  --    そのときは uq_books_isbn に弾かれるので、エラーにせず既存作品を返す。
  begin
    insert into public.books (
      title, author, illustrator, publisher, isbn,
      material_type, published_year, is_active
    ) values (
      v_title,
      nullif(btrim(coalesce(p_author, '')), ''),
      nullif(btrim(coalesce(p_illustrator, '')), ''),
      nullif(btrim(coalesce(p_publisher, '')), ''),
      v_isbn,
      p_material_type,
      p_published_year,
      false
    )
    returning id into v_new_id;

  exception when unique_violation then
    -- ISBNが競合した＝ほぼ同時に誰かが同じ作品を作った。その作品を使う。
    select b.id into v_existing
    from public.books b
    where b.isbn = v_isbn
    order by b.is_active desc, b.created_at
    limit 1;

    if v_existing is not null then
      return query select v_existing, 'existing'::text, '[]'::jsonb;
      return;
    end if;
    raise;   -- ISBN以外の一意制約なら、隠さずそのまま上げる
  end;

  -- 7. 誰が追加したかは非公開テーブルへ。booksには残さない。
  insert into public.book_contributions (book_id, created_by)
  values (v_new_id, v_uid);

  return query select v_new_id, 'created'::text, '[]'::jsonb;
end $$;

comment on function public.create_provisional_book is
  'DBに無い作品を仮登録する。is_active=false を強制し、追加者は非公開の '
  'book_contributions に記録する。保育のタグ（care_points・seasonal_tags・'
  'event_tags・book_state_links）には触れない';

-- ------------------------------------------------------------
-- 権限の付与
-- ------------------------------------------------------------
-- 未認証の anon role には EXECUTE を付与しない。
-- Supabase匿名認証の利用者は authenticated role なので、意図的に利用を許可する。
--
-- 【anon を明示的に REVOKE する理由】
--   `create or replace function` は既存の権限設定を引き継ぐ。
--   そのため、以前のバージョンで anon に EXECUTE が付いていた場合、
--   `revoke all ... from public` だけでは anon の「直接付与された権限」は消えない
--   （PUBLIC への付与と、anon への直接付与は別物）。
--   実際に実DBで anon の EXECUTE が残っていたため、明示的に剥がす。
--   順序は「PUBLICから剥がす → anonから剥がす → authenticatedに付ける」。
revoke all    on function public.create_provisional_book(
  text, text, text, text, text, text, integer, boolean
) from public;

revoke execute on function public.create_provisional_book(
  text, text, text, text, text, text, integer, boolean
) from anon;

grant  execute on function public.create_provisional_book(
  text, text, text, text, text, text, integer, boolean
) to authenticated;

-- normalize_isbn13 は副作用が無く、値を整えるだけなので anon にも許可する
revoke all    on function public.normalize_isbn13(text) from public;
grant  execute on function public.normalize_isbn13(text) to authenticated, anon;

-- ------------------------------------------------------------
-- 権限の確認（適用後にこのSELECTで検算する）
--   authenticated_can_execute = true / anon_can_execute = false を期待する
-- ------------------------------------------------------------
--   select
--     has_function_privilege('authenticated',
--       'public.create_provisional_book(text,text,text,text,text,text,integer,boolean)',
--       'execute') as authenticated_can_execute,
--     has_function_privilege('anon',
--       'public.create_provisional_book(text,text,text,text,text,text,integer,boolean)',
--       'execute') as anon_can_execute;

-- ------------------------------------------------------------
-- E. 権限の最終状態（確認用）
--    books                … SELECT: anon,authenticated ／ 書き込み: 管理者のみ（変更なし）
--                           一般利用者が直接 INSERT/UPDATE/DELETE する手段は無いまま
--    book_contributions   … SELECT: 自分の行のみ ／ 管理者は全件 ／ INSERTポリシーなし
--                           （書けるのは create_provisional_book() だけ）
--    create_provisional_book … EXECUTE: authenticated のみ（匿名認証の利用者を含む）
--    normalize_isbn13     … EXECUTE: authenticated, anon（副作用なし）
-- ------------------------------------------------------------

-- ============================================================
-- ロールバック（元に戻す場合）
-- ※ 追加した関数・テーブル・列・索引を落とすだけ。
--   元からあった列・データ・権限は無傷
-- ------------------------------------------------------------
-- drop function if exists public.create_provisional_book(text, text, text, text, text, text, integer, boolean);
-- drop function if exists public.book_title_key(text);
-- drop function if exists public.normalize_isbn13(text);
-- drop table if exists public.book_contributions;
-- drop index if exists public.uq_books_isbn;
-- alter table public.books drop column if exists published_year;
-- ============================================================
