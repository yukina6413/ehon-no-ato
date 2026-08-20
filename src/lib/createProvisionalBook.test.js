import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createProvisionalBook, getBookById, isDatabaseBook } from './dataAdapter'

// 「検索 → 見つからない → 追加 → そのまま記録」の流れを支えるデータ層のテスト。
// ここが守るのは次の3点。
//   ① 追加した作品は、その場ですぐ記録に使える book_id を返す
//   ② 同じ作品を二重に登録しない（ISBN一致＝existing／書名一致＝candidates）
//   ③ books へ直接INSERTせず、create_provisional_book RPC だけを呼ぶ

function memStorage() {
  let store = {}
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: k => { delete store[k] },
    clear: () => { store = {} },
  }
}

beforeEach(() => {
  globalThis.localStorage = memStorage()
})

const PICTURE_BOOK = { title: 'あたらしい絵本', materialType: 'picture_book' }

describe('createProvisionalBook（mockモード）', () => {
  it('★ 未登録の作品を追加すると、記録に使えるIDが返る', async () => {
    const r = await createProvisionalBook(PICTURE_BOOK)
    expect(r.status).toBe('created')
    expect(isDatabaseBook({ id: r.bookId })).toBe(true)   // 実DBと同じUUID形式
  })

  it('★ 追加した作品は、その場で記録画面から引き直せる（管理者の確認を待たない）', async () => {
    const { bookId } = await createProvisionalBook({
      title: 'おおきなかぶの紙芝居', materialType: 'kamishibai', author: '内田莉莎子',
    })
    const book = await getBookById(bookId)
    expect(book.title).toBe('おおきなかぶの紙芝居')
    expect(book.material_type).toBe('kamishibai')
  })

  it('★ 同じ書名をもう一度追加しようとしても、重複を作らず候補を返す', async () => {
    const first = await createProvisionalBook(PICTURE_BOOK)
    const again = await createProvisionalBook(PICTURE_BOOK)

    expect(again.status).toBe('candidates')
    expect(again.bookId).toBeNull()
    expect(again.candidates.map(c => c.id)).toContain(first.bookId)
  })

  it('候補を見たうえで「どれでもない」を選んだときだけ、新しく作る', async () => {
    const first = await createProvisionalBook(PICTURE_BOOK)
    const forced = await createProvisionalBook(PICTURE_BOOK, { forceNew: true })

    expect(forced.status).toBe('created')
    expect(forced.bookId).not.toBe(first.bookId)
  })

  it('★ ISBNが一致する作品が既にあれば、そのIDを使う（作らない）', async () => {
    const first = await createProvisionalBook({
      ...PICTURE_BOOK, isbn: '978-4-8340-0082-5',
    })
    const again = await createProvisionalBook({
      title: '書名の表記がちがう絵本', materialType: 'picture_book', isbn: '9784834000825',
    })
    expect(again.status).toBe('existing')
    expect(again.bookId).toBe(first.bookId)
  })

  it('絵本と紙芝居は別の作品として扱う（同じ書名でも重複にしない）', async () => {
    const book = await createProvisionalBook({ title: 'てぶくろ', materialType: 'picture_book' })
    const kami = await createProvisionalBook({ title: 'てぶくろ', materialType: 'kamishibai' })
    expect(kami.status).toBe('created')
    expect(kami.bookId).not.toBe(book.bookId)
  })

  it('タイトルが無いときは止める', async () => {
    await expect(createProvisionalBook({ title: '   ', materialType: 'picture_book' }))
      .rejects.toThrow('タイトル')
  })

  it('★ 種別が選ばれていないときは、絵本と決めつけずに止める', async () => {
    await expect(createProvisionalBook({ title: 'なにかの作品' }))
      .rejects.toThrow('絵本／紙芝居')
  })
})

// ──────────────────────────────────────────────
// supabaseモード：books へ直接書かず、RPCだけを使うこと
// ──────────────────────────────────────────────
describe('createProvisionalBook（supabaseモード）', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_DATA_SOURCE', 'supabase')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function withSupabaseMock({ data = null, error = null } = {}) {
    const calls = { rpc: [], from: [] }
    vi.doMock('./supabase', () => ({
      isMissingConfig: false,
      supabase: {
        from: (t) => { calls.from.push(t); throw new Error('booksへ直接アクセスしてはいけない') },
        rpc: async (name, args) => { calls.rpc.push({ name, args }); return { data, error } },
      },
    }))
    const mod = await import('./dataAdapter')
    return { mod, calls }
  }

  it('★ booksへ直接INSERTせず、create_provisional_book RPC を呼ぶ', async () => {
    const { mod, calls } = await withSupabaseMock({
      data: [{ book_id: '11111111-1111-1111-1111-111111111111', status: 'created', candidates: [] }],
    })
    const r = await mod.createProvisionalBook({
      title: ' ぐりとぐら ', materialType: 'kamishibai',
      author: 'なかがわりえこ', isbn: '978-4-8340-0082-5', publishedYear: 1967,
    })

    expect(calls.from).toEqual([])                       // booksテーブルには触れていない
    expect(calls.rpc[0].name).toBe('create_provisional_book')
    expect(calls.rpc[0].args).toMatchObject({
      p_title: 'ぐりとぐら',                              // 前後の空白は落とす
      p_material_type: 'kamishibai',
      p_isbn: '9784834000825',                           // ISBN-13へそろえてから渡す
      p_published_year: 1967,
      p_force_new: false,
    })
    expect(r).toEqual({
      status: 'created', bookId: '11111111-1111-1111-1111-111111111111', candidates: [],
    })
  })

  it('候補が返ったときは、その候補をそのまま画面へ渡す', async () => {
    const candidates = [{ id: '22222222-2222-2222-2222-222222222222', title: 'ぐりとぐら' }]
    const { mod } = await withSupabaseMock({
      data: [{ book_id: null, status: 'candidates', candidates }],
    })
    const r = await mod.createProvisionalBook({ title: 'ぐりとぐら', materialType: 'picture_book' })
    expect(r.status).toBe('candidates')
    expect(r.candidates).toEqual(candidates)
  })

  it('RPCが利用者向けに返した理由は、そのまま伝える（1日の上限など）', async () => {
    const { mod } = await withSupabaseMock({
      error: { code: '54000', message: '1日に追加できる作品数の上限に達しました。時間をおいてお試しください' },
    })
    await expect(mod.createProvisionalBook({ title: 'あ', materialType: 'picture_book' }))
      .rejects.toThrow('上限に達しました')
  })

  it('★ 想定外のエラーは、内部の文言を見せずに案内へ言い換える', async () => {
    const { mod } = await withSupabaseMock({
      error: { code: '42501', message: 'permission denied for table books' },
    })
    await expect(mod.createProvisionalBook({ title: 'あ', materialType: 'picture_book' }))
      .rejects.toThrow('作品を追加できませんでした')
  })
})
