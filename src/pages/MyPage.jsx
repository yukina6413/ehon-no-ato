import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Settings, ChevronLeft, ChevronRight, Plus, X, Check } from 'lucide-react'
import OverlayPanel from '../components/OverlayPanel'

// ──────────────────────────────────────────
// モックデータ
// ──────────────────────────────────────────
const _today = new Date()
const _pad = n => String(n).padStart(2, '0')
const TODAY_STR = `${_today.getFullYear()}-${_pad(_today.getMonth()+1)}-${_pad(_today.getDate())}`

const SHIFT_CLS = {
  '早': 'bg-[#FEF0E0] text-[#B85C00]',
  '普': 'bg-[#E4F0FC] text-[#1560A8]',
  '遅': 'bg-[#EDE8F8] text-[#5B3DAA]',
}

const CAL_DATA = {
  '2026-05-01': { books:[{emoji:'📗',bg:'#C3E6C8',title:'ぐりとぐら',reactions:['😊笑い','🎯集中']}], events:[{icon:'🌸',name:'入園式'}] },
  '2026-05-07': { books:[{emoji:'📗',bg:'#C3E6C8',title:'はらぺこあおむし',reactions:['💬言葉','🎯集中']}], shifts:['早'] },
  '2026-05-08': { books:[{emoji:'📘',bg:'#C3DCF0',title:'スイミー',reactions:['🌙余韻','🎯集中']}] },
  '2026-05-11': { books:[{emoji:'📙',bg:'#F9DDC0',title:'ぐるんぱのようちえん',reactions:['💬言葉']}], events:[{icon:'🎂',name:'誕生会'}] },
  '2026-05-15': { books:[{emoji:'📗',bg:'#C3E6C8',title:'ももんちゃん',reactions:['😊笑い','🎭真似']}] },
  '2026-05-19': { events:[{icon:'🎏',name:'こいのぼり制作開始'}] },
  '2026-05-22': { books:[{emoji:'📗',bg:'#C3E6C8',title:'ぐりとぐら',reactions:['😊笑い','✏️制作']}], shifts:['普'] },
  '2026-05-23': { books:[{emoji:'📙',bg:'#F9DDC0',title:'からすのパンやさん',reactions:['💬言葉']},{emoji:'📒',bg:'#F5EAB0',title:'おおきなかぶ',reactions:['💬言葉']}] },
  '2026-05-26': { books:[{emoji:'📗',bg:'#C3E6C8',title:'はらぺこあおむし',reactions:['💬言葉','🎯集中']}] },
  '2026-05-28': { events:[{icon:'👨‍👩‍👧',name:'保護者懇談会'}] },
  '2026-05-29': { books:[{emoji:'📘',bg:'#C3DCF0',title:'スイミー',reactions:['🌙余韻','🎯集中']}], shifts:['普'] },
}

const REVIEW_STATS = [
  { label: '今月の記録数',    value: '18', unit: '件', sub: '先月比 +4件',   color: '#2E7D46' },
  { label: 'AIレポート閲覧', value: '9',  unit: '回', sub: '今月',          color: '#C16B18' },
  { label: '記録した日数',   value: '16', unit: '日', sub: '稼働日のうち',  color: '#6B4BB5' },
]

const TOP_THEMES = ['虫・自然', '友だち', '食べ物']

const DAYS_JP = ['日','月','火','水','木','金','土']

// ──────────────────────────────────────────
// ユーティリティ
// ──────────────────────────────────────────
function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function formatDateLabel(key) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${date.getMonth()+1}月${date.getDate()}日（${DAYS_JP[date.getDay()]}）`
}

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

function loadSchedules() {
  const stored = localStorage.getItem('schedules_v1')
  if (stored) return JSON.parse(stored)
  const todayKey = toDateKey(new Date())
  return {
    [todayKey]: [
      { id: 1, category: '製作',      text: 'こいのぼり制作',         time: '09:30' },
      { id: 2, category: '保護者対応', text: '保護者対応（田中さん）', time: '14:00' },
    ],
  }
}

function saveSchedules(data) {
  localStorage.setItem('schedules_v1', JSON.stringify(data))
}

const SCHEDULE_CATEGORIES = ['行事', '保護者対応', '製作', '会議', '避難訓練', '自由入力']

const CATEGORY_EMOJI = {
  '行事':      '🎏',
  '保護者対応': '👪',
  '製作':      '✂️',
  '会議':      '📋',
  '避難訓練':  '🚨',
  '自由入力':  '📝',
}

// ──────────────────────────────────────────
// 週カレンダーコンポーネント
// ──────────────────────────────────────────
function WeekCalendar({ selectedKey, onSelect, schedules, onAddClick }) {
  const today    = new Date()
  const todayKey = toDateKey(today)
  const sunday   = new Date(today)
  sunday.setDate(today.getDate() - today.getDay())

  const days = Array.from({ length: 7 }, (_, i) => {
    const d   = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    const key = toDateKey(d)
    return { d, key, label: DAYS_JP[d.getDay()], num: d.getDate(), hasEvent: (schedules[key] || []).length > 0 }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-[#8A8A85] tracking-wide">今週</p>
        <button onClick={onAddClick}
          className="text-xs bg-green-600 text-white rounded-full px-2.5 py-1 flex items-center gap-0.5">
          <Plus size={11} /> 予定追加
        </button>
      </div>
      <div className="flex gap-1">
        {days.map(({ d, key, label, num, hasEvent }) => {
          const isToday    = key === todayKey
          const isSelected = key === selectedKey
          const isSun      = d.getDay() === 0
          const isSat      = d.getDay() === 6
          return (
            <button key={key} onClick={() => onSelect(key)}
              className="flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1">
              <span className={`text-[10px] font-medium ${isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-[#8A8A85]'}`}>
                {label}
              </span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all
                ${isToday    ? 'bg-green-600 text-white'
                : isSelected ? 'bg-green-100 text-green-700 ring-2 ring-green-400'
                :               'text-[#2C2C2A]'}`}>
                {num}
              </div>
              <div className="h-2 flex items-center justify-center">
                {hasEvent && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SelectedDayPanel({ dateKey, schedules, onAdd }) {
  const daySchedules = schedules[dateKey] || []
  const isToday      = dateKey === toDateKey(new Date())

  return (
    <div className="mt-3 pt-3 border-t border-[#F0EDE6]">
      <div className="flex items-center justify-between mb-2">
        <p className={`text-xs font-medium ${isToday ? 'text-green-700' : 'text-[#5A5A57]'}`}>
          {isToday ? '今日の予定' : formatDateLabel(dateKey)}
        </p>
        <button onClick={onAdd} className="text-xs text-green-600 flex items-center gap-0.5">
          <Plus size={11} /> 予定追加
        </button>
      </div>
      {daySchedules.length === 0 ? (
        <button onClick={onAdd}
          className="w-full text-xs text-[#B0B0A8] border border-dashed border-[#DCE4D9] rounded-xl py-2.5 flex items-center justify-center gap-1">
          <Plus size={11} /> 予定を追加する
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {daySchedules.map(item => (
            <div key={item.id} className="flex items-center gap-2">
              {item.time
                ? <span className="text-[10px] text-[#8A8A85] w-10 flex-shrink-0">{item.time}</span>
                : <span className="w-10 flex-shrink-0" />}
              <span className="text-sm">{CATEGORY_EMOJI[item.category] || '📝'}</span>
              <p className="text-xs text-[#2C2C2A] flex-1">{item.text}</p>
              <span className="text-[10px] bg-[#EAF5EC] text-green-700 rounded-full px-2 py-0.5 flex-shrink-0">
                {item.category}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AddScheduleSheet({ targetDateKey, onClose, onSave }) {
  const [category, setCategory] = useState('')
  const [text,     setText]     = useState('')
  const [time,     setTime]     = useState('')

  function handleSave() {
    if (!text.trim()) return
    onSave({ id: Date.now(), category: category || '自由入力', text: text.trim(), time })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-4 pt-4 pb-8 flex flex-col gap-4 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-[#2C2C2A]">予定を追加</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8A8A85]">{formatDateLabel(targetDateKey)}</span>
            <button onClick={onClose}><X size={18} className="text-[#8A8A85]" /></button>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#8A8A85] mb-2">カテゴリ</p>
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
          <p className="text-[10px] font-bold text-[#8A8A85] mb-1.5">時刻（任意）</p>
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="text-sm border border-[#DCE4D9] rounded-xl px-3 py-2 outline-none focus:border-green-400" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#8A8A85] mb-1.5">内容</p>
          <input autoFocus value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="例：避難訓練、製作（工作）..."
            className="w-full text-sm border border-[#DCE4D9] rounded-xl px-3 py-2.5 outline-none focus:border-green-400" />
        </div>
        <button onClick={handleSave} disabled={!text.trim()}
          className={`w-full py-3 rounded-2xl text-sm font-bold transition-colors
            ${text.trim() ? 'bg-green-600 text-white' : 'bg-[#E8E6E0] text-[#B0B0A8]'}`}>
          保存する
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────
// 共通UIパーツ
// ──────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)}
      className={`w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ${on ? 'bg-green-500' : 'bg-[#D4D2CC]'}`}>
      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
    </button>
  )
}

function FormCard({ children }) {
  return <div className="bg-white border border-[#DCE4D9] rounded-2xl px-4 py-4 flex flex-col gap-4">{children}</div>
}
function FieldLabel({ children }) {
  return <p className="text-xs font-medium text-[#5A5A57] mb-1.5">{children}</p>
}
function FInput({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder}
      className="w-full border border-[#DCE4D9] rounded-xl px-3 py-2.5 text-sm bg-[#FAFAF8] focus:outline-none focus:border-green-400" />
  )
}
function FSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <select value={value} onChange={onChange}
        className="w-full border border-[#DCE4D9] rounded-xl px-3 py-2.5 text-sm bg-[#FAFAF8] appearance-none focus:outline-none focus:border-green-400">
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
        ${on ? 'bg-green-700 border-green-700 text-white' : 'bg-[#FAFAF8] border-[#D4D2CC] text-[#444441]'}`}>
      {label}
    </button>
  )
}
function SaveFooter({ onSave, onCancel, saveLabel = '保存する' }) {
  return (
    <>
      <button onClick={onSave}
        className="w-full text-white rounded-2xl py-4 font-bold text-sm"
        style={{ background: 'linear-gradient(135deg,#1E6B38,#2E7D46)' }}>
        {saveLabel}
      </button>
      <button onClick={onCancel} className="w-full text-[#8A8A85] text-sm py-2">キャンセル</button>
    </>
  )
}

// ──────────────────────────────────────────
// 設定オーバーレイコンテンツ
// ──────────────────────────────────────────
function ProfileForm({ data, setData }) {
  const toggleClass = v => setData(d => ({
    ...d, classes: d.classes.includes(v) ? d.classes.filter(x => x !== v) : [...d.classes, v]
  }))
  return (
    <FormCard>
      <div><FieldLabel>名前</FieldLabel>
        <FInput value={data.name} onChange={e => setData(d=>({...d,name:e.target.value}))} placeholder="名前" />
      </div>
      <div><FieldLabel>園名</FieldLabel>
        <FInput value={data.school} onChange={e => setData(d=>({...d,school:e.target.value}))} placeholder="例：さくら保育園" />
      </div>
      <div><FieldLabel>職種</FieldLabel>
        <FSelect value={data.role} onChange={e => setData(d=>({...d,role:e.target.value}))}
          options={['保育士','幼稚園教諭','保育教諭','支援員','その他']} />
      </div>
      <div>
        <FieldLabel>担当クラス（複数可）</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {['0歳児','1歳児','2歳児','3歳児','4歳児','5歳児','混合'].map(c => (
            <FChip key={c} label={c} on={data.classes.includes(c)} onToggle={() => toggleClass(c)} />
          ))}
        </div>
      </div>
      <div><FieldLabel>役職</FieldLabel>
        <FSelect value={data.position} onChange={e => setData(d=>({...d,position:e.target.value}))}
          options={['一般','主任','副主任','施設長']} />
      </div>
    </FormCard>
  )
}

function NotifyDetailForm({ chips, setChips }) {
  const options = ['前月の指定日','1ヶ月前','2週間前','1週間前','3日前','当日']
  const toggle  = v => setChips(c => c.includes(v) ? c.filter(x=>x!==v) : [...c,v])
  return (
    <>
      <FormCard>
        <div>
          <FieldLabel>行事前に通知するタイミング（複数可）</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {options.map(o => <FChip key={o} label={o} on={chips.includes(o)} onToggle={() => toggle(o)} />)}
          </div>
        </div>
      </FormCard>
      <div className="bg-[#EAF5EC] border border-[#B8D8BC] rounded-2xl px-4 py-3">
        <p className="text-xs text-[#1B4D2B] leading-relaxed">💡 「1ヶ月前」「2週間前」の組み合わせが、絵本の選書と読み始めのタイミングに合いやすいです。</p>
      </div>
    </>
  )
}

// ──────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────
export default function MyPage() {

  // ── 予定・タスク ──
  const [schedules,       setSchedules]       = useState(() => loadSchedules())
  const [weekSelectedKey, setWeekSelectedKey] = useState(TODAY_STR)
  const [showWeekDetail,  setShowWeekDetail]  = useState(false)
  const [showAddSheet,    setShowAddSheet]    = useState(false)
  const [addTarget,       setAddTarget]       = useState(TODAY_STR)
  const [tasks,           setTasks]           = useState(() => loadTasks())
  const [newTask,         setNewTask]         = useState('')
  const [addingTask,      setAddingTask]      = useState(false)
  const [memoText,        setMemoText]        = useState('')

  useEffect(() => { saveSchedules(schedules) }, [schedules])
  useEffect(() => { saveTasks(tasks) }, [tasks])

  function handleWeekDateSelect(key) {
    if (key === weekSelectedKey) {
      setShowWeekDetail(v => !v)
    } else {
      setWeekSelectedKey(key)
      setShowWeekDetail(true)
    }
  }

  function addScheduleToDate(item, dateKey) {
    setSchedules(prev => ({ ...prev, [dateKey]: [...(prev[dateKey] || []), item] }))
  }

  function openAddSheet(dateKey) {
    setAddTarget(dateKey)
    setShowAddSheet(true)
  }

  function toggleTaskDone(id) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  function addTask() {
    if (!newTask.trim()) return
    setTasks(prev => [...prev, { id: Date.now(), text: newTask.trim(), done: false }])
    setNewTask('')
    setAddingTask(false)
  }

  // ── カレンダー（週/月切り替え） ──
  const [showMonthCal, setShowMonthCal] = useState(false)
  const [year,         setYear]         = useState(_today.getFullYear())
  const [month,        setMonth]        = useState(_today.getMonth())
  const [selectedKey,  setSelectedKey]  = useState(TODAY_STR)

  const prevMonth = () => {
    if (month === 0) { setYear(y => y-1); setMonth(11) } else setMonth(m => m-1)
    setSelectedKey(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y+1); setMonth(0) } else setMonth(m => m+1)
    setSelectedKey(null)
  }

  const pad = n => String(n).padStart(2,'0')
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month+1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)]

  const selData = selectedKey ? CAL_DATA[selectedKey] || {} : {}

  // ── 通知設定（インライン） ──
  const [notifyToggles, setNotifyToggles] = useState({
    event3days:    true,
    bookDay:       false,
    recordForgot:  true,
  })

  // ── オーバーレイ ──
  const [overlayStack,  setOverlayStack]  = useState([])
  const pushOverlay    = id => setOverlayStack(s => [...s, id])
  const popOverlay     = ()  => setOverlayStack(s => s.slice(0, -1))
  const currentOverlay = overlayStack[overlayStack.length - 1] || null

  const [profile,     setProfile]     = useState({ name:'さくら', school:'さくら保育園', role:'保育士', classes:['3歳児'], position:'主任' })
  const [notifyChips, setNotifyChips] = useState(['1ヶ月前','2週間前'])

  const [toast, setToast] = useState(null)
  const showToast  = msg => { setToast(msg); setTimeout(() => setToast(null), 2000) }
  const saveAndClose = () => { popOverlay(); showToast('✓ 保存しました') }

  const todaySchedules = schedules[TODAY_STR] || []

  return (
    <div className="min-h-screen bg-[#F2F5F0] pb-20 relative">

      {/* ── プロフィールヘッダー ── */}
      <div className="px-4 pt-10 pb-5"
        style={{ background:'linear-gradient(160deg,#1E6B38 0%,#2E7D46 60%,#3A9156 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl border-2 border-white/30 flex-shrink-0">
            🌿
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-base font-bold">{profile.name} 先生</p>
            <p className="text-white/70 text-[11px] mt-0.5">{profile.school}</p>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {profile.classes.slice(0,2).map(c => (
                <span key={c} className="text-[10px] text-white/75 bg-white/15 px-2 py-0.5 rounded-full">{c}担任</span>
              ))}
            </div>
          </div>
          <button onClick={() => pushOverlay('profile')}
            className="flex items-center gap-1.5 text-white/90 text-xs bg-white/15 border border-white/25 px-3 py-1.5 rounded-full flex-shrink-0">
            <Settings size={12} />設定
          </button>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-5">

        {/* ── 今日の確認 ── */}
        <section>
          <p className="text-[10px] font-bold text-[#8A8A85] tracking-wide mb-3">今日の確認</p>
          <div className="bg-white border border-[#DCE4D9] rounded-2xl overflow-hidden">

            {/* 今日の予定 */}
            <div className="px-4 pt-4 pb-3 border-b border-[#F0EDE6]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-[#2C2C2A]">今日の予定</p>
                <button onClick={() => openAddSheet(TODAY_STR)}
                  className="text-xs text-green-600 flex items-center gap-0.5">
                  <Plus size={11} /> 追加
                </button>
              </div>
              {todaySchedules.length === 0 ? (
                <p className="text-xs text-[#B0B0A8] py-1">予定はありません</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {todaySchedules.slice(0, 3).map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className="text-[10px] text-[#8A8A85] w-10 flex-shrink-0">{item.time || ''}</span>
                      <span className="text-sm">{CATEGORY_EMOJI[item.category] || '📝'}</span>
                      <p className="text-xs text-[#2C2C2A] flex-1 truncate">{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 今日のやること */}
            <div className="px-4 py-3 border-b border-[#F0EDE6]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-[#2C2C2A]">今日のやること</p>
                <button onClick={() => setAddingTask(true)}
                  className="text-xs text-green-600 flex items-center gap-0.5">
                  <Plus size={11} /> 追加
                </button>
              </div>
              {tasks.length === 0 && !addingTask ? (
                <p className="text-xs text-[#B0B0A8] py-1">やることはありません</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {tasks.slice(0, 3).map(task => (
                    <div key={task.id} className="flex items-center gap-2">
                      <button onClick={() => toggleTaskDone(task.id)}
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
              {addingTask && (
                <div className="mt-2 flex gap-2">
                  <input autoFocus value={newTask} onChange={e => setNewTask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                    placeholder="やることを入力..."
                    className="flex-1 text-xs border border-[#DCE4D9] rounded-xl px-3 py-1.5 outline-none focus:border-green-400" />
                  <button onClick={addTask}
                    className="text-xs bg-green-600 text-white rounded-xl px-3 py-1.5">追加</button>
                  <button onClick={() => { setAddingTask(false); setNewTask('') }}
                    className="text-[#8A8A85] px-1"><X size={14} /></button>
                </div>
              )}
            </div>

            {/* 記録したいこと */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-[#2C2C2A]">記録したいこと</p>
                <Link to="/bookshelf"
                  className="text-xs text-green-600 flex items-center gap-0.5">
                  本棚を見る <ChevronRight size={11} />
                </Link>
              </div>
              <textarea
                value={memoText}
                onChange={e => setMemoText(e.target.value)}
                placeholder="今日読んだ絵本や子どもの様子など…"
                rows={2}
                className="w-full text-xs border border-[#DCE4D9] rounded-xl px-3 py-2 outline-none focus:border-green-400 resize-none bg-[#FAFAF8]"
              />
            </div>
          </div>
        </section>

        {/* ── スケジュール（週/月切り替え） ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-[#8A8A85] tracking-wide">スケジュール</p>
            <button onClick={() => setShowMonthCal(v => !v)}
              className="text-xs text-green-600 flex items-center gap-0.5">
              {showMonthCal ? '週表示に戻る' : '月カレンダーを見る'}
              <ChevronRight size={12} />
            </button>
          </div>

          {!showMonthCal ? (
            // 週カレンダー
            <div className="bg-white border border-[#DCE4D9] rounded-2xl p-4">
              <WeekCalendar
                selectedKey={weekSelectedKey}
                onSelect={handleWeekDateSelect}
                schedules={schedules}
                onAddClick={() => openAddSheet(weekSelectedKey)}
              />
              {showWeekDetail && (
                <SelectedDayPanel
                  dateKey={weekSelectedKey}
                  schedules={schedules}
                  onAdd={() => openAddSheet(weekSelectedKey)}
                />
              )}
            </div>
          ) : (
            // 月カレンダー
            <div className="bg-white border border-[#DCE4D9] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EDE6]">
                <button onClick={prevMonth} className="w-8 h-8 rounded-lg border border-[#DCE4D9] flex items-center justify-center text-[#5A5A57]">
                  <ChevronLeft size={14} />
                </button>
                <p className="text-sm font-bold text-[#2C2C2A]">{year}年{month+1}月</p>
                <button onClick={nextMonth} className="w-8 h-8 rounded-lg border border-[#DCE4D9] flex items-center justify-center text-[#5A5A57]">
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="flex gap-3 px-4 py-2 flex-wrap">
                {[['📗','絵本'],['普','シフト'],['🎏','行事']].map(([icon,label]) => (
                  <div key={label} className="flex items-center gap-1 text-[10px] text-[#8A8A85]">
                    <span className="text-[11px]">{icon}</span>{label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 text-center pb-1">
                {DAYS_JP.map((d, i) => (
                  <p key={d} className={`text-[10px] font-medium py-1 ${i===0?'text-red-400':i===6?'text-blue-400':'text-[#B4B2A9]'}`}>{d}</p>
                ))}
              </div>

              <div className="grid grid-cols-7 pb-3">
                {cells.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} />
                  const key      = `${year}-${pad(month+1)}-${pad(day)}`
                  const data     = CAL_DATA[key] || {}
                  const isToday    = key === TODAY_STR
                  const isSelected = key === selectedKey
                  const colIdx   = i % 7
                  const isSun    = colIdx === 0
                  const isSat    = colIdx === 6
                  const hasBooks = (data.books?.length || 0) > 0
                  const shift    = data.shifts?.[0]
                  const event    = data.events?.[0]

                  return (
                    <button key={key} onClick={() => setSelectedKey(isSelected ? null : key)}
                      className={`flex flex-col items-center py-1 mx-0.5 rounded-xl transition-colors
                        ${isSelected ? 'bg-[#EAF5EC]' : 'hover:bg-[#F8F6F2]'}`}>
                      <span className={`w-7 h-7 flex items-center justify-center rounded-full text-[11px] font-medium mb-0.5
                        ${isToday ? 'bg-green-600 text-white' :
                          isSelected ? 'text-green-700 font-bold' :
                          isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-[#2C2C2A]'}`}>
                        {day}
                      </span>
                      <div className="flex flex-col items-center gap-0.5 min-h-[20px] justify-start">
                        {hasBooks && (
                          <div className="w-5 h-5 rounded text-[11px] flex items-center justify-center"
                            style={{ background: data.books[0].bg }}>
                            {data.books[0].emoji}
                          </div>
                        )}
                        {shift && <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${SHIFT_CLS[shift]}`}>{shift}</span>}
                        {event && <span className="text-[11px] leading-none">{event.icon}</span>}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* 選択日の詳細（記録・行事のみ、絵本推薦なし） */}
              {selectedKey && (
                <div className="border-t border-[#F0EDE6]">
                  <div className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm font-bold text-green-700">
                      {month+1}月{parseInt(selectedKey.split('-')[2])}日（{DAYS_JP[new Date(selectedKey).getDay()]}）
                    </p>
                    <button onClick={() => openAddSheet(selectedKey)}
                      className="text-xs text-green-600 bg-[#EAF5EC] px-3 py-1 rounded-full">
                      ＋ 予定を追加
                    </button>
                  </div>
                  <div className="px-4 pb-4 flex flex-col gap-2">
                    {(!selData.books?.length && !selData.shifts?.length && !selData.events?.length) && (
                      <p className="text-xs text-[#B4B2A9] py-2">この日の記録はありません</p>
                    )}
                    {selData.books?.map((b, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 bg-[#F8F6F2] rounded-xl">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                          style={{ background: b.bg }}>{b.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#2C2C2A] truncate">{b.title}</p>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {b.reactions?.slice(0,3).map(r => (
                              <span key={r} className="text-[10px] bg-[#EAF5EC] text-[#1B4D2B] px-1.5 py-0.5 rounded-full">{r}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    {selData.shifts?.map((s, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 bg-[#F8F6F2] rounded-xl">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${SHIFT_CLS[s]}`}>{s}番</span>
                        <p className="text-sm text-[#5A5A57]">シフト</p>
                      </div>
                    ))}
                    {selData.events?.map((e, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 bg-[#F8F6F2] rounded-xl">
                        <span className="text-xl">{e.icon}</span>
                        <p className="text-sm text-[#2C2C2A]">{e.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── 記録のふりかえり ── */}
        <section>
          <p className="text-[10px] font-bold text-[#8A8A85] tracking-wide mb-3">記録のふりかえり</p>
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            {REVIEW_STATS.map(s => (
              <div key={s.label} className="bg-white border border-[#DCE4D9] rounded-2xl px-3 py-3">
                <p className="text-[10px] text-[#7A7873] mb-1 leading-tight">{s.label}</p>
                <p className="font-bold text-xl leading-none mb-0.5" style={{ color: s.color }}>
                  {s.value}<span className="text-[10px] font-normal text-[#8A8A85] ml-0.5">{s.unit}</span>
                </p>
                <p className="text-[10px] text-[#B4B2A9]">{s.sub}</p>
              </div>
            ))}
          </div>
          <div className="bg-white border border-[#DCE4D9] rounded-2xl px-4 py-3">
            <p className="text-[10px] font-bold text-[#8A8A85] tracking-wide mb-2">よく読んだテーマ</p>
            <div className="flex gap-2 flex-wrap">
              {TOP_THEMES.map((t, i) => (
                <span key={t} className={`text-xs px-3 py-1 rounded-full font-medium
                  ${i === 0 ? 'bg-green-600 text-white' : i === 1 ? 'bg-[#EAF5EC] text-green-700' : 'bg-[#F2F5F0] text-[#5A5A57]'}`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── 通知設定 ── */}
        <section>
          <p className="text-[10px] font-bold text-[#8A8A85] tracking-wide mb-3">通知設定</p>
          <div className="bg-white border border-[#DCE4D9] rounded-2xl overflow-hidden">
            {[
              { key: 'event3days',   label: '行事の3日前に通知',        sub: '登録した行事の3日前にお知らせします' },
              { key: 'bookDay',      label: '読みたい絵本の前日に通知', sub: '読む予定の絵本を前日にお知らせします' },
              { key: 'recordForgot', label: '記録忘れの通知',           sub: '記録がない日の夕方にお知らせします' },
            ].map((item, i, arr) => (
              <div key={item.key}
                className={`flex items-center justify-between px-4 py-3.5 ${i < arr.length - 1 ? 'border-b border-[#F8F6F2]' : ''}`}>
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-sm text-[#2C2C2A]">{item.label}</p>
                  <p className="text-[11px] text-[#B4B2A9] mt-0.5">{item.sub}</p>
                </div>
                <Toggle on={notifyToggles[item.key]}
                  onChange={v => setNotifyToggles(t => ({...t, [item.key]: v}))} />
              </div>
            ))}
          </div>
        </section>

        {/* ── アカウント設定 ── */}
        <section>
          <p className="text-[10px] font-bold text-[#8A8A85] tracking-wide mb-3">アカウント設定</p>
          <div className="bg-white border border-[#DCE4D9] rounded-2xl overflow-hidden">
            {[
              { label: 'プロフィール設定',   sub: '名前・園名・担当クラス', action: () => pushOverlay('profile') },
              { label: '通知の詳細設定',    sub: '通知タイミングを細かく設定', action: () => pushOverlay('notify') },
            ].map((item, i, arr) => (
              <button key={item.label} onClick={item.action}
                className={`w-full flex items-center justify-between px-4 py-4 text-left active:bg-[#F8F6F2] transition-colors ${i < arr.length - 1 ? 'border-b border-[#F8F6F2]' : ''}`}>
                <div>
                  <p className="text-sm text-[#2C2C2A]">{item.label}</p>
                  <p className="text-[11px] text-[#8A8A85] mt-0.5">{item.sub}</p>
                </div>
                <ChevronRight size={16} className="text-[#C0BDB5] flex-shrink-0" />
              </button>
            ))}
          </div>
        </section>

      </div>

      {/* ── オーバーレイ ── */}
      <OverlayPanel title="プロフィール設定" isOpen={currentOverlay === 'profile'} onClose={popOverlay}
        footer={<SaveFooter onSave={saveAndClose} onCancel={popOverlay} />}>
        <ProfileForm data={profile} setData={setProfile} />
      </OverlayPanel>

      <OverlayPanel title="通知の詳細設定" isOpen={currentOverlay === 'notify'} onClose={popOverlay}
        footer={<SaveFooter onSave={saveAndClose} onCancel={popOverlay} />}>
        <NotifyDetailForm chips={notifyChips} setChips={setNotifyChips} />
      </OverlayPanel>

      {/* 予定追加シート */}
      {showAddSheet && (
        <AddScheduleSheet
          targetDateKey={addTarget}
          onClose={() => setShowAddSheet(false)}
          onSave={item => addScheduleToDate(item, addTarget)}
        />
      )}

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1B4D2B] text-white text-sm
                        font-medium px-5 py-2.5 rounded-full shadow-lg z-50 whitespace-nowrap pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
