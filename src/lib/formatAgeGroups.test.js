import { describe, it, expect } from 'vitest'
import { formatAgeGroups } from './dataAdapter'

// 記録は年齢を複数持てる（008で age_groups を追加）。
// 画面が1件目だけを表示してしまわないよう、表示文字列の作り方を固定する。
// 旧記録（age_groups が空で age_group だけ）も従来どおり表示できることを含めて守る。

describe('formatAgeGroups（記録一覧などの年齢表示）', () => {
  it('新規記録 [3,4] → 「3・4歳児」', () => {
    // getPracticeLogs は数値の age_groups を '3歳児' の形にして返す
    expect(formatAgeGroups(['3歳児', '4歳児'])).toBe('3・4歳児')
  })

  it('新規記録 [3] → 「3歳児」', () => {
    expect(formatAgeGroups(['3歳児'])).toBe('3歳児')
  })

  // 旧記録（age_groupだけ）のケースは、DBの行から表示までを通して
  // getPracticeLogs.test.js の「年齢の表示」で確認している

  it('3つ以上でも全件並べる', () => {
    expect(formatAgeGroups(['0歳児', '1歳児', '2歳児'])).toBe('0・1・2歳児')
  })

  it('年齢が無いときは空文字（表示しない）', () => {
    expect(formatAgeGroups([])).toBe('')
    expect(formatAgeGroups(null)).toBe('')
    expect(formatAgeGroups(undefined)).toBe('')
  })

  it('「混合」など想定外の値が混ざる古い記録でも壊れない', () => {
    expect(formatAgeGroups(['混合'])).toBe('混合')
    expect(formatAgeGroups(['3歳児', '混合'])).toBe('3歳児・混合')
  })
})
