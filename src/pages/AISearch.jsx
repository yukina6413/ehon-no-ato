import { useState, useRef, useEffect } from 'react'
import { Search, X, Sparkles } from 'lucide-react'
import BookCard from '../components/BookCard'
import { getChildStates, searchBooksByState, findStatesByText } from '../lib/dataAdapter'

const SCENES = ['朝の会', '帰りの会', '活動の導入', '午睡前', '行事前', '自由遊び']
const AGES   = ['0歳', '1歳', '2歳', '3歳', '4歳', '5歳', '混合']

function LoadingDots() {
  return (
    <div className="flex justify-center items-center gap-2 py-12">
      {[0, 0.2, 0.4].map((delay, i) => (
        <div key={i} className="w-2.5 h-2.5 rounded-full bg-green-400 dot-bounce"
          style={{ animationDelay: `${delay}s` }} />
      ))}
    </div>
  )
}

function QChip({ label, active, onToggle, color = 'green' }) {
  const onCls = {
    green:  'bg-green-700 border-green-700 text-white',
    blue:   'bg-blue-700  border-blue-700  text-white',
    orange: 'bg-amber-700 border-amber-700 text-white',
  }[color]
  return (
    <button type="button" onClick={onToggle}
      className={`text-xs px-3 py-1.5 rounded-full border transition-all active:scale-95
        ${active ? onCls : 'bg-white border-[#D4D2CC] text-[#444441]'}`}>
      {label}
    </button>
  )
}

function SectionLabel({ color = 'bg-green-400', children }) {
  return (
    <p className="text-xs font-bold text-[#5A5A57] mb-2 flex items-center gap-1.5">
      <span className={`w-0.5 h-3 rounded-full inline-block ${color}`} />
      {children}
    </p>
  )
}

function toAgeRange(min, max) {
  if (min == null && max == null) return null
  if (min != null && max != null) return `${min}〜${max}歳`
  if (min != null) return `${min}歳〜`
  return `〜${max}歳`
}

function toBadges(book) {
  const badges = []
  if (book.has_practice_log) badges.push('実践記録あり')
  if (book.has_care_points)  badges.push('配慮あり')
  if (book.has_avoid_context) badges.push('控えたい場面あり')
  return badges
}

export default function AISearch() {
  const [query,          setQuery]          = useState('')
  const [selectedScene,  setSelectedScene]  = useState(null)
  const [selectedAge,    setSelectedAge]    = useState(null)
  const [selectedStateId, setSelectedStateId] = useState(null)
  const [stateFilter,    setStateFilter]    = useState('')
  const [loading,        setLoading]        = useState(false)
  const [results,        setResults]        = useState(null)
  const [error,          setError]          = useState(null)
  const [childStates,    setChildStates]    = useState([])
  const [statesLoading,  setStatesLoading]  = useState(true)
  const [statesError,    setStatesError]    = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    getChildStates()
      .then(data => setChildStates(data))
      .catch(err => {
        console.error('子どもの姿取得エラー:', err)
        setStatesError('子どもの姿を読み込めませんでした')
      })
      .finally(() => setStatesLoading(false))
  }, [])

  const filteredStates = childStates.filter(s =>
    !stateFilter || s.label.includes(stateFilter)
  )

  const hasAnyInput = selectedStateId || query.trim()

  const runSearch = async () => {
    if (!hasAnyInput) return
    setResults(null)
    setError(null)
    setLoading(true)
    try {
      let stateId = selectedStateId
      let matchedLabel = childStates.find(s => s.id === stateId)?.label ?? null

      // 自由記述 → 子どもの姿マッチ
      if (!stateId && query.trim()) {
        const matches = await findStatesByText(query.trim())
        if (matches.length > 0) {
          stateId = matches[0].id
          matchedLabel = matches[0].label
          console.log(`[検索] "${query}" → 子どもの姿「${matchedLabel}」にマッチ（候補${matches.length}件）`)
        } else {
          console.log(`[検索] "${query}" → 一致する子どもの姿なし`)
          setResults([])
          return
        }
      }

      const data = await searchBooksByState(stateId, selectedAge, selectedScene)
      console.log(`[検索] 姿:「${matchedLabel}」 年齢:${selectedAge ?? 'なし'} 場面:${selectedScene ?? 'なし'} → ${data.length}冊`)
      data.forEach(b => {
        console.log(`  ・${b.title}  score:${b.score}  seasonal_tags:${JSON.stringify(b.seasonal_tags)}`)
      })
      setResults(data)
    } catch (err) {
      console.error('検索エラー:', err)
      setError('絵本の検索に失敗しました。しばらくしてから再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const clearAll = () => {
    setQuery('')
    setSelectedScene(null)
    setSelectedAge(null)
    setSelectedStateId(null)
    setStateFilter('')
    setResults(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-[#F2F5F0] flex flex-col pb-20">

      {/* ── ヘッダー＋検索バー ── */}
      <div className="px-4 pt-10 pb-4 flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #1E6B38 0%, #2E7D46 60%, #3A9156 100%)' }}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[15px] font-bold text-white tracking-wide">AI絵本相談</h1>
          <span className="text-[10px] text-[#A8D4B4] bg-white/10 border border-white/20 px-3 py-1 rounded-full font-medium">
            ✦ AI搭載
          </span>
        </div>
        <div className="relative">
          <div className="flex items-center gap-2.5 bg-white rounded-2xl px-4 py-3 shadow-sm">
            <Search size={16} className="text-[#A8D4B4] flex-shrink-0" />
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder="例：午睡前に落ち着ける絵本（3歳）"
              className="flex-1 text-sm text-[#2C2C2A] placeholder-[#C0BDB5] outline-none bg-transparent" />
            {query && (
              <button type="button" onClick={() => setQuery('')}>
                <X size={14} className="text-[#C0BDB5]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── スクロールエリア ── */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 flex flex-col gap-4">

        {/* AIに相談するボタン */}
        <button type="button" onClick={runSearch} disabled={!hasAnyInput}
          style={hasAnyInput ? { background: 'linear-gradient(135deg, #E8820A, #F0943A)' } : {}}
          className={`w-full flex items-center gap-3 rounded-2xl p-4 transition-all active:scale-[0.98]
            ${hasAnyInput ? 'shadow-md' : 'bg-[#E8E6E0]'}`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
            ${hasAnyInput ? 'bg-white/20' : 'bg-[#D4D2CC]'}`}>
            <Sparkles size={18} className={hasAnyInput ? 'text-white' : 'text-[#A0A09C]'} />
          </div>
          <div className="flex-1 text-left">
            <p className={`text-sm font-bold ${hasAnyInput ? 'text-white' : 'text-[#A0A09C]'}`}>AIに相談する</p>
            <p className={`text-xs mt-0.5 ${hasAnyInput ? 'text-orange-100' : 'text-[#B4B2A9]'}`}>
              子どもの姿を選んで絵本を探す
            </p>
          </div>
          <span className={`text-xl ${hasAnyInput ? 'text-white/70' : 'text-[#C0BDB5]'}`}>›</span>
        </button>

        {/* ── クイック選択（結果表示中は非表示） ── */}
        {!results && !loading && (
          <div className="flex flex-col gap-5">

            <div className="flex items-center gap-3">
              <p className="text-[10px] font-bold text-[#8A8A85] tracking-wider">クイック選択</p>
              <div className="flex-1 h-px bg-[#DCE4D9]" />
              <p className="text-[10px] text-[#B4B2A9]">選ぶだけで絵本を提案</p>
            </div>

            {/* 子どもの姿（child_states）*/}
            <div>
              <SectionLabel color="bg-amber-400">今の子どもの姿</SectionLabel>
              {statesLoading ? (
                <p className="text-xs text-[#8A8A85] py-2">読み込み中...</p>
              ) : statesError ? (
                <p className="text-xs text-red-500 py-2">{statesError}</p>
              ) : (
                <>
                  <div className="mb-2">
                    <input value={stateFilter} onChange={e => setStateFilter(e.target.value)}
                      placeholder="絞り込み..."
                      className="w-full text-xs border border-[#DCE4D9] rounded-xl px-3 py-1.5 outline-none focus:border-green-400 bg-white" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {filteredStates.map(s => (
                      <QChip key={s.id} label={s.label}
                        active={selectedStateId === s.id}
                        onToggle={() => setSelectedStateId(prev => prev === s.id ? null : s.id)}
                        color="orange" />
                    ))}
                    {filteredStates.length === 0 && (
                      <p className="text-xs text-[#B4B2A9]">一致する姿がありません</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* シーン */}
            <div>
              <SectionLabel color="bg-green-400">シーン</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {SCENES.map(v => (
                  <QChip key={v} label={v}
                    active={selectedScene === v}
                    onToggle={() => setSelectedScene(prev => prev === v ? null : v)}
                    color="green" />
                ))}
              </div>
            </div>

            {/* 年齢 */}
            <div>
              <SectionLabel color="bg-green-400">年齢</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {AGES.map(v => (
                  <QChip key={v} label={v}
                    active={selectedAge === v}
                    onToggle={() => setSelectedAge(prev => prev === v ? null : v)}
                    color="green" />
                ))}
              </div>
            </div>

            {/* 選択プレビュー */}
            {selectedStateId && (
              <div className="bg-[#EAF5EC] border border-[#B8D8BC] rounded-2xl p-3.5 flex items-start gap-2.5">
                <span className="text-base flex-shrink-0 mt-0.5">🔍</span>
                <p className="flex-1 text-xs text-[#1B4D2B] leading-relaxed">
                  「{childStates.find(s => s.id === selectedStateId)?.label}」の場面に合う絵本を探します
                  {selectedAge && `（${selectedAge}）`}
                  {selectedScene && `・${selectedScene}`}
                </p>
                <button type="button" onClick={clearAll}
                  className="text-xs text-green-600 flex-shrink-0 self-start">
                  クリア
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ローディング ── */}
        {loading && (
          <div className="flex flex-col items-center gap-2 py-12">
            <LoadingDots />
            <p className="text-xs text-[#8A8A85]">絵本を探しています...</p>
          </div>
        )}

        {/* ── エラー ── */}
        {error && (
          <div className="bg-white border border-[#DCE4D9] rounded-2xl p-4 text-center">
            <p className="text-sm text-[#5A5A57]">{error}</p>
            <button onClick={clearAll} className="text-xs text-green-600 mt-2">
              もう一度試す
            </button>
          </div>
        )}

        {/* ── 検索結果 ── */}
        {results && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-green-700 flex items-center gap-1">
                <Sparkles size={12} /> 絵本の提案
              </p>
              <p className="text-[11px] text-[#8A8A85]">
                {results.length > 0 ? `${results.length}冊見つかりました` : '該当する絵本がありませんでした'}
              </p>
            </div>

            {results.length === 0 ? (
              <div className="bg-white border border-[#DCE4D9] rounded-2xl p-6 text-center">
                <p className="text-sm text-[#8A8A85]">条件を変えてもう一度お試しください</p>
              </div>
            ) : (
              results.map(book => (
                <BookCard
                  key={book.book_id}
                  title={book.title}
                  author={book.author}
                  ageRange={toAgeRange(book.age_min, book.age_max)}
                  badges={toBadges(book)}
                  summary={book.summary}
                  carePoints={book.care_points}
                  nextActivities={book.next_activities}
                />
              ))
            )}

            <button type="button" onClick={clearAll}
              className="w-full border border-[#C3E6C8] text-green-700 text-xs rounded-2xl py-3
                         hover:bg-[#EAF5EC] active:bg-[#EAF5EC] transition-colors mb-2">
              別の条件で探す
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
