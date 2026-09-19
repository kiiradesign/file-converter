/**
 * Desktop I/O stubs — reuse web implementations until Tauri is wired.
 * Real path-based reads/writes will live here behind `isDesktop()`.
 */
export {
  createFileEntry,
  revokeFileEntry,
  pickFiles,
  pickFolder,
  buildFolderFromFiles,
  downloadBlob,
  zipFiles,
  readDroppedItems,
} from './web'
