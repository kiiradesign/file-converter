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

/**
 * Ensure a result filename is unique among taken names.
 * Prefers the desired name; otherwise stem-2.ext, stem-3.ext, …
 * Preserves the stem’s case.
 */
export function uniqueFileName(desired: string, taken: Iterable<string>): string {
  const used = new Set(
    [...taken].filter(Boolean).map((n) => n.toLowerCase()),
  )
  if (!used.has(desired.toLowerCase())) return desired

  const base = basenameWithoutExt(desired)
  const dot = desired.lastIndexOf('.')
  const ext = dot >= 0 ? desired.slice(dot + 1) : ''
  let i = 2
  while (i < 10_000) {
    const candidate = ext ? `${base}-${i}.${ext}` : `${base}-${i}`
    if (!used.has(candidate.toLowerCase())) return candidate
    i++
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}${ext ? `.${ext}` : ''}`
}
