# supabase/migrations

「えほんのあと」のデータベース定義。

## いちばん大事なこと（2026-08-05 更新）

**新しい空の Supabase プロジェクトを作るときは、`000_complete_mvp_setup.sql` を
1本だけ実行すればよい。** 001〜006 は実行しない（000がすべて含む）。

- `000_complete_mvp_setup.sql` … 001〜006の内容＋これまでの修正（下記）を統合した
  「1回実行で完結する」セットアップ。冪等（`if not exists` / `on conflict` /
  ポリシーは drop→create）で、**データを削除する命令は含まない**。
- 実行後は `../dev-tools/smoke_test.sql`（SELECTのみ）で健全性を確認する。

### 000に反映した修正（001〜006からの差分）
- 検索RPCは **3引数**(`p_state_id, p_age_group, p_scene`)。`p_season` は持たない（コードと一致）。
- 検索RPCの返却に **author・summary を追加**（検索結果カードが読むため）。
- マスタ3表(`child_states`,`books`,`book_state_links`)の読み取りと検索RPCの実行を
  **anon にも許可**（アプリはログイン前にホームで検索するため）。
- `practice_logs` に 004 の記録列(`interest_tags` 等)を最初から含める。
- seed の絵本を3冊→**4冊**に（はらぺこあおむし追加）。11/14の「子どもの姿」で検索が
  1冊以上ヒットするよう `pre` リンクを配置。

## 既存（インクリメンタル）migrationの位置づけ

001〜006 は「既存プロジェクトに手作業で適用してきた履歴」として残す。
既存プロジェクトの修復にも 000 を使える（冪等・非破壊で不足分だけ補う）。

| ファイル | 位置づけ | 内容 |
|---|---|---|
| 000_complete_mvp_setup.sql | **新規・単一セットアップの正本** | 全テーブル+RLS+RPC+seed（統合） |
| 001_init_schema.sql | 履歴（適用済み） | 8テーブル+RLS |
| 002_seed_data.sql | 履歴（適用済み） | 子どもの姿14語・絵本3冊 |
| 003_search_rpc.sql | 履歴（適用済み・3引数） | search_books_by_state |
| 004_practice_and_report_fields.sql | 履歴（既存に手動適用済み） | 記録項目追加+report_type'practice' |
| 005_add_activity_plans.sql | 履歴（未実行） | 採用された活動テーブル |
| 006_create_calendar_view.sql | 履歴（未実行） | カレンダー用view（表示専用） |
| 007_fix_search_rpc_overload.sql | **現行プロジェクトの修復（未実行）** | 重複したsearch_books_by_state(4引数版)を除去し3引数版に統一+author/summary返却+calendar_view作成 |
| 008_practice_log_missing_fields.sql | **適用済み（2026-08-11 Master実行）** | practice_logsに select_reason / selected_by / after_type / episode / insight / age_groups / scene_activities を追加（列追加のみ・非破壊） |

## 008について（記録画面の入力が保存されていなかった問題）

記録画面で入力・選択できるのに `practice_logs` に列が無く、保存されずに
捨てられていた項目があった（選んだ理由・誰が選んだか・えほんのあとタイプ・
2つ目以降の年齢・活動の下位項目、および印象と気づきの分離）。008はそれらの
列を**追加するだけ**で、削除・型変更・CHECK制約の変更は一切しない。

- 既存の `age_group`（数値1件）・`reaction`・`memo` はそのまま残し、保存時も
  従来どおり書き込む（既存データ・既存の読み出しを壊さないため）
- 「どこにある本か」は追加しない。その日の実践ではなく本の所蔵に属する情報のため、
  将来 `books` 側で設計する（Master判断 2026-08-11）
- ロールバック用のSQLは 008 のファイル末尾にコメントで記載してある

## 007について（現行プロジェクトの検索0件バグ修復）

diff_check.sql の結果、現行プロジェクトには `search_books_by_state` が
**3引数版と4引数版(p_season)の2つ**存在し、アプリが3引数で呼ぶと PostgREST が
関数を一意に決められず(PGRST203)、検索が常に0件になっていた。007は古い4引数版を
削除して3引数版1本に統一する（DROPするのは関数のみ・テーブルの行データは非変更）。
新規プロジェクトなら000を使えば最初からこの問題は起きない。

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
