import { useState, useRef } from 'react'
import { Search, X, Sparkles } from 'lucide-react'
import BookCard from '../components/BookCard'

// ──────────────────────────────────────────
// 定数データ
// ──────────────────────────────────────────
const SCENES   = ['朝の会', '帰りの会', '活動導入', '午睡前', '行事前', '自由遊び']
const PURPOSES = ['落ち着きたい', '見通しを持たせたい', '興味を広げたい', '理解を深めたい']
const AGES     = ['0歳', '1歳', '2歳', '3歳', '4歳', '5歳', '混合']

// 「今の状態」3軸（基本＋もっと見る）
const TYPE_AXES = [
  {
    label: '🏃 動き方',
    basic: ['からだを動かしたい', 'じっとして聞きたい', '手を動かしながら聞く'],
    more:  ['外を走り回りたい日', 'ゆったり過ごしたい'],
  },
  {
    label: '👀 見方・集中',
    basic: ['絵をじっくり見る', 'くりかえしが好き', '短い話が合う'],
    more:  ['話の続きが気になる', 'ページをめくりたがる', '長い話もOK'],
  },
  {
    label: '💬 感じ方・関わり',
    basic: ['声を出して楽しむ', '真似をして楽しむ', '静かに受け取る'],
    more:  ['言葉が増えてきた', '感情の波が大きい日', '誰かと一緒に楽しみたい', 'ひとりで見ていたい'],
  },
]

// サジェスト候補（「ひな祭り」関連入力で表示）
const SUGGESTS = [
  { text: 'ひな祭り（行事の理解）',            tag: '行事' },
  { text: 'ひな祭り（名前を覚える）',           tag: '行事' },
  { text: 'ひな祭り（導入用・3歳）',            tag: '導入' },
  { text: 'ひな祭りを楽しく紹介したい（5歳）',  tag: '5歳' },
]

// モック検索結果
const MOCK_RESULTS = [
  {
    emoji: '📗', color: '#C3E6C8',
    title: 'おやすみなさいおつきさま', author: 'M.W.ブラウン / 評論社',
    tags: { age: '0〜3歳', scene: '午睡前', reaction: '🌙 静かな余韻' },
    reason: 'くりかえしのやさしいリズムが眠りへの導入に自然に合います。2歳児が「おやすみ」と声を合わせることで、午睡への切り替えがスムーズになります。',
  },
  {
    emoji: '📘', color: '#C3DCF0',
    title: 'もこ もこもこ', author: '谷川俊太郎 / 文研出版',
    tags: { age: '1〜3歳', scene: '午睡前', reaction: '🎯 集中' },
    reason: '言葉の少ないオノマトペ絵本で、視覚的な変化とやさしい音が心地よい眠気を誘います。2歳の子が静かに見入る場面が多い絵本です。',
  },
  {
    emoji: '📙', color: '#F9DDC0',
    title: 'くまさんくまさんなにみてるの？', author: 'E.カール / 偕成社',
    tags: { age: '1〜3歳', scene: '午睡前', reaction: '💬 言葉を返した' },
    reason: '単純なくりかえし構造が2歳の集中を引き出します。言葉を一緒に返す体験が心地よく終わり、落ち着いた雰囲気のまま午睡に移行しやすいです。',
  },
]

// チップ→自然文変換テーブル
const CONVERT_TYPE = {
  'からだを動かしたい':   '体を動かしたい子が多い',
  'じっとして聞きたい':   'じっくり聞ける状態の子向け',
  '手を動かしながら聞く': '手遊びや動作を交えて楽しめる',
  '絵をじっくり見る':     '絵をじっくり見ることを楽しめる',
  'くりかえしが好き':     'くりかえし構造が好きな',
  '短い話が合う':         '短い話が合う',
  '声を出して楽しむ':     '声を出して楽しめる',
  '真似をして楽しむ':     '真似や動作を楽しめる',
  '静かに受け取る':       '静かに受け取るタイプの',
  '外を走り回りたい日':   '活発に過ごしたい日の切り替えに使える',
  'ゆったり過ごしたい':   'ゆったりした雰囲気に合う',
  '話の続きが気になる':   '続きが気になる構造が合う',
  'ページをめくりたがる': 'ページめくりを楽しめる',
  '長い話もOK':           '長めの物語でも集中できる',
  '言葉が増えてきた':     '語彙が育ちつつある子向け',
  '感情の波が大きい日':   '気持ちの整理につながる',
  '誰かと一緒に楽しみたい': 'みんなで楽しめる',
  'ひとりで見ていたい':   'ひとりでじっくり向き合える',
}

// ──────────────────────────────────────────
// ローカル UI パーツ
// ──────────────────────────────────────────
function LoadingDots() {
  return (
    <div className="flex justify-center items-center gap-2 py-12">
      {[0, 0.2, 0.4].map((delay, i) => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-full bg-green-400 dot-bounce"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  )
}

// チップ（AI検索専用：色クラスを color prop で切り替え）
function QChip({ label, active, onToggle, color = 'green' }) {
  const onCls = {
    green:  'bg-green-700 border-green-700 text-white',
    blue:   'bg-blue-700  border-blue-700  text-white',
    orange: 'bg-amber-700 border-amber-700 text-white',
  }[color]

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-xs px-3 py-1.5 rounded-full border transition-all active:scale-95
        ${active ? onCls : 'bg-white border-[#D4D2CC] text-[#444441]'}`}
    >
      {label}
    </button>
  )
}

// セクションラベル（左の縦線付き）
function SectionLabel({ color = 'bg-green-400', children }) {
  return (
    <p className="text-xs font-bold text-[#5A5A57] mb-2 flex items-center gap-1.5">
      <span className={`w-0.5 h-3 rounded-full inline-block ${color}`} />
      {children}
    </p>
  )
}

// ──────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────
export default function AISearch() {
  const [query,       setQuery]       = useState('')
  const [showSuggest, setShowSuggest] = useState(false)
  const [chips,       setChips]       = useState({ scene: [], purpose: [], type: [], age: null })
  const [showMore,    setShowMore]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [results,     setResults]     = useState(null)
  const inputRef = useRef(null)

  // チップのトグル（age だけ単一選択）
  const togChip = (group, value) => {
    setChips(c => {
      if (group === 'age') {
        return { ...c, age: c.age === value ? null : value }
      }
      const arr = c[group]
      return { ...c, [group]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
  }

  // 選択チップを自然文に変換してプレビュー表示
  const buildPreview = () => {
    const { scene, purpose, type, age } = chips
    const parts = []
    if (age)            parts.push(`${age}児で`)
    if (scene.length)   parts.push(scene.join('・') + 'に')
    if (purpose.length) parts.push(purpose.join('・') + 'ような')
    if (type.length)    parts.push(type.map(t => CONVERT_TYPE[t] || t).join('・'))
    if (!parts.length)  return ''
    return parts.join('、') + '絵本を探しています。'
  }

  const previewText  = buildPreview()
  const hasAnyInput  = query.trim() || chips.age || chips.scene.length || chips.purpose.length || chips.type.length

  // 検索実行（モック：1.6秒後に結果表示）
  const runSearch = () => {
    if (!hasAnyInput) return
    setResults(null)
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setResults(MOCK_RESULTS)
    }, 1600)
  }

  // 全クリア
  const clearAll = () => {
    setQuery('')
    setChips({ scene: [], purpose: [], type: [], age: null })
    setResults(null)
    setLoading(false)
  }

  // 検索バー入力
  const handleQueryChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setShowSuggest(val.includes('ひな') || val.includes('雛') || val.includes('桃'))
  }

  return (
    <div className="min-h-screen bg-[#F2F5F0] flex flex-col pb-20">

      {/* ── ヘッダー＋検索バー ── */}
      <div
        className="px-4 pt-10 pb-4 flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #1E6B38 0%, #2E7D46 60%, #3A9156 100%)' }}
      >
        {/* タイトル行 */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[15px] font-bold text-white tracking-wide">AI絵本相談</h1>
          <span className="text-[10px] text-[#A8D4B4] bg-white/10 border border-white/20 px-3 py-1 rounded-full font-medium">
            ✦ AI搭載
          </span>
        </div>

        {/* 検索バー */}
        <div className="relative">
          <div className="flex items-center gap-2.5 bg-white rounded-2xl px-4 py-3 shadow-sm">
            <Search size={16} className="text-[#A8D4B4] flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={handleQueryChange}
              onFocus={() => {
                if (query.includes('ひな') || query.includes('雛') || query.includes('桃')) {
                  setShowSuggest(true)
                }
              }}
              onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder="例：午睡前に落ち着ける絵本（3歳）"
              className="flex-1 text-sm text-[#2C2C2A] placeholder-[#C0BDB5] outline-none bg-transparent"
            />
            {query && (
              <button type="button" onClick={() => { setQuery(''); setShowSuggest(false) }}>
                <X size={14} className="text-[#C0BDB5]" />
              </button>
            )}
          </div>

          {/* サジェストドロップダウン */}
          {showSuggest && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-[#DCE4D9] shadow-lg z-50 overflow-hidden">
              {SUGGESTS.map(({ text, tag }) => (
                <button
                  key={text}
                  type="button"
                  onMouseDown={() => { setQuery(text); setShowSuggest(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-[#2C2C2A]
                             border-b border-[#F4F2EC] last:border-0 active:bg-[#EAF5EC]"
                >
                  {/* 星アイコン */}
                  <svg className="w-3.5 h-3.5 flex-shrink-0 fill-[#B4B2A9]" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <span className="flex-1">{text}</span>
                  <span className="text-[10px] bg-[#EAF5EC] text-green-700 px-2 py-0.5 rounded-full flex-shrink-0">
                    {tag}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── スクロールエリア ── */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 flex flex-col gap-4">

        {/* AIに相談するボタン */}
        <button
          type="button"
          onClick={runSearch}
          disabled={!hasAnyInput}
          style={hasAnyInput ? { background: 'linear-gradient(135deg, #E8820A, #F0943A)' } : {}}
          className={`w-full flex items-center gap-3 rounded-2xl p-4 transition-all active:scale-[0.98]
            ${hasAnyInput ? 'shadow-md' : 'bg-[#E8E6E0]'}`}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
            ${hasAnyInput ? 'bg-white/20' : 'bg-[#D4D2CC]'}`}>
            <Sparkles size={18} className={hasAnyInput ? 'text-white' : 'text-[#A0A09C]'} />
          </div>
          <div className="flex-1 text-left">
            <p className={`text-sm font-bold ${hasAnyInput ? 'text-white' : 'text-[#A0A09C]'}`}>AIに相談する</p>
            <p className={`text-xs mt-0.5 ${hasAnyInput ? 'text-orange-100' : 'text-[#B4B2A9]'}`}>文章のまま入力してOK</p>
          </div>
          <span className={`text-xl ${hasAnyInput ? 'text-white/70' : 'text-[#C0BDB5]'}`}>›</span>
        </button>

        {/* ── クイック選択（結果表示中は非表示） ── */}
        {!results && !loading && (
          <div className="flex flex-col gap-5">

            {/* セクション見出し */}
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-bold text-[#8A8A85] tracking-wider">クイック選択</p>
              <div className="flex-1 h-px bg-[#DCE4D9]" />
              <p className="text-[10px] text-[#B4B2A9]">選ぶだけでAIが提案</p>
            </div>

            {/* シーン */}
            <div>
              <SectionLabel color="bg-green-400">シーン</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {SCENES.map(v => (
                  <QChip key={v} label={v} active={chips.scene.includes(v)} onToggle={() => togChip('scene', v)} color="green" />
                ))}
              </div>
            </div>

            {/* 目的 */}
            <div>
              <SectionLabel color="bg-blue-400">目的</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {PURPOSES.map(v => (
                  <QChip key={v} label={v} active={chips.purpose.includes(v)} onToggle={() => togChip('purpose', v)} color="blue" />
                ))}
              </div>
            </div>

            {/* 今の状態（3軸） */}
            <div>
              <SectionLabel color="bg-amber-400">今の状態</SectionLabel>
              <div className="flex flex-col gap-3">
                {TYPE_AXES.map(({ label, basic, more }) => (
                  <div key={label}>
                    <p className="text-[10px] text-[#8A8A85] font-medium mb-1.5">{label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {basic.map(v => (
                        <QChip key={v} label={v} active={chips.type.includes(v)} onToggle={() => togChip('type', v)} color="orange" />
                      ))}
                      {showMore && more.map(v => (
                        <QChip key={v} label={v} active={chips.type.includes(v)} onToggle={() => togChip('type', v)} color="orange" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowMore(v => !v)}
                className="mt-2.5 text-xs text-green-600 border border-[#C3E6C8] rounded-full px-4 py-1.5 active:bg-[#EAF5EC] transition-colors"
              >
                {showMore ? '－ 閉じる' : '＋ もっと見る'}
              </button>
            </div>

            {/* 年齢 */}
            <div>
              <SectionLabel color="bg-green-400">年齢</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {AGES.map(v => (
                  <QChip key={v} label={v} active={chips.age === v} onToggle={() => togChip('age', v)} color="green" />
                ))}
              </div>
            </div>

            {/* 変換プレビュー */}
            {previewText && (
              <div className="bg-[#EAF5EC] border border-[#B8D8BC] rounded-2xl p-3.5 flex items-start gap-2.5">
                <span className="text-base flex-shrink-0 mt-0.5">📝</span>
                <p className="flex-1 text-xs text-[#1B4D2B] leading-relaxed">{previewText}</p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.focus()}
                  className="text-xs text-green-600 flex-shrink-0 self-start"
                >
                  編集
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ローディング ── */}
        {loading && (
          <div className="flex flex-col items-center gap-2 py-12">
            <LoadingDots />
            <p className="text-xs text-[#8A8A85]">AIが絵本を探しています...</p>
          </div>
        )}

        {/* ── 検索結果 ── */}
        {results && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-green-700 flex items-center gap-1">
                <Sparkles size={12} /> AIの提案
              </p>
              <p className="text-[11px] text-[#8A8A85]">{results.length}冊見つかりました</p>
            </div>

            {results.map((book, i) => (
              <BookCard key={i} {...book} />
            ))}

            <button
              type="button"
              onClick={clearAll}
              className="w-full border border-[#C3E6C8] text-green-700 text-xs rounded-2xl py-3
                         hover:bg-[#EAF5EC] active:bg-[#EAF5EC] transition-colors mb-2"
            >
              別の条件で探す
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
