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
 * Paper Fluted Glass — edge-safe load preset (from shaders demo defaults):
 * https://shaders.paper.design/fluted-glass
 */
export const FLUTED_GLASS_START = {
  colorBack: PREVIEW_COLOR_BACK_DARK,
  colorShadow: '#000000',
  colorHighlight: '#ffffff',
  shadows: 0.14,
  highlights: 0.03,
  size: 0.46,
  shape: 'lines' as const,
  angle: 0,
  distortionShape: 'prism' as const,
  distortion: 0.36,
  shift: 0,
  stretch: 0,
  blur: 0,
  /** Edge rim distortion reads as halos against the card stroke — keep off during load. */
  edges: 0,
  margin: 0.04,
  grainMixer: 0,
  grainOverlay: 0,
  fit: 'cover' as const,
  /** Slight zoom so prism sampling stays inside image bounds (pairs with CSS scale). */
  scale: 1.06,
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
  margin: 0,
  grainMixer: 0,
  grainOverlay: 0,
  scale: 1,
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Ease glass strength down before the crossfade so borders stay stable. */
function effectStrength(t: number): number {
  const u = Math.min(1, Math.max(0, t))
  return 1 - (1 - u) ** 2
}

export function flutedGlassAtProgress(t: number) {
  const u = Math.min(1, Math.max(0, t))
  const strength = effectStrength(u)
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
    size: lerp(from.size, to.size, strength),
    shadows: lerp(from.shadows, to.shadows, strength),
    highlights: lerp(from.highlights, to.highlights, strength),
    distortion: lerp(from.distortion, to.distortion, strength),
    shift: lerp(from.shift, to.shift, strength),
    stretch: lerp(from.stretch, to.stretch, strength),
    blur: lerp(from.blur, to.blur, strength),
    edges: lerp(from.edges, to.edges, strength),
    margin: lerp(from.margin, to.margin, u),
    scale: lerp(from.scale, to.scale, u),
    grainMixer: lerp(from.grainMixer, to.grainMixer, strength),
    grainOverlay: lerp(from.grainOverlay, to.grainOverlay, strength),
  }
}
