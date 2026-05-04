import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/lichess-cloud': {
        target: 'https://lichess.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lichess-cloud/, '/api/cloud-eval'),
      },
    },
  },
})