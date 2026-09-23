/** Duration of the fluted-glass reveal (seconds). */
export const WAVE_DURATION_S = 2

/** Motion easing for reveal progress (smooth decel). */
export const WAVE_EASE: [number, number, number, number] = [0.42, 0, 0.18, 1]

/** Crossfade from shader preview to final output after reveal + blob ready. */
export const REVEAL_CROSSFADE_S = 0.5

/** Dark canvas match when CSS var is unavailable (SSR / first paint). */
export const PREVIEW_COLOR_BACK_DARK = '#0a0a0a'

/** Cap shader pixel count for the preview card. */
export const FLUTED_GLASS_MAX_PIXEL_COUNT = 280_000

/**
 * Paper Fluted Glass — default preset (matches shaders demo):
 * https://shaders.paper.design/fluted-glass
 */
export const FLUTED_GLASS_START = {
  colorBack: '#00000000',
  colorShadow: '#000000',
  colorHighlight: '#ffffff',
  shadows: 0.25,
  highlights: 0.1,
  size: 0.5,
  shape: 'lines' as const,
  angle: 0,
  distortionShape: 'prism' as const,
  distortion: 0.5,
  shift: 0,
  stretch: 0,
  blur: 0,
  edges: 0.25,
  margin: 0,
  grainMixer: 0,
  grainOverlay: 0,
  fit: 'cover' as const,
  scale: 1,
}

/** Fully revealed — no glass distortion (shader ≈ source image). */
export const FLUTED_GLASS_CLEAR = {
  ...FLUTED_GLASS_START,
  shadows: 0,
  highlights: 0,
  distortion: 0,
  blur: 0,
  edges: 0,
  stretch: 0,
  grainMixer: 0,
  grainOverlay: 0,
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function flutedGlassAtProgress(t: number) {
  const u = Math.min(1, Math.max(0, t))
  const from = FLUTED_GLASS_START
  const to = FLUTED_GLASS_CLEAR
  return {
    colorBack: from.colorBack,
    colorShadow: from.colorShadow,
    colorHighlight: from.colorHighlight,
    shape: from.shape,
    angle: from.angle,
    distortionShape: from.distortionShape,
    fit: from.fit,
    scale: from.scale,
    size: lerp(from.size, to.size, u),
    shadows: lerp(from.shadows, to.shadows, u),
    highlights: lerp(from.highlights, to.highlights, u),
    distortion: lerp(from.distortion, to.distortion, u),
    shift: lerp(from.shift, to.shift, u),
    stretch: lerp(from.stretch, to.stretch, u),
    blur: lerp(from.blur, to.blur, u),
    edges: lerp(from.edges, to.edges, u),
    margin: from.margin,
    grainMixer: lerp(from.grainMixer, to.grainMixer, u),
    grainOverlay: lerp(from.grainOverlay, to.grainOverlay, u),
  }
}
