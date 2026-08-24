# プロジェクトプロファイル：えほんのあと

最終更新：2026-08-25

このリポジトリ**固有**の事実をまとめる。進め方の共通ルールは
`docs/ai-development-workflow.md`（プロジェクト非依存）を参照。

ここは「一度調べたことを二度調べないための場所」。
新しく分かった制約・既知バグ・回避策は、その都度ここに追記する。

---

## 1. 目的

保育士が「この子どもの姿には、どのような保育ができるだろう」と考えるための
**意思決定支援アプリ**。絵本の記録アプリではない。

- 目的・世界観の正本：`docs/project_overview.md`
- **変えてはいけないこと（不変条件）の正本：`docs/product-charter.md`（必読）**

---

## 2. 技術スタック

| 区分 | 使っているもの |
|---|---|
| ビルド | Vite 8 |
| フレームワーク | React 19（JavaScript / JSX。**TypeScriptは未導入**） |
| ルーティング | react-router-dom 7（`BrowserRouter`） |
| スタイル | Tailwind CSS 3（ユーティリティを直接JSXに書く） |
| DB / 認証 | Supabase（`@supabase/supabase-js`） |
| アイコン | lucide-react |
| Lint | ESLint 10（flat config） |
| テスト | Vitest（`environment: 'node'`） |

詳細な構成・ディレクトリは `docs/system-design.md`、記法は `docs/coding-rules.md`。

### 検証コマンド（実在するものだけ）

```
npm run lint     # ESLint
npm run test     # Vitest
npm run build    # 本番ビルド
```

**型チェック（tsc）は存在しない**（TypeScript未導入。経緯は `docs/decision-log.md`）。

### テストの制約

- `environment: 'node'` で、DOMを使う操作のテストはできない。
  コンポーネントは `renderToStaticMarkup` による**描画結果の確認まで**
- テストは常にmockモードで走る（`vite.config.js` の `test.env` で
  `VITE_DATA_SOURCE: 'mock'` を固定。`.env.local` の設定に影響されない）

---

## 3. データの入口：`src/lib/dataAdapter.js`

**データ取得の唯一の窓口。** ページ・コンポーネントから直接 `supabase` や
`mockData` を import しない。

```js
const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE ?? 'mock'
export const isMock = DATA_SOURCE !== 'supabase'
```

- `VITE_DATA_SOURCE=supabase` のときだけ実DBに繋ぐ。未設定を含むそれ以外はmock
- 新しいデータ取得を足すときは、**mock分岐とsupabase分岐の両方**を実装する
- 開発機の `.env.local` は `supabase` に設定されている
  （＝`npm run dev` は既定で実DBに繋がる。値は表示しない）

---

## 4. データベース

### 正本の場所

**`supabase/migrations/README.md` が適用状況の正本。**
`docs/system-design.md` のmigration一覧表は古い（004〜006を未実行と記載）ため、
食い違う場合はREADMEを信じる。

### 主なテーブル

| テーブル | 役割 |
|---|---|
| `child_states` | 子どもの姿マスター。**全機能の入口（ハブ）** |
| `books` | 作品マスター（絵本・紙芝居） |
| `book_state_links` | 作品 × 子どもの姿（pre / post_pred / avoid） |
| `practice_logs` | 実践記録。**個人名カラムを意図的に持たない** |
| `practice_log_states` | 実践記録 × 子どもの姿 |
| `book_contributions` | 仮登録した作品と追加者の対応（**非公開**） |
| `ai_reports` / `activity_plans` / `knowledge_notes` | レポート・活動計画・園の知見 |

### migrationの扱い（リスク分類C）

- 001〜003は書き換えない。変更は必ず新しい番号のファイルで行う
- SQLファイルの作成・編集はしてよいが、**Supabase SQL Editorでの実行はMasterが行う**
- Claude CodeからCLIやAPIでmigrationを適用しない
- `supabase/dev-tools/reset_dev_database.sql` は明示的な承認なしに実行しない

### 検索RPC

```
search_books_by_state(p_state_id uuid, p_age_group int, p_scene text)
```

**3引数。** `p_season` は存在しない（過去に4引数で呼んで検索が全件0件になった事故がある）。
この契約は `src/lib/searchRpc.test.js` が保護している。引数を変えるときは
migration側とdataAdapter側を必ず同時に一致させる。

---

## 5. 認証

**ログイン操作なしで使えることが前提。** 匿名認証（`signInAnonymously`）を使う。

- 匿名ユーザーもSupabase上は `role = authenticated`。
  つまり `to authenticated` の権限は「誰でも」に等しい。RLSを書くときの前提として重要
- セッションの保証は `src/lib/ensureAnonymousSession.js` が一手に担う。
  同時に呼ばれても匿名ユーザーは1人しか作らない
- **書き込みの直前にだけ**セッションを用意する。
  検索や閲覧のためだけに匿名ユーザーを作らない（アカウントが無駄に増えるため）
- 匿名セッションはブラウザに紐づく。**データを消したり別端末を使うと、
  自分が追加した作品を辿れなくなる**（作品と記録自体は残る）。設計上の制約

---

## 6. 重要なデータフロー

### 記録の保存は `book_id` が正本

```
検索 → 詳細 →「この絵本を記録する」→ /record（location.state で引き継ぎ）→ 保存
```

- `navigate('/record', { state: { bookId, bookTitle, bookAuthor, ... } })`
- **`book_id` があれば書名で本を探し直さない。**
  書名の完全一致で本を特定する設計には戻さない（同名の版違いで詰む）
- title / author などは表示のためだけに渡す

### 未登録作品の追加（その場で追加して、そのまま記録する）

```
検索 → 見つからない →「この作品を追加する」→ 最小限の確認 →「追加して記録する」
→ /record（book_id を持った状態）→ 保存
```

- 追加は **`create_provisional_book` RPC のみ**。
  フロントエンドから `books` へ直接INSERTしない（権限は管理者のみ）
- RPCは3つの状態を返す。すべて画面で扱う必要がある

| status | 意味 | 画面の動き |
|---|---|---|
| `created` | 新しく仮登録した | そのIDで記録へ |
| `existing` | ISBN一致の作品が既にあった | そのIDで記録へ |
| `candidates` | 書名が近い作品がある | 候補を出して人に選んでもらう。「どれでもない」のときだけ新規作成 |

- 返り値は `returns table(...)` なので**1行の配列**で返る（`data[0]` を見る）
- 仮登録した作品は**その場ですぐ記録できる**。管理者の公開を待たせない

### `is_active` の意味（重要）

**`is_active` は「みんなに公開してよいか」の旗であって、
「本人が使ってよいか」ではない。** 両者を混同しない。

- 通常の検索（`searchBooksByKeyword`）は `is_active = true` で絞る
- それとは別に、**自分が追加した作品**は `book_contributions` から辿って検索結果に足す。
  この表のRLS `contrib_select_own`（`created_by = auth.uid()`）が効くため、
  他の利用者が追加した未公開作品は**構造上取得できない**
- 画面では「登録されている絵本」と「自分が追加した作品」を別の見出しで出す

### 実践記録と子どもの姿の紐づけ（2026-08-25 実装・実環境確認済み）

`practice_logs` と `child_states` は `practice_log_states` を通じて紐づく。
子どもの姿から探して記録したときは、`phase = 'pre'` として
**「どの子どもの姿を見て、その絵本を選んだか」**を保存する。

```
child_state → 絵本検索 → book → RecordInput
              → practice_logs → practice_log_states (phase = 'pre')
```

**保存する条件**：子どもの姿の検索から記録したときだけ。
書名検索・自分が追加した作品・本棚など `stateId` を持たない導線では、
`practice_log_states` を無理に作らない（記録本体だけを保存する）。

**保存の正本**

| 何を | どこに |
|---|---|
| 記録本体 | `practice_logs` |
| 作品との紐づき | `practice_logs.book_id` |
| 検索時の子どもの姿 | `practice_log_states` |
| 検索前の姿 | `phase = 'pre'` |

- 検索を生んだ姿は**本1冊ごとに持たせる**。画面全体で持つと、
  書名検索で選んだ本にも前の検索の姿が付いてしまう
- 重複は既存のDB制約 `unique (log_id, state_id, phase)` が防ぐ
- 「読んだ後の姿」(`post`) の入力UIは作っていない

### 部分成功の扱い（記録本体と紐づけを切り分ける）

`practice_logs` の保存に成功し、`practice_log_states` だけ失敗した場合は
**部分成功**として扱う。`savePracticeLog` は `{ logId, stateLinksSaved }` を返し、
「完全成功 / 本体成功＋紐づけ失敗 / 本体失敗（例外）」を呼び出し側が区別できる。

- 保存済みの `practice_logs` を**削除して帳尻を合わせない**
- 利用者に**再保存を求めない**（同じ記録が二重に増えるため）
- 完了画面で「記録は保存されました。ただし、選んだときの子どもの姿を残せませんでした。」
  とだけ伝える。`console.error` だけで隠さない

優先順位は **1. 実践記録本体を失わない → 2. 二重保存しない → 3. 紐づけ失敗を隠さない**。

### 実環境で確認済み（2026-08-25）

「貸し借りが難しい」→「そらまめくんのベッド」→ 記録 の流れを実Supabaseで確認。

- `practice_logs` 保存成功／`practice_log_states` 保存成功
- 正しい `log_id`・正しい `state_id`・`phase = 'pre'`
- ページ再読み込み後の再取得でも紐づきが維持される
- RLSエラー・FKエラー・DB構造差異なし
- 検証用データは通常のRLS経路でcleanup済み（`books` / `child_states` /
  `book_state_links` には触れていない）

---

---

## 7. UX原則・壊してはいけない設計

不変条件の全文は `docs/product-charter.md`。ここでは実装で特に効くものを挙げる。

- **利用者画面に管理側の言葉を出さない。**
  「未公開」「確認待ち」「仮登録」「AI生成」「確認済み」「注意あり」「NG」等は
  管理用に留める（`Home.test.jsx` が画面文言を検査している）
- 子どもを評価・診断・断定する表現を使わない
- 子どもの個人名を保存させない
- 検索の入口は絵本タイトルだけでなく「子どもの姿」
- 記録は途中で止めない。エラーは `console.error` だけで終わらせず、
  画面に簡潔な案内を出す
- 0件のときにサンプルデータで埋めない。「まだ登録されていません」と正直に出す
- 登録されていない絵本には記録ボタンを出さない
  （4ステップ入力し終えてから保存に失敗する体験を作らない）

---

## 8. 外部サービス（実測済み・2026-08-21）

### openBD

- **ブラウザから直接利用できる**（`access-control-allow-origin: *` を確認）
- **ISBNでの照会のみ。書名でのキーワード検索APIは無い**
- 取り込むのは書誌情報だけ（書名・著者・出版社・ISBN・出版年）。
  **書影と内容紹介文は取り込まない**（利用条件の確認が済むまで持ち込まない方針）
- 実装：`src/lib/catalog/providers/openbd.js`

### 国立国会図書館サーチ

- **ブラウザから直接呼べない。** `/api/opensearch` の応答にCORSヘッダが無いことを実測
- 書名での外部検索を実現するには、**Supabase Edge Function 等のサーバ側中継が必要**
  （未実装・Master判断待ち）

### provider層

- `src/lib/catalog/catalogService.js` が取得元を差し替え可能にしている。
  外部APIの仕様が変わっても、差し替えるのはプロバイダ1つだけで済む設計
- 登録は `src/main.jsx` から `registerDefaultProviders()` を1回だけ呼ぶ

---

## 9. 既知の制約

### mockの `book_id` がUUID形式でない

- `isDatabaseBook()` はUUID形式のIDだけを「記録できる本」と判定する
- mockの本のIDは `bk-01` 等のためこの判定を通らず、**mockモードでは
  絵本詳細に「この絵本を記録する」ボタンが出ない**（実DBでは出る）
- 結果として、mockでは詳細画面からの記録導線をそのまま検証できない。
  代替として、追加パネル経由など別の入口から `/record` に入って確認する
- **将来の独立した改善候補：`mockData.js` のIDをUUID化する**（今回は対象外）

### mockと実環境の差（検証時に効くもの）

- mockに「他の利用者」という概念が無い。RLSの効き方はmockでは検証できない
- mockの仮登録作品は `localStorage`（`provisional_books_v1`）に入る

---

## 10. lint baseline（既知の指摘・2026-08-25時点で4件）

**新規のlintエラーと、この既知4件を分けて扱う。**
無関係な修正のついでに大量修正はしない。

| ファイル | 内容 |
|---|---|
| `src/context/AuthContext.jsx` | Fast Refresh警告（コンポーネント以外もexportしている） |
| `src/pages/AIReport.jsx` | 未使用import（`BookOpen`） |
| `src/pages/CalendarPage.jsx` | useEffect内で同期的にsetStateしている |
| `src/pages/RecordList.jsx` | 不正な空白文字 |

`docs/current-status.md` には2026-08-11時点の「5件」という記載があるが、
`src/pages/MyPage.jsx` の指摘は解消済みで、現在は上記4件。

---

## 11. 保留課題（Master判断・未着手）

| # | 内容 |
|---|---|
| 1 | 書名での外部書誌検索（サーバ側中継が必要。第8章参照） |
| 2 | `mockData.js` のUUID化（第9章参照） |
| 3 | 仮登録された作品を管理者が確認・公開する手順と画面が未定 |
| 4 | 「きんぎょがにげた」（`43c23d14-854c-4881-b367-96e882147c40`）は `is_active = false` のまま。公開・補完・削除の判断が未定 |
| 5 | `docs/screen_map.md` / `docs/book_detail.md` と実際のルーティングが不一致（正本の判断が必要） |
| 6 | `npm audit` の指摘（メジャーバージョンが上がる可能性があり未対応） |
| 7 | `old-html/` と Vite既定のままの `README.md` の扱い |
| 8 | `docs/ai-development-rules.md` は旧版（Legacy）として残している。現在有効な参照はすべて新正本へ切り替え済み。将来この旧ファイルを削除するかはMaster判断 |

---

## 12. 参照ドキュメント

| ファイル | 内容 |
|---|---|
| `docs/ai-development-workflow.md` | **進め方の正本**（プロジェクト非依存） |
| `docs/product-charter.md` | 変えてはいけないこと（不変条件） |
| `docs/project_overview.md` | 目的・世界観・画面構成 |
| `docs/system-design.md` | 技術構成・ディレクトリ・DB詳細 |
| `docs/coding-rules.md` | コーディング規約 |
| `docs/current-status.md` | 既知の課題・検証記録の時系列 |
| `docs/decision-log.md` | 意思決定の記録 |
| `docs/book-data-pipeline.md` | 作品データを増やすための設計 |
| `supabase/migrations/README.md` | **migration適用状況の正本** |
| `docs/ai-development-rules.md` | 旧版（Legacy）。履歴・過去設計の参照用。作業手順としては使わない |
