import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, ChevronLeft, ChevronDown, Sparkles,
  Smile, Copy, AlertCircle, MessageCircle, Eye, RotateCcw, Pencil, Star, MinusCircle,
} from 'lucide-react'
import StepProgressBar from '../components/StepProgressBar'

// ──────────────────────────────────────────
// 定数データ
// ──────────────────────────────────────────
const _d    = new Date()
const _days = ['日','月','火','水','木','金','土']
const TODAY_DISPLAY = `${_d.getFullYear()}年${_d.getMonth()+1}月${_d.getDate()}日（${_days[_d.getDay()]}）`
const TODAY_ISO     = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`

const AGES     = ['0歳児','1歳児','2歳児','3歳児','4歳児','5歳児','混合']
const LOCS     = ['園','図書館','自宅','その他']
const SEASONS  = ['春','夏','秋','冬','通年']
const SCENES   = ['朝の会','帰りの会','活動導入','自由遊び','午睡前','個別対応','その他']
const SCENE_SUBS = { '活動導入': ['製作','集団遊び','散歩','生活習慣','避難訓練','誕生会','その他'] }
const EVENTS   = ['入園式','こいのぼり','七夕','プール開き','水遊び','夏祭り','運動会','七五三','クリスマス','お正月','発表会','卒園式','節分','ひな祭り','ハロウィン','その他']
const HOLIDAYS = ['昭和の日','憲法記念日','みどりの日','こどもの日','海の日','山の日','敬老の日','秋分の日','スポーツの日','文化の日','勤労感謝の日','天皇誕生日','建国記念の日','春分の日','その他']
const WHO      = ['読み手','子ども','その他']

const REACTIONS = [
  { label: '笑った',           Icon: Smile },
  { label: '真似した',         Icon: Copy },
  { label: '怖がった',         Icon: AlertCircle },
  { label: '言葉を返した',     Icon: MessageCircle },
  { label: '集中していた',     Icon: Eye },
  { label: 'もう一回を求めた', Icon: RotateCcw },
  { label: '製作への意欲',     Icon: Pencil },
  { label: '見通しが立った',   Icon: Star },
  { label: '反応が薄かった',   Icon: MinusCircle, wide: true },
]

const AFTER_TYPES = [
  { label: '話が広がった',          sub: '子どもから質問や会話が生まれた' },
  { label: '楽しさで満足した',      sub: '笑いや盛り上がりで終わった' },
  { label: '真似や遊びにつながった', sub: '読後に行動・ごっこ遊びが始まった' },
  { label: '静かな余韻が残った',    sub: 'しんとした空気が流れた' },
]

const INITIAL = {
  title:'', author:'', publisher:'',
  dateMode:'auto', dateManual: TODAY_ISO,
  ages:[], location:'園', seasons:[], scene:'', sceneActivities:[],
  events:[], holidays:[], selectedBy:'読み手',
  reactions:[], afterType:'',
  episode:'', insight:'', nextTime:'',
}

// ──────────────────────────────────────────
// 小さな共通UIパーツ
// ──────────────────────────────────────────
function Card({ children, className = '' }) {
  return (
    <div className={`bg-[#FAFAF8] border border-[#DCE4D9] rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  )
}

function Label({ children }) {
  return <div className="text-xs text-[#5F5E5A] mb-2 leading-snug">{children}</div>
}

function Req()  { return <span className="text-orange-400 font-medium ml-1 text-[10px]">必須</span> }
function Opt()  { return <span className="text-[#B4B2A9] ml-1 text-[10px]">任意</span> }
function Auto() { return <span className="text-green-500 ml-1 text-[10px]">自動</span> }

// chips: multi-select（selected=配列）/ single-select（selected=文字列, single=true）
function Chips({ items, selected, onToggle, color = 'green', single = false }) {
  const onCls = {
    green:  'bg-green-700 border-green-700 text-white',
    blue:   'bg-blue-700  border-blue-700  text-white',
    orange: 'bg-amber-700 border-amber-700 text-white',
  }[color]

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => {
        const active = single ? selected === item : selected.includes(item)
        return (
          <button
            key={item} type="button"
            onClick={() => onToggle(item)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all active:scale-95
              ${active ? onCls : 'bg-[#FAFAF8] border-[#D4D2CC] text-[#444441]'}`}
          >
            {item}
          </button>
        )
      })}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      className="w-full border border-[#DCE4D9] rounded-xl px-3 py-2.5 text-sm bg-[#FAFAF8]
                 placeholder-[#C0BDB5] focus:outline-none focus:border-green-400"
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      className="w-full border border-[#DCE4D9] rounded-xl px-3 py-2.5 text-xs bg-[#FAFAF8]
                 placeholder-[#C0BDB5] focus:outline-none focus:border-green-400
                 resize-none leading-relaxed"
    />
  )
}

// ──────────────────────────────────────────
// Step 1：絵本登録
// ──────────────────────────────────────────
function Step1({ form, setForm }) {
  const [camDone, setCamDone] = useState(false)
  const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleCam = () => {
    setCamDone(true)
    setTimeout(() => {
      setForm(f => ({ ...f, title: 'ぐりとぐら', author: '中川李枝子', publisher: '福音館書店' }))
    }, 700)
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      <Card>
        {/* カメラ */}
        <button
          type="button" onClick={handleCam}
          className={`w-full border border-dashed border-green-400 rounded-xl p-5
                      flex flex-col items-center gap-2 transition-colors
                      ${camDone ? 'bg-green-100' : 'bg-[#EAF5EC]'}`}
        >
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <Camera size={20} className="text-white" />
          </div>
          <p className="text-sm font-bold text-green-900">表紙を撮影する</p>
          <p className="text-xs text-green-700 text-center leading-relaxed">
            タイトル・著者を自動で読み取ります<br />認識に失敗した場合は手動入力に切り替え
          </p>
        </button>

        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 h-px bg-[#E8E6E0]" />
          <span className="text-xs text-[#B4B2A9]">または</span>
          <div className="flex-1 h-px bg-[#E8E6E0]" />
        </div>
        <p className="text-center text-sm text-green-500">手動で入力する ›</p>
      </Card>

      {/* 手動入力フィールド */}
      <Card>
        <div className="flex flex-col gap-3">
          <div>
            <Label>タイトル<Req /></Label>
            <Input value={form.title} onChange={upd('title')} placeholder="例：ぐりとぐら" />
          </div>
          <div>
            <Label>著者<Opt /></Label>
            <Input value={form.author} onChange={upd('author')} placeholder="例：中川李枝子" />
          </div>
          <div>
            <Label>出版社<Opt /></Label>
            <Input value={form.publisher} onChange={upd('publisher')} placeholder="例：福音館書店" />
          </div>
        </div>
      </Card>
    </div>
  )
}

// ──────────────────────────────────────────
// Step 2：基本情報
// ──────────────────────────────────────────
function Step2({ form, setForm }) {
  const [eventsOpen,   setEventsOpen]   = useState(false)
  const [holidaysOpen, setHolidaysOpen] = useState(false)

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const tog = (k, v) => setForm(f => {
    const a = f[k]
    return { ...f, [k]: a.includes(v) ? a.filter(x => x !== v) : [...a, v] }
  })

  // 「通年」と春夏秋冬の排他制御
  const togSeason = (v) => setForm(f => {
    if (v === '通年') {
      // 通年：他の選択を全解除してトグル
      return { ...f, seasons: f.seasons.includes('通年') ? [] : ['通年'] }
    }
    // 春夏秋冬：通年を外してトグル
    const withoutNen = f.seasons.filter(s => s !== '通年')
    return {
      ...f,
      seasons: withoutNen.includes(v)
        ? withoutNen.filter(s => s !== v)
        : [...withoutNen, v],
    }
  })

  return (
    <div className="px-4 py-4 flex flex-col gap-3">

      {/* 日付 */}
      <Card>
        <div className="flex justify-between items-center mb-2">
          <Label>日付<Auto /></Label>
          <button
            type="button"
            onClick={() => upd('dateMode', form.dateMode === 'auto' ? 'manual' : 'auto')}
            className="text-xs text-green-500"
          >
            {form.dateMode === 'auto' ? '別の日を選ぶ' : '今日に戻す'}
          </button>
        </div>
        {form.dateMode === 'auto' ? (
          <div className="bg-[#EAF5EC] border border-[#C0DCBF] rounded-xl px-3 py-2.5 text-sm text-green-900
                          flex items-center justify-between">
            <span>{TODAY_DISPLAY}</span>
            <span className="text-xs text-green-500 font-medium">自動入力 ✓</span>
          </div>
        ) : (
          <Input type="date" value={form.dateManual}
            onChange={e => upd('dateManual', e.target.value)} />
        )}
      </Card>

      {/* 年齢/クラス */}
      <Card>
        <Label>年齢 / クラス<span className="text-orange-400 font-medium ml-1 text-[10px]">どちらか必須</span><Opt /></Label>
        <Chips items={AGES} selected={form.ages} onToggle={v => tog('ages', v)} color="blue" />
      </Card>

      {/* 場所 */}
      <Card>
        <Label>どこにある本か<Req /></Label>
        <Chips items={LOCS} selected={form.location} onToggle={v => upd('location', v)} single />
      </Card>

      {/* 季節 */}
      <Card>
        <Label>季節<Opt /></Label>
        <Chips items={SEASONS} selected={form.seasons} onToggle={togSeason} color="orange" />
      </Card>

      {/* 読んだ場面 */}
      <Card>
        <Label>読んだ場面<Opt /></Label>
        <div className="relative mb-2">
          <select
            value={form.scene}
            onChange={e => setForm(f => ({ ...f, scene: e.target.value, sceneActivities: [] }))}
            className="w-full border border-[#DCE4D9] rounded-xl px-3 py-2.5 text-sm bg-[#FAFAF8]
                       appearance-none focus:outline-none focus:border-green-400"
          >
            <option value="">選んでください</option>
            {SCENES.map(s => <option key={s}>{s}</option>)}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-[#8A8A85]">▾</span>
        </div>
        {SCENE_SUBS[form.scene] && (
          <div className="bg-[#F0F4EE] rounded-xl p-2.5">
            <Chips
              items={SCENE_SUBS[form.scene]}
              selected={form.sceneActivities}
              onToggle={v => tog('sceneActivities', v)}
            />
          </div>
        )}
      </Card>

      {/* 行事・祝日（アコーディオン） */}
      <Card>
        <Label>行事・祝日にあわせて読みましたか<Opt /></Label>
        <div className="flex flex-col gap-2">

          {/* ── 行事 ── */}
          <div>
            <button
              type="button"
              onClick={() => setEventsOpen(v => !v)}
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl border transition-colors
                ${eventsOpen || form.events.length > 0
                  ? 'border-green-400 bg-[#EAF5EC]'
                  : 'border-[#DCE4D9] bg-[#FAFAF8]'}`}
            >
              <span className={`text-sm ${form.events.length > 0 ? 'text-green-900 font-medium' : 'text-[#444441]'}`}>
                行事にあわせて読んだ
              </span>
              <ChevronDown
                size={16}
                className={`text-[#8A8A85] transition-transform duration-200 ${eventsOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {eventsOpen && (
              <div className="mt-2.5 px-1">
                <Chips items={EVENTS} selected={form.events} onToggle={v => tog('events', v)} />
              </div>
            )}
          </div>

          {/* ── 祝日 ── */}
          <div>
            <button
              type="button"
              onClick={() => setHolidaysOpen(v => !v)}
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl border transition-colors
                ${holidaysOpen || form.holidays.length > 0
                  ? 'border-green-400 bg-[#EAF5EC]'
                  : 'border-[#DCE4D9] bg-[#FAFAF8]'}`}
            >
              <span className={`text-sm ${form.holidays.length > 0 ? 'text-green-900 font-medium' : 'text-[#444441]'}`}>
                祝日にあわせて読んだ
              </span>
              <ChevronDown
                size={16}
                className={`text-[#8A8A85] transition-transform duration-200 ${holidaysOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {holidaysOpen && (
              <div className="mt-2.5 px-1">
                <Chips items={HOLIDAYS} selected={form.holidays} onToggle={v => tog('holidays', v)} />
              </div>
            )}
          </div>

        </div>
      </Card>

      {/* 誰が選んだか */}
      <Card>
        <Label>誰が選んだか<Opt /></Label>
        <Chips items={WHO} selected={form.selectedBy} onToggle={v => upd('selectedBy', v)} single />
      </Card>
    </div>
  )
}

// ──────────────────────────────────────────
// Step 3：子どもの反応
// ──────────────────────────────────────────
function Step3({ form, setForm }) {
  const togReaction = v => setForm(f => {
    const a = f.reactions
    return { ...f, reactions: a.includes(v) ? a.filter(x => x !== v) : [...a, v] }
  })
  const setType = v => setForm(f => ({ ...f, afterType: v }))

  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      <p className="text-xs font-bold text-green-700 tracking-wider">子どもの反応</p>

      <Card>
        <Label>当てはまるものをすべて選んでください<Opt /></Label>
        <div className="grid grid-cols-2 gap-2">
          {REACTIONS.map(({ label, Icon, wide }) => {
            const active = form.reactions.includes(label)
            return (
              <button
                key={label} type="button"
                onClick={() => togReaction(label)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs text-left
                            transition-all active:scale-95
                            ${wide ? 'col-span-2' : ''}
                            ${active
                              ? 'bg-[#EAF5EC] border-green-400 text-green-900 font-medium'
                              : 'bg-[#FAFAF8] border-[#DCE4D9] text-[#444441]'}`}
              >
                <Icon size={14} strokeWidth={1.8}
                  className={active ? 'text-green-500 flex-shrink-0' : 'text-[#C0BDB5] flex-shrink-0'} />
                {label}
              </button>
            )
          })}
        </div>
      </Card>

      <p className="text-xs font-bold text-green-700 tracking-wider">えほんのあとタイプ</p>

      <Card className="flex flex-col gap-2">
        <Label>この読み聞かせはどんな余韻でしたか<span className="text-[#B4B2A9] ml-1 text-[10px]">1つ選ぶ</span></Label>
        {AFTER_TYPES.map(({ label, sub }) => {
          const active = form.afterType === label
          return (
            <button
              key={label} type="button"
              onClick={() => setType(label)}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-all
                          ${active ? 'border-green-400 bg-[#EAF5EC]' : 'border-[#DCE4D9] bg-[#FAFAF8]'}`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${active ? 'text-green-900 font-medium' : 'text-[#2C2C2A]'}`}>{label}</p>
                <p className="text-[11px] text-[#B4B2A9] mt-0.5 leading-snug">{sub}</p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all
                              ${active ? 'bg-green-500 border-green-500' : 'border-[#C8C6C0]'}`} />
            </button>
          )
        })}
      </Card>
    </div>
  )
}

// ──────────────────────────────────────────
// Step 4：ふりかえり
// ──────────────────────────────────────────
function Step4({ form, setForm }) {
  const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      <div className="bg-[#EAF5EC] rounded-xl p-3">
        <p className="text-xs font-medium text-green-700 mb-1">このステップはすべて任意です</p>
        <p className="text-xs text-green-900 leading-relaxed">
          ステップ1〜3の選択だけでも、AIは保育提案を生成できます。書けるところだけ書いてください。
        </p>
      </div>

      <Card>
        <Label>印象に残った様子<Opt /></Label>
        <p className="text-[11px] text-[#B4B2A9] mb-2">子どもの言葉・表情・行動など</p>
        <Textarea
          value={form.episode} onChange={upd('episode')}
          placeholder="例：「ぐりとぐら食べたい！」と繰り返していた。製作コーナーで卵の絵を描き始めた子がいた。"
        />
      </Card>

      <Card>
        <Label>今日の気づき<Opt /></Label>
        <p className="text-[11px] text-[#B4B2A9] mb-2">読み方・環境・タイミングなど</p>
        <Textarea
          value={form.insight} onChange={upd('insight')}
          placeholder="例：午睡前より活動導入のほうが集中しやすかった。声を小さくしたら前のめりになった。"
        />
      </Card>

      <Card>
        <Label>次読むならこうしたい<span className="text-[#B4B2A9] ml-1 text-[10px]">任意・引き継ぎメモ</span></Label>
        <Textarea
          rows={2} value={form.nextTime} onChange={upd('nextTime')}
          placeholder="例：製作前に読むと効果的。卵を使う日に合わせてみる。"
        />
      </Card>
    </div>
  )
}

// ──────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────
export default function RecordInput() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL)
  const [toast, setToast] = useState(null)

  const steps = [
    <Step1 form={form} setForm={setForm} />,
    <Step2 form={form} setForm={setForm} />,
    <Step3 form={form} setForm={setForm} />,
    <Step4 form={form} setForm={setForm} />,
  ]

  const goNext = () => {
    if (step < 3) setStep(s => s + 1)
    else navigate('/record-complete')
  }
  const goBack = () => {
    if (step > 0) setStep(s => s - 1)
    else navigate(-1)
  }
  const showToast = (msg, to) => {
    setToast(msg)
    setTimeout(() => { setToast(null); navigate(to) }, 1600)
  }

  return (
    <div className="min-h-screen bg-[#F4F6F2] flex flex-col">

      {/* ── ヘッダー＋ステップバー ── */}
      <div className="bg-green-700 px-4 pt-10 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button onClick={goBack} className="flex items-center gap-0.5 text-green-300 text-sm">
            <ChevronLeft size={16} /> 戻る
          </button>
          <span className="text-white text-sm font-medium">絵本を記録する</span>
          <button className="text-green-300 text-xs bg-white/15 px-3 py-1 rounded-full border border-white/20">
            一時保存
          </button>
        </div>
        <StepProgressBar current={step} />
      </div>

      {/* ── コンテンツ ── */}
      <div className="flex-1 overflow-y-auto pb-36">
        {steps[step]}
      </div>

      {/* ── ボトムボタン（固定） ── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg
                      bg-white border-t border-[#E0E8DC] px-4 pt-3 pb-6">
        {step < 3 ? (
          <button
            onClick={goNext}
            className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700
                       text-white rounded-xl py-3.5 text-sm font-bold mb-2 transition-colors"
          >
            次へ　→
          </button>
        ) : (
          <button
            onClick={goNext}
            className="w-full bg-green-700 hover:bg-green-800 active:bg-green-900
                       text-white rounded-xl py-3.5 text-sm font-bold mb-2
                       flex items-center justify-center gap-2 transition-colors"
          >
            <Sparkles size={14} className="text-green-300" />
            AIレポートを作る
          </button>
        )}
        <button
          onClick={() => showToast('一時保存しました', '/')}
          className="w-full border border-[#C8C6C0] text-[#5F5E5A] rounded-xl py-2.5 text-xs active:bg-gray-50"
        >
          一時保存して終了
        </button>
      </div>

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-[#1B4D2B] text-white text-sm
                        font-medium px-5 py-2.5 rounded-full shadow-lg z-50 whitespace-nowrap
                        pointer-events-none">
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
