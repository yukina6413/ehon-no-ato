import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Check, Search, X, Heart, ChevronRight, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react'

// ──── 日付 ────
const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

// ──── やること localStorage ────
function loadTasks() {
  const today    = new Date()
  const todayKey = toDateKey(today)
  const stored   = localStorage.getItem(`tasks_${todayKey}`)
  if (stored) return JSON.parse(stored)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const prevStored = localStorage.getItem(`tasks_${toDateKey(yesterday)}`)
  if (prevStored) return JSON.parse(prevStored).filter(t => !t.done).map(t => ({ ...t }))
  return [
    { id: 1, text: '誕生会準備', done: false },
    { id: 2, text: '日案作成', done: false },
  ]
}

function saveTasks(tasks) {
  localStorage.setItem(`tasks_${toDateKey(new Date())}`, JSON.stringify(tasks))
}

// ──── 今のおすすめテーマ（月別） ────
const MONTHLY_THEMES = {
  1:  [
    { emoji: '⛄', label: '雪' },
    { emoji: '🧊', label: '氷' },
    { emoji: '🐻', label: 'ふゆごもり' },
    { emoji: '🎍', label: 'お正月' },
  ],
  2:  [
    { emoji: '👹', label: '節分' },
    { emoji: '🌿', label: 'ふきのとう' },
    { emoji: '❄️', label: '雪どけ' },
    { emoji: '🌱', label: '春の気配' },
  ],
  3:  [
    { emoji: '🌸', label: 'さくら' },
    { emoji: '💨', label: '春風' },
    { emoji: '🦋', label: 'ちょうちょ' },
    { emoji: '🌼', label: 'たんぽぽ' },
    { emoji: '🌱', label: '芽吹き' },
  ],
  4:  [
    { emoji: '🌸', label: 'さくら' },
    { emoji: '🦋', label: 'ちょうちょ' },
    { emoji: '🌼', label: 'たんぽぽ' },
    { emoji: '🐛', label: '虫' },
    { emoji: '🎏', label: 'こいのぼり' },
  ],
  5:  [
    { emoji: '🌿', label: '新緑' },
    { emoji: '🐝', label: 'みつばち' },
    { emoji: '🐛', label: '虫' },
    { emoji: '💨', label: '風' },
    { emoji: '🎏', label: 'こいのぼり' },
  ],
  6:  [
    { emoji: '🌧️', label: '雨' },
    { emoji: '💠', label: 'あじさい' },
    { emoji: '🐌', label: 'かたつむり' },
    { emoji: '💧', label: '水たまり' },
    { emoji: '🎋', label: '七夕' },
  ],
  7:  [
    { emoji: '🎋', label: '七夕' },
    { emoji: '☀️', label: '夏の空' },
    { emoji: '🦗', label: 'セミ' },
    { emoji: '🍉', label: 'すいか' },
    { emoji: '⛈️', label: '夕立' },
  ],
  8:  [
    { emoji: '🌊', label: '海' },
    { emoji: '🪲', label: 'カブトムシ' },
    { emoji: '⛅', label: '入道雲' },
    { emoji: '🎆', label: '花火' },
    { emoji: '🌙', label: '夏の夜' },
  ],
  9:  [
    { emoji: '🌕', label: 'お月見' },
    { emoji: '🌰', label: 'どんぐり' },
    { emoji: '🍃', label: '秋風' },
    { emoji: '🦗', label: '虫の声' },
    { emoji: '🌾', label: '実り' },
  ],
  10: [
    { emoji: '🍁', label: '紅葉' },
    { emoji: '🍂', label: '落ち葉' },
    { emoji: '🍄', label: 'きのこ' },
    { emoji: '🌰', label: 'どんぐり' },
    { emoji: '🏃', label: '運動会' },
  ],
  11: [
    { emoji: '🍂', label: '枯れ葉' },
    { emoji: '🌤️', label: '小春日和' },
    { emoji: '🌰', label: '木の実' },
    { emoji: '👘', label: '七五三' },
  ],
  12: [
    { emoji: '❄️', label: '雪' },
    { emoji: '⭐', label: '冬の星' },
    { emoji: '🎄', label: 'クリスマス' },
    { emoji: '🍵', label: 'あたたかさ' },
  ],
}

const FIXED_THEMES = [
  { emoji: '🎂', label: '誕生会' },
  { emoji: '🚨', label: '避難訓練' },
]

function getSeasonThemes(month) {
  return [...(MONTHLY_THEMES[month] || []), ...FIXED_THEMES]
}

// ──── 絵本サンプルデータ ────
const SAMPLE_BOOKS = [
  {
    id: 's1', emoji: '🐛', cover: '#C3E6C8',
    title: 'はらぺこあおむし',
    author: 'エリック・カール',
    publisher: '偕成社',
    age: '1〜4歳',
    synopsis: '卵から生まれた小さなあおむしが、曜日ごとにさまざまな食べ物を食べながら成長し、美しいちょうちょに変身するお話です。',
    aim: '食べることの喜びや生命の変容に気づき、数や曜日の概念への興味を育てます。',
    readingTips: {
      before: '「お腹が空いたことある？どんな気持ちだったかな？」と問いかけてから読み始めると入りやすいです。',
      during: '食べ物のページでは「これ知ってる？」「食べたことある？」と会話しながら読み進めましょう。',
      after:  '「あおむしはちょうちょになったね。みんなも大きくなったらどうなるかな？」と想像を広げてみてください。',
    },
    reaction: '食べ物のページで「これ食べたい！」と指差しが多くなります。一緒に名前を言う子も多いです。',
    childBehaviors: [
      '食べ物を見て嬉しそうに声を上げる姿',
      '曜日や数字に自然と興味を持つ姿',
      'ページをめくるたびに次を期待する姿',
      '成長・変身に不思議さや驚きを感じる姿',
    ],
    parentMessage: '食べることが楽しくなる絵本です。曜日や数の概念にも自然と触れられるので、日常の食事の場面でも話題が広がります。色鮮やかなちょうちょへの変身に、子どもたちはいつも目を輝かせます。',
    homeActivity: '曜日ごとに一緒に食べるものを決めてみたり、散歩でさなぎや蝶を探したりするとより楽しめます。「今日は何曜日？」と問いかけながら読むのもおすすめです。',
    usage: '給食前の導入や、昆虫の変態を学ぶ自然観察活動の前後に最適です。',
  },
  {
    id: 's2', emoji: '🌿', cover: '#EAF5EC',
    title: 'ふしぎなたね',
    author: '松岡達英',
    publisher: '福音館書店',
    age: '4〜6歳',
    synopsis: '小さなたねを植えると、どんどん大きく育って…。植物の成長を通して自然の不思議さと命のつながりを伝えます。',
    aim: '昆虫から植物・自然全体へ興味を広げ、命の循環に気づく感性を育てます。',
    readingTips: {
      before: '「土の中に何が入ってるか知ってる？」「たねを見たことある？」と問いかけてから読み始めましょう。',
      during: 'たねが育つページでは絵をじっくり見せる時間を作り、「どこが変わったかな？」と一緒に観察しましょう。',
      after:  '「もし自分がたねだったら、どんな植物になりたい？」と想像を広げる問いかけが効果的です。',
    },
    reaction: '「どうしてこんなに大きくなるの？」と不思議さへの問いが生まれやすいです。',
    childBehaviors: [
      '自然を観察しじっくり見つめる姿',
      '「なんで？」と因果関係を考える姿',
      '友だちと気づきを共有する姿',
      '命のつながりに感動する姿',
    ],
    parentMessage: '小さな種が大きく育つ姿を通して、子どもと一緒に自然の不思議を楽しめる絵本です。お散歩で見つけた草花や木の実について話すきっかけにもなります。',
    homeActivity: '散歩中に似た草花や種を探してみましょう。見つけた後に「どんな植物になるかな？」と話し合うことで、観察力と想像力が育まれます。季節ごとに読み返すのもおすすめです。',
    usage: '昆虫と植物のつながりを伝える話の導入に。栽培活動とセットで使うと効果的です。',
  },
  {
    id: 's3', emoji: '🌙', cover: '#E8E0F8',
    title: 'おつきさまこんにちは',
    author: '林明子',
    publisher: '福音館書店',
    age: '0〜2歳',
    synopsis: '雲の後ろに隠れていたお月さまが、少しずつ顔を出す絵本。赤ちゃんが大好きな顔のアップが印象的です。',
    aim: '視覚と感覚的な反応を促し、「いないいないばあ」的な楽しさで発達を支えます。',
    readingTips: {
      before: 'カーテンを少し閉めて薄暗くすると、絵本の世界に入りやすくなります。静かな時間に読むのがおすすめです。',
      during: 'お月さまが顔を出すページは、ゆっくり時間をかけてめくると子どもの反応が豊かになります。',
      after:  '「お月さまはどこに行ったの？」「夜になったら見てみようね」と日常とつなげましょう。',
    },
    reaction: '「あ！」と声を上げてページをじっと見つめる子が多いです。',
    childBehaviors: [
      '顔の変化に反応し声を出す姿',
      '「いないいないばあ」を楽しむ姿',
      'ページをじっと見つめる集中力',
      '繰り返しを楽しみ予測する姿',
    ],
    parentMessage: '繰り返し読みたがる赤ちゃんに大人気の絵本です。シンプルなお話の中に、お月さまとの「いないいないばあ」的な楽しさがあります。寝かしつけ前の絵本としても最適です。',
    homeActivity: '晴れた夜にお月さまを実際に見上げてみましょう。本物のお月さまとの出会いが絵本の世界をより豊かにします。「お月さまに挨拶しようか」と声かけするのもおすすめです。',
    usage: '0歳児クラスの読み聞かせや、就寝前の絵本として最適です。',
  },
]

// ──── 折りたたみセクション ────
function Section({ icon, label, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white border border-[#DCE4D9] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-xs font-bold text-[#2C2C2A] flex items-center gap-2">
          <span className="text-base leading-none">{icon}</span>
          {label}
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
  const [copied, setCopied] = useState(false)

  function copyParentMessage() {
    if (!book.parentMessage) return
    navigator.clipboard?.writeText(book.parentMessage).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F2F5F0]">

      {/* ヘッダー */}
      <div className="px-4 pt-10 pb-4 flex items-center gap-3 flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #1E6B38, #2E7D46)' }}>
        <button onClick={onClose} className="text-[#A8D4B4] p-1">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-white text-[15px] font-bold flex-1 truncate">{book.title}</h2>
      </div>

      {/* スクロールエリア */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5 pb-28">

        {/* 書誌情報 */}
        <div className="bg-white border border-[#DCE4D9] rounded-2xl p-4 flex gap-4 items-start">
          <div className="w-20 h-24 rounded-xl flex items-center justify-center text-4xl flex-shrink-0"
            style={{ background: book.cover }}>
            {book.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-[#2C2C2A] leading-snug">{book.title}</h2>
            <p className="text-xs text-[#8A8A85] mt-0.5">{book.author}・{book.publisher}</p>
            <span className="inline-block mt-2 text-[10px] bg-[#EAF5EC] text-green-700 rounded-full px-2 py-0.5">
              対象年齢：{book.age}
            </span>
          </div>
        </div>

        {/* 1. あらすじ（デフォルト展開） */}
        <Section icon="📖" label="あらすじ" defaultOpen>
          <p className="text-sm text-[#5A5A57] leading-relaxed pt-2">{book.synopsis}</p>
        </Section>

        {/* 2. 保育のねらい（デフォルト展開） */}
        <Section icon="🎯" label="保育のねらい" defaultOpen>
          <p className="text-sm text-[#5A5A57] leading-relaxed pt-2">{book.aim}</p>
        </Section>

        {/* 3. 読み方のヒント */}
        {book.readingTips && (
          <Section icon="🗣️" label="読み方のヒント">
            {[
              { phase: '読む前に',      text: book.readingTips.before },
              { phase: '読んでいる途中', text: book.readingTips.during },
              { phase: '読み終わったあと', text: book.readingTips.after  },
            ].map(({ phase, text }) => (
              <div key={phase} className="mt-3 first:mt-2">
                <p className="text-[10px] font-bold text-green-700 mb-1">▸ {phase}</p>
                <p className="text-sm text-[#5A5A57] leading-relaxed">{text}</p>
              </div>
            ))}
          </Section>
        )}

        {/* 4. 子どもとの対話のきっかけ */}
        <Section icon="✨" label="子どもとの対話のきっかけ">
          <p className="text-sm text-[#5A5A57] leading-relaxed pt-2">{book.reaction}</p>
        </Section>

        {/* 5. この絵本で見えやすい子どもの姿 */}
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

        {/* 6. 保護者へのおすすめ文 */}
        {book.parentMessage && (
          <Section icon="💌" label="保護者へのおすすめ文">
            <div className="mt-2 bg-[#EAF5EC] rounded-xl px-4 py-3">
              <p className="text-sm text-[#1B4D2B] leading-relaxed">{book.parentMessage}</p>
            </div>
            <button
              onClick={copyParentMessage}
              className={`mt-2.5 w-full text-xs rounded-xl py-2.5 border transition-colors font-medium
                ${copied
                  ? 'bg-green-600 text-white border-green-600'
                  : 'border-[#DCE4D9] text-[#5A5A57] active:bg-[#EAF5EC]'}`}
            >
              {copied ? '✓ コピーしました' : 'おたより・配信用にコピーする'}
            </button>
          </Section>
        )}

        {/* 7. 家庭での楽しみ方 */}
        {book.homeActivity && (
          <Section icon="🏠" label="家庭での楽しみ方">
            <p className="text-sm text-[#5A5A57] leading-relaxed pt-2">{book.homeActivity}</p>
          </Section>
        )}

        {/* 8. 活動例 */}
        <Section icon="💡" label="活動例">
          <p className="text-sm text-[#5A5A57] leading-relaxed pt-2">{book.usage}</p>
        </Section>

      </div>

      {/* 下部ボタン */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E0E8DC] px-4 pt-3 pb-8 max-w-lg mx-auto">
        <button onClick={() => onWantToRead(book)}
          className="w-full bg-green-600 text-white rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2">
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
            <p className="text-[10px] font-bold text-[#8A8A85]">日付を選択</p>
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
        style={{ background: book.cover }}>
        {book.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#2C2C2A] truncate">{book.title}</p>
        <p className="text-[11px] text-[#8A8A85]">{book.author}・{book.age}</p>
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

  // やること（ミニ表示）
  const [tasks, setTasks] = useState(() => loadTasks())
  useEffect(() => { saveTasks(tasks) }, [tasks])
  function toggleDone(id) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }
  const pendingTasks = tasks.filter(t => !t.done).slice(0, 3)

  // 絵本・紙芝居を探す
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState(null)

  function handleSearch(q) {
    const query = (q !== undefined ? q : searchQuery).trim()
    if (!query) return
    setSearchResults(SAMPLE_BOOKS.slice(0, 2))
  }

  // 今のおすすめテーマ
  const [selectedTheme, setSelectedTheme] = useState(null)
  const [selectedAge,   setSelectedAge]   = useState(null)
  const [themeResults,  setThemeResults]  = useState(null)

  function handleThemeSelect(label) {
    if (label === selectedTheme) {
      setSelectedTheme(null)
      setSelectedAge(null)
      setThemeResults(null)
    } else {
      setSelectedTheme(label)
      setSelectedAge(null)
      setThemeResults(SAMPLE_BOOKS.slice(0, 2))
    }
  }

  function handleAgeSelect(age) {
    const next = selectedAge === age ? null : age
    setSelectedAge(next)
    setThemeResults(SAMPLE_BOOKS.slice(0, 2))
  }

  // 子どもの姿から探す
  const [consultQuery,   setConsultQuery]   = useState('')
  const [consultResults, setConsultResults] = useState(null)

  function handleConsult(q) {
    const query = (q !== undefined ? q : consultQuery).trim()
    if (!query) return
    setConsultResults(SAMPLE_BOOKS.slice(1, 3))
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

  return (
    <div className="min-h-screen bg-[#F2F5F0] pb-24">

      {/* ヘッダー */}
      <header className="px-4 pt-10 pb-4"
        style={{ background: 'linear-gradient(160deg, #1E6B38 0%, #2E7D46 60%, #3A9156 100%)' }}>
        <p className="text-green-200 text-xs mb-1">{dateStr}</p>
        <h1 className="text-xl font-bold text-white tracking-wide">えほんのあと</h1>
        <p className="text-green-100 text-xs mt-1">子どもとの日々を、未来へ。</p>
      </header>

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* 今日のやること（ミニ） */}
        <div className="bg-white border border-[#DCE4D9] rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-[#8A8A85] tracking-wide">今日のやること</p>
            <Link to="/mypage" className="text-xs text-green-600 flex items-center gap-0.5">
              予定を確認 <ChevronRight size={12} />
            </Link>
          </div>
          {pendingTasks.length === 0 ? (
            <p className="text-xs text-[#B0B0A8] py-1">今日のやることはありません</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {pendingTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2">
                  <button onClick={() => toggleDone(task.id)}
                    className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors
                      ${task.done ? 'bg-green-500 border-green-500' : 'border-[#B0B0A8]'}`}>
                    {task.done && <Check size={8} className="text-white" strokeWidth={3} />}
                  </button>
                  <p className={`text-xs flex-1 ${task.done ? 'line-through text-[#B0B0A8]' : 'text-[#2C2C2A]'}`}>
                    {task.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 絵本・紙芝居を探す */}
        <div className="bg-white border border-[#DCE4D9] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center flex-shrink-0">
              <Search size={14} className="text-white" />
            </div>
            <p className="text-sm font-bold text-[#2C2C2A]">絵本・紙芝居を探す</p>
          </div>
          <div className="flex gap-2 mb-2.5">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="例：七夕、3歳 梅雨..."
              className="flex-1 text-sm border border-[#DCE4D9] rounded-xl px-3 py-2.5 outline-none focus:border-green-400"
            />
            <button onClick={() => handleSearch()}
              className="bg-green-600 text-white text-xs font-bold rounded-xl px-4 py-2.5 flex-shrink-0">
              検索
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['七夕', '3歳 梅雨', '太鼓の導入に合う紙芝居'].map(ex => (
              <button key={ex} onClick={() => { setSearchQuery(ex); handleSearch(ex) }}
                className="text-[11px] text-[#5A5A57] bg-[#F2F5F0] border border-[#DCE4D9] rounded-full px-2.5 py-1">
                {ex}
              </button>
            ))}
          </div>
          {searchResults && <ResultsBlock books={searchResults} label="おすすめ絵本・紙芝居" onTap={setSelectedBook} />}
        </div>

        {/* 今のおすすめテーマ */}
        <div className="bg-white border border-[#DCE4D9] rounded-2xl p-4">
          <p className="text-[10px] font-bold text-[#8A8A85] tracking-wide mb-3">今のおすすめテーマ</p>
          <div className="flex flex-wrap gap-2">
            {getSeasonThemes(today.getMonth() + 1).map(theme => (
              <button key={theme.label} onClick={() => handleThemeSelect(theme.label)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 border transition-colors
                  ${selectedTheme === theme.label
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-[#F2F5F0] border-[#DCE4D9] text-[#5A5A57] active:bg-[#EAF5EC]'}`}>
                <span className="text-base">{theme.emoji}</span>
                <span className="text-xs">{theme.label}</span>
              </button>
            ))}
          </div>

          {selectedTheme && (
            <div className="mt-3 pt-3 border-t border-[#F0EDE6]">
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <span className="text-[10px] text-[#8A8A85] font-medium">年齢：</span>
                {['0歳', '1歳', '2歳', '3歳', '4歳', '5歳'].map(age => (
                  <button key={age} onClick={() => handleAgeSelect(age)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors
                      ${selectedAge === age
                        ? 'bg-green-600 text-white border-green-600'
                        : 'border-[#DCE4D9] text-[#5A5A57]'}`}>
                    {age}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-bold text-[#8A8A85] tracking-wide mb-2">
                {selectedTheme}{selectedAge ? ` × ${selectedAge}` : ''} のおすすめ
              </p>
              <div className="flex flex-col gap-2">
                {themeResults.map(book => <HomeBookCard key={book.id} book={book} onTap={setSelectedBook} />)}
              </div>
            </div>
          )}
        </div>

        {/* 子どもの姿から探す */}
        <div className="bg-white border border-[#DCE4D9] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">✦</span>
            </div>
            <p className="text-sm font-bold text-[#2C2C2A]">子どもの姿から探す</p>
          </div>
          <p className="text-xs text-[#8A8A85] mb-2">子どもの様子や保育場面を入力してください</p>
          <textarea
            value={consultQuery}
            onChange={e => setConsultQuery(e.target.value)}
            placeholder="例：虫に興味がある子が多い"
            rows={2}
            className="w-full text-sm border border-[#DCE4D9] rounded-xl px-3 py-2.5 outline-none focus:border-amber-400 resize-none mb-2"
          />
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              '帰りの会で落ち着いて聞いてほしい',
              '虫に興味がある子が多い',
              '七夕の導入をしたい',
              '友だちとの関わりが増えている',
            ].map(ex => (
              <button key={ex} onClick={() => { setConsultQuery(ex); handleConsult(ex) }}
                className="text-[11px] text-[#5A5A57] bg-[#F2F5F0] border border-[#DCE4D9] rounded-full px-2.5 py-1">
                {ex}
              </button>
            ))}
          </div>
          <button onClick={() => handleConsult()} disabled={!consultQuery.trim()}
            className={`w-full text-sm font-bold rounded-xl py-2.5 transition-colors
              ${consultQuery.trim() ? 'bg-amber-500 text-white' : 'bg-[#E8E6E0] text-[#B0B0A8]'}`}>
            絵本を探す
          </button>
          {consultResults && <ResultsBlock books={consultResults} label="子どもの姿に合ったおすすめ" onTap={setSelectedBook} />}
        </div>

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
