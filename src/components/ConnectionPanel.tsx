import { DialRoot, useDialKit } from 'dialkit'
import { useStore, useViewport, type Node } from '@xyflow/react'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
const PANEL_MARGIN = 16
/** Breath between node right edge and panel left. */
const PANEL_NODE_GAP = 10

/**
 * Panel top = node top; panel left = node right + gap.
 * Uses DOM rects so Y matches the painted node (any aspect), not a guessed
 * mid-height offset. Coordinates are relative to `originEl` (app-shell).
 */
function panelPositionFromNodeEl(
  nodeEl: Element,
  originEl: Element,
): { left: number; top: number } {
  const nodeRect = nodeEl.getBoundingClientRect()
  const originRect = originEl.getBoundingClientRect()
  const left = nodeRect.right - originRect.left + PANEL_NODE_GAP
  const top = nodeRect.top - originRect.top
  const maxLeft = Math.max(PANEL_MARGIN, originRect.width - PANEL_W - PANEL_MARGIN)
  return {
    // Keep top locked to the node — only clamp horizontally so the panel
    // stays on-screen without drifting its Y relative to the node.
    left: Math.min(Math.max(PANEL_MARGIN, left), maxLeft),
    top,
  }
}

export function ConnectionPanel() {
  const viewport = useViewport()
  const draft = useCanvasStore((s) => s.draft)
  const files = useCanvasStore((s) => s.files)
  const updateDraftSettings = useCanvasStore((s) => s.updateDraftSettings)
  const confirmDraft = useCanvasStore((s) => s.confirmDraft)
  const cancelDraft = useCanvasStore((s) => s.cancelDraft)
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 24, top: 96 })

  // Live RF node (position + measured) so pan/zoom/drag stay in sync.
  const source = useStore((s) => {
    if (!draft?.sourceNodeId) return null
    const n =
      s.nodeLookup.get(draft.sourceNodeId) ??
      s.nodes.find((node) => node.id === draft.sourceNodeId)
    return (n as AppNode | undefined) ?? null
  })

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

  // Recompute from the painted node box on every viewport / geometry change.
  useLayoutEffect(() => {
    if (!draft?.sourceNodeId || !source) return

    const update = () => {
      const nodeEl = document.querySelector(
        `.react-flow__node[data-id="${draft.sourceNodeId}"]`,
      )
      const originEl =
        panelRef.current?.offsetParent instanceof Element
          ? panelRef.current.offsetParent
          : document.querySelector('.app-shell')
      if (!nodeEl || !originEl) return
      setPosition(panelPositionFromNodeEl(nodeEl, originEl))
    }

    update()
    // One more frame after measure/layout settles (aspect-varying file cards).
    const raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [
    draft?.sourceNodeId,
    source,
    source?.position.x,
    source?.position.y,
    (source as Node | null)?.measured?.width,
    (source as Node | null)?.measured?.height,
    viewport.x,
    viewport.y,
    viewport.zoom,
  ])

  if (!draft || !source) return null

  const estimated =
    source.data.kind === 'file'
      ? estimateSize(files[source.data.fileId]?.size ?? 0, draft.settings)
      : null

  const dialKey = `${draft.sourceNodeId}-${draft.mode}-${draft.settings.format}`

  return (
    <div
      ref={panelRef}
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
                ? `Compress ${formatLabel(draft.settings.format)}`
                : `Convert to ${formatLabel(draft.settings.format)}`}
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
              {draft.mode === 'adjust' ? 'Compress' : 'Convert'}
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
    settings.format === 'png'
      ? 0.9
      : settings.format === 'jpg'
        ? 0.35
        : settings.format === 'webp'
          ? 0.28
          : settings.format === 'avif'
            ? 0.2
            : settings.format === 'gif'
              ? 0.45
              : settings.format === 'bmp'
                ? 1.1
                : settings.format === 'pdf'
                  ? 0.95
                  : 0.3
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
