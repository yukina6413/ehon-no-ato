import { describe, it, expect } from 'vitest'
import {
  SEASON_ORDER, seasonOfMonth, nextSeasonId, nextMonth, nextFiscalMonth, FISCAL_MONTHS,
  HOLIDAYS, HOLIDAY_FREE_MONTHS, NURSERY_EVENT_GROUPS,
  getSeasonCandidates, getHolidayCandidates, getHolidaysByFiscalMonth,
} from './seasonEvents'

describe('季節の循環', () => {
  it('春→夏→秋→冬→春 と循環する', () => {
    expect(SEASON_ORDER).toEqual(['spring', 'summer', 'autumn', 'winter'])
    expect(nextSeasonId('winter')).toBe('spring')   // 冬→春
    expect(nextSeasonId('autumn')).toBe('winter')
  })
  it('月から季節を判定（12月は冬、3月は春）', () => {
    expect(seasonOfMonth(12)).toBe('winter')
    expect(seasonOfMonth(1)).toBe('winter')
    expect(seasonOfMonth(3)).toBe('spring')
    expect(seasonOfMonth(8)).toBe('summer')
  })
  it('翌月は12→1に循環する', () => {
    expect(nextMonth(12)).toBe(1)
    expect(nextMonth(8)).toBe(9)
  })
})

describe('年度（4月→3月）の循環', () => {
  it('4月始まり・3月終わりで、3月の次は4月', () => {
    expect(FISCAL_MONTHS[0]).toBe(4)
    expect(FISCAL_MONTHS[FISCAL_MONTHS.length - 1]).toBe(3)
    expect(nextFiscalMonth(3)).toBe(4)   // 3月→4月
    expect(nextFiscalMonth(12)).toBe(1)
  })
})

describe('祝日', () => {
  it('国民の祝日が全種類（16日）登録されている', () => {
    expect(HOLIDAYS.length).toBe(16)
    const names = HOLIDAYS.map(h => h.name)
    for (const n of ['元日', '成人の日', '建国記念の日', '天皇誕生日', '春分の日', '昭和の日',
                     '憲法記念日', 'みどりの日', 'こどもの日', '海の日', '山の日', '敬老の日',
                     '秋分の日', 'スポーツの日', '文化の日', '勤労感謝の日']) {
      expect(names).toContain(n)
    }
  })
  it('6月・12月は国民の祝日なし', () => {
    expect(HOLIDAY_FREE_MONTHS).toEqual([6, 12])
    expect(HOLIDAYS.filter(h => h.month === 6)).toHaveLength(0)
    expect(HOLIDAYS.filter(h => h.month === 12)).toHaveLength(0)
    const fiscal = getHolidaysByFiscalMonth()
    expect(fiscal.find(g => g.month === 6).none).toBe(true)
    expect(fiscal.find(g => g.month === 12).none).toBe(true)
  })
  it('スポーツの日は祝日、運動会は園の行事（混同しない）', () => {
    expect(HOLIDAYS.some(h => h.name === 'スポーツの日')).toBe(true)
    expect(HOLIDAYS.some(h => h.name === '運動会')).toBe(false)
    const nurseryNames = NURSERY_EVENT_GROUPS.flatMap(g => g.items.map(i => i.name))
    expect(nurseryNames).toContain('運動会')
    expect(nurseryNames).not.toContain('スポーツの日')
  })
  it('各祝日に子ども向け説明とキーワードがある', () => {
    for (const h of HOLIDAYS) {
      expect(typeof h.child).toBe('string')
      expect(h.child.length).toBeGreaterThan(0)
      expect(Array.isArray(h.keywords)).toBe(true)
      expect(h.keywords.length).toBeGreaterThan(0)
    }
  })
})

describe('園の行事は月固定でない', () => {
  it('誕生会・避難訓練が年間で探せる（month を持たない）', () => {
    const all = NURSERY_EVENT_GROUPS.flatMap(g => g.items)
    const birthday = all.find(i => i.name === '誕生会')
    const drill = all.find(i => i.name === '避難訓練')
    expect(birthday).toBeTruthy()
    expect(drill).toBeTruthy()
    expect(birthday.month).toBeUndefined()   // 月に固定していない
    expect(drill.month).toBeUndefined()
  })
})

describe('現在時期＋少し先', () => {
  it('月後半（20日以降）は翌月の候補を少し混ぜる（2月後半→春の気配が入る）', () => {
    const feb15 = getSeasonCandidates(new Date(2026, 1, 15)).map(t => t.n)   // 2/15
    const feb25 = getSeasonCandidates(new Date(2026, 1, 25)).map(t => t.n)   // 2/25
    expect(feb25.length).toBeGreaterThanOrEqual(feb15.length)
    // 2月後半には3月（春）の候補が混ざる
    const marchNames = ['つくし', '菜の花', '桜', '春風', '春の雨']
    expect(feb25.some(n => marchNames.includes(n))).toBe(true)
  })
  it('今の月の祝日＋翌月の祝日を候補にする', () => {
    // 4月：昭和の日(4)＋翌月5月の祝日が入る
    const apr = getHolidayCandidates(new Date(2026, 3, 15)).map(h => h.name)
    expect(apr).toContain('昭和の日')
    expect(apr.some(n => ['こどもの日', 'みどりの日', '憲法記念日'].includes(n))).toBe(true)
  })
})
