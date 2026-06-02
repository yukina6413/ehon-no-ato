// AIレポート・記録完了画面で共通で使うカード
// variant: 'default' | 'green' | 'blue' | 'orange' | 'gray'
const VARIANTS = {
  default: { card: 'bg-white border-[#DCE4D9]',     label: 'text-green-700'  },
  green:   { card: 'bg-[#EAF5EC] border-[#B8D8BC]', label: 'text-green-800'  },
  blue:    { card: 'bg-[#EBF4FB] border-[#B0D0E8]', label: 'text-blue-800'   },
  orange:  { card: 'bg-[#FEF3E8] border-[#F0C898]', label: 'text-amber-800'  },
  purple:  { card: 'bg-[#F3EFFE] border-[#C8BEE8]', label: 'text-purple-800' },
  gray:    { card: 'bg-[#F4F6F2] border-[#DCE4D9]', label: 'text-[#5A5A57]'  },
}

export default function ReportCard({ label, children, variant = 'default' }) {
  const v = VARIANTS[variant] ?? VARIANTS.default
  return (
    <div className={`border rounded-2xl p-3.5 flex flex-col gap-2.5 ${v.card}`}>
      {label && (
        <p className={`text-[10px] font-medium tracking-widest ${v.label}`}>{label}</p>
      )}
      {children}
    </div>
  )
}
