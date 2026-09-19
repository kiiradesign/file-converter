import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // @jsquash/avif loads WASM via dynamic import; keep it out of pre-bundle.
    exclude: ['@jsquash/avif'],
  },
  worker: {
    format: 'es',
  },
})
