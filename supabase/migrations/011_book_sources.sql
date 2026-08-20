-- ============================================================
-- えほんのあと 追加migration【案・未実行】
-- 011_book_sources.sql
-- 目的: 同じ作品が複数の書誌提供元から見つかる前提で、外部IDを1対多で持つ
-- 既存データへの影響: なし（テーブルの新設のみ。books は変更しない）
-- ============================================================
--
-- 【なぜ books.source / source_id にしないのか】
--   1つの作品が 国立国会図書館サーチ・openBD の両方に存在することは普通にある。
--   books に単一の source / source_id を持たせると、
--     ・あとから見つかった提供元を記録できない
--     ・どちらか一方で上書きしてしまう
--     ・提供元を乗り換えるときに books を書き換える必要が出る
--   数千冊入れたあとで直すのは高くつくため、最初から1対多にしておく。
--
--   books ←─(1対多)─ book_sources
--
-- 【書影・本文について】
--   このテーブルには「どこから取得したか」の対応と、再取得のための識別子だけを置く。
--   書影の画像や内容紹介文をそのまま溜め込む用途には使わない
--   （利用条件の確認が済むまで保存しない方針のため）。
--   raw は取得時の生データを一時的に持てるようにするが、
--   利用条件が確定するまでは null 運用でよい。
-- ============================================================

create table if not exists public.book_sources (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books (id) on delete cascade,
  provider   text not null,          -- 'ndl' / 'openbd' / 'manual' など
  source_id  text not null,          -- その提供元での識別子（NDLのIDやISBNなど）
  source_url text,                   -- 出所をたどれるようにする
  raw        jsonb,                  -- 取得時の生データ（利用条件確認後に使う。当面はnull）
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  -- 同じ提供元の同じレコードが2つの作品に結び付かないようにする
  constraint uq_book_sources_provider_source unique (provider, source_id)

  -- 【unique (book_id, provider) は付けない】
  --   同じ作品に、同じ提供元の書誌レコードが複数対応することがあるため。
  --   例）1作品 ├ NDLレコードA（単行本）
  --            ├ NDLレコードB（大型版）
  --            └ openBDレコードA
  --   ここを一意にすると、あとから見つかったレコードを記録できなくなる。
  --   引き方の速さは下の索引で確保する。
);

comment on table  public.book_sources is
  '作品と外部書誌提供元の対応。1つの作品が複数の提供元に存在しうるため1対多で持つ';
comment on column public.book_sources.provider   is '書誌の提供元。将来増減しうるためCHECK制約は付けない';
comment on column public.book_sources.source_id  is '提供元での識別子。再取得・更新に使う';
comment on column public.book_sources.raw        is '取得時の生データ。利用条件を確認するまでは保存しない';

-- 「この作品の、この提供元の書誌」を引くための索引（一意ではない＝複数レコード可）
create index if not exists idx_book_sources_book_provider on public.book_sources (book_id, provider);
create index if not exists idx_book_sources_provider      on public.book_sources (provider, fetched_at desc);

-- ------------------------------------------------------------
-- RLS：books と同じ考え方
--   読み取り … 誰でも可（非機微な書誌の対応情報）
--   書き込み … 管理者のみ（取り込み処理は service_role で行う）
-- ------------------------------------------------------------
alter table public.book_sources enable row level security;

drop policy if exists "book_sources_read_all" on public.book_sources;
create policy "book_sources_read_all" on public.book_sources
  for select to anon, authenticated using (true);

drop policy if exists "book_sources_admin_write" on public.book_sources;
create policy "book_sources_admin_write" on public.book_sources
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- ロールバック（元に戻す場合）
-- ※ このテーブルを落とすだけ。books とその行は無傷
-- ------------------------------------------------------------
-- drop table if exists public.book_sources;
-- ============================================================
