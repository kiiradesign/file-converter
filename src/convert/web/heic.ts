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

export type HeicPreview = {
  /** Browser-displayable JPEG object URL (revoke when done). */
  previewUrl: string
  /** Intrinsic HEIC pixel size (not the downscaled preview). */
  width: number
  height: number
}

/**
 * Decode HEIC/HEIF into a JPEG preview URL for <img> nodes.
 * Caps the long edge so folder ingest stays memory-friendly.
 */
export async function heicToPreview(
  blob: Blob,
  maxEdge = 1280,
): Promise<HeicPreview> {
  const imageData = await decodeHeicToImageData(blob)
  const width = imageData.width
  const height = imageData.height

  const full = document.createElement('canvas')
  full.width = width
  full.height = height
  const fullCtx = full.getContext('2d')
  if (!fullCtx) throw new Error('No 2d context')
  fullCtx.putImageData(imageData, 0, 0)

  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const pw = Math.max(1, Math.round(width * scale))
  const ph = Math.max(1, Math.round(height * scale))

  let out: HTMLCanvasElement = full
  if (pw !== width || ph !== height) {
    out = document.createElement('canvas')
    out.width = pw
    out.height = ph
    const ctx = out.getContext('2d')
    if (!ctx) throw new Error('No 2d context')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(full, 0, 0, pw, ph)
  }

  const previewBlob = await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('HEIC → JPEG preview failed'))),
      'image/jpeg',
      0.88,
    )
  })

  return {
    previewUrl: URL.createObjectURL(previewBlob),
    width,
    height,
  }
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
