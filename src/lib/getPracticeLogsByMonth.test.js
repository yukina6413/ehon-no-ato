import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// カレンダーに記録が出ない問題の調査・再発防止。
// 「月の範囲の作り方」と「read_dateがカレンダーの日付キーと一致するか」を固定する。

function makeSelectMock(rows, capture) {
  const builder = {
    select: () => builder,
    order:  () => builder,
    gte:    (col, v) => { capture.gte = { col, v }; return builder },
    lte:    (col, v) => { capture.lte = { col, v }; return builder },
    then:   (resolve) => resolve({ data: rows, error: null }),
  }
  return { from: (t) => { capture.table = t; return builder } }
}

// CalendarPage が日付セルのキーを作るのと同じ式
function calendarKey(year, month, day) {
  const pad = n => String(n).padStart(2, '0')
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

describe('getPracticeLogsByMonth（カレンダー用）', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_DATA_SOURCE', 'supabase')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('2026年8月を開くと 2026-08-01〜2026-08-31 で絞り込む', async () => {
    const capture = {}
    vi.doMock('./supabase', () => ({ supabase: makeSelectMock([], capture), isMissingConfig: false }))
    const { getPracticeLogsByMonth } = await import('./dataAdapter')

    await getPracticeLogsByMonth(2026, 7)   // monthは0始まり＝7が8月

    expect(capture.table).toBe('practice_logs')
    expect(capture.gte).toEqual({ col: 'read_date', v: '2026-08-01' })
    expect(capture.lte).toEqual({ col: 'read_date', v: '2026-08-31' })
  })

  it('2026-08-11 の記録が、カレンダーの8月11日のセルと一致する', async () => {
    const capture = {}
    const row = {
      id: 'log-1',
      read_date: '2026-08-11',
      age_group: 3,
      age_groups: [3, 4],
      books: { title: 'てぶくろ' },
    }
    vi.doMock('./supabase', () => ({ supabase: makeSelectMock([row], capture), isMissingConfig: false }))
    const { getPracticeLogsByMonth } = await import('./dataAdapter')

    const logs = await getPracticeLogsByMonth(2026, 7)

    expect(logs).toHaveLength(1)
    expect(logs[0].book_title).toBe('てぶくろ')          // タイトルが取れている
    expect(logs[0].read_date).toBe(calendarKey(2026, 7, 11))  // セルのキーと完全一致
    expect(logs[0].age_groups).toEqual(['3歳児', '4歳児'])
  })

  it('月末・月初がずれない（2月・12月）', async () => {
    const capture = {}
    vi.doMock('./supabase', () => ({ supabase: makeSelectMock([], capture), isMissingConfig: false }))
    const { getPracticeLogsByMonth } = await import('./dataAdapter')

    await getPracticeLogsByMonth(2026, 1)    // 2月（うるう年でない）
    expect(capture.lte.v).toBe('2026-02-28')

    await getPracticeLogsByMonth(2026, 11)   // 12月
    expect(capture.gte.v).toBe('2026-12-01')
    expect(capture.lte.v).toBe('2026-12-31')
  })
})
