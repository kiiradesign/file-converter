import type { ConvertFormat, ImageFormat } from '../types'

export const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'avif',
  'heic',
  'heif',
])

/** Formats we can actually encode in the browser for milestone 1. */
export const WEB_ENCODE_FORMATS: ImageFormat[] = ['png', 'jpg', 'webp']

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
}

export function normalizeExtension(name: string): string {
  const i = name.lastIndexOf('.')
  if (i < 0) return ''
  return name.slice(i + 1).toLowerCase()
}

export function basenameWithoutExt(name: string): string {
  const i = name.lastIndexOf('.')
  if (i <= 0) return name
  return name.slice(0, i)
}

export function mimeForExtension(ext: string): string {
  return MIME_BY_EXT[ext.toLowerCase()] ?? 'application/octet-stream'
}

export function isImageExtension(ext: string): boolean {
  return IMAGE_EXTENSIONS.has(ext.toLowerCase())
}

export function canDecodeInBrowser(ext: string): boolean {
  const e = ext.toLowerCase()
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(e)
}

/** Compatible encode targets for a source, given current runtime capabilities. */
export function compatibleTargets(
  sourceExt: string,
  available: ConvertFormat[] = WEB_ENCODE_FORMATS,
): ConvertFormat[] {
  if (!isImageExtension(sourceExt) || !canDecodeInBrowser(sourceExt)) {
    return []
  }
  const src = sourceExt.toLowerCase() === 'jpeg' ? 'jpg' : sourceExt.toLowerCase()
  return available.filter((f) => f !== src || available.length === 1)
}

export function outputMime(format: ConvertFormat): string {
  if (format === 'jpg') return 'image/jpeg'
  if (format === 'png') return 'image/png'
  return 'image/webp'
}

export function formatLabel(format: ConvertFormat): string {
  return format.toUpperCase()
}

export function rewriteExtension(originalName: string, format: ConvertFormat): string {
  const base = basenameWithoutExt(originalName)
  const ext = format === 'jpg' ? 'jpg' : format
  return `${base}.${ext}`
}
