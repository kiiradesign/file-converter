import { Slider } from 'dialkit'
import { useStore, useViewport, type Node } from '@xyflow/react'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { compatibleTargets, formatLabel, WEB_ENCODE_FORMATS } from '../convert/formats'
import { useCanvasStore, type AppNode } from '../store/canvasStore'
import type { ConvertFormat } from '../types'
import 'dialkit/styles.css'

/** Both sliders share 1–100 so equal values land at the same fill position. */
const SLIDER_MIN = 1
const SLIDER_MAX = 100
const SLIDER_STEP = 1

function ConvertSliders() {
  const theme = useCanvasStore((s) => s.theme)
  const draft = useCanvasStore((s) => s.draft)
  const updateDraftSettings = useCanvasStore((s) => s.updateDraftSettings)

  if (!draft) return null

  // TODO: File size slider (dynamic cap + lock quality/resolution) — stubbed/hidden for now.
  return (
    <div className="dialkit-root dial-host" data-theme={theme}>
      <Slider
        label="Quality"
        value={draft.settings.quality}
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={SLIDER_STEP}
        onChange={(quality) =>
          updateDraftSettings({ quality, maxBytes: null })
        }
      />
      <Slider
        label="Resolution"
        value={draft.settings.resolution}
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={SLIDER_STEP}
        onChange={(resolution) =>
          updateDraftSettings({ resolution, maxBytes: null })
        }
      />
    </div>
  )
}

const PANEL_W = 280
const PANEL_MARGIN = 16
/** Breath between node right edge and panel left. */
const PANEL_NODE_GAP = 10

/**
 * Visible “node body” the user reads as the node — not the RF wrapper that
 * reserves empty space above for the hover toolbar.
 */
function visibleNodeBodyEl(rfNodeEl: Element): Element {
  return (
    rfNodeEl.querySelector('.file-node__card') ??
    rfNodeEl.querySelector('.folder-node__glyph-wrap') ??
    rfNodeEl.querySelector('.folder-node__glyph') ??
    rfNodeEl.querySelector('.folder-node') ??
    rfNodeEl
  )
}

/**
 * Panel top = painted card/glyph top; panel left = body right + gap.
 * Coordinates are relative to `originEl` (app-shell / offsetParent).
 */
function panelPositionFromBodyEl(
  bodyEl: Element,
  originEl: Element,
): { left: number; top: number } {
  const bodyRect = bodyEl.getBoundingClientRect()
  const originRect = originEl.getBoundingClientRect()
  const left = bodyRect.right - originRect.left + PANEL_NODE_GAP
  const top = bodyRect.top - originRect.top
  const maxLeft = Math.max(PANEL_MARGIN, originRect.width - PANEL_W - PANEL_MARGIN)
  return {
    // Keep top locked to the body — only clamp horizontally.
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

  // Recompute from the painted card/glyph on every viewport / geometry change.
  useLayoutEffect(() => {
    if (!draft?.sourceNodeId || !source) return

    const update = () => {
      const rfNodeEl = document.querySelector(
        `.react-flow__node[data-id="${draft.sourceNodeId}"]`,
      )
      const originEl =
        panelRef.current?.offsetParent instanceof Element
          ? panelRef.current.offsetParent
          : document.querySelector('.app-shell')
      if (!rfNodeEl || !originEl) return
      const bodyEl = visibleNodeBodyEl(rfNodeEl)
      setPosition(panelPositionFromBodyEl(bodyEl, originEl))
    }

    update()
    // After layout/measure (aspect-varying cards) and one more paint.
    const raf1 = requestAnimationFrame(() => {
      update()
      requestAnimationFrame(update)
    })
    return () => cancelAnimationFrame(raf1)
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

          <ConvertSliders />

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
