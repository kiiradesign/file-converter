import type { XYPosition } from '@xyflow/react'
import type { FileEntry } from '../types'
import {
  buildCanvasObstacleRects,
  estimateImportNodeSize,
  rectAt,
  resolveParentImportPosition,
  type PlacementRect,
} from './importNodePlacement'

export const FOLDER_CHILD_ORIGIN: XYPosition = { x: 80, y: 80 }
export const FOLDER_CHILD_COL_STEP = 220
export const FOLDER_CHILD_ROW_STEP = 280
export const FOLDER_CHILD_GRID_COLS = 4

type CanvasPlacementNode = {
  position: XYPosition
  data: { kind: 'file' | 'folder'; fileId?: string; canvasId: string | null }
}

export type FolderChildSpec = {
  kind: 'file' | 'folder'
  file?: Pick<FileEntry, 'width' | 'height'>
}

function gridAnchor(index: number): XYPosition {
  const col = index % FOLDER_CHILD_GRID_COLS
  const row = Math.floor(index / FOLDER_CHILD_GRID_COLS)
  return {
    x: FOLDER_CHILD_ORIGIN.x + col * FOLDER_CHILD_COL_STEP,
    y: FOLDER_CHILD_ORIGIN.y + row * FOLDER_CHILD_ROW_STEP,
  }
}

/**
 * Non-overlapping positions for file/folder nodes on a folder's inner canvas.
 */
export function resolveFolderChildPositions(
  canvasId: string,
  existingNodes: CanvasPlacementNode[],
  files: Record<string, FileEntry>,
  children: FolderChildSpec[],
): XYPosition[] {
  const canvasObstacles = buildCanvasObstacleRects(existingNodes, files, canvasId)
  const batchPlaced: PlacementRect[] = []
  const positions: XYPosition[] = []

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const anchor = gridAnchor(i)
    const pos = resolveParentImportPosition(
      anchor,
      child.kind,
      child.file,
      canvasObstacles,
      batchPlaced,
    )
    const size = estimateImportNodeSize(child.kind, child.file)
    batchPlaced.push(rectAt(pos, size))
    positions.push(pos)
  }

  return positions
}
