declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
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

  const factory: (options?: unknown) => LibHeif | Promise<LibHeif>
  export default factory
}
