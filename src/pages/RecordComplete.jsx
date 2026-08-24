import { useNavigate, useLocation } from 'react-router-dom'
import { Check, Sparkles, AlertCircle } from 'lucide-react'

export default function RecordComplete() {
  const navigate = useNavigate()
  const { state } = useLocation()

  const bookTitle = state?.bookTitle || '絵本'
  const dateStr   = state?.dateStr   || ''
  const ageGroup  = state?.ageGroup  || ''
  // 記録は保存できたが、選んだときの子どもの姿だけ残せなかったとき。
  // 保存し直しは不要なので、やり直しを促す文言にはしない。
  const stateLinkFailed = state?.stateLinkFailed === true

  const subtitle = [bookTitle, dateStr, ageGroup].filter(Boolean).join(' ・ ')

  return (
    <div className="min-h-screen bg-[#F4F6F2] flex flex-col">

      {/* ── 完了ヒーロー ── */}
      <div className="bg-green-700 px-5 pt-14 pb-7 flex flex-col items-center gap-3 flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-green-300/40 flex items-center justify-center">
          <Check size={26} className="text-green-900" strokeWidth={3} />
        </div>
        <p className="text-white text-lg font-medium">記録しました</p>
        {subtitle && <p className="text-[#A8D4B4] text-xs text-center">{subtitle}</p>}
      </div>

      {/* ── AIサマリーカード（プレースホルダー） ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-4 flex flex-col gap-3">
        {stateLinkFailed && (
          <div className="bg-[#FDF6E7] border border-[#EAD9B8] rounded-2xl px-4 py-3 flex gap-2.5">
            <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#5F5E5A] leading-relaxed">
              記録は保存されました。ただし、選んだときの子どもの姿を残せませんでした。
            </p>
          </div>
        )}
        <div className="bg-white border border-[#DCE4D9] rounded-2xl overflow-hidden">
          <div className="bg-[#EAF5EC] px-4 py-3 flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-green-700 flex items-center justify-center flex-shrink-0">
              <Sparkles size={13} className="text-green-200" />
            </div>
            <p className="text-xs font-medium text-green-900 flex-1">AIからの保育レポート</p>
            <p className="text-[11px] text-[#5F5E5A]">準備中</p>
          </div>
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-[#8A8A85] leading-relaxed">
              記録が保存されました。<br />
              AIレポートの生成は今後対応予定です。
            </p>
          </div>
        </div>
      </div>

      {/* ── ボタン ── */}
      <div className="px-4 pt-3 pb-8 bg-white border-t border-[#E0E8DC] flex flex-col gap-2 flex-shrink-0">
        <div className="flex gap-2">
          <button onClick={() => navigate('/record')}
            className="flex-1 border border-[#C8C6C0] text-[#5F5E5A] rounded-xl py-2.5 text-xs
                       hover:bg-gray-50 active:bg-gray-100 transition-colors">
            もう1件記録する
          </button>
          <button onClick={() => navigate('/')}
            className="flex-1 border border-[#C8C6C0] text-[#5F5E5A] rounded-xl py-2.5 text-xs
                       hover:bg-gray-50 active:bg-gray-100 transition-colors">
            ホームへ戻る
          </button>
        </div>
        <button onClick={() => navigate('/records')}
          className="w-full bg-green-700 hover:bg-green-800 text-white rounded-xl py-3.5 text-sm font-medium
                     flex items-center justify-center gap-2 transition-colors mt-1">
          記録一覧を見る
        </button>
      </div>
    </div>
  )
}
