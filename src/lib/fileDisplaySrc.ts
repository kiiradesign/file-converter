import { isHeicSource } from '../convert/web/heic'
import { normalizeExtension } from '../convert/formats'
import type { FileEntry } from '../types'

/** Browsers cannot paint HEIC/HEIF in `<img src="blob:…">`. */
export function isHeicLikeFile(
  file: Pick<FileEntry, 'extension' | 'mimeType' | 'name'>,
): boolean {
  if (isHeicSource(file.extension, file.mimeType)) return true
  if (file.name) {
    return isHeicSource(normalizeExtension(file.name), file.mimeType)
  }
  return false
}

/**
 * URL safe for `<img>` thumbnails on the canvas.
 * Prefer JPEG `previewUrl` from libheif ingest for HEIC; keep `objectUrl` for conversion.
 */
export function fileThumbnailSrc(
  file: FileEntry | undefined,
  opts: { isResult: boolean },
): string | null {
  if (!file) return null

  if (opts.isResult) {
    return file.previewUrl ?? null
  }

  if (file.previewUrl) return file.previewUrl
  if (isHeicLikeFile(file)) return null
  return file.objectUrl || null
}

/** Converted output blob URL — only meaningful on result nodes with a finished blob. */
export function fileOutputSrc(
  file: FileEntry | undefined,
  isResult: boolean,
): string | null {
  if (!isResult || !file?.objectUrl || (file.size ?? 0) <= 0) return null
  return file.objectUrl
}
