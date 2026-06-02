const STEPS = ['絵本登録', '基本情報', '子どもの反応', 'ふりかえり']

export default function StepProgressBar({ current }) {
  return (
    <div className="mt-3">
      <div className="flex gap-1.5 mb-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full transition-all duration-300 ${
              i < current  ? 'bg-green-300' :
              i === current ? 'bg-white'     : 'bg-white/20'
            }`}
          />
        ))}
      </div>
      <div className="flex gap-1.5">
        {STEPS.map((label, i) => (
          <div
            key={i}
            className={`flex-1 text-center text-[9px] leading-snug ${
              i < current  ? 'text-green-200'       :
              i === current ? 'text-white font-medium' : 'text-white/40'
            }`}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
