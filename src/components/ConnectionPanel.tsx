import { DialRoot, useDialKit } from 'dialkit'
import { useEffect, useRef } from 'react'
import { compatibleTargets, WEB_ENCODE_FORMATS } from '../convert/formats'
import { useCanvasStore } from '../store/canvasStore'
import type { ConvertFormat } from '../types'
import 'dialkit/styles.css'

function DialSliders() {
  const updateDraftSettings = useCanvasStore((s) => s.updateDraftSettings)
  const draft = useCanvasStore((s) => s.draft)
  const last = useRef({ q: -1, r: -1, b: -1 })

  const values = useDialKit(
    'Convert',
    {
      Quality: [draft?.settings.quality ?? 80, 1, 100, 1],
      Resolution: [draft?.settings.resolution ?? 100, 10, 100, 1],
      'File size (KB)': [
        draft?.settings.maxBytes ? Math.round(draft.settings.maxBytes / 1024) : 0,
        0,
        5000,
        10,
      ],
    },
    { id: 'convert-draft', persist: false, defaultCollapsed: false },
  )

  useEffect(() => {
    const q = values.Quality
    const r = values.Resolution
    const kb = values['File size (KB)']
    if (last.current.q === q && last.current.r === r && last.current.b === kb) return
    last.current = { q, r, b: kb }
    updateDraftSettings({
      quality: q,
      resolution: r,
      maxBytes: kb > 0 ? kb * 1024 : null,
    })
  }, [values.Quality, values.Resolution, values['File size (KB)'], updateDraftSettings])

  return null
}

export function ConnectionPanel() {
  const draft = useCanvasStore((s) => s.draft)
  const nodes = useCanvasStore((s) => s.nodes)
  const files = useCanvasStore((s) => s.files)
  const updateDraftSettings = useCanvasStore((s) => s.updateDraftSettings)
  const confirmDraft = useCanvasStore((s) => s.confirmDraft)
  const cancelDraft = useCanvasStore((s) => s.cancelDraft)

  const source = draft ? nodes.find((n) => n.id === draft.sourceNodeId) : null

  const targets = (() => {
    if (!source) return WEB_ENCODE_FORMATS
    if (source.data.kind === 'file') {
      const file = files[source.data.fileId]
      return compatibleTargets(file?.extension ?? 'png', WEB_ENCODE_FORMATS)
    }
    return WEB_ENCODE_FORMATS
  })()

  if (!draft || !source) return null

  const estimated =
    source.data.kind === 'file'
      ? estimateSize(files[source.data.fileId]?.size ?? 0, draft.settings)
      : null

  return (
    <div
      className="connection-panel"
      style={{ top: 96, right: 24 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <h3>{draft.mode === 'adjust' ? 'Adjust conversion' : 'Convert'}</h3>

      <label htmlFor="fc-format">Format</label>
      <select
        id="fc-format"
        value={draft.settings.format}
        onChange={(e) =>
          updateDraftSettings({ format: e.target.value as ConvertFormat })
        }
      >
        {targets.map((t) => (
          <option key={t} value={t}>
            {t.toUpperCase()}
          </option>
        ))}
      </select>

      <div className="dial-host">
        <DialRoot mode="inline" theme="dark" productionEnabled defaultOpen />
        <DialSliders />
      </div>

      <div className="size-hint">
        {estimated != null
          ? `Est. output ~ ${formatBytes(estimated)}`
          : 'Batch folder conversion'}
        {draft.settings.maxBytes
          ? ` · cap ${formatBytes(draft.settings.maxBytes)}`
          : ''}
      </div>

      <div className="actions">
        <button type="button" onClick={cancelDraft}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => void confirmDraft()}
        >
          {draft.mode === 'adjust' ? 'Create new' : 'Convert'}
        </button>
      </div>
    </div>
  )
}

function estimateSize(
  sourceBytes: number,
  settings: { quality: number; resolution: number; format: string },
) {
  if (!sourceBytes) return 0
  const scale = (settings.resolution / 100) ** 2
  const q = settings.quality / 100
  const formatFactor =
    settings.format === 'png' ? 0.9 : settings.format === 'jpg' ? 0.35 : 0.28
  return Math.max(
    1024,
    Math.round(sourceBytes * scale * (0.25 + q * 0.75) * formatFactor),
  )
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}
