import { Sun, Moon, RefreshCw } from 'lucide-react'
import { useCanvasStore } from '../store/canvasStore'

export function Chrome() {
  const theme = useCanvasStore((s) => s.theme)
  const toggleTheme = useCanvasStore((s) => s.toggleTheme)
  const replayConversionPreviews = useCanvasStore((s) => s.replayConversionPreviews)

  return (
    <>
      <div className="chrome-title">
        <h1>File Converter</h1>
        <p>Convert files on an infinite canvas.</p>
      </div>

      {/* TEMP debug: re-watch conversion preview animations without re-encoding. */}
      <button
        type="button"
        className="chrome-replay"
        aria-label="Replay conversion animations"
        title="Replay animations"
        onClick={replayConversionPreviews}
      >
        <RefreshCw size={18} strokeWidth={1.75} aria-hidden />
      </button>

      <button
        type="button"
        className="chrome-theme"
        aria-label="Toggle theme"
        onClick={toggleTheme}
      >
        <span className={`chrome-theme__icon${theme === 'dark' ? ' is-active' : ''}`} aria-hidden={theme !== 'dark'}>
          <Sun size={18} strokeWidth={1.75} />
        </span>
        <span className={`chrome-theme__icon${theme === 'light' ? ' is-active' : ''}`} aria-hidden={theme !== 'light'}>
          <Moon size={18} strokeWidth={1.75} />
        </span>
      </button>

      <a
        className="chrome-credit"
        href="https://kiira.in/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Made by Keerthi
      </a>
    </>
  )
}
