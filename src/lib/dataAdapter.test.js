import { describe, it, expect, beforeEach } from 'vitest'
import {
  getChildStates,
  findStatesByText,
  searchBooksByState,
  savePracticeLog,
  getPracticeLogs,
  getBookById,
} from './dataAdapter'

// このテストは VITE_DATA_SOURCE 未設定＝mockモードで動く前提。
// Supabase接続なしで「入口は子どもの姿」という基本挙動を守れているかを確認する。

beforeEach(() => {
  globalThis.localStorage = (() => {
    let store = {}
    return {
      getItem: key => (key in store ? store[key] : null),
      setItem: (key, value) => { store[key] = String(value) },
      removeItem: key => { delete store[key] },
      clear: () => { store = {} },
    }
  })()
})

describe('dataAdapter（mockモード）', () => {
  it('getChildStates: 子どもの姿一覧を返す', async () => {
    const states = await getChildStates()
    expect(Array.isArray(states)).toBe(true)
    expect(states.length).toBeGreaterThan(0)
    expect(states[0]).toHaveProperty('label')
  })

  it('findStatesByText: 空文字は空配列を返す', async () => {
    expect(await findStatesByText('')).toEqual([])
    expect(await findStatesByText('   ')).toEqual([])
  })

  it('findStatesByText: 部分一致する子どもの姿を返す', async () => {
    const results = await findStatesByText('虫')
    expect(results.some(s => s.label.includes('虫'))).toBe(true)
  })

  it('searchBooksByState: avoid指定の絵本は結果から除外される', async () => {
    const results = await searchBooksByState('cs-01')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(b => b.book_id === 'bk-avoid-01')).toBe(false)
  })

  it('searchBooksByState: 該当なしの姿では空配列を返す', async () => {
    const results = await searchBooksByState('cs-does-not-exist')
    expect(results).toEqual([])
  })

  it('savePracticeLog → getPracticeLogs: 保存した記録を取得できる', async () => {
    await savePracticeLog({ title: 'てぶくろ', reactions: ['😊笑い'] })
    const logs = await getPracticeLogs()
    expect(logs.length).toBe(1)
    expect(logs[0].book_title).toBe('てぶくろ')
  })

  it('savePracticeLog: 記録画面の入力項目を取りこぼさず保存・取得できる', async () => {
    await savePracticeLog({
      title: 'てぶくろ',
      ages: ['3歳児', '4歳児'],
      scene: '活動導入',
      sceneActivities: ['製作', '散歩'],
      selectedBy: '読み手',
      reason: '貸し借りでぶつかる姿が続いていたので。',
      reactions: ['笑った'],
      afterType: '話が広がった',
      episode: '「もう一回」と言っていた。',
      insight: '午睡前より集中しやすい。',
      nextTime: '製作前に読む。',
    })
    const [log] = await getPracticeLogs()
    expect(log.age_groups).toEqual(['3歳児', '4歳児'])        // 全件保存される
    expect(log.scene_activities).toEqual(['製作', '散歩'])
    expect(log.selected_by).toBe('読み手')
    expect(log.select_reason).toBe('貸し借りでぶつかる姿が続いていたので。')
    expect(log.after_type).toBe('話が広がった')
    expect(log.episode).toBe('「もう一回」と言っていた。')     // 気づきと混ざらない
    expect(log.insight).toBe('午睡前より集中しやすい。')
    expect(log.next_time).toBe('製作前に読む。')
  })

  it('savePracticeLog: 読む前／読んだ後の子どもの姿を pre / post に分けて保存する', async () => {
    await savePracticeLog({ title: 'てぶくろ' }, ['cs-01'], ['cs-03', 'cs-04'])
    const raw = JSON.parse(localStorage.getItem('practice_logs_v1'))
    expect(raw[0].pre_state_ids).toEqual(['cs-01'])
    expect(raw[0].post_state_ids).toEqual(['cs-03', 'cs-04'])
  })

  it('getPracticeLogs: 気づきだけ書いた記録でも、印象の欄に気づきが紛れ込まない', async () => {
    await savePracticeLog({ title: 'てぶくろ', insight: '声を小さくしたら前のめりになった。' })
    const [log] = await getPracticeLogs()
    expect(log.episode).toBe('')
    expect(log.insight).toBe('声を小さくしたら前のめりになった。')
  })

  it('getBookById: 既存IDで絵本を返し、無いID/nullはnull（記録画面の再取得用）', async () => {
    const b = await getBookById('bk-01')
    expect(b?.title).toBe('そらまめくんのベッド')
    expect(await getBookById('does-not-exist')).toBeNull()
    expect(await getBookById(null)).toBeNull()
  })
})
