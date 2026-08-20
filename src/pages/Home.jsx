import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Search, X, Heart, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, PenLine } from 'lucide-react'
import {
  searchBooksByState, findStatesByText, searchBooksByKeyword, isDatabaseBook,
} from '../lib/dataAdapter'
import AddWorkPanel from '../components/AddWorkPanel'
import {
  SEASONS, SEASON_THEMES_FULL, NURSERY_EVENT_GROUPS,
  getSeasonCandidates, getHolidayCandidates,
  getCalendarEventCandidates, getHolidaysByFiscalMonth,
  seasonOfMonth, nextSeasonId,
} from '../data/seasonEvents'

// ──── 日付 ────
function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

// ──── テーマの入口（普遍テーマ）────
// 季節・行事/祝日/暦の行事/園の行事は src/data/seasonEvents.js のマスターデータで扱う。
// ※「自然」はトップの入口からは削除（季節と重複が大きいため）。
const UNIVERSAL_THEMES = [
  {
    id: 'creature', emoji: '🐛', label: '生きもの',
    // 生きものは2階層（大分類→具体）。中身は CREATURE_GROUPS を参照
  },
  {
    id: 'life', emoji: '🏠', label: '生活',
    subThemes: [
      { emoji: '🍽️', label: '食事' },    { emoji: '😴', label: 'おやすみ' },
      { emoji: '🚿', label: 'トイレ' },   { emoji: '👕', label: '着替え' },
      { emoji: '🧹', label: 'お片付け' }, { emoji: '🛁', label: 'お風呂' },
    ],
  },
  {
    id: 'emotion', emoji: '💭', label: '気持ち',
    subThemes: [
      { emoji: '😢', label: '泣く・悲しい' }, { emoji: '😠', label: '怒る' },
      { emoji: '😊', label: '嬉しい' },       { emoji: '😰', label: '怖い' },
      { emoji: '❤️', label: '好き・愛情' },  { emoji: '🤔', label: 'ふしぎ' },
    ],
  },
  {
    id: 'friends', emoji: '👫', label: '友だち・関係',
    subThemes: [
      { emoji: '🤝', label: '仲良し' },       { emoji: '😤', label: 'けんか・仲直り' },
      { emoji: '💪', label: '協力・助け合い' }, { emoji: '🌈', label: 'ちがいを知る' },
      { emoji: '🎮', label: '一緒に遊ぶ' },
    ],
  },
]

// getSubThemes 等が id から小テーマを引くためのリスト（普遍テーマのみ）
const ALL_THEMES = UNIVERSAL_THEMES

// ──── 「生きもの」の2階層データ：大分類 → 具体的な生きもの ────
// ※ 保育現場で子どもが出会いやすい身近な生きものを中心に。厳密な生物学分類は優先しない。
//   同じ生きものを複数タグから見つけられる設計は将来許容（今回はDB構造は変更しない）。
const CREATURE_GROUPS = [
  { label: '虫', emoji: '🐛', items: [
    { emoji: '🪲', label: 'カブトムシ' },  { emoji: '🪲', label: 'クワガタ' },
    { emoji: '🦋', label: 'ちょう' },      { emoji: '🐛', label: 'ダンゴムシ' },
    { emoji: '🐝', label: 'セミ' },        { emoji: '🦗', label: 'トンボ' },
    { emoji: '🐜', label: 'アリ' },        { emoji: '🦗', label: 'カマキリ' },
    { emoji: '🐞', label: 'てんとうむし' }, { emoji: '🐌', label: 'かたつむり' },
  ]},
  { label: '動物', emoji: '🐰', items: [
    { emoji: '🐰', label: 'うさぎ' }, { emoji: '🐱', label: 'ねこ' },
    { emoji: '🐶', label: 'いぬ' },   { emoji: '🐘', label: 'ぞう' },
    { emoji: '🐻', label: 'くま' },   { emoji: '🐿️', label: 'りす' },
  ]},
  { label: '鳥', emoji: '🐦', items: [
    { emoji: '🐦‍⬛', label: 'からす' }, { emoji: '🐦', label: 'すずめ' },
    { emoji: '🕊️', label: 'はと' },    { emoji: '🐦', label: 'つばめ' },
  ]},
  { label: '水の生きもの', emoji: '🐟', items: [
    { emoji: '🐟', label: 'さかな' }, { emoji: '🐟', label: 'めだか' },
    { emoji: '🦀', label: 'かに' },   { emoji: '🦞', label: 'ざりがに' },
  ]},
  { label: 'は虫類・両生類', emoji: '🐸', items: [
    { emoji: '🐸', label: 'かえる' }, { emoji: '🐢', label: 'かめ' },
    { emoji: '🦎', label: 'とかげ' }, { emoji: '🦎', label: 'やもり' },
    { emoji: '🐍', label: 'へび' },
  ]},
  { label: '恐竜', emoji: '🦕', items: [
    { emoji: '🦕', label: '恐竜' },
  ]},
]

// ──── 「子どもの姿・保育士の思いから探す」の補助候補（子どもの姿＋保育士の思い/ねらいを含む）────
const CONSULT_SUGGESTIONS = [
  '虫探しが好き', '順番が待てない', '食べ残しが多い', '貸し借りが難しい',
  '午睡前に落ち着きたい', 'ルールを伝えたい', '身体を動かしたい',
]

// ──── 折りたたみセクション ────
function Section({ icon, label, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white border border-[#DCE4D9] rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left">
        <span className="text-xs font-bold text-[#2C2C2A] flex items-center gap-2">
          <span className="text-base leading-none">{icon}</span>{label}
        </span>
        {open
          ? <ChevronUp   size={14} className="text-[#8A8A85] flex-shrink-0" />
          : <ChevronDown size={14} className="text-[#8A8A85] flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-[#F0EDE6]">
          {children}
        </div>
      )}
    </div>
  )
}

// ──── 絵本詳細モーダル ────
function BookDetailModal({ book, onClose, onWantToRead }) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  // データベースに登録されている絵本か（IDがUUIDのもの）。
  // 登録されていない絵本は記録できないので、記録ボタン自体を出さない。
  // 4ステップ入力し終えてから保存時に失敗する、という体験を防ぐため。
  const isDbBook = isDatabaseBook(book)

  // 記録画面へ絵本を引き継ぐ。bookId を渡すので、保存時に書名で探す必要がない。
  function recordThisBook() {
    navigate('/record', {
      state: {
        bookId:     book.id,
        bookTitle:  book.title,
        bookAuthor: book.author || '',
      },
    })
  }

  function copyParentMessage() {
    if (!book.parentMessage) return
    navigator.clipboard?.writeText(book.parentMessage).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F2F5F0]">
      <div className="px-4 pt-10 pb-4 flex items-center gap-3 flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #1E6B38, #2E7D46)' }}>
        <button onClick={onClose} className="text-[#A8D4B4] p-1">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-white text-[15px] font-bold flex-1 truncate">{book.title}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5 pb-28">
        <div className="bg-white border border-[#DCE4D9] rounded-2xl p-4 flex gap-4 items-start">
          <div className="w-20 h-24 rounded-xl flex items-center justify-center text-4xl flex-shrink-0"
            style={{ background: book.cover }}>{book.emoji}</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-[#2C2C2A] leading-snug">{book.title}</h2>
            <p className="text-xs text-[#8A8A85] mt-0.5">
              {[book.author, book.publisher].filter(Boolean).join('・')}
            </p>
            {/* 追加したばかりの作品は対象年齢が空。中身の無い見出しを出さない */}
            {book.age && (
              <span className="inline-block mt-2 text-[10px] bg-[#EAF5EC] text-green-700 rounded-full px-2 py-0.5">
                対象年齢：{book.age}
              </span>
            )}
          </div>
        </div>

        {book.synopsis && (
          <Section icon="📖" label="あらすじ" defaultOpen>
            <p className="text-sm text-[#5A5A57] leading-relaxed pt-2">{book.synopsis}</p>
          </Section>
        )}
        {book.aim && (
          <Section icon="🎯" label="保育のねらい" defaultOpen>
            <p className="text-sm text-[#5A5A57] leading-relaxed pt-2">{book.aim}</p>
          </Section>
        )}
        {book.carePoints && (
          <Section icon="🗣️" label="読み聞かせのヒント" defaultOpen>
            <p className="text-sm text-[#5A5A57] leading-relaxed pt-2">{book.carePoints}</p>
          </Section>
        )}
        {book.readingTips && (
          <Section icon="🗣️" label="読み方のヒント">
            {[
              { phase: '読む前に',      text: book.readingTips.before },
              { phase: '読んでいる途中', text: book.readingTips.during },
              { phase: '読み終わったあと', text: book.readingTips.after },
            ].map(({ phase, text }) => (
              <div key={phase} className="mt-3 first:mt-2">
                <p className="text-[10px] font-bold text-green-700 mb-1">▸ {phase}</p>
                <p className="text-sm text-[#5A5A57] leading-relaxed">{text}</p>
              </div>
            ))}
          </Section>
        )}
        <Section icon="✨" label="子どもとの対話のきっかけ">
          <p className="text-sm text-[#5A5A57] leading-relaxed pt-2">{book.reaction}</p>
        </Section>
        {book.childBehaviors && (
          <Section icon="👁️" label="この絵本で見えやすい子どもの姿">
            <div className="flex flex-col gap-2 pt-2">
              {book.childBehaviors.map(b => (
                <div key={b} className="flex items-start gap-2">
                  <span className="text-green-400 mt-1 flex-shrink-0 text-[8px]">●</span>
                  <p className="text-sm text-[#5A5A57] leading-relaxed">{b}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
        {book.parentMessage && (
          <Section icon="💌" label="保護者へのおすすめ文">
            <div className="mt-2 bg-[#EAF5EC] rounded-xl px-4 py-3">
              <p className="text-sm text-[#1B4D2B] leading-relaxed">{book.parentMessage}</p>
            </div>
            <button onClick={copyParentMessage}
              className={`mt-2.5 w-full text-xs rounded-xl py-2.5 border transition-colors font-medium
                ${copied ? 'bg-green-600 text-white border-green-600' : 'border-[#DCE4D9] text-[#5A5A57] active:bg-[#EAF5EC]'}`}>
              {copied ? '✓ コピーしました' : 'おたより・配信用にコピーする'}
            </button>
          </Section>
        )}
        {book.homeActivity && (
          <Section icon="🏠" label="家庭での楽しみ方">
            <p className="text-sm text-[#5A5A57] leading-relaxed pt-2">{book.homeActivity}</p>
          </Section>
        )}
        {book.usage && (
          <Section icon="💡" label="活動例">
            <p className="text-sm text-[#5A5A57] leading-relaxed pt-2">{book.usage}</p>
          </Section>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E0E8DC] px-4 pt-3 pb-8 max-w-lg mx-auto flex flex-col gap-2">
        {isDbBook ? (
          <button onClick={recordThisBook}
            className="w-full bg-green-700 text-white rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2">
            <PenLine size={16} /> この絵本を記録する
          </button>
        ) : (
          <p className="text-xs text-[#8A8A85] leading-relaxed text-center px-2">
            この絵本はまだデータベースに登録されていないため、記録できません
          </p>
        )}
        <button onClick={() => onWantToRead(book)}
          className="w-full bg-white border border-green-600 text-green-700 rounded-2xl py-3 font-bold text-sm flex items-center justify-center gap-2">
          <Heart size={16} /> 読みたい
        </button>
      </div>
    </div>
  )
}

// ──── 読みたい登録シート ────
function WantToReadSheet({ book, onClose, onConfirm }) {
  const [mode,      setMode]      = useState('select')
  const [dateInput, setDateInput] = useState('')
  const today    = new Date()
  const todayKey = toDateKey(today)
  const friday   = new Date(today)
  friday.setDate(today.getDate() + (5 - today.getDay()))
  const fridayKey = toDateKey(friday)

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-4 pt-4 pb-8 flex flex-col gap-4 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-[#2C2C2A]">いつ読む？</p>
          <button onClick={onClose}><X size={18} className="text-[#8A8A85]" /></button>
        </div>
        <div className="flex items-center gap-3 bg-[#EAF5EC] rounded-xl px-3 py-2.5">
          <span className="text-xl">{book.emoji}</span>
          <p className="text-sm font-medium text-green-900">{book.title}</p>
        </div>
        {mode === 'select' ? (
          <div className="flex flex-col gap-2">
            {[
              { label: '今日',    desc: '今日の予定に追加',  icon: '📅', key: todayKey  },
              { label: '今週中',  desc: '今週の予定に追加',  icon: '📆', key: fridayKey },
              { label: '日付指定', desc: '日付を選んで登録', icon: '🗓️', key: 'pick'    },
            ].map(opt => (
              <button key={opt.label}
                onClick={() => opt.key === 'pick' ? setMode('date') : onConfirm(book, opt.key)}
                className="flex items-center gap-3 border border-[#DCE4D9] rounded-2xl px-4 py-3 text-left active:bg-[#EAF5EC] transition-colors">
                <span className="text-xl">{opt.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#2C2C2A]">{opt.label}</p>
                  <p className="text-xs text-[#8A8A85]">{opt.desc}</p>
                </div>
                <ChevronRight size={16} className="text-[#B0B0A8]" />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button onClick={() => setMode('select')} className="text-xs text-[#8A8A85] flex items-center gap-1 self-start">
              <ChevronLeft size={12} /> 戻る
            </button>
            <input type="date" value={dateInput} min={todayKey}
              onChange={e => setDateInput(e.target.value)}
              className="w-full text-sm border border-[#DCE4D9] rounded-xl px-3 py-2.5 outline-none focus:border-green-400" />
            <button onClick={() => dateInput && onConfirm(book, dateInput)} disabled={!dateInput}
              className={`w-full py-3 rounded-2xl text-sm font-bold
                ${dateInput ? 'bg-green-600 text-white' : 'bg-[#E8E6E0] text-[#B0B0A8]'}`}>
              この日に登録する
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ──── 絵本カード ────
function HomeBookCard({ book, onTap }) {
  return (
    <button onClick={() => onTap(book)}
      className="flex items-center gap-3 border border-[#DCE4D9] rounded-xl px-3 py-2.5 w-full text-left active:bg-[#F4F8F2] transition-colors bg-white">
      <div className="w-10 h-12 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: book.cover }}>{book.emoji}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#2C2C2A] truncate">{book.title}</p>
        {/* 著者・年齢が空の作品もあるため、あるものだけを並べる（「・」だけが残らないように） */}
        <p className="text-[11px] text-[#8A8A85]">
          {[book.author, book.age].filter(Boolean).join('・')}
        </p>
      </div>
      <ChevronRight size={14} className="text-[#B0B0A8] flex-shrink-0" />
    </button>
  )
}

// ──── 検索結果ブロック ────
function ResultsBlock({ books, label, onTap }) {
  return (
    <div className="mt-3 pt-3 border-t border-[#F0EDE6]">
      {label && <p className="text-[10px] font-bold text-[#8A8A85] tracking-wide mb-2">{label}</p>}
      <div className="flex flex-col gap-2">
        {books.map(book => <HomeBookCard key={book.id} book={book} onTap={onTap} />)}
      </div>
    </div>
  )
}

// ──── メインコンポーネント ────
export default function Home() {
  const today   = new Date()
  const DAYS    = ['日', '月', '火', '水', '木', '金', '土']
  const dateStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日（${DAYS[today.getDay()]}）`

  // ① 絵本・紙芝居を探す（実DBを書名・著者で検索する）
  const [searchQuery,   setSearchQuery]   = useState('')
  // 実際に検索した言葉。入力欄をあとから書き換えられても、
  // 「この作品を追加する」で使う書名がずれないように分けて持つ。
  const [searchedQuery, setSearchedQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError,   setSearchError]   = useState(null)

  async function handleSearch(q) {
    const query = (q !== undefined ? q : searchQuery).trim()
    if (!query) return
    setSearchLoading(true)
    setSearchError(null)
    setSearchResults(null)
    setSearchedQuery(query)
    try {
      // 0件でもサンプルで埋めない。実際に登録されている絵本だけを出す。
      setSearchResults(await searchBooksByKeyword(query))
    } catch (err) {
      console.error('絵本検索エラー:', err)
      setSearchError('絵本を検索できませんでした。通信の状態をご確認ください。')
    } finally {
      setSearchLoading(false)
    }
  }

  // 検索結果は「登録されている絵本」と「自分が追加した作品」に分けて出す。
  // どちらも同じように選んで記録できる（導線は変えない）。
  const publicResults  = searchResults?.filter(b => !b.addedByMe) ?? []
  const myAddedResults = searchResults?.filter(b =>  b.addedByMe) ?? []

  // ② 子どもの姿・保育士の思いから探す
  //    補助候補・自由入力のどちらもテキストとして扱い、findStatesByText で
  //    近い「子どもの姿」を見つけて実DB検索する（AISearch画面と同じ経路）。
  const [consultQuery,   setConsultQuery]   = useState('')
  const [consultResults, setConsultResults] = useState(null)
  const [consultLoading, setConsultLoading] = useState(false)

  async function handleConsult(queryText) {
    const q = (queryText ?? consultQuery).trim()
    if (!q) return
    setConsultQuery(q)
    setConsultLoading(true)
    setConsultResults(null)
    try {
      const matches = await findStatesByText(q)
      if (matches.length === 0) {
        setConsultResults([])
        return
      }
      const data = await searchBooksByState(matches[0].id, null, null)
      setConsultResults(data.map(b => ({
        id: b.book_id,
        title: b.title,
        author: b.author || '',
        age: b.age_min != null && b.age_max != null ? `${b.age_min}〜${b.age_max}歳` : '',
        emoji: '📗',
        cover: '#C3E6C8',
        // DBの実データを詳細画面のプロパティ名に合わせて引き継ぐ
        synopsis:   b.summary || '',            // → あらすじ
        usage:      b.next_activities || '',    // → 活動例
        carePoints: b.care_points || '',        // → 読み聞かせのヒント
      })))
    } catch (err) {
      console.error('絵本検索エラー:', err)
      setConsultResults([])
    } finally {
      setConsultLoading(false)
    }
  }

  // マイページの「絵本を準備する」から行事名を受け取ったら、そのまま検索して結果まで出す。
  // （行事 → 絵本を探す → 読む → 記録する、の循環につなげるための入口）
  const location = useLocation()
  const prepareQuery = location.state?.prepareQuery
  useEffect(() => {
    if (!prepareQuery) return
    // 描画が済んでから実行する（検索欄の位置が確定してからスクロールするため）
    const timer = setTimeout(() => {
      handleConsult(prepareQuery)
      // 結果が画面外だと気づけないため、検索欄まで移動する
      document.getElementById('consult-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepareQuery])

  // ③ おすすめテーマ（大テーマ → 小テーマ）
  const [selectedBigTheme,  setSelectedBigTheme]  = useState(null)
  const [subThemeResults,   setSubThemeResults]   = useState(null)
  const [selectedSubTheme,  setSelectedSubTheme]  = useState(null)
  const [selectedCreatureGroup, setSelectedCreatureGroup] = useState(null)  // 生きものの大分類

  // 季節・行事から探す（季節 / 行事[祝日・暦の行事・園の行事]）
  const [seTab,        setSeTab]        = useState(null)   // 'season' | 'event'
  const [eventSubcat,  setEventSubcat]  = useState(null)   // 'holiday' | 'calendar' | 'nursery'
  const [showAllSeason, setShowAllSeason] = useState(false)
  const [showAllHoliday, setShowAllHoliday] = useState(false)
  const [openHoliday,  setOpenHoliday]  = useState(null)   // 詳細（子ども向け説明）を開いた祝日名

  function resetSeLeaf() {
    setSubThemeResults(null)
    setSelectedSubTheme(null)
    setOpenHoliday(null)
  }
  function selectSeTab(tab) {
    setSeTab(prev => prev === tab ? null : tab)
    setEventSubcat(null)
    setShowAllSeason(false)
    setShowAllHoliday(false)
    resetSeLeaf()
  }
  function selectEventSubcat(sc) {
    setEventSubcat(prev => prev === sc ? null : sc)
    setShowAllHoliday(false)
    resetSeLeaf()
  }

  function handleBigThemeSelect(id) {
    const next = id === selectedBigTheme ? null : id
    setSelectedBigTheme(next)
    setSubThemeResults(null)
    setSelectedSubTheme(null)
    setSelectedCreatureGroup(null)
  }

  // 季節・行事・テーマからの検索は、まだ実データ（seasonal_tags / event_tags）が
  // 足りていない。サンプルの絵本で埋めると「登録済みの絵本」と誤解されるため、
  // 現在の実データに基づいて「まだ登録されていない」ことをそのまま伝える。
  function handleSubThemeSelect(label) {
    setSelectedSubTheme(label)
    setSubThemeResults([])
  }

  function getSubThemes(bigThemeId) {
    return ALL_THEMES.find(t => t.id === bigThemeId)?.subThemes || []
  }

  // 絵本詳細・読みたい
  const [selectedBook,   setSelectedBook]   = useState(null)
  const [wantToReadBook, setWantToReadBook] = useState(null)
  const [toast,          setToast]          = useState(null)

  function handleWantToReadConfirm(book, dateKey) {
    const stored = JSON.parse(localStorage.getItem('wantToRead_books') || '[]')
    if (!stored.find(b => b.id === book.id)) {
      localStorage.setItem('wantToRead_books', JSON.stringify([...stored, { id: book.id, title: book.title, emoji: book.emoji }]))
    }
    const schedules = JSON.parse(localStorage.getItem('schedules_v1') || '{}')
    schedules[dateKey] = [...(schedules[dateKey] || []), { id: Date.now(), category: '行事', text: `📖 ${book.title} を読む`, time: '' }]
    localStorage.setItem('schedules_v1', JSON.stringify(schedules))
    setWantToReadBook(null)
    setSelectedBook(null)
    setToast(`「${book.title}」を読みたいリストに追加しました`)
    setTimeout(() => setToast(null), 3000)
  }

  // 小テーマ／具体候補チップの共通クラス
  const chipCls = active => `flex items-center gap-1.5 rounded-full px-3 py-1.5 border transition-colors
    ${active ? 'bg-green-600 text-white border-green-600'
             : 'bg-[#F2F5F0] border-[#DCE4D9] text-[#5A5A57] active:bg-[#EAF5EC]'}`

  // 候補チップ（葉：タップで絵本候補へ）。{ n:名前, i:アイコン } を受け取る
  const leafChip = (name, icon, key) => (
    <button key={key ?? name} onClick={() => handleSubThemeSelect(name)} className={chipCls(selectedSubTheme === name)}>
      <span className="text-sm">{icon}</span>
      <span className="text-xs">{name}</span>
    </button>
  )
  // 絵本結果ブロック（葉を選んだとき）
  const resultBlock = () => subThemeResults && (
    <div className="mt-3 pt-3 border-t border-[#F0EDE6]">
      {subThemeResults.length === 0 ? (
        <p className="text-xs text-[#8A8A85] leading-relaxed">
          「{selectedSubTheme}」に関連する絵本は、まだ登録されていません
        </p>
      ) : (
        <>
          <p className="text-[10px] font-bold text-[#8A8A85] tracking-wide mb-2">「{selectedSubTheme}」の絵本</p>
          <div className="flex flex-col gap-2">
            {subThemeResults.map(book => <HomeBookCard key={book.id} book={book} onTap={setSelectedBook} />)}
          </div>
        </>
      )}
    </div>
  )

  // ──── 季節・行事から探す（季節 / 行事[祝日・暦の行事・園の行事]）────
  const currentSeasonId = seasonOfMonth(today.getMonth() + 1)
  const renderSeasonEventSection = () => (
    <div className="bg-white border border-[#DCE4D9] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm leading-none">🗓️</span>
        </div>
        <p className="text-sm font-bold text-[#2C2C2A]">季節・行事から探す</p>
      </div>
      <p className="text-xs text-[#8A8A85] mb-3">これからの時期に読みたい季節や行事から探せます</p>

      {/* 大分類：季節 / 行事（2項目を均等配置＝余白を自然に） */}
      <div className="grid grid-cols-2 gap-2">
        {[{ id: 'season', emoji: '🌸', label: '季節' }, { id: 'event', emoji: '🎏', label: '行事' }].map(t => (
          <button key={t.id} onClick={() => selectSeTab(t.id)}
            className={`w-full flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl border transition-colors
              ${seTab === t.id ? 'bg-green-600 text-white border-green-600'
                              : 'bg-[#F2F5F0] border-[#DCE4D9] text-[#5A5A57] active:bg-[#EAF5EC]'}`}>
            <span className="text-xl">{t.emoji}</span>
            <span className="text-[11px] font-medium">{t.label}</span>
          </button>
        ))}
      </div>

      {/* 季節：今の時期＋少し先の代表候補 */}
      {seTab === 'season' && (
        <div className="mt-3 pt-3 border-t border-[#F0EDE6]">
          <p className="text-[10px] text-[#8A8A85] mb-2.5">今の時期のおすすめ<span className="ml-1 text-green-600 font-medium">（{SEASONS[currentSeasonId].label}〜）</span></p>
          <div className="flex flex-wrap gap-2">
            {getSeasonCandidates(today).map(t => leafChip(t.n, t.i))}
          </div>
          <button onClick={() => setShowAllSeason(v => !v)} className="mt-2.5 text-[11px] text-green-600">
            {showAllSeason ? '閉じる' : 'もっと見る（季節の一覧）'}
          </button>
          {showAllSeason && (
            <div className="mt-2 flex flex-col gap-3">
              {[currentSeasonId, nextSeasonId(currentSeasonId)].map(sid => (
                <div key={sid}>
                  <p className="text-[10px] font-bold text-[#8A8A85] mb-1.5">{SEASONS[sid].icon} {SEASONS[sid].label}</p>
                  <div className="flex flex-wrap gap-2">
                    {SEASON_THEMES_FULL[sid].map((t, idx) => leafChip(t.n, t.i, `${sid}-${idx}`))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {resultBlock()}
        </div>
      )}

      {/* 行事：祝日 / 季節・暦の行事 / 園の行事 に分ける */}
      {seTab === 'event' && (
        <div className="mt-3 pt-3 border-t border-[#F0EDE6]">
          <div className="flex flex-wrap gap-2">
            {[{ id: 'holiday', label: '祝日', icon: '🇯🇵' },
              { id: 'calendar', label: '季節・暦の行事', icon: '🎎' },
              { id: 'nursery', label: '園の行事', icon: '🏫' }].map(sc => (
              <button key={sc.id} onClick={() => selectEventSubcat(sc.id)} className={chipCls(eventSubcat === sc.id)}>
                <span className="text-sm">{sc.icon}</span>
                <span className="text-xs">{sc.label}</span>
              </button>
            ))}
          </div>

          {/* 祝日 */}
          {eventSubcat === 'holiday' && (
            <div className="mt-3 pt-3 border-t border-[#F0EDE6]">
              <p className="text-[10px] text-[#8A8A85] mb-2">今の時期の祝日</p>
              {getHolidayCandidates(today).length === 0 ? (
                <p className="text-[11px] text-[#B0B0A8]">この時期に国民の祝日はありません</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {getHolidayCandidates(today).map(h => (
                    <button key={h.name} onClick={() => setOpenHoliday(prev => prev === h.name ? null : h.name)}
                      className={chipCls(openHoliday === h.name)}>
                      <span className="text-sm">{h.icon}</span>
                      <span className="text-xs">{h.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {openHoliday && (() => {
                const h = getHolidayCandidates(today).find(x => x.name === openHoliday)
                  || getHolidaysByFiscalMonth().flatMap(g => g.holidays).find(x => x.name === openHoliday)
                if (!h) return null
                return (
                  <div className="mt-3 bg-[#F7FAF6] border border-[#E4EDE2] rounded-xl px-3 py-2.5">
                    <p className="text-xs font-bold text-[#2C2C2A] mb-1">{h.icon} {h.name}</p>
                    <p className="text-[11px] text-[#5A5A57] leading-relaxed mb-2">{h.child}</p>
                    <p className="text-[10px] font-bold text-[#8A8A85] mb-1">この日に読みたいテーマ</p>
                    <div className="flex flex-wrap gap-2">
                      {h.keywords.map((k, idx) => leafChip(k, '📖', `${h.name}-${idx}`))}
                    </div>
                  </div>
                )
              })()}
              <button onClick={() => setShowAllHoliday(v => !v)} className="mt-2.5 text-[11px] text-green-600">
                {showAllHoliday ? '閉じる' : 'もっと見る（年度順の祝日一覧）'}
              </button>
              {showAllHoliday && (
                <div className="mt-2 flex flex-col gap-2">
                  {getHolidaysByFiscalMonth().map(g => (
                    <div key={g.month} className="flex items-start gap-2">
                      <span className="text-[10px] text-[#8A8A85] w-8 flex-shrink-0 pt-1">{g.month}月</span>
                      <div className="flex flex-wrap gap-2 flex-1">
                        {g.none
                          ? <span className="text-[11px] text-[#B0B0A8] pt-1">国民の祝日はありません</span>
                          : g.holidays.map(h => (
                              <button key={h.name} onClick={() => setOpenHoliday(h.name)} className={chipCls(openHoliday === h.name)}>
                                <span className="text-sm">{h.icon}</span><span className="text-xs">{h.name}</span>
                              </button>
                            ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {resultBlock()}
            </div>
          )}

          {/* 季節・暦の行事 */}
          {eventSubcat === 'calendar' && (
            <div className="mt-3 pt-3 border-t border-[#F0EDE6]">
              <p className="text-[10px] text-[#8A8A85] mb-2">今の時期の行事</p>
              <div className="flex flex-wrap gap-2">
                {getCalendarEventCandidates(today).map(e => leafChip(e.name, e.icon))}
              </div>
              {resultBlock()}
            </div>
          )}

          {/* 園の行事（月固定しない・年間で探せる） */}
          {eventSubcat === 'nursery' && (
            <div className="mt-3 pt-3 border-t border-[#F0EDE6]">
              <p className="text-[10px] text-[#8A8A85] mb-2">園によって時期の異なる行事（年間で探せます）</p>
              <div className="flex flex-col gap-3">
                {NURSERY_EVENT_GROUPS.map(g => (
                  <div key={g.group}>
                    <p className="text-[10px] font-bold text-[#8A8A85] mb-1.5">{g.group}</p>
                    <div className="flex flex-wrap gap-2">
                      {g.items.map(item => leafChip(item.name, item.icon, `${g.group}-${item.name}`))}
                    </div>
                  </div>
                ))}
              </div>
              {resultBlock()}
            </div>
          )}
        </div>
      )}
    </div>
  )

  // テーマ入口（季節・行事 / 普遍テーマ）の1グループ分を描画するヘルパー
  // layout='grid'（2項目を均等配置）/ 'scroll'（横スクロール・既定）
  const renderThemeGroup = (title, desc, themes, icon, layout = 'scroll') => (
    <div className="bg-white border border-[#DCE4D9] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm leading-none">{icon}</span>
        </div>
        <p className="text-sm font-bold text-[#2C2C2A]">{title}</p>
      </div>
      <p className="text-xs text-[#8A8A85] mb-3">{desc}</p>

      <div className={layout === 'grid' ? 'grid grid-cols-2 gap-2' : 'flex gap-2 overflow-x-auto pb-1 -mx-1 px-1'}>
        {themes.map(t => (
          <button key={t.id} onClick={() => handleBigThemeSelect(t.id)}
            className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl border transition-colors
              ${layout === 'grid' ? 'w-full' : 'flex-shrink-0 min-w-[64px]'}
              ${selectedBigTheme === t.id
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-[#F2F5F0] border-[#DCE4D9] text-[#5A5A57] active:bg-[#EAF5EC]'}`}>
            <span className="text-xl">{t.emoji}</span>
            <span className="text-[11px] font-medium">{t.label}</span>
          </button>
        ))}
      </div>

      {themes.some(t => t.id === selectedBigTheme) && (
        <div className="mt-3 pt-3 border-t border-[#F0EDE6]">
          <p className="text-[10px] text-[#8A8A85] mb-2.5">
            {ALL_THEMES.find(t => t.id === selectedBigTheme)?.label} のテーマ
          </p>

          {selectedBigTheme === 'creature' ? (
            // 生きもの：大分類 → 具体的な生きもの の2階層
            <>
              <div className="flex flex-wrap gap-2">
                {CREATURE_GROUPS.map(g => (
                  <button key={g.label}
                    onClick={() => {
                      setSelectedCreatureGroup(prev => prev === g.label ? null : g.label)
                      setSubThemeResults(null)
                      setSelectedSubTheme(null)
                    }}
                    className={chipCls(selectedCreatureGroup === g.label)}>
                    <span className="text-sm">{g.emoji}</span>
                    <span className="text-xs">{g.label}</span>
                  </button>
                ))}
              </div>
              {selectedCreatureGroup && (
                <div className="mt-3 pt-3 border-t border-[#F0EDE6]">
                  <p className="text-[10px] text-[#8A8A85] mb-2">{selectedCreatureGroup} の生きもの</p>
                  <div className="flex flex-wrap gap-2">
                    {(CREATURE_GROUPS.find(g => g.label === selectedCreatureGroup)?.items || []).map(item => (
                      <button key={item.label} onClick={() => handleSubThemeSelect(item.label)}
                        className={chipCls(selectedSubTheme === item.label)}>
                        <span className="text-sm">{item.emoji}</span>
                        <span className="text-xs">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            // それ以外：小テーマ → 結果（既存）
            <div className="flex flex-wrap gap-2">
              {getSubThemes(selectedBigTheme).map(sub => (
                <button key={sub.label} onClick={() => handleSubThemeSelect(sub.label)}
                  className={chipCls(selectedSubTheme === sub.label)}>
                  <span className="text-sm">{sub.emoji}</span>
                  <span className="text-xs">{sub.label}</span>
                </button>
              ))}
            </div>
          )}

          {subThemeResults && (
            <div className="mt-3 pt-3 border-t border-[#F0EDE6]">
              {subThemeResults.length === 0 ? (
                <p className="text-xs text-[#8A8A85] leading-relaxed">
                  「{selectedSubTheme}」に関連する絵本は、まだ登録されていません
                </p>
              ) : (
                <>
                  <p className="text-[10px] font-bold text-[#8A8A85] tracking-wide mb-2">
                    「{selectedSubTheme}」の絵本
                  </p>
                  <div className="flex flex-col gap-2">
                    {subThemeResults.map(book => <HomeBookCard key={book.id} book={book} onTap={setSelectedBook} />)}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F2F5F0] pb-24">

      {/* ヘッダー */}
      <header className="px-4 pt-10 pb-4"
        style={{ background: 'linear-gradient(160deg, #1E6B38 0%, #2E7D46 60%, #3A9156 100%)' }}>
        <p className="text-green-200 text-xs mb-1">{dateStr}</p>
        <h1 className="text-xl font-bold text-white tracking-wide">えほんのあと</h1>
        <p className="text-green-100 text-xs mt-1">絵本で、子どもの姿が見えてくる。</p>
      </header>

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* ① 自由記述検索 */}
        <div className="bg-white border border-[#DCE4D9] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center flex-shrink-0">
              <Search size={14} className="text-white" />
            </div>
            <p className="text-sm font-bold text-[#2C2C2A]">絵本・紙芝居を探す</p>
          </div>
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="絵本名・作者名を入力"
              className="flex-1 text-sm border border-[#DCE4D9] rounded-xl px-3 py-2.5 outline-none focus:border-green-400"
            />
            <button onClick={() => handleSearch()}
              disabled={!searchQuery.trim() || searchLoading}
              className={`text-xs font-bold rounded-xl px-4 py-2.5 flex-shrink-0 transition-colors
                ${searchQuery.trim() && !searchLoading ? 'bg-green-600 text-white' : 'bg-[#E8E6E0] text-[#B0B0A8]'}`}>
              {searchLoading ? '検索中' : '検索'}
            </button>
          </div>
          {searchError && (
            <p className="text-xs text-red-500 mt-3 text-center">{searchError}</p>
          )}
          {searchResults && !searchLoading && !searchError && (
            <>
              {searchResults.length === 0
                ? <p className="text-xs text-[#8A8A85] mt-3 text-center">
                    この言葉に当てはまる絵本は、まだ登録されていません
                  </p>
                : <>
                    {publicResults.length > 0 && (
                      <ResultsBlock books={publicResults} label="登録されている絵本"
                        onTap={setSelectedBook} />
                    )}
                    {/* 自分で追加した作品。まだ全員には公開されていないが、
                        追加した本人は通常どおり選んで記録できる。
                        「未公開」「確認待ち」など管理側の言葉は出さない。 */}
                    {myAddedResults.length > 0 && (
                      <ResultsBlock books={myAddedResults} label="自分が追加した作品"
                        onTap={setSelectedBook} />
                    )}
                  </>}
              {/* まだ登録されていない絵本・紙芝居を、その場で追加してそのまま記録できるようにする。
                  0件のときだけでなく、部分一致で別の絵本が出たときも追加できる必要がある。 */}
              <AddWorkPanel query={searchedQuery} />
            </>
          )}
        </div>

        {/* ② 子どもの姿・保育士の思いから探す */}
        <div id="consult-section" className="bg-white border border-[#DCE4D9] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">✦</span>
            </div>
            <p className="text-sm font-bold text-[#2C2C2A]">子どもの姿・保育士の思いから探す</p>
          </div>
          <p className="text-xs text-[#8A8A85] mb-2.5">
            子どもの興味・姿や、保育士の伝えたいこと・ねらいから探せます
          </p>

          {/* 自由入力 */}
          <div className="flex gap-2 mb-2.5">
            <input
              value={consultQuery}
              onChange={e => setConsultQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConsult()}
              placeholder="子どもの姿や、今伝えたいことを入力"
              className="flex-1 text-sm border border-[#DCE4D9] rounded-xl px-3 py-2.5 outline-none focus:border-amber-400"
            />
            <button onClick={() => handleConsult()}
              disabled={!consultQuery.trim() || consultLoading}
              className={`text-xs font-bold rounded-xl px-4 py-2.5 flex-shrink-0 transition-colors
                ${consultQuery.trim() && !consultLoading ? 'bg-amber-500 text-white' : 'bg-[#E8E6E0] text-[#B0B0A8]'}`}>
              {consultLoading ? '検索中...' : '探す'}
            </button>
          </div>

          {/* 補助候補（子どもの姿＋保育士の思い） */}
          <div className="flex flex-wrap gap-1.5">
            {CONSULT_SUGGESTIONS.map(s => (
              <button key={s} onClick={() => handleConsult(s)}
                className="text-[11px] text-[#5A5A57] bg-[#FBF6EC] border border-[#EAD9B8] rounded-full px-2.5 py-1 active:bg-[#F5E9CF]">
                {s}
              </button>
            ))}
          </div>

          {consultResults && !consultLoading && (
            consultResults.length === 0
              ? (
                /* 行事から来たときは、何が起きているかが分かる事実を出す。
                   「準備中」のような、状態の分からない言い方はしない。 */
                <p className="text-xs text-[#8A8A85] mt-3 text-center leading-relaxed">
                  {prepareQuery
                    ? `「${prepareQuery}」に関連する絵本は、まだ登録されていません`
                    : '該当する絵本がありませんでした'}
                </p>
              )
              : <ResultsBlock books={consultResults} label="子どもの姿・思いに合ったおすすめ" onTap={setSelectedBook} />
          )}
        </div>

        {/* ③ 季節・行事から探す（季節 / 行事[祝日・暦の行事・園の行事]） */}
        {renderSeasonEventSection()}

        {/* ④ テーマから探す（年間を通して探せる普遍的なテーマ） */}
        {renderThemeGroup(
          'テーマから探す',
          '年間を通して読めるテーマから探せます',
          UNIVERSAL_THEMES,
          '📚',
        )}

        {/* 記録する導線 */}
        <Link to="/record"
          className="flex items-center justify-center gap-2 w-full bg-green-600 text-white text-sm font-bold rounded-2xl py-3.5">
          <PenLine size={15} />
          今日読んだ本を記録する
        </Link>

      </div>

      {selectedBook && (
        <BookDetailModal book={selectedBook} onClose={() => setSelectedBook(null)}
          onWantToRead={book => setWantToReadBook(book)} />
      )}
      {wantToReadBook && (
        <WantToReadSheet book={wantToReadBook} onClose={() => setWantToReadBook(null)}
          onConfirm={handleWantToReadConfirm} />
      )}
      {toast && (
        <div className="fixed bottom-24 left-4 right-4 z-[100] max-w-lg mx-auto pointer-events-none">
          <div className="bg-[#1E6B38] text-white text-sm rounded-2xl px-4 py-3 text-center shadow-lg">
            ✓ {toast}
          </div>
        </div>
      )}
    </div>
  )
}
