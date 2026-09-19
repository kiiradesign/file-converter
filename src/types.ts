export type ImageFormat = 'png' | 'jpg' | 'webp' | 'avif' | 'gif' | 'bmp'

/** Document targets we can produce in the browser (includes PDF). */
export type ConvertFormat = ImageFormat | 'pdf'

export interface ConvertSettings {
  format: ConvertFormat
  quality: number
  resolution: number
  /** Optional max output bytes. Stubbed / best-effort in milestone 1. */
  maxBytes: number | null
}

export interface FileEntry {
  id: string
  name: string
  extension: string
  mimeType: string
  blob: Blob
  objectUrl: string
  size: number
  width?: number
  height?: number
}

export interface FolderEntry {
  id: string
  name: string
  /** Child file entry ids (and nested folder ids). */
  childFileIds: string[]
  childFolderIds: string[]
}

export type JobStatus = 'queued' | 'running' | 'done' | 'error'

export interface ConversionJob {
  id: string
  sourceFileId: string
  resultNodeId: string
  settings: ConvertSettings
  status: JobStatus
  progress: number
  error?: string
  resultBlob?: Blob
  resultObjectUrl?: string
  resultSize?: number
}

export const DEFAULT_SETTINGS: ConvertSettings = {
  format: 'webp',
  quality: 100,
  resolution: 100,
  maxBytes: null,
}
