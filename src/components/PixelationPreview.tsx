interface Props {
  src: string | null
  /** Display box size (CSS); source image stays full-resolution via <img>. */
  width: number
  height: number
  progress: number
  active: boolean
  /** Optional mime — PDFs etc. skip bitmap preview. */
  mimeType?: string
}

/**
 * Node preview: always prefer the full-resolution object URL in an <img>.
 * Pixelation is only a transient overlay while a conversion job is running;
 * it must never permanently replace the source with a tiny bitmap.
 */
export function PixelationPreview({
  src,
  width,
  height,
  progress,
  active,
  mimeType,
}: Props) {
  const isBitmap =
    !mimeType ||
    mimeType.startsWith('image/') ||
    mimeType === 'application/octet-stream'

  if (!src) {
    return <div className="file-node__placeholder" style={{ width: '100%', height: '100%' }} />
  }

  if (!isBitmap || mimeType === 'application/pdf') {
    return (
      <div className="file-node__placeholder file-node__placeholder--doc">
        <span>{mimeType === 'application/pdf' ? 'PDF' : 'FILE'}</span>
      </div>
    )
  }

  const showDissolve = active && progress < 1

  return (
    <div className="file-node__preview" style={{ width: '100%', height: '100%' }}>
      {/* Full-res source — CSS sizes the card; browser decodes native pixels. */}
      <img
        src={src}
        alt=""
        draggable={false}
        decoding="async"
        className="file-node__preview-img"
      />
      {showDissolve && (
        <PixelationOverlay src={src} width={width} height={height} progress={progress} />
      )}
    </div>
  )
}

/** Transient conversion dissolve drawn on a small overlay canvas only. */
function PixelationOverlay({
  src,
  width,
  height,
  progress,
}: {
  src: string
  width: number
  height: number
  progress: number
}) {
  // Overlay is decorative; keep it cheap. The sharp <img> sits underneath.
  const canvasW = Math.max(1, Math.round(width))
  const canvasH = Math.max(1, Math.round(height))

  return (
    <canvas
      className="file-node__preview-dissolve"
      width={canvasW}
      height={canvasH}
      ref={(canvas) => {
        if (!canvas) return
        const img = new Image()
        img.onload = () => {
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          const p = Math.min(1, Math.max(0, progress))
          const block = Math.max(1, Math.round(32 * (1 - p) + 1 * p))
          const w = canvas.width
          const h = canvas.height
          ctx.imageSmoothingEnabled = false
          ctx.clearRect(0, 0, w, h)
          const tw = Math.max(1, Math.ceil(w / block))
          const th = Math.max(1, Math.ceil(h / block))
          const tmp = document.createElement('canvas')
          tmp.width = tw
          tmp.height = th
          const tctx = tmp.getContext('2d')
          if (!tctx) return
          tctx.imageSmoothingEnabled = false
          tctx.drawImage(img, 0, 0, tw, th)
          ctx.drawImage(tmp, 0, 0, tw, th, 0, 0, w, h)
          ctx.globalAlpha = Math.max(0, 1 - p)
          // Fade overlay as conversion completes; full-res img already underneath.
          ctx.fillStyle = 'transparent'
        }
        img.src = src
      }}
      style={{ opacity: Math.max(0, 1 - progress) }}
    />
  )
}
