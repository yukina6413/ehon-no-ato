// ============================================================
// 画面の「最後に使った状態」を覚えるための保存
// ============================================================
// 設定画面でわざわざ選ばせるのではなく、操作した結果を覚えておく方針。
// Supabaseに持つほどの情報ではないので localStorage に置く（DB変更なし）。
// ============================================================

const CAL_VIEW_KEY = 'mypage_calendar_view_v1'
const PROFILE_KEY  = 'profile_v1'

export const DEFAULT_PROFILE = {
  name: '', school: '', role: '保育士', classes: [], position: '一般',
}

// ──── カレンダーの週/月表示 ────
// スマホで見やすく情報量も抑えられるため、初期値は「週」。
export function loadCalendarView() {
  try {
    const v = localStorage.getItem(CAL_VIEW_KEY)
    return v === 'month' ? 'month' : 'week'
  } catch {
    return 'week'
  }
}

export function saveCalendarView(view) {
  try {
    localStorage.setItem(CAL_VIEW_KEY, view === 'month' ? 'month' : 'week')
  } catch { /* 無視 */ }
}

// ──── プロフィール ────
// 以前は画面を離れると消えていた（メモリ上だけだった）ため保存する。
export function loadProfile() {
  try {
    const stored = localStorage.getItem(PROFILE_KEY)
    const parsed = stored ? JSON.parse(stored) : null
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PROFILE }
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      classes: Array.isArray(parsed.classes) ? parsed.classes : [],
    }
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch { /* 無視 */ }
}

// プロフィール行の2段目「さくら保育園・3歳児クラス」を作る。
// 未入力の項目は出さない（空の「・」が残らないように）。
export function profileSubtitle(profile) {
  const cls = profile?.classes?.length ? `${profile.classes.join('・')}クラス` : ''
  return [profile?.school, cls].filter(Boolean).join('・')
}
