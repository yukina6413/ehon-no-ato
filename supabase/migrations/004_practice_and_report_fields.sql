-- ============================================================
-- えほんのあと 追加migration【草案・実行禁止】
-- 004_practice_and_report_fields.sql
-- 目的: 実践記録の項目追加 + 単一記録レポート種別の追加
-- 既存データへの影響: なし（列追加と制約の付け替えのみ。削除なし）
-- ============================================================

-- ------------------------------------------------------------
-- A. practice_logs: 記録項目の追加（すべて任意入力 = null許容）
--    読む前/あとの「姿」は既存の practice_log_states(phase) を使うため
--    ここには追加しない
-- ------------------------------------------------------------
alter table public.practice_logs
  add column if not exists interest_tags   text[] not null default '{}',
                          -- 通常画面の選択式チップ（例: 言葉・繰り返し / 物・形・色・音 /
                          --  登場人物の気持ち・関係 / 動き / 友達とのやり取り / 子どもの疑問）
  add column if not exists interest_points text,   -- 興味をもった場面の短文（任意）
  add column if not exists child_words     text,   -- 子どもから出た言葉や疑問
  add column if not exists play_expansion  text,   -- 遊びや会話につながったこと
  add column if not exists next_ideas      text;   -- 保育士が次に試してみたいこと

comment on column public.practice_logs.interest_tags   is '子どもたちが興味をもったところ（選択式）。個人名は書かない運用';
comment on column public.practice_logs.interest_points is '子どもたちが興味をもったところ。個人名は書かない運用';
comment on column public.practice_logs.child_words     is '子どもから出た言葉や疑問。個人名は書かない運用';
comment on column public.practice_logs.play_expansion  is '遊びや会話につながったこと';
comment on column public.practice_logs.next_ideas      is '保育士が次に試してみたいこと';

-- ------------------------------------------------------------
-- B. ai_reports: 単一記録レポート種別 'practice' を追加
--    check制約の付け替え。既存行の値はすべて新制約にも適合するため非破壊
-- ------------------------------------------------------------
alter table public.ai_reports
  drop constraint if exists ai_reports_report_type_check;

alter table public.ai_reports
  add constraint ai_reports_report_type_check
  check (report_type in (
    'practice',                                   -- ← 追加: 1実践記録 → 1レポート
    'daily', 'weekly', 'monthly', 'newsletter', 'conference'
  ));

-- ------------------------------------------------------------
-- C.（任意）profiles更新ポリシーの可読性改善
--    現行の式は演算子優先順位により意図どおり動作するが、
--    括弧を明示して事故を防ぐ。挙動は変わらない
-- ------------------------------------------------------------
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    (id = auth.uid() and role = 'user')
    or public.is_admin()
  );
