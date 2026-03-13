import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// PWA plugin removed - using banner notifications instead

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // VitePWA removed - no longer using push notifications
  ],
  server: {
    port: 5173,
    host: true,
  },
})
