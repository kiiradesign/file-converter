/**
 * Rasterize SVG for convert + preview via browser <img> + canvas.
 */

const SVG_MAX_EDGE = 2048
/** Upscale tiny icon SVGs so exports aren’t postage stamps. */
const SVG_MIN_EDGE = 512

export function isSvgExtension(ext: string): boolean {
  return ext.toLowerCase() === 'svg'
}

export function parseSvgDimensions(svgText: string): { width: number; height: number } {
  const vb = svgText.match(
    /viewBox\s*=\s*["']?\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i,
  )
  const wAttr = svgText.match(/\bwidth\s*=\s*["']?([\d.]+)/i)
  const hAttr = svgText.match(/\bheight\s*=\s*["']?([\d.]+)/i)

  let width = wAttr ? parseFloat(wAttr[1]) : NaN
  let height = hAttr ? parseFloat(hAttr[1]) : NaN

  if (vb) {
    const vw = parseFloat(vb[3])
    const vh = parseFloat(vb[4])
    if (!Number.isFinite(width) || width <= 0) width = vw
    if (!Number.isFinite(height) || height <= 0) height = vh
  }

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return { width: 1024, height: 1024 }
  }
  return { width, height }
}

/** Fit into [minEdge, maxEdge] on the long side, preserving aspect. */
export function normalizeRasterSize(
  w: number,
  h: number,
  maxEdge = SVG_MAX_EDGE,
  minEdge = SVG_MIN_EDGE,
): { width: number; height: number } {
  let width = w
  let height = h
  const long = Math.max(width, height)
  if (long < minEdge) {
    const s = minEdge / long
    width *= s
    height *= s
  }
  const long2 = Math.max(width, height)
  if (long2 > maxEdge) {
    const s = maxEdge / long2
    width *= s
    height *= s
  }
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  }
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode SVG'))
    img.src = url
  })
}

async function rasterizeSvgBlob(
  blob: Blob,
  maxEdge = SVG_MAX_EDGE,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const text = await blob.text()
  const parsed = parseSvgDimensions(text)
  const { width, height } = normalizeRasterSize(parsed.width, parsed.height, maxEdge)

  const svgUrl = URL.createObjectURL(
    new Blob([text], { type: 'image/svg+xml' }),
  )
  try {
    const img = await loadImageElement(svgUrl)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No 2d context')
    // Transparent by default; JPG/BMP paths fill white later in convert.
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    return { canvas, width, height }
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

export type SvgPreview = {
  previewUrl: string
  width: number
  height: number
}

/** PNG preview for canvas thumbnails (capped for memory). */
export async function svgToPreview(
  blob: Blob,
  maxEdge = 1280,
): Promise<SvgPreview> {
  const { canvas, width, height } = await rasterizeSvgBlob(blob, maxEdge)
  const previewBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('SVG → PNG preview failed'))),
      'image/png',
    )
  })
  return {
    previewUrl: URL.createObjectURL(previewBlob),
    width,
    height,
  }
}

/** Decode SVG blob URL into an HTMLImageElement via PNG rasterization. */
export async function loadSvgAsImage(url: string): Promise<HTMLImageElement> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch SVG source')
  const blob = await response.blob()
  const { canvas } = await rasterizeSvgBlob(blob, SVG_MAX_EDGE)
  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('SVG → PNG encode failed'))),
      'image/png',
    )
  })
  const pngUrl = URL.createObjectURL(pngBlob)
  try {
    return await loadImageElement(pngUrl)
  } finally {
    URL.revokeObjectURL(pngUrl)
  }
}
