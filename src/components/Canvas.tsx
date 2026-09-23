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
import { useCanvasStore } from '../store/canvasStore'

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
  const pickPosRef = useRef<XYPosition>({ x: 200, y: 160 })
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

  /** Center of the current viewport in flow coords (for empty-state picks). */
  const viewportCenterFlow = useCallback((): XYPosition => {
    const el = wrapperRef.current
    const w = el?.clientWidth ?? window.innerWidth
    const h = el?.clientHeight ?? window.innerHeight
    return screenToFlowPosition({ x: w / 2, y: h / 2 })
  }, [screenToFlowPosition])

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
      if (!list.length) return
      void addFilesAt(list, pickPosRef.current)
    },
    [addFilesAt],
  )

  const onFolderSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(e.target.files ?? [])
      e.target.value = ''
      if (!list.length) return
      const files = list.map((file) => ({
        file,
        relativePath:
          (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      }))
      const top = files[0].relativePath.split('/').filter(Boolean)[0] || 'Folder'
      void addFolderAt(top, files, pickPosRef.current)
    },
    [addFolderAt],
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
        onPaneClick={() => setFloatingAdd(null)}
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
          onPickFiles={() => openFilesDialog(viewportCenterFlow())}
          onPickFolder={() => openFolderDialog(viewportCenterFlow())}
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
            openFilesDialog(pos)
          }}
          onPickFolder={() => {
            const pos = floatingAdd.flow
            setFloatingAdd(null)
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
