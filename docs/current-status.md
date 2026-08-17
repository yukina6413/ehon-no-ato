# 現状把握メモ（既知の課題・矛盾点）

最終更新：2026-07-27（ハーネス構築時の調査結果）

作業開始時にこのファイルを確認すること。解決したら該当項目を削除するか「解決済み」に更新する。

---

## 未コミットの変更（2026-07-27時点）

以下は今回のハーネス作業以前から存在していた未コミットの変更。中身には触れていない。

- 変更済み：`docs/bookshelf.md`, `docs/future_ideas.md`, `docs/vision.md`,
  `src/App.jsx`, `src/components/BookCard.jsx`, `src/pages/AISearch.jsx`,
  `src/pages/Bookshelf.jsx`, `src/pages/CalendarPage.jsx`, `src/pages/Home.jsx`,
  `src/pages/MyPage.jsx`, `src/pages/RecordComplete.jsx`, `src/pages/RecordInput.jsx`,
  `src/pages/RecordList.jsx`, `package.json`, `package-lock.json`
- 未追跡（新規）：`.env.example`, `src/components/LoginModal.jsx`, `src/context/`, `src/lib/`

これはSupabase連携（dataAdapter・認証・ログイン）を組み込む作業の途中と見られる
（推測）。この状態のままコミットされていないため、ハーネス作業では上書き・破棄していない。

---

## 実装済みの連携

### 検索で選んだ絵本を記録画面へ引き継ぐ（2026-08-05 実装）

- **背景**：以前は「記録」ボタン・「今日読んだ本を記録する」リンクが `/record` に
  遷移するだけで、選んだ絵本の情報を渡しておらず、記録画面はタイトル空欄で始まっていた。
- **実装**：絵本詳細モーダル（`Home.jsx` の `BookDetailModal`）に「この絵本を記録する」
  ボタンを追加。react-routerのnavigation stateで `{ bookId, bookTitle, bookAuthor }` を
  `/record` に渡す。`RecordInput.jsx` は `useLocation` で受け取り、タイトル・著者・
  bookId をフォーム初期値にセットする。`docs/book_detail.md` の「記録を追加＝絵本が
  セットされた状態で /record を開く」仕様に沿った実装で、設計思想は変更していない。
- **安全策**：実DBの絵本（UUID）のみ `bookId` を渡す。フリー検索・テーマの
  サンプル絵本（id=`s1`等・DB未登録）はタイトルだけ渡し、保存時は既存の
  「まだデータベースに登録されていません」案内に委ねる（外部キー制約エラーを防ぐ）。
- **保護**：`src/lib/savePracticeLog.test.js` で、bookIdがあればタイトル検索せず
  その book_id で保存すること／未登録タイトルは分かりやすいエラーになることを検証。
- **2026-08-18 解決**：`SAMPLE_BOOKS` は削除し、通常画面から固定サンプルを排除した。
  フリー検索は実DB（書名・著者のilike）に接続。季節・行事・テーマは実データが
  揃うまで「まだ登録されていません」と正直に表示する（サンプルで埋めない）。
  記録できない絵本には記録ボタンを出さない。

---

## 解決済み（008適用済み・実画面での確認待ち）

### 記録画面の入力がpractice_logsに保存されていなかった（2026-08-11 解決）

- **事実（監査結果）**：記録画面で入力・選択できる項目のうち、
  `reason`（選んだ理由）・`selectedBy`（誰が選んだか）・`afterType`（えほんのあとタイプ）・
  `sceneActivities`（活動の下位項目）・2つ目以降の `ages` が保存されていなかった。
  また `episode`（印象）と `insight`（気づき）は `memo` 1列に連結され分離できなかった。
- **対応**：`supabase/migrations/008_practice_log_missing_fields.sql`
  （**2026-08-11 Masterが実行済み・Success**）。列の追加のみで、削除・型変更・
  CHECK制約変更はしていない。コード側（`dataAdapter.js` / `mockData.js`）も対応済み。
- **読み出しの共通化**：`dataAdapter.normalizeLog()` を新設し、mockモードと
  supabaseモードが同じ形の記録を返すようにした。008以前の記録は
  `episode`/`insight` が両方nullであることを目印に `memo` を印象として表示する。
- **残り**：実画面（ブラウザ）での保存・表示確認のみ。
- **保存しないと決めた項目**：`location`（どこにある本か）は実践記録ではなく本の所蔵の
  情報のため `practice_logs` には持たない。将来 `books` 側で設計する（Master判断）。
  `author` / `publisher` は `books` にあるため記録側には持たない。

---

## 調査中／修復SQL作成済み（未適用）

### 検索が全件0件（2026-08-06 原因特定・修復SQL 007 作成）

- **確認した事実（diff_check.sql の結果）**：現行Supabaseでは
  `search_books_by_state` が **3引数版と4引数版(p_season)の2つ重複**して存在する
  （section 09）。テーブル・列・ID型・RLS・anon読み取り・RPCのanon実行付与は
  すべて正常（マスタ3表の read_all は既に `anon,authenticated`）。欠けているのは
  `calendar_view` のみ。
- **原因（強い推定）**：アプリは3引数で呼ぶが、4引数版は p_season に既定値があるため
  3引数でも呼べてしまい、PostgREST が関数を一意に決められず PGRST203 で失敗
  → アプリのcatchで空配列 → 全ての姿で「該当なし」。
- **未確認**：実データ件数（diff_check では reltuples が未ANALYZEで測れず）。
  seed/preリンクの有無は別途 SELECT で確認する。
- **修復**：`supabase/migrations/007_fix_search_rpc_overload.sql`（作成済み・未実行）。
  古い4引数版を削除し3引数版に統一（author/summary返却）+ calendar_view作成。
  DROPは関数のみ・行データ非変更。Master承認後にSQL Editorで実行する。

---

## 解決済みのバグ

### `search_books_by_state` RPCの引数不一致（2026-08-01 解決）

- **事実（当時）**：`src/lib/dataAdapter.js` の `searchBooksByState()` が
  `p_state_id, p_age_group, p_scene, p_season` の4引数でRPCを呼んでいた。
  一方 `supabase/migrations/003_search_rpc.sql`（適用済み）の関数は
  `p_state_id, p_age_group, p_scene` の3引数のみで、`p_season` は存在しなかった。
- **影響**：`VITE_DATA_SOURCE=supabase` のとき、Supabaseが名前付き引数の集合で
  関数を解決できず PGRST202「関数が見つからない」エラーを返し、AI検索が失敗した。
  mockモードではこの分岐を通らないため表面化していなかった。
- **修正**：dataAdapter側から `p_season` の送信を削除し、適用済み003の3引数に一致させた。
  同時に未使用になった `getCurrentSeason()` も削除。適用済みmigration（001〜003）は変更していない。
- **再発防止**：`src/lib/searchRpc.test.js` を追加。supabaseモードでRPCが
  `p_state_id / p_age_group / p_scene` の3引数のみで呼ばれ、`p_season` を含まないことを検証する。

### 季節フィルタ検索（将来の拡張候補・未実装）

- 上記の修正で季節による絞り込みは行わなくなった（元々一度も動作していなかった）。
- 検索の入口は「子どもの姿」(`child_states`) であり、季節フィルタは補助機能。憲章には抵触しない。
- 将来、季節で絞りたい場合は次の2点が必要（Master判断）：
  1. 004以降の新しいmigrationで `search_books_by_state` に `p_season` を追加し、
     `books.seasonal_tags`（001で定義済み）で絞る `create or replace` を用意する。
  2. dataAdapter側で季節を渡す処理を復活させる（旧 `getCurrentSeason` はgit履歴から復元可能）。

---

## ドキュメントとコードの不一致

- `docs/screen_map.md` と `docs/book_detail.md` は `BookDetail.jsx`（`/bookshelf/:id`）、
  `Record.jsx`、`Calendar.jsx`、`AI.jsx` という名前のファイル・ルートを記載しているが、
  実際の `src/App.jsx` には存在しない（実際は `RecordInput.jsx` / `RecordComplete.jsx` /
  `RecordList.jsx` / `CalendarPage.jsx` / `AISearch.jsx`。絵本詳細画面自体が未実装）。
- 本ハーネス作業ではこれらのドキュメントを書き換えていない（正本の判断はMaster）。
  `docs/system-design.md` には現状の実ルート一覧を事実として記載した。
- `docs/vision.md` は `docs/project_overview.md` 側で「本文書に統合済みの旧ビジョン文書」と
  記載されているが、`vision.md` 自体は削除・修正されておらず、かつ現在git上で
  修正差分がある（内容不明・未確認）。判断が必要ならMasterに確認。

---

## テスト・型チェックについて

- 依頼の前提「テストが存在する」は誤りで、着手前はテストが一切存在しなかった。
  2026-07-27にVitestを追加した（`docs/decision-log.md` 参照）。現時点のテストは
  `src/lib/dataAdapter.js` のmockモードに対するスモークテストのみで、UIコンポーネントの
  テストはまだない。
- TypeScriptの型チェックは導入していない（理由は `docs/decision-log.md`）。

---

## Lintの既存指摘（2026-08-11時点、5件）

ハーネス構築の対象外のため未修正。次に該当ファイルを触る際についでに直すのは構わない。

| ファイル | 内容 |
|---|---|
| `src/context/AuthContext.jsx` | Fast refresh警告（コンポーネント以外もexportしている） |
| `src/pages/AIReport.jsx` | 未使用importの `BookOpen` |
| `src/pages/CalendarPage.jsx` | useEffect内で同期的にsetStateしている |
| `src/pages/MyPage.jsx` | 未使用変数 `i` |
| `src/pages/RecordList.jsx` | 不正な空白文字 |

`src/pages/RecordInput.jsx` と `src/pages/Home.jsx` の指摘は解決済み
（RecordInputは2026-08-11の記録画面整理のときに同時に修正）。

---

## 依存パッケージの脆弱性（`npm audit`、2026-07-27時点）

`npm audit` で5件（高4・中1）の指摘：`brace-expansion`, `postcss`, `react-router`
（`react-router-dom` 経由）, `vite`。いずれもハーネス作業で新規に入れた依存ではなく、
既存の依存関係にすでに含まれていたもの。`npm audit fix` はメジャーバージョンが
上がる可能性があり画面が壊れるリスクがあるため、Masterと相談の上で対応することを推奨し、
今回は実行していない。

---

## 未使用・古いファイルの候補

- `old-html/` 配下（`ehon_record_screen.html` 等4ファイル）：初期プロトタイプのHTML。
  現行のReact実装（`src/pages/`）に置き換わっており、コードから参照されていない。
  削除するかどうかはMaster判断（今回は削除していない）。
- `README.md`：Vite公式テンプレートのままで、プロジェクト固有の説明になっていない。
  内容を `docs/project_overview.md` へのリンクに置き換えるのはハーネス整備の範囲内と
  考えられるが、今回は「アプリの機能や画面デザイン以外は変更しない」方針を優先し、
  未着手（次回以降の候補として記録のみ）。

---

## Supabaseのmigration適用状況

`supabase/migrations/README.md` が正本。001〜003適用済み、004〜006は未実行の草案。
実行はMasterがSupabase SQL Editorで行う（`docs/ai-development-rules.md` 参照）。
