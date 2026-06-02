import { NavLink } from 'react-router-dom'
import { Home, Library, PenLine, Sparkles, User } from 'lucide-react'

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors
         ${isActive ? 'text-green-600 font-medium' : 'text-gray-400 hover:text-green-500'}`
      }
    >
      <Icon size={21} strokeWidth={1.8} />
      <span>{label}</span>
    </NavLink>
  )
}

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E0E8DC]">
      <div className="max-w-lg mx-auto flex items-end h-14">

        <NavItem to="/"          icon={Home}     label="ホーム" />
        <NavItem to="/bookshelf" icon={Library}  label="本棚" />

        {/* 記録 — 中央FAB（アイコン＋テキスト） */}
        <div className="flex-1 relative flex justify-center h-full">
          <NavLink
            to="/record"
            className={({ isActive }) =>
              `absolute -top-5 w-16 h-16 rounded-full flex flex-col items-center justify-center gap-0.5
               shadow-xl shadow-green-300/40 active:scale-95 transition-all
               ${isActive ? 'bg-green-700' : 'bg-green-600'}`
            }
          >
            <PenLine size={20} className="text-white" strokeWidth={2.5} />
            <span className="text-[10px] text-white font-bold tracking-wide leading-none">記録</span>
          </NavLink>
        </div>

        <NavItem to="/report" icon={Sparkles} label="AIレポート" />
        <NavItem to="/mypage" icon={User}     label="マイページ" />
      </div>
    </nav>
  )
}
