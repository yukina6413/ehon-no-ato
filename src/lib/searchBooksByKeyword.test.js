import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isDatabaseBook } from './dataAdapter'

// 上部の「絵本・紙芝居を探す」を実DBに接続したときの安全性を守るテスト。
// ・利用者の入力で PostgREST のフィルタ構文を壊さない（.or() を使わない）
// ・0件のときにサンプルの絵本で埋めない
// ・結果の id が実DBのUUIDである（記録画面へ bookId として渡せる）

function makeSupabaseMock({ titleRows = [], authorRows = [], error = null } = {}) {
  const calls = []
  function builder() {
    const state = { filters: [] }
    const b = {
      select: () => b,
      eq:     (col, v) => { state.filters.push(['eq', col, v]); return b },
      ilike:  (col, v) => { state.filters.push(['ilike', col, v]); return b },
      or:     (expr)   => { state.filters.push(['or', expr]); return b },
      limit:  () => b,
      then: (resolve) => {
        calls.push(state.filters)
        const ilike = state.filters.find(f => f[0] === 'ilike')
        const rows = ilike?.[1] === 'title' ? titleRows : authorRows
        return resolve({ data: error ? null : rows, error })
      },
    }
    return b
  }
  // 検索しただけで匿名ユーザーを作らないことを前提にしたモック。
  // セッションが無いので「自分が追加した作品」の問い合わせは行われない。
  const auth = { getSession: async () => ({ data: { session: null }, error: null }) }
  return { supabase: { from: () => builder(), auth }, calls }
}

const UUID_A = '22222222-0000-0000-0000-000000000002'
const UUID_B = '22222222-0000-0000-0000-000000000004'

describe('searchBooksByKeyword（supabaseモード）', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_DATA_SOURCE', 'supabase')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function load(mockOpts) {
    const mock = makeSupabaseMock(mockOpts)
    vi.doMock('./supabase', () => ({ supabase: mock.supabase, isMissingConfig: false }))
    const { searchBooksByKeyword } = await import('./dataAdapter')
    return { mock, searchBooksByKeyword }
  }

  it('書名と著者を別々に検索し、.or() を使わない', async () => {
    const { mock, searchBooksByKeyword } = await load({
      titleRows: [{ id: UUID_A, title: 'ぐりとぐら', author: 'なかがわりえこ' }],
    })
    await searchBooksByKeyword('ぐり')

    expect(mock.calls).toHaveLength(2)                       // title用・author用の2回
    const flat = mock.calls.flat()
    expect(flat.some(f => f[0] === 'or')).toBe(false)        // or() は使わない
    expect(flat.some(f => f[0] === 'ilike' && f[1] === 'title')).toBe(true)
    expect(flat.some(f => f[0] === 'ilike' && f[1] === 'author')).toBe(true)
  })

  it('下書き（is_active=false）の絵本は検索しない', async () => {
    const { mock, searchBooksByKeyword } = await load({})
    await searchBooksByKeyword('ぐり')
    expect(mock.calls.flat().some(f => f[0] === 'eq' && f[1] === 'is_active' && f[2] === true)).toBe(true)
  })

  it('★ 利用者の入力にフィルタ構文の記号が入っても壊れない', async () => {
    // ',' '.' '(' ')' は .or() に埋め込むと構文が壊れる文字。値として渡すだけなら安全。
    const { mock, searchBooksByKeyword } = await load({})
    await searchBooksByKeyword('ぐり,とぐら.(2)')

    const ilike = mock.calls.flat().find(f => f[0] === 'ilike')
    expect(ilike[2]).toBe('%ぐり,とぐら.(2)%')   // そのまま値として渡る
    expect(mock.calls.flat().some(f => f[0] === 'or')).toBe(false)
  })

  it('★ ワイルドカード(% _)は取り除き、全件一致にならないようにする', async () => {
    const { mock, searchBooksByKeyword } = await load({})
    await searchBooksByKeyword('%_%')

    const ilike = mock.calls.flat().find(f => f[0] === 'ilike')
    expect(ilike[2]).toBe('%%')                  // 中身は空。全件一致の指定にならない
  })

  it('書名と著者の両方に出た絵本は1件にまとめる', async () => {
    const row = { id: UUID_A, title: 'ぐりとぐら', author: 'ぐり太郎' }
    const { searchBooksByKeyword } = await load({ titleRows: [row], authorRows: [row] })
    const books = await searchBooksByKeyword('ぐり')
    expect(books).toHaveLength(1)
  })

  it('書名ヒットと著者ヒットを両方返す', async () => {
    const { searchBooksByKeyword } = await load({
      titleRows:  [{ id: UUID_A, title: 'ぐりとぐら', author: 'A' }],
      authorRows: [{ id: UUID_B, title: 'べつの絵本', author: 'ぐり太郎' }],
    })
    const books = await searchBooksByKeyword('ぐり')
    expect(books.map(b => b.id).sort()).toEqual([UUID_A, UUID_B].sort())
  })

  it('★ 0件のときは空配列を返す（サンプル絵本で埋めない）', async () => {
    const { searchBooksByKeyword } = await load({ titleRows: [], authorRows: [] })
    expect(await searchBooksByKeyword('存在しない絵本')).toEqual([])
  })

  it('空の入力では検索しない', async () => {
    const { mock, searchBooksByKeyword } = await load({})
    expect(await searchBooksByKeyword('   ')).toEqual([])
    expect(mock.calls).toHaveLength(0)
  })

  it('★ 結果の id は実DBのUUIDで、記録画面に渡せる', async () => {
    const { searchBooksByKeyword } = await load({
      titleRows: [{
        id: UUID_A, title: 'ぐりとぐら', author: 'なかがわりえこ', publisher: '福音館書店',
        summary: 'あらすじ', care_points: 'ヒント', next_activities: '活動例',
        age_min: 2, age_max: 5,
      }],
    })
    const [book] = await searchBooksByKeyword('ぐり')

    expect(isDatabaseBook(book)).toBe(true)      // 記録ボタンが出る条件を満たす
    expect(book.id).toBe(UUID_A)
    expect(book.synopsis).toBe('あらすじ')        // 詳細画面が読むプロパティ名に変換される
    expect(book.carePoints).toBe('ヒント')
    expect(book.usage).toBe('活動例')
    expect(book.age).toBe('2〜5歳')
  })

  it('検索が失敗したらエラーを投げる（0件と混同しない）', async () => {
    const { searchBooksByKeyword } = await load({ error: { message: 'network down' } })
    await expect(searchBooksByKeyword('ぐり')).rejects.toBeTruthy()
  })
})

describe('isDatabaseBook（記録できる絵本かの判定）', () => {
  it('実DBのUUIDだけを通す', () => {
    expect(isDatabaseBook({ id: UUID_A })).toBe(true)
  })

  it('サンプル・モックの絵本は通さない', () => {
    for (const id of ['s1', 's2', 'bk-01', '', null, undefined, 123]) {
      expect(isDatabaseBook({ id })).toBe(false)
    }
    expect(isDatabaseBook(null)).toBe(false)
    expect(isDatabaseBook({})).toBe(false)
  })

  it('UUIDに似た不正な文字列は通さない', () => {
    expect(isDatabaseBook({ id: '22222222-0000-0000-0000' })).toBe(false)
    expect(isDatabaseBook({ id: 'zzzzzzzz-0000-0000-0000-000000000002' })).toBe(false)
  })
})
