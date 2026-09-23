import { convertImageWeb } from '../web/image'
import type { ConvertSettings } from '../../types'

/** Desktop CLI conversion stub — falls back to web encoders until Tauri is wired. */
export async function convertImageDesktop(
  sourceUrl: string,
  settings: ConvertSettings,
  onProgress?: (p: number) => void,
  sourceExt?: string,
): Promise<Blob> {
  return convertImageWeb(sourceUrl, settings, onProgress, sourceExt)
}
