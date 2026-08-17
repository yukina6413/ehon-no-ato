import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, BookOpen } from 'lucide-react'
import { getPracticeLogs } from '../lib/dataAdapter'

const MOCK_WISHLIST = [
  { id:101, emoji:'📗', bg:'#C3E6C8', title:'おおきなかぶ',      author:'トルストイ',     reason:'自分で追加' },
  { id:102, emoji:'📘', bg:'#C3DCF0', title:'からすのパンやさん', author:'かこさとし',     reason:'自分で追加' },
]

const RANKING = [
  { rank:1, emoji:'📗', bg:'#C3E6C8', title:'ぐりとぐら',       reactions:['😊笑い','🎯集中','💬言葉返し'] },
  { rank:2, emoji:'📗', bg:'#C3E6C8', title:'はらぺこあおむし', reactions:['💬言葉返し','😊笑い'] },
  { rank:3, emoji:'📒', bg:'#F5EAB0', title:'だるまさんが',     reactions:['🔁もう一回','😊笑い'] },
]

const AGE_FILTERS = ['すべて', '0歳児', '1歳児', '2歳児', '3歳児', '4歳児', '5歳児', '混合']
const TABS = [
  { id: 'read',     label: '読んだもの' },
  { id: 'fav',      label: '心に残ったもの' },
  { id: 'wishlist', label: '読んでみたいもの' },
  { id: 'ranking',  label: '人気のもの' },
]

const BOOK_COLORS = ['#C3E6C8','#C3DCF0','#F9DDC0','#F9C8C8','#F5EAB0','#E8E0F8']
const BOOK_EMOJIS = ['📗','📘','📙','📕','📒','📓']

function colorForTitle(title) {
  let h = 0
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return BOOK_COLORS[Math.abs(h) % BOOK_COLORS.length]
}
function emojiForTitle(title) {
  let h = 0
  for (const c of title) h = (h * 37 + c.charCodeAt(0)) & 0xffffffff
  return BOOK_EMOJIS[Math.abs(h) % BOOK_EMOJIS.length]
}

function formatDate(str) {
  if (!str) return ''
  const [, m, d] = str.split('-')
  return `${parseInt(m)}月${parseInt(d)}日`
}

function logsToBooks(logs) {
  const map = {}
  logs.forEach(log => {
    const key = log.book_title || '（タイトルなし）'
    if (!map[key]) {
      map[key] = {
        id: key,
        emoji: emojiForTitle(key),
        bg: colorForTitle(key),
        title: key,
        author: log.book_author || '',
        readCount: 0,
        lastRead: log.read_date || '',
        ages: log.age_groups || [],
        fav: false,
      }
    }
    map[key].readCount++
    if (log.read_date && log.read_date > map[key].lastRead) {
      map[key].lastRead = log.read_date
    }
  })
  return Object.values(map).sort((a, b) => b.lastRead.localeCompare(a.lastRead))
}

function BookCard({ book, onPress }) {
  return (
    <button onClick={onPress}
      className="bg-white border border-[#DCE4D9] rounded-2xl overflow-hidden text-left active:scale-95 transition-transform w-full">
      <div className="aspect-[3/4] flex items-center justify-center text-4xl rounded-t-2xl"
           style={{ background: book.bg }}>
        {book.emoji}
      </div>
      <div className="p-2.5">
        <p className="text-xs font-bold text-[#2C2C2A] leading-snug mb-0.5 line-clamp-2">{book.title}</p>
        <p className="text-[10px] text-[#8A8A85] mb-2 truncate">{book.author}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-green-700 font-medium">{book.readCount}回読んだ</span>
        </div>
        <p className="text-[10px] text-[#B4B2A9] mt-0.5">{formatDate(book.lastRead)}</p>
      </div>
    </button>
  )
}

export default function Bookshelf() {
  const navigate  = useNavigate()
  const [activeTab,  setActiveTab]  = useState('read')
  const [ageFilter,  setAgeFilter]  = useState('すべて')
  const [query,      setQuery]      = useState('')
  const [allBooks,   setAllBooks]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  useEffect(() => {
    getPracticeLogs()
      .then(logs => setAllBooks(logsToBooks(logs)))
      .catch(err => {
        console.error('本棚取得エラー:', err)
        setError('本棚の取得に失敗しました')
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredBooks = allBooks.filter(b => {
    const matchAge = ageFilter === 'すべて' || b.ages.includes(ageFilter)
    const matchQ   = !query || b.title.includes(query) || b.author.includes(query)
    return matchAge && matchQ
  })

  const displayBooks =
    activeTab === 'fav'  ? filteredBooks.filter(b => b.fav) :
    activeTab === 'read' ? filteredBooks : null

  return (
    <div className="min-h-screen bg-[#F2F5F0] pb-24">
      <div className="px-4 pt-10 pb-4 flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #1E6B38 0%, #2E7D46 60%, #3A9156 100%)' }}>
        <h1 className="text-[15px] font-bold text-white tracking-wide mb-3">本棚</h1>
        <div className="flex items-center gap-2.5 bg-white rounded-2xl px-4 py-3 shadow-sm">
          <Search size={16} className="text-[#A8D4B4] flex-shrink-0" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="絵本を検索..."
            className="flex-1 text-sm text-[#2C2C2A] placeholder-[#C0BDB5] outline-none bg-transparent" />
          {query && (
            <button onClick={() => setQuery('')}>
              <X size={14} className="text-[#C0BDB5]" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border-b border-[#E0E8DC] flex overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`text-xs px-5 py-3 flex-shrink-0 border-b-2 transition-all font-medium
              ${activeTab === t.id ? 'text-green-700 border-green-600' : 'text-[#8A8A85] border-transparent'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {(activeTab === 'read' || activeTab === 'fav') && (
        <div className="flex gap-1.5 overflow-x-auto px-4 py-3 bg-white border-b border-[#F0EDE6]">
          {AGE_FILTERS.map(f => (
            <button key={f} onClick={() => setAgeFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border flex-shrink-0 transition-all
                ${ageFilter === f
                  ? 'bg-green-700 border-green-700 text-white font-medium'
                  : 'bg-white border-[#D4D2CC] text-[#444441]'}`}>
              {f}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 pt-4">

        {/* 読んだもの / 心に残ったもの */}
        {(activeTab === 'read' || activeTab === 'fav') && (
          <>
            {loading ? (
              <p className="text-sm text-[#8A8A85] text-center py-8">読み込み中...</p>
            ) : error ? (
              <p className="text-sm text-red-500 text-center py-8">{error}</p>
            ) : (
              <>
                <p className="text-[11px] text-[#8A8A85] mb-3">{(displayBooks || []).length}件</p>
                {(displayBooks || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-[#B4B2A9]">
                    <span className="text-4xl mb-3">📚</span>
                    <p className="text-sm">
                      {activeTab === 'fav'
                        ? 'お気に入りはまだありません'
                        : '記録がまだありません'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {(displayBooks || []).map(book => (
                      <BookCard key={book.id} book={book}
                        onPress={() => navigate(`/records`)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 読みたい */}
        {activeTab === 'wishlist' && (
          <div className="flex flex-col gap-3">
            {MOCK_WISHLIST.map(book => (
              <div key={book.id} className="bg-white border border-[#DCE4D9] rounded-2xl p-4 flex gap-3 items-center">
                <div className="w-11 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                     style={{ background: book.bg }}>
                  {book.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#2C2C2A] truncate">{book.title}</p>
                  <p className="text-[11px] text-[#8A8A85] mt-0.5">{book.author}</p>
                  <p className="text-[11px] text-[#B4B2A9] mt-0.5">{book.reason}</p>
                </div>
                <button className="text-xs bg-[#EAF5EC] text-green-800 font-medium px-3 py-1.5 rounded-xl flex-shrink-0">
                  購入する
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ランキング */}
        {activeTab === 'ranking' && (
          <div className="flex flex-col gap-3">
            <p className="text-[11px] text-[#8A8A85]">保育現場で子どもの反応が良かったもの</p>
            {RANKING.map(item => (
              <div key={item.rank} className="bg-white border border-[#DCE4D9] rounded-2xl p-4 flex gap-3 items-start">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                  ${item.rank === 1 ? 'bg-yellow-400 text-white' :
                    item.rank === 2 ? 'bg-gray-300 text-white' :
                    item.rank === 3 ? 'bg-amber-600 text-white' :
                    'bg-[#F0F4EE] text-[#8A8A85]'}`}>
                  {item.rank}
                </div>
                <div className="w-11 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                     style={{ background: item.bg }}>
                  {item.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#2C2C2A] mb-1.5">{item.title}</p>
                  <div className="flex flex-wrap gap-1">
                    {item.reactions.map(r => (
                      <span key={r} className="text-[10px] bg-[#EAF5EC] text-[#1B4D2B] rounded-full px-2 py-0.5">{r}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-[#F4F6F2] border border-[#DCE4D9] rounded-2xl p-4 text-center">
              <p className="text-xs text-[#8A8A85]">🔜 年齢別・季節別ランキングは近日公開予定です</p>
            </div>
          </div>
        )}
      </div>

      {/* 空の絵本アイコン */}
      {activeTab !== 'wishlist' && activeTab !== 'ranking' && !loading && !error && allBooks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[#B4B2A9]">
          <BookOpen size={40} className="mb-3 opacity-30" />
          <p className="text-sm">記録がまだありません</p>
        </div>
      )}
    </div>
  )
}
