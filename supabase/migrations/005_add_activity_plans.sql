-- ============================================================
-- えほんのあと 追加migration【草案・実行禁止】
-- 005_add_activity_plans.sql
-- 目的: AIレポートから「採用された活動」だけを正規化して保存する
-- 既存データへの影響: なし（新規テーブル追加のみ）
-- ============================================================
-- 設計方針:
--  * AIの全提案は ai_reports.content(jsonb) に残る（未採用も含む来歴）
--  * 保育士が「選ぶ/編集する」した活動だけがこのテーブルに入る
--  * = AIの提案をそのまま採用することを前提にしない設計をデータ層で保証
--  * 個人名カラムは存在しない
-- ============================================================

create table public.activity_plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid()
                 references auth.users (id) on delete cascade,
  report_id      uuid references public.ai_reports (id) on delete set null,
  source_log_id  uuid references public.practice_logs (id) on delete set null,

  activity_type  text not null check (activity_type in (
                   'recommended',   -- 次回のおすすめ活動
                   'widening',      -- 視野を広げる活動
                   'deepening',     -- 思考を深める活動
                   'reread',        -- もう一度読む・見守る 等
                   'custom'         -- 保育士が自分で書いた活動
                 )),

  title          text not null,
  description    text,              -- ねらいを断定しない説明（編集可）
  materials      text[] not null default '{}',
  duration_min   int,
  place          text,              -- 室内 / 屋外
  group_size     text,              -- 少人数 / 集団
  teacher_role   text,
  environment    text,
  trigger_hint   text,              -- 活動を始めるきっかけ

  was_edited     boolean not null default false,  -- AI提案を編集したか（来歴。画面には出さない）
  scheduled_date date,                            -- カレンダーに置く予定日（null = 未定）
  status         text not null default 'planned'
                 check (status in ('planned', 'done', 'skipped')),
  done_log_id    uuid references public.practice_logs (id) on delete set null,
                 -- 実施後に残した新しい実践記録への接続（ループの閉じ目）

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table  public.activity_plans is '保育士が採用した次回活動。AIの未採用提案は保存しない（ai_reports.contentに残る）';
comment on column public.activity_plans.was_edited is '管理用カラム。利用者画面には表示しない';
comment on column public.activity_plans.status     is 'planned=予定 / done=実施済み / skipped=今回は行わなかった。skippedも否定的な語で画面表示しない';

create index idx_plans_user_date on public.activity_plans (user_id, scheduled_date);
create index idx_plans_report    on public.activity_plans (report_id);

create trigger trg_activity_plans_updated_at
  before update on public.activity_plans
  for each row execute function public.set_updated_at();

-- RLS: 本人のみ
alter table public.activity_plans enable row level security;

create policy "plans_own_all"
  on public.activity_plans for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
