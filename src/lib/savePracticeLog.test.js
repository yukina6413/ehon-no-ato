import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 「検索で選んだ絵本を記録画面へ引き継ぐ」連携のデータ層の核心を保護するテスト。
// 引き継いだ bookId があるときは、保存時にタイトル一致検索(from('books'))を行わず、
// その book_id で practice_logs に保存することを確認する（supabaseモード）。

// booksの書名検索が返す行を差し替えられるモック。
// lookupError を渡すと通信/APIエラーを再現する。
function makeSupabaseMock({ bookRows = [], lookupError = null } = {}) {
  const fromCalls = []
  let insertedRow = null
  let currentTable = null
  const builder = {
    select: () => builder,
    eq: () => builder,
    limit: () => builder,
    single: async () => ({ data: { id: 'log-1' }, error: null }),
    insert: (row) => { insertedRow = row; return builder },
    // books の検索は await でそのまま解決する（supabaseのクエリビルダーと同じ）
    then: (resolve) => {
      if (currentTable === 'books') {
        return resolve({ data: lookupError ? null : bookRows, error: lookupError })
      }
      return resolve({ data: null, error: null })
    },
  }
  const supabase = {
    from: (table) => { fromCalls.push(table); currentTable = table; return builder },
  }
  return { supabase, fromCalls, getInsertedRow: () => insertedRow }
}

describe('savePracticeLog（supabaseモード・絵本引き継ぎ）', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_DATA_SOURCE', 'supabase')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('bookId があればタイトル検索(from(books))せず、その book_id で保存する', async () => {
    const mock = makeSupabaseMock()
    vi.doMock('./supabase', () => ({ supabase: mock.supabase, isMissingConfig: false }))

    const { savePracticeLog } = await import('./dataAdapter')
    const bookUuid = '22222222-0000-0000-0000-000000000003'
    await savePracticeLog({ bookId: bookUuid, title: 'てぶくろ', ages: ['4歳'] })

    // books テーブルへのタイトル検索は発生しない
    expect(mock.fromCalls).not.toContain('books')
    // practice_logs へ挿入し、引き継いだ book_id が使われている
    expect(mock.fromCalls).toContain('practice_logs')
    expect(mock.getInsertedRow().book_id).toBe(bookUuid)
  })

  it('記録画面の入力項目を008で追加した列へ保存する（既存列も従来どおり書く）', async () => {
    const mock = makeSupabaseMock()
    vi.doMock('./supabase', () => ({ supabase: mock.supabase, isMissingConfig: false }))

    const { savePracticeLog } = await import('./dataAdapter')
    await savePracticeLog({
      bookId: '22222222-0000-0000-0000-000000000003',
      title: 'てぶくろ',
      ages: ['3歳児', '4歳児'],
      scene: '活動導入',
      sceneActivities: ['製作'],
      selectedBy: '読み手',
      reason: 'ぶつかる姿が続いていたので。',
      afterType: '話が広がった',
      episode: '「もう一回」と言っていた。',
      insight: '午睡前より集中しやすい。',
      reactions: ['笑った'],
      nextTime: '製作前に読む。',
    })
    const row = mock.getInsertedRow()

    // 008で追加した列
    expect(row.age_groups).toEqual([3, 4])              // 全件（数値）
    expect(row.scene_activities).toEqual(['製作'])
    expect(row.selected_by).toBe('読み手')
    expect(row.select_reason).toBe('ぶつかる姿が続いていたので。')
    expect(row.after_type).toBe('話が広がった')
    expect(row.episode).toBe('「もう一回」と言っていた。')
    expect(row.insight).toBe('午睡前より集中しやすい。')

    // 既存列は従来どおり（後方互換）。型変更・CHECK制約変更をしていないこと
    expect(row.age_group).toBe(3)                        // 1件目のみ
    expect(row.reaction).toBeNull()                      // CHECK制約付きの列は使わない
    expect(row.memo).toBe('「もう一回」と言っていた。\n\n午睡前より集中しやすい。')
    expect(row.interest_tags).toEqual(['笑った'])
    expect(row.next_ideas).toBe('製作前に読む。')
  })

  it('bookId が無くても、書名が1冊に決まればその絵本で保存する', async () => {
    const mock = makeSupabaseMock({
      bookRows: [{ id: 'book-uuid-1', title: 'てぶくろ', author: 'ラチョフ', publisher: '福音館書店' }],
    })
    vi.doMock('./supabase', () => ({ supabase: mock.supabase, isMissingConfig: false }))

    const { savePracticeLog } = await import('./dataAdapter')
    await savePracticeLog({ title: 'てぶくろ', ages: ['4歳児'] })

    expect(mock.fromCalls).toContain('books')          // 書名で探す
    expect(mock.fromCalls).toContain('practice_logs')  // 保存まで進む
    expect(mock.getInsertedRow().book_id).toBe('book-uuid-1')
  })

  it('bookId が無くタイトルもDBに無ければ、分かりやすいエラーになる', async () => {
    const mock = makeSupabaseMock({ bookRows: [] })
    vi.doMock('./supabase', () => ({ supabase: mock.supabase, isMissingConfig: false }))

    const { savePracticeLog, BOOK_LOOKUP_ERRORS } = await import('./dataAdapter')
    await expect(
      savePracticeLog({ title: 'はらぺこあおむし', ages: ['3歳'] })
    ).rejects.toThrow(/データベースに登録されていません/)
    // タイトル検索は試みる
    expect(mock.fromCalls).toContain('books')
    // 原因コードでも区別できる
    await expect(savePracticeLog({ title: 'はらぺこあおむし' }))
      .rejects.toMatchObject({ code: BOOK_LOOKUP_ERRORS.NOT_FOUND })
  })

  it('★ 同名の絵本が複数あるとき、勝手に1冊を選ばず候補を返す', async () => {
    const rows = [
      { id: 'b-1', title: 'てぶくろ', author: 'ラチョフ',   publisher: '福音館書店' },
      { id: 'b-2', title: 'てぶくろ', author: '別の作者',   publisher: '別の出版社' },
    ]
    const mock = makeSupabaseMock({ bookRows: rows })
    vi.doMock('./supabase', () => ({ supabase: mock.supabase, isMissingConfig: false }))

    const { savePracticeLog, BOOK_LOOKUP_ERRORS } = await import('./dataAdapter')
    const err = await savePracticeLog({ title: 'てぶくろ' }).catch(e => e)

    expect(err.code).toBe(BOOK_LOOKUP_ERRORS.AMBIGUOUS)
    expect(err.candidates).toHaveLength(2)             // 選ばせるための候補が返る
    expect(mock.getInsertedRow()).toBeNull()           // 勝手に保存しない
    expect(mock.fromCalls).not.toContain('practice_logs')
  })

  it('★ 同名が複数のとき「登録されていません」とは言わない', async () => {
    const rows = [
      { id: 'b-1', title: 'てぶくろ', author: 'A', publisher: 'X' },
      { id: 'b-2', title: 'てぶくろ', author: 'B', publisher: 'Y' },
    ]
    const mock = makeSupabaseMock({ bookRows: rows })
    vi.doMock('./supabase', () => ({ supabase: mock.supabase, isMissingConfig: false }))

    const { savePracticeLog } = await import('./dataAdapter')
    const err = await savePracticeLog({ title: 'てぶくろ' }).catch(e => e)

    expect(err.message).not.toMatch(/登録されていません/)
    expect(err.message).toMatch(/複数/)
  })

  it('★ 候補から選んだ絵本のIDを渡せば保存できる', async () => {
    const mock = makeSupabaseMock({ bookRows: [] })
    vi.doMock('./supabase', () => ({ supabase: mock.supabase, isMissingConfig: false }))

    const { savePracticeLog } = await import('./dataAdapter')
    await savePracticeLog({ title: 'てぶくろ', bookId: 'b-2' })

    expect(mock.getInsertedRow().book_id).toBe('b-2')
    expect(mock.fromCalls).not.toContain('books')   // IDがあるので書名検索はしない
  })

  it('★ 通信/APIエラーは「登録されていません」と区別する', async () => {
    const mock = makeSupabaseMock({ lookupError: { message: 'network down', code: 'PGRST000' } })
    vi.doMock('./supabase', () => ({ supabase: mock.supabase, isMissingConfig: false }))

    const { savePracticeLog, BOOK_LOOKUP_ERRORS } = await import('./dataAdapter')
    const err = await savePracticeLog({ title: 'てぶくろ' }).catch(e => e)

    expect(err.code).toBe(BOOK_LOOKUP_ERRORS.LOOKUP_FAILED)
    expect(err.message).not.toMatch(/登録されていません/)
    expect(err.message).toMatch(/通信/)
    expect(mock.getInsertedRow()).toBeNull()
  })

  it('★ タイトルが空のときは、未登録ではなく入力を促す', async () => {
    const mock = makeSupabaseMock({ bookRows: [] })
    vi.doMock('./supabase', () => ({ supabase: mock.supabase, isMissingConfig: false }))

    const { savePracticeLog, BOOK_LOOKUP_ERRORS } = await import('./dataAdapter')
    const err = await savePracticeLog({ title: '   ' }).catch(e => e)

    expect(err.code).toBe(BOOK_LOOKUP_ERRORS.TITLE_REQUIRED)
    expect(err.message).toMatch(/タイトルを入力/)
    expect(mock.fromCalls).not.toContain('books')   // 検索すらしない
  })
})
