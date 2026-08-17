# コーディング規約

最終更新：2026-07-27

既存コード（`src/`）から確認できる実際のスタイルをまとめたもの。新しいコードは
これに合わせる。ESLintが自動チェックするルールは重複記載しない（`eslint.config.js` 参照）。

---

## 言語・記法

- JavaScript／JSX のみ。TypeScriptは未導入（理由は `docs/decision-log.md`）
- セミコロンなし
- クォートはシングルクォート（`'...'`）
- インデントはスペース2つ
- コンポーネントは `function ComponentName() { ... }` の関数宣言＋`export default`
- 状態管理は `useState` / `useEffect` のみ。外部の状態管理ライブラリは使っていない

## コメント

- コメントは日本語。セクション区切りに `// ──── 見出し ────` の形式をよく使う
  （例：`src/pages/Home.jsx`, `src/lib/dataAdapter.js`）
- 「なぜそうしているか」が非自明な箇所にだけ短いコメントを書く。処理をなぞる説明は書かない

## スタイリング

- Tailwind CSSのユーティリティクラスを直接JSXに書く。別途CSS Modulesは使わない
- ブランドカラーは16進数で直書き（例：`text-[#2C2C2A]`, `bg-[#DCE4D9]`）。
  `docs/project_overview.md` の「デザインガイドライン」の配色に合わせる
- Tailwindの `sage` カラーパレットが `tailwind.config.js` に定義されている

## データ取得

- ページ・コンポーネントから直接 `supabase` や `mockData` を import しない。
  必ず `src/lib/dataAdapter.js` の関数を経由する（詳細は `docs/system-design.md`）
- 新しいデータ取得関数を追加するときは、`isMock` によるmock分岐とsupabase分岐の
  両方を実装する

## 保存先の使い分け（現状の実装方針）

| データ | 保存先 |
|--------|--------|
| やること・予定・読みたい本 | `localStorage`（画面別のキー） |
| 絵本・記録データ | Supabase（mockモードでは `mockData.js` / `localStorage`） |

## 個人情報・文言の注意

- 子どもの個人名を入力・保存させる項目を追加しない（`docs/product-charter.md` 参照）
- 「AI生成」「確認済み」「注意あり」「NG」など管理側の言葉を利用者向け画面文言に使わない
- 子どもを評価・診断する断定的な文言を避け、やわらかい言い回しにする
  （DBコメントの例：「〜かもしれません」）

## Lint

- `npm run lint` はコミット前に実行する
- 既存コードに残っている指摘（2026-07-27時点で8件）は本ハーネス整備の対象外。
  一覧は `docs/current-status.md` を参照。触れる機会があれば直しても良いが、
  無関係な修正のついでに大量修正はしない
