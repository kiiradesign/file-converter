/** Duration of the top-to-bottom pixel wave (seconds). */
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

/**
 * Paper Image Dithering “natural” look (matches shaders.paper.design/image-dithering URL).
 * @see https://shaders.paper.design/image-dithering#colorBack=000000&colorFront=ffffff&...
 */
export const IMAGE_DITHERING = {
  colorBack: '#000000',
  colorFront: '#ffffff',
  colorHighlight: '#ffffff',
  type: '8x8' as const,
  size: 2,
  colorSteps: 5,
  originalColors: true,
  inverted: false,
  scale: 1,
  fit: 'cover' as const,
}
