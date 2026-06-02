import { useState } from 'react'
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'

const recordDates = {
  '2026-05-28': [{ title: 'ぐりとぐら', class: 'うさぎ組' }],
  '2026-05-26': [{ title: 'はらぺこあおむし', class: 'ひよこ組' }],
  '2026-05-24': [{ title: 'ねないこだれだ', class: 'うさぎ組' }],
  '2026-05-22': [{ title: 'おおきなかぶ', class: 'ぞう組' }],
  '2026-05-20': [{ title: 'ちいさなうさこちゃん', class: 'ひよこ組' }],
  '2026-05-18': [{ title: '三びきのやぎのがらがらどん', class: 'ぞう組' }],
}

const DAYS = ['日', '月', '火', '水', '木', '金', '土']

function pad(n) { return String(n).padStart(2, '0') }

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState(null)

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelected(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelected(null)
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  const selectedKey = selected ? `${year}-${pad(month + 1)}-${pad(selected)}` : null
  const selectedRecords = selectedKey ? recordDates[selectedKey] || [] : []

  return (
    <div className="pb-24 min-h-screen bg-sage-50">
      <header className="bg-green-600 text-white px-4 pt-10 pb-5">
        <h1 className="text-xl font-bold">カレンダー</h1>
        <p className="text-green-100 text-sm mt-0.5">読んだ日を振り返る</p>
      </header>

      <div className="px-4 py-4">
        {/* 月ナビゲーション */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button onClick={prevMonth} className="p-1.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors">
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <h2 className="font-bold text-gray-800">{year}年{month + 1}月</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors">
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          </div>

          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 text-center">
            {DAYS.map((d, i) => (
              <div key={d} className={`py-2 text-xs font-bold ` + (i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500')}>
                {d}
              </div>
            ))}
          </div>

          {/* 日付グリッド */}
          <div className="grid grid-cols-7 text-center pb-3">
            {cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />
              const key = `${year}-${pad(month + 1)}-${pad(day)}`
              const hasRecord = !!recordDates[key]
              const isToday = key === todayStr
              const isSelected = selected === day

              return (
                <button
                  key={key}
                  onClick={() => setSelected(isSelected ? null : day)}
                  className="flex flex-col items-center py-1.5"
                >
                  <span className={`
                    w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors
                    ${isSelected ? 'bg-green-500 text-white' :
                      isToday ? 'bg-green-100 text-green-700 font-bold' :
                      'hover:bg-gray-100'}
                    ${i % 7 === 0 && !isSelected && !isToday ? 'text-red-400' :
                      i % 7 === 6 && !isSelected && !isToday ? 'text-blue-400' : ''}
                  `}>
                    {day}
                  </span>
                  {hasRecord && (
                    <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-green-400'}`} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 凡例 */}
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          絵本の記録あり
        </p>

        {/* 選択日の記録 */}
        {selected && (
          <div className="mt-4">
            <h3 className="font-bold text-gray-700 mb-2">
              {month + 1}月{selected}日の記録
            </h3>
            {selectedRecords.length === 0 ? (
              <div className="bg-white rounded-2xl p-5 text-center text-gray-400 text-sm shadow-sm">
                この日の記録はありません
              </div>
            ) : (
              <div className="space-y-2">
                {selectedRecords.map((r, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-12 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                      <BookOpen size={18} className="text-green-500" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{r.title}</p>
                      <p className="text-xs text-gray-400">{r.class}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
