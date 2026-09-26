import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  plugins: [react()],
  server: {
    proxy: {
      '/notflix/api': {
        target: 'https://noah.enginner.et',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'https://noah.enginner.et/notflix',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
