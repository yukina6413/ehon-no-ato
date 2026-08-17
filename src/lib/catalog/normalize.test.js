import { describe, it, expect } from 'vitest'
import {
  MATERIAL_TYPES, materialTypeLabel, isMaterialType,
  normalizeIsbn, normalizeTitleKey, normalizePersonKey,
  toCatalogWork, dedupeKey, findDuplicateCandidates,
} from './normalize'

// 数千冊の作品カタログを扱う土台。
// ・ISBNは「あれば強い手がかり」。無くても登録できる
// ・同じ作品を自動で断定しない（版違いを潰さない）

describe('作品種別（絵本 / 紙芝居）', () => {
  it('絵本と紙芝居を対等な種別として扱う', () => {
    expect(materialTypeLabel(MATERIAL_TYPES.PICTURE_BOOK)).toBe('絵本')
    expect(materialTypeLabel(MATERIAL_TYPES.KAMISHIBAI)).toBe('紙芝居')
  })

  it('未知の値は絵本として扱う（既存5冊はすべて絵本）', () => {
    expect(materialTypeLabel('unknown')).toBe('絵本')
    expect(materialTypeLabel(undefined)).toBe('絵本')
    expect(isMaterialType('kamishibai')).toBe(true)
    expect(isMaterialType('dvd')).toBe(false)
  })
})

describe('normalizeIsbn（ISBN-13へそろえる）', () => {
  it('ハイフン・空白を除いて13桁にする', () => {
    expect(normalizeIsbn('978-4-8340-0082-5')).toBe('9784834000825')
    expect(normalizeIsbn('978 4 8340 0082 5')).toBe('9784834000825')
  })

  it('ISBN-10をISBN-13に変換する', () => {
    expect(normalizeIsbn('4834000826')).toBe('9784834000825')
    expect(normalizeIsbn('4-8340-0082-6')).toBe('9784834000825')
  })

  it('末尾がXのISBN-10も扱える', () => {
    expect(normalizeIsbn('080442957X')).toBe('9780804429573')
  })

  it('★ 誤ったISBNはnullにする（間違った値で重複判定しない）', () => {
    expect(normalizeIsbn('9784834000824')).toBeNull()   // チェックディジット違い
    expect(normalizeIsbn('1234567890')).toBeNull()
    expect(normalizeIsbn('12345')).toBeNull()
    expect(normalizeIsbn('abcdefghij')).toBeNull()
  })

  it('★ ISBNが無くてもエラーにしない（古い紙芝居などのため）', () => {
    expect(normalizeIsbn('')).toBeNull()
    expect(normalizeIsbn(null)).toBeNull()
    expect(normalizeIsbn(undefined)).toBeNull()
  })
})

describe('タイトル・著者の正規化', () => {
  it('全角半角・空白・記号の揺れを吸収する', () => {
    expect(normalizeTitleKey('ぐりとぐら')).toBe(normalizeTitleKey('ぐり と ぐら'))
    expect(normalizeTitleKey('ＡＢＣ')).toBe(normalizeTitleKey('abc'))
    expect(normalizeTitleKey('てぶくろ（大型版）')).toBe('てぶくろ大型版')
  })

  it('著者の「作」「絵」などの肩書きを取り除く', () => {
    expect(normalizePersonKey('なかがわ りえこ／作')).toBe(normalizePersonKey('なかがわりえこ'))
    expect(normalizePersonKey('中川李枝子 作')).toBe(normalizePersonKey('中川李枝子'))
  })
})

describe('toCatalogWork（共通形式へそろえる）', () => {
  it('外部・手入力・DBのどれでも同じ形になる', () => {
    const w = toCatalogWork({
      source: 'openbd', sourceId: 'x1', title: ' ぐりとぐら ',
      author: 'なかがわりえこ', isbn: '978-4-8340-0082-5', materialType: 'kamishibai',
    })
    expect(w.title).toBe('ぐりとぐら')
    expect(w.isbn13).toBe('9784834000825')
    expect(w.materialType).toBe('kamishibai')
    expect(w.id).toBeNull()          // アプリ内DB未登録
  })

  it('種別の指定が無ければ絵本にする', () => {
    expect(toCatalogWork({ title: 'あ' }).materialType).toBe(MATERIAL_TYPES.PICTURE_BOOK)
  })

  it('最低限タイトルだけでも作れる（未登録作品の仮登録のため）', () => {
    const w = toCatalogWork({ title: '園にある古い紙芝居', materialType: 'kamishibai' })
    expect(w.title).toBe('園にある古い紙芝居')
    expect(w.isbn13).toBeNull()
  })
})

describe('dedupeKey（重複判定の鍵）', () => {
  it('ISBNがあればISBNを鍵にする', () => {
    const a = toCatalogWork({ title: 'ぐりとぐら', isbn: '9784834000825' })
    const b = toCatalogWork({ title: 'ぐり と ぐら', isbn: '978-4-8340-0082-5' })
    expect(dedupeKey(a)).toBe(dedupeKey(b))
  })

  it('ISBNが無ければ種別＋タイトル＋著者＋出版社で見る', () => {
    const a = toCatalogWork({ title: 'てぶくろ', author: 'ラチョフ', publisher: '福音館' })
    const b = toCatalogWork({ title: 'て ぶくろ', author: 'ラチョフ', publisher: '福音館' })
    expect(dedupeKey(a)).toBe(dedupeKey(b))
  })

  it('★ 同じタイトルでも絵本と紙芝居は別作品として扱う', () => {
    const book = toCatalogWork({ title: 'おおきなかぶ', materialType: 'picture_book' })
    const kami = toCatalogWork({ title: 'おおきなかぶ', materialType: 'kamishibai' })
    expect(dedupeKey(book)).not.toBe(dedupeKey(kami))
  })
})

describe('findDuplicateCandidates（自動で同一と断定しない）', () => {
  const existing = [
    toCatalogWork({ id: 'u1', title: 'ぐりとぐら', author: 'なかがわりえこ', publisher: '福音館書店', isbn: '9784834000825' }),
    toCatalogWork({ id: 'u2', title: 'てぶくろ',   author: 'ラチョフ',       publisher: '福音館書店' }),
  ]

  it('ISBNが一致すれば「同じ作品」として返す', () => {
    const found = findDuplicateCandidates({ title: 'ぐりとぐら', isbn: '978-4-8340-0082-5' }, existing)
    expect(found).toHaveLength(1)
    expect(found[0].match).toBe('same')
    expect(found[0].work.id).toBe('u1')
  })

  it('★ ISBNが両方あって異なるなら、版違いの別作品として候補にしない', () => {
    const found = findDuplicateCandidates(
      { title: 'ぐりとぐら', isbn: '9784001140545' }, existing)
    expect(found).toEqual([])
  })

  it('ISBNが無いときはタイトル一致を「可能性あり」として人に返す', () => {
    const found = findDuplicateCandidates({ title: 'てぶくろ', author: 'ラチョフ' }, existing)
    expect(found).toHaveLength(1)
    expect(found[0].match).toBe('possible')       // 断定しない
    expect(found[0].reason).toBe('タイトルと著者が一致')
  })

  it('著者が違えば「タイトルが一致」とだけ伝える', () => {
    const found = findDuplicateCandidates({ title: 'てぶくろ', author: 'べつの人' }, existing)
    expect(found[0].reason).toBe('タイトルが一致')
  })

  it('★ 同じタイトルの紙芝居は、絵本の重複候補にしない', () => {
    const found = findDuplicateCandidates(
      { title: 'てぶくろ', materialType: 'kamishibai' }, existing)
    expect(found).toEqual([])
  })

  it('タイトルが無いときは候補を出さない', () => {
    expect(findDuplicateCandidates({ title: '' }, existing)).toEqual([])
  })

  it('既存が空でも落ちない', () => {
    expect(findDuplicateCandidates({ title: 'あ' }, [])).toEqual([])
    expect(findDuplicateCandidates({ title: 'あ' })).toEqual([])
  })
})
