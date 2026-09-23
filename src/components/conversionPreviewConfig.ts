/** Duration of the fluted-glass reveal (seconds). */
export const WAVE_DURATION_S = 3.25

/** Motion easing for reveal progress (smooth decel). */
export const WAVE_EASE: [number, number, number, number] = [0.42, 0, 0.18, 1]

/**
 * Final handoff to output `<img>` only after shader params read clear and the job
 * finishes late (wave already done). Keep short — param tween does the heavy lifting.
 */
export const REVEAL_CROSSFADE_S = 0.32

/** Dark canvas match when CSS var is unavailable (SSR / first paint). */
export const PREVIEW_COLOR_BACK_DARK = '#0a0a0a'

/**
 * Floor for shader render budget (physical pixels). Pair with `minPixelRatio` and
 * `flutedGlassMaxPixelCountForSize` so preview cards are not capped below DPR.
 */
export const FLUTED_GLASS_MAX_PIXEL_COUNT = 2_073_600

/** Supersample preview refraction above system DPR when it is below this floor. */
export const FLUTED_GLASS_MIN_PIXEL_RATIO = 3

/** Preview card at full DPR + min ratio without `maxPixelCount` downscale. */
export function flutedGlassMaxPixelCountForSize(cssWidth: number, cssHeight: number): number {
  const w = Math.max(1, Math.round(cssWidth))
  const h = Math.max(1, Math.round(cssHeight))
  const dpr =
    typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio) : FLUTED_GLASS_MIN_PIXEL_RATIO
  const renderScale = Math.max(dpr, FLUTED_GLASS_MIN_PIXEL_RATIO)
  const needed = Math.ceil(w * renderScale) * Math.ceil(h * renderScale)
  return Math.max(FLUTED_GLASS_MAX_PIXEL_COUNT, needed)
}

/**
 * Full-strength fluted glass at animation start (frame 0 / replay).
 * Bold lines, minimal shadow/grain so the refractive look stays sharp.
 */
export const FLUTED_GLASS_LOAD = {
  colorBack: PREVIEW_COLOR_BACK_DARK,
  colorShadow: '#000000',
  colorHighlight: '#ffffff',
  shadows: 0.03,
  highlights: 0.008,
  size: 0.74,
  shape: 'lines' as const,
  angle: 0,
  distortionShape: 'prism' as const,
  distortion: 0.36,
  shift: 0,
  stretch: 0,
  blur: 0,
  edges: 0,
  margin: 0.01,
  grainMixer: 0,
  grainOverlay: 0,
  fit: 'cover' as const,
  scale: 1.02,
}

/** Fully revealed — no glass distortion (shader ≈ source image). */
export const FLUTED_GLASS_CLEAR = {
  ...FLUTED_GLASS_LOAD,
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

/** @deprecated Use FLUTED_GLASS_LOAD */
export const FLUTED_GLASS_START = FLUTED_GLASS_LOAD

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** 1 at progress 0 (max glass), 0 at progress 1 (clear). Smooth resolve across the wave. */
export function glassAmountAtProgress(t: number): number {
  const u = Math.min(1, Math.max(0, t))
  const eased = u * u * (3 - 2 * u)
  return 1 - eased
}

/** 0 → 1 as glass clears; use for output layer when encode finishes during the wave. */
export function resultBlendAtProgress(t: number): number {
  return 1 - glassAmountAtProgress(t)
}

export function flutedGlassAtProgress(t: number) {
  const amount = glassAmountAtProgress(t)
  const load = FLUTED_GLASS_LOAD
  const clear = FLUTED_GLASS_CLEAR
  return {
    colorBack: load.colorBack,
    colorShadow: load.colorShadow,
    colorHighlight: load.colorHighlight,
    shape: load.shape,
    angle: load.angle,
    distortionShape: load.distortionShape,
    fit: load.fit,
    size: lerp(clear.size, load.size, amount),
    shadows: lerp(clear.shadows, load.shadows, amount),
    highlights: lerp(clear.highlights, load.highlights, amount),
    distortion: lerp(clear.distortion, load.distortion, amount),
    shift: lerp(clear.shift, load.shift, amount),
    stretch: lerp(clear.stretch, load.stretch, amount),
    blur: lerp(clear.blur, load.blur, amount),
    edges: lerp(clear.edges, load.edges, amount),
    margin: lerp(clear.margin, load.margin, amount),
    scale: lerp(clear.scale, load.scale, amount),
    grainMixer: lerp(clear.grainMixer, load.grainMixer, amount),
    grainOverlay: lerp(clear.grainOverlay, load.grainOverlay, amount),
  }
}
