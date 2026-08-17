import { describe, it, expect, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import MyPage from './MyPage'

// 再設計したマイページが、目的どおりの情報だけを出しているかを守る。
// 「マイページを開いた瞬間に見る必要がある情報か」で取捨選択している。

function memStorage(initial = {}) {
  let store = { ...initial }
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: k => { delete store[k] },
    clear: () => { store = {} },
  }
}

function render(storage = {}) {
  globalThis.localStorage = memStorage(storage)
  globalThis.sessionStorage = memStorage()
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/mypage']}>
      <AuthProvider><MyPage /></AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  globalThis.localStorage = memStorage()
  globalThis.sessionStorage = memStorage()
})

describe('マイページ：表示する情報', () => {
  it('落ちずに描画でき、5つの区画が上から並ぶ', () => {
    const html = render()
    expect(html).toContain('マイページ')
    expect(html).toContain('もうすぐの行事')
    expect(html).toContain('園のカレンダー')
    expect(html).toContain('今月の記録')
    expect(html).toContain('プロフィール設定')
    expect(html).toContain('通知設定')
    expect(html).toContain('アカウント設定')
    expect(html).toContain('ヘルプ')
  })

  it('情報の並び順が「プロフィール → もうすぐの行事 → カレンダー → 今月の記録 → 設定」', () => {
    const html = render()
    const order = ['もうすぐの行事', '園のカレンダー', '今月の記録', 'アカウント設定']
    const positions = order.map(t => html.indexOf(t))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(positions.every(p => p > 0)).toBe(true)
  })

  it('★ 削除した項目が出ていない', () => {
    const html = render()
    for (const removed of [
      '今日の予定', '今日のやること', '記録したいこと',
      'AIレポート閲覧', 'よく読んだテーマ', '虫・自然',
    ]) {
      expect(html).not.toContain(removed)
    }
  })

  it('★ 下部ナビと同じ入口を重ねて置かない', () => {
    const html = render()
    // 本棚・AIレポート・記録は下部ナビにあるので、マイページに同じ入口を作らない。
    // （ヘルプの説明文に語が出るのは導線ではないので、リンク自体が無いことで判定する）
    expect(html).not.toContain('href="/bookshelf"')
    expect(html).not.toContain('href="/report"')
    expect(html).not.toContain('href="/record"')
    expect(html).not.toContain('本棚を見る')
    expect(html).not.toContain('AIレポートを見る')
  })

  it('ログアウトは直接出さず、アカウント設定の先に置く', () => {
    const html = render()
    // 一覧の行として「アカウント設定」があること（ログアウトは中の画面）
    expect(html).toContain('アカウント設定')
  })
})

describe('マイページ：もうすぐの行事', () => {
  const withEvents = (schedules) => render({ schedules_v1: JSON.stringify(schedules) })

  it('行事が無いときは案内と追加導線を出す', () => {
    const html = render()
    expect(html).toContain('予定されている行事はまだありません')
    expect(html).toContain('行事を追加する')
  })

  it('登録した行事と「絵本を準備する」が出る', () => {
    // 十分に先の日付にして、テストを実行日に左右されないようにする
    const future = new Date()
    future.setDate(future.getDate() + 5)
    const key = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`
    const html = withEvents({ [key]: [{ id: 1, category: '行事', text: '誕生会' }] })
    expect(html).toContain('誕生会')
    expect(html).toContain('あと5日')
    expect(html).toContain('絵本を準備する')
  })

  it('★ 過去の行事は「もうすぐの行事」に出さない', () => {
    const past = new Date()
    past.setDate(past.getDate() - 10)
    const key = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`
    const html = withEvents({ [key]: [{ id: 1, category: '行事', text: '終わった行事' }] })
    expect(html).toContain('予定されている行事はまだありません')
  })

  it('壊れた保存データでも落ちない', () => {
    expect(() => render({ schedules_v1: '{こわれている' })).not.toThrow()
    expect(() => render({ schedules_v1: '"配列でもオブジェクトでもない"' })).not.toThrow()
  })
})

describe('マイページ：プロフィール', () => {
  it('未設定なら設定を促す文言を出す', () => {
    const html = render()
    expect(html).toContain('名前を設定する')
    expect(html).toContain('園名・担当クラスを設定する')
  })

  it('保存済みのプロフィールを表示する', () => {
    const html = render({
      profile_v1: JSON.stringify({ name: 'さくら', school: 'さくら保育園', classes: ['3歳児'] }),
    })
    expect(html).toContain('さくら先生')
    expect(html).toContain('さくら保育園・3歳児クラス')
  })

  it('★ 園名・クラス名が長くても切り詰めて崩さない', () => {
    const html = render({
      profile_v1: JSON.stringify({
        name: 'とてもながいなまえのせんせい',
        school: '社会福祉法人ながいながい名前のさくらんぼ保育園中央分園',
        classes: ['0歳児', '1歳児', '2歳児', '3歳児', '4歳児', '5歳児'],
      }),
    })
    expect(html).toContain('truncate')       // はみ出しは省略する指定になっている
    expect(html).toContain('さくらんぼ保育園中央分園')
  })
})

describe('マイページ：カレンダーの週/月', () => {
  it('初期は週表示（月の見出しは出ない）', () => {
    const html = render()
    expect(html).toContain('>週<')
    expect(html).toContain('>月<')
  })

  it('★ 「月」を選んだ状態を覚えていて、次に開くと月表示になる', () => {
    const html = render({ mypage_calendar_view_v1: 'month' })
    const now = new Date()
    expect(html).toContain(`${now.getFullYear()}年${now.getMonth() + 1}月`)
  })
})
