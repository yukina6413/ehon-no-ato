import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'
import ReportCard from '../components/ReportCard'

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────
const TIME_TABS = [
  { id: 'day',   label: '日' },
  { id: 'week',  label: '週' },
  { id: 'month', label: '月' },
  { id: 'year',  label: '年度' },
]
const CLASS_FILTERS = ['ALL', '0歳', '1歳', '2歳', '3歳', '4歳', '5歳', '混合']
const DAYS_JP = ['日','月','火','水','木','金','土']

// ──────────────────────────────────────────
// 期間ヘルパー
// ──────────────────────────────────────────
function getWeekStart(d) {
  const date = new Date(d)
  date.setDate(d.getDate() - d.getDay())
  return date
}
function dayLabel(d) {
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${DAYS_JP[d.getDay()]}）`
}
function weekLabel(d) {
  const start = getWeekStart(d)
  const end   = new Date(start); end.setDate(start.getDate() + 6)
  const firstDay = new Date(start.getFullYear(), start.getMonth(), 1).getDay()
  const weekNum  = Math.ceil((start.getDate() + firstDay) / 7)
  return `${start.getFullYear()}年${start.getMonth()+1}月 第${weekNum}週（${start.getMonth()+1}/${start.getDate()}〜${end.getMonth()+1}/${end.getDate()}）`
}
function monthLabel(d) {
  return `${d.getFullYear()}年${d.getMonth()+1}月`
}

// ──────────────────────────────────────────
// ローカル UI パーツ
// ──────────────────────────────────────────
function TrendChip({ label, color = 'green' }) {
  const cls = {
    green:  'bg-[#EAF5EC] text-[#1B4D2B]',
    orange: 'bg-[#FEF3E8] text-[#854F0B]',
    blue:   'bg-[#E6F3FB] text-[#0C447C]',
  }[color]
  return <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${cls}`}>{label}</span>
}
function InsightBox({ label, children }) {
  return (
    <div className="bg-[#EAF5EC] rounded-2xl p-3.5">
      <p className="text-[10px] font-medium text-green-700 tracking-wide mb-1.5">{label}</p>
      <p className="text-sm text-[#1B4D2B] leading-relaxed">{children}</p>
    </div>
  )
}
function RecRow({ num, title, reason, star = false }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#F4F6F2] rounded-xl">
      <div className="w-5 h-5 rounded-full bg-[#C3E6C8] flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-medium text-[#1B4D2B]">{star ? '★' : num}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#2C2C2A] truncate">{title}</p>
        <p className="text-[11px] text-[#7A7873]">{reason}</p>
      </div>
      <span className="text-[#C0BDB5] text-sm flex-shrink-0">›</span>
    </div>
  )
}
function BarRow({ label, pct, val, color = '#4CAF6A' }) {
  return (
    <div className="flex items-center gap-2 mb-2 last:mb-0">
      <span className="text-[11px] text-[#5F5E5A] w-14 text-right flex-shrink-0">{label}</span>
      <div className="flex-1 h-4 bg-[#F0F4EE] rounded overflow-hidden">
        <div className="h-full rounded" style={{ width:`${pct}%`, background:color }} />
      </div>
      <span className="text-[11px] text-[#5F5E5A] w-8 flex-shrink-0">{val}</span>
    </div>
  )
}

// 期間ナビゲーター
function PeriodSelector({ label, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between bg-white border border-[#DCE4D9] rounded-xl px-3 py-2.5">
      <button onClick={onPrev}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A8A85] hover:bg-[#F4F6F2] transition-colors active:bg-[#EAF5EC]">
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm font-medium text-[#2C2C2A]">{label}</span>
      <button onClick={onNext}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A8A85] hover:bg-[#F4F6F2] transition-colors active:bg-[#EAF5EC]">
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

// ──────────────────────────────────────────
// タブコンテンツ
// ──────────────────────────────────────────
function TabDay() {
  return (
    <>
      <ReportCard label="その日のまとめ">
        <div className="flex flex-wrap gap-2">
          <TrendChip label="うさぎ組 3歳児" /><TrendChip label="2冊" /><TrendChip label="活動導入" color="orange" />
        </div>
      </ReportCard>
      <ReportCard label="① 子どもの姿" variant="green">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・絵本の言葉や場面に興味をもち、保育者や友だちとやりとりしながら楽しむ姿が見られた。</p>
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・繰り返しの表現に反応し、「ぐりとぐら食べたい！」など自分の言葉で思いを表現する様子があった。</p>
        </div>
      </ReportCard>
      <ReportCard label="② 保育者の読み取り" variant="blue">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・絵本を通して友だちと気持ちを共有する楽しさを感じている姿がうかがえた。</p>
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・物語の世界を遊びへつなげようとする主体的な動きが見られ、制作活動への意欲の高まりが感じられる。</p>
        </div>
        <p className="text-[11px] text-[#8A8A85] mt-0.5">※ AIによる参考情報です。実際の観察を優先してください。</p>
      </ReportCard>
      <ReportCard label="③ 明日以降の援助・環境構成" variant="orange">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・絵本の内容に関連する素材（卵・フライパンなど）を製作コーナーに用意し、遊びへつながる環境を整えていく。</p>
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・同じ絵本を継続して取り入れ、繰り返し楽しめる機会を設ける。</p>
        </div>
      </ReportCard>
      <ReportCard label="④ 発達的視点" variant="purple">
        <p className="text-sm text-[#2C2C2A] leading-relaxed">この時期の3歳児にとって「一緒に作る・食べる」イメージは仲間意識の育ちと結びつきやすい。絵本後の制作行動は、物語を内側で処理し遊びへ昇華する姿として発達的に意味がある。</p>
        <p className="text-[11px] text-[#8A8A85] mt-0.5">※ AIによる参考情報です。実際の観察を優先してください。</p>
      </ReportCard>
      <ReportCard label="⑤ 一言ふりかえり" variant="gray">
        <p className="text-sm text-[#2C2C2A] font-medium leading-relaxed">食への興味・友だちとの共感・主体的な制作意欲が引き出された一日。</p>
      </ReportCard>
    </>
  )
}

function TabWeek() {
  return (
    <>
      <ReportCard label="週のまとめ">
        <div className="flex flex-wrap gap-2">
          <TrendChip label="食べ物" /><TrendChip label="動物" /><TrendChip label="春・自然" color="orange" /><TrendChip label="友だち" color="blue" />
        </div>
      </ReportCard>
      <ReportCard label="① 今週の子どもの姿" variant="green">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・「もう一回読んで」と繰り返しを求める声が増え、絵本への親しみが深まっている様子が見られた。</p>
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・友だちと一緒に絵本を楽しむ場面が多く、共感・共有の姿が育っている。</p>
        </div>
      </ReportCard>
      <ReportCard label="② 保育者の読み取り" variant="blue">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・絵本のテーマが身近な生活（食・自然）と結びつきやすく、言葉や表現への興味が高まっていると考えられる。</p>
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・読み聞かせがその後の遊びや制作活動への動機づけになっている様子がうかがえる。</p>
        </div>
        <p className="text-[11px] text-[#8A8A85] mt-0.5">※ AIによる参考情報です。</p>
      </ReportCard>
      <ReportCard label="③ 来週の援助・環境構成" variant="orange">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・今週の反応をもとに、「動き」「音」テーマの絵本を意図的に取り入れ変化をつける。</p>
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・絵本コーナーに今週読んだ絵本を引き続き置き、子どもが自分で手に取れる環境を整える。</p>
        </div>
      </ReportCard>
      <ReportCard label="④ 発達的視点" variant="purple">
        <p className="text-sm text-[#2C2C2A] leading-relaxed">今週は「静かに楽しむ」読み方が多かった。これは3歳後期の集中力の発達を示している可能性がある。次週は「声に出して楽しむ」絵本を意図的に加えると、表現力と言語発達にもアプローチできる。</p>
      </ReportCard>
      <ReportCard label="今週の印象的な絵本">
        <RecRow star title="ぐりとぐら" reason="反応の幅が最も広かった" />
      </ReportCard>
      <InsightBox label="来週に向けて">今週は「静かに楽しむ」系の絵本が多めでした。来週は体を動かしたくなる絵本や、声に出して楽しめるリズム絵本を試してみるとよいかもしれません。</InsightBox>
    </>
  )
}

function TabMonth() {
  return (
    <>
      <ReportCard label="月のまとめ">
        <div className="flex flex-wrap gap-2">
          <TrendChip label="春・出会い" /><TrendChip label="食べ物" /><TrendChip label="動物" color="blue" /><TrendChip label="行事（入園）" color="orange" />
        </div>
      </ReportCard>
      <ReportCard label="① 今月の子どもの姿" variant="green">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・月前半は緊張気味で反応が薄い場面もあったが、後半になるにつれ「笑った」「言葉を返した」の反応が増えた。</p>
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・クラスや保育者への信頼が育つにつれ、絵本への反応も豊かになってきた様子が見られる。</p>
        </div>
      </ReportCard>
      <ReportCard label="② 保育者の読み取り" variant="blue">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・安心できる環境の中で、絵本が仲間との共有体験の場となっていると考えられる。</p>
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・食べ物・動物など身近なテーマへの親しみが、語彙や表現力の育ちにつながっている様子がうかがえる。</p>
        </div>
        <p className="text-[11px] text-[#8A8A85] mt-0.5">※ AIによる参考情報です。</p>
      </ReportCard>
      <ReportCard label="③ 来月の援助・環境構成" variant="orange">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・子どもたちが場に慣れてきた様子を受けて、少し長めの物語絵本へ広げてみる。</p>
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・子どもの興味（食・動物）に沿ったテーマの絵本を意識的に選書していく。</p>
        </div>
      </ReportCard>
      <ReportCard label="④ 発達的視点" variant="purple">
        <p className="text-sm text-[#2C2C2A] leading-relaxed">入園・進級期特有の慣れの過程が読み聞かせの反応に現れている。後半の反応の増加は安心の基地が形成されてきた証と捉えられる。来月は「少し長い物語」への移行が発達に合うタイミングといえる。</p>
      </ReportCard>
      <ReportCard label="今月の印象的な絵本">
        <div className="flex flex-col gap-2">
          <RecRow num="1" title="ぐりとぐら" reason="最多の反応・言葉の返しあり" />
          <RecRow num="2" title="だるまさんが" reason="「もう一回」が一番多かった" />
        </div>
      </ReportCard>
      <InsightBox label="来月に向けて">問いかけが生まれる絵本や、主人公に感情移入しやすい絵本を取り入れてみるタイミングです。子どもの「なんで？」を引き出せる一冊を選んでみましょう。</InsightBox>
    </>
  )
}

function TabYear() {
  return (
    <>
      <ReportCard label="2024年度 読んだ絵本のテーマ傾向">
        <div className="pt-1">
          <BarRow label="食べ物"   pct={82} val="18冊" />
          <BarRow label="動物"     pct={68} val="15冊" color="#5BA8D4" />
          <BarRow label="行事"     pct={50} val="11冊" color="#F0943A" />
          <BarRow label="生活習慣" pct={36} val="8冊" />
          <BarRow label="友だち"   pct={27} val="6冊"  color="#5BA8D4" />
        </div>
      </ReportCard>
      <ReportCard label="① 子どもの興味・関心の変化" variant="green">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・年度前半は生活習慣・動物テーマへの反応が多かったが、後半は友だち・仲間をテーマにした絵本への反応が豊かになってきた。</p>
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・「もう一回」「一緒に読もう」という声が増え、絵本が友だちとの共有体験として定着している。</p>
        </div>
      </ReportCard>
      <ReportCard label="② 育ちのポイント" variant="blue">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・くりかえし絵本から物語性のある絵本へと、子どもの興味の幅が広がっている様子が記録から読み取れる。</p>
          <p className="text-sm text-[#2C2C2A] leading-relaxed">・読後に遊びや制作へつなげる姿が増え、想像力と主体性の育ちが感じられる。</p>
        </div>
        <p className="text-[11px] text-[#8A8A85] mt-0.5">※ AIによる参考情報です。</p>
      </ReportCard>
      <ReportCard label="③ 発達的視点（年間）" variant="purple">
        <p className="text-sm text-[#2C2C2A] leading-relaxed">4〜6月の「集中」中心から、10月以降の「言葉の返し」「もう一回」の増加は、絵本に対する主体的な関与が深まっていることを示す。認知・言語・社会性の三つが絵本を媒介として統合的に育っている年度と評価できる。</p>
      </ReportCard>
      <ReportCard label="年度 印象的な絵本 TOP3">
        <div className="flex flex-col gap-2">
          <RecRow num="1" title="ぐりとぐら" reason="年間最多・反応の質も高い" />
          <RecRow num="2" title="はらぺこあおむし" reason="リピート率No.1" />
          <RecRow num="3" title="だるまさんが" reason="「もう一回」が最も多かった" />
        </div>
      </ReportCard>
      <InsightBox label="来年度に向けて">「友だち」テーマの絵本が少なかった年度でした。来年度の4〜5月に意識的に取り入れてみると、クラス作りと連動しやすくなるかもしれません。</InsightBox>
    </>
  )
}

// ──────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────
export default function AIReport() {
  const navigate = useNavigate()
  const [timeTab,     setTimeTab]     = useState('day')
  const [classFilter, setClassFilter] = useState('ALL')

  // 期間ステート
  const [dayDate,   setDayDate]   = useState(new Date())
  const [weekDate,  setWeekDate]  = useState(getWeekStart(new Date()))
  const [monthDate, setMonthDate] = useState(new Date())

  // 期間ナビゲーション
  const prevPeriod = () => {
    if (timeTab === 'day')   setDayDate(d   => { const n = new Date(d); n.setDate(d.getDate()-1);    return n })
    if (timeTab === 'week')  setWeekDate(d  => { const n = new Date(d); n.setDate(d.getDate()-7);    return n })
    if (timeTab === 'month') setMonthDate(d => { const n = new Date(d); n.setMonth(d.getMonth()-1);  return n })
  }
  const nextPeriod = () => {
    if (timeTab === 'day')   setDayDate(d   => { const n = new Date(d); n.setDate(d.getDate()+1);    return n })
    if (timeTab === 'week')  setWeekDate(d  => { const n = new Date(d); n.setDate(d.getDate()+7);    return n })
    if (timeTab === 'month') setMonthDate(d => { const n = new Date(d); n.setMonth(d.getMonth()+1);  return n })
  }

  // 表示中の期間ラベル
  const periodLabel =
    timeTab === 'day'   ? dayLabel(dayDate) :
    timeTab === 'week'  ? weekLabel(weekDate) :
    timeTab === 'month' ? monthLabel(monthDate) : null

  const tabContent = {
    day:   <TabDay />,
    week:  <TabWeek />,
    month: <TabMonth />,
    year:  <TabYear />,
  }

  return (
    <div className="min-h-screen bg-[#F4F6F2] flex flex-col pb-20">

      {/* ── ヘッダー ── */}
      <div className="bg-green-700 px-4 pt-10 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-0.5 text-green-300 text-sm">
            <ChevronLeft size={16} /> 戻る
          </button>
          <span className="text-white text-sm font-medium">AIレポート</span>
          <div className="w-12" />
        </div>

        {/* 時間軸タブ（メイン） */}
        <div className="flex overflow-x-auto border-b border-white/20">
          {TIME_TABS.map(t => (
            <button key={t.id} onClick={() => setTimeTab(t.id)}
              className={`text-xs px-6 py-2.5 flex-shrink-0 border-b-2 transition-all
                ${timeTab === t.id ? 'text-white font-medium border-white' : 'text-white/60 border-transparent'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* クラスフィルター */}
        <div className="flex gap-1.5 overflow-x-auto py-3">
          {CLASS_FILTERS.map(c => (
            <button key={c} onClick={() => setClassFilter(c)}
              className={`text-xs px-3 py-1.5 rounded-full border flex-shrink-0 transition-all
                ${classFilter === c ? 'bg-white text-green-900 border-white font-medium' : 'text-white/70 border-white/30'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* ── コンテンツ ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">

        {/* クラス絞り込み中インジケーター */}
        {classFilter !== 'ALL' && (
          <div className="flex items-center gap-2 bg-white border border-[#DCE4D9] rounded-xl px-3 py-2.5">
            <span className="text-xs text-[#8A8A85]">絞り込み中：</span>
            <span className="text-xs font-medium text-[#0C447C] bg-[#E6F3FB] px-2 py-0.5 rounded-full">{classFilter}クラス</span>
            <button onClick={() => setClassFilter('ALL')} className="ml-auto text-[11px] text-[#8A8A85]">クリア</button>
          </div>
        )}

        {/* 期間ナビゲーター（日・週・月のみ） */}
        {periodLabel && (
          <PeriodSelector label={periodLabel} onPrev={prevPeriod} onNext={nextPeriod} />
        )}

        {tabContent[timeTab]}
      </div>

    </div>
  )
}
