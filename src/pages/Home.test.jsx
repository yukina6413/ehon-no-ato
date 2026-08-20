import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import Home from './Home'

// 通常利用の画面に、実DBの絵本とサンプル絵本を混ぜないことを守るテスト。
// サンプルを本物の検索結果のように見せると、記録できない絵本を選ばせてしまう。

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

function render() {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider><Home /></AuthProvider>
    </MemoryRouter>
  )
}

const source = () => readFileSync(new URL('./Home.jsx', import.meta.url), 'utf8')

describe('ホーム：サンプル絵本を通常画面に出さない', () => {
  it('落ちずに描画できる', () => {
    const html = render()
    expect(html).toContain('えほんのあと')
    expect(html).toContain('絵本・紙芝居を探す')
  })

  it('★ SAMPLE_BOOKS がコードから無くなっている', () => {
    expect(source()).not.toMatch(/SAMPLE_BOOKS/)
  })

  it('★ サンプル絵本の書名が最初から画面に出ていない', () => {
    const html = render()
    // 以前は検索前から出うる固定サンプルだった書名
    expect(html).not.toContain('ふしぎなたね')
    expect(html).not.toContain('おつきさまこんにちは')
  })

  it('★ 検索結果に固定データを混ぜる実装が残っていない', () => {
    const src = source()
    // 「結果が無いときにサンプルで埋める」パターンが復活していないこと
    expect(src).not.toMatch(/setSearchResults\(\s*SAMPLE/)
    expect(src).not.toMatch(/setSubThemeResults\(\s*SAMPLE/)
  })

  it('フリー検索は実DBの検索関数を使っている', () => {
    const src = source()
    expect(src).toContain('searchBooksByKeyword')
    // フィルタ構文を壊す .or() を画面側で組み立てていない
    expect(src).not.toMatch(/\.or\(/)
  })

  it('0件のときに正直な文言を出す', () => {
    const src = source()
    expect(src).toContain('まだ登録されていません')
  })

  it('登録されていない絵本には記録ボタンを出さない作りになっている', () => {
    const src = source()
    expect(src).toContain('isDatabaseBook')
    expect(src).toContain('この絵本はまだデータベースに登録されていないため、記録できません')
  })

  it('「子どもの姿から探す」の実DB経路は残っている', () => {
    const src = source()
    expect(src).toContain('findStatesByText')
    expect(src).toContain('searchBooksByState')
    expect(src).toContain('id: b.book_id')   // RPCが返す列名。ここが変わると記録できなくなる
  })
})

// 「自分が追加した作品」を、公開作品と分けて出す。
// ただし管理側の状態（未公開・確認待ち等）は利用者画面に出さない。
describe('ホーム：自分が追加した作品の出し分け', () => {
  // コメント行は利用者に見えないため、判定から外す
  function visibleSource() {
    return source()
      .replace(/\/\*[\s\S]*?\*\//g, '')   // ブロックコメント（JSXのコメントを含む）
      .replace(/^\s*\/\/.*$/gm, '')       // 行頭からの行コメント
  }

  it('公開作品と自分が追加した作品を、別の見出しで出す', () => {
    const src = visibleSource()
    expect(src).toContain('登録されている絵本')
    expect(src).toContain('自分が追加した作品')
    expect(src).toContain('addedByMe')
  })

  it('★ 管理者向けの状態を利用者画面に出さない', () => {
    const src = visibleSource()
    for (const word of ['未公開', '確認待ち', '仮登録', 'is_active']) {
      expect(src).not.toContain(word)
    }
    const html = render()
    for (const word of ['未公開', '確認待ち', '仮登録']) {
      expect(html).not.toContain(word)
    }
  })
})
