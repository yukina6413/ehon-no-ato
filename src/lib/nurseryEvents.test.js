import { describe, it, expect } from 'vitest'
import {
  daysUntil, daysLeftLabel, getUpcomingEvents, getEventsOfMonth,
  getWeekKeys, toDateKey, eventEmoji,
} from './nurseryEvents'

// マイページの「もうすぐの行事」は、行事を少し前に思い出して絵本を準備するための表示。
// 過去の行事を出さないこと・「あと○日」が正しいことを守る。

const TODAY = new Date(2026, 7, 14)   // 2026-08-14（金）

const SCHEDULES = {
  '2026-08-02': [{ id: 1, category: '行事',     text: '夏祭り' }],       // 過去
  '2026-08-14': [{ id: 2, category: '行事',     text: '身体測定' }],     // 当日
  '2026-08-21': [{ id: 3, category: '行事',     text: '誕生会' }],
  '2026-08-28': [{ id: 4, category: '避難訓練', text: '避難訓練' }],
  '2026-09-05': [{ id: 5, category: '行事',     text: 'プール納め' }],
}

describe('daysUntil / daysLeftLabel', () => {
  it('今日・明日・7日後を正しく数える', () => {
    expect(daysUntil('2026-08-14', TODAY)).toBe(0)
    expect(daysUntil('2026-08-15', TODAY)).toBe(1)
    expect(daysUntil('2026-08-21', TODAY)).toBe(7)
    expect(daysUntil('2026-08-13', TODAY)).toBe(-1)
  })

  it('月をまたいでも正しい', () => {
    expect(daysUntil('2026-09-05', TODAY)).toBe(22)
  })

  it('年をまたいでも正しい', () => {
    expect(daysUntil('2027-01-01', new Date(2026, 11, 31))).toBe(1)
  })

  it('表示文言', () => {
    expect(daysLeftLabel(0)).toBe('今日')
    expect(daysLeftLabel(1)).toBe('明日')
    expect(daysLeftLabel(7)).toBe('あと7日')
  })

  it('日付が壊れていてもnullを返す（画面を落とさない）', () => {
    expect(daysUntil('こわれた', TODAY)).toBeNull()
    expect(daysUntil(undefined, TODAY)).toBeNull()
  })
})

describe('getUpcomingEvents（もうすぐの行事）', () => {
  it('過去の行事は出さず、近い順に返す', () => {
    const up = getUpcomingEvents(SCHEDULES, TODAY, 2)
    expect(up.map(e => e.item.text)).toEqual(['身体測定', '誕生会'])
    expect(up.some(e => e.item.text === '夏祭り')).toBe(false)
  })

  it('当日の行事は「もうすぐ」に含める', () => {
    const up = getUpcomingEvents(SCHEDULES, TODAY, 5)
    expect(up[0].item.text).toBe('身体測定')
    expect(up[0].daysLeft).toBe(0)
  })

  it('件数を絞れる（画面に大量に並べない）', () => {
    expect(getUpcomingEvents(SCHEDULES, TODAY, 1)).toHaveLength(1)
  })

  it('予定が無い・壊れていても落ちない', () => {
    expect(getUpcomingEvents({}, TODAY)).toEqual([])
    expect(getUpcomingEvents(null, TODAY)).toEqual([])
    expect(getUpcomingEvents({ 'こわれた': 'ゴミ' }, TODAY)).toEqual([])
  })

  it('あと何日かを一緒に返す', () => {
    const [, second] = getUpcomingEvents(SCHEDULES, TODAY, 2)
    expect(second.daysLeft).toBe(7)
  })
})

describe('getEventsOfMonth（月表示の一覧）', () => {
  it('その月の行事だけを日付順で返す', () => {
    const list = getEventsOfMonth(SCHEDULES, 2026, 7)   // 8月
    expect(list.map(e => e.item.text)).toEqual(['夏祭り', '身体測定', '誕生会', '避難訓練'])
  })

  it('別の月は混ざらない', () => {
    const list = getEventsOfMonth(SCHEDULES, 2026, 8)   // 9月
    expect(list.map(e => e.item.text)).toEqual(['プール納め'])
  })

  it('記録が無い月は空', () => {
    expect(getEventsOfMonth(SCHEDULES, 2026, 0)).toEqual([])
  })
})

describe('getWeekKeys（週表示）', () => {
  it('日曜はじまりの7日を返す', () => {
    const keys = getWeekKeys(TODAY)   // 2026-08-14は金曜
    expect(keys).toHaveLength(7)
    expect(keys[0]).toBe('2026-08-09')   // 日曜
    expect(keys[6]).toBe('2026-08-15')   // 土曜
    expect(keys).toContain(toDateKey(TODAY))
  })

  it('月をまたぐ週でも壊れない', () => {
    const keys = getWeekKeys(new Date(2026, 7, 31))   // 8/31(月)
    expect(keys[0]).toBe('2026-08-30')
    expect(keys[6]).toBe('2026-09-05')
  })

  it('年をまたぐ週でも壊れない', () => {
    const keys = getWeekKeys(new Date(2026, 11, 31))  // 12/31(木)
    expect(keys[0]).toBe('2026-12-27')
    expect(keys[6]).toBe('2027-01-02')
  })
})

describe('eventEmoji', () => {
  it('行事名からアイコンを選ぶ', () => {
    expect(eventEmoji({ text: '誕生会', category: '行事' })).toBe('🎂')
    expect(eventEmoji({ text: '避難訓練', category: '避難訓練' })).toBe('🧯')
  })

  it('分からないときはカテゴリのアイコンにする', () => {
    expect(eventEmoji({ text: 'なにか', category: '会議' })).toBe('📋')
    expect(eventEmoji({ text: 'なにか' })).toBe('📌')
    expect(eventEmoji(null)).toBe('📌')
  })
})
