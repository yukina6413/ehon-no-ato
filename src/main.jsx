import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerDefaultProviders } from './lib/catalog/providers'

// 外部書誌プロバイダの登録は起動時に1回だけ行う（検索画面は取得元を知らなくてよい）
registerDefaultProviders()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
