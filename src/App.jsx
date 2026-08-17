import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import RecordInput from './pages/RecordInput'
import RecordComplete from './pages/RecordComplete'
import AIReport from './pages/AIReport'
import RecordList from './pages/RecordList'
import CalendarPage from './pages/CalendarPage'
import AISearch from './pages/AISearch'
import MyPage from './pages/MyPage'
import Bookshelf from './pages/Bookshelf'

const NO_NAV_PATHS = ['/record', '/record-complete']

function AppContent() {
  const { pathname } = useLocation()
  const showNav = !NO_NAV_PATHS.includes(pathname)

  return (
    <div className="max-w-lg mx-auto min-h-screen relative bg-sage-50">
      <Routes>
        <Route path="/"                element={<Home />} />
        <Route path="/record"          element={<RecordInput />} />
        <Route path="/record-complete" element={<RecordComplete />} />
        <Route path="/report"          element={<AIReport />} />
        <Route path="/records"         element={<RecordList />} />
        <Route path="/calendar"        element={<CalendarPage />} />
        <Route path="/search"          element={<AISearch />} />
        <Route path="/mypage"          element={<MyPage />} />
        <Route path="/bookshelf"       element={<Bookshelf />} />
      </Routes>
      {showNav && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}
