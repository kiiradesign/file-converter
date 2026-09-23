import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // WASM / bundle loaders — keep out of pre-bundle.
    exclude: ['@jsquash/avif', 'libheif-js'],
  },
  worker: {
    format: 'es',
  },
})
