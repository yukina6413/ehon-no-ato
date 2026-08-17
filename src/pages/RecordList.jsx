import { useState, useEffect } from 'react'
import { Search, BookOpen } from 'lucide-react'
import { getPracticeLogs, formatAgeGroups } from '../lib/dataAdapter'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}月${parseInt(d)}日`
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
      <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
      <p>記録がまだありません</p>
      <p className="text-xs mt-1">「記録する」から読み聞かせを記録しましょう</p>
    </div>
  )
}

export default function RecordList() {
  const [records,     setRecords]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [query,       setQuery]       = useState('')

  useEffect(() => {
    getPracticeLogs()
      .then(data => setRecords(data))
      .catch(err => {
        console.error('記録取得エラー:', err)
        setError('記録の取得に失敗しました。再度お試しください。')
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = records.filter(r => {
    if (!query) return true
    return (
      r.book_title?.includes(query) ||
      r.book_author?.includes(query) ||
      r.episode?.includes(query) ||
      r.insight?.includes(query)
    )
  })

  return (
    <div className="pb-24 min-h-screen bg-sage-50">
      <header className="bg-green-600 text-white px-4 pt-10 pb-5">
        <h1 className="text-xl font-bold">記録一覧</h1>
        <p className="text-green-100 text-sm mt-0.5">
          {loading ? '読み込み中...' : `全${records.length}件の記録`}
        </p>
      </header>

      <div className="px-4 py-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="タイトル・著者・メモで検索"
            value={query} onChange={e => setQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm
                       focus:outline-none focus:border-green-400" />
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
            <p>読み込み中...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-red-500 text-sm">{error}</p>
            <button onClick={() => {
              setLoading(true)
              setError(null)
              getPracticeLogs()
                .then(data => setRecords(data))
                .catch(err => {
                  console.error(err)
                  setError('記録の取得に失敗しました。')
                })
                .finally(() => setLoading(false))
            }} className="text-green-600 text-xs mt-2">
              もう一度試す
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400">{filtered.length}件</p>
            <div className="space-y-3">
              {filtered.length === 0 ? (
                records.length === 0 ? <EmptyState /> : (
                  <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                    <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                    <p>記録が見つかりません</p>
                  </div>
                )
              ) : (
                filtered.map(rec => (
                  <div key={rec.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-14 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                        <BookOpen size={20} className="text-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-gray-800 truncate">{rec.book_title}</p>
                          {rec.age_groups?.length > 0 && (
                            <span className="text-xs bg-green-50 text-green-600 rounded-full px-2 py-0.5 shrink-0">
                              {formatAgeGroups(rec.age_groups)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {rec.book_author && `${rec.book_author}　`}
                          {formatDate(rec.read_date)}
                        </p>
                        {rec.reactions?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {rec.reactions.map(t => (
                              <span key={t} className="text-xs bg-green-50 text-green-700 rounded-full px-2 py-0.5">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {rec.episode && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{rec.episode}</p>
                        )}
                        {!rec.episode && rec.after_type && (
                          <p className="text-sm text-gray-500 mt-2">{rec.after_type}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
