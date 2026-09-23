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
  canDecodeInBrowser,
  compatibleTargets,
  encodeFormatFromExtension,
  resultFolderName,
  rewriteExtension,
  uniqueFileName,
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
import {
  buildCanvasObstacleRects,
  rectAt,
  resolveParentImportPosition,
  estimateImportNodeSize,
} from '../lib/importNodePlacement'
import { computeDefaultResultPosition } from '../lib/resultNodePlacement'
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
  /** True while the conversion dither wave should play (cleared when wave finishes). */
  conversionWavePending?: boolean
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
  /** Patch intrinsic pixel size once the browser (or HEIC decode) reports it. */
  setFileDimensions: (fileId: string, width: number, height: number) => void
  finishConversionWave: (nodeId: string) => void
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
  return encodeFormatFromExtension(ext) ?? DEFAULT_SETTINGS.format
}

/** Names already used by file nodes on a canvas (labels + stored file names). */
function takenNamesOnCanvas(
  nodes: AppNode[],
  files: Record<string, FileEntry>,
  canvasId: string | null,
): string[] {
  const names: string[] = []
  for (const n of nodes) {
    if (n.data.canvasId !== canvasId) continue
    if (n.data.kind !== 'file') continue
    if (n.data.label) names.push(n.data.label)
    const f = files[n.data.fileId]
    if (f?.name) names.push(f.name)
  }
  return names
}

function uniqueResultName(
  sourceName: string,
  format: ConvertFormat,
  nodes: AppNode[],
  files: Record<string, FileEntry>,
  canvasId: string | null,
): string {
  return uniqueFileName(
    rewriteExtension(sourceName, format),
    takenNamesOnCanvas(nodes, files, canvasId),
  )
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
    const obstacles = buildCanvasObstacleRects(nodes, files, canvasId)
    const batchPlaced: ReturnType<typeof rectAt>[] = []

    for (const file of fileList) {
      const entry = await createFileEntry(file)
      files[entry.id] = entry
      const nodePosition = resolveParentImportPosition(
        position,
        'file',
        entry,
        obstacles,
        batchPlaced,
      )
      const size = estimateImportNodeSize('file', entry)
      batchPlaced.push(rectAt(nodePosition, size))
      const id = uid('node')
      nodes.push({
        id,
        type: 'file',
        position: nodePosition,
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

    const obstacles = buildCanvasObstacleRects(nodes, files, canvasId)
    const folderPosition = resolveParentImportPosition(
      position,
      'folder',
      undefined,
      obstacles,
      [],
    )

    // Always place the folder node on the current canvas — even if empty.
    nodes.push({
      id: uid('node'),
      type: 'folder',
      position: folderPosition,
      data: {
        kind: 'folder',
        folderId: graph.folder.id,
        label: graph.folder.name,
        isResult: false,
        canvasId,
        jobStatus: 'idle',
      },
    })

    // Place every child file/folder node onto its parent folder's canvas
    // so drill-in works for nested directories too.
    const allFolders = [graph.folder, ...graph.nestedFolders]
    for (const folder of allFolders) {
      let i = 0
      for (const fileId of folder.childFileIds) {
        const entry = files[fileId]
        if (!entry) continue
        nodes.push({
          id: uid('node'),
          type: 'file',
          position: { x: 80 + (i % 4) * 220, y: 80 + Math.floor(i / 4) * 280 },
          data: {
            kind: 'file',
            fileId: entry.id,
            label: fileLabel(entry.name, false),
            isResult: false,
            canvasId: folder.id,
            jobStatus: 'idle',
          },
        })
        i++
      }
      for (const childId of folder.childFolderIds) {
        const child = folders[childId]
        if (!child) continue
        nodes.push({
          id: uid('node'),
          type: 'folder',
          position: { x: 80 + (i % 4) * 160, y: 80 + Math.floor(i / 4) * 180 },
          data: {
            kind: 'folder',
            folderId: child.id,
            label: child.name,
            isResult: false,
            canvasId: folder.id,
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
    for (const f of folders) {
      await get().addFolderAt(f.folderName, f.files, position)
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
    // Close the control panel immediately on Convert (file or folder).
    set({ draft: null })
    if (sourceNode.data.kind === 'folder') {
      await convertFolder(get, set, sourceNode, settings)
      return
    }

    await convertFileNode(get, set, sourceNode, settings)
  },

  saveNode: async (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId)
    if (!node) return

    if (node.data.kind === 'file') {
      const file = get().files[node.data.fileId]
      if (!file) return
      downloadBlob(file.blob, file.name)
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

  setFileDimensions: (fileId, width, height) => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
      return
    }
    set((s) => {
      const file = s.files[fileId]
      if (!file) return s
      if (file.width === width && file.height === height) return s
      return {
        files: {
          ...s.files,
          [fileId]: { ...file, width, height },
        },
      }
    })
  },

  finishConversionWave: (nodeId) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId && n.data.kind === 'file' && n.data.conversionWavePending
          ? { ...n, data: { ...n.data, conversionWavePending: false } }
          : n,
      ),
    }))
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
) {
  if (sourceNode.data.kind !== 'file') return
  const sourceFile = get().files[sourceNode.data.fileId]
  if (!sourceFile) return

  const resultNodeId = uid('node')
  const resultFileId = uid('file')
  const canvasId = sourceNode.data.canvasId
  const resultName = uniqueResultName(
    sourceFile.name,
    settings.format,
    get().nodes,
    get().files,
    canvasId,
  )

  const sourcePreview =
    sourceFile.previewUrl || sourceFile.objectUrl || undefined

  const placeholder: FileEntry = {
    id: resultFileId,
    name: resultName,
    extension: settings.format === 'jpg' ? 'jpg' : settings.format,
    mimeType: 'application/octet-stream',
    blob: new Blob(),
    objectUrl: '',
    previewUrl: sourcePreview,
    size: 0,
    width: sourceFile.width,
    height: sourceFile.height,
  }

  const resultPosition = computeDefaultResultPosition(
    sourceNode,
    get().nodes,
    get().edges,
    get().files,
  )

  set((s) => ({
    files: { ...s.files, [resultFileId]: placeholder },
    nodes: [
      ...s.nodes,
      {
        id: resultNodeId,
        type: 'file',
        position: resultPosition,
        data: {
          kind: 'file',
          fileId: resultFileId,
          label: resultName,
          isResult: true,
          canvasId,
          settings,
          jobStatus: 'running',
          jobProgress: 0,
          conversionWavePending: true,
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
                conversionWavePending: false,
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
) {
  if (sourceNode.data.kind !== 'folder') return
  const sourceFolder = get().folders[sourceNode.data.folderId]
  if (!sourceFolder) return

  const newFolderId = uid('folder')
  const resultNodeId = uid('node')
  const canvasId = sourceNode.data.canvasId

  const takenFolderLabels = get()
    .nodes.filter((n) => n.data.canvasId === canvasId && n.data.kind === 'folder')
    .map((n) => n.data.label)
  const resultLabel = uniqueFileName(
    resultFolderName(sourceFolder.name, settings.format),
    takenFolderLabels,
  )

  const newFolder: FolderEntry = {
    id: newFolderId,
    name: resultLabel,
    childFileIds: [],
    childFolderIds: [],
  }

  const resultPosition = computeDefaultResultPosition(
    sourceNode,
    get().nodes,
    get().edges,
    get().files,
  )

  set((s) => ({
    folders: { ...s.folders, [newFolderId]: newFolder },
    nodes: [
      ...s.nodes,
      {
        id: resultNodeId,
        type: 'folder',
        position: resultPosition,
        data: {
          kind: 'folder',
          folderId: newFolderId,
          label: resultLabel,
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

  // Recursively collect every convertible image in the folder tree.
  const sourceFiles: FileEntry[] = []
  const walk = (f: FolderEntry) => {
    for (const fid of f.childFileIds) {
      const file = get().files[fid]
      if (file && canDecodeInBrowser(file.extension)) sourceFiles.push(file)
    }
    for (const cid of f.childFolderIds) {
      const child = get().folders[cid]
      if (child) walk(child)
    }
  }
  walk(sourceFolder)

  const newChildIds: string[] = []
  const filesUpdate: Record<string, FileEntry> = {}
  const newNodes: AppNode[] = []
  const takenInFolder: string[] = []

  let i = 0
  for (const sourceFile of sourceFiles) {
    try {
      const blob = await runConversion(sourceFile, settings)
      const objectUrl = URL.createObjectURL(blob)
      const resultFileId = uid('file')
      const resultName = uniqueFileName(
        rewriteExtension(sourceFile.name, settings.format),
        takenInFolder,
      )
      takenInFolder.push(resultName)
      const entry: FileEntry = {
        id: resultFileId,
        name: resultName,
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
          label: resultName,
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
