# 絵本データを増やすための設計（監査結果と投入方式）

最終更新：2026-08-18
状態：**設計のみ。DB変更・データ投入は未実行。**

「1冊ずつ人が手入力する」ことを前提にしない。まとまった量を安全に投入できる形にする。

---

## 0. 監査でわかった最重要点：実DBとmigrationファイルが一致していない

| 項目 | migrationファイル（seed） | 実DB（2026-08-18 Master確認） | 差 |
|---|---|---|---|
| books | 4冊 | **5冊** | +1 |
| child_states | 14語 | 14語 | 一致 |
| book_state_links (pre) | 16件 | **8件** | **−8** |
| event_tags つき | 0冊 | 0冊 | 一致 |
| seasonal_tags つき | 3冊 | **2冊** | −1 |

**`book_state_links(pre)` が seed の半分しかない。** 「子どもの姿から探す」はこの表だけを見るため、
姿を選んでも絵本が出ない／少ないのは、検索ロジックではなく**この対応データの不足**が原因。

→ 大量投入を始める前に、`supabase/migrations/` を実DBの正本に戻すか、
実DBを正とするかを決める必要がある（決めないと、今後の投入で何が正しいか判断できなくなる）。

---

## 1. books テーブルの全カラムと役割

| カラム | 型 | 役割 | 出所 |
|---|---|---|---|
| `id` | uuid | 主キー | 自動 |
| `title` | text **not null** | 書名。**唯一の必須項目** | 自動取得 |
| `author` | text | 作 | 自動取得 |
| `illustrator` | text | 絵 | 自動取得 |
| `publisher` | text | 出版社 | 自動取得 |
| `isbn` | text | **重複判定の鍵**（UNIQUE制約は無い） | 自動取得 |
| `age_min` / `age_max` | int(0〜6) | 年齢での絞り込み。RPCが使う | 要判断 |
| `scenes` | text[] | 読む場面（朝の会・午睡前など）。RPCが使う | 要判断 |
| `seasonal_tags` | text[] | **季節検索の軸** | 要判断 |
| `event_tags` | text[] | **行事検索の軸** | 要判断 |
| `summary` | text | あらすじ。詳細画面に出る | 自動取得（要確認） |
| `care_points` | text | 読み聞かせのヒント | **人の判断** |
| `next_activities` | text | 読後の活動例 | **人の判断** |
| `caution_notes` | text | **管理用**。利用者画面に出さない | 人の判断 |
| `is_active` | boolean | **公開フラグ。検索RPCが `= true` で絞る** | 運用 |
| `created_at` / `updated_at` | timestamptz | 自動 | 自動 |

**重要**：`is_active` は検索RPCがすでに見ている。つまり
**`is_active = false` で投入すれば、利用者に見えないまま下書きとして貯められる。**
このための新しいテーブルや列は要らない。

ただし `getBookById()`（絵本の再取得）は `is_active` を見ていない。
下書きの絵本が詳細画面に出うるので、投入を始める前に揃えること。

---

## 2〜4. 実データの中身（Masterに実行をお願いするSELECT）

数値は分かったが中身は未確認。以下はすべて **SELECTのみ**。

```sql
-- 2. 現在5冊に入っているデータ
select id, title, author, publisher, isbn, age_min, age_max,
       scenes, seasonal_tags, event_tags,
       (summary is not null)         as あらすじ有,
       (care_points is not null)     as ヒント有,
       (next_activities is not null) as 活動例有,
       is_active
from public.books order by created_at;

-- 3. タグの現状
select title, seasonal_tags, event_tags from public.books
where cardinality(seasonal_tags) > 0 or cardinality(event_tags) > 0;

-- 4. book_state_links の8件の中身
select b.title, cs.name as 子どもの姿, l.relation, l.note
from public.book_state_links l
join public.books b on b.id = l.book_id
join public.child_states cs on cs.id = l.state_id
order by b.title, l.relation;

-- 参考：どの「子どもの姿」が1冊も返さないか（＝検索して空になる語）
select cs.name
from public.child_states cs
where cs.is_active
  and not exists (select 1 from public.book_state_links l
                  where l.state_id = cs.id and l.relation = 'pre')
order by cs.sort_order;
```

---

## 5. 数百〜数千冊でも破綻しない投入形式

### 6段階のパイプライン

```
① 取得      公開APIから機械的に集める（スクレイピングではなくAPIを使う）
   ↓
② 正規化    ISBN-13へ統一・表記ゆれの吸収・不要な絵本の除外
   ↓
③ 重複確認  既存DBと突き合わせ、新規／更新／スキップに仕分け
   ↓
④ 付与      年齢・季節・行事・子どもの姿の候補を付ける（AIは下書きまで）
   ↓
⑤ 検証      人が確認。ここを通らないものは公開しない
   ↓
⑥ 投入      is_active=false で投入 → 確認後に true で公開
```

### 取得元（スクレイピングしない）

| 取得元 | 内容 | 備考 |
|---|---|---|
| **openBD** | 書名・著者・出版社・ISBN・書影・内容紹介 | 日本の書籍向け。無料・APIあり。**第一候補** |
| **国立国会図書館サーチ** | 書誌情報 | APIあり。openBDに無い古い絵本を補える |

一般のWebサイトから本文や解説文をコピーして取り込まないこと（著作権・利用規約の問題になる）。
書誌情報（書名・著者・出版社・ISBN）は事実の集合なので扱いやすいが、
**内容紹介文はそのまま転載せず、出所を確認して使う**。

### ファイル形式

1バッチ＝1ファイル。`JSONL`（1行1冊）を推奨。差分が見やすく、途中で失敗しても再開できる。

```jsonl
{"isbn":"9784834000825","title":"ぐりとぐら","author":"なかがわりえこ","publisher":"福音館書店","source":"openbd","fetched_at":"2026-08-18"}
```

置き場所の案：`supabase/book_data/YYYYMMDD_batch01.jsonl`（Gitで履歴を残す）

投入は **ISBNをキーにしたupsert**。同じファイルを2回流しても二重登録にならないようにする。

---

## 6. 1冊追加するときに最低限必要な項目

| 段階 | 必要な項目 | 無いとどうなるか |
|---|---|---|
| **DBに入れるだけ** | `title` のみ | 入るが、どの検索にも出てこない |
| **重複を防ぐ** | ＋ `isbn` | 同じ絵本が何度も登録される |
| **絵本として見せる** | ＋ `author` / `publisher` / `summary` | 詳細画面が空になる |
| **年齢で絞れる** | ＋ `age_min` / `age_max` | 年齢フィルタから漏れる |
| **子どもの姿から探せる** | ＋ **`book_state_links` に `pre` を1件以上** | **永久に検索結果に出ない** |
| **季節から探せる** | ＋ `seasonal_tags` | 季節検索に出ない |
| **行事から探せる** | ＋ `event_tags` | 行事検索に出ない |

**最重要**：`book_state_links(pre)` が1件も無い絵本は、
どれだけ書誌情報が揃っていても「子どもの姿から探す」には**絶対に出てこない**。
冊数だけ増やしても検索結果は増えない。

---

## 7. 自動取得できる項目／人・AIの判断が要る項目

| 区分 | 項目 | 方法 |
|---|---|---|
| **自動取得できる** | title / author / illustrator / publisher / isbn | openBD・NDLサーチ |
| **自動だが要確認** | summary | APIの内容紹介は宣伝文のことがある。保育向けに書き直す判断が要る |
| **機械で候補は出せる** | age_min / age_max | 出版社の対象年齢は表記がばらつく。候補を出して人が確認 |
| **AIが下書き→人が確認** | scenes / seasonal_tags / event_tags | 明らかなもの（クリスマスの絵本→`クリスマス`）は精度が出る |
| **人の判断が必須** | care_points / next_activities | 保育の専門的判断。憲章「AIは保育士の判断を置き換えない」に直結 |
| **人の判断が必須** | `book_state_links`（子どもの姿との対応） | **このアプリの中核**。ここを機械任せにすると価値が崩れる |
| **人の判断が必須** | caution_notes | 配慮が要る内容の記録 |

AIを使う場合も、`docs/product-charter.md` のとおり **AIは下書き、確定は人**。
利用者画面に「AI生成」等の管理側の言葉は出さない。

---

## 8. タグ・関連をどの段階で付けるか

**「全部揃うまで公開しない」にはしない。** 検索に載る最低条件を満たしたら公開する。

| 段階 | やること | is_active |
|---|---|---|
| 第1段階 | 書誌情報だけ投入（title/author/publisher/isbn/summary） | `false` |
| 第2段階 | 年齢・季節・行事の候補を付ける（AI下書き＋人の確認） | `false` |
| 第3段階 | **子どもの姿との対応を付ける**（人。1冊あたり1〜3件） | `false` |
| 第4段階 | 確認が済んだものから公開 | **`true`** |

第3段階が一番手間がかかる。ここを効率よく進めるため、
**「子どもの姿」ごとに絵本を集める**進め方（1冊ずつ全項目を埋めるのではなく、
「貸し借りが難しい」に合う絵本を10冊選ぶ）を推奨する。
現在 `pre` が0件の子どもの姿から埋めると、検索の空振りが直接減る。

---

## 9. 重複登録を防ぐ方法

1. **第一キーは ISBN。** ただし ISBN-10 と ISBN-13 が混在するため、**ISBN-13に正規化**して保存する
2. **ISBNが無い絵本**（古い本・非流通）は、`正規化タイトル + 著者 + 出版社` の組み合わせキーで判定する
   - 正規化＝`NFKC` → 空白除去 → 記号除去 →（必要なら）旧字体の統一
3. **投入前に必ず突き合わせる。** 新規／更新／スキップの3つに仕分けてから流す
4. 同じ絵本の**別の版**（改訂版・大型版）は別ISBN。**別レコードにするか統合するかを先に決める**
   （推奨：別レコードにし、利用者には代表1件を見せる）

### 現状の弱点

`isbn` 列はあるが **UNIQUE制約もインデックスも無い**。
今はアプリ側で防ぐしかないため、投入スクリプトで必ずチェックすること。
将来的には次の追加が有効（**今は実行しない**）。

```sql
-- 将来の案（未実行）
create unique index if not exists uq_books_isbn
  on public.books (isbn) where isbn is not null;
create index if not exists idx_books_event_tags    on public.books using gin (event_tags);
create index if not exists idx_books_seasonal_tags on public.books using gin (seasonal_tags);
```

---

## 10. 今のDB構造のまま大量追加できるか

**できる。構造の変更なしで数百〜数千冊を投入できる。**
`books` は必要な列をすでに持ち、`is_active` で下書き運用もできる。

ただし、冊数を増やす**前に**直すべき問題が1つある。

### 🔴 冊数を増やすと壊れるところ：記録保存の絵本特定

`src/lib/dataAdapter.js` の `savePracticeLog()` は、`bookId` が無いとき
**書名の完全一致**で絵本を探している。

```js
const { data: bookData } = await supabase
  .from('books').select('id').eq('title', formData.title).maybeSingle()
bookId = bookData?.id ?? null
```

**同じ書名の絵本が2冊以上あるときの実際の挙動**（postgrest-js の実装を確認済み）：

1. `maybeSingle()` は2件以上のとき `data = null` / `error = PGRST116` を返す（例外は投げない）
2. 上のコードは **`error` を受け取っていない**ため、エラーは捨てられる
3. `bookId` が null のままになり、次の分岐で
   **「この絵本はまだデータベースに登録されていません」** というエラーになる

つまり、**技術的なエラー画面ではなく「登録されていない」という誤った案内**が出て、
記録が保存できなくなる。登録されているのに登録されていないと言われるため、
利用者からは原因が分からない。エラーも握りつぶされるのでログにも残らない。

版違い・改訂版で同名が生じるのは普通のことなので、**冊数を増やせば必ず起きる**。
冊数を増やす前に、`isbn` や `book_id` で特定する形に直しておくこと。

### そのほか、投入前に整えておきたい点

| # | 内容 | 影響 |
|---|---|---|
| 1 | `getBookById()` が `is_active` を見ていない | 下書きの絵本が詳細画面に出うる |
| 2 | `event_tags` / `seasonal_tags` が自由な text[] | 表記ゆれで完全一致検索が空振りする。canonical名だけを入れる運用で防ぐ |
| 3 | `isbn` に UNIQUE が無い | 二重登録をDBが止めてくれない |
| 4 | 実DBとmigrationファイルの不一致（0章） | 何が正しい状態か判断できなくなる |

### 投入時の権限

`books` の書き込みは `books_admin_write`（`is_admin()`）に限られている。
一括投入は **Supabaseのservice_roleキー**を使うか、SQL Editorから実行する。
**anonキーでは投入できない**（これは正しい設計なので変えない）。

---

## まとめ：最短で安全に増やす順序

1. **実DBとmigrationファイルのずれを解消**（どちらを正とするか決める）
2. **`savePracticeLog` の書名一致問題を直す**（冊数を増やす前に）
3. openBDから **50冊程度**を試験的に取得 → 正規化 → `is_active=false` で投入
4. そのうち **10冊**に子どもの姿の対応を付けて公開し、検索の手応えを確認
5. 問題がなければ規模を拡大
6. 十分な件数になってから **event_tags検索を実装**し、マイページの「絵本を準備する」に接続

いきなり数千冊を入れない。50冊で流れ全体を通してから広げる。
