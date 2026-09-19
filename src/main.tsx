import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useCanvasStore } from './store/canvasStore'
import './index.css'

declare global {
  interface Window {
    __FC_STORE__?: typeof useCanvasStore
  }
}

window.__FC_STORE__ = useCanvasStore

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
