import { HalftoneCmyk } from '@paper-design/shaders-react'
import { animate } from 'motion'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  HALFTONE_CMYK,
  HALFTONE_MAX_PIXEL_COUNT,
  WAVE_DURATION_S,
  WAVE_SOFTNESS,
} from './pixelationWaveConfig'

interface Props {
  src: string | null
  /** Source preview URL while a conversion result is pending (usually previewUrl). */
  previewSrc?: string | null
  /** Converted blob URL when the job has finished. */
  outputSrc?: string | null
  /** Display box size (CSS); source image stays full-resolution via <img>. */
  width: number
  height: number
  mimeType?: string
  isResult?: boolean
  jobStatus?: 'idle' | 'running' | 'done' | 'error'
  /** When true, play the fixed 1s halftone wave (independent of encode progress). */
  conversionWavePending?: boolean
  onWaveComplete?: () => void
  onNaturalSize?: (width: number, height: number) => void
}

/**
 * Node preview: full-resolution <img> underneath; CMYK halftone wave overlay while converting.
 * The wave always runs for exactly WAVE_DURATION_S; encode speed only affects when the final
 * output URL is swapped in (after the wave finishes and the job has output).
 */
export function PixelationPreview({
  src,
  previewSrc,
  outputSrc,
  width,
  height,
  mimeType,
  isResult,
  jobStatus,
  conversionWavePending,
  onWaveComplete,
  onNaturalSize,
}: Props) {
  const isBitmap =
    !mimeType ||
    mimeType.startsWith('image/') ||
    mimeType === 'application/octet-stream'

  if (!src && !previewSrc) {
    return <div className="file-node__placeholder" style={{ width: '100%', height: '100%' }} />
  }

  if (!isBitmap || mimeType === 'application/pdf') {
    return (
      <div className="file-node__placeholder file-node__placeholder--doc">
        <span>{mimeType === 'application/pdf' ? 'PDF' : 'FILE'}</span>
      </div>
    )
  }

  const jobDone = jobStatus === 'done' && !!outputSrc
  const waveEligible =
    !!isResult && jobStatus !== 'error' && !!conversionWavePending

  return (
    <ConversionPreviewImage
      fallbackSrc={src ?? previewSrc ?? ''}
      previewSrc={previewSrc ?? src ?? ''}
      outputSrc={outputSrc}
      jobDone={jobDone}
      waveEligible={waveEligible}
      width={width}
      height={height}
      onNaturalSize={onNaturalSize}
      onWaveComplete={onWaveComplete}
    />
  )
}

function ConversionPreviewImage({
  fallbackSrc,
  previewSrc,
  outputSrc,
  jobDone,
  waveEligible,
  width,
  height,
  onNaturalSize,
  onWaveComplete,
}: {
  fallbackSrc: string
  previewSrc: string
  outputSrc?: string | null
  jobDone: boolean
  waveEligible: boolean
  width: number
  height: number
  onNaturalSize?: (width: number, height: number) => void
  onWaveComplete?: () => void
}) {
  const [waveT, setWaveT] = useState(0)
  const [waveFinished, setWaveFinished] = useState(!waveEligible)
  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    if (!waveEligible) {
      setWaveT(1)
      setWaveFinished(true)
      return
    }

    setWaveT(0)
    setWaveFinished(false)

    if (reducedMotion) {
      setWaveT(1)
      setWaveFinished(true)
      onWaveComplete?.()
      return
    }

    const ctrl = animate(0, 1, {
      duration: WAVE_DURATION_S,
      ease: [0.35, 0, 0.25, 1],
      onUpdate: (v) => setWaveT(v),
      onComplete: () => {
        setWaveT(1)
        setWaveFinished(true)
        onWaveComplete?.()
      },
    })
    return () => ctrl.stop()
  }, [waveEligible, reducedMotion, onWaveComplete])

  const showResult = waveFinished && jobDone && !!outputSrc
  const displaySrc = showResult ? outputSrc! : previewSrc || fallbackSrc
  const showWave = waveEligible && !waveFinished

  return (
    <div className="file-node__preview" style={{ width: '100%', height: '100%' }}>
      <img
        key={displaySrc}
        src={displaySrc}
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
          src={previewSrc || fallbackSrc}
          width={width}
          height={height}
          waveT={waveT}
        />
      )}
    </div>
  )
}

function subscribeTheme(onStoreChange: () => void) {
  const obs = new MutationObserver(onStoreChange)
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  return () => obs.disconnect()
}

function readHalftoneBack(): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--fc-halftone-back')
    .trim()
  return v || HALFTONE_CMYK.colorBack
}

function HalftoneWaveOverlay({
  src,
  width,
  height,
  waveT,
}: {
  src: string
  width: number
  height: number
  waveT: number
}) {
  const colorBack = useSyncExternalStore(
    subscribeTheme,
    readHalftoneBack,
    () => HALFTONE_CMYK.colorBack,
  )
  const reveal = Math.min(1, Math.max(0, waveT))
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
        colorBack={colorBack}
      />
    </div>
  )
}
