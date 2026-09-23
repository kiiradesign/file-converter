import { Handle, Position, useViewport, type NodeProps } from '@xyflow/react'
import { Plus } from 'lucide-react'
import { memo, useState } from 'react'
import { useCanvasStore, type FolderNodeData } from '../../store/canvasStore'

/** Display size for the macOS folder PNG (source 1004×854). */
const ICON_W = 96
const ICON_H = Math.round((ICON_W * 854) / 1004)

function FolderNodeComponent({ id, data }: NodeProps & { data: FolderNodeData }) {
  const { zoom } = useViewport()
  const enterFolder = useCanvasStore((s) => s.enterFolder)
  const startConnect = useCanvasStore((s) => s.startConnect)
  const saveNode = useCanvasStore((s) => s.saveNode)
  const draftOpen = useCanvasStore((s) => s.draft != null)
  const [hovered, setHovered] = useState(false)
  const counter = 1 / Math.max(zoom, 0.01)
  const showHoverChrome = hovered && !draftOpen
  /** Vertical mid of the icon — where edges should meet. */
  const iconMidY = ICON_H / 2

  return (
    <div
      className={`folder-node${showHoverChrome ? ' is-hovered' : ''}`}
      style={{ width: ICON_W }}
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
        if ((e.target as HTMLElement).closest('.folder-node__toolbar')) return
        enterFolder(data.folderId)
      }}
    >
      <div className="folder-node__glyph-wrap" style={{ width: ICON_W, height: ICON_H }}>
        <img
          className="folder-node__glyph"
          src="/folder-icon.png"
          alt=""
          width={ICON_W}
          height={ICON_H}
          draggable={false}
          decoding="async"
        />

        {/* Handles sit on the icon’s left/right edges at vertical mid — not the label box. */}
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="folder-node__handle"
          style={{ top: iconMidY, left: 0 }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          className="folder-node__handle"
          style={{ top: iconMidY, right: 0, left: 'auto' }}
        />

        {!draftOpen && (
          <button
            type="button"
            className="folder-node__plus"
            style={{
              top: iconMidY,
              transform: `translateY(-50%) scale(${counter})`,
            }}
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
      </div>

      <div
        className="folder-node__label"
        style={{ transform: `scale(${counter})` }}
      >
        {data.label}
      </div>

      {data.isResult && !draftOpen && (
        <div
          className={`folder-node__toolbar${showHoverChrome ? ' is-visible' : ''}`}
          style={{
            transform: `translate(-50%, calc(-100% - 8px)) scale(${counter})`,
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
