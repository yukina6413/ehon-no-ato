// ============================================================
// 作品カタログの正規化ユーティリティ
// ============================================================
// 外部の書誌情報も、利用者の手入力も、いったんこの形にそろえてから扱う。
// ここはDBにも画面にも依存しない純粋な関数だけにする（取得元を差し替えても壊れないため）。
// ============================================================

// ──── 作品の種別 ────
// 「絵本」と「紙芝居」は付属関係ではなく、対等な作品種別として扱う。
export const MATERIAL_TYPES = {
  PICTURE_BOOK: 'picture_book',
  KAMISHIBAI:   'kamishibai',
}

export const MATERIAL_TYPE_LABELS = {
  [MATERIAL_TYPES.PICTURE_BOOK]: '絵本',
  [MATERIAL_TYPES.KAMISHIBAI]:   '紙芝居',
}

export function isMaterialType(value) {
  return Object.values(MATERIAL_TYPES).includes(value)
}

export function materialTypeLabel(value) {
  return MATERIAL_TYPE_LABELS[value] ?? MATERIAL_TYPE_LABELS[MATERIAL_TYPES.PICTURE_BOOK]
}

// ──── ISBN ────
// ISBNは「あれば強い手がかり」。無い作品（古い紙芝居・自費出版など）も登録できるため、
// 必須にはしない。あるときだけ ISBN-13 にそろえて重複判定に使う。

function digitsOf(value) {
  return String(value ?? '').replace(/[\s-‐-―ー]/g, '').toUpperCase()
}

function isbn13CheckDigit(first12) {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return String((10 - (sum % 10)) % 10)
}

function isValidIsbn10(s) {
  if (!/^\d{9}[\dX]$/.test(s)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(s[i]) * (10 - i)
  sum += s[9] === 'X' ? 10 : Number(s[9])
  return sum % 11 === 0
}

/**
 * ISBNを13桁へそろえる。ハイフン・空白は除去する。
 * 正しくないISBNは null を返す（誤った値で重複判定しないため）。
 */
export function normalizeIsbn(input) {
  const s = digitsOf(input)
  if (!s) return null

  if (/^\d{13}$/.test(s)) {
    return isbn13CheckDigit(s.slice(0, 12)) === s[12] ? s : null
  }
  if (isValidIsbn10(s)) {
    const first12 = `978${s.slice(0, 9)}`
    return first12 + isbn13CheckDigit(first12)
  }
  return null
}

// ──── タイトル・著者の正規化 ────
// 重複候補をさがすためだけに使う内部表現。画面表示には使わない。
export function normalizeTitleKey(input) {
  return String(input ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s/g, '')   // NFKCで全角スペースは半角になっているのでこれで足りる
    .replace(/[・･、。，．,.!！?？「」『』（）()【】\-‐-―ー~〜:：;；]/g, '')
}

export function normalizePersonKey(input) {
  // 「なかがわ りえこ」「中川 李枝子／作」などの揺れを吸収する
  return normalizeTitleKey(
    String(input ?? '').replace(/[／/]?\s*(作|絵|文|著|訳|脚本|画|編)\s*$/g, '')
  )
}

/**
 * 作品カタログの共通形式。外部書誌・アプリ内DB・手入力のすべてをこの形にそろえる。
 * 取得元を差し替えても、これより先の処理は変えなくてよい。
 */
export function toCatalogWork(input = {}) {
  const materialType = isMaterialType(input.materialType)
    ? input.materialType
    : MATERIAL_TYPES.PICTURE_BOOK
  return {
    source:        input.source ?? 'manual',   // 'local' | 外部プロバイダID | 'manual'
    sourceId:      input.sourceId ?? null,     // 取得元での識別子（再取得・更新用）
    id:            input.id ?? null,           // アプリ内DBのUUID。未登録なら null
    title:         String(input.title ?? '').trim(),
    author:        String(input.author ?? '').trim(),
    illustrator:   String(input.illustrator ?? '').trim(),
    publisher:     String(input.publisher ?? '').trim(),
    isbn13:        normalizeIsbn(input.isbn ?? input.isbn13),
    publishedYear: Number.isInteger(input.publishedYear) ? input.publishedYear : null,
    materialType,
    ageMin:        Number.isInteger(input.ageMin) ? input.ageMin : null,
    ageMax:        Number.isInteger(input.ageMax) ? input.ageMax : null,
    summary:       String(input.summary ?? '').trim(),
  }
}

/**
 * 登録済みかどうかを判定するための鍵。
 * ISBNがあればそれが最優先。無ければ「種別＋タイトル＋著者＋出版社」で見る。
 */
export function dedupeKey(work) {
  if (work?.isbn13) return `isbn:${work.isbn13}`
  return [
    'meta',
    work?.materialType ?? MATERIAL_TYPES.PICTURE_BOOK,
    normalizeTitleKey(work?.title),
    normalizePersonKey(work?.author),
    normalizeTitleKey(work?.publisher),
  ].join(':')
}

/**
 * 既存作品の中から「同じ作品かもしれない」候補を探す。
 * 自動で同一と断定しない。判断は人に返す。
 *   'same'     … ISBNが一致（ほぼ確実）
 *   'possible' … 書誌が近い（人の確認が必要）
 */
export function findDuplicateCandidates(work, existingWorks = []) {
  const target = toCatalogWork(work)
  const titleKey  = normalizeTitleKey(target.title)
  const authorKey = normalizePersonKey(target.author)
  if (!titleKey) return []

  const out = []
  for (const raw of existingWorks) {
    const other = toCatalogWork(raw)

    if (target.isbn13 && other.isbn13) {
      if (target.isbn13 === other.isbn13) out.push({ work: other, match: 'same', reason: 'ISBNが一致' })
      // ISBNが両方あって異なるなら、版違いの別作品として扱う（候補にしない）
      continue
    }

    if (normalizeTitleKey(other.title) !== titleKey) continue
    if (other.materialType !== target.materialType) continue

    const otherAuthor = normalizePersonKey(other.author)
    const reason = authorKey && otherAuthor && authorKey === otherAuthor
      ? 'タイトルと著者が一致'
      : 'タイトルが一致'
    out.push({ work: other, match: 'possible', reason })
  }
  return out
}

// ──── 作品種別の自動判定 ────
// 「絵本」と「紙芝居」は、書誌情報だけでは見分けられないことが多い。
// 確実に紙芝居と分かるときだけ判定し、分からないときは null を返して
// 利用者に選んでもらう（推測で決めない。種別は重複判定の鍵にもなるため）。
const KAMISHIBAI_PATTERN = /紙芝居|紙しばい|かみしばい|カミシバイ/

/**
 * 書名・シリーズ名などから紙芝居かどうかを判定する。
 * 返り値： 'kamishibai' … 紙芝居と分かった
 *          null         … 判定できない（利用者に選んでもらう）
 */
export function detectMaterialType(...texts) {
  const joined = texts.filter(Boolean).map(String).join(' ').normalize('NFKC')
  return KAMISHIBAI_PATTERN.test(joined) ? MATERIAL_TYPES.KAMISHIBAI : null
}
