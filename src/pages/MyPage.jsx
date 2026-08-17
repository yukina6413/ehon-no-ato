import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronLeft, Camera, X, BookOpen, Plus } from 'lucide-react'
import OverlayPanel from '../components/OverlayPanel'
import LoginModal from '../components/LoginModal'
import { useAuth } from '../context/AuthContext'
import { getPracticeLogs, isMock, formatAgeGroups } from '../lib/dataAdapter'
import {
  loadSchedules, saveSchedules, getUpcomingEvents, getEventsOfMonth,
  getWeekKeys, toDateKey, keyToDate, daysLeftLabel, eventEmoji, CATEGORY_EMOJI,
} from '../lib/nurseryEvents'
import {
  loadCalendarView, saveCalendarView, loadProfile, saveProfile, profileSubtitle,
} from '../lib/userPrefs'

// このページの役割は2つだけ。
//   A. 自分・園の状態を見る（プロフィール／今月の記録）
//   B. これからの保育を準備する（もうすぐの行事／園のカレンダー）
// それ以外の情報は置かず、詳細は設定の奥に入れる。

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']
const SCHEDULE_CATEGORIES = ['行事', '避難訓練', '製作', '会議', '保護者対応', '自由入力']

function formatDateLabel(key) {
  const d = keyToDate(key)
  if (!d) return ''
  return `${d.getMonth() + 1}月${d.getDate()}日（${DAYS_JP[d.getDay()]}）`
}

// ──────────────────────────────────────────
// 共通UIパーツ
// ──────────────────────────────────────────

// 押せる行。「＞」を必ず出して、説明なしで押せると分かるようにする。
function LinkRow({ label, sub, onClick, first }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-4 text-left active:bg-[#F5F7F3] transition-colors
                  ${first ? '' : 'border-t border-[#F0F2EE]'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#2C2C2A]">{label}</p>
        {sub && <p className="text-[11px] text-[#8A8A85] mt-0.5 truncate">{sub}</p>}
      </div>
      <ChevronRight size={16} className="text-[#C0BDB5] flex-shrink-0" />
    </button>
  )
}

function SectionTitle({ children, right }) {
  return (
    <div className="flex items-end justify-between mb-2 px-1">
      <h2 className="text-[13px] font-bold text-[#2C2C2A]">{children}</h2>
      {right}
    </div>
  )
}

function Panel({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#E8EBE5] overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

// 週／月の切り替え。今どちらを見ているかが一目で分かるように緑を使う。
function ViewToggle({ view, onChange }) {
  return (
    <div className="flex bg-[#EFF1ED] rounded-full p-0.5">
      {[['week', '週'], ['month', '月']].map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)}
          className={`px-3.5 py-1 text-xs rounded-full transition-colors
            ${view === id ? 'bg-green-600 text-white font-medium' : 'text-[#6B6B66]'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────
// カレンダー（週）
// ──────────────────────────────────────────
function WeekStrip({ weekKeys, todayKey, selectedKey, onSelect, markedKeys }) {
  return (
    <div className="grid grid-cols-7">
      {weekKeys.map(key => {
        const d        = keyToDate(key)
        const isToday  = key === todayKey
        const isSel    = key === selectedKey
        const hasMark  = markedKeys.has(key)
        return (
          <button key={key} onClick={() => onSelect(key)}
            className="flex flex-col items-center gap-1 py-2">
            <span className="text-[10px] text-[#A8A8A2]">{DAYS_JP[d.getDay()]}</span>
            <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors
              ${isSel    ? 'bg-green-600 text-white font-bold'
                : isToday ? 'bg-green-50 text-green-700 font-bold'
                : 'text-[#2C2C2A]'}`}>
              {d.getDate()}
            </span>
            <span className={`w-1.5 h-1.5 rounded-full ${hasMark ? 'bg-green-500' : 'bg-transparent'}`} />
          </button>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────
// カレンダー（月）
// ──────────────────────────────────────────
function MonthGrid({ year, month, todayKey, selectedKey, onSelect, markedKeys }) {
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const pad = n => String(n).padStart(2, '0')

  return (
    <>
      <div className="grid grid-cols-7 text-center">
        {DAYS_JP.map(d => (
          <div key={d} className="text-[10px] text-[#A8A8A2] py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const key     = `${year}-${pad(month + 1)}-${pad(day)}`
          const isToday = key === todayKey
          const isSel   = key === selectedKey
          const hasMark = markedKeys.has(key)
          return (
            <button key={key} onClick={() => onSelect(key)}
              className="flex flex-col items-center py-1.5">
              <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors
                ${isSel    ? 'bg-green-600 text-white font-bold'
                  : isToday ? 'bg-green-50 text-green-700 font-bold'
                  : 'text-[#2C2C2A]'}`}>
                {day}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${hasMark ? 'bg-green-500' : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>
    </>
  )
}

// ──────────────────────────────────────────
// 予定を追加するシート（既存の仕組みをそのまま再利用）
// ──────────────────────────────────────────
function AddScheduleSheet({ targetDateKey, onClose, onSave }) {
  const [dateKey,  setDateKey]  = useState(targetDateKey)
  const [category, setCategory] = useState('行事')
  const [text,     setText]     = useState('')

  function handleSave() {
    if (!text.trim()) return
    onSave({ id: Date.now(), category, text: text.trim(), time: '' }, dateKey)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-4 pt-4 pb-8 flex flex-col gap-4 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-[#2C2C2A]">園の行事を追加</p>
          <button onClick={onClose}><X size={18} className="text-[#8A8A85]" /></button>
        </div>
        <div>
          <p className="text-[11px] text-[#8A8A85] mb-1.5">日付</p>
          <input type="date" value={dateKey} onChange={e => setDateKey(e.target.value)}
            className="w-full text-sm border border-[#DCE4D9] rounded-xl px-3 py-2.5 outline-none focus:border-green-500" />
        </div>
        <div>
          <p className="text-[11px] text-[#8A8A85] mb-2">種類</p>
          <div className="flex flex-wrap gap-1.5">
            {SCHEDULE_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                  ${category === cat ? 'bg-green-600 text-white border-green-600' : 'border-[#DCE4D9] text-[#5A5A57]'}`}>
                {CATEGORY_EMOJI[cat]} {cat}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] text-[#8A8A85] mb-1.5">行事名</p>
          <input autoFocus value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="例：誕生会、避難訓練"
            className="w-full text-sm border border-[#DCE4D9] rounded-xl px-3 py-2.5 outline-none focus:border-green-500" />
        </div>
        <button onClick={handleSave} disabled={!text.trim() || !dateKey}
          className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-colors
            ${text.trim() && dateKey ? 'bg-green-600 text-white' : 'bg-[#E8E6E0] text-[#B0B0A8]'}`}>
          追加する
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────
// 設定オーバーレイの中身
// ──────────────────────────────────────────
function FormCard({ children }) {
  return <div className="bg-white border border-[#E8EBE5] rounded-2xl px-4 py-4 flex flex-col gap-4">{children}</div>
}
function FieldLabel({ children }) {
  return <p className="text-xs font-medium text-[#5A5A57] mb-1.5">{children}</p>
}
function FInput({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder}
      className="w-full border border-[#DCE4D9] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-green-500" />
  )
}
function FSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <select value={value} onChange={onChange}
        className="w-full border border-[#DCE4D9] rounded-xl px-3 py-2.5 text-sm bg-white appearance-none focus:outline-none focus:border-green-500">
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-[#8A8A85]">▾</span>
    </div>
  )
}
function FChip({ label, on, onToggle }) {
  return (
    <button onClick={onToggle}
      className={`text-xs px-3 py-1.5 rounded-full border transition-all active:scale-95
        ${on ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-[#D4D2CC] text-[#444441]'}`}>
      {label}
    </button>
  )
}
function SaveFooter({ onSave, onCancel }) {
  return (
    <>
      <button onClick={onSave} className="w-full bg-green-600 text-white rounded-2xl py-3.5 font-bold text-sm">
        保存する
      </button>
      <button onClick={onCancel} className="w-full text-[#8A8A85] text-sm py-2">キャンセル</button>
    </>
  )
}

function ProfileForm({ data, setData }) {
  const toggleClass = v => setData(d => ({
    ...d, classes: d.classes.includes(v) ? d.classes.filter(x => x !== v) : [...d.classes, v],
  }))
  return (
    <FormCard>
      <div><FieldLabel>名前</FieldLabel>
        <FInput value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} placeholder="例：さくら" />
      </div>
      <div><FieldLabel>園名</FieldLabel>
        <FInput value={data.school} onChange={e => setData(d => ({ ...d, school: e.target.value }))} placeholder="例：さくら保育園" />
      </div>
      <div><FieldLabel>職種</FieldLabel>
        <FSelect value={data.role} onChange={e => setData(d => ({ ...d, role: e.target.value }))}
          options={['保育士', '幼稚園教諭', '保育教諭', '支援員', 'その他']} />
      </div>
      <div>
        <FieldLabel>担当クラス（複数可）</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {['0歳児', '1歳児', '2歳児', '3歳児', '4歳児', '5歳児'].map(c => (
            <FChip key={c} label={c} on={data.classes.includes(c)} onToggle={() => toggleClass(c)} />
          ))}
        </div>
      </div>
      <div><FieldLabel>役職</FieldLabel>
        <FSelect value={data.position} onChange={e => setData(d => ({ ...d, position: e.target.value }))}
          options={['一般', '主任', '副主任', '施設長']} />
      </div>
    </FormCard>
  )
}

function NotifyForm({ chips, setChips }) {
  const options = ['7日前', '3日前', '前日', '通知しない']
  const toggle = v => setChips(c => (
    v === '通知しない' ? ['通知しない']
      : c.filter(x => x !== '通知しない').includes(v)
        ? c.filter(x => x !== v && x !== '通知しない')
        : [...c.filter(x => x !== '通知しない'), v]
  ))
  return (
    <>
      <FormCard>
        <div>
          <FieldLabel>行事の何日前に知らせるか（複数可）</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {options.map(o => <FChip key={o} label={o} on={chips.includes(o)} onToggle={() => toggle(o)} />)}
          </div>
        </div>
      </FormCard>
      <div className="bg-[#F2F7F3] rounded-2xl px-4 py-3">
        <p className="text-xs text-[#3B5F45] leading-relaxed">
          通知は「絵本を準備する時間をつくる」ためのものです。7日前に知らせると、
          絵本を探して読み方を考える余裕がもてます。
        </p>
      </div>
      <p className="text-[11px] text-[#A8A8A2] px-1 leading-relaxed">
        ※ 端末への通知の送信は準備中です。設定した内容は保存されます。
      </p>
    </>
  )
}

// ──────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────
export default function MyPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const today    = useMemo(() => new Date(), [])
  const todayKey = toDateKey(today)

  // ── 園の予定（既存の schedules_v1 をそのまま使う） ──
  const [schedules, setSchedules] = useState(() => loadSchedules())
  useEffect(() => { saveSchedules(schedules) }, [schedules])

  // ── カレンダー表示（最後に使った状態を覚える） ──
  const [calView, setCalView] = useState(() => loadCalendarView())
  function changeCalView(v) {
    setCalView(v)
    saveCalendarView(v)
  }

  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedKey, setSelectedKey] = useState(null)

  const prevMonth = () => {
    setSelectedKey(null)
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    setSelectedKey(null)
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  // ── 記録（実データ） ──
  const [logs, setLogs] = useState([])
  const [logsError, setLogsError] = useState(null)

  useEffect(() => {
    getPracticeLogs()
      .then(setLogs)
      .catch(err => {
        console.error('記録の取得に失敗:', err)
        setLogsError('記録を読み込めませんでした')
      })
  }, [])

  // ── プロフィール・通知 ──
  const [profile,     setProfile]     = useState(() => loadProfile())
  const [notifyChips, setNotifyChips] = useState(['7日前'])

  const [overlay,   setOverlay]   = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [showAdd,   setShowAdd]   = useState(false)
  const [toast,     setToast]     = useState(null)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2000) }

  function closeOverlayAndSave() {
    if (overlay === 'profile') saveProfile(profile)
    setOverlay(null)
    showToast('保存しました')
  }

  function addSchedule(item, dateKey) {
    setSchedules(prev => ({ ...prev, [dateKey]: [...(prev[dateKey] || []), item] }))
    showToast('行事を追加しました')
  }

  // ── 表示用データ ──
  const upcoming = useMemo(() => getUpcomingEvents(schedules, today, 2), [schedules, today])

  const markedKeys = useMemo(() => {
    const keys = new Set()
    Object.entries(schedules ?? {}).forEach(([k, items]) => {
      if (Array.isArray(items) && items.length > 0) keys.add(k)
    })
    return keys
  }, [schedules])

  const weekKeys = useMemo(() => getWeekKeys(today), [today])

  // カレンダーの下に出す一覧：週なら今週ぶん、月ならその月ぶん
  const listedEvents = useMemo(() => {
    if (calView === 'month') return getEventsOfMonth(schedules, year, month)
    const set = new Set(weekKeys)
    return Object.entries(schedules ?? {})
      .filter(([k]) => set.has(k))
      .flatMap(([dateKey, items]) => (Array.isArray(items) ? items : [])
        .map(item => ({ dateKey, item, emoji: eventEmoji(item) })))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  }, [calView, schedules, year, month, weekKeys])

  // 日付を選んだときだけ、その日の行事と読んだ絵本を出す（最初から全部出さない）
  const selectedEvents = selectedKey ? (schedules[selectedKey] || []) : []
  const selectedLogs   = selectedKey ? logs.filter(l => l.read_date === selectedKey) : []

  const monthStats = useMemo(() => {
    const pad = n => String(n).padStart(2, '0')
    const prefix = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`
    const inMonth = logs.filter(l => String(l.read_date || '').startsWith(prefix))
    return { count: inMonth.length, days: new Set(inMonth.map(l => l.read_date)).size }
  }, [logs, today])

  // 行事 → 絵本検索へ。ホームの「子どもの姿・保育士の思いから探す」に行事名を渡す。
  function prepareBooksFor(eventName) {
    navigate('/', { state: { prepareQuery: eventName } })
  }

  return (
    <div className="min-h-screen bg-[#F5F7F3] pb-24">
      <header className="bg-white px-4 pt-12 pb-3 border-b border-[#EDEFEA]">
        <h1 className="text-[17px] font-bold text-[#2C2C2A]">マイページ</h1>
      </header>

      <div className="px-4 py-4 flex flex-col gap-6">

        {/* ① プロフィール */}
        <Panel>
          <button onClick={() => setOverlay('profile')}
            className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-[#F5F7F3] transition-colors">
            <div className="w-11 h-11 rounded-full bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
              <span className="text-green-700 text-base font-bold">
                {(profile.name || '先').slice(0, 1)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-[#2C2C2A] truncate">
                {profile.name ? `${profile.name}先生` : '名前を設定する'}
              </p>
              <p className="text-xs text-[#8A8A85] mt-0.5 truncate">
                {profileSubtitle(profile) || '園名・担当クラスを設定する'}
              </p>
            </div>
            <ChevronRight size={18} className="text-[#C0BDB5] flex-shrink-0" />
          </button>
        </Panel>

        {/* ② もうすぐの行事 */}
        <section>
          <SectionTitle>もうすぐの行事</SectionTitle>
          {upcoming.length === 0 ? (
            <Panel className="px-4 py-5">
              <p className="text-sm text-[#8A8A85] leading-relaxed">
                予定されている行事はまだありません。
              </p>
              <button onClick={() => setShowAdd(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-green-700 font-medium">
                <Plus size={15} /> 行事を追加する
              </button>
            </Panel>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((e, i) => (
                <Panel key={`${e.dateKey}-${e.item.id ?? i}`} className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none mt-0.5">{e.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-[#2C2C2A] truncate">{e.item.text}</p>
                      <p className="text-xs text-[#8A8A85] mt-1">
                        {formatDateLabel(e.dateKey)}
                        <span className={`ml-2 font-medium ${e.daysLeft <= 7 ? 'text-green-700' : 'text-[#8A8A85]'}`}>
                          {daysLeftLabel(e.daysLeft)}
                        </span>
                      </p>
                    </div>
                  </div>
                  {/* 最も近い行事にだけ主アクションを置き、入口を増やしすぎない */}
                  {i === 0 && (
                    <button onClick={() => prepareBooksFor(e.item.text)}
                      className="mt-3 w-full bg-green-600 active:bg-green-700 text-white rounded-xl py-3
                                 text-sm font-bold flex items-center justify-center gap-1 transition-colors">
                      絵本を準備する <ChevronRight size={16} />
                    </button>
                  )}
                </Panel>
              ))}
            </div>
          )}
        </section>

        {/* ③ 園のカレンダー */}
        <section>
          <SectionTitle right={<ViewToggle view={calView} onChange={changeCalView} />}>
            園のカレンダー
          </SectionTitle>

          <Panel className="px-2 pt-2 pb-3">
            {calView === 'month' && (
              <div className="flex items-center justify-between px-2 pb-1">
                <button onClick={prevMonth} className="p-1.5 rounded-full active:bg-[#F0F2EE]">
                  <ChevronLeft size={18} className="text-[#6B6B66]" />
                </button>
                <p className="text-sm font-bold text-[#2C2C2A]">{year}年{month + 1}月</p>
                <button onClick={nextMonth} className="p-1.5 rounded-full active:bg-[#F0F2EE]">
                  <ChevronRight size={18} className="text-[#6B6B66]" />
                </button>
              </div>
            )}

            {calView === 'week' ? (
              <WeekStrip weekKeys={weekKeys} todayKey={todayKey} selectedKey={selectedKey}
                onSelect={k => setSelectedKey(prev => (prev === k ? null : k))} markedKeys={markedKeys} />
            ) : (
              <MonthGrid year={year} month={month} todayKey={todayKey} selectedKey={selectedKey}
                onSelect={k => setSelectedKey(prev => (prev === k ? null : k))} markedKeys={markedKeys} />
            )}

            {/* 日付を選んだときだけ、その日の中身を出す */}
            {selectedKey && (
              <div className="mx-2 mt-2 pt-3 border-t border-[#F0F2EE]">
                <p className="text-xs font-bold text-[#2C2C2A] mb-2">{formatDateLabel(selectedKey)}</p>
                {selectedEvents.length === 0 && selectedLogs.length === 0 ? (
                  <p className="text-xs text-[#A8A8A2] mb-1">行事も記録もありません</p>
                ) : (
                  <div className="flex flex-col gap-1.5 mb-1">
                    {selectedEvents.map((it, i) => (
                      <div key={it.id ?? i} className="flex items-center gap-2">
                        <span className="text-sm">{eventEmoji(it)}</span>
                        <span className="text-xs text-[#2C2C2A] flex-1 min-w-0 truncate">{it.text}</span>
                        <button onClick={() => prepareBooksFor(it.text)}
                          className="text-[11px] text-green-700 font-medium flex-shrink-0">
                          絵本を準備 ›
                        </button>
                      </div>
                    ))}
                    {selectedLogs.map(l => (
                      <div key={l.id} className="flex items-center gap-2">
                        <BookOpen size={13} className="text-green-600 flex-shrink-0" />
                        <span className="text-xs text-[#2C2C2A] flex-1 min-w-0 truncate">{l.book_title}</span>
                        {l.age_groups?.length > 0 && (
                          <span className="text-[10px] text-[#A8A8A2] flex-shrink-0">
                            {formatAgeGroups(l.age_groups)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setShowAdd(true)}
                  className="text-[11px] text-[#8A8A85] mt-1">＋ この週に行事を追加</button>
              </div>
            )}
          </Panel>

          {/* 近い順の行事一覧（最初から全部は並べない） */}
          {listedEvents.length > 0 && (
            <div className="mt-2 px-1 flex flex-col gap-1.5">
              {listedEvents.slice(0, 5).map((e, i) => (
                <button key={`${e.dateKey}-${e.item.id ?? i}`} onClick={() => setSelectedKey(e.dateKey)}
                  className="flex items-center gap-2 text-left">
                  <span className="text-xs text-[#8A8A85] w-12 flex-shrink-0">
                    {keyToDate(e.dateKey).getMonth() + 1}/{keyToDate(e.dateKey).getDate()}
                  </span>
                  <span className="text-sm">{e.emoji}</span>
                  <span className="text-xs text-[#2C2C2A] flex-1 min-w-0 truncate">{e.item.text}</span>
                </button>
              ))}
              {listedEvents.length > 5 && (
                <p className="text-[11px] text-[#A8A8A2] pl-1">ほか{listedEvents.length - 5}件</p>
              )}
            </div>
          )}

          <Panel className="mt-2">
            <LinkRow first label="カレンダーを見る" sub="記録した絵本を日付で振り返る"
              onClick={() => navigate('/calendar')} />
          </Panel>

          <button onClick={() => setOverlay('import')}
            className="mt-2 w-full bg-white border border-[#DCE4D9] rounded-2xl py-3.5
                       flex items-center justify-center gap-2 text-sm text-[#2C2C2A]
                       active:bg-[#F5F7F3] transition-colors">
            <Camera size={17} className="text-green-700" />
            園の予定表を登録
          </button>
        </section>

        {/* ④ 今月の記録 */}
        <section>
          <SectionTitle>今月の記録</SectionTitle>
          <Panel className="px-4 py-5">
            {logsError ? (
              <p className="text-sm text-red-500">{logsError}</p>
            ) : (
              <>
                <p className="text-[32px] leading-none font-bold text-[#2C2C2A]">
                  {monthStats.count}<span className="text-base font-medium ml-1">件</span>
                </p>
                <p className="text-xs text-[#8A8A85] mt-2">{'読んだ日　'}{monthStats.days}日</p>
              </>
            )}
          </Panel>
        </section>

        {/* ⑤ 設定 */}
        <section>
          <Panel>
            <LinkRow first label="プロフィール設定" onClick={() => setOverlay('profile')} />
            <LinkRow label="通知設定" onClick={() => setOverlay('notify')} />
            <LinkRow label="アカウント設定" onClick={() => setOverlay('account')} />
            <LinkRow label="ヘルプ" onClick={() => setOverlay('help')} />
          </Panel>
        </section>
      </div>

      {/* ── オーバーレイ ── */}
      <OverlayPanel title="プロフィール設定" isOpen={overlay === 'profile'} onClose={() => setOverlay(null)}
        footer={<SaveFooter onSave={closeOverlayAndSave} onCancel={() => setOverlay(null)} />}>
        <ProfileForm data={profile} setData={setProfile} />
      </OverlayPanel>

      <OverlayPanel title="通知設定" isOpen={overlay === 'notify'} onClose={() => setOverlay(null)}
        footer={<SaveFooter onSave={closeOverlayAndSave} onCancel={() => setOverlay(null)} />}>
        <NotifyForm chips={notifyChips} setChips={setNotifyChips} />
      </OverlayPanel>

      <OverlayPanel title="アカウント設定" isOpen={overlay === 'account'} onClose={() => setOverlay(null)}>
        <div className="bg-white border border-[#E8EBE5] rounded-2xl px-4 py-4">
          {isMock ? (
            <p className="text-sm text-[#8A8A85]">お試しモードで動いています。</p>
          ) : user ? (
            <>
              <p className="text-xs text-[#8A8A85] mb-1">ログイン中</p>
              <p className="text-sm text-[#2C2C2A] mb-4 break-all">{user.email || '記録はこの端末に紐づいています'}</p>
              <button onClick={signOut}
                className="w-full border border-[#DCE4D9] text-[#5A5A57] rounded-xl py-2.5 text-sm active:bg-[#F5F7F3]">
                ログアウト
              </button>
            </>
          ) : (
            <button onClick={() => { setOverlay(null); setShowLogin(true) }}
              className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-bold">
              ログイン
            </button>
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel title="ヘルプ" isOpen={overlay === 'help'} onClose={() => setOverlay(null)}>
        <div className="bg-white border border-[#E8EBE5] rounded-2xl px-4 py-4 flex flex-col gap-4">
          {[
            ['絵本を記録する', '画面の下にある緑の「記録」ボタンから、読んだ絵本を記録できます。'],
            ['行事にあわせて絵本を準備する', 'マイページに行事を登録すると、近づいたときに「絵本を準備する」から関連する絵本を探せます。'],
            ['記録を振り返る', '「本棚」で読んだ絵本、「カレンダー」で読んだ日を振り返れます。'],
          ].map(([t, d]) => (
            <div key={t}>
              <p className="text-sm font-bold text-[#2C2C2A] mb-1">{t}</p>
              <p className="text-xs text-[#6B6B66] leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </OverlayPanel>

      {/* 予定表の写真読み取り（入口のみ・読み取りは未実装） */}
      <OverlayPanel title="園の予定表を登録" isOpen={overlay === 'import'} onClose={() => setOverlay(null)}>
        <div className="bg-white border border-[#E8EBE5] rounded-2xl px-4 py-5">
          <div className="border border-dashed border-[#C8D4C4] rounded-xl py-8 flex flex-col items-center gap-2">
            <Camera size={26} className="text-[#B4C4B0]" />
            <p className="text-sm text-[#8A8A85]">写真からの読み取りは準備中です</p>
          </div>
          <p className="text-xs text-[#6B6B66] leading-relaxed mt-4">
            月間予定表を撮影して、日付と行事名を読み取れるようにする予定です。
            読み取った内容は自動では登録せず、かならず確認・修正してから登録できるようにします。
          </p>
        </div>
        <button onClick={() => { setOverlay(null); setShowAdd(true) }}
          className="w-full bg-green-600 text-white rounded-2xl py-3.5 text-sm font-bold">
          いまは手入力で追加する
        </button>
      </OverlayPanel>

      {showAdd && (
        <AddScheduleSheet targetDateKey={selectedKey || todayKey}
          onClose={() => setShowAdd(false)} onSave={addSchedule} />
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1B4D2B] text-white text-sm
                        font-medium px-5 py-2.5 rounded-full shadow-lg z-50 whitespace-nowrap pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
