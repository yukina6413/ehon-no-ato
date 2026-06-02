import { useState } from 'react'
import { Search, BookOpen } from 'lucide-react'

const allRecords = [
  { id: 1, title: 'ぐりとぐら',           author: '中川李枝子',     date: '2026-05-28', class: 'うさぎ組', tags: ['笑った', 'まねをした'],    memo: '「おおきなカステラ食べたい！」と大盛り上がり。給食のあとも話題に。' },
  { id: 2, title: 'はらぺこあおむし',     author: 'エリック・カール', date: '2026-05-26', class: 'ひよこ組', tags: ['質問が多かった'],           memo: '食べ物のページで「これ知ってる！」と指差しが多かった。' },
  { id: 3, title: 'ねないこだれだ',       author: 'せなけいこ',      date: '2026-05-24', class: 'うさぎ組', tags: ['こわがった', '笑った'],     memo: 'おばけが出るたびに「こわい〜！」と抱き合って笑っていた。' },
  { id: 4, title: 'おおきなかぶ',         author: 'トルストイ',      date: '2026-05-22', class: 'ぞう組',   tags: ['とても喜んだ', '笑った'],   memo: '「うんとこしょ」を一緒に言ってくれた。繰り返しが楽しそう。' },
  { id: 5, title: 'ちいさなうさこちゃん', author: 'ディック・ブルーナ', date: '2026-05-20', class: 'ひよこ組', tags: ['静かに聞いていた'],      memo: '絵をじっと見て、うさこちゃんに話しかけている子がいた。' },
  { id: 6, title: '三びきのやぎのがらがらどん', author: 'アスビョルンセン', date: '2026-05-18', class: 'ぞう組', tags: ['こわがった', 'とても喜んだ'], memo: 'トロルが出る場面でドキドキしながら固まっていた。' },
]

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export default function RecordList() {
  const [query, setQuery] = useState('')
  const [filterClass, setFilterClass] = useState('すべて')

  const classes = ['すべて', ...new Set(allRecords.map((r) => r.class))]

  const filtered = allRecords.filter((r) => {
    const matchQuery =
      query === '' ||
      r.title.includes(query) ||
      r.author.includes(query) ||
      r.memo.includes(query)
    const matchClass = filterClass === 'すべて' || r.class === filterClass
    return matchQuery && matchClass
  })

  return (
    <div className="pb-24 min-h-screen bg-sage-50">
      <header className="bg-green-600 text-white px-4 pt-10 pb-5">
        <h1 className="text-xl font-bold">記録一覧</h1>
        <p className="text-green-100 text-sm mt-0.5">全{allRecords.length}冊の記録</p>
      </header>

      <div className="px-4 py-4 space-y-3">
        {/* 検索バー */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="タイトル・著者・メモで検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-green-400"
          />
        </div>

        {/* クラスフィルター */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {classes.map((c) => (
            <button
              key={c}
              onClick={() => setFilterClass(c)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm border transition-colors ` +
                (filterClass === c
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-600 border-gray-200')}
            >
              {c}
            </button>
          ))}
        </div>

        {/* 記録カード */}
        <p className="text-xs text-gray-400">{filtered.length}件</p>
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
              <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
              <p>記録が見つかりません</p>
            </div>
          ) : (
            filtered.map((rec) => (
              <div key={rec.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  {/* 本のアイコン */}
                  <div className="w-11 h-14 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                    <BookOpen size={20} className="text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-gray-800 truncate">{rec.title}</p>
                      <span className="text-xs bg-green-50 text-green-600 rounded-full px-2 py-0.5 shrink-0">{rec.class}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{rec.author}　{formatDate(rec.date)}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {rec.tags.map((t) => (
                        <span key={t} className="text-xs bg-green-50 text-green-700 rounded-full px-2 py-0.5">{t}</span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{rec.memo}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
