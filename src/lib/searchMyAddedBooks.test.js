import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchBooksByKeyword, createProvisionalBook, isDatabaseBook } from './dataAdapter'

// 「自分で追加した作品を、翌日も通常の検索から選んで記録できる」ことを守るテスト。
//
// is_active は「みんなに公開してよいか」の旗であって「本人が使ってよいか」ではない。
// 公開作品の検索条件(is_active=true)はそのままに、自分の追加分だけを足して見せる。
// 他の利用者の追加分は book_contributions のRLSが弾くため、構造上出てこない。

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

describe('検索結果（mockモード）', () => {
  it('① 公開作品は通常検索に出る（既存のふるまいを変えない）', async () => {
    const books = await searchBooksByKeyword('ぐりとぐら')
    expect(books.map(b => b.title)).toContain('ぐりとぐら')
    expect(books.every(b => !b.addedByMe)).toBe(true)
  })

  it('★ ② 自分が追加した作品も、あとから通常検索で見つかる', async () => {
    const { bookId } = await createProvisionalBook({
      title: 'きょうりゅうのバス', materialType: 'picture_book',
    })
    const books = await searchBooksByKeyword('きょうりゅう')

    const mine = books.find(b => b.id === bookId)
    expect(mine).toBeTruthy()
    expect(mine.addedByMe).toBe(true)          // 画面で「自分が追加した作品」に分けて出す目印
    expect(mine.title).toBe('きょうりゅうのバス')
  })

  it('★ ⑤ 自分が追加した作品も、記録画面へ渡せるIDを持つ', async () => {
    const { bookId } = await createProvisionalBook({
      title: 'おおきなかぶの紙芝居', materialType: 'kamishibai',
    })
    const [found] = await searchBooksByKeyword('おおきなかぶ')

    expect(found.id).toBe(bookId)
    expect(isDatabaseBook(found)).toBe(true)   // 詳細画面に記録ボタンが出る条件
  })

  it('著者名でも自分の追加分を見つけられる', async () => {
    await createProvisionalBook({
      title: 'なまえのないほん', materialType: 'picture_book', author: 'てすと作者',
    })
    expect((await searchBooksByKeyword('てすと作者')).map(b => b.title))
      .toContain('なまえのないほん')
  })

  it('関係ない言葉では出てこない', async () => {
    await createProvisionalBook({ title: 'きょうりゅうのバス', materialType: 'picture_book' })
    expect(await searchBooksByKeyword('まったく別の言葉')).toEqual([])
  })

  it('追加していなければ、これまでと同じ結果になる', async () => {
    expect(await searchBooksByKeyword('存在しない絵本')).toEqual([])
  })
})

// ──────────────────────────────────────────────
// supabaseモード：どこから取ってくるかの構造を固定する
// ──────────────────────────────────────────────
const UUID_A = '22222222-0000-0000-0000-000000000002'
const UUID_B = '33333333-0000-0000-0000-000000000003'

function makeSupabaseMock({ titleRows = [], authorRows = [], contributions = [], session = null } = {}) {
  const tables = []
  function builder(table) {
    const state = { table, filters: [] }
    const b = {
      select: () => b,
      eq:     (col, v) => { state.filters.push(['eq', col, v]); return b },
      ilike:  (col, v) => { state.filters.push(['ilike', col, v]); return b },
      order:  () => b,
      limit:  () => b,
      then: (resolve) => {
        tables.push(state)
        if (state.table === 'book_contributions') {
          return resolve({ data: contributions, error: null })
        }
        const ilike = state.filters.find(f => f[0] === 'ilike')
        return resolve({ data: ilike?.[1] === 'title' ? titleRows : authorRows, error: null })
      },
    }
    return b
  }
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
    signInAnonymously: vi.fn(),
  }
  return { supabase: { from: t => builder(t), auth }, tables, auth }
}

describe('検索結果（supabaseモード）', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_DATA_SOURCE', 'supabase')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function load(opts) {
    const mock = makeSupabaseMock(opts)
    vi.doMock('./supabase', () => ({ supabase: mock.supabase, isMissingConfig: false }))
    const mod = await import('./dataAdapter')
    return { mock, searchBooksByKeyword: mod.searchBooksByKeyword }
  }

  const SESSION = { user: { id: 'user-1' } }

  it('★ ③ 自分の追加分は book_contributions から辿る（booksを直接見に行かない）', async () => {
    // book_contributions のRLS(contrib_select_own)が created_by = auth.uid() で絞るため、
    // この経路である限り、他人が追加した未公開作品は取得できない。
    const { mock, searchBooksByKeyword } = await load({
      session: SESSION,
      contributions: [{ book_id: UUID_B, books: { id: UUID_B, title: '自分の追加した絵本' } }],
    })
    await searchBooksByKeyword('自分')

    expect(mock.tables.some(t => t.table === 'book_contributions')).toBe(true)
    // books への直接問い合わせは公開作品用の2本だけ。すべて is_active=true で絞っている
    const bookQueries = mock.tables.filter(t => t.table === 'books')
    expect(bookQueries).toHaveLength(2)
    expect(bookQueries.every(t =>
      t.filters.some(f => f[0] === 'eq' && f[1] === 'is_active' && f[2] === true))).toBe(true)
  })

  it('★ ④ 公開作品と自分の追加分が同じ作品なら、2件に増やさない', async () => {
    const { searchBooksByKeyword } = await load({
      session: SESSION,
      titleRows: [{ id: UUID_A, title: 'ぐりとぐら', author: 'なかがわりえこ' }],
      contributions: [{ book_id: UUID_A, books: { id: UUID_A, title: 'ぐりとぐら', author: 'なかがわりえこ' } }],
    })
    const books = await searchBooksByKeyword('ぐり')

    expect(books).toHaveLength(1)
    expect(books[0].addedByMe).toBeUndefined()   // 公開作品として扱う
  })

  it('公開作品と自分の追加分が別なら、両方返す', async () => {
    const { searchBooksByKeyword } = await load({
      session: SESSION,
      titleRows: [{ id: UUID_A, title: 'ぐりとぐら' }],
      contributions: [{ book_id: UUID_B, books: { id: UUID_B, title: 'ぐりぐら紙芝居' } }],
    })
    const books = await searchBooksByKeyword('ぐり')

    expect(books.map(b => b.id)).toEqual([UUID_A, UUID_B])
    expect(books[1].addedByMe).toBe(true)
  })

  it('★ 検索しただけでは匿名ユーザーを作らない', async () => {
    const { mock, searchBooksByKeyword } = await load({ session: null })
    await searchBooksByKeyword('ぐり')

    expect(mock.auth.signInAnonymously).not.toHaveBeenCalled()
    expect(mock.tables.some(t => t.table === 'book_contributions')).toBe(false)
  })

  it('自分の追加分に検索語が含まれなければ出さない', async () => {
    const { searchBooksByKeyword } = await load({
      session: SESSION,
      contributions: [{ book_id: UUID_B, books: { id: UUID_B, title: 'まったく別の絵本' } }],
    })
    expect(await searchBooksByKeyword('ぐり')).toEqual([])
  })

  it('★ ⑥ 自分の追加分が取れなくても、公開作品の検索は止めない', async () => {
    const mock = makeSupabaseMock({ titleRows: [{ id: UUID_A, title: 'ぐりとぐら' }], session: SESSION })
    const original = mock.supabase.from
    mock.supabase.from = (t) => {
      if (t === 'book_contributions') throw new Error('book_contributions が無い')
      return original(t)
    }
    vi.doMock('./supabase', () => ({ supabase: mock.supabase, isMissingConfig: false }))
    const { searchBooksByKeyword } = await import('./dataAdapter')

    const books = await searchBooksByKeyword('ぐり')
    expect(books.map(b => b.id)).toEqual([UUID_A])
  })
})
