import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  searchWorks, buildDraftWork, registerCatalogProvider,
  unregisterCatalogProvider, listCatalogProviders,
} from './catalogService'
import { MATERIAL_TYPES } from './normalize'

// 検索UIが「どこから作品を取ってくるか」を知らなくて済む分離を守るテスト。
// 外部書誌の仕様が変わっても、差し替えるのはプロバイダ1つで済むこと。

vi.mock('../dataAdapter', () => ({
  searchBooksByKeyword: vi.fn(),
}))

const { searchBooksByKeyword } = await import('../dataAdapter')

const UUID = '22222222-0000-0000-0000-000000000002'

beforeEach(() => {
  searchBooksByKeyword.mockReset()
  searchBooksByKeyword.mockResolvedValue([])
})

afterEach(() => {
  for (const p of listCatalogProviders()) unregisterCatalogProvider(p.id)
})

describe('searchWorks：アプリ内DB', () => {
  it('アプリ内DBの結果を共通形式で返す', async () => {
    searchBooksByKeyword.mockResolvedValue([
      { id: UUID, title: 'ぐりとぐら', author: 'なかがわりえこ', publisher: '福音館書店', synopsis: 'あらすじ' },
    ])
    const { local, external } = await searchWorks('ぐり')

    expect(local).toHaveLength(1)
    expect(local[0].source).toBe('local')
    expect(local[0].id).toBe(UUID)                                  // 記録に使えるID
    expect(local[0].materialType).toBe(MATERIAL_TYPES.PICTURE_BOOK) // 列が入るまでは絵本
    expect(external).toEqual([])
  })

  it('空の検索語では問い合わせない', async () => {
    const r = await searchWorks('   ')
    expect(r).toEqual({ local: [], external: [], errors: [] })
    expect(searchBooksByKeyword).not.toHaveBeenCalled()
  })

  it('外部を明示的に有効にしない限り、外部は呼ばない', async () => {
    const search = vi.fn().mockResolvedValue([{ title: '外部の絵本' }])
    registerCatalogProvider({ id: 'testA', label: 'テストA', search })
    await searchWorks('ぐり')
    expect(search).not.toHaveBeenCalled()
  })
})

describe('searchWorks：外部書誌プロバイダ', () => {
  it('登録したプロバイダの結果を共通形式で返す', async () => {
    registerCatalogProvider({
      id: 'testA', label: 'テストA',
      search: async () => [{ title: '新刊の絵本', author: '作者', isbn: '978-4-8340-0082-5' }],
    })
    const { external } = await searchWorks('新刊', { includeExternal: true })

    expect(external).toHaveLength(1)
    expect(external[0].source).toBe('testA')
    expect(external[0].isbn13).toBe('9784834000825')   // 正規化されている
    expect(external[0].id).toBeNull()                  // まだアプリ内DBに無い
  })

  it('★ アプリ内DBに既にある作品は、外部から重ねて出さない', async () => {
    searchBooksByKeyword.mockResolvedValue([
      { id: UUID, title: 'ぐりとぐら', author: 'なかがわりえこ', publisher: '福音館書店' },
    ])
    registerCatalogProvider({
      id: 'testA',
      search: async () => [{ title: 'ぐりとぐら', author: 'なかがわりえこ', publisher: '福音館書店' }],
    })
    const { local, external } = await searchWorks('ぐり', { includeExternal: true })

    expect(local).toHaveLength(1)
    expect(external).toHaveLength(0)
  })

  it('★ 外部が失敗してもアプリ内の結果は返す（記録を止めない）', async () => {
    searchBooksByKeyword.mockResolvedValue([{ id: UUID, title: 'ぐりとぐら' }])
    registerCatalogProvider({ id: 'ng', search: async () => { throw new Error('接続できません') } })

    const { local, external, errors } = await searchWorks('ぐり', { includeExternal: true })
    expect(local).toHaveLength(1)
    expect(external).toEqual([])
    expect(errors).toHaveLength(1)
  })

  it('★ プロバイダは後から差し替えできる（1サービスに依存しない）', async () => {
    registerCatalogProvider({ id: 'A', label: 'A社', search: async () => [{ title: 'Aの本' }] })
    registerCatalogProvider({ id: 'B', label: 'B社', search: async () => [{ title: 'Bの本' }] })
    expect(listCatalogProviders().map(p => p.id).sort()).toEqual(['A', 'B'])

    unregisterCatalogProvider('A')
    const { external } = await searchWorks('本', { includeExternal: true })
    expect(external.map(w => w.title)).toEqual(['Bの本'])
  })

  it('形式が不正なプロバイダは登録できない', () => {
    expect(() => registerCatalogProvider({ label: 'idなし' })).toThrow()
    expect(() => registerCatalogProvider({ id: 'x' })).toThrow()
  })
})

describe('buildDraftWork：未登録作品の仮登録', () => {
  it('★ タイトルと種別だけで作れる（大量入力を求めない）', () => {
    const { work, isValid } = buildDraftWork({
      title: '園にある古い紙芝居', materialType: MATERIAL_TYPES.KAMISHIBAI,
    })
    expect(isValid).toBe(true)
    expect(work.title).toBe('園にある古い紙芝居')
    expect(work.materialType).toBe(MATERIAL_TYPES.KAMISHIBAI)
    expect(work.isbn13).toBeNull()       // ISBNが無くても登録できる
    expect(work.source).toBe('manual')
  })

  it('分かる範囲で著者・出版社・ISBNも入れられる', () => {
    const { work } = buildDraftWork({
      title: '新刊', author: '作者', publisher: '出版社', isbn: '9784834000825',
    })
    expect(work.author).toBe('作者')
    expect(work.isbn13).toBe('9784834000825')
  })

  it('タイトルが無いときだけ止める', () => {
    const { isValid, problems } = buildDraftWork({ title: '   ' })
    expect(isValid).toBe(false)
    expect(problems[0]).toMatch(/タイトル/)
  })

  it('種別を省略したら絵本にする', () => {
    expect(buildDraftWork({ title: 'あ' }).work.materialType).toBe(MATERIAL_TYPES.PICTURE_BOOK)
  })
})
