import { describe, it, expect, beforeEach } from 'vitest'
import { ensureAnonymousSession, resetAnonymousSessionState } from './ensureAnonymousSession'

// 匿名セッションの保証。
// 記録保存の前と、未登録作品の追加(create_provisional_book)の前の両方から呼ばれる。
// 何度呼ばれても匿名ユーザーを増やさないことが最重要。

function makeClient({ session = null, signInUser = { id: 'anon-1' }, signInError = null } = {}) {
  const calls = { getSession: 0, signInAnonymously: 0 }
  return {
    calls,
    auth: {
      getSession: async () => {
        calls.getSession++
        return { data: { session }, error: null }
      },
      signInAnonymously: async () => {
        calls.signInAnonymously++
        // 実際の通信を模して1tick遅らせる（同時呼び出しの検証に必要）
        await new Promise(r => setTimeout(r, 0))
        return { data: { user: signInUser }, error: signInError }
      },
    },
  }
}

beforeEach(() => { resetAnonymousSessionState() })

describe('ensureAnonymousSession', () => {
  it('セッションが無ければ匿名ユーザーを作る', async () => {
    const client = makeClient()
    const user = await ensureAnonymousSession(client)
    expect(user).toEqual({ id: 'anon-1' })
    expect(client.calls.signInAnonymously).toBe(1)
  })

  it('★ すでにセッションがあれば新しい匿名ユーザーを作らない', async () => {
    const client = makeClient({ session: { user: { id: 'existing-user' } } })
    const user = await ensureAnonymousSession(client)
    expect(user).toEqual({ id: 'existing-user' })
    expect(client.calls.signInAnonymously).toBe(0)
  })

  it('★ 同時に呼ばれても匿名ユーザーは1人だけ作る', async () => {
    // 記録保存と未登録作品追加が近いタイミングで走る場合を想定
    const client = makeClient()
    const [a, b, c] = await Promise.all([
      ensureAnonymousSession(client),
      ensureAnonymousSession(client),
      ensureAnonymousSession(client),
    ])
    expect(client.calls.signInAnonymously).toBe(1)
    expect(a).toEqual(b)
    expect(b).toEqual(c)
  })

  it('2回目の呼び出しでは、できたセッションを使い回す', async () => {
    let session = null
    const client = makeClient()
    // 1回目でセッションができた状態を模す
    await ensureAnonymousSession(client)
    session = { user: { id: 'anon-1' } }
    client.auth.getSession = async () => ({ data: { session }, error: null })

    await ensureAnonymousSession(client)
    expect(client.calls.signInAnonymously).toBe(1)   // 増えない
  })

  it('サインインに失敗したらエラーを投げる（黙って続行しない）', async () => {
    const client = makeClient({ signInError: { message: '匿名ログインが無効です' } })
    await expect(ensureAnonymousSession(client)).rejects.toBeTruthy()
  })

  it('失敗しても次の呼び出しで再試行できる', async () => {
    const bad = makeClient({ signInError: { message: 'ng' } })
    await expect(ensureAnonymousSession(bad)).rejects.toBeTruthy()

    const good = makeClient()
    await expect(ensureAnonymousSession(good)).resolves.toEqual({ id: 'anon-1' })
  })

  it('clientが無いときはnullを返す（mockモードなど）', async () => {
    expect(await ensureAnonymousSession(null)).toBeNull()
    expect(await ensureAnonymousSession(undefined)).toBeNull()
  })
})
