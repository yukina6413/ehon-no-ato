-- ============================================================
-- えほんのあと MVP 完全セットアップ（単一ファイル・再現用）
-- 000_complete_mvp_setup.sql
-- ============================================================
-- 目的:
--   新しい空の Supabase プロジェクトで「これ1本だけ」を実行すれば、
--   MVPの一周（子どもの姿→検索→絵本選択→記録保存→記録一覧）が
--   実データで動く状態を再現する。
--
-- 使い方:
--   ・新しい空プロジェクト → このファイルだけを SQL Editor で実行する。
--     （001〜006 は実行しない。000 が001〜006の内容＋修正をすべて含む）
--   ・既存プロジェクト → 冪等（if not exists / on conflict / drop→create）
--     なので実行しても壊れにくい。不足していた列・ポリシー・seedを補う。
--
-- 安全性:
--   ・データを削除する命令（drop table / delete / truncate）は含まない。
--   ・drop するのは「関数」「ポリシー」「トリガー」のみ（再作成のため。データ非破壊）。
--
-- 001〜006 との対応:
--   001 スキーマ / 002 seed / 003 検索RPC / 004 記録列追加 /
--   005 activity_plans / 006 calendar_view を統合。
--   加えて次の修正を反映:
--   (a) 検索RPCは3引数(p_state_id, p_age_group, p_scene)。p_season は持たない。
--   (b) 検索RPCの返却に author・summary を追加（画面が読むため）。
--   (c) マスタ3表(child_states, books, book_state_links)と検索RPCを
--       anon にも読める/実行できるようにする（ログイン前でも検索できるアプリ仕様に合わせる）。
--   (d) practice_logs に 004 の記録列(interest_tags 等)を最初から含める。
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 共通関数
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- profiles（Auth ユーザー拡張）
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role         text not null default 'user' check (role in ('user', 'admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on column public.profiles.role is '管理用カラム。利用者画面には表示しない。admin はマスターデータ編集権限を持つ';

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- サインアップ時に profile を自動作成
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- admin 判定（RLSから利用。security definer で再帰RLSを回避）
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- child_states（子どもの姿マスター・検索の入口）
-- ============================================================
create table if not exists public.child_states (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  category       text,
  synonyms       text[] not null default '{}',
  related_themes text[] not null default '{}',
  sort_order     int,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.child_states is '子どもの姿マスター。全機能の入口。評価的・断定的な語は登録しない';

create index if not exists idx_child_states_category on public.child_states (category);

drop trigger if exists trg_child_states_updated_at on public.child_states;
create trigger trg_child_states_updated_at
  before update on public.child_states
  for each row execute function public.set_updated_at();

-- ============================================================
-- books（絵本マスター）
-- ============================================================
create table if not exists public.books (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  author          text,
  illustrator     text,
  publisher       text,
  isbn            text,
  age_min         int check (age_min between 0 and 6),
  age_max         int check (age_max between 0 and 6),
  scenes          text[] not null default '{}',
  seasonal_tags   text[] not null default '{}',
  event_tags      text[] not null default '{}',
  summary         text,
  care_points     text,
  next_activities text,
  caution_notes   text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint chk_books_age_range check (
    age_min is null or age_max is null or age_min <= age_max
  )
);
comment on column public.books.caution_notes is '管理用カラム。利用者画面には表示しない';

create index if not exists idx_books_title on public.books (title);
create index if not exists idx_books_age   on public.books (age_min, age_max);

drop trigger if exists trg_books_updated_at on public.books;
create trigger trg_books_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- ============================================================
-- book_state_links（絵本 × 子どもの姿）
--   relation: pre=候補になる / post_pred=読後に現れるかも / avoid=除外
-- ============================================================
create table if not exists public.book_state_links (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books (id) on delete cascade,
  state_id   uuid not null references public.child_states (id) on delete cascade,
  relation   text not null check (relation in ('pre', 'post_pred', 'avoid')),
  note       text,
  created_at timestamptz not null default now(),
  unique (book_id, state_id, relation)
);
comment on column public.book_state_links.note is '管理用カラム。利用者画面には表示しない';

create index if not exists idx_bsl_state_relation on public.book_state_links (state_id, relation);
create index if not exists idx_bsl_book           on public.book_state_links (book_id, relation);

-- ============================================================
-- practice_logs（実践記録・個人名カラムは意図的に持たない）
--   004 の記録列(interest_tags 等)を最初から含める
-- ============================================================
create table if not exists public.practice_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id    uuid not null references public.books (id),
  read_date  date not null default current_date,
  class_name text,
  age_group  int check (age_group between 0 and 6),
  scene      text,
  reaction   text check (reaction in (
               'じっくり見ていた','反応が大きかった','静かに受け止めていた','あとにつながった'
             )),
  memo       text,
  interest_tags   text[] not null default '{}',
  interest_points text,
  child_words     text,
  play_expansion  text,
  next_ideas      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.practice_logs is '実践記録。クラス・場面単位で記録（個人名カラムなし）';

-- 既存プロジェクト向けの自己修復（列が無ければ足す。fresh では no-op）
alter table public.practice_logs
  add column if not exists interest_tags   text[] not null default '{}',
  add column if not exists interest_points text,
  add column if not exists child_words     text,
  add column if not exists play_expansion  text,
  add column if not exists next_ideas      text;

create index if not exists idx_logs_user_date on public.practice_logs (user_id, read_date desc);
create index if not exists idx_logs_book      on public.practice_logs (book_id);

drop trigger if exists trg_practice_logs_updated_at on public.practice_logs;
create trigger trg_practice_logs_updated_at
  before update on public.practice_logs
  for each row execute function public.set_updated_at();

-- ============================================================
-- practice_log_states（実践記録 × 子どもの姿：pre/post）
-- ============================================================
create table if not exists public.practice_log_states (
  id       uuid primary key default gen_random_uuid(),
  log_id   uuid not null references public.practice_logs (id) on delete cascade,
  state_id uuid not null references public.child_states (id),
  phase    text not null check (phase in ('pre', 'post')),
  unique (log_id, state_id, phase)
);

create index if not exists idx_pls_log   on public.practice_log_states (log_id);
create index if not exists idx_pls_state on public.practice_log_states (state_id, phase);

-- ============================================================
-- ai_reports（レポート種別に 'practice' を含む＝004反映）
-- ============================================================
create table if not exists public.ai_reports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  report_type    text not null check (report_type in (
                   'practice','daily','weekly','monthly','newsletter','conference'
                 )),
  period_start   date,
  period_end     date,
  source_log_ids uuid[] not null default '{}',
  content        jsonb not null default '{}',
  status         text not null default 'draft' check (status in ('draft','generated','edited')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on column public.ai_reports.status is '管理用カラム。利用者画面にはラベル表示しない';

-- 既存プロジェクト向けの自己修復：'practice' を含む制約に付け替え（既存行は適合）
alter table public.ai_reports drop constraint if exists ai_reports_report_type_check;
alter table public.ai_reports
  add constraint ai_reports_report_type_check
  check (report_type in ('practice','daily','weekly','monthly','newsletter','conference'));

create index if not exists idx_reports_user on public.ai_reports (user_id, created_at desc);

drop trigger if exists trg_ai_reports_updated_at on public.ai_reports;
create trigger trg_ai_reports_updated_at
  before update on public.ai_reports
  for each row execute function public.set_updated_at();

-- ============================================================
-- activity_plans（保育士が採用した次回活動＝005）
-- ============================================================
create table if not exists public.activity_plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  report_id      uuid references public.ai_reports (id) on delete set null,
  source_log_id  uuid references public.practice_logs (id) on delete set null,
  activity_type  text not null check (activity_type in
                   ('recommended','widening','deepening','reread','custom')),
  title          text not null,
  description    text,
  materials      text[] not null default '{}',
  duration_min   int,
  place          text,
  group_size     text,
  teacher_role   text,
  environment    text,
  trigger_hint   text,
  was_edited     boolean not null default false,
  scheduled_date date,
  status         text not null default 'planned' check (status in ('planned','done','skipped')),
  done_log_id    uuid references public.practice_logs (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on column public.activity_plans.was_edited is '管理用カラム。利用者画面には表示しない';

create index if not exists idx_plans_user_date on public.activity_plans (user_id, scheduled_date);
create index if not exists idx_plans_report    on public.activity_plans (report_id);

drop trigger if exists trg_activity_plans_updated_at on public.activity_plans;
create trigger trg_activity_plans_updated_at
  before update on public.activity_plans
  for each row execute function public.set_updated_at();

-- ============================================================
-- knowledge_notes（園の知見。MVPでは不可視＝ポリシーなしRLS）
-- ============================================================
create table if not exists public.knowledge_notes (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid,
  author_user_id uuid references auth.users (id) on delete set null,
  title          text not null,
  body           text not null,
  tags           text[] not null default '{}',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_knowledge_notes_updated_at on public.knowledge_notes;
create trigger trg_knowledge_notes_updated_at
  before update on public.knowledge_notes
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS（行レベルセキュリティ）
-- ============================================================
alter table public.profiles            enable row level security;
alter table public.child_states        enable row level security;
alter table public.books               enable row level security;
alter table public.book_state_links    enable row level security;
alter table public.practice_logs       enable row level security;
alter table public.practice_log_states enable row level security;
alter table public.ai_reports          enable row level security;
alter table public.activity_plans      enable row level security;
alter table public.knowledge_notes     enable row level security;

-- ---- profiles: 本人のみ ----
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check ((id = auth.uid() and role = 'user') or public.is_admin());

-- ---- マスタ3表: 読み取りは anon + authenticated（ログイン前でも検索できる）/ 書き込みは admin ----
--   ※ これらは非機微な参照データ（公開カタログ相当）。個人データは含まない。
grant select on public.child_states     to anon, authenticated;
grant select on public.books            to anon, authenticated;
grant select on public.book_state_links to anon, authenticated;

drop policy if exists "child_states_read_all" on public.child_states;
create policy "child_states_read_all" on public.child_states
  for select to anon, authenticated using (true);
drop policy if exists "child_states_admin_write" on public.child_states;
create policy "child_states_admin_write" on public.child_states
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "books_read_all" on public.books;
create policy "books_read_all" on public.books
  for select to anon, authenticated using (true);
drop policy if exists "books_admin_write" on public.books;
create policy "books_admin_write" on public.books
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "bsl_read_all" on public.book_state_links;
create policy "bsl_read_all" on public.book_state_links
  for select to anon, authenticated using (true);
drop policy if exists "bsl_admin_write" on public.book_state_links;
create policy "bsl_admin_write" on public.book_state_links
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- 個人データ: user_id = auth.uid() のみ ----
drop policy if exists "logs_own_all" on public.practice_logs;
create policy "logs_own_all" on public.practice_logs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "pls_own_all" on public.practice_log_states;
create policy "pls_own_all" on public.practice_log_states
  for all to authenticated
  using (exists (select 1 from public.practice_logs l where l.id = log_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.practice_logs l where l.id = log_id and l.user_id = auth.uid()));

drop policy if exists "reports_own_all" on public.ai_reports;
create policy "reports_own_all" on public.ai_reports
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "plans_own_all" on public.activity_plans;
create policy "plans_own_all" on public.activity_plans
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- knowledge_notes: 意図的にポリシーを作らない（MVPでは誰からも不可視）

-- ============================================================
-- calendar_view（practice_logs + activity_plans の表示専用・006）
-- ============================================================
create or replace view public.calendar_view with (security_invoker = true) as
select ('log-'  || l.id)::text as entry_id, 'practice_log'::text as entry_type,
       l.read_date as entry_date, b.title as title, l.class_name as class_name,
       null::text as status, l.id as log_id, null::uuid as plan_id
from public.practice_logs l join public.books b on b.id = l.book_id
union all
select ('plan-' || p.id)::text, 'activity_plan'::text,
       p.scheduled_date, p.title, null::text,
       p.status, p.done_log_id, p.id
from public.activity_plans p where p.scheduled_date is not null;

revoke all on public.calendar_view from public, anon, authenticated;
grant select on public.calendar_view to authenticated;

-- ============================================================
-- 検索RPC search_books_by_state
--   3引数(p_state_id, p_age_group, p_scene)。返却に author・summary を含む。
--   anon + authenticated が実行可。
-- ============================================================
-- 旧シグネチャが残っていれば除去（3引数版・過去の4引数版の両方）
drop function if exists public.search_books_by_state(uuid, int, text);
drop function if exists public.search_books_by_state(uuid, int, text, text);

create function public.search_books_by_state(
  p_state_id  uuid,
  p_age_group int  default null,
  p_scene     text default null
)
returns table (
  book_id           uuid,
  title             text,
  author            text,
  summary           text,
  age_min           int,
  age_max           int,
  scenes            text[],
  next_activities   text,
  care_points       text,
  has_practice_log  boolean,
  has_care_points   boolean,
  has_avoid_context boolean,
  post_states_pred  text[],
  score             numeric
)
language sql stable security invoker set search_path = public as $$
  with candidates as (
    select
      b.id, b.title, b.author, b.summary, b.age_min, b.age_max,
      b.scenes, b.next_activities, b.care_points,
      (p_age_group is not null
        and (b.age_min is null or b.age_min <= p_age_group)
        and (b.age_max is null or b.age_max >= p_age_group)) as age_matched,
      (p_scene is not null and p_scene = any (b.scenes))      as scene_matched
    from public.book_state_links l
    join public.books b on b.id = l.book_id
    where l.state_id = p_state_id
      and l.relation = 'pre'
      and b.is_active = true
      and not exists (
        select 1 from public.book_state_links a
        where a.book_id = b.id and a.state_id = p_state_id and a.relation = 'avoid'
      )
      and (
        p_age_group is null
        or ((b.age_min is null or b.age_min <= p_age_group)
            and (b.age_max is null or b.age_max >= p_age_group))
      )
      and (
        p_scene is null or cardinality(b.scenes) = 0 or p_scene = any (b.scenes)
      )
  ),
  enriched as (
    select c.*,
      exists (select 1 from public.practice_logs pl where pl.book_id = c.id) as has_practice_log,
      (c.care_points is not null and length(trim(c.care_points)) > 0) as has_care_points,
      exists (
        select 1 from public.book_state_links a2
        where a2.book_id = c.id and a2.relation = 'avoid' and a2.state_id <> p_state_id
      ) as has_avoid_context,
      coalesce((
        select array_agg(cs.name order by cs.name)
        from public.book_state_links pp
        join public.child_states cs on cs.id = pp.state_id
        where pp.book_id = c.id and pp.relation = 'post_pred' and cs.is_active = true
      ), '{}') as post_states_pred
    from candidates c
  )
  select
    e.id, e.title, e.author, e.summary, e.age_min, e.age_max,
    e.scenes, e.next_activities, e.care_points,
    e.has_practice_log, e.has_care_points, e.has_avoid_context, e.post_states_pred,
    (1.0
      + case when e.has_practice_log then 0.5 else 0 end
      + case when e.has_care_points  then 0.3 else 0 end
      + case when e.age_matched      then 0.2 else 0 end
      + case when e.scene_matched    then 0.2 else 0 end
    )::numeric(4,2) as score
  from enriched e
  order by score desc, e.title asc;
$$;

grant execute on function public.search_books_by_state(uuid, int, text) to anon, authenticated;

-- ============================================================
-- seed: child_states（14語・固定UUID）
--   固定IDにより book_state_links と確実に対応する（IDズレ防止）
-- ============================================================
insert into public.child_states (id, name, category, synonyms, related_themes, sort_order) values
  ('11111111-0000-0000-0000-000000000001','貸し借りが難しい','友達関係', array['おもちゃの取り合い','貸せない','独り占め'], array['所有','思いやり','順番'], 10),
  ('11111111-0000-0000-0000-000000000002','順番が待てない','友達関係', array['割り込み','待つのが苦手'], array['ルール','がまん','見通し'], 20),
  ('11111111-0000-0000-0000-000000000003','友達とのトラブルが増えた','友達関係', array['けんかが多い','手が出る'], array['気持ちの言語化','関係づくり'], 30),
  ('11111111-0000-0000-0000-000000000004','食べ物・料理に興味','興味・関心', array['お料理ごっこ','クッキング'], array['食育','季節の食材'], 40),
  ('11111111-0000-0000-0000-000000000005','苦手な食べ物がある','生活習慣', array['好き嫌い','偏食'], array['食育','安心'], 50),
  ('11111111-0000-0000-0000-000000000006','虫を探している','自然・季節', array['虫とり','だんごむし','昆虫'], array['いのち','観察','季節'], 60),
  ('11111111-0000-0000-0000-000000000007','数えることに興味','探究', array['数字','いくつ','かず'], array['数量','比較'], 70),
  ('11111111-0000-0000-0000-000000000008','色や形に興味','探究', array['いろ','かたち','模様'], array['造形','観察'], 80),
  ('11111111-0000-0000-0000-000000000009','午睡前に落ち着きたい','生活習慣', array['お昼寝前','入眠','クールダウン'], array['安心','生活リズム'], 90),
  ('11111111-0000-0000-0000-000000000010','怖い・こわい話が苦手','感情', array['怖がり','おばけが苦手'], array['安心','気持ちの表現'], 100),
  ('11111111-0000-0000-0000-000000000011','死について質問してきた','いのち', array['死んだらどうなるの','いのちの質問'], array['いのち','喪失','安心'], 110),
  ('11111111-0000-0000-0000-000000000012','体を動かしたい','活動', array['走り回る','エネルギーが余っている'], array['運動遊び','発散'], 120),
  ('11111111-0000-0000-0000-000000000013','描く・作るのが好き','活動', array['お絵かき','工作','製作'], array['造形','表現'], 130),
  ('11111111-0000-0000-0000-000000000014','ごっこ遊びが盛ん','活動', array['おままごと','なりきり遊び'], array['想像','役割','言葉'], 140)
on conflict (id) do nothing;

-- ============================================================
-- seed: books（4冊・固定UUID）
-- ============================================================
insert into public.books
  (id, title, author, illustrator, publisher, age_min, age_max, scenes, seasonal_tags, event_tags, summary, care_points, next_activities) values
  ('22222222-0000-0000-0000-000000000001','そらまめくんのベッド','なかや みわ','なかや みわ','福音館書店',
    3,5, array['活動の導入','朝の会','午睡前'], array['春','初夏'], '{}',
    'たからもののベッドを貸したくないそらまめくん。うずらの卵との出会いを通して、大切なものを分かち合う気持ちが芽ばえていく物語。',
    '「貸してあげようね」とまとめず、そらまめくんの「貸したくない気持ち」にも共感しながら読むと、自分の気持ちを大事にされた安心感につながるかもしれません。',
    '空き箱や布で「じぶんのベッドづくり」をしてみる。豆のさやの観察や、水にうかべて遊ぶのもつながりやすいです。'),
  ('22222222-0000-0000-0000-000000000002','ぐりとぐら','なかがわ りえこ','おおむら ゆりこ','福音館書店',
    2,5, array['活動の導入','朝の会'], '{}', '{}',
    '料理すること食べることが大好きな野ねずみのぐりとぐら。大きな卵で作ったカステラを、森のみんなで分け合うお話。',
    '「みんなで分ける」場面は、貸し借りが難しい姿を叱る材料にせず、「いいにおいがしてきそうだね」と楽しさの共有から入ると届きやすいかもしれません。',
    'カステラやホットケーキのクッキング、ままごとコーナーの充実、卵の大きさくらべなどにつながります。'),
  ('22222222-0000-0000-0000-000000000003','てぶくろ','ウクライナ民話 / うちだ りさこ 訳','エウゲーニー・M・ラチョフ','福音館書店',
    3,5, array['午睡前','帰りの会','活動の導入'], array['冬'], '{}',
    '雪の上に落ちたてぶくろに、動物たちが次々と入っていくお話。「いれて」「どうぞ」のやりとりが繰り返される。',
    '「どうして全部入れるの?」という子どもの疑問は、正解を伝えるより「どう思う?」と返すと、想像の世界が広がるかもしれません。',
    '大きな布や段ボールで「みんなのてぶくろ」ごっこへ。「いれて」「どうぞ」のやりとりが遊びの中で自然に生まれやすいです。'),
  ('22222222-0000-0000-0000-000000000004','はらぺこあおむし','エリック・カール','エリック・カール','偕成社',
    1,4, array['活動の導入','朝の会'], array['春','初夏'], '{}',
    'たまごから生まれた小さなあおむしが、いろいろな食べ物を食べて大きくなり、さなぎを経てちょうちょになるお話。',
    null,
    '曜日ごとの食べ物さがしや、園庭でのあおむし・ちょうちょ観察、数をかぞえる遊びにつながります。')
on conflict (id) do nothing;

-- ============================================================
-- seed: book_state_links
--   pre  … その姿のときに候補になる（検索で1冊以上出るよう配置）
--   post_pred … 読後に現れるかもしれない姿（断定しない）
--   avoid … その姿のときは除外
-- ============================================================
-- pre（自然な組み合わせのみ。11/14の姿が1冊以上返る。残り3語は該当本なしで意図的に空）
insert into public.book_state_links (book_id, state_id, relation, note) values
  ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','pre','主題そのもの。貸したくない気持ちへの共感から入れる'),
  ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','pre','分け合う喜びの側から接近できる'),
  ('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000001','pre','「いれて」「どうぞ」の定型やりとりのモデルになる'),
  ('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000002','pre','順番に「いれて」と言うやりとりが見通しにつながる'),
  ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000003','pre','気持ちのすれ違いを穏やかに描く'),
  ('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000003','pre','受け入れ合うやりとりのモデル'),
  ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000004','pre','食べ物・料理に興味 → クッキング導入の定番'),
  ('22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000004','pre','食べ物がつぎつぎ出てくる楽しさ'),
  ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000005','pre','食べる楽しさの共有から苦手さにそっと寄り添う'),
  ('22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000006','pre','あおむし→ちょうちょ。虫への興味の入口'),
  ('22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000007','pre','食べた数をかぞえる遊びにつながる'),
  ('22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000008','pre','色鮮やかな絵で色・形への興味を誘う'),
  ('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000009','pre','繰り返しのリズムが午睡前の落ち着いた時間になじむ'),
  ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000013','pre','ベッドづくりなど製作遊びにつながる'),
  ('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000014','pre','「いれて」「どうぞ」のごっこ遊びの素材'),
  ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000014','pre','ままごと・お店やさんごっこにつながる')
on conflict (book_id, state_id, relation) do nothing;

-- post_pred（読後に現れるかもしれない姿）
insert into public.book_state_links (book_id, state_id, relation, note) values
  ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000013','post_pred','ベッドづくり等の製作に向かうかもしれない'),
  ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000004','post_pred','料理・食べ物への興味が高まるかもしれない'),
  ('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000014','post_pred','「いれて」「どうぞ」のごっこ遊びが生まれるかもしれない'),
  ('22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000006','post_pred','虫や生き物への関心が広がるかもしれない')
on conflict (book_id, state_id, relation) do nothing;

-- avoid（その姿のときは候補から外す）
insert into public.book_state_links (book_id, state_id, relation, note) values
  ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000009','avoid','午睡前に落ち着きたい場面では、わくわく感が高まりやすいため候補から外す')
on conflict (book_id, state_id, relation) do nothing;

-- ============================================================
-- 完了。次に supabase/dev-tools/smoke_test.sql を実行して健全性を確認できます。
-- ============================================================
