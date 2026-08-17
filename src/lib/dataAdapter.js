import { supabase, isMissingConfig } from './supabase'
import {
  MOCK_CHILD_STATES,
  MOCK_BOOKS,
  mockSearchBooksByState,
  loadMockPracticeLogs,
  saveMockPracticeLog,
} from './mockData'

const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE ?? 'mock'
export const isMock = DATA_SOURCE !== 'supabase'

function requireSupabase() {
  if (isMissingConfig || !supabase) {
    throw new Error('Supabaseの設定がありません。.env.local を確認してください。')
  }
}

// '4歳' or '4歳児' → 4、'混合' → null
function ageGroupToInt(text) {
  if (!text || text === '混合') return null
  const m = text.match(/^(\d)歳(児)?$/)
  return m ? parseInt(m[1], 10) : null
}

// 4 → '4歳児'、null → null
function intToAgeGroup(n) {
  return n != null ? `${n}歳児` : null
}

// ['3歳児','4歳児'] → [3,4]（数値にできないものは捨てる）
function ageGroupsToInts(ages) {
  return (ages ?? []).map(ageGroupToInt).filter(n => n != null)
}

// 画面に出す年齢の文字列を作る。
// ['3歳児','4歳児'] → '3・4歳児' ／ ['2歳児'] → '2歳児' ／ [] → ''
// 記録は年齢を複数持てるので、表示側で1件目だけを出さないようにここへ集約する。
export function formatAgeGroups(ages) {
  const list = (ages ?? []).filter(Boolean).map(String)
  if (list.length === 0) return ''
  // すべてが「N歳児」の形のときだけ「3・4歳児」とまとめる
  if (list.every(a => /^\d+歳児$/.test(a))) {
    return list.map(a => a.replace('歳児', '')).join('・') + '歳児'
  }
  // 「混合」など想定外の値が混ざる古い記録は、そのまま並べて表示する
  return list.join('・')
}

// 記録1件の共通フォーマット。mockモードとsupabaseモードで同じ形を返すために使う。
// 旧データ（列が無い／キー名が違う）でも壊れないよう、必ずフォールバックを持たせる。
function normalizeLog(row) {
  // 年齢：新しい age_groups（全件）を優先し、無ければ旧 age_group（1件）を使う
  const ages = row.age_groups?.length
    ? row.age_groups.map(a => (typeof a === 'number' ? intToAgeGroup(a) : a)).filter(Boolean)
    : [intToAgeGroup(row.age_group)].filter(Boolean)
  // 008以降の記録は episode / insight を持つ。両方とも無い＝008以前の記録なので、
  // そのときだけ memo（印象と気づきの連結）を印象として表示する。
  // ※ ここで単純に episode ?? memo とすると、「気づきだけ書いた新しい記録」で
  //   気づきの文章が印象として表示されてしまうため、両方の有無で判定している。
  const isLegacy = row.episode == null && row.insight == null
  return {
    id:               row.id,
    book_title:       row.book_title  ?? '',
    book_author:      row.book_author ?? '',
    read_date:        row.read_date   ?? '',
    age_groups:       ages,
    scene:            row.scene ?? '',
    scene_activities: row.scene_activities ?? [],
    selected_by:      row.selected_by ?? '',
    // 旧mockデータは reason というキーで保存していたため両方見る
    select_reason:    row.select_reason ?? row.reason ?? '',
    reactions:        row.reactions ?? [],
    after_type:       row.after_type ?? '',
    episode:          isLegacy ? (row.memo ?? '') : (row.episode ?? ''),
    insight:          row.insight ?? '',
    next_time:        row.next_time ?? '',
  }
}

// ──── 子どもの姿 ────
export async function getChildStates() {
  if (isMock) return MOCK_CHILD_STATES
  requireSupabase()
  const { data, error } = await supabase
    .from('child_states')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id,
    label: row.name ?? '(不明)',
    category: row.category ?? '',
  }))
}

// ──── 子どもの姿：自由記述マッチ（name・synonyms・related_themesで絞り込み）────
export async function findStatesByText(query) {
  if (!query?.trim()) return []
  if (isMock) {
    const q = query.toLowerCase()
    return MOCK_CHILD_STATES.filter(s =>
      s.label?.toLowerCase().includes(q)
    ).map(s => ({ id: s.id, label: s.label }))
  }
  requireSupabase()
  const { data, error } = await supabase
    .from('child_states')
    .select('id, name, category, synonyms, related_themes')
    .eq('is_active', true)
  if (error) throw error
  const q = query.toLowerCase()
  return (data ?? [])
    .filter(row =>
      row.name?.toLowerCase().includes(q) ||
      row.synonyms?.some(s => s.toLowerCase().includes(q)) ||
      row.related_themes?.some(t => t.toLowerCase().includes(q))
    )
    .map(row => ({ id: row.id, label: row.name, category: row.category }))
}

// ──── 絵本検索 ────
export async function searchBooksByState(stateId, ageGroup = null, scene = null) {
  if (isMock) return mockSearchBooksByState(stateId)
  requireSupabase()
  // ⚠ 引数は適用済みマイグレーション 003_search_rpc.sql の関数シグネチャ
  //   search_books_by_state(p_state_id, p_age_group, p_scene) と一致させること。
  //   （季節フィルタ p_season はRPC側に存在しないため送らない。詳細は docs/current-status.md）
  const { data, error } = await supabase.rpc('search_books_by_state', {
    p_state_id:  stateId,
    p_age_group: ageGroupToInt(ageGroup),
    p_scene:     scene || null,
  })
  if (error) throw error
  return data ?? []
}

// ──── データベースに登録された絵本かどうか ────
// 実DBの絵本はUUIDのIDを持つ。サンプル・モックの絵本（'s1' 'bk-01' など）は持たない。
// 記録できるのは実DBの絵本だけなので、画面はこの判定で出し分ける。
export function isDatabaseBook(book) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(String(book?.id ?? ''))
}

// ──── 絵本のキーワード検索（書名・著者）────
// 利用者の入力を .or() の文字列に埋め込むと、','や'.'でフィルタ構文が壊れる。
// そのため書名と著者を別々の ilike で問い合わせ、id で重複を除いて統合する。
// ilike のワイルドカード('%' '_')は入力から取り除き、意図しない全件一致を防ぐ。
const BOOK_CARD_COLUMNS =
  'id, title, author, publisher, summary, care_points, next_activities, age_min, age_max'

function stripLikeWildcards(text) {
  return String(text).replace(/[%_]/g, '')
}

// 検索結果を画面が使う形に整える（子どもの姿検索の変換と同じ形にそろえる）
function toBookCard(row) {
  return {
    id:         row.id,
    title:      row.title,
    author:     row.author || '',
    publisher:  row.publisher || '',
    age:        row.age_min != null && row.age_max != null ? `${row.age_min}〜${row.age_max}歳` : '',
    emoji:      '📗',
    cover:      '#C3E6C8',
    synopsis:   row.summary || '',            // → あらすじ
    usage:      row.next_activities || '',    // → 活動例
    carePoints: row.care_points || '',        // → 読み聞かせのヒント
  }
}

export async function searchBooksByKeyword(query) {
  const raw = String(query ?? '').trim()
  if (!raw) return []

  if (isMock) {
    const q = raw.toLowerCase()
    return Object.values(MOCK_BOOKS)
      .filter(b =>
        b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q))
      .map(b => toBookCard({ ...b, id: b.book_id }))
  }

  requireSupabase()
  const pattern = `%${stripLikeWildcards(raw)}%`
  const base = () => supabase.from('books').select(BOOK_CARD_COLUMNS).eq('is_active', true)
  const [byTitle, byAuthor] = await Promise.all([
    base().ilike('title',  pattern).limit(20),
    base().ilike('author', pattern).limit(20),
  ])
  if (byTitle.error)  throw byTitle.error
  if (byAuthor.error) throw byAuthor.error

  const merged = new Map()
  for (const row of [...(byTitle.data ?? []), ...(byAuthor.data ?? [])]) {
    merged.set(row.id, row)   // 同じ絵本が両方に出ても1件にする
  }
  return [...merged.values()].map(toBookCard)
}

// ──── 絵本1冊の取得（book_id から再取得。画面遷移でstateが消えても復元できるようにする）────
export async function getBookById(id) {
  if (!id) return null
  if (isMock) {
    const b = MOCK_BOOKS[id]
    return b ? { ...b, id: b.book_id } : null
  }
  requireSupabase()
  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, publisher, summary, care_points, next_activities, age_min, age_max')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id:              data.id,
    book_id:         data.id,
    title:           data.title,
    author:          data.author ?? '',
    publisher:       data.publisher ?? '',
    summary:         data.summary ?? '',
    care_points:     data.care_points ?? '',
    next_activities: data.next_activities ?? '',
    age_min:         data.age_min,
    age_max:         data.age_max,
  }
}

// ──── 記録保存で使うエラー ────
// 画面が「何が起きたか」で出し分けられるよう、原因を code で区別する。
// 「本が無い」「同名が複数あって決められない」「通信で確認できない」を
// 同じ文言にしないための土台。
export const BOOK_LOOKUP_ERRORS = {
  TITLE_REQUIRED: 'TITLE_REQUIRED',
  NOT_FOUND:      'BOOK_NOT_FOUND',
  AMBIGUOUS:      'BOOK_AMBIGUOUS',
  LOOKUP_FAILED:  'BOOK_LOOKUP_FAILED',
}

function bookError(code, message, extra = {}) {
  const err = new Error(message)
  err.code = code
  Object.assign(err, extra)
  return err
}

// ──── 絵本を書名で探す ────
// 同名の絵本が複数あるときに1冊を勝手に選ばないよう、件数で状態を分けて返す。
//   'empty'    … タイトル未入力
//   'none'     … 該当なし
//   'one'      … 1冊に決まった
//   'multiple' … 複数あり（呼び出し側で利用者に選んでもらう）
export async function findBooksByTitle(title) {
  const t = String(title ?? '').trim()
  if (!t) return { status: 'empty', candidates: [] }

  let candidates
  if (isMock) {
    candidates = Object.values(MOCK_BOOKS)
      .filter(b => b.title === t)
      .map(b => ({ id: b.book_id, title: b.title, author: b.author ?? '', publisher: '' }))
  } else {
    requireSupabase()
    // maybeSingle() は複数件のとき data=null / error=PGRST116 を返すため使わない。
    // 件数を自分で見て「複数ある」ことを呼び出し側に伝える。
    const { data, error } = await supabase
      .from('books')
      .select('id, title, author, publisher')
      .eq('title', t)
      .limit(10)
    if (error) {
      // 通信・API側の問題。「登録されていない」と混同させない。
      throw bookError(
        BOOK_LOOKUP_ERRORS.LOOKUP_FAILED,
        '通信の問題で絵本を確認できませんでした。電波の良い場所で、もう一度お試しください。',
        { cause: error },
      )
    }
    candidates = data ?? []
  }

  if (candidates.length === 0) return { status: 'none',     candidates: [] }
  if (candidates.length === 1) return { status: 'one',      candidates, book: candidates[0] }
  return { status: 'multiple', candidates }
}

// ──── 実践記録：保存 ────
export async function savePracticeLog(formData, preStateIds = [], postStateIds = []) {
  if (isMock) return saveMockPracticeLog(formData, preStateIds, postStateIds)
  requireSupabase()

  const pad = n => String(n).padStart(2, '0')
  const today = new Date()
  const todayISO = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`
  const readDate = formData.dateMode === 'auto' ? todayISO : (formData.dateManual || todayISO)

  // book_id：検索・詳細から引き継いだ bookId を最優先。無ければ書名で探す。
  // 書名で複数見つかったときは、どれか1冊を推測せずに呼び出し側へ返す。
  let bookId = formData.bookId ?? null
  if (!bookId) {
    const found = await findBooksByTitle(formData.title)
    if (found.status === 'empty') {
      throw bookError(BOOK_LOOKUP_ERRORS.TITLE_REQUIRED, '絵本のタイトルを入力してください。')
    }
    if (found.status === 'none') {
      throw bookError(
        BOOK_LOOKUP_ERRORS.NOT_FOUND,
        'この絵本はまだデータベースに登録されていません。「絵本を探す」から絵本を選んで記録してください。',
      )
    }
    if (found.status === 'multiple') {
      throw bookError(
        BOOK_LOOKUP_ERRORS.AMBIGUOUS,
        '同じタイトルの絵本が複数あります。どの絵本か選んでください。',
        { candidates: found.candidates },
      )
    }
    bookId = found.book.id
  }

  // practice_logs に挿入
  const { data: logData, error: logError } = await supabase
    .from('practice_logs')
    .insert({
      book_id:       bookId,
      read_date:     readDate,
      // age_group（1件）は既存データ・既存の読み出しとの互換のため従来どおり書く。
      // age_groups（全件）が008で追加された本命の列。
      age_group:     ageGroupToInt(formData.ages?.[0] ?? null),
      age_groups:    ageGroupsToInts(formData.ages),
      scene:         formData.scene || null,
      scene_activities: formData.sceneActivities?.length ? formData.sceneActivities : [],
      reaction:      null,  // 4択のCHECK制約が画面の言葉と異なるため使わない（after_typeへ）
      after_type:    formData.afterType || null,
      selected_by:   formData.selectedBy || null,
      select_reason: formData.reason || null,
      // memo は008以前の記録と同じ形で書き続ける（既存の読み出し・SQL閲覧を壊さないため）。
      // 併せて episode / insight にも分けて保存し、今後はそちらを正とする。
      memo:          [formData.episode, formData.insight].filter(Boolean).join('\n\n') || null,
      episode:       formData.episode || null,
      insight:       formData.insight || null,
      interest_tags: formData.reactions?.length ? formData.reactions : [],
      next_ideas:    formData.nextTime || null,
    })
    .select('id')
    .single()
  if (logError) throw logError

  // practice_log_states に挿入（pre / post）
  const stateRows = [
    ...(preStateIds  ?? []).map(sid => ({ log_id: logData.id, state_id: sid, phase: 'pre'  })),
    ...(postStateIds ?? []).map(sid => ({ log_id: logData.id, state_id: sid, phase: 'post' })),
  ]
  if (stateRows.length > 0) {
    const { error: statesErr } = await supabase
      .from('practice_log_states')
      .insert(stateRows)
    if (statesErr) throw statesErr
  }

  return logData.id
}

// ──── 実践記録：一覧取得 ────
export async function getPracticeLogs() {
  if (isMock) return loadMockPracticeLogs().map(normalizeLog)
  requireSupabase()
  const { data, error } = await supabase
    .from('practice_logs')
    .select(`id, read_date, age_group, age_groups, scene, scene_activities,
             selected_by, select_reason, reaction, after_type, memo, episode, insight,
             interest_tags, next_ideas, created_at, books(title, author)`)
    .order('read_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => normalizeLog({
    ...row,
    book_title:  row.books?.title  ?? '',
    book_author: row.books?.author ?? '',
    reactions:   row.interest_tags?.length ? row.interest_tags
                   : row.reaction ? [row.reaction] : [],
    next_time:   row.next_ideas ?? '',
  }))
}

// ──── 実践記録：月別取得（カレンダー用） ────
export async function getPracticeLogsByMonth(year, month) {
  if (isMock) {
    const logs = loadMockPracticeLogs()
    const pad = n => String(n).padStart(2, '0')
    const prefix = `${year}-${pad(month + 1)}`
    return logs.filter(l => l.read_date?.startsWith(prefix)).map(normalizeLog)
  }
  requireSupabase()
  const pad = n => String(n).padStart(2, '0')
  const start = `${year}-${pad(month + 1)}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const end     = `${year}-${pad(month + 1)}-${pad(lastDay)}`
  const { data, error } = await supabase
    .from('practice_logs')
    .select('id, read_date, age_group, age_groups, books(title)')
    .gte('read_date', start)
    .lte('read_date', end)
    .order('read_date', { ascending: true })
  if (error) throw error
  return (data ?? []).map(row => normalizeLog({
    ...row,
    book_title: row.books?.title ?? '',
  }))
}
