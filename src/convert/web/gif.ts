// gifenc ships without TypeScript types.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — no bundled types
import gifenc from 'gifenc'

const { GIFEncoder, quantize, applyPalette } = gifenc as {
  GIFEncoder: (opts?: { auto?: boolean }) => {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      opts: { palette: number[][]; delay?: number },
    ) => void
    finish: () => void
    bytes: () => Uint8Array
  }
  quantize: (rgba: Uint8Array | Uint8ClampedArray, maxColors: number) => number[][]
  applyPalette: (
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
  ) => Uint8Array
}

/** Encode a static GIF from ImageData (palette quantized). */
export function encodeGif(imageData: ImageData, maxColors = 256): Blob {
  const { width, height, data } = imageData
  const rgba = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
  const palette = quantize(rgba, Math.min(256, Math.max(2, maxColors)))
  const index = applyPalette(rgba, palette)
  const gif = GIFEncoder({ auto: true })
  gif.writeFrame(index, width, height, { palette })
  gif.finish()
  const bytes = gif.bytes()
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy.buffer], { type: 'image/gif' })
}
