# supabase/migrations

「えほんのあと」のデータベース定義。**番号順が実行順**です。

## 適用状況の基準（重要）
現在のSupabaseプロジェクトは **001〜003適用済み** として扱います。
今後は **004以降だけ** を番号順にSQL Editorで実行します。
Supabase CLIの `db push` は現時点では使用しません。

| ファイル | 状態 | 内容 |
|---|---|---|
| 001_init_schema.sql | 適用済み（再実行しない） | 8テーブル+RLS |
| 002_seed_data.sql | 適用済み（再実行しない） | 子どもの姿14語・絵本3冊(MVP正本) |
| 003_search_rpc.sql | 適用済み（再実行しない） | search_books_by_state |
| 004_practice_and_report_fields.sql | **未実行** | 記録項目追加+report_type'practice' |
| 005_add_activity_plans.sql | **未実行** | 採用された活動テーブル |
| 006_create_calendar_view.sql | **未実行** | カレンダー用view（表示専用） |

## ルール
- 001〜003は書き換えない。変更は必ず004以降の追加ファイルで行う
- チャット内だけのSQLは採用しない。必ずこのフォルダに保存してから実行する
- 実行は Supabase SQL Editor で1ファイルずつ。実行前にMaster(幸那さん)の承認を得る
- 実行したら、このREADMEの「状態」を更新する

## 全データ削除ツールについて
旧000_reset.sqlは `supabase/dev-tools/reset_dev_database.sql` へ移動しました。
**開発初期専用・実行すると対象データが全て消える・本番では実行禁止・
通常のmigrationには含めない・Masterの明示的な承認なしに実行しない。**

## 将来Supabase CLI管理へ移る場合
1. `supabase link` でプロジェクトを接続
2. 既に手動適用済みの001〜003（と実行済みの004以降）を
   `supabase migration repair --status applied <version>` で「適用済み」として履歴登録
3. 以降の新migrationのみ `supabase db push` で適用
これにより手動実行分とCLI履歴のズレを解消できます。
