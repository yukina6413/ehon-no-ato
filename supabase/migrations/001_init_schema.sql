-- ============================================================
-- えほんのあと MVP スキーマ
-- 001_init_schema.sql
-- Supabase SQL Editor でそのまま実行できます
-- ============================================================
-- 設計方針:
--  * 入口は「子どもの姿」(child_states) — 絵本タイトルではない
--  * 子どもの個人名を保存するカラムは存在しない
--  * 利用者画面に出さない管理用カラムは comment で明記
--  * AI は判断を置き換えない — 断定的なラベルをデータ層に持ち込まない
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 共通: updated_at 自動更新トリガー
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 8. profiles — Supabase Auth ユーザー拡張
-- ============================================================
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role         text not null default 'user'
               check (role in ('user', 'admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table  public.profiles is 'Auth ユーザーの拡張情報';
comment on column public.profiles.role is '管理用カラム。利用者画面には表示しない。admin はマスターデータ編集権限を持つ';

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- サインアップ時に profile を自動作成
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- admin 判定関数（RLS ポリシーから利用。security definer で再帰RLSを回避）
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- 1. child_states — 子どもの姿マスター（45語の検索ハブ）
-- ============================================================
create table public.child_states (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  category       text,                       -- 例: 友達関係 / 感情 / 探究 / 生活習慣 ...
  synonyms       text[] not null default '{}',
  related_themes text[] not null default '{}',
  sort_order     int,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table  public.child_states is '子どもの姿マスター。全機能の入口となる語彙ハブ。評価的・断定的な語は登録しない';
comment on column public.child_states.is_active   is '管理用カラム。利用者画面には表示しない。false は検索候補から外す';
comment on column public.child_states.sort_order  is '管理用カラム。利用者画面には表示しない。表示順制御用';

create index idx_child_states_category on public.child_states (category);

create trigger trg_child_states_updated_at
  before update on public.child_states
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. books — 絵本マスター
-- ============================================================
create table public.books (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  author          text,
  illustrator     text,
  publisher       text,
  isbn            text,
  age_min         int check (age_min between 0 and 6),
  age_max         int check (age_max between 0 and 6),
  scenes          text[] not null default '{}',   -- 例: 午睡前 / 朝の会 / 帰りの会 / 活動の導入
  seasonal_tags   text[] not null default '{}',   -- 例: 春 / 初夏
  event_tags      text[] not null default '{}',   -- 例: ひな祭り / 運動会
  summary         text,
  care_points     text,   -- 「配慮あり」の中身。やわらかい文で書く（〜かもしれません）
  next_activities text,   -- 次のケア・つながる活動のヒント
  caution_notes   text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint chk_books_age_range check (
    age_min is null or age_max is null or age_min <= age_max
  )
);

comment on table  public.books is '絵本マスター';
comment on column public.books.caution_notes is '管理用カラム。利用者画面には表示しない。評価的な表現がシステムに入るのを防ぐための内部メモ';
comment on column public.books.is_active     is '管理用カラム。利用者画面には表示しない。false は検索から除外';

create index idx_books_title on public.books (title);
create index idx_books_age   on public.books (age_min, age_max);

create trigger trg_books_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3. book_state_links — 絵本 × 子どもの姿（中間テーブル）
--    relation:
--      pre       = この姿のときに候補になる（読む前の子どもの姿）
--      post_pred = 読んだあとに現れるかもしれない姿（AI予測。断定しない）
--      avoid     = この姿のときは候補から完全に除外する
-- ============================================================
create table public.book_state_links (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books (id) on delete cascade,
  state_id   uuid not null references public.child_states (id) on delete cascade,
  relation   text not null check (relation in ('pre', 'post_pred', 'avoid')),
  note       text,
  created_at timestamptz not null default now(),
  unique (book_id, state_id, relation)
);

comment on table  public.book_state_links is '絵本と子どもの姿の関係。avoid はこの中間テーブルの relation=''avoid'' として表現する';
comment on column public.book_state_links.note is '管理用カラム。利用者画面には表示しない。「AI生成」「確認済み」等の来歴・根拠メモはここに置き、画面には出さない';

create index idx_bsl_state_relation on public.book_state_links (state_id, relation);
create index idx_bsl_book           on public.book_state_links (book_id, relation);

-- ============================================================
-- 4. practice_logs — 実践記録
--    ※ 子どもの個人名を保存するカラムは意図的に存在しない
-- ============================================================
create table public.practice_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
             references auth.users (id) on delete cascade,
  book_id    uuid not null references public.books (id),
  read_date  date not null default current_date,
  class_name text,   -- クラス名のみ（例: ひまわり組）。個人名は入力しない運用
  age_group  int check (age_group between 0 and 6),
  scene      text,   -- 例: 午睡前 / 朝の会
  reaction   text check (reaction in (
               'じっくり見ていた',
               '反応が大きかった',
               '静かに受け止めていた',
               'あとにつながった'
             )),
  memo       text,   -- 一行メモ（個人名を書かない前提のフリーテキスト）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.practice_logs is '実践記録。子ども個人ではなくクラス・場面単位で記録する（個人名カラムなし）';

create index idx_logs_user_date on public.practice_logs (user_id, read_date desc);
create index idx_logs_book      on public.practice_logs (book_id);

create trigger trg_practice_logs_updated_at
  before update on public.practice_logs
  for each row execute function public.set_updated_at();

-- ============================================================
-- 5. practice_log_states — 実践記録 × 子どもの姿
--    phase: pre = 読む前に見られた姿 / post = 読んだあとに観察された姿
-- ============================================================
create table public.practice_log_states (
  id       uuid primary key default gen_random_uuid(),
  log_id   uuid not null references public.practice_logs (id) on delete cascade,
  state_id uuid not null references public.child_states (id),
  phase    text not null check (phase in ('pre', 'post')),
  unique (log_id, state_id, phase)
);

comment on table public.practice_log_states is '実践記録と子どもの姿の関係。pre(予測)→post(実際)の対応がフィードバックループの資産になる';

create index idx_pls_log   on public.practice_log_states (log_id);
create index idx_pls_state on public.practice_log_states (state_id, phase);

-- ============================================================
-- 6. ai_reports — AIレポート（画面実装は後回し、テーブルのみ）
-- ============================================================
create table public.ai_reports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid()
                 references auth.users (id) on delete cascade,
  report_type    text not null check (report_type in (
                   'daily', 'weekly', 'monthly', 'newsletter', 'conference'
                 )),
  period_start   date,
  period_end     date,
  source_log_ids uuid[] not null default '{}',  -- 元になった practice_logs.id
  content        jsonb not null default '{}',   -- 要約/子どもの姿/解釈/ねらい/明日のヒント 等の構造化本文
  status         text not null default 'draft'
                 check (status in ('draft', 'generated', 'edited')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table  public.ai_reports is 'AIレポート。AIは下書きを作り、保育士が確認・編集する前提';
comment on column public.ai_reports.status is '管理用カラム。利用者画面には「AI生成」「確認済み」等のラベルとして表示しない。内部の編集状態管理のみ';

create index idx_reports_user on public.ai_reports (user_id, created_at desc);

create trigger trg_ai_reports_updated_at
  before update on public.ai_reports
  for each row execute function public.set_updated_at();

-- ============================================================
-- 7. knowledge_notes — 園の知見（将来の園用アプリ向けスキーマのみ）
--    MVP では RLS ポリシーを一切付与しない = API から誰にも見えない
-- ============================================================
create table public.knowledge_notes (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid,        -- 将来の園（組織）ID。MVPでは未使用
  author_user_id uuid references auth.users (id) on delete set null,
  title          text not null,
  body           text not null,
  tags           text[] not null default '{}',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table  public.knowledge_notes is '園の知見（人が書く制度的記憶）。MVPでは利用者から不可視（ポリシーなしRLS）。園用アプリで開放予定';
comment on column public.knowledge_notes.is_active is '管理用カラム。利用者画面には表示しない';

create trigger trg_knowledge_notes_updated_at
  before update on public.knowledge_notes
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS（Row Level Security）
-- ============================================================

-- ---- profiles: 本人のみ読み書き（roleの自己昇格は防ぐ） ----
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = 'user' or public.is_admin());

-- ---- マスター3表: 全ログインユーザー読み取り可 / 書き込みは admin のみ ----
alter table public.child_states     enable row level security;
alter table public.books            enable row level security;
alter table public.book_state_links enable row level security;

create policy "child_states_read_all"
  on public.child_states for select
  to authenticated using (true);
create policy "child_states_admin_insert"
  on public.child_states for insert
  to authenticated with check (public.is_admin());
create policy "child_states_admin_update"
  on public.child_states for update
  to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "child_states_admin_delete"
  on public.child_states for delete
  to authenticated using (public.is_admin());

create policy "books_read_all"
  on public.books for select
  to authenticated using (true);
create policy "books_admin_insert"
  on public.books for insert
  to authenticated with check (public.is_admin());
create policy "books_admin_update"
  on public.books for update
  to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "books_admin_delete"
  on public.books for delete
  to authenticated using (public.is_admin());

create policy "bsl_read_all"
  on public.book_state_links for select
  to authenticated using (true);
create policy "bsl_admin_insert"
  on public.book_state_links for insert
  to authenticated with check (public.is_admin());
create policy "bsl_admin_update"
  on public.book_state_links for update
  to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "bsl_admin_delete"
  on public.book_state_links for delete
  to authenticated using (public.is_admin());

-- ---- 個人データ3表: user_id = auth.uid() のみ ----
alter table public.practice_logs enable row level security;

create policy "logs_own_all"
  on public.practice_logs for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.practice_log_states enable row level security;

create policy "pls_own_all"
  on public.practice_log_states for all
  to authenticated
  using (exists (
    select 1 from public.practice_logs l
    where l.id = log_id and l.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.practice_logs l
    where l.id = log_id and l.user_id = auth.uid()
  ));

alter table public.ai_reports enable row level security;

create policy "reports_own_all"
  on public.ai_reports for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---- knowledge_notes: RLS有効・ポリシーなし = MVPでは誰からも不可視 ----
alter table public.knowledge_notes enable row level security;
-- （意図的にポリシーを作成しない。園用アプリ実装時に org 単位のポリシーを追加する）
