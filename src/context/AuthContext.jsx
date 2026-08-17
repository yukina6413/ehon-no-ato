import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isMock } from '../lib/dataAdapter'

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

  // MVP：画面上のログイン操作なしで記録できるよう、匿名ユーザーを作成する。
  // 既にセッションがあれば作らずそのユーザーを使う。将来メール登録へ引き継ぐ土台。
  async function signInAnon() {
    if (isMock) return MOCK_USER
    if (!supabase) return null
    if (user) return user
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    setUser(data.user ?? null)  // onAuthStateChange でも更新されるが即時反映のため
    return data.user ?? null
  }

  async function signOut() {
    if (!isMock && supabase) {
      await supabase.auth.signOut()
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, signInAnon }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
