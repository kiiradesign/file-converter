import type { XYPosition } from '@xyflow/react'
import type { FileEntry } from '../types'
import { previewCardSize } from './previewCardSize'

/** Vertical nudge when resolving import collisions (flow px). */
export const IMPORT_STACK_GAP = 32
/** Minimum gap between node bounds when testing overlap (flow px). */
export const IMPORT_COLLISION_GAP = 16
export const MAX_IMPORT_PLACEMENT_ATTEMPTS = 64

export const FILE_TOOLBAR_SPACE = 52
export const FILE_LABEL_BLOCK = 28
export const FOLDER_ICON_W = 96
export const FOLDER_ICON_H = Math.round((FOLDER_ICON_W * 854) / 1004)
export const FOLDER_LABEL_BLOCK = 28

export type PlacementRect = {
  x: number
  y: number
  width: number
  height: number
}

export function estimateImportNodeSize(
  kind: 'file' | 'folder',
  file?: Pick<FileEntry, 'width' | 'height'>,
): { width: number; height: number } {
  if (kind === 'folder') {
    return { width: FOLDER_ICON_W, height: FOLDER_ICON_H + FOLDER_LABEL_BLOCK }
  }
  const card = previewCardSize(file?.width, file?.height)
  return {
    width: card.width,
    height: FILE_TOOLBAR_SPACE + card.height + FILE_LABEL_BLOCK,
  }
}

export function rectAt(
  position: XYPosition,
  size: { width: number; height: number },
): PlacementRect {
  return { x: position.x, y: position.y, width: size.width, height: size.height }
}

export function rectsOverlap(
  a: PlacementRect,
  b: PlacementRect,
  gap = IMPORT_COLLISION_GAP,
): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  )
}

function overlapsAny(candidate: PlacementRect, others: PlacementRect[]): boolean {
  return others.some((o) => rectsOverlap(candidate, o))
}

type CanvasPlacementNode = {
  position: XYPosition
  data: { kind: 'file' | 'folder'; fileId?: string; canvasId: string | null }
}

/** Bounding boxes for every node on the given canvas (for collision tests). */
export function buildCanvasObstacleRects(
  nodes: CanvasPlacementNode[],
  files: Record<string, FileEntry>,
  canvasId: string | null,
): PlacementRect[] {
  return nodes
    .filter((n) => n.data.canvasId === canvasId)
    .map((n) => {
      const file =
        n.data.kind === 'file' && n.data.fileId ? files[n.data.fileId] : undefined
      const size = estimateImportNodeSize(n.data.kind, file)
      return rectAt(n.position, size)
    })
}

function* candidatePositions(
  anchor: XYPosition,
  stepY: number,
  stepX: number,
): Generator<XYPosition> {
  yield anchor
  for (let row = 1; row <= 24; row++) {
    yield { x: anchor.x, y: anchor.y + row * stepY }
  }
  for (let col = 1; col <= 8; col++) {
    for (let row = 0; row <= 12; row++) {
      yield { x: anchor.x + col * stepX, y: anchor.y + row * stepY }
    }
  }
  const spiralStep = Math.max(stepY, stepX)
  let x = 0
  let y = 0
  let leg = 0
  const dirs: [number, number][] = [
    [spiralStep, 0],
    [0, spiralStep],
    [-spiralStep, 0],
    [0, -spiralStep],
  ]
  for (let i = 0; i < 40; i++) {
    const [dx, dy] = dirs[i % 4]
    if (i > 0 && i % 2 === 0) leg++
    x += dx * (leg || 1)
    y += dy * (leg || 1)
    yield { x: anchor.x + x, y: anchor.y + y }
  }
}

/**
 * Find a non-overlapping top-left for a new parent file/folder on the canvas.
 * `anchor` is the user’s intent (viewport center, click, or drop point).
 */
export function resolveParentImportPosition(
  anchor: XYPosition,
  kind: 'file' | 'folder',
  file: Pick<FileEntry, 'width' | 'height'> | undefined,
  canvasObstacles: PlacementRect[],
  batchPlaced: PlacementRect[],
): XYPosition {
  const size = estimateImportNodeSize(kind, file)
  const obstacles = [...canvasObstacles, ...batchPlaced]
  const stepY = IMPORT_STACK_GAP
  const stepX = size.width + IMPORT_COLLISION_GAP

  let attempt = 0
  for (const pos of candidatePositions(anchor, stepY, stepX)) {
    if (attempt++ >= MAX_IMPORT_PLACEMENT_ATTEMPTS) break
    const rect = rectAt(pos, size)
    if (!overlapsAny(rect, obstacles)) return pos
  }

  let maxBottom = anchor.y
  for (const o of obstacles) {
    maxBottom = Math.max(maxBottom, o.y + o.height)
  }
  return { x: anchor.x, y: maxBottom + IMPORT_COLLISION_GAP }
}

/** Top-left flow position so a node of `kind` is centered on `center`. */
export function centeredImportPosition(
  center: XYPosition,
  kind: 'file' | 'folder',
  file?: Pick<FileEntry, 'width' | 'height'>,
): XYPosition {
  const size = estimateImportNodeSize(kind, file)
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
  }
}
