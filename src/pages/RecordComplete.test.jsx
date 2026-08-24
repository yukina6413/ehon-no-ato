import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import RecordComplete from './RecordComplete'

// 記録本体は保存できたが、選んだときの子どもの姿だけ残せなかったとき
// （部分成功）に、利用者へ何を見せるかを守るテスト。
//
// ・保存し直しを促さない（同じ記録が二重に増えるため）
// ・黙って隠さない（今回いちばん残したかった情報が消えたことを伝える）
// ・管理側の言葉を利用者画面に出さない

function render(state) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[{ pathname: '/record-complete', state }]}>
      <RecordComplete />
    </MemoryRouter>
  )
}

describe('RecordComplete：部分成功の伝え方', () => {
  it('通常の保存では警告を出さない', () => {
    const html = render({ bookTitle: 'ぐりとぐら', dateStr: '8月25日', ageGroup: '4歳児' })
    expect(html).toContain('記録しました')
    expect(html).toContain('ぐりとぐら')
    expect(html).not.toContain('残せませんでした')
  })

  it('★ 紐づけに失敗したときは、記録が保存されたことと合わせて伝える', () => {
    const html = render({ bookTitle: 'ぐりとぐら', stateLinkFailed: true })
    expect(html).toContain('記録しました')                       // 失敗画面にしない
    expect(html).toContain('記録は保存されました')
    expect(html).toContain('選んだときの子どもの姿を残せませんでした')
  })

  it('★ 保存し直しを促す文言を出さない（二重記録を防ぐ）', () => {
    const html = render({ stateLinkFailed: true })
    for (const word of ['もう一度', 'やり直', '再試行', '保存に失敗']) {
      expect(html).not.toContain(word)
    }
  })

  it('★ 管理側の言葉を利用者画面に出さない', () => {
    const html = render({ stateLinkFailed: true })
    for (const word of ['practice_log_states', 'practice_logs', 'RLS', 'stateId', 'エラー']) {
      expect(html).not.toContain(word)
    }
  })

  it('state が無くても落ちない（直接開かれた場合）', () => {
    expect(render(undefined)).toContain('記録しました')
  })
})

describe('RecordComplete：部分成功の判定', () => {
  const source = () => readFileSync(new URL('./RecordComplete.jsx', import.meta.url), 'utf8')

  it('★ 明示的に失敗と伝えられたときだけ警告を出す', () => {
    // 未設定・undefined を「失敗」と誤解しないようにする
    expect(source()).toContain("state?.stateLinkFailed === true")
  })
})
