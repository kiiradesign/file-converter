import { Handle, Position, useViewport, type NodeProps } from '@xyflow/react'
import { Download, Image as ImageIcon, Minimize2, Plus } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'
import { useCanvasStore, type FileNodeData } from '../../store/canvasStore'
import { PixelationPreview } from '../PixelationPreview'

const FALLBACK_W = 168
const FALLBACK_H = 210
/** Longest edge of the preview card in flow px. */
const MAX_EDGE = 240
/** Prefer at least this on the long edge when the photo is tiny. */
const MIN_LONG_EDGE = 96

/**
 * Size the preview card to the photo’s aspect ratio.
 * Fits inside a MAX_EDGE square without distorting or forcing a min on the short edge.
 */
export function previewCardSize(
  width?: number,
  height?: number,
): { width: number; height: number } {
  if (!width || !height || width <= 0 || height <= 0) {
    return { width: FALLBACK_W, height: FALLBACK_H }
  }
  const aspect = width / height
  let w: number
  let h: number
  if (aspect >= 1) {
    w = MAX_EDGE
    h = w / aspect
  } else {
    h = MAX_EDGE
    w = h * aspect
  }
  const long = Math.max(w, h)
  if (long < MIN_LONG_EDGE) {
    const s = MIN_LONG_EDGE / long
    w *= s
    h *= s
  }
  return {
    width: Math.max(1, Math.round(w)),
    height: Math.max(1, Math.round(h)),
  }
}

function FileNodeComponent({ id, data }: NodeProps & { data: FileNodeData }) {
  const { zoom } = useViewport()
  const file = useCanvasStore((s) => s.files[data.fileId])
  const draftOpen = useCanvasStore((s) => s.draft != null)
  const startConnect = useCanvasStore((s) => s.startConnect)
  const startAdjust = useCanvasStore((s) => s.startAdjust)
  const saveNode = useCanvasStore((s) => s.saveNode)
  const setFileDimensions = useCanvasStore((s) => s.setFileDimensions)
  const [hovered, setHovered] = useState(false)

  const counter = 1 / Math.max(zoom, 0.01)
  const running = data.jobStatus === 'running'
  const src = file?.previewUrl || file?.objectUrl || null
  const showHoverChrome = hovered && !draftOpen
  const showSave = data.isResult

  const card = useMemo(
    () => previewCardSize(file?.width, file?.height),
    [file?.width, file?.height],
  )
  // ~36–40px toolbar + ~10–12px breath above the card (bridge padding is hit-area only).
  const toolbarSpace = Math.ceil(52 * Math.min(counter, 2.5))

  const onNaturalSize = useCallback(
    (w: number, h: number) => {
      if (!file) return
      // Keep HEIC intrinsic size from ingest; preview JPEG may be downscaled.
      if (file.width && file.height) return
      setFileDimensions(file.id, w, h)
    },
    [file, setFileDimensions],
  )
  const onPlus = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (draftOpen) return
      startConnect(id, { x: 0, y: 0 })
    },
    [id, startConnect, draftOpen],
  )

  const stopDrag = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div
      className={`file-node${showHoverChrome ? ' is-hovered' : ''}`}
      style={{ width: card.width, paddingTop: toolbarSpace }}
      onMouseEnter={() => {
        if (!draftOpen) setHovered(true)
      }}
      onMouseLeave={() => setHovered(false)}
    >
      {!draftOpen && (
        <div
          className="file-node__toolbar-bridge nodrag nopan"
          style={{ transform: `translateX(-50%) scale(${counter})` }}
          onMouseEnter={() => setHovered(true)}
          onPointerDown={stopDrag}
        >
          <div className="file-node__toolbar">
            {showSave && (
              <>
                <button
                  type="button"
                  className="nodrag nopan"
                  onPointerDown={stopDrag}
                  onMouseDown={stopDrag}
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    void saveNode(id)
                  }}
                >
                  <Download size={14} strokeWidth={1.75} />
                  Save
                </button>
                <span className="divider" aria-hidden />
              </>
            )}
            <button
              type="button"
              className="nodrag nopan"
              onPointerDown={stopDrag}
              onMouseDown={stopDrag}
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                startAdjust(id, { x: 0, y: 0 })
              }}
            >
              <Minimize2 size={14} strokeWidth={1.75} />
              Compress
            </button>
          </div>
        </div>
      )}

      <div
        className="file-node__card"
        style={{ width: card.width, height: card.height }}
      >
        <div className="file-node__card-media">
          <PixelationPreview
            src={src}
            width={card.width}
            height={card.height}
            mimeType={file?.mimeType}
            progress={data.jobProgress ?? (data.jobStatus === 'done' ? 1 : 0)}
            active={
              running ||
              (data.isResult &&
                (data.jobProgress ?? 0) < 1 &&
                data.jobStatus !== 'error')
            }
            onNaturalSize={onNaturalSize}
          />
        </div>
        <Handle type="target" position={Position.Left} id="in" />
        <Handle type="source" position={Position.Right} id="out" />
        {!draftOpen && (
          <button
            type="button"
            className="file-node__plus nodrag nopan"
            style={{ transform: `translateY(-50%) scale(${counter})` }}
            aria-label="Start conversion"
            onMouseDown={onPlus}
            onClick={onPlus}
            onPointerDown={stopDrag}
          >
            <Plus size={16} strokeWidth={2.25} />
          </button>
        )}
      </div>

      <div
        className="file-node__label"
        style={{ transform: `scale(${counter})` }}
      >
        <ImageIcon size={14} strokeWidth={1.75} />
        <span>{data.label}</span>
      </div>
    </div>
  )
}

export const FileNode = memo(FileNodeComponent)
