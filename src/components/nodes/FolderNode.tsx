import { Handle, Position, useViewport, type NodeProps } from '@xyflow/react'
import { Plus } from 'lucide-react'
import { memo, useState } from 'react'
import { useCanvasStore, type FolderNodeData } from '../../store/canvasStore'

function FolderGlyph() {
  return (
    <svg className="folder-node__glyph" viewBox="0 0 88 72" aria-hidden>
      <path
        d="M8 18c0-3.3 2.7-6 6-6h18l8 8h34c3.3 0 6 2.7 6 6v34c0 3.3-2.7 6-6 6H14c-3.3 0-6-2.7-6-6V18z"
        fill="url(#folderGrad)"
      />
      <path
        d="M8 28h72v28c0 3.3-2.7 6-6 6H14c-3.3 0-6-2.7-6-6V28z"
        fill="#4A8FF0"
        opacity="0.55"
      />
      <defs>
        <linearGradient id="folderGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7AB0FF" />
          <stop offset="100%" stopColor="#5B9CFF" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function FolderNodeComponent({ id, data }: NodeProps & { data: FolderNodeData }) {
  const { zoom } = useViewport()
  const enterFolder = useCanvasStore((s) => s.enterFolder)
  const startConnect = useCanvasStore((s) => s.startConnect)
  const saveNode = useCanvasStore((s) => s.saveNode)
  const [hovered, setHovered] = useState(false)
  const counter = 1 / Math.max(zoom, 0.01)

  return (
    <div
      className={`folder-node${hovered ? ' is-hovered' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        enterFolder(data.folderId)
      }}
      onClick={(e) => {
        // Single click enters folder (spec: Click = enter folder)
        if ((e.target as HTMLElement).closest('.folder-node__plus')) return
        enterFolder(data.folderId)
      }}
    >
      <FolderGlyph />
      <div className="folder-node__label" style={{ transform: `scale(${counter})` }}>
        {data.label}
      </div>

      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />

      <button
        type="button"
        className="folder-node__plus"
        style={{ transform: `scale(${counter})` }}
        aria-label="Convert folder"
        onClick={(e) => {
          e.stopPropagation()
          startConnect(id, { x: 0, y: 0 })
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Plus size={16} strokeWidth={2.25} />
      </button>

      {data.isResult && (
        <div
          className="file-node__toolbar"
          style={{
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? 'auto' : 'none',
            bottom: -40,
            transform: `translateX(-50%) scale(${counter})`,
          }}
          onMouseEnter={() => setHovered(true)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void saveNode(id)
            }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  )
}

export const FolderNode = memo(FolderNodeComponent)
