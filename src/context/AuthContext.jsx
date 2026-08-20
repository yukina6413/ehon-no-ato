import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isMock } from '../lib/dataAdapter'
import { ensureAnonymousSession } from '../lib/ensureAnonymousSession'

const AuthContext = createContext(null)

const MOCK_USER = { id: 'mock-user-001', email: 'demo@example.com' }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(isMock ? MOCK_USER : null)
  const [loading, setLoading] = useState(!isMock)

  useEffect(() => {
    if (isMock || !supabase) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // MVP：画面上のログイン操作なしで使えるよう、必要になった時点で匿名ユーザーを用意する。
  // 記録の保存前と、未登録作品の追加(create_provisional_book)前の両方から呼ぶ。
  // 既にセッションがあれば新しい匿名ユーザーを作らない（ensureAnonymousSession が保証）。
  async function ensureSession() {
    if (isMock) return MOCK_USER
    if (!supabase) return null
    const signedIn = await ensureAnonymousSession(supabase)
    if (signedIn) setUser(signedIn)   // onAuthStateChange でも更新されるが即時反映のため
    return signedIn
  }

  async function signOut() {
    if (!isMock && supabase) {
      await supabase.auth.signOut()
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user, loading, signOut,
      ensureSession,
      signInAnon: ensureSession,   // 旧名。既存の呼び出しを壊さないため残す
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
