import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'

// ──────────────────────────────────────────
// モックデータ
// ──────────────────────────────────────────
const ALL_BOOKS = [
  { id:1,  emoji:'📗', bg:'#C3E6C8', title:'ぐりとぐら',             author:'中川李枝子',     readCount:8, lastRead:'2026-05-28', ages:['3歳'], fav:true  },
  { id:2,  emoji:'📗', bg:'#C3E6C8', title:'はらぺこあおむし',       author:'エリック・カール', readCount:6, lastRead:'2026-05-26', ages:['2歳','3歳'], fav:true  },
  { id:3,  emoji:'📘', bg:'#C3DCF0', title:'スイミー',               author:'レオ・レオーニ',  readCount:5, lastRead:'2026-05-29', ages:['3歳','4歳'], fav:false },
  { id:4,  emoji:'📙', bg:'#F9DDC0', title:'からすのパンやさん',      author:'かこさとし',     readCount:4, lastRead:'2026-05-23', ages:['3歳'], fav:false },
  { id:5,  emoji:'📕', bg:'#F9C8C8', title:'ねないこだれだ',         author:'せなけいこ',     readCount:3, lastRead:'2026-05-15', ages:['2歳','3歳'], fav:true  },
  { id:6,  emoji:'📒', bg:'#F5EAB0', title:'おおきなかぶ',           author:'トルストイ',     readCount:4, lastRead:'2026-05-23', ages:['3歳','4歳'], fav:false },
  { id:7,  emoji:'📗', bg:'#C3E6C8', title:'いないいないばあ',       author:'まついのりこ',   readCount:7, lastRead:'2026-05-11', ages:['0歳','1歳'], fav:true  },
  { id:8,  emoji:'📘', bg:'#C3DCF0', title:'おつきさまこんにちは',   author:'林明子',         readCount:3, lastRead:'2026-05-08', ages:['1歳','2歳'], fav:false },
  { id:9,  emoji:'📙', bg:'#F9DDC0', title:'ぐるんぱのようちえん',   author:'西内ミナミ',     readCount:2, lastRead:'2026-05-11', ages:['3歳','4歳'], fav:false },
  { id:10, emoji:'📗', bg:'#C3E6C8', title:'ももんちゃんあそぼう',   author:'とよたかずひこ', readCount:3, lastRead:'2026-05-15', ages:['1歳','2歳'], fav:false },
  { id:11, emoji:'📒', bg:'#F5EAB0', title:'だるまさんが',           author:'かがくいひろし', readCount:5, lastRead:'2026-04-22', ages:['0歳','1歳','2歳'], fav:true  },
  { id:12, emoji:'📕', bg:'#F9C8C8', title:'しろくまちゃんのほっとけーき', author:'わかやまけん', readCount:2, lastRead:'2026-05-16', ages:['2歳','3歳'], fav:false },
]

const RANKING = [
  { rank:1, emoji:'📗', bg:'#C3E6C8', title:'ぐりとぐら',       reactions:['😊笑い','🎯集中','💬言葉返し'] },
  { rank:2, emoji:'📗', bg:'#C3E6C8', title:'はらぺこあおむし', reactions:['💬言葉返し','😊笑い'] },
  { rank:3, emoji:'📒', bg:'#F5EAB0', title:'だるまさんが',     reactions:['🔁もう一回','😊笑い'] },
  { rank:4, emoji:'📘', bg:'#C3DCF0', title:'スイミー',         reactions:['🌙余韻','🎯集中'] },
  { rank:5, emoji:'📗', bg:'#C3E6C8', title:'いないいないばあ', reactions:['😊笑い','🔁もう一回'] },
]

const WISHLIST_BOOKS = [
  { id:101, emoji:'📗', bg:'#C3E6C8', title:'おおきなかぶ',      author:'トルストイ',     reason:'AIおすすめ・行事前' },
  { id:102, emoji:'📘', bg:'#C3DCF0', title:'からすのパンやさん', author:'かこさとし',     reason:'自分で追加 · 5月18日' },
]

const AGE_FILTERS = ['すべて', '0歳', '1歳', '2歳', '3歳', '4歳', '5歳', '混合']
const TABS = [
  { id: 'read',    label: '読んだもの' },
  { id: 'fav',     label: '心に残ったもの' },
  { id: 'wishlist',label: '読んでみたいもの' },
  { id: 'ranking', label: '人気のもの' },
]

function formatDate(str) {
  const [, m, d] = str.split('-')
  return `${parseInt(m)}月${parseInt(d)}日`
}

// ──────────────────────────────────────────
// 絵本カード（グリッド用）
// ──────────────────────────────────────────
function BookCard({ book, onPress }) {
  return (
    <button onClick={onPress} className="bg-white border border-[#DCE4D9] rounded-2xl overflow-hidden text-left active:scale-95 transition-transform w-full">
      {/* 表紙 */}
      <div className="aspect-[3/4] flex items-center justify-center text-4xl rounded-t-2xl"
           style={{ background: book.bg }}>
        {book.emoji}
      </div>
      {/* 書誌情報 */}
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

// ──────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────
export default function Bookshelf() {
  const navigate    = useNavigate()
  const [activeTab,  setActiveTab]  = useState('read')
  const [ageFilter,  setAgeFilter]  = useState('すべて')
  const [query,      setQuery]      = useState('')

  // フィルタリング
  const filteredBooks = ALL_BOOKS.filter(b => {
    const matchAge   = ageFilter === 'すべて' || b.ages.includes(ageFilter)
    const matchQuery = query === '' ||
      b.title.includes(query) || b.author.includes(query)
    return matchAge && matchQuery
  })

  const displayBooks =
    activeTab === 'fav'      ? filteredBooks.filter(b => b.fav) :
    activeTab === 'wishlist' ? WISHLIST_BOOKS :
    activeTab === 'ranking'  ? null :
    filteredBooks

  return (
    <div className="min-h-screen bg-[#F2F5F0] pb-24">

      {/* ── ヘッダー ── */}
      <div
        className="px-4 pt-10 pb-4 flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #1E6B38 0%, #2E7D46 60%, #3A9156 100%)' }}
      >
        <h1 className="text-[15px] font-bold text-white tracking-wide mb-3">本棚</h1>

        {/* 検索バー */}
        <div className="flex items-center gap-2.5 bg-white rounded-2xl px-4 py-3 shadow-sm">
          <Search size={16} className="text-[#A8D4B4] flex-shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ものを検索..."
            className="flex-1 text-sm text-[#2C2C2A] placeholder-[#C0BDB5] outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery('')}>
              <X size={14} className="text-[#C0BDB5]" />
            </button>
          )}
        </div>
      </div>

      {/* ── タブ ── */}
      <div className="bg-white border-b border-[#E0E8DC] flex overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`text-xs px-5 py-3 flex-shrink-0 border-b-2 transition-all font-medium
              ${activeTab === t.id
                ? 'text-green-700 border-green-600'
                : 'text-[#8A8A85] border-transparent'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 絞り込み（ランキング以外） ── */}
      {activeTab !== 'ranking' && activeTab !== 'wishlist' && (
        <div className="flex gap-1.5 overflow-x-auto px-4 py-3 bg-white border-b border-[#F0EDE6]">
          {AGE_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setAgeFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border flex-shrink-0 transition-all
                ${ageFilter === f
                  ? 'bg-green-700 border-green-700 text-white font-medium'
                  : 'bg-white border-[#D4D2CC] text-[#444441]'}`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* ── コンテンツ ── */}
      <div className="px-4 pt-4">

        {/* 読んだ本 / お気に入り：グリッド */}
        {(activeTab === 'read' || activeTab === 'fav') && (
          <>
            <p className="text-[11px] text-[#8A8A85] mb-3">
              {displayBooks.length}件
            </p>
            {displayBooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#B4B2A9]">
                <span className="text-4xl mb-3">📚</span>
                <p className="text-sm">まだ記録がありません</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {displayBooks.map(book => (
                  <BookCard key={book.id} book={book}
                    onPress={() => navigate(`/bookshelf/${book.id}`, { state: { book } })} />
                ))}
              </div>
            )}
          </>
        )}

        {/* 読みたい */}
        {activeTab === 'wishlist' && (
          <div className="flex flex-col gap-3">
            {WISHLIST_BOOKS.map(book => (
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
                {/* 順位 */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                  ${item.rank === 1 ? 'bg-yellow-400 text-white' :
                    item.rank === 2 ? 'bg-gray-300 text-white' :
                    item.rank === 3 ? 'bg-amber-600 text-white' :
                    'bg-[#F0F4EE] text-[#8A8A85]'}`}>
                  {item.rank}
                </div>
                {/* 表紙 */}
                <div className="w-11 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                     style={{ background: item.bg }}>
                  {item.emoji}
                </div>
                {/* 情報 */}
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
    </div>
  )
}
