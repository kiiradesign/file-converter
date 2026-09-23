<<<<<<< HEAD
/** Duration of the top-to-bottom pixel wave (seconds). */
=======
/** Duration of the top-to-bottom block wave (seconds). */
>>>>>>> ab03aa9 (Rebuild conversion loading as WebGL dither block wave)
export const WAVE_DURATION_S = 1

/** Fade-out of dither + grid once wave finished and output blob is ready. */
export const REVEAL_DURATION_S = 0.35

/** Cap WebGL pixel count for the dither overlay. */
export const DITHER_MAX_PIXEL_COUNT = 280_000

/** Fine square grid cell size in CSS pixels. */
export const GRID_CELL_PX = 5

/** Wave front thickness as a fraction of preview height (0–0.35). */
export const WAVE_BAND = 0.14

/** Max horizontal gap expansion between cells (fraction of cell size). */
export const WAVE_GAP_SPREAD = 0.85

/** Cell shrink from perspective as the wave passes (0–0.6). */
export const WAVE_CELL_SHRINK = 0.42

/** Vertical push simulating z-depth (CSS px at full spread). */
export const WAVE_Z_PUSH_PX = 14

/** Crossfade from dither WebGL to final output after wave + blob ready. */
export const REVEAL_CROSSFADE_S = 0.45

/**
<<<<<<< HEAD
 * Paper Image Dithering “natural” look (matches shaders.paper.design/image-dithering URL).
 * @see https://shaders.paper.design/image-dithering#colorBack=000000&colorFront=ffffff&...
 */
export const IMAGE_DITHERING = {
  colorBack: '#000000',
  colorFront: '#ffffff',
  colorHighlight: '#ffffff',
=======
 * Paper ImageDithering — natural 8×8 Bayer look (matches shaders demo “Natural”).
 */
export const IMAGE_DITHERING = {
>>>>>>> ab03aa9 (Rebuild conversion loading as WebGL dither block wave)
  type: '8x8' as const,
  size: 2,
  colorSteps: 5,
  originalColors: true,
  inverted: false,
<<<<<<< HEAD
  scale: 1,
  fit: 'cover' as const,
}
=======
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
  /** Gaussian σ for the traveling wave band. */
  band: 0.13,
  /** Peak Z translation (world units). */
  zPeak: 0.55,
  /** Extra spacing between blocks at the wave front (fraction of cell). */
  gapPeak: 0.35,
  /** Slight X/Y jitter at wave front. */
  jitter: 0.06,
  /** Perspective camera distance. */
  cameraZ: 4.2,
  /** Field of view (degrees). */
  fov: 42,
}

/** @deprecated halftone overlay removed — kept for type compatibility if referenced elsewhere */
export const HALFTONE_COLOR_BACK_DARK = '#0a0a0a'

export const HALFTONE_CMYK = {
  colorBack: HALFTONE_COLOR_BACK_DARK,
  colorC: '#59afc5',
  colorM: '#d8697c',
  colorY: '#fad85c',
  colorK: '#2d2824',
  size: 0.2,
  gridNoise: 0.45,
  type: 'sharp' as const,
  softness: 0.4,
  contrast: 1.45,
  floodC: 0.15,
  floodM: 0,
  floodY: 0,
  floodK: 0,
  gainC: 0.3,
  gainM: 0,
  gainY: 0.2,
  gainK: 0,
  grainMixer: 0.15,
  grainOverlay: 0.1,
  grainSize: 0.5,
  scale: 1,
  fit: 'cover' as const,
}

export const HALFTONE_MAX_PIXEL_COUNT = 280_000

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
>>>>>>> ab03aa9 (Rebuild conversion loading as WebGL dither block wave)
