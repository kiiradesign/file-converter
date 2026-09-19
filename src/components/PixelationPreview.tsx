import { useEffect, useRef } from 'react'

interface Props {
  src: string | null
  progress: number
  active: boolean
}

/** Pixelation dissolve: coarse pixels refining into the thumbnail. */
export function PixelationPreview({ src, progress, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !src) return

    const img = new Image()
    let raf = 0
    let cancelled = false

    img.onload = () => {
      const draw = () => {
        if (cancelled) return
        const w = canvas.width
        const h = canvas.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const p = active ? Math.min(1, Math.max(0, progress)) : 1
        // Coarse → fine: pixel size from ~32 down to 1
        const block = Math.max(1, Math.round(32 * (1 - p) + 1 * p))

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

        if (active && p < 1) raf = requestAnimationFrame(draw)
      }
      draw()
    }
    img.src = src

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [src, progress, active])

  if (!src && active) {
    return <div style={{ width: '100%', height: '100%', background: 'var(--fc-preview)' }} />
  }

  if (!src) {
    return <div style={{ width: '100%', height: '100%', background: 'var(--fc-preview)' }} />
  }

  if (!active && progress >= 1) {
    return <img src={src} alt="" draggable={false} />
  }

  return <canvas ref={canvasRef} width={336} height={420} />
}
