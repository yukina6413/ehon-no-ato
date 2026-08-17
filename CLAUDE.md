# CLAUDE.md — えほんのあと 開発ルール

このファイルはClaude Codeがこのプロジェクトで作業するときに毎回読む中心ルール。
詳細は各docsファイルに分けてある。ここでは全体像と参照先だけを示す。

## このアプリの目的

保育士が「この子どもの姿には、どのような保育ができるだろう」と考えるための
**意思決定支援アプリ**。絵本の記録アプリではない。
→ 目的・世界観の詳細：`docs/project_overview.md`
→ 変えてはいけない設計思想：**`docs/product-charter.md`（必読）**

## 役割分担

- **Master（仲畠幸那）**：プロダクトの思想・対象者・主要機能を決める。
  `git push`、本番デプロイ、Supabase本番操作、migrationの実行を行う。
- **Claude Code**：日本語で伝えられた要望・不具合報告から、調査→原因特定→
  最小修正→検証→報告を自律的に進める。可逆的な作業は確認なしに実行してよい。
  `docs/product-charter.md` に抵触する変更・破壊的な操作は必ず立ち止まって確認する。

## 作業開始時に確認すること

1. `git status` / 現在のブランチ / 未コミットの変更（勝手に破棄しない）
2. `docs/current-status.md`（既知の課題・矛盾点）
3. 依頼内容に関係するページ・`src/lib/dataAdapter.js`・DBスキーマ（`supabase/migrations/`）
4. 関連するテストの有無

## 修正の基本手順・完了条件・禁止事項

→ **`docs/ai-development-rules.md`（必読）**：標準ループ、自動で進めてよいこと、
必ず確認を取ること、完了条件をすべてここに定義している。

## 技術構成・データベース

→ `docs/system-design.md`：Vite/React/Tailwind/Supabaseの構成、`dataAdapter.js` が
データ取得の切り替え地点であること、テーブル構成（`child_states`, `books`,
`book_state_links`, `practice_logs` 等）、migration運用ルール。

## コーディング規約

→ `docs/coding-rules.md`

## 検証コマンド（実在するもののみ）

```
npm run lint    # ESLint
npm run test    # Vitest（2026-07-27追加。dataAdapterのmockモードをテスト）
npm run build   # 本番ビルド
```
型チェック（tsc）はプロジェクトがTypeScript未導入のため存在しない
（経緯：`docs/decision-log.md`）。

## 報告のルール

- **事実と推測を分ける。** 「確認した事実」と「推測」を明記する
  （詳細：`docs/ai-development-rules.md`）。
- **初心者にも分かる日本語で説明する。** 保育士・非エンジニアのMasterが読む前提で、
  専門用語を避けるか一言補足する。
- 小さく可逆的な判断はいちいち確認を求めず、まとめて完了報告のときに説明する。
- 完了報告は次の形式にする：
  1. 結論（何ができる状態になったか）
  2. 確認した事実
  3. 作成・変更したファイル
  4. 検証結果（実行したコマンドと成否）
  5. 保留事項（Masterの判断・外部操作が必要なことだけ）
  6. 次回からの頼み方の例（あれば）

## サブエージェント

`.claude/agents/` に `investigator`（調査専用・修正しない）、`implementer`（最小修正）、
`verifier`（テスト・ビルド・回帰確認）、`product-guardian`（憲章との整合確認）を用意している。
大きめの不具合対応では、まずinvestigatorで原因を特定してから修正に入ると事故が減る。

## 危険操作のガードレール（自動）

`.claude/settings.json` の `permissions` により、次は自動で止まる・確認が入る仕組みになっている
（Hooksを使わない理由は `docs/decision-log.md` 参照）。

- **ブロック（deny）**：`git reset --hard` / `git clean` / `git push --force` / `.env`・`.env.local` の読み取り
- **毎回確認（ask）**：`git push` / `git rebase` / `git commit --amend` / `supabase` / `psql` /
  デプロイ系（vercel・netlify・`npm run deploy`） / `rm -rf` / `.env.local` の表示 /
  `reset_dev_database.sql` の読み取り

このガードは補助であり、`docs/ai-development-rules.md` の「必ず止まって確認すること」の判断を
置き換えるものではない。列挙外でも破壊的・不可逆・本番影響のある操作は自分で立ち止まる。

## 変えてはいけないこと（要約）

詳細・全文は必ず `docs/product-charter.md` を読むこと。ここでは見出しのみ。

- AIは保育士の判断を置き換えない
- 検索の入口は「絵本タイトル」だけでなく「子どもの姿」
- 子どもを評価・診断・断定する表現を使わない
- 子どもの個人名を保存しない
- 利用者画面に「AI生成」「確認済み」「注意あり」「NG」等の管理側の言葉を出さない
- 季節・年齢・場面・子どもの姿の不自然な組み合わせを減らす
- プロダクトの思想・対象者・主要機能はMasterの承認なしに変更しない
