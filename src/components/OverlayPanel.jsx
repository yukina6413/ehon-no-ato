import { ChevronLeft } from 'lucide-react'

// 右からスライドするオーバーレイパネル（設定・詳細などで使い回す）
export default function OverlayPanel({ title, isOpen, onClose, footer, children }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-[#F2F5F0] transition-transform duration-300 ease-in-out
                  ${isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}
    >
      {/* ヘッダー */}
      <div
        className="px-4 pt-10 pb-4 flex items-center gap-3 flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #1E6B38, #2E7D46)' }}
      >
        <button onClick={onClose} className="text-[#A8D4B4] p-1">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-white text-[15px] font-bold flex-1">{title}</h2>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {children}
      </div>

      {/* フッター（保存ボタンなど） */}
      {footer && (
        <div className="bg-white border-t border-[#E0E8DC] px-4 pt-3 pb-8 flex-shrink-0 flex flex-col gap-2">
          {footer}
        </div>
      )}
    </div>
  )
}
