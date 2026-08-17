// ============================================================
// 園の予定（行事）の保存と「もうすぐの行事」の計算
// ============================================================
// 保存先は既存の localStorage キー 'schedules_v1' のまま。
// 形式も既存のまま { '2026-08-21': [{ id, category, text, time }] } を守る。
// （ホーム画面の「読む予定に入れる」も同じキーに書き込むため、変えると壊れる）
//
// この機能の目的はスケジュール管理ではなく、
// 「園の行事を少し前に思い出して、絵本を準備できるようにする」こと。
// ============================================================

export const SCHEDULES_KEY = 'schedules_v1'

// カテゴリ→アイコン。予定追加シートと共通の分類を使う。
export const CATEGORY_EMOJI = {
  '行事':       '🎏',
  '保護者対応': '👪',
  '製作':       '✂️',
  '会議':       '📋',
  '避難訓練':   '🚨',
  '自由入力':   '📝',
}

// 行事名からそれらしい絵文字を選ぶ（園の行事マスタと同じ見た目にするため）
const NAME_EMOJI = [
  ['誕生',   '🎂'], ['避難',   '🧯'], ['防災',   '🚨'], ['運動会', '🏃'],
  ['発表',   '🎭'], ['遠足',   '🧺'], ['プール', '🏊'], ['夏祭',   '🏮'],
  ['七夕',   '🎋'], ['クリスマス', '🎄'], ['お正月', '🎍'], ['節分',   '👹'],
  ['ひな',   '🎎'], ['入園',   '🌸'], ['卒園',   '🎓'], ['健診',   '🩺'],
  ['健康診断', '🩺'], ['身体測定', '📏'], ['芋掘',  '🍠'], ['参観',   '👀'],
  ['お月見', '🍡'], ['収穫',   '🌾'], ['作品展', '🎨'], ['音楽会', '🎵'],
]

export function eventEmoji(item) {
  const text = item?.text ?? ''
  for (const [word, emoji] of NAME_EMOJI) {
    if (text.includes(word)) return emoji
  }
  return CATEGORY_EMOJI[item?.category] ?? '📌'
}

export function toDateKey(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// '2026-08-21' → Date（時刻は0時。日数計算を時刻に左右させないため）
export function keyToDate(key) {
  const [y, m, d] = String(key).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

// 今日から見て何日後か。今日=0、昨日=-1、明日=1
export function daysUntil(key, today = new Date()) {
  const target = keyToDate(key)
  if (!target) return null
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((target - base) / 86400000)
}

// 「あと7日」「今日」「明日」の表示文言
export function daysLeftLabel(days) {
  if (days == null) return ''
  if (days === 0) return '今日'
  if (days === 1) return '明日'
  return `あと${days}日`
}

export function loadSchedules() {
  try {
    const stored = localStorage.getItem(SCHEDULES_KEY)
    const parsed = stored ? JSON.parse(stored) : null
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}   // 壊れていても画面は落とさない
  }
}

export function saveSchedules(data) {
  try {
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(data))
  } catch { /* 容量超過等は無視 */ }
}

// 予定をすべて {dateKey, item} の平らな配列にして日付順に並べる
function flatten(schedules) {
  return Object.entries(schedules ?? {})
    .flatMap(([dateKey, items]) =>
      (Array.isArray(items) ? items : []).map(item => ({ dateKey, item })))
    .filter(x => keyToDate(x.dateKey))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
}

// 「もうすぐの行事」＝今日以降のものだけを、近い順に limit 件。
// 過去の行事は出さない（当日は残す）。
export function getUpcomingEvents(schedules, today = new Date(), limit = 2) {
  return flatten(schedules)
    .map(({ dateKey, item }) => ({
      dateKey,
      item,
      daysLeft: daysUntil(dateKey, today),
      emoji: eventEmoji(item),
    }))
    .filter(e => e.daysLeft != null && e.daysLeft >= 0)
    .slice(0, limit)
}

// 指定した年月（monthは0始まり）の予定を日付順に返す
export function getEventsOfMonth(schedules, year, month) {
  const pad = n => String(n).padStart(2, '0')
  const prefix = `${year}-${pad(month + 1)}`
  return flatten(schedules)
    .filter(x => x.dateKey.startsWith(prefix))
    .map(({ dateKey, item }) => ({ dateKey, item, emoji: eventEmoji(item) }))
}

// 週の7日ぶんの日付キー（日曜はじまり）
export function getWeekKeys(today = new Date()) {
  const sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i)
    return toDateKey(d)
  })
}
