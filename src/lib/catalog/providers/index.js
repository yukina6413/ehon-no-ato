// ============================================================
// 既定の外部書誌プロバイダの登録
// ============================================================
// アプリ起動時に1回だけ呼ぶ（src/main.jsx）。
// テストは必要なプロバイダを自分で登録するため、ここは読み込まれない。
// ============================================================

import { registerCatalogProvider } from '../catalogService'
import { openBdProvider } from './openbd'

let registered = false

export function registerDefaultProviders() {
  if (registered) return
  registerCatalogProvider(openBdProvider)
  registered = true
}
