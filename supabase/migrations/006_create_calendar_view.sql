-- ============================================================
-- えほんのあと 追加migration【草案・実行禁止】
-- 006_create_calendar_view.sql
-- 目的: カレンダー表示用のデータ源をつくる
-- 既存データへの影響: なし（viewの追加のみ。テーブルは作らない）
-- ============================================================
-- 【テーブル案との比較】
--  calendar_entriesテーブルを新設する案は不採用としました。
--  理由: カレンダーに出したい情報は
--    (1) 絵本を読んだ日・記録の日 = practice_logs に既にある
--    (2) 次回活動の予定日・実施済み = activity_plans に既にある
--  ため、別テーブルに複製すると二重管理と同期バグの温床になる。
--  → 2表を union する view で表現する。
--  security_invoker = true により、閲覧者自身のRLSがそのまま適用され
--  「自分の記録・自分の予定」だけが見える。
-- ============================================================

create or replace view public.calendar_view
with (security_invoker = true)
as
-- (1) 実践記録（絵本を読んだ日）
select
  ('log-'  || l.id)::text          as entry_id,
  'practice_log'::text             as entry_type,   -- 記録
  l.read_date                      as entry_date,
  b.title                          as title,
  l.class_name                     as class_name,
  null::text                       as status,
  l.id                             as log_id,
  null::uuid                       as plan_id
from public.practice_logs l
join public.books b on b.id = l.book_id

union all

-- (2) 次回活動の予定・実施済み
select
  ('plan-' || p.id)::text          as entry_id,
  'activity_plan'::text            as entry_type,   -- 予定活動
  p.scheduled_date                 as entry_date,
  p.title                          as title,
  null::text                       as class_name,
  p.status                         as status,       -- planned / done / skipped
  p.done_log_id                    as log_id,       -- 実施後の記録への導線
  p.id                             as plan_id
from public.activity_plans p
where p.scheduled_date is not null;

comment on view public.calendar_view is 'カレンダー画面用。practice_logsとactivity_plansの合成。security_invokerにより本人のデータのみ可視';

-- ------------------------------------------------------------
-- 権限: 必要最小限のみ
--  * viewは union のため元々更新不可（表示専用）。編集は activity_plans で行う
--  * anon には一切付与しない。authenticated に select のみ
-- ------------------------------------------------------------
revoke all on public.calendar_view from public, anon, authenticated;
grant select on public.calendar_view to authenticated;
