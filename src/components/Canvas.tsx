import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type OnMove,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import '@xyflow/react/dist/style.css'
import { ConversionEdge } from './edges/ConversionEdge'
import { FileNode } from './nodes/FileNode'
import { FolderNode } from './nodes/FolderNode'
import { ConnectionPanel } from './ConnectionPanel'
import { useCanvasStore } from '../store/canvasStore'

const nodeTypes = {
  file: FileNode,
  folder: FolderNode,
}

const edgeTypes = {
  conversion: ConversionEdge,
}

function CanvasInner() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const folderStack = useCanvasStore((s) => s.folderStack)
  const draft = useCanvasStore((s) => s.draft)
  const onNodesChange = useCanvasStore((s) => s.onNodesChange)
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange)
  const setZoom = useCanvasStore((s) => s.setZoom)
  const openFilePicker = useCanvasStore((s) => s.openFilePicker)
  const openFolderPicker = useCanvasStore((s) => s.openFolderPicker)
  const handleDrop = useCanvasStore((s) => s.handleDrop)
  const confirmDraft = useCanvasStore((s) => s.confirmDraft)
  const cancelDraft = useCanvasStore((s) => s.cancelDraft)

  const { screenToFlowPosition } = useReactFlow()
  const wrapperRef = useRef<HTMLDivElement>(null)

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
    async (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.classList.contains('react-flow__pane')) return
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      if (e.shiftKey || e.altKey) {
        await openFolderPicker(pos)
      } else {
        await openFilePicker(pos)
      }
    },
    [screenToFlowPosition, openFilePicker, openFolderPicker],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      await handleDrop(e.dataTransfer, pos)
    },
    [screenToFlowPosition, handleDrop],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDraft()
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
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={{ hideAttribution: true }}
        minZoom={0.25}
        maxZoom={2.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        panOnScroll
        zoomOnScroll
        zoomOnPinch
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
          gap={22}
          size={1.6}
          color="var(--fc-dot)"
          style={{ backgroundColor: 'var(--fc-bg)' }}
        />
      </ReactFlow>

      {visibleNodes.length === 0 && (
        <div className="empty-hint">
          <span>Double-click to add files · Drop folders anywhere · Shift-double-click for folder picker</span>
        </div>
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
