import JSZip from 'jszip'
import {
  canDecodeInBrowser,
  isImageExtension,
  mimeForExtension,
  normalizeExtension,
} from '../convert/formats'
import { heicToPreview, isHeicExtension } from '../convert/web/heic'
import { probeImageSize } from '../convert/web/image'
import type { FileEntry, FolderEntry } from '../types'

function uid(prefix = 'id'): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

async function probeImageSizeTimed(
  url: string,
  sourceExt: string,
  ms = 2500,
): Promise<{ width: number; height: number } | null> {
  try {
    return await Promise.race([
      probeImageSize(url, sourceExt),
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), ms)
      }),
    ])
  } catch {
    return null
  }
}

export async function createFileEntry(file: File, id = uid('file')): Promise<FileEntry> {
  const extension = normalizeExtension(file.name)
  const objectUrl = URL.createObjectURL(file)
  const entry: FileEntry = {
    id,
    name: file.name,
    extension,
    mimeType: file.type || mimeForExtension(extension),
    blob: file,
    objectUrl,
    size: file.size,
  }

  if (isHeicExtension(extension)) {
    // Browsers cannot paint HEIC in <img> — decode a JPEG preview once at ingest.
    try {
      const preview = await heicToPreview(file)
      entry.previewUrl = preview.previewUrl
      entry.width = preview.width
      entry.height = preview.height
    } catch (err) {
      console.error('HEIC preview decode failed', err)
    }
    return entry
  }

  if (
    file.type.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'].includes(extension)
  ) {
    const size = await probeImageSizeTimed(objectUrl, extension, 2500)
    if (size) {
      entry.width = size.width
      entry.height = size.height
    }
  }

  return entry
}

export function revokeFileEntry(entry: FileEntry) {
  URL.revokeObjectURL(entry.objectUrl)
  if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl)
}

/**
 * Open a hidden file input.
 * Do NOT auto-cancel on window focus — that races with directory pickers on macOS
 * Chrome/Safari and was aborting whole-folder selection before change fired.
 */
function openFileInput(configure: (input: HTMLInputElement) => void): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.style.cssText =
      'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:0;'
    configure(input)

    let settled = false
    const finish = (files: File[]) => {
      if (settled) return
      settled = true
      input.removeEventListener('change', onChange)
      input.removeEventListener('cancel', onCancel)
      input.remove()
      resolve(files)
    }
    const onChange = () => finish(Array.from(input.files ?? []))
    const onCancel = () => finish([])

    input.addEventListener('change', onChange)
    input.addEventListener('cancel', onCancel)
    document.body.appendChild(input)
    // Synchronous click — must stay inside the user-gesture stack.
    input.click()
  })
}

export async function pickFiles(): Promise<File[]> {
  return openFileInput((input) => {
    input.multiple = true
    input.accept =
      'image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.heic,.heif,.pdf'
  })
}

export type PickedFolder = {
  folderName: string
  files: { file: File; relativePath: string }[]
}

async function pickFolderViaInput(): Promise<PickedFolder | null> {
  const list = await openFileInput((input) => {
    input.multiple = true
    // Chromium + Safari + Firefox directory selection
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
    ;(input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true
    // Do not set accept — it can block directory mode in some browsers.
  })
  if (list.length === 0) return null

  const files = list.map((file) => ({
    file,
    relativePath:
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }))
  const top = files[0].relativePath.split('/').filter(Boolean)[0] || 'Folder'
  return { folderName: top, files }
}

async function pickFolderViaDirectoryPicker(): Promise<PickedFolder | null> {
  const w = window as Window & {
    showDirectoryPicker?: (opts?: {
      id?: string
      mode?: 'read' | 'readwrite'
    }) => Promise<FileSystemDirectoryHandle>
  }
  if (typeof w.showDirectoryPicker !== 'function') return null

  const dir = await w.showDirectoryPicker({ mode: 'read' })
  const files: { file: File; relativePath: string }[] = []
  await walkDirectory(dir, dir.name, files)
  return { folderName: dir.name, files }
}

/**
 * Pick an entire folder via webkitdirectory.
 *
 * IMPORTANT: Do NOT try showDirectoryPicker first and fall back after await —
 * a rejected/failed picker consumes the user gesture, so the synthetic
 * <input webkitdirectory>.click() then silently does nothing (macOS Chrome).
 * The Canvas keeps a DOM-resident folder input and clicks it synchronously;
 * this helper remains for store/tests and Shift paths that still call it.
 */
export async function pickFolder(): Promise<PickedFolder | null> {
  try {
    return await pickFolderViaInput()
  } catch (err) {
    console.warn('webkitdirectory folder pick failed', err)
    // Last resort: native directory picker (only if gesture somehow still valid).
    try {
      return await pickFolderViaDirectoryPicker()
    } catch (err2) {
      if (err2 instanceof DOMException && err2.name === 'AbortError') return null
      console.warn('showDirectoryPicker also failed', err2)
      return null
    }
  }
}

async function walkDirectory(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: { file: File; relativePath: string }[],
) {
  for await (const [name, handle] of dir.entries() as AsyncIterable<
    [string, FileSystemHandle]
  >) {
    const path = `${prefix}/${name}`
    if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile()
      out.push({ file, relativePath: path })
    } else if (handle.kind === 'directory') {
      await walkDirectory(handle as FileSystemDirectoryHandle, path, out)
    }
  }
}

export interface BuiltFolderGraph {
  folder: FolderEntry
  files: FileEntry[]
  nestedFolders: FolderEntry[]
}

/** Keep convertible / image-like files; skip junk (.DS_Store, txt, etc.). */
export function isFolderMediaFile(name: string): boolean {
  const ext = normalizeExtension(name)
  if (!ext) return false
  if (ext === 'pdf') return true
  return isImageExtension(ext) || canDecodeInBrowser(ext)
}

/** Build one top-level folder node + flat list of file entries from relative paths. */
export async function buildFolderFromFiles(
  folderName: string,
  items: { file: File; relativePath: string }[],
): Promise<BuiltFolderGraph> {
  const folderId = uid('folder')
  const files: FileEntry[] = []
  const nestedFolders: FolderEntry[] = []
  const folderByPath = new Map<string, FolderEntry>()

  const root: FolderEntry = {
    id: folderId,
    name: folderName,
    childFileIds: [],
    childFolderIds: [],
  }
  folderByPath.set(folderName, root)

  for (const item of items) {
    if (!isFolderMediaFile(item.file.name)) continue

    const parts = item.relativePath.split('/').filter(Boolean)
    // Drop leading folder name if present
    const rel = parts[0] === folderName ? parts.slice(1) : parts
    if (rel.length === 0) continue

    let parentPath = folderName
    let parent = root

    for (let i = 0; i < rel.length - 1; i++) {
      const seg = rel[i]
      const path = `${parentPath}/${seg}`
      let child = folderByPath.get(path)
      if (!child) {
        child = {
          id: uid('folder'),
          name: seg,
          childFileIds: [],
          childFolderIds: [],
        }
        folderByPath.set(path, child)
        nestedFolders.push(child)
        if (!parent.childFolderIds.includes(child.id)) {
          parent.childFolderIds.push(child.id)
        }
      }
      parent = child
      parentPath = path
    }

    const fileName = rel[rel.length - 1]
    const entry = await createFileEntry(
      new File([item.file], fileName, { type: item.file.type }),
    )
    files.push(entry)
    parent.childFileIds.push(entry.id)
  }

  return { folder: root, files, nestedFolders }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function zipFiles(
  files: { name: string; blob: Blob }[],
  zipName: string,
): Promise<Blob> {
  const zip = new JSZip()
  for (const f of files) {
    zip.file(f.name, f.blob)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, zipName.endsWith('.zip') ? zipName : `${zipName}.zip`)
  return blob
}

/** Build a zip Blob without triggering download (for tests). */
export async function buildZipBlob(
  files: { name: string; blob: Blob }[],
): Promise<Blob> {
  const zip = new JSZip()
  for (const f of files) {
    zip.file(f.name, f.blob)
  }
  return zip.generateAsync({ type: 'blob' })
}

export async function readDroppedItems(
  dataTransfer: DataTransfer,
): Promise<{
  files: File[]
  folders: { folderName: string; files: { file: File; relativePath: string }[] }[]
}> {
  const files: File[] = []
  const folders: {
    folderName: string
    files: { file: File; relativePath: string }[]
  }[] = []

  const items = Array.from(dataTransfer.items ?? [])
  if (items.length > 0 && items.some((i) => typeof i.webkitGetAsEntry === 'function')) {
    const entries = items
      .map((i) => i.webkitGetAsEntry())
      .filter((e): e is FileSystemEntry => !!e)

    if (entries.length > 0) {
      for (const entry of entries) {
        if (entry.isFile) {
          const file = await entryToFile(entry as FileSystemFileEntry)
          files.push(file)
        } else if (entry.isDirectory) {
          const collected: { file: File; relativePath: string }[] = []
          await readDirEntry(entry as FileSystemDirectoryEntry, entry.name, collected)
          folders.push({ folderName: entry.name, files: collected })
        }
      }
      return { files, folders }
    }
  }

  // Fallback: group files that carry webkitRelativePath (folder drop without entries API).
  const raw = Array.from(dataTransfer.files ?? [])
  const byRoot = new Map<string, { file: File; relativePath: string }[]>()
  const loose: File[] = []
  for (const file of raw) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || ''
    if (rel.includes('/')) {
      const root = rel.split('/')[0]!
      const list = byRoot.get(root) ?? []
      list.push({ file, relativePath: rel })
      byRoot.set(root, list)
    } else {
      loose.push(file)
    }
  }
  for (const [folderName, group] of byRoot) {
    folders.push({ folderName, files: group })
  }
  files.push(...loose)
  return { files, folders }
}

function entryToFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject)
  })
}

function readDirEntry(
  dir: FileSystemDirectoryEntry,
  prefix: string,
  out: { file: File; relativePath: string }[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = dir.createReader()
    const readBatch = () => {
      reader.readEntries(async (batch) => {
        try {
          if (batch.length === 0) {
            resolve()
            return
          }
          for (const entry of batch) {
            const path = `${prefix}/${entry.name}`
            if (entry.isFile) {
              const file = await entryToFile(entry as FileSystemFileEntry)
              out.push({ file, relativePath: path })
            } else if (entry.isDirectory) {
              await readDirEntry(entry as FileSystemDirectoryEntry, path, out)
            }
          }
          readBatch()
        } catch (err) {
          reject(err)
        }
      }, reject)
    }
    readBatch()
  })
}
