import { HelpCircle, Sun, Moon } from 'lucide-react'
import { useState } from 'react'
import { useCanvasStore } from '../store/canvasStore'

export function Chrome() {
  const theme = useCanvasStore((s) => s.theme)
  const toggleTheme = useCanvasStore((s) => s.toggleTheme)
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <>
      <div className="chrome-card chrome-title">
        <h1>File Converter</h1>
        <p>Description about it and how it works in short</p>
      </div>

      <button
        type="button"
        className="chrome-round chrome-theme"
        aria-label="Toggle theme"
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
      </button>

      <button
        type="button"
        className="chrome-round chrome-help"
        aria-label="Help"
        onClick={() => setHelpOpen((v) => !v)}
      >
        <HelpCircle size={18} strokeWidth={1.75} />
      </button>

      {helpOpen && (
        <div className="help-popover">
          <strong>Quick tips</strong>
          <br />
          Double-click the canvas to add files. Drag folders in to batch-convert.
          Hover a file and drag from <strong>+</strong> to convert. Click a folder to
          open it.
        </div>
      )}

      <div className="chrome-card chrome-credit">Made by Keerthi</div>
    </>
  )
}
