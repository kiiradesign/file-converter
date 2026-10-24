import { isDesktop } from '../platform'
import * as web from './web'
import * as desktop from './desktop'

/** Pick web vs desktop at call time (Tauri may inject after module load). */
function io() {
  return isDesktop() ? desktop : web
}

export const createFileEntry: typeof web.createFileEntry = (...args) =>
  io().createFileEntry(...args)
export const revokeFileEntry: typeof web.revokeFileEntry = (...args) =>
  io().revokeFileEntry(...args)
export const pickFiles: typeof web.pickFiles = (...args) => io().pickFiles(...args)
export const pickFolder: typeof web.pickFolder = (...args) => io().pickFolder(...args)
export const buildFolderFromFiles: typeof web.buildFolderFromFiles = (...args) =>
  io().buildFolderFromFiles(...args)
export const downloadBlob: typeof web.downloadBlob = (...args) => io().downloadBlob(...args)
export const zipFiles: typeof web.zipFiles = (...args) => io().zipFiles(...args)
export const readDroppedItems: typeof web.readDroppedItems = (...args) =>
  io().readDroppedItems(...args)
