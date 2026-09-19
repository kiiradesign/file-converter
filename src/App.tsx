import { useEffect } from 'react'
import { Breadcrumb } from './components/Breadcrumb'
import { Canvas } from './components/Canvas'
import { Chrome } from './components/Chrome'
import { useCanvasStore } from './store/canvasStore'

export default function App() {
  const theme = useCanvasStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div className="app-shell">
      <Canvas />
      <Chrome />
      <Breadcrumb />
    </div>
  )
}
