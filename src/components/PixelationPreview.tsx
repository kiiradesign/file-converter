import { HalftoneCmyk } from '@paper-design/shaders-react'
import { animate } from 'motion'
import { useEffect, useMemo, useState } from 'react'
import {
  HALFTONE_CMYK,
  HALFTONE_MAX_PIXEL_COUNT,
  WAVE_DURATION_S,
  WAVE_SOFTNESS,
} from './pixelationWaveConfig'

interface Props {
  src: string | null
  /** Display box size (CSS); source image stays full-resolution via <img>. */
  width: number
  height: number
  progress: number
  active: boolean
  /** Optional mime — PDFs etc. skip bitmap preview. */
  mimeType?: string
  /** Fired once with the decoded intrinsic size (for aspect-correct cards). */
  onNaturalSize?: (width: number, height: number) => void
}

/**
 * Node preview: full-resolution <img> underneath; CMYK halftone wave overlay while converting.
 */
export function PixelationPreview({
  src,
  width,
  height,
  progress,
  active,
  mimeType,
  onNaturalSize,
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

  const showWave = active && progress < 1

  return (
    <div className="file-node__preview" style={{ width: '100%', height: '100%' }}>
      <img
        src={src}
        alt=""
        draggable={false}
        decoding="async"
        className="file-node__preview-img"
        onLoad={(e) => {
          const img = e.currentTarget
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            onNaturalSize?.(img.naturalWidth, img.naturalHeight)
          }
        }}
      />
      {showWave && (
        <HalftoneWaveOverlay
          src={src}
          width={width}
          height={height}
          jobProgress={progress}
        />
      )}
    </div>
  )
}

function HalftoneWaveOverlay({
  src,
  width,
  height,
  jobProgress,
}: {
  src: string
  width: number
  height: number
  jobProgress: number
}) {
  const [waveT, setWaveT] = useState(0)
  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    setWaveT(0)
    if (reducedMotion) {
      setWaveT(1)
      return
    }
    const ctrl = animate(0, 1, {
      duration: WAVE_DURATION_S,
      ease: [0.35, 0, 0.25, 1],
      onUpdate: (v) => setWaveT(v),
    })
    return () => ctrl.stop()
  }, [src, reducedMotion])

  const reveal = Math.min(1, Math.max(waveT, jobProgress))
  const softPct = WAVE_SOFTNESS * 100
  const frontPct = reveal * 100
  const maskImage = `linear-gradient(to bottom, transparent 0%, transparent ${Math.max(0, frontPct - softPct)}%, black ${Math.min(100, frontPct + softPct)}%, black 100%)`

  return (
    <div
      className="file-node__preview-halftone"
      style={{
        WebkitMaskImage: maskImage,
        maskImage,
      }}
    >
      <HalftoneCmyk
        image={src}
        width={Math.max(1, Math.round(width))}
        height={Math.max(1, Math.round(height))}
        maxPixelCount={HALFTONE_MAX_PIXEL_COUNT}
        speed={0}
        frame={0}
        {...HALFTONE_CMYK}
      />
    </div>
  )
}
