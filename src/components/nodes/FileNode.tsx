import { Handle, Position, useViewport, type NodeProps } from '@xyflow/react'
import { Download, Minimize2, Plus } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'
import { useCanvasStore, type FileNodeData } from '../../store/canvasStore'
import { previewCardSize } from '../../lib/previewCardSize'
import { PixelationPreview } from '../PixelationPreview'

function FileNodeComponent({ id, data }: NodeProps & { data: FileNodeData }) {
  const { zoom } = useViewport()
  const file = useCanvasStore((s) => s.files[data.fileId])
  const draftOpen = useCanvasStore((s) => s.draft != null)
  const folderStack = useCanvasStore((s) => s.folderStack)
  const nodes = useCanvasStore((s) => s.nodes)
  const startConnect = useCanvasStore((s) => s.startConnect)
  const startAdjust = useCanvasStore((s) => s.startAdjust)
  const saveNode = useCanvasStore((s) => s.saveNode)
  const setFileDimensions = useCanvasStore((s) => s.setFileDimensions)
  const finishConversionWave = useCanvasStore((s) => s.finishConversionWave)
  const [hovered, setHovered] = useState(false)

  const counter = 1 / Math.max(zoom, 0.01)
  /** Prefer output blob URL when present; during conversion use source preview on placeholder. */
  const previewSrc = file?.previewUrl || file?.objectUrl || null
  const outputSrc = file?.objectUrl || null
  const src = outputSrc || previewSrc
  const showHoverChrome = hovered && !draftOpen

  // Save on result nodes and on files inside a converted result folder.
  const currentFolderId =
    folderStack.length > 0 ? folderStack[folderStack.length - 1] : null
  const insideResultFolder =
    currentFolderId != null &&
    nodes.some(
      (n) =>
        n.data.kind === 'folder' &&
        n.data.folderId === currentFolderId &&
        n.data.isResult,
    )
  const showSave = data.isResult || insideResultFolder

  const card = useMemo(
    () => previewCardSize(file?.width, file?.height),
    [file?.width, file?.height],
  )
  // ~36–40px toolbar + ~10–12px breath above the card (bridge padding is hit-area only).
  const toolbarSpace = Math.ceil(52 * Math.min(counter, 2.5))

  const onNaturalSize = useCallback(
    (w: number, h: number) => {
      if (!file) return
      // Keep HEIC/SVG intrinsic size from ingest; preview may be downscaled.
      if (file.width && file.height) return
      setFileDimensions(file.id, w, h)
    },
    [file, setFileDimensions],
  )
  const onWaveComplete = useCallback(() => {
    finishConversionWave(id)
  }, [finishConversionWave, id])
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
            previewSrc={previewSrc}
            outputSrc={outputSrc}
            width={card.width}
            height={card.height}
            mimeType={file?.mimeType}
            isResult={data.isResult}
            jobStatus={data.jobStatus}
            conversionWavePending={data.conversionWavePending}
            onWaveComplete={onWaveComplete}
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
        {data.label}
      </div>
    </div>
  )
}

export const FileNode = memo(FileNodeComponent)
