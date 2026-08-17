# システム構成（system design）

最終更新：2026-07-27

このファイルは技術的な事実（コード・設定から確認できること）だけを記す。
プロダクトの目的・思想は `docs/product-charter.md` と `docs/project_overview.md` を参照。

---

## 技術スタック（package.json で確認済み）

- ビルドツール：Vite 8
- フレームワーク：React 19（JavaScript／JSX、TypeScriptは未導入）
- ルーティング：react-router-dom 7（`BrowserRouter`）
- スタイル：Tailwind CSS 3
- DB／認証：Supabase（`@supabase/supabase-js`）
- アイコン：lucide-react
- Lint：ESLint 10（flat config、`eslint.config.js`）
- テスト：Vitest（2026-07-27に導入。導入経緯は `docs/decision-log.md` 参照）

型チェックについて：`@types/react` 等は devDependencies にあるが、`tsconfig.json` も
`typescript` 本体も存在しない。純粋なJSXプロジェクトのため、tscによる型チェックは
現状導入していない（理由は `docs/decision-log.md` 参照）。

---

## ディレクトリ構成（抜粋）

```
src/
  main.jsx              エントリポイント
  App.jsx               ルーティング定義（BrowserRouter + Routes）
  context/
    AuthContext.jsx      Supabase Auth のセッション管理（mockモードでは擬似ユーザー）
  lib/
    supabase.js          Supabaseクライアント生成（env未設定時は null）
    dataAdapter.js        ★データ取得の切り替え地点（mock ⇔ supabase）
    mockData.js           mockモード用のダミーデータ・ロジック
  components/
    BookCard.jsx, BottomNav.jsx, LoginModal.jsx, OverlayPanel.jsx,
    ReportCard.jsx, StepProgressBar.jsx
  pages/
    Home.jsx              ホーム（絵本と出会う場所）
    Bookshelf.jsx          本棚
    RecordInput.jsx        記録入力（/record）
    RecordComplete.jsx     記録完了（/record-complete）
    RecordList.jsx         記録一覧（/records）
    CalendarPage.jsx        カレンダー（/calendar）
    AISearch.jsx            AI相談検索（/search）
    AIReport.jsx             AIレポート（/report）
    MyPage.jsx               マイページ（/mypage）

supabase/
  migrations/            番号順マイグレーション（詳細は下記）
  dev-tools/reset_dev_database.sql   開発専用の全データ削除ツール（実行にMaster承認必須）

old-html/                初期プロトタイプのHTML。現行のReact実装には使われていない
                         （詳細は docs/current-status.md の「未使用ファイル候補」参照）
```

### 実際のルーティング（`src/App.jsx` で確認済み）

| パス | ファイル |
|------|----------|
| `/` | `Home.jsx` |
| `/record` | `RecordInput.jsx` |
| `/record-complete` | `RecordComplete.jsx` |
| `/report` | `AIReport.jsx` |
| `/records` | `RecordList.jsx` |
| `/calendar` | `CalendarPage.jsx` |
| `/search` | `AISearch.jsx` |
| `/mypage` | `MyPage.jsx` |
| `/bookshelf` | `Bookshelf.jsx` |

`docs/screen_map.md` や `docs/book_detail.md` には `BookDetail.jsx`（`/bookshelf/:id`）や
`Record.jsx`、`Calendar.jsx`、`AI.jsx` といった記載があるが、現在のコードにこれらのファイル・
ルートは存在しない。ドキュメントが先行して書かれた設計案か、実装が追いついていない機能と
考えられる。詳細は `docs/current-status.md` の「ドキュメントとコードの不一致」を参照。

---

## dataAdapter（データ取得の切り替え地点）

`src/lib/dataAdapter.js` が唯一のデータ取得窓口。ページ・コンポーネントは直接
`supabase` や `mockData` を呼ばず、必ずこのファイル経由でデータを取得する。

```js
const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE ?? 'mock'
export const isMock = DATA_SOURCE !== 'supabase'
```

- `VITE_DATA_SOURCE=supabase` のときのみ実DBを使う。それ以外（未設定含む）はmockモード。
- 各関数（`getChildStates`, `findStatesByText`, `searchBooksByState`, `savePracticeLog`,
  `getPracticeLogs`, `getPracticeLogsByMonth`）が `isMock` で分岐し、mock時は
  `mockData.js` のダミーデータ・`localStorage` を使う。
- 新しいデータ取得処理を追加する場合は、既存の関数と同じく **dataAdapter.js に関数を追加し、
  mock分岐とsupabase分岐の両方を実装する**のが、このプロジェクトの一貫した設計方針。

---

## データベース構成（`supabase/migrations/` で確認済み）

### 適用状況（`supabase/migrations/README.md` が正本）

| ファイル | 状態 |
|---|---|
| 001_init_schema.sql | 適用済み（再実行しない） |
| 002_seed_data.sql | 適用済み（再実行しない） |
| 003_search_rpc.sql | 適用済み（再実行しない） |
| 004_practice_and_report_fields.sql | 未実行（草案） |
| 005_add_activity_plans.sql | 未実行（草案） |
| 006_create_calendar_view.sql | 未実行（草案） |

**重要：** 004以降のmigrationをSupabase SQL Editorで実行するのはMaster（幸那さん）の役割。
Claude CodeはSQLファイルの作成・修正はできるが、Supabase本番／開発プロジェクトへの実行は
Masterの明示的な承認なしに行わない。

### テーブル一覧

| テーブル | 役割 | 個人名保存 |
|---|---|---|
| `profiles` | Supabase Authユーザー拡張（role: user/admin） | なし |
| `child_states` | 子どもの姿マスター（全機能の入口） | なし |
| `books` | 絵本マスター | なし |
| `book_state_links` | 絵本×子どもの姿の関係（pre/post_pred/avoid） | なし |
| `practice_logs` | 実践記録（クラス・場面単位） | **意図的に個人名カラムなし** |
| `practice_log_states` | 実践記録×子どもの姿（pre/post） | なし |
| `ai_reports` | AIレポート（draft/generated/edited） | なし |
| `activity_plans`（004以降） | 保育士が採用した次回活動 | なし |
| `knowledge_notes` | 園の知見（MVPではRLSポリシーなし＝不可視） | なし |
| `calendar_view`（006以降） | practice_logs + activity_plans の表示専用view | なし |

管理用カラム（`is_active`, `sort_order`, `status`, `role`, `caution_notes`, `note`,
`was_edited` 等）は各テーブルのSQLコメントで「利用者画面には表示しない」と明記されている。
これは `docs/product-charter.md` の「利用者画面に管理側の言葉を表示しない」と対応する。

### 検索RPC：`search_books_by_state`

`003_search_rpc.sql` で定義。シグネチャ：
```
search_books_by_state(p_state_id uuid, p_age_group int default null, p_scene text default null)
```
`src/lib/dataAdapter.js` の `searchBooksByState()` は、この3引数の定義に合わせて
`p_state_id / p_age_group / p_scene` を渡す（2026-08-01に `p_season` の不一致を修正済み。
経緯は `docs/current-status.md` と `docs/decision-log.md`）。この契約は
`src/lib/searchRpc.test.js` の回帰テストで保護されている。RPCの引数を変えるときは、
migration側（004以降の `create or replace`）とdataAdapter側を必ず一致させること。

---

## 環境変数（名前のみ。値はコミット・表示しない）

`.env.example` に定義されている名前：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DATA_SOURCE`（`supabase` または未設定＝mock）

`.env.local`（gitignore対象）が存在し、開発機では `VITE_DATA_SOURCE=supabase` に
設定されていることを確認済み（値は非表示）。つまりこの開発環境ではデフォルトで
実Supabaseに接続する設定になっている。
