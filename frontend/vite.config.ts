import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/mednav-voice': {
        target: process.env.MEDNAV_VOICE_URL ?? 'http://127.0.0.1:8002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mednav-voice/, '/api/v1/voice'),
      },
      '/piper': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/piper/, ''),
      },
      '/api': {
        target: process.env.MEDNAV_API_URL ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
