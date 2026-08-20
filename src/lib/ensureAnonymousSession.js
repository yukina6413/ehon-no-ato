// ============================================================
// 匿名セッションの保証
// ============================================================
// 「えほんのあと」はログイン操作なしで使えることが前提。
// Supabaseへ書き込む処理の直前に、匿名セッションがあることを保証する。
//
// 使う場所は2つ：
//   ・practice_logs への保存（記録を保存する直前）
//   ・create_provisional_book() の実行前（未登録作品をその場で追加するとき）
//
// 【重要】すでに有効なセッションがあれば、新しい匿名ユーザーを作らない。
//   - Reactのstateは古いことがあるため、実際のセッションを毎回確認する
//   - 同時に複数箇所から呼ばれても、匿名ユーザーは1人しか作らない
//     （進行中の呼び出しを共有する）
// ============================================================

let pending = null   // 進行中の匿名サインイン。同時呼び出しをまとめる

export async function ensureAnonymousSession(client) {
  if (!client) return null

  // ① 実際のセッションを確認する（stateではなくSupabaseに聞く）
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  if (data?.session?.user) return data.session.user

  // ② 無ければ匿名ユーザーを作る。同時に呼ばれても1回だけ実行する。
  if (!pending) {
    pending = client.auth.signInAnonymously()
      .then(({ data: signInData, error: signInError }) => {
        if (signInError) throw signInError
        return signInData?.user ?? null
      })
      .finally(() => { pending = null })
  }
  return pending
}

// テスト用。進行中の状態を捨てる。
export function resetAnonymousSessionState() {
  pending = null
}
