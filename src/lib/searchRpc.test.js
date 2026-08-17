import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// このテストは supabaseモードでの search_books_by_state RPC 呼び出しが、
// 適用済みマイグレーション 003_search_rpc.sql の関数シグネチャ
//   search_books_by_state(p_state_id, p_age_group, p_scene)
// と一致していることを保証する。
// 過去に存在しない p_season を渡してエラー(PGRST202)になったバグの再発防止。
// （通常のdataAdapter.test.jsはmockモード。こちらは意図的にsupabaseモードで動かす）

describe('searchBooksByState（supabaseモードのRPC引数）', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_DATA_SOURCE', 'supabase')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('RPCへ渡す引数は p_state_id / p_age_group / p_scene のみ（p_season を含まない）', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    // dataAdapter が読み込む ./supabase を差し替え、実ネットワークに出さない
    vi.doMock('./supabase', () => ({
      supabase: { rpc },
      isMissingConfig: false,
    }))

    const { searchBooksByState } = await import('./dataAdapter')
    await searchBooksByState('cs-01', '4歳', '朝の会')

    expect(rpc).toHaveBeenCalledTimes(1)
    const [fnName, params] = rpc.mock.calls[0]
    expect(fnName).toBe('search_books_by_state')
    expect(Object.keys(params).sort()).toEqual(['p_age_group', 'p_scene', 'p_state_id'])
    expect(params).not.toHaveProperty('p_season')
  })

  it('年齢文字列は整数に変換して渡す（4歳 → 4、混合 → null）', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    vi.doMock('./supabase', () => ({
      supabase: { rpc },
      isMissingConfig: false,
    }))

    const { searchBooksByState } = await import('./dataAdapter')
    await searchBooksByState('cs-01', '4歳', null)

    const [, params] = rpc.mock.calls[0]
    expect(params.p_age_group).toBe(4)
    expect(params.p_scene).toBeNull()
  })
})
