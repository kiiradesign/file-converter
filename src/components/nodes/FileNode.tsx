import { Handle, Position, useViewport, type NodeProps } from '@xyflow/react'
import { ChevronDown, Download, Image as ImageIcon, Pencil, Plus } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { useCanvasStore, type FileNodeData } from '../../store/canvasStore'
import { PixelationPreview } from '../PixelationPreview'

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

  const onPlus = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      startConnect(id, { x: 0, y: 0 })
    },
    [id, startConnect],
  )

  return (
    <div
      className={`file-node${hovered ? ' is-hovered' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="file-node__label" style={{ transform: `scale(${counter})` }}>
        <ImageIcon size={14} strokeWidth={1.75} />
        <span>{data.label}</span>
      </div>

      <div className="file-node__card">
        <PixelationPreview
          src={src}
          progress={data.jobProgress ?? (data.jobStatus === 'done' ? 1 : 0)}
          active={running || (data.isResult && (data.jobProgress ?? 0) < 1 && data.jobStatus !== 'error')}
        />
        <Handle type="target" position={Position.Left} id="in" />
        <Handle type="source" position={Position.Right} id="out" />
      </div>

      <button
        type="button"
        className="file-node__plus"
        style={{ transform: `translateY(-50%) scale(${counter})` }}
        aria-label="Start conversion"
        onMouseDown={onPlus}
        onClick={onPlus}
      >
        <Plus size={16} strokeWidth={2.25} />
      </button>

      <div
        className="file-node__toolbar"
        style={{ transform: `translateX(-50%) scale(${counter})` }}
        onMouseEnter={() => setHovered(true)}
      >
        {data.isResult ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                startAdjust(id, { x: 0, y: 0 })
              }}
            >
              <Pencil size={14} strokeWidth={1.75} />
              Adjust
              <ChevronDown size={14} strokeWidth={1.75} />
            </button>
            <span className="divider" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void saveNode(id)
              }}
            >
              <Download size={14} strokeWidth={1.75} />
              Save
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void saveNode(id)
            }}
            aria-label="Save"
          >
            <Download size={14} strokeWidth={1.75} />
            Save
          </button>
        )}
      </div>
    </div>
  )
}

export const FileNode = memo(FileNodeComponent)
