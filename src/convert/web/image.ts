import type { ConvertFormat, ConvertSettings } from '../../types'
import { outputMime } from '../formats'

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ConvertFormat,
  quality: number,
): Promise<Blob> {
  const mime = outputMime(format)
  const q = format === 'png' ? undefined : Math.min(1, Math.max(0.01, quality / 100))

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Encode failed'))
        else resolve(blob)
      },
      mime,
      q,
    )
  })
}

async function encodeOnce(
  img: HTMLImageElement,
  format: ConvertFormat,
  quality: number,
  scalePercent: number,
): Promise<Blob> {
  const scale = Math.min(100, Math.max(1, scalePercent)) / 100
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2d context')
  if (format === 'jpg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)
  return canvasToBlob(canvas, format, quality)
}

/**
 * Encode an image in-browser. Quality + resolution drive encode.
 * If maxBytes is set, binary-search quality then reduce scale until under cap.
 */
export async function convertImageWeb(
  sourceUrl: string,
  settings: ConvertSettings,
  onProgress?: (p: number) => void,
): Promise<Blob> {
  onProgress?.(0.1)
  const img = await loadImage(sourceUrl)
  onProgress?.(0.35)

  let quality = settings.quality
  let scale = settings.resolution
  let blob = await encodeOnce(img, settings.format, quality, scale)
  onProgress?.(0.7)

  if (settings.maxBytes != null && settings.maxBytes > 0) {
    // Search quality first
    let lo = 5
    let hi = quality
    let best = blob
    for (let i = 0; i < 8; i++) {
      const mid = Math.round((lo + hi) / 2)
      const candidate = await encodeOnce(img, settings.format, mid, scale)
      if (candidate.size <= settings.maxBytes) {
        best = candidate
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    blob = best

    // Then scale if still over
    let guard = 0
    while (blob.size > settings.maxBytes && scale > 10 && guard < 10) {
      scale = Math.max(10, Math.round(scale * 0.85))
      blob = await encodeOnce(img, settings.format, Math.max(5, lo - 1 || quality), scale)
      guard++
    }
  }

  onProgress?.(1)
  return blob
}

export async function probeImageSize(
  url: string,
): Promise<{ width: number; height: number }> {
  const img = await loadImage(url)
  return { width: img.naturalWidth, height: img.naturalHeight }
}
