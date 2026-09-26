import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const localBackend = env.VITE_API_BASE_URL || env.VITE_BACKEND_URL || 'http://localhost:3001';
  const remotePlesk = 'https://noah.enginner.et';

  const isLocalTarget = localBackend.includes('localhost') || localBackend.includes('127.0.0.1') || localBackend.includes('0.0.0.0');

  return {
    base: env.VITE_BASE_PATH || './',
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/notflix/api': {
          target: isLocalTarget ? localBackend : remotePlesk,
          changeOrigin: true,
          secure: false,
        },
        '/api': {
          target: isLocalTarget ? localBackend : `${remotePlesk}/notflix`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
})
