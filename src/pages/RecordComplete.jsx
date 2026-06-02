import { useNavigate } from 'react-router-dom'
import { Check, Sparkles } from 'lucide-react'

export default function RecordComplete() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#F4F6F2] flex flex-col">

      {/* ── 完了ヒーロー ── */}
      <div className="bg-green-700 px-5 pt-14 pb-7 flex flex-col items-center gap-3 flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-green-300/40 flex items-center justify-center">
          <Check size={26} className="text-green-900" strokeWidth={3} />
        </div>
        <p className="text-white text-lg font-medium">記録しました</p>
        <p className="text-[#A8D4B4] text-xs">ぐりとぐら ・ 4月24日 ・ 3歳児</p>
      </div>

      {/* ── AIサマリーカード ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-4">
        <div className="bg-white border border-[#DCE4D9] rounded-2xl overflow-hidden">

          {/* カードヘッダー */}
          <div className="bg-[#EAF5EC] px-4 py-3 flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-green-700 flex items-center justify-center flex-shrink-0">
              <Sparkles size={13} className="text-green-200" />
            </div>
            <p className="text-xs font-medium text-green-900 flex-1">AIからの保育レポート</p>
            <p className="text-[11px] text-[#5F5E5A]">今すぐ読める</p>
          </div>

          <div className="px-4 py-4 flex flex-col gap-4">

            {/* TODAY'S REACTION */}
            <div>
              <p className="text-[10px] font-medium text-[#8A8A85] tracking-widest mb-2">TODAY'S REACTION</p>
              <p className="text-sm text-[#2C2C2A] leading-relaxed">
                笑いながら集中して聞いていた子どもたち。「ぐりとぐら食べたい！」という言葉が出るなど、
                <strong>食への興味と友だちとの共感</strong>が自然に引き出されていました。
              </p>
            </div>

            <div className="h-px bg-[#ECE9E2]" />

            {/* WHAT IT MEANS */}
            <div>
              <p className="text-[10px] font-medium text-[#8A8A85] tracking-widest mb-2">WHAT IT MEANS</p>
              <p className="text-sm text-[#2C2C2A] leading-relaxed">
                この時期の3歳児にとって、「一緒に作る・食べる」というイメージは仲間意識を育てます。
                クッキングや制作へのつなぎ場面として効果的です。
              </p>
            </div>

            <div className="h-px bg-[#ECE9E2]" />

            {/* NEXT STEP */}
            <div>
              <p className="text-[10px] font-medium text-[#8A8A85] tracking-widest mb-2">NEXT STEP</p>
              <span className="inline-flex items-center gap-1.5 bg-[#FEF3E8] text-[#854F0B] text-[11px] font-medium px-3 py-1 rounded-full mb-2">
                <Sparkles size={10} className="text-orange-400" />
                次の保育提案
              </span>
              <div className="bg-[#FEF3E8] rounded-xl px-3 py-2.5 text-sm text-[#2C2C2A] leading-relaxed">
                卵を使った共同制作や、友だちと一緒に作るクッキング活動を取り入れてみるとよいかもしれません。
                「何を作ろうか」と子どもに問いかけることで、主体性が引き出されやすくなるでしょう。
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── ボタン ── */}
      <div className="px-4 pt-3 pb-8 bg-white border-t border-[#E0E8DC] flex flex-col gap-2 flex-shrink-0">
        <button
          onClick={() => navigate('/report')}
          className="w-full bg-green-700 hover:bg-green-800 text-white rounded-xl py-3.5 text-sm font-medium
                     flex items-center justify-center gap-2 transition-colors"
        >
          <Sparkles size={14} className="text-green-300" />
          AIレポートをくわしく読む
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/record')}
            className="flex-1 border border-[#C8C6C0] text-[#5F5E5A] rounded-xl py-2.5 text-xs
                       hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            もう1件記録する
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 border border-[#C8C6C0] text-[#5F5E5A] rounded-xl py-2.5 text-xs
                       hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            ホームへ戻る
          </button>
        </div>
      </div>

    </div>
  )
}
