/** Duration of the top-to-bottom block wave (seconds). */
export const WAVE_DURATION_S = 2

/** Motion easing for wave progress (smooth decel, no linear crawl). */
export const WAVE_EASE: [number, number, number, number] = [0.42, 0, 0.18, 1]

/** FigJam-style dot gap at zoom 1 (see `Canvas` `patternForZoom`) — wave ripple tuning. */
export const CANVAS_DOT_GAP_PX = 24

/** Crossfade from dither WebGL to final output after wave + blob ready. */
export const REVEAL_CROSSFADE_S = 0.5

/**
 * Paper ImageDithering — natural 8×8 Bayer look (matches shaders demo “Natural”).
 */
export const IMAGE_DITHERING = {
  type: '8x8' as const,
  size: 2,
  colorSteps: 5,
  originalColors: true,
  inverted: false,
  colorFront: '#ffffff',
  colorBack: '#000000',
  colorHighlight: '#ffffff',
  fit: 'cover' as const,
  scale: 1,
}

/** Cap shader pixel count for the hidden dither capture (full-res img stays separate). */
export const DITHER_MAX_PIXEL_COUNT = 280_000

/** Square block grid density (cols clamped to min/max for card size). */
export const BLOCK_GRID = {
  targetCols: 32,
  minCols: 24,
  maxCols: 48,
}

/** 3D wave distortion along top → bottom (normalized 0–1 space). */
export const BLOCK_WAVE = {
  /** Gaussian σ for the traveling wave band (wider for the 2s sweep). */
  band: 0.155,
  /** Peak Z translation (world units). */
  zPeak: 0.52,
  /** Extra spacing between blocks at the wave front (fraction of cell). */
  gapPeak: 0.32,
  /** Slight X/Y jitter at wave front. */
  jitter: 0.05,
  /** Subtle Z ripple period locked to canvas dot spacing (0 = off). */
  rhythmStrength: 0.04,
  /** Perspective camera distance. */
  cameraZ: 4.2,
  /** Field of view (degrees). */
  fov: 42,
}

/** Dark canvas match when CSS var is unavailable (SSR / first paint). */
export const HALFTONE_COLOR_BACK_DARK = '#0a0a0a'

export function blockGridDimensions(
  width: number,
  height: number,
): { cols: number; rows: number; cellW: number; cellH: number } {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const cols = Math.min(
    BLOCK_GRID.maxCols,
    Math.max(BLOCK_GRID.minCols, Math.round(BLOCK_GRID.targetCols)),
  )
  const cellW = w / cols
  const rows = Math.max(1, Math.round(h / cellW))
  const cellH = h / rows
  return { cols, rows, cellW, cellH }
}
