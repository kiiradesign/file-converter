/**
 * Browser HEIC/HEIF decode via libheif WASM (bundled).
 * Decode only — encode-to-HEIC is not supported.
 */

type HeifImage = {
  get_width(): number
  get_height(): number
  display(
    imageData: ImageData,
    callback: (displayData: ImageData | null) => void,
  ): void
}

type HeifDecoder = {
  decode(buffer: ArrayBuffer | Uint8Array): HeifImage[]
}

type LibHeif = {
  HeifDecoder: new () => HeifDecoder
}

type LibHeifFactory = (options?: unknown) => LibHeif | Promise<LibHeif>

let libheifPromise: Promise<LibHeif> | null = null

async function loadLibHeif(): Promise<LibHeif> {
  if (!libheifPromise) {
    libheifPromise = (async () => {
      const mod = (await import(
        'libheif-js/libheif-wasm/libheif-bundle.mjs'
      )) as { default: LibHeifFactory | LibHeif }
      const factoryOrModule = mod.default
      if (typeof factoryOrModule === 'function') {
        return await factoryOrModule()
      }
      return factoryOrModule
    })()
  }
  return libheifPromise
}

function isHeicExtension(ext: string): boolean {
  const e = ext.toLowerCase()
  return e === 'heic' || e === 'heif'
}

/** Decode the primary frame of a HEIC/HEIF blob into ImageData (RGBA). */
export async function decodeHeicToImageData(blob: Blob): Promise<ImageData> {
  const libheif = await loadLibHeif()
  const buffer = await blob.arrayBuffer()
  const decoder = new libheif.HeifDecoder()
  const images = decoder.decode(new Uint8Array(buffer))
  if (!images?.length) {
    throw new Error('No images found in HEIC/HEIF file')
  }
  const image = images[0]
  const width = image.get_width()
  const height = image.get_height()
  if (width < 1 || height < 1) {
    throw new Error('Invalid HEIC dimensions')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2d context')
  const imageData = ctx.createImageData(width, height)

  await new Promise<void>((resolve, reject) => {
    image.display(imageData, (displayData) => {
      if (!displayData) {
        reject(new Error('HEIF processing error'))
        return
      }
      resolve()
    })
  })

  return imageData
}

/** Decode HEIC/HEIF from a blob URL into an HTMLImageElement via PNG re-encode. */
export async function loadHeicAsImage(url: string): Promise<HTMLImageElement> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch HEIC source')
  const blob = await response.blob()
  const imageData = await decodeHeicToImageData(blob)

  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2d context')
  ctx.putImageData(imageData, 0, 0)

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('HEIC → PNG encode failed'))),
      'image/png',
    )
  })
  const pngUrl = URL.createObjectURL(pngBlob)
  try {
    return await loadImageElement(pngUrl)
  } finally {
    URL.revokeObjectURL(pngUrl)
  }
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = url
  })
}

export { isHeicExtension }
