import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/dmc-attendance/',   // GitHub Pages repo name
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
})
