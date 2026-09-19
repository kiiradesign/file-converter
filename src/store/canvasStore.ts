import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react'
import { create } from 'zustand'
import {
  compatibleTargets,
  rewriteExtension,
  WEB_ENCODE_FORMATS,
} from '../convert/formats'
import { runConversion } from '../convert/jobs'
import {
  buildFolderFromFiles,
  createFileEntry,
  downloadBlob,
  pickFiles,
  pickFolder,
  readDroppedItems,
  zipFiles,
} from '../io'
import type {
  ConvertFormat,
  ConvertSettings,
  FileEntry,
  FolderEntry,
} from '../types'
import { DEFAULT_SETTINGS } from '../types'

export type FileNodeData = {
  kind: 'file'
  fileId: string
  label: string
  isResult: boolean
  /** Which folder canvas this node lives on. null = root. */
  canvasId: string | null
  settings?: ConvertSettings
  jobStatus?: 'idle' | 'running' | 'done' | 'error'
  jobProgress?: number
  sourceNodeId?: string
}

export type FolderNodeData = {
  kind: 'folder'
  folderId: string
  label: string
  isResult: boolean
  settings?: ConvertSettings
  /** Which folder canvas this node lives on. null = root. */
  canvasId: string | null
  jobStatus?: 'idle' | 'running' | 'done' | 'error'
}

export type AppNodeData = FileNodeData | FolderNodeData
export type AppNode = Node<AppNodeData>
export type AppEdge = Edge<{ settings?: ConvertSettings }>

interface DraftConnection {
  sourceNodeId: string
  /** screen or flow position for panel anchoring */
  cursorFlow: XYPosition
  settings: ConvertSettings
  mode: 'connect' | 'adjust'
  /** When adjusting, the node being adjusted (source of new chain). */
  adjustFromNodeId?: string
}

interface CanvasState {
  nodes: AppNode[]
  edges: AppEdge[]
  files: Record<string, FileEntry>
  folders: Record<string, FolderEntry>
  /** Stack of folder ids for drill-in. Empty = root canvas. */
  folderStack: string[]
  theme: 'dark' | 'light'
  draft: DraftConnection | null
  zoom: number

  setZoom: (z: number) => void
  toggleTheme: () => void

  onNodesChange: (changes: NodeChange<AppNode>[]) => void
  onEdgesChange: (changes: EdgeChange<AppEdge>[]) => void
  onConnect: (connection: Connection) => void

  currentFolderId: () => string | null
  visibleNodes: () => AppNode[]
  visibleEdges: () => AppEdge[]

  addFilesAt: (files: File[], position: XYPosition) => Promise<void>
  addFolderAt: (
    folderName: string,
    items: { file: File; relativePath: string }[],
    position: XYPosition,
  ) => Promise<void>
  handleDrop: (dt: DataTransfer, position: XYPosition) => Promise<void>
  openFilePicker: (position: XYPosition) => Promise<void>
  openFolderPicker: (position: XYPosition) => Promise<void>

  enterFolder: (folderId: string) => void
  goBack: () => void
  goToStackIndex: (index: number) => void

  startConnect: (sourceNodeId: string, cursorFlow: XYPosition) => void
  startAdjust: (nodeId: string, cursorFlow: XYPosition) => void
  updateDraftCursor: (cursorFlow: XYPosition) => void
  updateDraftSettings: (partial: Partial<ConvertSettings>) => void
  cancelDraft: () => void
  confirmDraft: () => Promise<void>

  saveNode: (nodeId: string) => Promise<void>
}

function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

/** Display label: preserve OS filename case; only swap extension for results. */
function fileLabel(name: string, isResult: boolean, format?: ConvertFormat): string {
  if (isResult && format) return rewriteExtension(name, format)
  return name
}

function formatFromExtension(ext: string): ConvertFormat {
  const e = ext.toLowerCase() === 'jpeg' ? 'jpg' : ext.toLowerCase()
  if (e === 'png' || e === 'jpg' || e === 'webp') return e
  return DEFAULT_SETTINGS.format
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  files: {},
  folders: {},
  folderStack: [],
  theme: 'dark',
  draft: null,
  zoom: 1,

  setZoom: (z) => set({ zoom: z }),
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),
  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),
  onConnect: (connection) =>
    set((s) => ({ edges: addEdge(connection, s.edges) })),

  currentFolderId: () => {
    const stack = get().folderStack
    return stack.length ? stack[stack.length - 1] : null
  },

  visibleNodes: () => {
    const current = get().currentFolderId()
    return get().nodes.filter((n) => n.data.canvasId === current)
  },

  visibleEdges: () => {
    const visible = new Set(get().visibleNodes().map((n) => n.id))
    return get().edges.filter((e) => visible.has(e.source) && visible.has(e.target))
  },

  addFilesAt: async (fileList, position) => {
    const canvasId = get().currentFolderId()
    const files = { ...get().files }
    const nodes = [...get().nodes]
    const folders = { ...get().folders }

    let i = 0
    for (const file of fileList) {
      const entry = await createFileEntry(file)
      files[entry.id] = entry
      const id = uid('node')
      nodes.push({
        id,
        type: 'file',
        position: { x: position.x + i * 40, y: position.y + i * 40 },
        data: {
          kind: 'file',
          fileId: entry.id,
          label: fileLabel(entry.name, false),
          isResult: false,
          canvasId,
          jobStatus: 'idle',
        },
      })
      if (canvasId && folders[canvasId]) {
        folders[canvasId] = {
          ...folders[canvasId],
          childFileIds: [...folders[canvasId].childFileIds, entry.id],
        }
      }
      i++
    }
    set({ files, nodes, folders })
  },

  addFolderAt: async (folderName, items, position) => {
    const canvasId = get().currentFolderId()
    const graph = await buildFolderFromFiles(folderName, items)
    const files = { ...get().files }
    const folders = { ...get().folders }
    const nodes = [...get().nodes]

    for (const f of graph.files) files[f.id] = f
    folders[graph.folder.id] = graph.folder
    for (const nf of graph.nestedFolders) folders[nf.id] = nf

    nodes.push({
      id: uid('node'),
      type: 'folder',
      position,
      data: {
        kind: 'folder',
        folderId: graph.folder.id,
        label: graph.folder.name,
        isResult: false,
        canvasId,
        jobStatus: 'idle',
      },
    })

    let i = 0
    for (const fileId of graph.folder.childFileIds) {
      const entry = files[fileId]
      nodes.push({
        id: uid('node'),
        type: 'file',
        position: { x: 80 + (i % 4) * 220, y: 80 + Math.floor(i / 4) * 280 },
        data: {
          kind: 'file',
          fileId: entry.id,
          label: fileLabel(entry.name, false),
          isResult: false,
          canvasId: graph.folder.id,
          jobStatus: 'idle',
        },
      })
      i++
    }

    for (const nf of graph.nestedFolders) {
      if (graph.folder.childFolderIds.includes(nf.id)) {
        nodes.push({
          id: uid('node'),
          type: 'folder',
          position: { x: 80 + i * 160, y: 80 },
          data: {
            kind: 'folder',
            folderId: nf.id,
            label: nf.name,
            isResult: false,
            canvasId: graph.folder.id,
            jobStatus: 'idle',
          },
        })
        i++
      }
    }

    if (canvasId && folders[canvasId]) {
      folders[canvasId] = {
        ...folders[canvasId],
        childFolderIds: [...folders[canvasId].childFolderIds, graph.folder.id],
      }
    }

    set({ files, folders, nodes })
  },

  handleDrop: async (dt, position) => {
    const { files, folders } = await readDroppedItems(dt)
    if (folders.length) {
      for (let i = 0; i < folders.length; i++) {
        const f = folders[i]
        await get().addFolderAt(f.folderName, f.files, {
          x: position.x + i * 80,
          y: position.y + i * 40,
        })
      }
    }
    if (files.length) {
      await get().addFilesAt(files, position)
    }
  },

  openFilePicker: async (position) => {
    const files = await pickFiles()
    if (files.length) await get().addFilesAt(files, position)
  },

  openFolderPicker: async (position) => {
    const result = await pickFolder()
    if (!result) return
    await get().addFolderAt(result.folderName, result.files, position)
  },

  enterFolder: (folderId) => {
    set((s) => ({
      folderStack: [...s.folderStack, folderId],
      draft: null,
    }))
  },

  goBack: () => {
    set((s) => ({
      folderStack: s.folderStack.slice(0, -1),
      draft: null,
    }))
  },

  goToStackIndex: (index) => {
    set((s) => ({
      folderStack: s.folderStack.slice(0, index + 1),
      draft: null,
    }))
  },

  startConnect: (sourceNodeId, cursorFlow) => {
    const node = get().nodes.find((n) => n.id === sourceNodeId)
    if (!node) return

    let format: ConvertFormat = DEFAULT_SETTINGS.format
    if (node.data.kind === 'file') {
      const file = get().files[node.data.fileId]
      const targets = compatibleTargets(file?.extension ?? '', WEB_ENCODE_FORMATS)
      format = targets[0] ?? 'webp'
    } else {
      format = 'webp'
    }

    set({
      draft: {
        sourceNodeId,
        cursorFlow,
        settings: { ...DEFAULT_SETTINGS, format },
        mode: 'connect',
      },
    })
  },

  startAdjust: (nodeId, cursorFlow) => {
    const node = get().nodes.find((n) => n.id === nodeId)
    if (!node || node.data.kind !== 'file') return
    const file = get().files[node.data.fileId]
    const format = node.data.settings?.format ?? formatFromExtension(file?.extension ?? '')
    const settings: ConvertSettings = {
      ...DEFAULT_SETTINGS,
      ...node.data.settings,
      format,
      // Adjust keeps the same type; sliders start at product defaults unless reusing prior job settings.
      quality: node.data.settings?.quality ?? DEFAULT_SETTINGS.quality,
      resolution: node.data.settings?.resolution ?? DEFAULT_SETTINGS.resolution,
      maxBytes: node.data.settings?.maxBytes ?? null,
    }
    set({
      draft: {
        sourceNodeId: nodeId,
        cursorFlow,
        settings,
        mode: 'adjust',
        adjustFromNodeId: nodeId,
      },
    })
  },

  updateDraftCursor: (cursorFlow) => {
    const draft = get().draft
    if (!draft) return
    set({ draft: { ...draft, cursorFlow } })
  },

  updateDraftSettings: (partial) => {
    const draft = get().draft
    if (!draft) return
    set({
      draft: { ...draft, settings: { ...draft.settings, ...partial } },
    })
  },

  cancelDraft: () => set({ draft: null }),

  confirmDraft: async () => {
    const draft = get().draft
    if (!draft) return
    const sourceNode = get().nodes.find((n) => n.id === draft.sourceNodeId)
    if (!sourceNode) {
      set({ draft: null })
      return
    }

    const settings = { ...draft.settings }
    const offset =
      draft.mode === 'adjust'
        ? { x: 280, y: 40 }
        : { x: 280, y: 0 }

    if (sourceNode.data.kind === 'folder') {
      await convertFolder(get, set, sourceNode, settings, offset)
      set({ draft: null })
      return
    }

    await convertFileNode(get, set, sourceNode, settings, offset)
    set({ draft: null })
  },

  saveNode: async (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId)
    if (!node) return

    if (node.data.kind === 'file') {
      const file = get().files[node.data.fileId]
      if (!file) return
      const name = node.data.isResult && node.data.settings
        ? rewriteExtension(file.name, node.data.settings.format)
        : file.name
      downloadBlob(file.blob, name)
      return
    }

    // Folder save → zip convertible / all child files (prefer result folder contents)
    const folder = get().folders[node.data.folderId]
    if (!folder) return
    const items: { name: string; blob: Blob }[] = []

    const collect = (f: FolderEntry, prefix: string) => {
      for (const fid of f.childFileIds) {
        const file = get().files[fid]
        if (file) items.push({ name: prefix ? `${prefix}/${file.name}` : file.name, blob: file.blob })
      }
      for (const cid of f.childFolderIds) {
        const child = get().folders[cid]
        if (child) collect(child, prefix ? `${prefix}/${child.name}` : child.name)
      }
    }
    collect(folder, '')
    await zipFiles(items, `${folder.name}.zip`)
  },
}))

type Get = () => CanvasState
type Set = (
  partial: Partial<CanvasState> | ((s: CanvasState) => Partial<CanvasState>),
) => void

async function convertFileNode(
  get: Get,
  set: Set,
  sourceNode: AppNode,
  settings: ConvertSettings,
  offset: XYPosition,
) {
  if (sourceNode.data.kind !== 'file') return
  const sourceFile = get().files[sourceNode.data.fileId]
  if (!sourceFile) return

  const resultNodeId = uid('node')
  const resultFileId = uid('file')
  const canvasId = sourceNode.data.canvasId

  const placeholder: FileEntry = {
    id: resultFileId,
    name: rewriteExtension(sourceFile.name, settings.format),
    extension: settings.format === 'jpg' ? 'jpg' : settings.format,
    mimeType: 'application/octet-stream',
    blob: new Blob(),
    objectUrl: '',
    size: 0,
    width: sourceFile.width,
    height: sourceFile.height,
  }

  set((s) => ({
    files: { ...s.files, [resultFileId]: placeholder },
    nodes: [
      ...s.nodes,
      {
        id: resultNodeId,
        type: 'file',
        position: {
          x: sourceNode.position.x + offset.x,
          y: sourceNode.position.y + offset.y,
        },
        data: {
          kind: 'file',
          fileId: resultFileId,
          label: fileLabel(sourceFile.name, true, settings.format),
          isResult: true,
          canvasId,
          settings,
          jobStatus: 'running',
          jobProgress: 0,
          sourceNodeId: sourceNode.id,
        },
      },
    ],
    edges: [
      ...s.edges,
      {
        id: uid('edge'),
        source: sourceNode.id,
        target: resultNodeId,
        type: 'conversion',
        data: { settings },
      },
    ],
  }))

  try {
    const blob = await runConversion(sourceFile, settings, (p) => {
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === resultNodeId && n.data.kind === 'file'
            ? { ...n, data: { ...n.data, jobProgress: p } }
            : n,
        ),
      }))
    })
    const objectUrl = URL.createObjectURL(blob)
    const entry: FileEntry = {
      ...placeholder,
      blob,
      objectUrl,
      size: blob.size,
      mimeType: blob.type,
    }

    // Probe dimensions
    try {
      const img = new Image()
      await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej()
        img.src = objectUrl
      })
      entry.width = img.naturalWidth
      entry.height = img.naturalHeight
    } catch {
      /* ignore */
    }

    set((s) => ({
      files: { ...s.files, [resultFileId]: entry },
      nodes: s.nodes.map((n) =>
        n.id === resultNodeId && n.data.kind === 'file'
          ? {
              ...n,
              data: {
                ...n.data,
                jobStatus: 'done',
                jobProgress: 1,
              },
            }
          : n,
      ),
    }))
  } catch (err) {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === resultNodeId && n.data.kind === 'file'
          ? {
              ...n,
              data: {
                ...n.data,
                jobStatus: 'error',
                jobProgress: 1,
              },
            }
          : n,
      ),
    }))
    console.error(err)
  }
}

async function convertFolder(
  get: Get,
  set: Set,
  sourceNode: AppNode,
  settings: ConvertSettings,
  offset: XYPosition,
) {
  if (sourceNode.data.kind !== 'folder') return
  const sourceFolder = get().folders[sourceNode.data.folderId]
  if (!sourceFolder) return

  const newFolderId = uid('folder')
  const resultNodeId = uid('node')
  const canvasId = sourceNode.data.canvasId

  const newFolder: FolderEntry = {
    id: newFolderId,
    name: `New ${sourceFolder.name}`,
    childFileIds: [],
    childFolderIds: [],
  }

  set((s) => ({
    folders: { ...s.folders, [newFolderId]: newFolder },
    nodes: [
      ...s.nodes,
      {
        id: resultNodeId,
        type: 'folder',
        position: {
          x: sourceNode.position.x + offset.x,
          y: sourceNode.position.y + offset.y,
        },
        data: {
          kind: 'folder',
          folderId: newFolderId,
          label: newFolder.name,
          isResult: true,
          canvasId,
          settings,
          jobStatus: 'running',
        },
      },
    ],
    edges: [
      ...s.edges,
      {
        id: uid('edge'),
        source: sourceNode.id,
        target: resultNodeId,
        type: 'conversion',
        data: { settings },
      },
    ],
  }))

  const childIds = [...sourceFolder.childFileIds]
  const newChildIds: string[] = []
  const filesUpdate: Record<string, FileEntry> = {}
  const newNodes: AppNode[] = []

  let i = 0
  for (const fid of childIds) {
    const sourceFile = get().files[fid]
    if (!sourceFile) continue
    const targets = compatibleTargets(sourceFile.extension, WEB_ENCODE_FORMATS)
    if (!targets.includes(settings.format) && targets.length === 0) continue
    if (!compatibleTargets(sourceFile.extension, WEB_ENCODE_FORMATS).length) continue

    try {
      const blob = await runConversion(sourceFile, settings)
      const objectUrl = URL.createObjectURL(blob)
      const resultFileId = uid('file')
      const entry: FileEntry = {
        id: resultFileId,
        name: rewriteExtension(sourceFile.name, settings.format),
        extension: settings.format === 'jpg' ? 'jpg' : settings.format,
        mimeType: blob.type,
        blob,
        objectUrl,
        size: blob.size,
      }
      filesUpdate[resultFileId] = entry
      newChildIds.push(resultFileId)
      newNodes.push({
        id: uid('node'),
        type: 'file',
        position: { x: 80 + (i % 4) * 220, y: 80 + Math.floor(i / 4) * 280 },
        data: {
          kind: 'file',
          fileId: resultFileId,
          label: fileLabel(sourceFile.name, true, settings.format),
          isResult: true,
          canvasId: newFolderId,
          settings,
          jobStatus: 'done',
          jobProgress: 1,
        },
      })
      i++
    } catch (e) {
      console.error(e)
    }
  }

  set((s) => ({
    files: { ...s.files, ...filesUpdate },
    folders: {
      ...s.folders,
      [newFolderId]: { ...s.folders[newFolderId], childFileIds: newChildIds },
    },
    nodes: [
      ...s.nodes.map((n) =>
        n.id === resultNodeId && n.data.kind === 'folder'
          ? { ...n, data: { ...n.data, jobStatus: 'done' as const } }
          : n,
      ),
      ...newNodes,
    ],
  }))
}
