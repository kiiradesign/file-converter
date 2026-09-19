import { isDesktop } from '../platform'
import * as web from './web'
import * as desktop from './desktop'

const io = isDesktop() ? desktop : web

export const createFileEntry = io.createFileEntry
export const revokeFileEntry = io.revokeFileEntry
export const pickFiles = io.pickFiles
export const pickFolder = io.pickFolder
export const buildFolderFromFiles = io.buildFolderFromFiles
export const downloadBlob = io.downloadBlob
export const zipFiles = io.zipFiles
export const readDroppedItems = io.readDroppedItems
