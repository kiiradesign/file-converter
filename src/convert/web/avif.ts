import { encode as encodeAvif } from '@jsquash/avif'

/** Encode ImageData to AVIF via @jsquash/avif (libavif WASM). */
export async function encodeAvifBlob(
  imageData: ImageData,
  qualityPercent: number,
): Promise<Blob> {
  const quality = Math.min(100, Math.max(0, qualityPercent))
  const buffer = await encodeAvif(imageData, {
    quality,
    qualityAlpha: quality,
    // Faster encode for interactive use; still acceptable quality.
    speed: 6,
  })
  return new Blob([buffer], { type: 'image/avif' })
}
