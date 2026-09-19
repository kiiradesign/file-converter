import JSZip from 'jszip'
import { mimeForExtension, normalizeExtension } from '../convert/formats'
import { probeImageSize } from '../convert/web/image'
import type { FileEntry, FolderEntry } from '../types'

function uid(prefix = 'id'): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
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

  if (
    file.type.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'].includes(extension)
  ) {
    try {
      const size = await probeImageSize(objectUrl)
      entry.width = size.width
      entry.height = size.height
    } catch {
      // non-image or undecodable
    }
  }

  return entry
}

export function revokeFileEntry(entry: FileEntry) {
  URL.revokeObjectURL(entry.objectUrl)
}

/** Open a hidden file input reliably across Chromium / Safari / Firefox. */
function openFileInput(configure: (input: HTMLInputElement) => void): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;'
    configure(input)

    let settled = false
    const finish = (files: File[]) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(files)
    }
    const cleanup = () => {
      input.removeEventListener('change', onChange)
      input.removeEventListener('cancel', onCancel)
      window.removeEventListener('focus', onFocus)
      input.remove()
    }
    const onChange = () => finish(Array.from(input.files ?? []))
    const onCancel = () => finish([])
    // Some browsers never fire cancel — treat return-to-window with empty as cancel.
    const onFocus = () => {
      window.setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) finish([])
      }, 500)
    }

    input.addEventListener('change', onChange)
    input.addEventListener('cancel', onCancel)
    document.body.appendChild(input)
    window.addEventListener('focus', onFocus)
    input.click()
  })
}

export async function pickFiles(): Promise<File[]> {
  return openFileInput((input) => {
    input.multiple = true
    input.accept = 'image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.pdf'
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
 * Pick an entire folder.
 * Prefer File System Access API; fall back to webkitdirectory input.
 */
export async function pickFolder(): Promise<PickedFolder | null> {
  const w = window as Window & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
  }

  if (typeof w.showDirectoryPicker === 'function') {
    try {
      return await pickFolderViaDirectoryPicker()
    } catch (err) {
      // User cancelled the native directory picker.
      if (err instanceof DOMException && err.name === 'AbortError') return null
      // API present but failed — fall through to <input webkitdirectory>.
    }
  }

  try {
    return await pickFolderViaInput()
  } catch {
    return null
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
  a.click()
  URL.revokeObjectURL(url)
}

export async function zipFiles(
  files: { name: string; blob: Blob }[],
  zipName: string,
): Promise<void> {
  const zip = new JSZip()
  for (const f of files) {
    zip.file(f.name, f.blob)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, zipName.endsWith('.zip') ? zipName : `${zipName}.zip`)
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
