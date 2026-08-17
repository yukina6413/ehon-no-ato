import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadCalendarView, saveCalendarView, loadProfile, saveProfile, profileSubtitle,
} from './userPrefs'

// 「設定させすぎず、最後に使った状態を覚える」ための保存を守るテスト。

function memStorage() {
  let store = {}
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: k => { delete store[k] },
    clear: () => { store = {} },
    _raw: (k, v) => { store[k] = v },
  }
}

beforeEach(() => { globalThis.localStorage = memStorage() })

describe('カレンダーの週/月表示を覚える', () => {
  it('初期表示は「週」', () => {
    expect(loadCalendarView()).toBe('week')
  })

  it('「月」を選ぶと次に開いたときも「月」', () => {
    saveCalendarView('month')
    expect(loadCalendarView()).toBe('month')
  })

  it('「週」に戻せる', () => {
    saveCalendarView('month')
    saveCalendarView('week')
    expect(loadCalendarView()).toBe('week')
  })

  it('壊れた値が入っていても「週」にする', () => {
    localStorage._raw('mypage_calendar_view_v1', 'ゴミ')
    expect(loadCalendarView()).toBe('week')
  })
})

describe('プロフィールの保存', () => {
  it('保存した内容が次に開いたときも残る（以前は消えていた）', () => {
    saveProfile({ name: 'さくら', school: 'さくら保育園', role: '保育士', classes: ['3歳児'], position: '主任' })
    const p = loadProfile()
    expect(p.name).toBe('さくら')
    expect(p.school).toBe('さくら保育園')
    expect(p.classes).toEqual(['3歳児'])
  })

  it('未設定なら空のプロフィールを返す', () => {
    const p = loadProfile()
    expect(p.name).toBe('')
    expect(p.classes).toEqual([])
  })

  it('壊れた保存データでも落ちない', () => {
    localStorage._raw('profile_v1', '{こわれている')
    expect(() => loadProfile()).not.toThrow()
    expect(loadProfile().classes).toEqual([])
  })

  it('classesが配列でなくても配列に直す', () => {
    localStorage._raw('profile_v1', JSON.stringify({ name: 'A', classes: 'ゴミ' }))
    expect(loadProfile().classes).toEqual([])
  })
})

describe('profileSubtitle（プロフィール行の2段目）', () => {
  it('園名とクラスを並べる', () => {
    expect(profileSubtitle({ school: 'さくら保育園', classes: ['3歳児'] })).toBe('さくら保育園・3歳児クラス')
  })

  it('複数クラスでも読める', () => {
    expect(profileSubtitle({ school: 'さくら保育園', classes: ['3歳児', '4歳児'] }))
      .toBe('さくら保育園・3歳児・4歳児クラス')
  })

  it('未入力の項目は出さない（「・」だけ残らない）', () => {
    expect(profileSubtitle({ school: 'さくら保育園', classes: [] })).toBe('さくら保育園')
    expect(profileSubtitle({ school: '', classes: ['3歳児'] })).toBe('3歳児クラス')
    expect(profileSubtitle({})).toBe('')
    expect(profileSubtitle(null)).toBe('')
  })
})
