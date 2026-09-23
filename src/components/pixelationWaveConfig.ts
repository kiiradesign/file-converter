/** Duration of the top-to-bottom reveal wave (seconds). */
export const WAVE_DURATION_S = 1

/** Soft band at the wave front as a fraction of preview height (0–0.2). */
export const WAVE_SOFTNESS = 0.04

/**
 * Vintage CMYK halftone — tuned to match Paper Shaders “halftone-cmyk” demo:
 * https://shaders.paper.design/halftone-cmyk#colorBack=fffaf0&...
 */
export const HALFTONE_CMYK = {
  colorBack: '#fffaf0',
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

/** Cap WebGL pixel count for the overlay (full-res <img> stays underneath). */
export const HALFTONE_MAX_PIXEL_COUNT = 280_000
