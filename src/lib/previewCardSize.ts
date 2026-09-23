const FALLBACK_W = 168
const FALLBACK_H = 210
/** Longest edge of the preview card in flow px. */
const MAX_EDGE = 240
/** Prefer at least this on the long edge when the photo is tiny. */
const MIN_LONG_EDGE = 96

/**
 * Size the preview card to the photo’s aspect ratio.
 * Fits inside a MAX_EDGE square without distorting or forcing a min on the short edge.
 */
export function previewCardSize(
  width?: number,
  height?: number,
): { width: number; height: number } {
  if (!width || !height || width <= 0 || height <= 0) {
    return { width: FALLBACK_W, height: FALLBACK_H }
  }
  const aspect = width / height
  let w: number
  let h: number
  if (aspect >= 1) {
    w = MAX_EDGE
    h = w / aspect
  } else {
    h = MAX_EDGE
    w = h * aspect
  }
  const long = Math.max(w, h)
  if (long < MIN_LONG_EDGE) {
    const s = MIN_LONG_EDGE / long
    w *= s
    h *= s
  }
  return {
    width: Math.max(1, Math.round(w)),
    height: Math.max(1, Math.round(h)),
  }
}
