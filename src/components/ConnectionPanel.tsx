import { DialRoot, useDialKit } from 'dialkit'
import { useReactFlow, type Node } from '@xyflow/react'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { compatibleTargets, formatLabel, WEB_ENCODE_FORMATS } from '../convert/formats'
import { useCanvasStore, type AppNode } from '../store/canvasStore'
import type { ConvertFormat } from '../types'
import 'dialkit/styles.css'

function DialSliders({ draftKey }: { draftKey: string }) {
  const updateDraftSettings = useCanvasStore((s) => s.updateDraftSettings)
  const draft = useCanvasStore((s) => s.draft)
  const last = useRef({ q: -1, r: -1 })

  // TODO: File size slider (dynamic cap + lock quality/resolution) — stubbed/hidden for now.
  // persist.presets: false — do not store Dialkit version presets.
  const values = useDialKit(
    'Settings',
    {
      Quality: [draft?.settings.quality ?? 100, 1, 100, 1],
      Resolution: [draft?.settings.resolution ?? 100, 10, 100, 1],
    },
    {
      id: `convert-draft-${draftKey}`,
      persist: false,
      defaultCollapsed: false,
    },
  )

  useEffect(() => {
    const q = values.Quality
    const r = values.Resolution
    if (last.current.q === q && last.current.r === r) return
    last.current = { q, r }
    updateDraftSettings({
      quality: q,
      resolution: r,
      maxBytes: null,
    })
  }, [values.Quality, values.Resolution, updateDraftSettings])

  return null
}

const PANEL_W = 280
const PANEL_H_EST = 260
const PANEL_MARGIN = 16

function clampPanelPosition(left: number, top: number) {
  const maxLeft = Math.max(PANEL_MARGIN, window.innerWidth - PANEL_W - PANEL_MARGIN)
  const maxTop = Math.max(PANEL_MARGIN, window.innerHeight - PANEL_H_EST - PANEL_MARGIN)
  return {
    left: Math.min(Math.max(PANEL_MARGIN, left), maxLeft),
    top: Math.min(Math.max(PANEL_MARGIN, top), maxTop),
  }
}

function panelPositionForNode(
  source: AppNode,
  mode: 'connect' | 'adjust',
  flowToScreenPosition: (p: { x: number; y: number }) => { x: number; y: number },
): { left: number; top: number } {
  const measured = (source as Node).measured
  const w = measured?.width ?? (source.data.kind === 'folder' ? 120 : 180)
  const h = measured?.height ?? (source.data.kind === 'folder' ? 120 : 240)

  if (mode === 'adjust') {
    // Near the top-center of the node (Adjust toolbar).
    const screen = flowToScreenPosition({
      x: source.position.x + w / 2,
      y: source.position.y,
    })
    return clampPanelPosition(screen.x - PANEL_W / 2, screen.y + 8)
  }

  // Near the + on the right edge of the card.
  const screen = flowToScreenPosition({
    x: source.position.x + w + 12,
    y: source.position.y + h * 0.45,
  })
  return clampPanelPosition(screen.x + 8, screen.y - 48)
}

export function ConnectionPanel() {
  const { flowToScreenPosition } = useReactFlow()
  const draft = useCanvasStore((s) => s.draft)
  const nodes = useCanvasStore((s) => s.nodes)
  const files = useCanvasStore((s) => s.files)
  const zoom = useCanvasStore((s) => s.zoom)
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

  const [view, setView] = useState<'formats' | 'sliders'>(
    draft?.mode === 'adjust' ? 'sliders' : 'formats',
  )

  useEffect(() => {
    if (!draft) return
    setView(draft.mode === 'adjust' ? 'sliders' : 'formats')
  }, [draft?.sourceNodeId, draft?.mode])

  const position = useMemo(() => {
    if (!draft || !source) return { left: 24, top: 96 }
    return panelPositionForNode(source, draft.mode, flowToScreenPosition)
    // Recompute when viewport zooms/pans (zoom updates on move) or node moves.
  }, [draft, source, flowToScreenPosition, zoom, source?.position.x, source?.position.y])

  if (!draft || !source) return null

  const estimated =
    source.data.kind === 'file'
      ? estimateSize(files[source.data.fileId]?.size ?? 0, draft.settings)
      : null

  const dialKey = `${draft.sourceNodeId}-${draft.mode}-${draft.settings.format}`

  return (
    <div
      className="connection-panel"
      style={{ top: position.top, left: position.left, right: 'auto' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {view === 'formats' ? (
        <>
          <h3>Convert</h3>
          <p className="connection-panel__hint">Choose a format</p>
          <ul className="format-list" role="listbox" aria-label="Target formats">
            {targets.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  className={draft.settings.format === t ? 'is-active' : undefined}
                  role="option"
                  aria-selected={draft.settings.format === t}
                  onClick={() => {
                    updateDraftSettings({ format: t as ConvertFormat })
                    setView('sliders')
                  }}
                >
                  {formatLabel(t)}
                </button>
              </li>
            ))}
          </ul>
          {targets.length === 0 && (
            <p className="connection-panel__hint">No compatible formats for this file.</p>
          )}
          <div className="actions">
            <button type="button" onClick={cancelDraft}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="connection-panel__header">
            {draft.mode === 'connect' && (
              <button
                type="button"
                className="connection-panel__back"
                aria-label="Back to formats"
                onClick={() => setView('formats')}
              >
                <ArrowLeft size={16} strokeWidth={2} />
              </button>
            )}
            <h3>
              {draft.mode === 'adjust'
                ? 'Adjust'
                : `Convert · ${formatLabel(draft.settings.format)}`}
            </h3>
          </div>

          <div className="dial-host dial-host--no-versions">
            <DialRoot mode="inline" theme="dark" productionEnabled defaultOpen />
            <DialSliders draftKey={dialKey} />
          </div>

          <div className="size-hint">
            {estimated != null
              ? `Est. output ~ ${formatBytes(estimated)}`
              : 'Batch folder conversion'}
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
              Convert
            </button>
          </div>
        </>
      )}
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
