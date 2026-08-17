// 絵本カード：AI検索・AIレポート両画面で使い回す
function Tag({ color, label }) {
  const cls = {
    blue:   'bg-[#E6F3FB] text-[#0C447C]',
    green:  'bg-[#EAF5EC] text-[#1B4D2B]',
    orange: 'bg-[#FEF3E8] text-[#7A3A05]',
  }[color] ?? 'bg-[#EAF5EC] text-[#1B4D2B]'

  return (
    <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}

// badges: [{ label, color }] 形式。'実践記録あり'|'配慮あり'|'控えたい場面あり' を自動判別
function BadgeTag({ label }) {
  if (label === '実践記録あり') return <Tag color="green"  label="✓ 実践記録あり" />
  if (label === '配慮あり')     return <Tag color="orange" label="⚠ 配慮あり" />
  if (label === '控えたい場面あり') return <Tag color="blue" label="〇 控えたい場面あり" />
  return <Tag color="green" label={label} />
}

export default function BookCard({
  emoji = '📗',
  color = '#C3E6C8',
  title,
  author,
  tags = {},
  reason,
  badges = [],
  ageRange,
  summary,
  carePoints,
  nextActivities,
}) {
  return (
    <div className="bg-white border border-[#DCE4D9] rounded-2xl overflow-hidden">

      {/* 書誌情報 */}
      <div className="p-3.5 flex gap-3 items-start">
        <div
          className="w-14 h-[72px] rounded-xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm"
          style={{ background: color }}
        >
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-[#2C2C2A] mb-0.5 truncate">{title}</p>
          {author && <p className="text-[11px] text-[#8A8A85] mb-2">{author}</p>}
          <div className="flex flex-wrap gap-1">
            {badges.length > 0 ? (
              <>
                {ageRange && <Tag color="blue" label={ageRange} />}
                {badges.map(b => <BadgeTag key={b} label={b} />)}
              </>
            ) : (
              <>
                {ageRange && <Tag color="blue" label={ageRange} />}
                {tags.age      && <Tag color="blue"   label={tags.age} />}
                {tags.scene    && <Tag color="green"  label={tags.scene} />}
                {tags.reaction && <Tag color="orange" label={tags.reaction} />}
              </>
            )}
          </div>
        </div>
      </div>

      {/* あらすじ */}
      {summary && (
        <div className="mx-3.5 mb-2.5">
          <p className="text-[9px] font-bold text-[#8A8A85] tracking-wider mb-1">あらすじ</p>
          <p className="text-xs text-[#5A5A57] leading-relaxed">{summary}</p>
        </div>
      )}

      {/* 読み聞かせのヒント */}
      {carePoints && (
        <div className="mx-3.5 mb-2.5 bg-[#FEF9F1] rounded-xl px-3 py-2.5 border-l-[3px] border-[#F5C896]">
          <p className="text-[9px] font-bold text-amber-600 tracking-wider mb-1">読み聞かせのヒント</p>
          <p className="text-xs text-[#5A5A57] leading-relaxed">{carePoints}</p>
        </div>
      )}

      {/* 次の展開へ */}
      {nextActivities && (
        <div className="mx-3.5 mb-2.5">
          <p className="text-[9px] font-bold text-[#8A8A85] tracking-wider mb-1">次の展開へ</p>
          <p className="text-xs text-[#5A5A57] leading-relaxed">{nextActivities}</p>
        </div>
      )}

      {/* AIの理由（reason がある場合のみ） */}
      {reason && (
        <div className="mx-3.5 mb-3 bg-[#F8F6F2] rounded-xl px-3 py-2.5 border-l-[3px] border-[#C3E6C8]">
          <p className="text-[9px] font-bold text-green-600 tracking-wider mb-1">AIの理由</p>
          <p className="text-xs text-[#5A5A57] leading-relaxed">{reason}</p>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex gap-2 px-3.5 pb-3.5">
        <button className="flex-1 bg-green-700 hover:bg-green-800 active:bg-green-900 text-white text-xs font-bold rounded-xl py-2.5 transition-colors">
          記録に使う
        </button>
        <button className="flex-1 bg-white hover:bg-gray-50 active:bg-gray-100 text-[#5A5A57] text-xs border border-[#D4D2CC] rounded-xl py-2.5 transition-colors">
          📌 読みたいに追加
        </button>
      </div>
    </div>
  )
}
