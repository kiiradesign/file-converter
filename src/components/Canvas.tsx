import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type OnMove,
  type OnMoveEnd,
  type XYPosition,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@xyflow/react/dist/style.css'
import { ConversionEdge } from './edges/ConversionEdge'
import { FileNode } from './nodes/FileNode'
import { FolderNode } from './nodes/FolderNode'
import { ConnectionPanel } from './ConnectionPanel'
import { AddChooser } from './AddChooser'
import { previewCardSize } from '../lib/previewCardSize'
import { useCanvasStore } from '../store/canvasStore'

/** Default file card size — used to center empty-state imports on the viewport. */
const DEFAULT_FILE_CARD = previewCardSize()
/** Folder glyph + label (flow px), for centering empty-state folder picks. */
const FOLDER_NODE_CENTER_OFFSET = { w: 96, h: 120 }

const nodeTypes = {
  file: FileNode,
  folder: FolderNode,
}

const edgeTypes = {
  conversion: ConversionEdge,
}

type FloatingAdd = {
  flow: XYPosition
  screen: { left: number; top: number }
}

type DotPattern = { gap: number; size: number }

/** FigJam-style screen density for a given zoom (flow-space gap/size). */
function patternForZoom(zoom: number): DotPattern {
  const z = Math.max(0.2, Math.min(3, zoom))
  const stepped = Math.round(z * 24) / 24
  const screenGap = 28
  const screenSize = 1.5
  return {
    gap: Math.max(10, Math.round(screenGap / stepped)),
    size: Math.min(7, Math.max(0.9, Number((screenSize / stepped).toFixed(2)))),
  }
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

const DOT_IDLE_MS = 120
const DOT_EASE_MS = 240

function CanvasInner() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const folderStack = useCanvasStore((s) => s.folderStack)
  const draft = useCanvasStore((s) => s.draft)
  const onNodesChange = useCanvasStore((s) => s.onNodesChange)
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange)
  const setZoom = useCanvasStore((s) => s.setZoom)
  const addFilesAt = useCanvasStore((s) => s.addFilesAt)
  const addFolderAt = useCanvasStore((s) => s.addFolderAt)
  const handleDrop = useCanvasStore((s) => s.handleDrop)
  const confirmDraft = useCanvasStore((s) => s.confirmDraft)
  const cancelDraft = useCanvasStore((s) => s.cancelDraft)

  const { screenToFlowPosition } = useReactFlow()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  /** Flow position for the in-flight file/folder input pick. */
  const pickPosRef = useRef<XYPosition>({ x: 0, y: 0 })
  /** Recompute viewport center when the picker closes (empty-state ADD TO CANVAS). */
  const pickAtViewportCenterRef = useRef(false)
  /** Floating double-click chooser only (dismissible). Empty-state is separate. */
  const [floatingAdd, setFloatingAdd] = useState<FloatingAdd | null>(null)

  // Dots: freeze gap/size during zoom; ease to new density after idle.
  const [dotPattern, setDotPattern] = useState<DotPattern>(() => patternForZoom(1))
  const dotsRef = useRef(dotPattern)
  const pendingZoomRef = useRef(1)
  const idleTimerRef = useRef<number | null>(null)
  const animRef = useRef<number | null>(null)

  const settleDots = useCallback((targetZoom: number) => {
    const from = dotsRef.current
    const to = patternForZoom(targetZoom)
    if (from.gap === to.gap && from.size === to.size) return

    if (animRef.current != null) cancelAnimationFrame(animRef.current)
    const start = performance.now()
    const startGap = from.gap
    const startSize = from.size

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DOT_EASE_MS)
      const e = easeOutCubic(t)
      const next: DotPattern =
        t >= 1
          ? to
          : {
              gap: startGap + (to.gap - startGap) * e,
              size: Number((startSize + (to.size - startSize) * e).toFixed(3)),
            }
      dotsRef.current = next
      setDotPattern(next)
      if (t < 1) animRef.current = requestAnimationFrame(tick)
      else animRef.current = null
    }
    animRef.current = requestAnimationFrame(tick)
  }, [])

  const scheduleDotSettle = useCallback(
    (z: number) => {
      pendingZoomRef.current = z
      if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null
        settleDots(pendingZoomRef.current)
      }, DOT_IDLE_MS)
    },
    [settleDots],
  )

  useEffect(() => {
    return () => {
      if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current)
      if (animRef.current != null) cancelAnimationFrame(animRef.current)
    }
  }, [])

  const current = folderStack.length ? folderStack[folderStack.length - 1] : null
  const visibleNodes = useMemo(
    () => nodes.filter((n) => n.data.canvasId === current),
    [nodes, current],
  )
  const visibleIds = useMemo(
    () => new Set(visibleNodes.map((n) => n.id)),
    [visibleNodes],
  )
  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [edges, visibleIds],
  )

  const canvasEmpty = visibleNodes.length === 0

  const onMove: OnMove = useCallback(
    (_evt, viewport) => {
      setZoom(viewport.zoom)
      // Keep current gap/size while gesturing; settle after idle.
      scheduleDotSettle(viewport.zoom)
    },
    [setZoom, scheduleDotSettle],
  )

  const onMoveEnd: OnMoveEnd = useCallback(
    (_evt, viewport) => {
      setZoom(viewport.zoom)
      if (idleTimerRef.current != null) {
        window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      settleDots(viewport.zoom)
    },
    [setZoom, settleDots],
  )

  /** Screen center of the React Flow pane → flow coords. */
  const viewportCenterFlow = useCallback((): XYPosition => {
    const pane =
      wrapperRef.current?.querySelector<HTMLElement>('.react-flow') ??
      wrapperRef.current
    if (!pane) {
      return screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
    }
    const rect = pane.getBoundingClientRect()
    return screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }, [screenToFlowPosition])

  const spawnFlowForEmptyStateImport = useCallback(
    (kind: 'file' | 'folder'): XYPosition => {
      const center = viewportCenterFlow()
      if (kind === 'file') {
        return {
          x: center.x - DEFAULT_FILE_CARD.width / 2,
          y: center.y - DEFAULT_FILE_CARD.height / 2,
        }
      }
      return {
        x: center.x - FOLDER_NODE_CENTER_OFFSET.w / 2,
        y: center.y - FOLDER_NODE_CENTER_OFFSET.h / 2,
      }
    },
    [viewportCenterFlow],
  )

  const resolvePickPosition = useCallback(
    (kind: 'file' | 'folder'): XYPosition => {
      if (pickAtViewportCenterRef.current) {
        pickAtViewportCenterRef.current = false
        return spawnFlowForEmptyStateImport(kind)
      }
      return pickPosRef.current
    },
    [spawnFlowForEmptyStateImport],
  )

  /** Click a DOM-resident input in the same user-gesture turn (no await). */
  const openFilesDialog = useCallback((flow: XYPosition) => {
    pickPosRef.current = flow
    fileInputRef.current?.click()
  }, [])

  const openFolderDialog = useCallback((flow: XYPosition) => {
    pickPosRef.current = flow
    folderInputRef.current?.click()
  }, [])

  // Ensure webkitdirectory is set as a property (attribute alone is flaky in React).
  useEffect(() => {
    const input = folderInputRef.current
    if (!input) return
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
    ;(input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true
  }, [])

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest?.('.react-flow__pane')) return
      if (target.closest?.('.react-flow__node') || target.closest?.('.react-flow__edge')) return
      e.preventDefault()
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      if (e.shiftKey || e.altKey) {
        setFloatingAdd(null)
        openFolderDialog(flow)
        return
      }
      const left = Math.min(Math.max(16, e.clientX - 120), window.innerWidth - 260)
      const top = Math.min(Math.max(16, e.clientY - 20), window.innerHeight - 200)
      setFloatingAdd({ flow, screen: { left, top } })
    },
    [screenToFlowPosition, openFolderDialog],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setFloatingAdd(null)
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      await handleDrop(e.dataTransfer, pos)
    },
    [screenToFlowPosition, handleDrop],
  )

  const onFilesSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(e.target.files ?? [])
      e.target.value = ''
      if (!list.length) {
        pickAtViewportCenterRef.current = false
        return
      }
      void addFilesAt(list, resolvePickPosition('file'))
    },
    [addFilesAt, resolvePickPosition],
  )

  const onFolderSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(e.target.files ?? [])
      e.target.value = ''
      if (!list.length) {
        pickAtViewportCenterRef.current = false
        return
      }
      const files = list.map((file) => ({
        file,
        relativePath:
          (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      }))
      const top = files[0].relativePath.split('/').filter(Boolean)[0] || 'Folder'
      void addFolderAt(top, files, resolvePickPosition('folder'))
    },
    [addFolderAt, resolvePickPosition],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFloatingAdd(null)
        cancelDraft()
      }
      if (e.key === 'Enter' && draft && (e.metaKey || e.ctrlKey)) {
        void confirmDraft()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft, cancelDraft, confirmDraft])

  /**
   * While the convert/compress panel is open, any pointerdown on the canvas
   * (pane, nodes, edges) cancels the draft — same as Cancel. The panel lives
   * outside `.react-flow`, so its controls are unaffected. Listener attaches
   * after open, so the Plus/Compress gesture that created the draft is ignored.
   */
  useEffect(() => {
    if (!draft) return
    const flow = wrapperRef.current?.querySelector('.react-flow')
    if (!flow) return
    const onPointerDown = () => {
      cancelDraft()
    }
    flow.addEventListener('pointerdown', onPointerDown)
    return () => flow.removeEventListener('pointerdown', onPointerDown)
  }, [draft, cancelDraft])

  const onPaneClick = useCallback(() => {
    setFloatingAdd(null)
  }, [])

  return (
    <div
      ref={wrapperRef}
      style={{ width: '100%', height: '100%' }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/*
        DOM-resident pickers. Clicking these from a button keeps the user gesture —
        unlike creating a new <input> after an awaited showDirectoryPicker() rejection.
      */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.heic,.heif,.svg,.pdf"
        className="fc-hidden-file-input"
        onChange={onFilesSelected}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="fc-hidden-file-input"
        onChange={onFolderSelected}
      />

      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMove={onMove}
        onMoveEnd={onMoveEnd}
        onDoubleClick={onDoubleClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={{ hideAttribution: true }}
        minZoom={0.25}
        maxZoom={2.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        panOnDrag
        selectionOnDrag={false}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        fitView={false}
      >
        <Background
          id="dots"
          variant={BackgroundVariant.Dots}
          gap={dotPattern.gap}
          size={dotPattern.size}
          color="var(--fc-dot)"
          bgColor="var(--fc-bg)"
        />
      </ReactFlow>

      {/* Empty canvas: centered ADD TO CANVAS (stays until nodes exist). */}
      {canvasEmpty && !floatingAdd && (
        <AddChooser
          centered
          onPickFiles={() => {
            pickAtViewportCenterRef.current = true
            openFilesDialog(viewportCenterFlow())
          }}
          onPickFolder={() => {
            pickAtViewportCenterRef.current = true
            openFolderDialog(viewportCenterFlow())
          }}
        />
      )}

      {/* Double-click floating instance at click position (dismissible). */}
      {floatingAdd && (
        <AddChooser
          left={floatingAdd.screen.left}
          top={floatingAdd.screen.top}
          onPickFiles={() => {
            const pos = floatingAdd.flow
            setFloatingAdd(null)
            pickAtViewportCenterRef.current = false
            openFilesDialog(pos)
          }}
          onPickFolder={() => {
            const pos = floatingAdd.flow
            setFloatingAdd(null)
            pickAtViewportCenterRef.current = false
            openFolderDialog(pos)
          }}
        />
      )}

      {draft && <ConnectionPanel />}
    </div>
  )
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
