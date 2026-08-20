-- ============================================================
-- えほんのあと 追加migration【案・未実行】
-- 009_material_type.sql
-- 目的: 「絵本」と「紙芝居」をDB上で区別できるようにする
-- 既存データへの影響: なし（列の追加のみ。既存5冊は自動的に 'picture_book' になる）
-- ============================================================
--
-- 【なぜ enum ではなく text + CHECK か】
--   - このプロジェクトは既に text + CHECK で種別を表している
--     （book_state_links.relation / practice_logs.reaction / activity_plans.status）。
--     同じ書き方にそろえる。
--   - Postgres の enum は値を後から削除できず、並び替えもできない。
--     将来「絵本 / 紙芝居 / パネルシアター」等に広げる可能性を考えると、
--     CHECK制約の差し替え（drop→add）で済む text の方が安全。
--   - PostgREST/supabase-js からは、どちらでも文字列として扱える。
--
-- 【なぜ not null default か】
--   既存5冊はすべて絵本。default を付けて追加すれば、既存行は書き換え不要で
--   'picture_book' が入る（Postgres 11以降は表の書き換えも起きない）。
-- ============================================================

alter table public.books
  add column if not exists material_type text not null default 'picture_book';

-- CHECK制約は「既に無ければ付ける」形にして、2回実行しても壊れないようにする
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.books'::regclass and conname = 'chk_books_material_type'
  ) then
    alter table public.books
      add constraint chk_books_material_type
      check (material_type in ('picture_book', 'kamishibai'));
  end if;
end $$;

comment on column public.books.material_type is
  '作品種別。picture_book=絵本 / kamishibai=紙芝居。紙芝居は絵本の付属ではなく対等な種別として扱う';

-- 【索引は今回作らない】
--   material_type は 'picture_book' / 'kamishibai' の2値しかない。
--   数千冊規模では、この列だけの索引はプランナに使われにくく（低カーディナリティ）、
--   書き込みのたびに更新される分だけ損になりやすい。
--   「絵本だけ／紙芝居だけ」で絞る検索を実際に足し、遅いと分かった時点で、
--   そのときの検索条件に合わせた複合索引を作る方が確実。
--   例（将来・必要になってから）:
--     create index on public.books (material_type, title) where is_active;

-- ============================================================
-- ロールバック（元に戻す場合）
-- ※ 追加した列とCHECK制約を落とすだけ。元からあった列・データは無傷
-- ------------------------------------------------------------
-- alter table public.books drop constraint if exists chk_books_material_type;
-- alter table public.books drop column if exists material_type;
-- ============================================================
