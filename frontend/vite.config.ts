import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 6666,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:6667',
      '/uploads': 'http://localhost:6667',
    },
  },
})
