import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { savePracticeLog } from './dataAdapter'
import { loadMockPracticeLogs } from './mockData'

// 「どの子どもの姿を見てこの絵本を選んだか」を記録に残すためのテスト。
//
// この情報は検索した瞬間にしか手元に無く、保存しなければ二度と復元できない。
// 逆に、子どもの姿を経ていない導線（書名検索・自分が追加した作品・本棚など）では
// 姿を勝手に作らない。記録本体の保存は、どちらの導線でも必ず成功させる。

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

const FORM = { title: 'ぐりとぐら', bookId: 'bk-02', dateMode: 'auto', ages: ['4歳児'] }
const STATE_ID = 'cs-01'

describe('savePracticeLog：子どもの姿の引き継ぎ（mockモード）', () => {
  it('★ A 子どもの姿から選んだときは、その姿を pre として保存する', async () => {
    await savePracticeLog(FORM, [STATE_ID], [])
    const [log] = loadMockPracticeLogs()

    expect(log.book_id).toBe('bk-02')          // 記録の正本は book_id
    expect(log.pre_state_ids).toEqual([STATE_ID])
    expect(log.post_state_ids).toEqual([])     // 読んだ後の姿は今回入力させない
  })

  it('★ B 姿を経ていない導線では、姿を作らずに記録だけを保存する', async () => {
    await savePracticeLog(FORM)
    const [log] = loadMockPracticeLogs()

    expect(log.book_id).toBe('bk-02')          // 記録本体は必ず保存される
    expect(log.pre_state_ids).toEqual([])
    expect(log.post_state_ids).toEqual([])
  })

  it('★ 再取得しても紐づきが残っている（次回利用）', async () => {
    await savePracticeLog(FORM, [STATE_ID], [])
    // 保存し直さず、あらためて読み出す
    const [reloaded] = loadMockPracticeLogs()
    expect(reloaded.pre_state_ids).toEqual([STATE_ID])
  })
})

// ──────────────────────────────────────────────
// supabaseモード：どのテーブルに何を書くかを固定する
// ──────────────────────────────────────────────
const BOOK_UUID  = '22222222-0000-0000-0000-000000000002'
const STATE_UUID = '11111111-0000-0000-0000-000000000001'

function makeSupabaseMock({ statesError = null, logError = null } = {}) {
  const inserts = []
  const deletes = []
  function builder(table) {
    const b = {
      select: () => b,
      eq:     () => b,
      limit:  () => b,
      single: async () => ({ data: logError ? null : { id: 'log-1' }, error: logError }),
      insert: (rows) => { inserts.push({ table, rows }); return b },
      delete: () => { deletes.push(table); return b },
      then: (resolve) => {
        if (table === 'practice_log_states') {
          return resolve({ data: null, error: statesError })
        }
        return resolve({ data: null, error: null })
      },
    }
    return b
  }
  return { supabase: { from: t => builder(t) }, inserts, deletes }
}

describe('savePracticeLog：子どもの姿の引き継ぎ（supabaseモード）', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_DATA_SOURCE', 'supabase')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function load(opts = {}) {
    const mock = makeSupabaseMock(opts)
    vi.doMock('./supabase', () => ({ supabase: mock.supabase, isMissingConfig: false }))
    const mod = await import('./dataAdapter')
    return { mock, savePracticeLog: mod.savePracticeLog }
  }

  const UUID_FORM = { title: 'ぐりとぐら', bookId: BOOK_UUID, dateMode: 'auto', ages: ['4歳児'] }

  it('★ practice_logs と practice_log_states の両方に書く', async () => {
    const { mock, savePracticeLog } = await load()
    await savePracticeLog(UUID_FORM, [STATE_UUID], [])

    const logInsert = mock.inserts.find(i => i.table === 'practice_logs')
    expect(logInsert.rows.book_id).toBe(BOOK_UUID)

    const stateInsert = mock.inserts.find(i => i.table === 'practice_log_states')
    expect(stateInsert.rows).toEqual([
      { log_id: 'log-1', state_id: STATE_UUID, phase: 'pre' },
    ])
  })

  it('★ 姿が無いときは practice_log_states に一切触れない', async () => {
    const { mock, savePracticeLog } = await load()
    await savePracticeLog(UUID_FORM)

    expect(mock.inserts.some(i => i.table === 'practice_logs')).toBe(true)
    expect(mock.inserts.some(i => i.table === 'practice_log_states')).toBe(false)
  })

  it('★ ① 完全成功：本体も紐づけも保存できたら stateLinksSaved = true', async () => {
    const { savePracticeLog } = await load()
    const r = await savePracticeLog(UUID_FORM, [STATE_UUID], [])
    expect(r).toEqual({ logId: 'log-1', stateLinksSaved: true })
  })

  it('★ ② 部分成功：紐づけだけ失敗しても例外にせず、失敗を伝える', async () => {
    const { mock, savePracticeLog } = await load({ statesError: { message: 'RLS denied' } })
    const r = await savePracticeLog(UUID_FORM, [STATE_UUID], [])

    // 例外を投げない＝画面が保存失敗に見えず、利用者が保存し直すこともない
    expect(r.logId).toBe('log-1')
    expect(r.stateLinksSaved).toBe(false)     // 黙って捨てず、呼び出し側へ伝える
    // practice_logs は1件のまま。帳尻合わせの削除も、作り直しもしない
    expect(mock.inserts.filter(i => i.table === 'practice_logs')).toHaveLength(1)
    expect(mock.deletes).toEqual([])
  })

  it('★ ③ 本体失敗：従来どおり例外にする', async () => {
    const { savePracticeLog } = await load({ logError: { message: 'insert failed' } })
    await expect(savePracticeLog(UUID_FORM, [STATE_UUID], [])).rejects.toBeTruthy()
  })

  it('★ ④ 姿が無い導線は、紐づけを試さず完全成功にする（警告を出さない）', async () => {
    const { mock, savePracticeLog } = await load()
    const r = await savePracticeLog(UUID_FORM)

    expect(r.stateLinksSaved).toBe(true)
    expect(mock.inserts.some(i => i.table === 'practice_log_states')).toBe(false)
  })

  it('post は今回使わない（読んだ後の姿を入力させない）', async () => {
    const { mock, savePracticeLog } = await load()
    await savePracticeLog(UUID_FORM, [STATE_UUID], [])
    const stateInsert = mock.inserts.find(i => i.table === 'practice_log_states')
    expect(stateInsert.rows.every(r => r.phase === 'pre')).toBe(true)
  })
})

// ──────────────────────────────────────────────
// 画面側：どこで stateId が付き、どこで付かないか
// ──────────────────────────────────────────────
describe('画面の引き継ぎ', () => {
  const home   = () => readFileSync(new URL('../pages/Home.jsx', import.meta.url), 'utf8')
  const record = () => readFileSync(new URL('../pages/RecordInput.jsx', import.meta.url), 'utf8')

  it('★ 子どもの姿の検索結果には、検索を生んだ姿が本ごとに付く', () => {
    // 画面全体で持つと、書名検索で選んだ本にも前の検索の姿が付いてしまう
    expect(home()).toMatch(/searchedState[\s\S]{0,400}stateId: searchedState\.id/)
  })

  it('★ 記録画面へ bookId と一緒に stateId を渡す', () => {
    expect(home()).toMatch(/navigate\('\/record'[\s\S]{0,300}stateId:\s*book\.stateId/)
  })

  it('★ stateId が無ければ pre は空になる（既存の記録導線を壊さない）', () => {
    expect(record()).toContain('form.stateId ? [form.stateId] : []')
  })

  it('★ 利用者に新しい入力を追加していない（姿を選ぶUIを作らない）', () => {
    const src = record()
    expect(src).not.toContain('読む前の子どもの姿')
    expect(src).not.toContain('読んだ後の子どもの姿')
  })
})
