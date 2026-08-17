import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // 0.0.0.0 で全ネットワークに公開
    port: 5173,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
    // .env.local の VITE_DATA_SOURCE=supabase に関係なく、
    // テストは常にmockモード（ネットワーク・実DBに依存しない）で実行する
    env: {
      VITE_DATA_SOURCE: 'mock',
    },
  },
})
