import { Handle, Position, useViewport, type NodeProps } from '@xyflow/react'
import { ChevronDown, Download, Image as ImageIcon, Pencil, Plus } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'
import { useCanvasStore, type FileNodeData } from '../../store/canvasStore'
import { PixelationPreview } from '../PixelationPreview'

const FALLBACK_W = 168
const FALLBACK_H = 210
const MAX_EDGE = 240
const MIN_EDGE = 96

/** Size the preview card to the image aspect; non-images keep a default portrait. */
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
    w = Math.min(MAX_EDGE, Math.max(MIN_EDGE, FALLBACK_W))
    h = Math.round(w / aspect)
    if (h < MIN_EDGE) {
      h = MIN_EDGE
      w = Math.round(h * aspect)
    }
  } else {
    h = Math.min(MAX_EDGE, Math.max(MIN_EDGE, FALLBACK_H))
    w = Math.round(h * aspect)
    if (w < MIN_EDGE) {
      w = MIN_EDGE
      h = Math.round(w / aspect)
    }
  }
  if (w > MAX_EDGE) {
    w = MAX_EDGE
    h = Math.round(w / aspect)
  }
  if (h > MAX_EDGE) {
    h = MAX_EDGE
    w = Math.round(h * aspect)
  }
  return {
    width: Math.max(MIN_EDGE, Math.round(w)),
    height: Math.max(MIN_EDGE, Math.round(h)),
  }
}

function FileNodeComponent({ id, data }: NodeProps & { data: FileNodeData }) {
  const { zoom } = useViewport()
  const file = useCanvasStore((s) => s.files[data.fileId])
  const startConnect = useCanvasStore((s) => s.startConnect)
  const startAdjust = useCanvasStore((s) => s.startAdjust)
  const saveNode = useCanvasStore((s) => s.saveNode)
  const [hovered, setHovered] = useState(false)

  const counter = 1 / Math.max(zoom, 0.01)
  const running = data.jobStatus === 'running'
  const src = file?.objectUrl || null

  const card = useMemo(
    () => previewCardSize(file?.width, file?.height),
    [file?.width, file?.height],
  )
  // Reserve space above the card for the counter-scaled toolbar + hover bridge.
  const toolbarSpace = Math.ceil(72 * Math.min(counter, 2.5))

  const onPlus = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      startConnect(id, { x: 0, y: 0 })
    },
    [id, startConnect],
  )

  const stopDrag = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div
      className={`file-node${hovered ? ' is-hovered' : ''}`}
      style={{ width: card.width, paddingTop: toolbarSpace }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="file-node__toolbar-bridge nodrag nopan"
        style={{ transform: `translateX(-50%) scale(${counter})` }}
        onMouseEnter={() => setHovered(true)}
        onPointerDown={stopDrag}
      >
        <div className="file-node__toolbar">
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
            <Pencil size={14} strokeWidth={1.75} />
            Adjust
            <ChevronDown size={14} strokeWidth={1.75} />
          </button>
          <span className="divider" aria-hidden />
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
        </div>
      </div>

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
          />
        </div>
        <Handle type="target" position={Position.Left} id="in" />
        <Handle type="source" position={Position.Right} id="out" />
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
