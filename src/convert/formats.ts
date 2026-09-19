import type { ConvertFormat } from '../types'

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
  'pdf',
])

/**
 * Formats we can actually encode in the browser today.
 * HEIC/HEIF encode is deferred (no viable in-browser encoder yet).
 */
export const WEB_ENCODE_FORMATS: ConvertFormat[] = [
  'png',
  'jpg',
  'webp',
  'avif',
  'gif',
  'bmp',
  'pdf',
]

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
  const e = ext.toLowerCase()
  return IMAGE_EXTENSIONS.has(e) && e !== 'pdf'
}

export function canDecodeInBrowser(ext: string): boolean {
  const e = ext.toLowerCase()
  // AVIF decode via <img> when the browser supports it; HEIC typically does not.
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'].includes(e)
}

/** Map a file extension to an encode format when we can produce it. */
export function encodeFormatFromExtension(ext: string): ConvertFormat | null {
  const e = ext.toLowerCase() === 'jpeg' ? 'jpg' : ext.toLowerCase()
  if ((WEB_ENCODE_FORMATS as string[]).includes(e)) {
    return e as ConvertFormat
  }
  return null
}

/**
 * Compatible encode targets for a source.
 * Source’s own format is listed first when we can encode it (re-encode / same type),
 * then the remaining web encode formats. Never lists formats we cannot encode.
 * HEIC is decode-limited and never appears as a target.
 */
export function compatibleTargets(
  sourceExt: string,
  available: ConvertFormat[] = WEB_ENCODE_FORMATS,
): ConvertFormat[] {
  if (!isImageExtension(sourceExt) || !canDecodeInBrowser(sourceExt)) {
    return []
  }
  const src = encodeFormatFromExtension(sourceExt)
  const rest = available.filter((f) => f !== src)
  if (src && available.includes(src)) {
    return [src, ...rest]
  }
  return rest.length ? rest : [...available]
}

export function outputMime(format: ConvertFormat): string {
  if (format === 'jpg') return 'image/jpeg'
  if (format === 'png') return 'image/png'
  if (format === 'webp') return 'image/webp'
  if (format === 'avif') return 'image/avif'
  if (format === 'gif') return 'image/gif'
  if (format === 'bmp') return 'image/bmp'
  if (format === 'pdf') return 'application/pdf'
  return 'application/octet-stream'
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
