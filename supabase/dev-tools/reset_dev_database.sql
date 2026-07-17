-- ============================================================
-- ⚠️ 開発初期専用ツール。migrationではありません
-- reset_dev_database.sql（旧 000_reset.sql）
--  * 実行すると「えほんのあと」の全テーブル・全データが消えます
--  * 本番環境では実行禁止
--  * 通常のmigration手順には含めない
--  * Master（幸那さん）の明示的な承認なしに実行しない
-- ============================================================
-- ============================================================
-- えほんのあと リセット用スクリプト
-- 000_reset.sql
-- ============================================================
-- 用途: すでに同じテーブルが存在していて 001 がエラーになるとき、
--       これを先に実行してから 001 → 002 → 003 をやり直す。
-- ⚠️ 注意: 全テーブルとデータが消えます。本番運用開始後は使わないこと。
-- ============================================================

drop function if exists public.search_books_by_state(uuid, int, text);

drop table if exists public.ai_reports          cascade;
drop table if exists public.practice_log_states cascade;
drop table if exists public.practice_logs       cascade;
drop table if exists public.book_state_links    cascade;
drop table if exists public.knowledge_notes     cascade;
drop table if exists public.books               cascade;
drop table if exists public.child_states        cascade;
drop table if exists public.profiles            cascade;

drop trigger  if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.is_admin();
drop function if exists public.set_updated_at();
