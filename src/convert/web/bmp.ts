/** Encode ImageData to 24-bit Windows BMP (no external dependency). */
export function encodeBmp(imageData: ImageData): Blob {
  const { width, height, data } = imageData
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const pixelSize = rowSize * height
  const fileSize = 54 + pixelSize
  const buf = new ArrayBuffer(fileSize)
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)

  // BITMAPFILEHEADER
  view.setUint16(0, 0x4d42, true) // 'BM'
  view.setUint32(2, fileSize, true)
  view.setUint32(10, 54, true)

  // BITMAPINFOHEADER
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true) // bottom-up
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  view.setUint32(30, 0, true)
  view.setUint32(34, pixelSize, true)

  let offset = 54
  for (let y = height - 1; y >= 0; y--) {
    const rowStart = y * width * 4
    for (let x = 0; x < width; x++) {
      const i = rowStart + x * 4
      bytes[offset++] = data[i + 2]! // B
      bytes[offset++] = data[i + 1]! // G
      bytes[offset++] = data[i]! // R
    }
    // Row padding
    while (offset % 4 !== 0) bytes[offset++] = 0
  }

  return new Blob([buf], { type: 'image/bmp' })
}
