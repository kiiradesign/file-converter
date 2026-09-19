import { Handle, Position, useViewport, type NodeProps } from '@xyflow/react'
import { Plus } from 'lucide-react'
import { memo, useState } from 'react'
import { useCanvasStore, type FolderNodeData } from '../../store/canvasStore'

/** Classic macOS Finder-style folder: bright sky blue body + lighter tab. */
function FolderGlyph({ gradId }: { gradId: string }) {
  const tab = `${gradId}-tab`
  const body = `${gradId}-body`
  const face = `${gradId}-face`
  return (
    <svg className="folder-node__glyph" viewBox="0 0 88 72" aria-hidden>
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#64D2FF" />
          <stop offset="55%" stopColor="#5AC8FA" />
          <stop offset="100%" stopColor="#0A84FF" />
        </linearGradient>
        <linearGradient id={tab} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DDEFF" />
          <stop offset="100%" stopColor="#5AC8FA" />
        </linearGradient>
        <linearGradient id={face} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5AC8FA" />
          <stop offset="100%" stopColor="#007AFF" />
        </linearGradient>
      </defs>
      <path
        d="M10 20c0-3.3 2.7-6 6-6h16.5l7 7H72c3.3 0 6 2.7 6 6v2H10v-9z"
        fill={`url(#${tab})`}
      />
      <path
        d="M8 28c0-2.2 1.8-4 4-4h64c2.2 0 4 1.8 4 4v30c0 3.3-2.7 6-6 6H14c-3.3 0-6-2.7-6-6V28z"
        fill={`url(#${body})`}
      />
      <path
        d="M8 34h72v24c0 3.3-2.7 6-6 6H14c-3.3 0-6-2.7-6-6V34z"
        fill={`url(#${face})`}
        opacity="0.92"
      />
      <path
        d="M10 34h68c0 0-2 3-34 3S10 34 10 34z"
        fill="#FFFFFF"
        opacity="0.18"
      />
    </svg>
  )
}

function FolderNodeComponent({ id, data }: NodeProps & { data: FolderNodeData }) {
  const { zoom } = useViewport()
  const enterFolder = useCanvasStore((s) => s.enterFolder)
  const startConnect = useCanvasStore((s) => s.startConnect)
  const saveNode = useCanvasStore((s) => s.saveNode)
  const draftOpen = useCanvasStore((s) => s.draft != null)
  const [hovered, setHovered] = useState(false)
  const counter = 1 / Math.max(zoom, 0.01)
  const showHoverChrome = hovered && !draftOpen

  return (
    <div
      className={`folder-node${showHoverChrome ? ' is-hovered' : ''}`}
      onMouseEnter={() => {
        if (!draftOpen) setHovered(true)
      }}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (draftOpen) return
        enterFolder(data.folderId)
      }}
      onClick={(e) => {
        if (draftOpen) return
        if ((e.target as HTMLElement).closest('.folder-node__plus')) return
        enterFolder(data.folderId)
      }}
    >
      <FolderGlyph gradId={`fg-${id}`} />
      <div className="folder-node__label" style={{ transform: `scale(${counter})` }}>
        {data.label}
      </div>

      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />

      {!draftOpen && (
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
      )}

      {data.isResult && !draftOpen && (
        <div
          className="file-node__toolbar"
          style={{
            opacity: showHoverChrome ? 1 : 0,
            pointerEvents: showHoverChrome ? 'auto' : 'none',
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
