---
name: next-session-db-setup
description: 次回の再開ポイント。DB統合SQL(000)を新規/既存どちらのSupabaseに適用するか比較して推奨する
metadata:
  type: project
---

2026-08-05 セッション終了時点の再開メモ。

## 未実行事項（すべてMasterの操作待ち。勝手に実行しない）
- Supabaseへの `000_complete_mvp_setup.sql` 適用（新規 or 既存のどちらか未決定）
- `.env.local` のSupabase接続情報の差し替え（新規プロジェクト採用時）
- commit / push（今回のSQL・ドキュメント追加はすべて未コミットのまま作業ツリーに保持）

## 保持している成果物
- `supabase/migrations/000_complete_mvp_setup.sql`（新規・単一セットアップ・冪等・削除命令なし）
- `supabase/dev-tools/smoke_test.sql`（新規・SELECTのみ・11項目チェック）
- `supabase/migrations/README.md`（更新・000が正本）
- `docs/decision-log.md`, `docs/current-status.md`（更新・根本原因とanon読み取り判断を記録）

## 次回の開始タスク（Masterの指示）
「新しいSupabaseに適用する場合」と「現在のSupabaseを修復する場合」を、
**安全性・手間・データ保持・失敗時の戻しやすさ**の4観点で比較し、
推奨案と具体的手順から再開する。→ 比較の骨子は [[db-mvp-consolidation]] に記録済み。

## 根本原因（確定）
検索0件などの連続不具合は単一の構造問題。マスタ3表と検索RPCが `authenticated` 限定で、
ログイン前に検索するアプリ動線と矛盾。加えて004列の適用不揃い・seed/IDズレ。
000でanon読み取り許可＋全列＋seedを統合して解消（コード変更なし・DB側をアプリに合わせた）。
