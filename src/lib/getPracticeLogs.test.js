import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 008（列追加）の前に保存された記録が、追加後も今までどおり表示できることを守るテスト。
// 旧記録は episode / insight / age_groups の列が空で、印象と気づきが memo に
// 連結して入っている。これを取りこぼさず読めるかを確認する（supabaseモード）。

function makeSelectMock(rows) {
  const builder = {
    select: () => builder,
    order:  () => builder,
    gte:    () => builder,
    lte:    () => builder,
    // supabaseのクエリビルダーは await できる（thenable）ので、それを真似る
    then: (resolve) => resolve({ data: rows, error: null }),
  }
  return { from: () => builder }
}

describe('getPracticeLogs（supabaseモード・旧記録との後方互換）', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_DATA_SOURCE', 'supabase')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('008以前の記録（memoに連結・age_groupのみ）を今までどおり読める', async () => {
    const legacy = {
      id: 'log-old',
      read_date: '2026-08-01',
      age_group: 4,
      age_groups: [],          // 列追加直後の既存行は既定値の空配列
      scene: '朝の会',
      scene_activities: [],
      selected_by: null,
      select_reason: null,
      reaction: null,
      after_type: null,
      memo: '印象に残った様子\n\n今日の気づき',
      episode: null,           // 旧記録なので空
      insight: null,
      interest_tags: ['笑った'],
      next_ideas: null,
      books: { title: 'てぶくろ', author: 'ラチョフ' },
    }
    vi.doMock('./supabase', () => ({ supabase: makeSelectMock([legacy]), isMissingConfig: false }))

    const { getPracticeLogs } = await import('./dataAdapter')
    const [log] = await getPracticeLogs()

    expect(log.book_title).toBe('てぶくろ')
    expect(log.age_groups).toEqual(['4歳児'])   // 旧 age_group から復元される
    expect(log.reactions).toEqual(['笑った'])
    expect(log.episode).toBe('印象に残った様子\n\n今日の気づき')  // memoをそのまま表示
    expect(log.insight).toBe('')
  })

  it('008以降の記録は episode / insight / age_groups をそのまま読む', async () => {
    const current = {
      id: 'log-new',
      read_date: '2026-08-11',
      age_group: 3,
      age_groups: [3, 4],
      scene: '活動導入',
      scene_activities: ['製作'],
      selected_by: '読み手',
      select_reason: 'ぶつかる姿が続いていたので。',
      reaction: null,
      after_type: '話が広がった',
      memo: '印象\n\n気づき',
      episode: '印象',
      insight: '気づき',
      interest_tags: [],
      next_ideas: '製作前に読む。',
      books: { title: 'ぐりとぐら', author: '中川李枝子' },
    }
    vi.doMock('./supabase', () => ({ supabase: makeSelectMock([current]), isMissingConfig: false }))

    const { getPracticeLogs } = await import('./dataAdapter')
    const [log] = await getPracticeLogs()

    expect(log.age_groups).toEqual(['3歳児', '4歳児'])
    expect(log.scene_activities).toEqual(['製作'])
    expect(log.selected_by).toBe('読み手')
    expect(log.select_reason).toBe('ぶつかる姿が続いていたので。')
    expect(log.after_type).toBe('話が広がった')
    expect(log.episode).toBe('印象')
    expect(log.insight).toBe('気づき')
    expect(log.next_time).toBe('製作前に読む。')
  })
})

// DBの行 →(getPracticeLogs)→ 記録一覧の年齢表示 までを通して確認する。
// 「複数選んだのに1件しか出ない」不具合の再発防止。
describe('年齢の表示（DBの行から画面の文字列まで）', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_DATA_SOURCE', 'supabase')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function displayedAgeOf(row) {
    vi.doMock('./supabase', () => ({
      supabase: makeSelectMock([{ books: { title: 'てぶくろ' }, ...row }]),
      isMissingConfig: false,
    }))
    const { getPracticeLogs, formatAgeGroups } = await import('./dataAdapter')
    const [log] = await getPracticeLogs()
    return formatAgeGroups(log.age_groups)
  }

  it('新規記録 age_groups=[3,4] → 「3・4歳児」', async () => {
    expect(await displayedAgeOf({ age_group: 3, age_groups: [3, 4] })).toBe('3・4歳児')
  })

  it('新規記録 age_groups=[3] → 「3歳児」', async () => {
    expect(await displayedAgeOf({ age_group: 3, age_groups: [3] })).toBe('3歳児')
  })

  it('旧記録 age_group=3・age_groupsなし → 「3歳児」', async () => {
    // 008適用直後の既存行は age_groups が既定値の空配列になる
    expect(await displayedAgeOf({ age_group: 3, age_groups: [] })).toBe('3歳児')
    // 列そのものが無い形（列追加前に読み込んだデータ）でも同じ結果になること
    expect(await displayedAgeOf({ age_group: 3 })).toBe('3歳児')
  })
})
