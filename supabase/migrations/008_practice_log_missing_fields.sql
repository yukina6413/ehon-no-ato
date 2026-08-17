-- ============================================================
-- えほんのあと 追加migration
-- 008_practice_log_missing_fields.sql
-- 目的: 記録画面(RecordInput)で入力できるのに practice_logs に
--       保存されていなかった項目を保存できるようにする
-- 既存データへの影響: なし（列の追加のみ）
-- ============================================================
--
-- 【この変更でやらないこと（Master判断 2026-08-11）】
--   - 列の削除・型変更・CHECK制約の変更はしない
--   - 既存の age_group（数値1つ）・reaction・memo はそのまま残す
--   - class_name / interest_points / child_words / play_expansion も残す
--   - 「どこにある本か」(location) は追加しない。これはその日の実践ではなく
--     本そのもの・所蔵に属する情報のため、将来 books 側で設計する
--
-- 【なぜ既存列を使わず新しい列を足すのか】
--   - reaction 列は4択のCHECK制約付きで、画面の「えほんのあとタイプ」の
--     言葉と一致しない。制約を変えると既存行に影響が出るため、
--     after_type を新設する
--   - age_group（数値1つ）は既存データと既存画面が使っているため残し、
--     複数選択用に age_groups を新設する。保存時は両方に書く
--   - memo（印象に残った様子＋気づきの連結）は過去データがそのまま入って
--     いるため残す。今後は episode / insight にも分けて保存する
-- ============================================================

alter table public.practice_logs
  add column if not exists select_reason    text,
  add column if not exists selected_by      text,
  add column if not exists after_type       text,
  add column if not exists episode          text,
  add column if not exists insight          text,
  add column if not exists age_groups       int[]  not null default '{}',
  add column if not exists scene_activities text[] not null default '{}';

comment on column public.practice_logs.select_reason    is 'この絵本を選んだ理由（読み手が選んだとき）。個人名は書かない運用';
comment on column public.practice_logs.selected_by      is '誰が選んだか（読み手 / 子ども / その他）';
comment on column public.practice_logs.after_type       is 'えほんのあとタイプ（読後の余韻）。既存のreaction列とは別。CHECK制約は付けず画面の選択肢変更に追従できるようにする';
comment on column public.practice_logs.episode          is '印象に残った様子。従来は memo に気づきと連結して保存していた分を分離したもの';
comment on column public.practice_logs.insight          is '今日の気づき。従来は memo に印象と連結して保存していた分を分離したもの';
comment on column public.practice_logs.age_groups       is '年齢を全件保存（複数選択可）。既存の age_group には従来どおり1件目を入れる';
comment on column public.practice_logs.scene_activities is '読んだ場面の下位項目（製作・散歩・避難訓練など）';

-- ============================================================
-- ロールバック（元に戻したくなった場合にこれを実行する）
-- ※ 追加した列を落とすだけ。元からあった列・データは無傷のまま
-- ------------------------------------------------------------
-- alter table public.practice_logs
--   drop column if exists select_reason,
--   drop column if exists selected_by,
--   drop column if exists after_type,
--   drop column if exists episode,
--   drop column if exists insight,
--   drop column if exists age_groups,
--   drop column if exists scene_activities;
-- ============================================================
