import { useEffect, useRef } from 'react'
import {
  GRID_CELL_PX,
  IMAGE_DITHERING,
  WAVE_BAND,
  WAVE_CELL_SHRINK,
  WAVE_GAP_SPREAD,
  WAVE_Z_PUSH_PX,
} from './pixelationWaveConfig'

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** 0 at wave front, peaks at 1 shortly after, eases down during reveal. */
export function waveSpreadAtRow(
  rowCenterY: number,
  height: number,
  waveT: number,
  revealT: number,
): number {
  const frontY = waveT * (height + height * WAVE_BAND)
  const band = height * WAVE_BAND
  const passed = frontY - rowCenterY
  const wave = smoothstep(-band * 0.35, band, passed)
  const settle = 1 - revealT * 0.95
  return wave * settle
}

type Props = {
  src: string
  width: number
  height: number
  waveT: number
  revealT: number
  /** When false, skip drawing (shader-only path still uses halftone). */
  showGrid: boolean
}

/**
 * Fine pixel grid with a top→bottom 3D spread wave; samples source colors per cell.
 */
export function PixelationWave({
  src,
  width,
  height,
  waveT,
  revealT,
  showGrid,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cellsRef = useRef<Uint8ClampedArray | null>(null)
  const colsRef = useRef(0)
  const rowsRef = useRef(0)
  const cellRef = useRef(GRID_CELL_PX)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    const img = new Image()
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      if (cancelled) return
      const cell = GRID_CELL_PX
      const cols = Math.ceil(width / cell)
      const rows = Math.ceil(height / cell)
      const off = document.createElement('canvas')
      off.width = cols
      off.height = rows
      const octx = off.getContext('2d')
      if (!octx) return
      octx.drawImage(img, 0, 0, cols, rows)
      cellsRef.current = octx.getImageData(0, 0, cols, rows).data
      colsRef.current = cols
      rowsRef.current = rows
      cellRef.current = cell
    }
    img.onerror = () => {
      cellsRef.current = null
    }
    img.src = src
    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
    }
  }, [src, width, height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !showGrid) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const data = cellsRef.current
    const cols = colsRef.current
    const rows = rowsRef.current
    const cell = cellRef.current

    ctx.clearRect(0, 0, width, height)

    if (!data || cols === 0 || rows === 0) return

    for (let row = 0; row < rows; row++) {
      const rowCenterY = (row + 0.5) * cell
      const spread = waveSpreadAtRow(rowCenterY, height, waveT, revealT)
      const gap = spread * WAVE_GAP_SPREAD
      const shrink = spread * WAVE_CELL_SHRINK
      const zPush = spread * WAVE_Z_PUSH_PX
      const rowScale = 1 - shrink * 0.5
      const rowOffsetY = zPush

      for (let col = 0; col < cols; col++) {
        const i = (row * cols + col) * 4
        const r = data[i]!
        const g = data[i + 1]!
        const b = data[i + 2]!
        const a = data[i + 3]! / 255
        if (a < 0.04) continue

        const spreadX = gap * cell * 0.5
        const x0 = col * cell
        const y0 = row * cell + rowOffsetY
        const tile = cell * (1 - gap) * rowScale
        if (tile < 0.35) continue

        const cx = x0 + (cell - tile) / 2 + spreadX * (col / Math.max(cols - 1, 1) - 0.5)
        const cy = y0 + (cell - tile) / 2

        ctx.fillStyle = `rgba(${r},${g},${b},${a})`
        ctx.fillRect(cx, cy, tile, tile)
      }
    }
  }, [width, height, waveT, revealT, showGrid])

  if (!showGrid) return null

  return (
    <canvas
      ref={canvasRef}
      className="file-node__preview-pixel-grid"
      width={width}
      height={height}
      aria-hidden
    />
  )
}

/** Standard 8×8 Bayer threshold matrix (0–63). */
const BAYER_8 = [
  0, 48, 12, 60, 3, 51, 15, 63, 32, 16, 44, 28, 35, 19, 47, 31, 8, 56, 4, 52, 11, 59, 7,
  55, 40, 24, 36, 20, 43, 27, 39, 23, 2, 50, 14, 62, 1, 49, 13, 61, 34, 18, 46, 30, 33, 17,
  45, 29, 10, 58, 6, 54, 9, 57, 5, 53, 42, 26, 38, 22, 41, 25, 37, 21,
]

function ditherChannel(v: number, threshold: number, steps: number): number {
  const n = Math.max(1, steps - 1)
  const t = threshold / 64 - 0.5
  const q = Math.round(v * n + t) / n
  return Math.min(1, Math.max(0, q))
}

/** Static dithered preview when WebGL ImageDithering is unavailable. */
export function DitherCanvasFallback({
  src,
  width,
  height,
}: {
  src: string
  width: number
  height: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let cancelled = false
    const { colorBack, colorSteps } = IMAGE_DITHERING
    const img = new Image()
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      if (cancelled) return
      const off = document.createElement('canvas')
      off.width = width
      off.height = height
      const octx = off.getContext('2d')
      if (!octx) return
      octx.drawImage(img, 0, 0, width, height)
      const data = octx.getImageData(0, 0, width, height)
      const px = data.data
      const steps = colorSteps

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4
          const threshold = BAYER_8[(y & 7) * 8 + (x & 7)] ?? 0
          px[i] = Math.round(ditherChannel(px[i]! / 255, threshold, steps) * 255)
          px[i + 1] = Math.round(
            ditherChannel(px[i + 1]! / 255, threshold, steps) * 255,
          )
          px[i + 2] = Math.round(
            ditherChannel(px[i + 2]! / 255, threshold, steps) * 255,
          )
        }
      }

      ctx.fillStyle = colorBack
      ctx.fillRect(0, 0, width, height)
      ctx.putImageData(data, 0, 0)
    }
    img.onerror = () => {
      if (cancelled || !canvasRef.current) return
      const c = canvasRef.current.getContext('2d')
      if (!c) return
      c.fillStyle = colorBack
      c.fillRect(0, 0, width, height)
    }
    img.src = src
    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
    }
  }, [src, width, height])

  return (
    <canvas
      ref={canvasRef}
      className="file-node__preview-wave-fallback"
      width={width}
      height={height}
      aria-hidden
    />
  )
}
