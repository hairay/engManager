import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const port = Number(process.env.PORT) || 443;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  base: './', // Use relative paths for Electron file:// protocol compatibility
  server: {
    port, // 標準 HTTPS 加密 Port (可透過 PORT 環境變數自訂)
    host: true, // 支援區域網路所有裝置直接透過 HTTPS 安全連線
  },
  preview: {
    port,
    host: true,
  },
})
