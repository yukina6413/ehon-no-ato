# 意思決定ログ

開発上の判断とその理由を記録する。新しい決定は下に追記する（古い順）。

形式：
```
## YYYY-MM-DD 決定タイトル
- 決定：何を決めたか
- 理由：なぜそう決めたか
- 決めた人：Master / Claude Code
```

---

## 2026-07-27 Claude Code開発ハーネスの構築

- 決定：CLAUDE.md・docs/配下のルール文書・.claude/agents/・Vitestを導入した
- 理由：Masterからの日本語での依頼だけで、調査→原因特定→最小修正→検証→報告の
  流れをClaude Codeが自律的に進められるようにするため
- 決めた人：Master（依頼） / Claude Code（実装）

## 2026-07-27 型チェック（tsc）は導入しない

- 決定：`package.json` に typecheck スクリプトを追加しなかった
- 理由：プロジェクトはTypeScript未導入の純粋なJSXコードベース。試しに
  `tsc --checkJs` を仮実行したところ、型注釈が一切ないコードに対して
  実害のない `implicit any` 系エラーが大量に出るだけで、実バグの検出には
  つながらなかった。型チェックを機能させるにはTypeScript移行かJSDoc型注釈の
  追加が必要で、これはコーディングスタイルの大きな変更にあたるため、
  Masterの判断を仰ぐべき事項と考え、今回は見送った
- 決めた人：Claude Code（提案）／実行はしていないためMasterの判断待ち

## 2026-07-27 テスト基盤としてVitestを追加

- 決定：`vitest` を devDependencies に追加し、`npm run test` を新設。
  `src/lib/dataAdapter.test.js` に mockモードのスモークテストを追加
- 理由：依頼の前提「テストが存在する」は実際には存在しなかった。検証手順に
  テストが必要なため、既存構成を壊さない最小限の追加として導入した
- 決めた人：Claude Code（提案・実装）

## 2026-07-27 テストはVITE_DATA_SOURCE=mockを強制

- 決定：`vite.config.js` の `test.env` で `VITE_DATA_SOURCE=mock` を固定
- 理由：開発機の `.env.local` は `VITE_DATA_SOURCE=supabase` になっており、
  何もしないとテストが実Supabaseへネットワーク接続しようとして失敗した
  （`fetch failed`）。テストは環境に依存せず常に再現可能であるべきなので、
  テスト実行時だけmockモードに固定した
- 決めた人：Claude Code

## 2026-07-27 .gitignoreの`.claude`除外を一部解除

- 決定：`.claude` 全体の除外をやめ、`.claude/settings.local.json` のみ除外するよう変更
  （`.claude/agents/` と `.claude/settings.json` は追跡対象にする）
- 理由：サブエージェント定義や共有設定はGitHubリポジトリで管理してこそ
  「継続的な開発ハーネス」として機能する。一方 `settings.local.json` は
  このマシン固有のパスを含む個人設定のため、引き続き除外する
- 決めた人：Claude Code（提案・実装、要Master確認）

## 2026-07-28 危険操作の抑止はHooksではなくPermissionsで実装

- 決定：`.claude/settings.json`（コミット対象）に `permissions.deny` と
  `permissions.ask` を定義し、危険なGit操作・Supabase操作・デプロイ・機密ファイル
  表示を、確認なしに実行できないようにした。Hooks（PreToolUse等）は今回は導入せず、
  推奨案として本ログと最終報告に記録するに留めた
- 理由：
  1. この環境（Windows / Git Bash）に `jq` が入っておらず、Hooksの標準的な
     「stdinのJSONをjqで解析してファイル名やコマンドを取り出す」パターンが
     そのままでは動かない。`node` で代替は可能だが、その分だけ壊れやすくなる
  2. Windowsでは、セッション開始時に設定ファイルが無かったディレクトリの
     Hooks変更が即時反映されない既知の制約があり、導入しても本当に発火するかを
     このセッション内で確実に検証できない（要 `/hooks` 再読込またはCLI再起動）
  3. 整形用のフォーマッタ（prettier等）が未導入で、ESLintには既存の指摘が8件残る。
     編集のたびにlintを走らせるHookは「毎回失敗扱い」になりノイズが大きい
  4. 「完了前にテスト・ビルドを必ず走らせる」Stop Hookは、全テスト＋ビルドを
     毎回実行することになり、依頼の「毎回長時間の処理を走らせない」に反する
  - Permissions（deny/ask）はOS・シェル・jqに依存せず、設定ファイルから確実に
    読み込まれるコア機能のため、同じ目的をより堅牢に達成できる
- 今後Hooksを導入する場合の推奨（Master判断）：
  - フォーマッタを導入したうえで PostToolUse(Write|Edit) で整形
  - `jq` を入れるか `node -e` でstdin解析するコマンドHookに統一する
  - Stop Hookは全体テストではなく「差分に関係するテストだけ」に絞る
- 決めた人：Claude Code（提案・実装、要Master確認）

## 2026-08-01 検索RPCの引数不一致（p_season）を修正

- 決定：`dataAdapter.searchBooksByState()` から `p_season` の送信を削除し、
  適用済みマイグレーション003の3引数 `(p_state_id, p_age_group, p_scene)` に一致させた。
  未使用になった `getCurrentSeason()` も削除。回帰テスト `src/lib/searchRpc.test.js` を追加
- 理由：
  - デプロイ済みRPCは3引数のみで、4つ目の `p_season` を送るとSupabaseが関数を解決できず
    PGRST202エラーになり、supabaseモードでAI検索が失敗していた（mockモードでは未発覚）
  - 「適用済みmigrationを実行しない」制約下でエラーを今すぐ解消でき、かつ一度も
    動作していなかった季節フィルタを消すだけなので、仕様変更ではなくバグ修正と判断
  - 季節フィルタをRPC側に足す案（migration追加）は、Masterが実行するまで動かず
    今回の「エラーが出ないことを確認」を満たせないため見送り。将来案として
    `docs/current-status.md` に記録
- 影響範囲：`searchBooksByState` の呼び出し元（`Home.jsx`, `AISearch.jsx`）は
  元々3引数で呼んでおり、シグネチャは不変のため影響なし
- 決めた人：Master（依頼） / Claude Code（実装）

## 2026-08-05 検索で選んだ絵本を記録画面へ引き継ぐ連携を実装

- 決定：絵本詳細モーダルに「この絵本を記録する」ボタンを追加し、navigation stateで
  `{ bookId, bookTitle, bookAuthor }` を `/record` に渡す。`RecordInput` は
  `useLocation` で受け取りフォーム初期値に反映。回帰テスト
  `src/lib/savePracticeLog.test.js` を追加
- 理由：
  - MVPの一周（検索→絵本選択→記録→保存→一覧）を実データで通すのに必要な導線が
    未実装だった。`docs/book_detail.md` に既記載の仕様であり、新たな設計ではない
  - bookId を引き継ぐことで、保存時のタイトル一致検索を省き、確実にその絵本へ
    紐づけられる（savePracticeLog は元々 bookId 優先の設計）
- 判断のポイント（安全策）：
  - サンプル絵本（`SAMPLE_BOOKS`、id=`s1`等・DB未登録）に実UUIDでない id を
    そのまま渡すと practice_logs 挿入で外部キー制約エラーになる。そこで
    UUID形式のときだけ bookId を渡し、サンプルはタイトルのみ渡して既存の
    「未登録」案内に載せることで、エラーではなく親切な案内に倒した
  - savePracticeLog 本体のロジック（bookId優先→なければタイトル検索）は変更せず、
    渡すデータ側で制御。既存テスト・挙動への影響を最小化
- 影響範囲：`INITIAL` に `bookId` を追加、`RecordInput` の form 初期化を
  遅延初期化に変更、`BookDetailModal` にボタン追加。既存の記録保存ロジックは不変
- 決めた人：Master（依頼） / Claude Code（実装）

## 2026-08-10 ホーム画面の検索UI再構成

- 決定：ホームの検索入口を4つに整理（①絵本・紙芝居を探す ②子どもの姿・保育士の思いから探す
  ③季節・行事から探す ④テーマから探す）。認証・記録保存の実装は変更なし
- 変更ファイル：`src/pages/Home.jsx` のみ
- 主な変更：
  - ①補助候補チップ削除・placeholderを「絵本名・作者名・キーワードを入力」に
  - ②名称変更＋自由入力欄追加＋補助候補を7項目に（子どもの姿＋保育士の思い）。
    候補/自由入力ともテキストとして findStatesByText→searchBooksByState の実DB経路に接続
  - テーマを2系統に分離：季節・行事（時期で変わる）／生きもの・生活・気持ち・友だち関係（普遍）。
    「自然」はトップの入口から削除。普遍テーマには季節の説明文を使わない
  - 「今日のやること」「最近読んだ本」をホームから削除（Todoアプリ化を避ける）
- 【重要・未実装】季節/行事の「何月に何を出すか」「季節境界」「行事を何日前から」
  「次の季節の先出し」等の自動表示ルールは仕様未確定のため実装しない。
  月別データ(MONTHLY_THEMES)は既存挙動のまま「後から差し替え可能な設定データ」として保持。
- DB変更：なし。設計思想・記録循環は不変
- 決めた人：Master（依頼） / Claude Code（実装）

## 2026-08-11 記録画面Step2の整理（季節・行事・祝日を削除、選んだ理由を追加）

- 決定：`RecordInput.jsx` のStep2から「季節」「行事・祝日にあわせて読みましたか」を削除し、
  「この絵本を選んだ理由」（読み手が選んだときのみ表示）と「読む前の子どもの姿」を置いた。
  年齢の「混合」は複数選択で表現できるため選択肢から外した
- 理由：季節・行事は絵本を**探す**ときの入口（ホームの「季節・行事から探す」＝
  `books.seasonal_tags` / `event_tags`）であって、読み終えた記録として毎回入力させる
  項目ではない。記録画面の入力負担を減らし、「どんな子どもの姿があって選んだか」という
  意思決定支援の中身に寄せた
- DB変更：**なし**。季節・行事は `books`（マスタ）側の列で、`practice_logs` には
  元から季節・行事の列が無いため、削除しても保存処理・検索機能に影響しない
- **未解決**：「選んだ理由」を入れる列が `practice_logs` に無いため、supabaseモードでは
  保存されない（mockモードのみ保存）。DB列追加はMaster承認事項として
  `docs/current-status.md` に記録し、今回は追加していない
- 決めた人：Master（依頼） / Claude Code（実装）

## 2026-08-11 記録の保存漏れを解消（008で列追加・mockとsupabaseの仕様統一）

- 決定：記録画面の入力のうち保存されていなかった項目を `practice_logs` に保存する。
  追加する列は `select_reason` / `selected_by` / `after_type` / `episode` / `insight` /
  `age_groups int[]` / `scene_activities text[]` の7つ（migration 008・列追加のみ）
- 理由：監査の結果、画面で入力できるのにDBに列が無く捨てられている項目が6種類あった。
  特に「選んだ理由」は「どの子どもの姿に対してこの絵本を選んだか」という
  意思決定支援の中核情報で、残らないと記録の意味が薄れる
- Master判断（2026-08-11）：
  - `location`（どこにある本か）は**保存しない**。その日の実践ではなく本そのもの・
    所蔵に属する情報のため、必要になれば将来 `books` 側で設計する
  - 既存の `age_group` / `reaction` / `memo` / `class_name` / `interest_points` /
    `child_words` / `play_expansion` は**削除も型変更もCHECK制約変更もしない**
- 実装上の判断（後方互換を優先）：
  - `age_group`（1件）には従来どおり1件目を書き続け、新しい `age_groups` に全件を書く
  - `reaction`（4択CHECK付き）は使わず `after_type` を新設。CHECK制約を触らずに済む
  - `memo`（印象＋気づきの連結）も従来どおり書き続けたうえで、`episode` / `insight` に
    分けても保存する。文章が二重に入るが、既存データ・既存のSQL閲覧を一切壊さない
  - 読み出しは `normalizeLog()` に集約し、mockとsupabaseで同じ形の記録を返すようにした。
    008以前の記録は `episode`/`insight` が両方nullであることを目印に `memo` を印象として表示する
- 副次的に解消した不具合：supabaseモードでは「えほんのあとタイプ」が常に表示されず、
  「今日の気づき」が記録一覧の検索に引っかからなかった（mockモードでは動いていた）
- **実行順序の注意**：008を実行する前にsupabaseモードで記録を保存すると、存在しない列への
  書き込みになり保存が失敗する。コードのデプロイと008の実行はセットで行う
- 決めた人：Master（方針決定） / Claude Code（監査・実装）

## 2026-08-11 記録項目の整理（子どもの姿を記録画面から外す）と白画面バグの修正

- 決定（Master）：記録画面から「読む前の子どもの姿」「読んだ後の子どもの姿」を外す。
  他の入力項目と内容が重複し、書く側が迷う構造になっていたため。
  記録の構造は【選ぶ前】誰が選んだか・選んだ理由／【読んだ直後】子どもの反応・
  えほんのあとタイプ／【ふりかえり】印象に残った子どもの様子・今日の気づき・
  次に読むならこうしたい、を基本とする
- DB：**変更なし**。`practice_log_states` テーブル・既存データ・
  `savePracticeLog(form, pre, post)` のデータ層APIはすべて残す。
  画面から渡さなくなっただけで、既存記録の読み出しは一切変わらない
- 「読んだ後の子どもの姿」の代わりに自由記述欄は追加しない。
  「印象に残った様子」を「印象に残った子どもの様子」に改称し、
  実際に見られた具体的な姿を書く欄と位置づけた（気づきは保育者側の読み取り）

## 2026-08-11 記録画面が真っ白になる不具合の修正（根本原因）

- **原因（再現して特定）**：`StateChips` が `selected.includes()` / `states.map()` を
  ガードなしで呼んでおり、下書き復元などで値が配列でないとTypeErrorになる。
  Reactは描画中の例外でツリー全体を外すため、URLは `/record` のまま画面全体が白くなっていた
  （更新するとStep1から再開するのは、下書きにページ番号を保存していなかったため）
- 検証：`react-dom/server` で各Stepを描画する一時テストを作り、
  `Cannot read properties of undefined (reading 'includes')` を実際に再現してから直した
- 修正（最小）：
  1. 上記2つのカードを削除したことで `StateChips` 自体が不要になり、原因箇所が消えた
  2. 下書きの復元を `loadDraft()` に集約し、配列項目は必ず配列に整える。
     壊れたJSONは無視して新規入力にする（同種の白画面を今後も防ぐ）
  3. 既存のsessionStorageの下書きに `step` も併せて保存し、
     ページ更新でも入力途中のページに戻るようにした（保存方式は増やしていない）
- 再発防止：`src/pages/RecordInput.test.jsx` で、壊れた下書き・範囲外のページ番号でも
  描画が落ちないことを固定した

## 2026-08-11 カレンダーに記録が見えない問題

- **確認した事実**：データ取得は正しく動いていた。`getPracticeLogsByMonth` の月範囲
  （2026-08-01〜2026-08-31）も、`read_date` とカレンダーの日付セルのキーの一致も、
  テストで検証して問題なし（`src/lib/getPracticeLogsByMonth.test.js`）
- **本当の原因**：日付をタップするまで絵本が一切表示されない作りで、手がかりが
  1.5pxの点だけだった。さらに取得失敗を `console.error` のみで握りつぶしており、
  「通信失敗」と「記録なし」が画面上で見分けられなかった
- 修正（最小）：日付未選択のときはその月の記録一覧を出す。取得失敗時は画面に
  メッセージを出す。カレンダーの格子・日付セルのUIは変更していない
- 決めた人：Master（依頼） / Claude Code（原因特定・実装）

## 2026-08-14 マイページを「少し先の保育を準備する場所」に再設計

- 決定（Master）：マイページを「便利機能を置く場所」から
  「自分・園の状況を確認し、少し先の保育を準備する場所」へ再定義する。
  情報の並びは ①プロフィール ②もうすぐの行事 ③園のカレンダー ④今月の記録 ⑤設定
- 中心にある考え方：カレンダーは予定管理機能ではなく、
  **園の行事を少し前に思い出して絵本を準備するための機能**。
  行事 → 事前に気づく → 関連絵本を探す → 読む → 記録する、の循環をつくる
- 削除：今日の予定／今日のやること／ToDo追加／記録したいこと／
  AIレポート閲覧回数／よく読んだテーマ／通知スイッチの直接表示／
  ログアウトの直接表示／本棚へのリンク（下部ナビと重複するため）
- DB：**変更なし**。保存先は既存の localStorage キー `schedules_v1` を
  形式ごと維持した（ホームの「読む予定に入れる」も同じキーに書くため、変えると壊れる）
- 直した既存の不具合：
  - 「今月の記録」は固定値（18件・9回・16日）のハードコードで、実データと無関係だった
    → `getPracticeLogs()` の実データから件数と読んだ日数を数えるようにした
  - プロフィールが画面を離れると消えていた（メモリ上だけだった）→ localStorage に保存
  - 月カレンダーが 2026-05 の固定モックデータを表示していた → 実際の予定・記録に接続
- 「絵本を準備する」の接続先：ホームの「子どもの姿・保育士の思いから探す」
  （`findStatesByText` → `searchBooksByState` の実DB経路）に行事名を渡す。
  検索側の作りは変えず、navigation state を1つ受け取るだけにとどめた
- 未実装（Master判断待ち）：予定表の写真読み取り、端末への通知送信。
  入口だけ置き、写真読み取りは「準備中」と明示して手入力へ誘導している。
  AIの読み取り結果は自動登録せず、必ず人が確認してから登録する方針は維持
- 決めた人：Master（方針・情報設計） / Claude Code（調査・実装）

## 2026-08-18 絵本を増やす前の安全修正（同名本・エラー処理・タイトル必須）

- 背景：絵本データを増やす前提で監査したところ、冊数が増えると確実に壊れる箇所があった
- **根本原因**：`savePracticeLog()` が書名の完全一致＋`maybeSingle()` で絵本を特定していた。
  postgrest-js は2件以上のとき例外ではなく `data=null / error=PGRST116` を返すが、
  呼び出し側が `error` を受け取っていなかったため、**登録済みなのに
  「まだデータベースに登録されていません」という誤った案内**が出ていた（ログにも残らない）
- 修正：
  - `findBooksByTitle()` を新設し、`maybeSingle()` をやめて件数を自分で判定する
    （`empty` / `none` / `one` / `multiple`）
  - 原因を `code` で区別（`TITLE_REQUIRED` / `BOOK_NOT_FOUND` / `BOOK_AMBIGUOUS` /
    `BOOK_LOOKUP_FAILED`）。「本が無い」「同名で特定できない」「通信で確認できない」を
    別の文言にした
  - **同名が複数のときは1冊を推測せず**、候補を画面に出して利用者に選んでもらう
  - Step1のタイトル必須を「次へ」の時点で確認する。ただし絵本を引き継いだ直後は
    タイトル取得中で空のことがあるため、`bookId` があるときは進めてよい
- DB変更：**なし**（migration・構造変更・データ追加なし）
- 決めた人：Master（依頼） / Claude Code（監査・実装）

## 2026-08-18 通常画面からサンプル絵本を排除し、フリー検索を実DBへ接続

- **原因**：ホームの絵本詳細に入る4経路のうち3経路（①フリー検索・③季節行事・④テーマ）が
  `SAMPLE_BOOKS`（Home.jsxに直書きの固定2冊）を返していた。実DBの絵本と見た目が
  区別できず、記録画面で4ステップ入力し終えてから「登録されていません」で失敗していた。
  ①のフリー検索は入力文字を使わず、何を検索しても同じ2冊を返していた
- 決定（Master）：**本番利用の画面で実DBの絵本とサンプルを混在させない。**
  サンプルはmock/dev/テスト/明示的なデモに限定し、0件のときサンプルで埋めない
- 実装：
  - `SAMPLE_BOOKS` を Home.jsx から**削除**（mockデータは `src/lib/mockData.js` に集約）
  - `searchBooksByKeyword()` を新設し、①フリー検索を実DBへ接続。
    **`.or()` は使わない**（利用者入力でフィルタ構文が壊れるため）。
    書名・著者を別々の `ilike` で問い合わせ、`id` で重複を除いて統合する。
    `%` `_` は入力から除去し、意図しない全件一致を防ぐ。`is_active=true` で絞る
  - `isDatabaseBook()` を新設。UUIDのIDを持つ絵本だけ「この絵本を記録する」を出す。
    登録されていない絵本には理由を表示し、入力の手間を無駄にしない
  - 記録ボタンは実DBの絵本にしか出ないので、`bookId` は常に渡る（書名検索に頼らない）
  - ③季節・行事、④テーマは実データ（seasonal_tags / event_tags）が足りないため、
    サンプルで埋めず「まだ登録されていません」と表示する。本実装はデータ整備後
- DB変更：**なし**
- 決めた人：Master（方針） / Claude Code（調査・実装）

## 2026-08-18 is_active と将来の行事検索についての申し送り

- **`is_active` はRLS上のセキュリティ境界ではない**。`books_read_all` は
  `for select to anon, authenticated using (true)` のため、REST APIを直接叩けば
  `is_active=false` の下書きも読める。書誌情報は非機微なので実害は小さいが、
  「下書き＝非公開」とは考えないこと
- 検索RPC `search_books_by_state` は `b.is_active = true` で絞っているが、
  `getBookById()` は絞っていない。現状のアプリ導線では下書きのUUIDを一般利用者が
  得る経路が無いため今回は変更しない
- **将来 `searchBooksByEvent()` を実装する際は、必ず `.eq('is_active', true)` を入れること。**
  入れ忘れると、そこが下書き露出の経路になる
- ISBN：実DBの5冊はすべてNULL。`isbn` にUNIQUE制約が無いため、
  DB側の `on conflict (isbn)` を使ったupsertは**構文上成立しない**。
  50冊の試験投入まではスクリプト側で重複防止し（ISBN-13正規化＋既存との突き合わせ）、
  規模拡大前に `create unique index ... where isbn is not null` を検討する
- 詳細：`docs/book-data-pipeline.md`

## 2026-08-06 MVPの認証を匿名(signInAnonymously)方式に変更

- 決定：記録1件のためにメール確認・6桁OTP・Custom SMTPを要する体験/負担が過大なため、
  MVPは「画面上のログイン操作なしで記録できる」匿名認証にする
- 実装：
  - `AuthContext` に `signInAnon()` を追加（`supabase.auth.signInAnonymously()`。
    既存セッションがあれば再利用）。
  - `RecordInput` は LoginModal / OTP / pending 再試行ロジックを撤去。保存時に未認証なら
    内部で `signInAnon()` を呼び、完了後そのまま `savePracticeLog`。入力は sessionStorage で保持。
  - `LoginModal.jsx` はファイルとして残す（将来のメール登録用。MVPの記録フローからは外した）。
- RLS変更：**なし**。匿名ユーザーもSupabaseでは role=authenticated（is_anonymous claim付き）で
  auth.uid() が匿名ユーザーIDになるため、既存の `logs_own_all`（to authenticated,
  user_id=auth.uid()）とマスタ3表の read（anon,authenticated）でそのまま整合する。
- 将来のメール移行：匿名ユーザーは実在の auth.users 行でIDが安定。後日
  `supabase.auth.updateUser({ email })` 等でメールを紐づければ、同じ user_id のまま
  practice_logs を引き継げる（LoginModalを再利用）。
- Supabase Dashboard操作（コードでは不可）：Authentication で **Anonymous sign-ins を有効化**する。
  これによりメール確認・Custom SMTPはMVPの記録には不要になる。
- 決めた人：Master（依頼） / Claude Code（実装）

## 2026-08-06 記録フロー全体の監査と修正（詳細空欄・記録消失・認証）

- 決定：検索→詳細→記録→認証→保存→一覧の一連の不具合をまとめて修正
- 変更したファイル：`Home.jsx`（検索結果の変換で summary/next_activities/care_points を
  引き継ぐ・詳細のセクションを条件表示に）、`RecordInput.jsx`（sessionStorage下書き保存/復元・
  book_id再取得・認証後の自動保存）、`LoginModal.jsx`（emailRedirectTo）、
  `dataAdapter.js`（getBookById 追加）、テスト追加
- 原因（事実）：
  1. 詳細が空欄 … 検索結果の変換が summary 等を捨て、かつ詳細画面は synopsis 等の
     別プロパティ名を無条件描画していた（DB由来の絵本ではどちらも一致せず空）。
  2. 記録が消える … 認証前の入力を保存しておらず、Supabaseが「確認リンク」を送るため
     リンク遷移でページが再読込→React state が消えていた。
- 修正方針（設計思想・画面仕様は変更しない）：
  - DBに実在する項目(summary→あらすじ/ next_activities→活動例/ care_points→ヒント)だけを
    表示し、無い項目はセクションごと非表示（book_detail.md の後方互換方針に沿う）。
  - 入力は sessionStorage に都度退避し、認証で画面が飛んでも復元。認証後は自動で保存を再試行。
  - cover_url は books に列が無く、表紙は絵文字+色の既存設計（バグではない）。
- 認証方式：アプリは6桁OTP前提のUI。Supabaseが確認リンクを送っているのが不一致の主因で、
  これは Dashboard のメールテンプレート設定（{{ .Token }} を使う）で解消する（コードではなくDashboard操作）。
- 決めた人：Master（依頼） / Claude Code（実装）

## 2026-08-05 DBを単一セットアップ(000)に統合し、anon読み取りを許可

- 決定：`supabase/migrations/000_complete_mvp_setup.sql` を新設。001〜006の内容と
  これまでの修正を統合し、新しい空プロジェクトで1回実行すればMVPが動く冪等SQLにした。
  スモークテスト `supabase/dev-tools/smoke_test.sql`（SELECTのみ）も追加
- 根本原因（連続した不具合の共通項）：DBを001〜006のインクリメンタルで積み上げる過程で
  (1) 004以降の適用が不揃い（列不足→保存エラー）、(2) マスタ3表と検索RPCが
  `authenticated` 限定で、ログイン前に検索するアプリ動線と矛盾（検索0件/RLS）、
  (3) seed未投入やIDズレでリンクが無い、が重なっていた。個別修正の繰り返しでは
  再現性が担保できないため、単一の再現可能なセットアップに作り直した
- 重要な設計判断：**マスタ3表(child_states, books, book_state_links)の読み取りと
  検索RPCの実行を anon にも許可**した。理由は、アプリのホーム画面はログイン前でも
  「子どもの姿から探す」で検索する動線であり、これらは非機微な参照データ（公開カタログ相当）
  だから。個人データ(practice_logs, ai_reports, activity_plans, practice_log_states,
  profiles)は従来どおり本人(authenticated, user_id=auth.uid())限定のまま。
  画面仕様・設計思想は変更していない（ログイン必須化などの画面変更はしていない）
- コードは変更していない（DB側の不足・不整合が原因のため）。SQLファイル作成のみ
- 未実行：Supabaseへの適用・commit・push はしていない（Masterの操作）
- 決めた人：Master（依頼） / Claude Code（調査・ファイル作成）
