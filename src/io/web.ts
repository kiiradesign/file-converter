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

  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(extension)) {
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

export async function pickFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp'
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.click()
  })
}

export async function pickFolder(): Promise<{
  folderName: string
  files: { file: File; relativePath: string }[]
} | null> {
  // Prefer File System Access API when available
  const w = window as Window & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
  }

  if (typeof w.showDirectoryPicker === 'function') {
    try {
      const dir = await w.showDirectoryPicker()
      const files: { file: File; relativePath: string }[] = []
      await walkDirectory(dir, dir.name, files)
      return { folderName: dir.name, files }
    } catch {
      // user cancelled or denied
      return null
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    ;(input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true
    input.onchange = () => {
      const list = Array.from(input.files ?? [])
      if (list.length === 0) {
        resolve(null)
        return
      }
      const files = list.map((file) => ({
        file,
        relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      }))
      const top = files[0].relativePath.split('/')[0] || 'Folder'
      resolve({ folderName: top, files })
    }
    input.click()
  })
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

  for (const file of Array.from(dataTransfer.files ?? [])) {
    files.push(file)
  }
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
      }, reject)
    }
    readBatch()
  })
}
