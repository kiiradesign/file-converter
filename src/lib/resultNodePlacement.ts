import type { XYPosition } from '@xyflow/react'
import type { FileEntry } from '../types'
import {
  estimateImportNodeSize,
  FILE_LABEL_BLOCK,
  FILE_TOOLBAR_SPACE,
} from './importNodePlacement'
import { previewCardSize } from './previewCardSize'

type PlacementNode = {
  id: string
  position: XYPosition
  data: { kind: 'file' | 'folder'; fileId?: string }
}

type PlacementEdge = { source: string; target: string }

/** Horizontal gap from parent to first result (flow px). */
export const RESULT_OFFSET_X = 400
/** Vertical drop for first result so edges curve (flow px). */
export const RESULT_OFFSET_Y = 56
/** Gap between stacked sibling results (flow px). */
export const RESULT_STACK_GAP = 32

function childResultNodes(
  sourceNodeId: string,
  nodes: PlacementNode[],
  edges: PlacementEdge[],
): PlacementNode[] {
  const childIds = new Set(
    edges.filter((e) => e.source === sourceNodeId).map((e) => e.target),
  )
  return nodes.filter((n) => childIds.has(n.id))
}

function estimateFileNodeHeight(
  node: PlacementNode,
  files: Record<string, FileEntry>,
): number {
  if (node.data.kind !== 'file') return 0
  const fileId = node.data.fileId
  const file = fileId ? files[fileId] : undefined
  const card = previewCardSize(file?.width, file?.height)
  return FILE_TOOLBAR_SPACE + card.height + FILE_LABEL_BLOCK
}

function estimateFolderNodeHeight(): number {
  return estimateImportNodeSize('folder').height
}

function estimateNodeBottom(
  node: PlacementNode,
  files: Record<string, FileEntry>,
): number {
  const h =
    node.data.kind === 'folder'
      ? estimateFolderNodeHeight()
      : estimateFileNodeHeight(node, files)
  return node.position.y + h
}

/**
 * Default spawn position for a new conversion result to the right of `sourceNode`,
 * stacked below prior results from the same parent when needed.
 */
export function computeDefaultResultPosition(
  sourceNode: PlacementNode,
  nodes: PlacementNode[],
  edges: PlacementEdge[],
  files: Record<string, FileEntry>,
): XYPosition {
  const siblings = childResultNodes(sourceNode.id, nodes, edges)
  const firstX = sourceNode.position.x + RESULT_OFFSET_X
  const firstY = sourceNode.position.y + RESULT_OFFSET_Y

  if (siblings.length === 0) {
    return { x: firstX, y: firstY }
  }

  const columnX = Math.min(...siblings.map((n) => n.position.x), firstX)
  const stackBottom = Math.max(
    ...siblings.map((n) => estimateNodeBottom(n, files)),
  )
  return {
    x: columnX,
    y: stackBottom + RESULT_STACK_GAP,
  }
}
