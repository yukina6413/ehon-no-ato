// ──── 子どもの姿（child_states） ────
export const MOCK_CHILD_STATES = [
  { id: 'cs-01', label: '貸し借りが難しい',       category: '友だち' },
  { id: 'cs-02', label: '落ち着かない',           category: '感情' },
  { id: 'cs-03', label: '友だちとぶつかる',       category: '友だち' },
  { id: 'cs-04', label: '気持ちを伝えられない',   category: '感情' },
  { id: 'cs-05', label: '自信がない',             category: '感情' },
  { id: 'cs-06', label: '虫に夢中',               category: '自然' },
  { id: 'cs-07', label: '泣きやすい',             category: '感情' },
  { id: 'cs-08', label: '順番を待てない',         category: '友だち' },
  { id: 'cs-09', label: 'からだを動かしたい',     category: '動き' },
  { id: 'cs-10', label: 'じっとして聞きたい',     category: '動き' },
  { id: 'cs-11', label: '集中が続かない',         category: '感情' },
  { id: 'cs-12', label: '一人で遊びたがる',       category: '友だち' },
]

// ──── 絵本 ────
export const MOCK_BOOKS = {
  'bk-01': {
    book_id: 'bk-01',
    title: 'そらまめくんのベッド',
    author: 'なかやみわ',
    age_min: 3,
    age_max: 5,
    scenes: ['朝の会', '活動導入'],
    next_activities: ['友だちに大切なものを貸す体験', '素材を共有する製作活動'],
    care_points: ['所有への執着が強い時期には丁寧に取り上げを'],
    avoid_contexts: [],
    post_states_pred: ['友だちへの優しさ', '共有することへの関心'],
  },
  'bk-02': {
    book_id: 'bk-02',
    title: 'ぐりとぐら',
    author: '中川李枝子',
    age_min: 2,
    age_max: 5,
    scenes: ['活動導入', '朝の会'],
    next_activities: ['クッキング活動', '友だちと一緒に作る製作'],
    care_points: [],
    avoid_contexts: [],
    post_states_pred: ['一緒に作る楽しさ', '食への興味'],
  },
  'bk-03': {
    book_id: 'bk-03',
    title: 'てぶくろ',
    author: 'エウゲーニー・M・ラチョフ',
    age_min: 3,
    age_max: 5,
    scenes: ['活動導入', '行事前'],
    next_activities: ['みんなで入れる大きな袋づくり', 'ごっこ遊び'],
    care_points: [],
    avoid_contexts: [],
    post_states_pred: ['一緒にいる喜び', '受け入れることへの関心'],
  },
  'bk-avoid-01': {
    book_id: 'bk-avoid-01',
    title: '（避けたい場面あり絵本・テスト用）',
    author: 'テスト',
    age_min: 3,
    age_max: 5,
    scenes: [],
    next_activities: [],
    care_points: ['控えたい場面があります'],
    avoid_contexts: ['貸し借りの場面で葛藤が描かれる'],
    post_states_pred: [],
  },
  'bk-sample-01': {
    book_id: 'bk-sample-01',
    title: 'おやすみなさいおつきさま',
    author: 'M.W.ブラウン',
    age_min: 0,
    age_max: 3,
    scenes: ['午睡前'],
    next_activities: ['お月さまを見上げる散歩'],
    care_points: [],
    avoid_contexts: [],
    post_states_pred: ['落ち着き', '眠りへの移行'],
  },
  'bk-sample-02': {
    book_id: 'bk-sample-02',
    title: 'もこ もこもこ',
    author: '谷川俊太郎',
    age_min: 1,
    age_max: 3,
    scenes: ['午睡前', '自由遊び'],
    next_activities: ['粘土遊び', 'ふわふわ素材の感触遊び'],
    care_points: [],
    avoid_contexts: [],
    post_states_pred: ['集中', '言葉への興味'],
  },
}

// ──── 絵本×子どもの姿 対応（book_states） ────
// relation: 'recommend' | 'avoid'
const MOCK_BOOK_STATES = {
  'cs-01': [
    { book_id: 'bk-01', relation: 'recommend', score: 90 },
    { book_id: 'bk-02', relation: 'recommend', score: 85 },
    { book_id: 'bk-03', relation: 'recommend', score: 80 },
    { book_id: 'bk-avoid-01', relation: 'avoid', score: 0 },
  ],
  'cs-02': [
    { book_id: 'bk-sample-01', relation: 'recommend', score: 88 },
    { book_id: 'bk-sample-02', relation: 'recommend', score: 82 },
  ],
  'cs-03': [
    { book_id: 'bk-01', relation: 'recommend', score: 88 },
    { book_id: 'bk-03', relation: 'recommend', score: 80 },
  ],
  'cs-04': [
    { book_id: 'bk-02', relation: 'recommend', score: 85 },
    { book_id: 'bk-sample-02', relation: 'recommend', score: 78 },
  ],
}

export function mockSearchBooksByState(stateId) {
  const relations = MOCK_BOOK_STATES[stateId] || []
  const avoidIds = new Set(
    relations.filter(r => r.relation === 'avoid').map(r => r.book_id)
  )
  return relations
    .filter(r => r.relation === 'recommend' && !avoidIds.has(r.book_id))
    .sort((a, b) => b.score - a.score)
    .map(r => {
      const book = MOCK_BOOKS[r.book_id]
      if (!book) return null
      return {
        ...book,
        score: r.score,
        has_practice_log: false,
        has_care_points: (book.care_points?.length ?? 0) > 0,
        has_avoid_context: (book.avoid_contexts?.length ?? 0) > 0,
      }
    })
    .filter(Boolean)
}

// ──── モック実践記録（localStorage） ────
export const MOCK_PRACTICE_LOGS_KEY = 'practice_logs_v1'

export function loadMockPracticeLogs() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_PRACTICE_LOGS_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveMockPracticeLog(formData, preStateIds = [], postStateIds = []) {
  const logs = loadMockPracticeLogs()
  const pad = n => String(n).padStart(2, '0')
  const today = new Date()
  const todayISO = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`
  // キー名は practice_logs の列名に合わせる（mockとsupabaseで保存内容を揃えるため）。
  // ただし age_groups だけは表示用の文字列（'3歳児'）のまま持つ。
  // supabase側は数値[]で保存し、読み出し時に同じ文字列へ戻している（dataAdapter.normalizeLog）。
  const newLog = {
    id: `log-${Date.now()}`,
    user_id: 'mock-user-001',
    // 引き継いだ book_id をそのまま持つ（supabaseモードと同じく、保存の正本は book_id）。
    // 書名で本を探し直す形に戻さないための目印でもある。
    book_id: formData.bookId ?? null,
    book_title: formData.title || '（タイトルなし）',
    book_author: formData.author || '',
    read_date: formData.dateMode === 'auto' ? todayISO : (formData.dateManual || todayISO),
    age_groups: formData.ages || [],
    scene: formData.scene || '',
    scene_activities: formData.sceneActivities || [],
    selected_by: formData.selectedBy || '',
    select_reason: formData.reason || '',   // この絵本を選んだ理由（読み手が選んだとき）
    reactions: formData.reactions || [],
    after_type: formData.afterType || '',
    episode: formData.episode || '',
    insight: formData.insight || '',
    next_time: formData.nextTime || '',
    pre_state_ids: preStateIds,
    post_state_ids: postStateIds,
    created_at: new Date().toISOString(),
  }
  logs.unshift(newLog)
  localStorage.setItem(MOCK_PRACTICE_LOGS_KEY, JSON.stringify(logs))
  return newLog.id
}

// ──── モック：その場で追加した作品（仮登録）────
// supabaseモードでは create_provisional_book RPC が行うことを、mockモードで再現する。
// 目的は「Supabaseに繋がない状態でも、追加→記録の流れを最後まで試せる」こと。
// 実DBと同じく、仮登録した作品は通常の検索（searchBooksByKeyword）には出さない
// （実DBでは is_active=false のため）。
export const MOCK_PROVISIONAL_BOOKS_KEY = 'provisional_books_v1'

export function loadMockProvisionalBooks() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_PROVISIONAL_BOOKS_KEY) || '[]')
  } catch {
    return []
  }
}

// 実DBの book_title_key() と同じ考え方（空白・記号を落とした小文字）で書名を比べる
function mockTitleKey(title) {
  return String(title ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・･、。，．,.!！?？「」『』（）()【】\-‐-―ー~〜:：;；]/g, '')
}

/**
 * create_provisional_book RPC の mock版。返す形も同じにする。
 *   { book_id, status: 'existing' | 'created' | 'candidates', candidates }
 */
export function mockCreateProvisionalBook({
  title, materialType, author = '', illustrator = '', publisher = '',
  isbn13 = null, publishedYear = null, forceNew = false,
}) {
  const provisional = loadMockProvisionalBooks()
  const all = [
    ...Object.values(MOCK_BOOKS).map(b => ({
      id: b.book_id, title: b.title, author: b.author ?? '', publisher: '',
      isbn13: null, material_type: 'picture_book',
    })),
    ...provisional,
  ]

  // ① ISBNが一致する作品があれば、それを使う（重複を作らない）
  if (isbn13) {
    const hit = all.find(b => b.isbn13 && b.isbn13 === isbn13)
    if (hit) return { book_id: hit.id, status: 'existing', candidates: [] }
  }

  // ② 書名と種別が同じ作品があれば、作らずに候補を返す（人に選んでもらう）
  if (!forceNew) {
    const key = mockTitleKey(title)
    const cands = all.filter(b =>
      mockTitleKey(b.title) === key && (b.material_type ?? 'picture_book') === materialType)
    if (cands.length > 0) {
      return {
        book_id: null,
        status: 'candidates',
        candidates: cands.map(b => ({
          id: b.id, title: b.title, author: b.author ?? '',
          publisher: b.publisher ?? '', material_type: b.material_type ?? 'picture_book',
          published_year: b.published_year ?? null, is_active: b.is_active ?? true,
        })),
      }
    }
  }

  // ③ 仮登録する
  const created = {
    id: crypto.randomUUID(),   // 実DBと同じくUUID（isDatabaseBook が真になる）
    title: String(title).trim(),
    author, illustrator, publisher,
    isbn13,
    published_year: publishedYear,
    material_type: materialType,
    is_active: false,
  }
  localStorage.setItem(
    MOCK_PROVISIONAL_BOOKS_KEY, JSON.stringify([...provisional, created]))
  return { book_id: created.id, status: 'created', candidates: [] }
}
