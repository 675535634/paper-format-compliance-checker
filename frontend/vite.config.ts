import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const customAllowedHosts = (process.env.DEV_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)

const allowedHosts = Array.from(new Set([
  'localhost',
  '127.0.0.1',
  ...customAllowedHosts,
]))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts,
    port: 16666,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:16667',
      '/uploads': 'http://localhost:16667',
    },
  },
})
