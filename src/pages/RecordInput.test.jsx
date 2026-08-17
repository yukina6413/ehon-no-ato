import { describe, it, expect, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import RecordInput from './RecordInput'

// 「戻るを押すと画面が真っ白になる」不具合の再発防止。
// 原因は、下書きに配列の項目が無い状態で描画すると .includes() で例外が出て
// React全体が落ちること。壊れた下書きでも落ちないことを固定する。

function memStorage(initial = {}) {
  let store = { ...initial }
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: k => { delete store[k] },
    clear: () => { store = {} },
  }
}

const DRAFT_KEY = 'record_draft_v1'

function renderWithDraft(draft) {
  globalThis.sessionStorage = memStorage(
    draft === undefined ? {} : { [DRAFT_KEY]: JSON.stringify(draft) }
  )
  globalThis.localStorage = memStorage()
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/record']}>
      <AuthProvider><RecordInput /></AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  globalThis.sessionStorage = memStorage()
  globalThis.localStorage = memStorage()
})

describe('RecordInput：壊れた下書きでも落ちない', () => {
  it('下書きが無いときは1ページ目が出る', () => {
    const html = renderWithDraft(undefined)
    expect(html).toContain('絵本を記録する')
    expect(html).toContain('表紙を撮影する')
  })

  it('★ 配列の項目が無い下書きでも落ちない（白い画面の原因）', () => {
    // 古いバージョンで保存された下書きを想定（ages などが欠けている）
    expect(() => renderWithDraft({ step: 1, form: { title: 'てぶくろ' } })).not.toThrow()
  })

  it('★ 配列の項目が配列でない下書きでも落ちない', () => {
    expect(() => renderWithDraft({
      step: 2,
      form: { title: 'てぶくろ', ages: null, reactions: 'こわれた値', sceneActivities: 0 },
    })).not.toThrow()
  })

  it('★ 中身が壊れたJSONでも落ちない', () => {
    globalThis.sessionStorage = memStorage({ [DRAFT_KEY]: '{壊れている' })
    globalThis.localStorage = memStorage()
    expect(() => renderToStaticMarkup(
      <MemoryRouter initialEntries={['/record']}>
        <AuthProvider><RecordInput /></AuthProvider>
      </MemoryRouter>
    )).not.toThrow()
  })

  it('ページ番号が下書きから戻る（更新しても最初のページに戻らない）', () => {
    const html = renderWithDraft({ step: 3, form: { title: 'てぶくろ', episode: '印象テスト' } })
    // 4ページ目（ふりかえり）の内容が出ている
    expect(html).toContain('印象に残った子どもの様子')
    expect(html).toContain('印象テスト')
  })

  it('ページ番号が範囲外の下書きでも落ちない', () => {
    expect(() => renderWithDraft({ step: 99, form: { title: 'てぶくろ' } })).not.toThrow()
    expect(() => renderWithDraft({ step: -5, form: { title: 'てぶくろ' } })).not.toThrow()
  })

  it('タイトルは必須と表示されている', () => {
    const html = renderWithDraft(undefined)
    expect(html).toContain('タイトル')
    expect(html).toContain('必須')
    // 押す前からエラーを出さない
    expect(html).not.toContain('絵本のタイトルを入力してください')
  })

  it('絵本を引き継いだ直後（bookIdあり・タイトル取得中）でも落ちない', () => {
    // この状態で「次へ」を止めてしまうと既存の導線が壊れるため、描画を固定しておく
    expect(() => renderWithDraft({
      step: 0,
      form: { title: '', bookId: '22222222-0000-0000-0000-000000000003' },
    })).not.toThrow()
  })

  it('「読む前/読んだ後の子どもの姿」が記録画面から消えている', () => {
    const step2 = renderWithDraft({ step: 1, form: { title: 'てぶくろ' } })
    const step3 = renderWithDraft({ step: 2, form: { title: 'てぶくろ' } })
    expect(step2).not.toContain('読む前の子どもの姿')
    expect(step3).not.toContain('読んだ後の子どもの姿')
    // 残す項目は消えていないこと
    expect(step2).toContain('誰が選んだか')
    expect(step2).toContain('この絵本を選んだ理由')
    expect(step3).toContain('えほんのあとタイプ')
  })
})
