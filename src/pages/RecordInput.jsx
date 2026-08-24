import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Camera, ChevronLeft, Sparkles,
  Smile, Copy, AlertCircle, MessageCircle, Eye, RotateCcw, Pencil, Star, MinusCircle,
} from 'lucide-react'
import StepProgressBar from '../components/StepProgressBar'
import { useAuth } from '../context/AuthContext'
import {
  savePracticeLog, getBookById, formatAgeGroups, BOOK_LOOKUP_ERRORS,
} from '../lib/dataAdapter'
import { isMock } from '../lib/dataAdapter'
import { materialTypeLabel } from '../lib/catalog/normalize'

// 認証（確認メール）でページが再読込・遷移しても入力を失わないための保存キー。
// sessionStorage＝タブを閉じるまで保持。保存成功で消す。
const DRAFT_KEY = 'record_draft_v1'

const _d    = new Date()
const _days = ['日','月','火','水','木','金','土']
const TODAY_DISPLAY = `${_d.getFullYear()}年${_d.getMonth()+1}月${_d.getDate()}日（${_days[_d.getDay()]}）`
const TODAY_ISO     = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`

// 0〜5歳児は複数選択可（「混合」は複数選択で表現できるため廃止）
const AGES     = ['0歳児','1歳児','2歳児','3歳児','4歳児','5歳児']
const LOCS     = ['園','図書館','自宅','その他']
const SCENES   = ['朝の会','帰りの会','活動導入','自由遊び','午睡前','個別対応','その他']
const SCENE_SUBS = { '活動導入': ['製作','集団遊び','散歩','生活習慣','避難訓練','誕生会','その他'] }
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
  bookId: null,   // 検索・絵本詳細から引き継いだ実DBの絵本ID（手入力時はnull）
  materialType: null,   // 'picture_book' | 'kamishibai'。表示のみ。記録には保存しない
  stateId: null,        // 「どの子どもの姿から選んだか」。practice_log_states に pre として保存する
  dateMode:'auto', dateManual: TODAY_ISO,
  ages:[], location:'園', scene:'', sceneActivities:[],
  selectedBy:'読み手', reason:'',   // 読み手が選んだときの「この絵本を選んだ理由」
  reactions:[], afterType:'',
  episode:'', insight:'', nextTime:'',
}

// 配列で持つ項目。下書きの復元時に、値が壊れていても必ず配列になるようにする。
// （ここが配列でないと Chips の .includes() で画面全体が落ちる＝白い画面になる）
const ARRAY_KEYS = ['ages', 'sceneActivities', 'reactions']

// sessionStorageの下書きを安全に読み出す。
// 旧い形（フォームだけを保存していた頃）でも読めるようにしている。
function loadDraft() {
  try {
    const saved = sessionStorage.getItem(DRAFT_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved)
    // 旧形式＝フォームそのもの / 新形式＝{ step, form }
    const rawForm = parsed?.form ?? parsed
    if (!rawForm || typeof rawForm !== 'object') return null
    const form = { ...INITIAL, ...rawForm }
    for (const k of ARRAY_KEYS) {
      if (!Array.isArray(form[k])) form[k] = []
    }
    const step = Number.isInteger(parsed?.step) ? Math.min(Math.max(parsed.step, 0), 3) : 0
    return { form, step }
  } catch {
    return null   // 壊れていたら新規入力として扱う
  }
}

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

function Chips({ items, selected, onToggle, color = 'green', single = false }) {
  const onCls = {
    green: 'bg-green-700 border-green-700 text-white',
    blue:  'bg-blue-700  border-blue-700  text-white',
  }[color]
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => {
        const active = single ? selected === item : selected.includes(item)
        return (
          <button key={item} type="button" onClick={() => onToggle(item)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all active:scale-95
              ${active ? onCls : 'bg-[#FAFAF8] border-[#D4D2CC] text-[#444441]'}`}>
            {item}
          </button>
        )
      })}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', invalid = false }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-[#FAFAF8]
                  placeholder-[#C0BDB5] focus:outline-none
                  ${invalid ? 'border-red-400 focus:border-red-400' : 'border-[#DCE4D9] focus:border-green-400'}`} />
  )
}
function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      className="w-full border border-[#DCE4D9] rounded-xl px-3 py-2.5 text-xs bg-[#FAFAF8]
                 placeholder-[#C0BDB5] focus:outline-none focus:border-green-400
                 resize-none leading-relaxed" />
  )
}

// ── Step 1：絵本登録 ──
function Step1({ form, setForm, titleError }) {
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
        <button type="button" onClick={handleCam}
          className={`w-full border border-dashed border-green-400 rounded-xl p-5
                      flex flex-col items-center gap-2 transition-colors
                      ${camDone ? 'bg-green-100' : 'bg-[#EAF5EC]'}`}>
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
      <Card>
        {form.materialType && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[10px] bg-[#EAF5EC] text-green-700 rounded-full px-2.5 py-1">
              {materialTypeLabel(form.materialType)}
            </span>
            <span className="text-[11px] text-[#8A8A85]">として記録します</span>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <div><Label>タイトル<Req /></Label>
            <Input value={form.title} onChange={upd('title')} placeholder="例：ぐりとぐら"
              invalid={titleError} />
            {titleError && (
              <p className="text-xs text-red-500 mt-1.5">絵本のタイトルを入力してください</p>
            )}
          </div>
          <div><Label>著者<Opt /></Label>
            <Input value={form.author} onChange={upd('author')} placeholder="例：中川李枝子" />
          </div>
          <div><Label>出版社<Opt /></Label>
            <Input value={form.publisher} onChange={upd('publisher')} placeholder="例：福音館書店" />
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── Step 2：基本情報 ──
function Step2({ form, setForm }) {
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const tog = (k, v) => setForm(f => {
    const a = f[k] ?? []
    return { ...f, [k]: a.includes(v) ? a.filter(x => x !== v) : [...a, v] }
  })
  // 「誰が選んだか」を読み手以外に変えたら、読み手向けの理由欄は画面から消えるので値も空にする
  // （画面に出ていない入力が保存対象に残らないようにするため）
  const setSelectedBy = v => setForm(f => ({
    ...f,
    selectedBy: v,
    reason: v === '読み手' ? f.reason : '',
  }))
  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      <Card>
        <div className="flex justify-between items-center mb-2">
          <Label>日付<Auto /></Label>
          <button type="button"
            onClick={() => upd('dateMode', form.dateMode === 'auto' ? 'manual' : 'auto')}
            className="text-xs text-green-500">
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
      <Card>
        <Label>年齢 / クラス<span className="text-orange-400 font-medium ml-1 text-[10px]">どちらか必須</span></Label>
        <Chips items={AGES} selected={form.ages} onToggle={v => tog('ages', v)} color="blue" />
      </Card>
      <Card>
        <Label>どこにある本か<Req /></Label>
        <Chips items={LOCS} selected={form.location} onToggle={v => upd('location', v)} single />
      </Card>
      <Card>
        <Label>読んだ場面<Opt /></Label>
        <div className="relative mb-2">
          <select value={form.scene}
            onChange={e => setForm(f => ({ ...f, scene: e.target.value, sceneActivities: [] }))}
            className="w-full border border-[#DCE4D9] rounded-xl px-3 py-2.5 text-sm bg-[#FAFAF8]
                       appearance-none focus:outline-none focus:border-green-400">
            <option value="">選んでください</option>
            {SCENES.map(s => <option key={s}>{s}</option>)}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-[#8A8A85]">▾</span>
        </div>
        {SCENE_SUBS[form.scene] && (
          <div className="bg-[#F0F4EE] rounded-xl p-2.5">
            <Chips items={SCENE_SUBS[form.scene]} selected={form.sceneActivities}
              onToggle={v => tog('sceneActivities', v)} />
          </div>
        )}
      </Card>
      <Card>
        <Label>誰が選んだか<Opt /></Label>
        <Chips items={WHO} selected={form.selectedBy} onToggle={setSelectedBy} single />
        {form.selectedBy === '読み手' && (
          <div className="mt-3">
            <Label>この絵本を選んだ理由<Opt /></Label>
            <p className="text-[11px] text-[#B4B2A9] mb-2">どんな子どもの姿・ねらいがあって選んだか</p>
            <Textarea rows={2} value={form.reason}
              onChange={e => upd('reason', e.target.value)}
              placeholder="例：貸し借りでぶつかる姿が続いていたので。" />
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Step 3：子どもの反応 ──
function Step3({ form, setForm }) {
  const togReaction = v => setForm(f => {
    const a = f.reactions ?? []
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
            const active = (form.reactions ?? []).includes(label)
            return (
              <button key={label} type="button" onClick={() => togReaction(label)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs text-left
                            transition-all active:scale-95
                            ${wide ? 'col-span-2' : ''}
                            ${active ? 'bg-[#EAF5EC] border-green-400 text-green-900 font-medium'
                                     : 'bg-[#FAFAF8] border-[#DCE4D9] text-[#444441]'}`}>
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
            <button key={label} type="button" onClick={() => setType(label)}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-all
                          ${active ? 'border-green-400 bg-[#EAF5EC]' : 'border-[#DCE4D9] bg-[#FAFAF8]'}`}>
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

// ── Step 4：ふりかえり ──
function Step4({ form, setForm }) {
  const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      <div className="bg-[#EAF5EC] rounded-xl p-3">
        <p className="text-xs font-medium text-green-700 mb-1">このステップはすべて任意です</p>
        <p className="text-xs text-green-900 leading-relaxed">
          ステップ1〜3の選択だけでも記録を保存できます。書けるところだけ書いてください。
        </p>
      </div>
      <Card>
        <Label>印象に残った子どもの様子<Opt /></Label>
        <p className="text-[11px] text-[#B4B2A9] mb-2">実際に見られた子どもの言葉・表情・行動</p>
        <Textarea value={form.episode} onChange={upd('episode')}
          placeholder="例：「ぐりとぐら食べたい！」と繰り返していた。" />
      </Card>
      <Card>
        <Label>今日の気づき<Opt /></Label>
        <p className="text-[11px] text-[#B4B2A9] mb-2">読み方・環境・タイミングなど</p>
        <Textarea value={form.insight} onChange={upd('insight')}
          placeholder="例：午睡前より活動導入のほうが集中しやすかった。" />
      </Card>
      <Card>
        <Label>次読むならこうしたい<span className="text-[#B4B2A9] ml-1 text-[10px]">任意・引き継ぎメモ</span></Label>
        <Textarea rows={2} value={form.nextTime} onChange={upd('nextTime')}
          placeholder="例：製作前に読むと効果的。" />
      </Card>
    </div>
  )
}

// ── メインコンポーネント ──
export default function RecordInput() {
  const navigate = useNavigate()
  const location = useLocation()
  const { ensureSession } = useAuth()
  // ① 検索・絵本詳細の「この絵本を記録する」から渡された絵本情報を最優先で反映する。
  //    bookId があれば保存時にタイトル一致検索を省いて確実にその絵本に紐づく。
  // ② 引き継ぎが無い場合、下書き（sessionStorage）から入力途中の内容とページ番号を戻す。
  const initial = (() => {
    const picked = location.state
    // bookId だけでも引き継ぎとして扱う（その場で追加した作品は、
    // 書名が空でも book_id さえあれば確実にその作品へ記録できる）。
    if (picked?.bookId || picked?.bookTitle) {
      return {
        form: {
          ...INITIAL,
          title:     picked.bookTitle  || '',
          author:    picked.bookAuthor || '',
          publisher: picked.bookPublisher || '',
          bookId:    picked.bookId || null,
          // 表示用。practice_logs には保存しない（保存の正本は bookId）
          materialType: picked.bookMaterialType || null,
          // 子どもの姿から探して来たときだけ入る。無ければ従来どおり記録だけを保存する。
          stateId:   picked.stateId || null,
        },
        step: 0,
      }
    }
    return loadDraft() ?? { form: INITIAL, step: 0 }
  })()

  const [step, setStep] = useState(initial.step)
  const [form, setForm] = useState(initial.form)
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [candidates, setCandidates] = useState(null)   // 同名の絵本が複数あったときの候補
  const [triedNext, setTriedNext] = useState(false)    // タイトル未入力で「次へ」を押したか

  // 入力内容と現在のページを都度 sessionStorage に退避する。
  // ページを更新しても、入力とページ番号の両方が戻るようにするため step も一緒に保存する。
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, form }))
    } catch { /* 容量超過等は無視 */ }
  }, [form, step])

  // bookId はあるがタイトルが無い（state消失からの復元など）とき、book_id から再取得して補完
  useEffect(() => {
    let ignore = false
    if (form.bookId && !form.title) {
      getBookById(form.bookId)
        .then(b => { if (!ignore && b) setForm(f => ({
          ...f, title: b.title, author: b.author || f.author, publisher: b.publisher || f.publisher,
        })) })
        .catch(err => console.error('絵本の再取得に失敗:', err))
    }
    return () => { ignore = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // タイトルは必須。ただし絵本を引き継いで入った直後は、タイトルを取得中で
  // 空のことがあるため、bookId があるときは進めてよい。
  const titleMissing = !form.title.trim() && !form.bookId

  const steps = [
    <Step1 key={0} form={form} setForm={setForm} titleError={triedNext && titleMissing} />,
    <Step2 key={1} form={form} setForm={setForm} />,
    <Step3 key={2} form={form} setForm={setForm} />,
    <Step4 key={3} form={form} setForm={setForm} />,
  ]

  const goBack = () => {
    if (step > 0) setStep(s => s - 1)
    else navigate(-1)
  }

  // 実際の保存処理。未認証なら画面操作なしで匿名ユーザーを作ってから保存する。
  // overrideBookId … 同名候補の中から利用者が選んだ絵本のID
  const doSave = useCallback(async (overrideBookId) => {
    if (saving) return
    setSaving(true)
    setSaveError(null)
    setCandidates(null)
    try {
      // MVP：メール/OTP入力を求めず、必要になった時点で匿名ユーザーを用意する。
      // セッションが有効になると savePracticeLog の user_id 既定値 auth.uid() が
      // 匿名ユーザーのIDになる。既にセッションがあれば新しく作らない。
      if (!isMock) {
        await ensureSession()
      }
      // 「読んだ後にどのような姿になったか」は入力させないため post は空のまま。
      // stateId が無い導線（書名検索・自分が追加した作品・本棚など）では
      // pre も空配列になり、practice_log_states は作られない。
      const preStateIds = form.stateId ? [form.stateId] : []
      await savePracticeLog(
        overrideBookId ? { ...form, bookId: overrideBookId } : form,
        preStateIds,
        [],
      )
      try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }  // 保存成功で下書きを消す
      const d = new Date()
      const dateStr = form.dateMode === 'auto'
        ? `${d.getMonth()+1}月${d.getDate()}日`
        : (() => {
            const [, m, day] = (form.dateManual || '').split('-')
            return m && day ? `${parseInt(m)}月${parseInt(day)}日` : ''
          })()
      navigate('/record-complete', {
        state: {
          bookTitle: form.title || '（タイトルなし）',
          dateStr,
          ageGroup: formatAgeGroups(form.ages),   // 複数選んだときは「3・4歳児」と出す
        },
      })
    } catch (err) {
      // 失敗してもホームへは戻さず、この画面にエラーを表示して再試行できるようにする
      console.error('記録保存エラー:', err)
      if (err?.code === BOOK_LOOKUP_ERRORS.AMBIGUOUS && err.candidates?.length) {
        // 同名の絵本が複数。どれか1冊を推測せず、利用者に選んでもらう
        setCandidates(err.candidates)
      }
      setSaveError(err?.message || '保存できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }, [saving, form, navigate, ensureSession])

  // 候補から選ばれた絵本で保存し直す
  function chooseBook(book) {
    setForm(f => ({ ...f, bookId: book.id, author: f.author || book.author || '' }))
    doSave(book.id)
  }

  const goNext = () => {
    if (step === 0 && titleMissing) {
      setTriedNext(true)   // Step1にその場でエラーを出す（保存時まで気づかせない）
      return
    }
    if (step < 3) {
      setStep(s => s + 1)
      return
    }
    // 最終ステップ：ログイン画面は出さず、そのまま保存（未認証なら内部で匿名ログイン）
    doSave()
  }

  const showToast = (msg, to) => {
    setToast(msg)
    setTimeout(() => { setToast(null); navigate(to) }, 1600)
  }

  return (
    <div className="min-h-screen bg-[#F4F6F2] flex flex-col">
      <div className="bg-green-700 px-4 pt-10 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button onClick={goBack} className="flex items-center gap-0.5 text-green-300 text-sm">
            <ChevronLeft size={16} /> 戻る
          </button>
          <span className="text-white text-sm font-medium">絵本を記録する</span>
          <button
            onClick={() => showToast('一時保存しました', '/')}
            className="text-green-300 text-xs bg-white/15 px-3 py-1 rounded-full border border-white/20">
            一時保存
          </button>
        </div>
        <StepProgressBar current={step} />
      </div>

      <div className="flex-1 overflow-y-auto pb-36">
        {steps[step]}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg
                      bg-white border-t border-[#E0E8DC] px-4 pt-3 pb-6">
        {saveError && (
          <div className="mb-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <p className="text-xs text-red-600">{saveError}</p>
          </div>
        )}
        {/* 同名の絵本が複数あったとき。どれか1冊を勝手に決めず、選んでもらう */}
        {candidates && (
          <div className="mb-2 bg-[#FAFAF8] border border-[#DCE4D9] rounded-xl p-3">
            <p className="text-xs text-[#5F5E5A] mb-2">記録する絵本を選んでください</p>
            <div className="flex flex-col gap-1.5">
              {candidates.map(b => (
                <button key={b.id} type="button" onClick={() => chooseBook(b)} disabled={saving}
                  className="w-full text-left border border-[#DCE4D9] rounded-xl px-3 py-2.5
                             bg-white active:bg-[#F4F6F2] transition-colors">
                  <p className="text-sm text-[#2C2C2A]">{b.title}</p>
                  <p className="text-[11px] text-[#8A8A85] mt-0.5">
                    {[b.author, b.publisher].filter(Boolean).join('・') || '著者・出版社の情報なし'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
        {step < 3 ? (
          <button onClick={goNext}
            className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700
                       text-white rounded-xl py-3.5 text-sm font-bold mb-2 transition-colors">
            {'次へ　→'}
          </button>
        ) : (
          <button onClick={goNext} disabled={saving}
            className={`w-full rounded-xl py-3.5 text-sm font-bold mb-2
                       flex items-center justify-center gap-2 transition-colors
                       ${saving
                         ? 'bg-[#B0CCBA] text-white'
                         : 'bg-green-700 hover:bg-green-800 active:bg-green-900 text-white'}`}>
            <Sparkles size={14} className="text-green-300" />
            {saving ? '保存中...' : '記録を保存して完了'}
          </button>
        )}
        <button onClick={() => showToast('一時保存しました', '/')}
          className="w-full border border-[#C8C6C0] text-[#5F5E5A] rounded-xl py-2.5 text-xs active:bg-gray-50">
          一時保存して終了
        </button>
      </div>

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
