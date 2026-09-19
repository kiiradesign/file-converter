import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type OnMove,
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

type PendingAdd = {
  flow: XYPosition
  screen: { left: number; top: number }
}

function CanvasInner() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const folderStack = useCanvasStore((s) => s.folderStack)
  const draft = useCanvasStore((s) => s.draft)
  const onNodesChange = useCanvasStore((s) => s.onNodesChange)
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange)
  const setZoom = useCanvasStore((s) => s.setZoom)
  const zoom = useCanvasStore((s) => s.zoom)
  const openFilePicker = useCanvasStore((s) => s.openFilePicker)
  const openFolderPicker = useCanvasStore((s) => s.openFolderPicker)
  const handleDrop = useCanvasStore((s) => s.handleDrop)
  const confirmDraft = useCanvasStore((s) => s.confirmDraft)
  const cancelDraft = useCanvasStore((s) => s.cancelDraft)

  const { screenToFlowPosition } = useReactFlow()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null)

  /**
   * FigJam-like dots: keep roughly constant *screen* spacing/size as zoom changes.
   * React Flow gap/size are in flow units (scaled by zoom), so invert zoom.
   */
  const dotPattern = useMemo(() => {
    const z = Math.max(0.2, Math.min(3, zoom))
    const stepped = Math.round(z * 24) / 24
    const screenGap = 28
    const screenSize = 1.5
    return {
      gap: Math.max(10, Math.round(screenGap / stepped)),
      size: Math.min(7, Math.max(0.9, Number((screenSize / stepped).toFixed(2)))),
    }
  }, [zoom])

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

  const onMove: OnMove = useCallback(
    (_evt, viewport) => {
      setZoom(viewport.zoom)
    },
    [setZoom],
  )

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest?.('.react-flow__pane')) return
      if (target.closest?.('.react-flow__node') || target.closest?.('.react-flow__edge')) return
      e.preventDefault()
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      // Shift / Alt: jump straight to folder picker.
      if (e.shiftKey || e.altKey) {
        setPendingAdd(null)
        void openFolderPicker(flow)
        return
      }
      // Otherwise show Files vs Folder chooser (folder pick is easy to miss).
      const left = Math.min(Math.max(16, e.clientX - 120), window.innerWidth - 260)
      const top = Math.min(Math.max(16, e.clientY - 20), window.innerHeight - 200)
      setPendingAdd({ flow, screen: { left, top } })
    },
    [screenToFlowPosition, openFolderPicker],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setPendingAdd(null)
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      await handleDrop(e.dataTransfer, pos)
    },
    [screenToFlowPosition, handleDrop],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingAdd(null)
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
      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMove={onMove}
        onDoubleClick={onDoubleClick}
        onPaneClick={() => setPendingAdd(null)}
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

      {visibleNodes.length === 0 && !pendingAdd && (
        <div className="empty-hint">
          <span>
            Double-click to add files or a folder · Drop a folder anywhere · Shift-double-click
            opens folder picker
          </span>
        </div>
      )}

      {pendingAdd && (
        <AddChooser
          left={pendingAdd.screen.left}
          top={pendingAdd.screen.top}
          onPickFiles={() => {
            const pos = pendingAdd.flow
            setPendingAdd(null)
            void openFilePicker(pos)
          }}
          onPickFolder={() => {
            const pos = pendingAdd.flow
            setPendingAdd(null)
            void openFolderPicker(pos)
          }}
          onCancel={() => setPendingAdd(null)}
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
