import type { ConvertFormat, ConvertSettings } from '../../types'
import { outputMime } from '../formats'
import { encodeAvifBlob } from './avif'
import { encodeBmp } from './bmp'
import { encodeGif } from './gif'
import { isHeicExtension, loadHeicAsImage } from './heic'
import { encodePdf } from './pdf'

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = url
  })
}

/** Decode any supported source — HEIC/HEIF via libheif, else browser <img>. */
async function loadDecodedImage(
  url: string,
  sourceExt?: string,
): Promise<HTMLImageElement> {
  if (sourceExt && isHeicExtension(sourceExt)) {
    return loadHeicAsImage(url)
  }
  return loadImage(url)
}

function drawScaled(
  img: HTMLImageElement,
  format: ConvertFormat,
  scalePercent: number,
): { canvas: HTMLCanvasElement; imageData: ImageData } {
  const scale = Math.min(100, Math.max(1, scalePercent)) / 100
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No 2d context')
  if (format === 'jpg' || format === 'bmp') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)
  return { canvas, imageData: ctx.getImageData(0, 0, w, h) }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpg' | 'webp',
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
  const { canvas, imageData } = drawScaled(img, format, scalePercent)

  if (format === 'png' || format === 'jpg' || format === 'webp') {
    return canvasToBlob(canvas, format, quality)
  }
  if (format === 'avif') {
    return encodeAvifBlob(imageData, quality)
  }
  if (format === 'gif') {
    // Fewer colors at lower quality ≈ smaller palette.
    const colors = Math.max(8, Math.round(32 + (quality / 100) * 224))
    return encodeGif(imageData, colors)
  }
  if (format === 'bmp') {
    return encodeBmp(imageData)
  }
  if (format === 'pdf') {
    return encodePdf(imageData)
  }
  throw new Error(`Unsupported encode format: ${format}`)
}

/**
 * Encode an image in-browser. Quality + resolution drive encode where supported.
 * If maxBytes is set, binary-search quality then reduce scale until under cap.
 * Pass `sourceExt` so HEIC/HEIF can be decoded via libheif.
 */
export async function convertImageWeb(
  sourceUrl: string,
  settings: ConvertSettings,
  onProgress?: (p: number) => void,
  sourceExt?: string,
): Promise<Blob> {
  onProgress?.(0.1)
  const img = await loadDecodedImage(sourceUrl, sourceExt)
  onProgress?.(0.35)

  let quality = settings.quality
  let scale = settings.resolution
  let blob = await encodeOnce(img, settings.format, quality, scale)
  onProgress?.(0.7)

  const qualityDriven =
    settings.format === 'jpg' ||
    settings.format === 'webp' ||
    settings.format === 'avif' ||
    settings.format === 'gif'

  if (settings.maxBytes != null && settings.maxBytes > 0 && qualityDriven) {
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

    let guard = 0
    while (blob.size > settings.maxBytes && scale > 10 && guard < 10) {
      scale = Math.max(10, Math.round(scale * 0.85))
      blob = await encodeOnce(img, settings.format, Math.max(5, lo - 1 || quality), scale)
      guard++
    }
  } else if (settings.maxBytes != null && settings.maxBytes > 0) {
    // PNG/BMP/PDF: only resolution helps size.
    let guard = 0
    while (blob.size > settings.maxBytes && scale > 10 && guard < 10) {
      scale = Math.max(10, Math.round(scale * 0.85))
      blob = await encodeOnce(img, settings.format, quality, scale)
      guard++
    }
  }

  onProgress?.(1)
  return blob
}

export async function probeImageSize(
  url: string,
  sourceExt?: string,
): Promise<{ width: number; height: number }> {
  const img = await loadDecodedImage(url, sourceExt)
  return { width: img.naturalWidth, height: img.naturalHeight }
}
