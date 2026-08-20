import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import AddWorkPanel from './AddWorkPanel'

// 「見つからない作品を、その場で追加してそのまま記録する」入口を守るテスト。
// 追加の入口が消えると、利用者は記録そのものができなくなる。

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
  globalThis.sessionStorage = memStorage()
})

function render(query) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider><AddWorkPanel query={query} /></AuthProvider>
    </MemoryRouter>
  )
}

const source = () => readFileSync(new URL('./AddWorkPanel.jsx', import.meta.url), 'utf8')

describe('AddWorkPanel：未登録作品の追加入口', () => {
  it('検索語があるときは「この作品を追加する」を出す', () => {
    const html = render('おおきなかぶ')
    expect(html).toContain('この作品を追加する')
    expect(html).not.toContain('disabled=""')
  })

  it('検索語が無いときは押せない', () => {
    expect(render('')).toContain('disabled=""')
  })

  it('★ booksへ直接書き込まず、create_provisional_book 経由でだけ追加する', () => {
    const src = source()
    expect(src).toContain('createProvisionalBook')
    expect(src).not.toMatch(/from\(['"]books['"]\)/)
    expect(src).not.toContain('.insert(')
  })

  it('★ 記録画面へは book_id を渡す（書名一致で探し直させない）', () => {
    const src = source()
    expect(src).toMatch(/navigate\('\/record'[\s\S]{0,120}bookId/)
  })

  it('★ RPCの3つの状態をすべて扱う（重複登録を作らない）', () => {
    const src = source()
    expect(src).toContain('PROVISIONAL_BOOK_STATUS.CANDIDATES')
    expect(src).toContain('PROVISIONAL_BOOK_STATUS.EXISTING')
    expect(src).toContain('forceNew')
  })

  it('★ 失敗をconsole.errorだけで終わらせない（画面にも出す）', () => {
    const src = source()
    expect(src).toContain('setError')
    expect(src).toContain('作品を追加できませんでした')
  })
})
