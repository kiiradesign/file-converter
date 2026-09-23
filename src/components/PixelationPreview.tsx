import { ImageDithering } from '@paper-design/shaders-react'
import { animate } from 'motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DitherCanvasFallback, PixelationWave } from './PixelationWave'
import {
  DITHER_MAX_PIXEL_COUNT,
  IMAGE_DITHERING,
  REVEAL_DURATION_S,
  WAVE_DURATION_S,
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
  /** When true, play the fixed 1s dither wave (independent of encode progress). */
  conversionWavePending?: boolean
  onWaveComplete?: () => void
  onNaturalSize?: (width: number, height: number) => void
}

let webglAvailable: boolean | null = null

function canUseWebGL(): boolean {
  if (webglAvailable != null) return webglAvailable
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    webglAvailable = !!(
      canvas.getContext('webgl2') || canvas.getContext('webgl')
    )
  } catch {
    webglAvailable = false
  }
  return webglAvailable
}

/**
 * Node preview: during conversion, only dithered source + pixel grid wave (no output blob).
 * After wave + encode, crossfade to the real converted image.
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
    !!isResult &&
    jobStatus !== 'error' &&
    (conversionWavePending === true || jobStatus === 'running')

  const sourcePreview = previewSrc ?? src ?? ''

  return (
    <ConversionPreviewImage
      sourcePreview={sourcePreview}
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
  sourcePreview,
  outputSrc,
  jobDone,
  waveEligible,
  width,
  height,
  onNaturalSize,
  onWaveComplete,
}: {
  sourcePreview: string
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
  const [revealT, setRevealT] = useState(0)
  const [revealDone, setRevealDone] = useState(!waveEligible)
  const waveSessionRef = useRef(0)
  const revealSessionRef = useRef(0)
  const onWaveCompleteRef = useRef(onWaveComplete)
  onWaveCompleteRef.current = onWaveComplete
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
      setRevealT(1)
      setRevealDone(true)
      return
    }

    waveSessionRef.current += 1
    const session = waveSessionRef.current
    setWaveT(0)
    setWaveFinished(false)
    setRevealT(0)
    setRevealDone(false)

    if (reducedMotion) {
      const t = window.setTimeout(() => {
        if (session !== waveSessionRef.current) return
        setWaveT(1)
        setWaveFinished(true)
        onWaveCompleteRef.current?.()
      }, WAVE_DURATION_S * 1000)
      return () => window.clearTimeout(t)
    }

    const ctrl = animate(0, 1, {
      duration: WAVE_DURATION_S,
      ease: [0.35, 0, 0.25, 1],
      onUpdate: (v) => {
        if (session !== waveSessionRef.current) return
        setWaveT(v)
      },
      onComplete: () => {
        if (session !== waveSessionRef.current) return
        setWaveT(1)
        setWaveFinished(true)
        onWaveCompleteRef.current?.()
      },
    })
    return () => ctrl.stop()
  }, [waveEligible, reducedMotion])

  useEffect(() => {
    if (!waveFinished || !jobDone || !outputSrc) return

    revealSessionRef.current += 1
    const session = revealSessionRef.current
    setRevealT(0)
    setRevealDone(false)

    if (reducedMotion) {
      setRevealT(1)
      setRevealDone(true)
      return
    }

    const ctrl = animate(0, 1, {
      duration: REVEAL_DURATION_S,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (v) => {
        if (session !== revealSessionRef.current) return
        setRevealT(v)
      },
      onComplete: () => {
        if (session !== revealSessionRef.current) return
        setRevealT(1)
        setRevealDone(true)
      },
    })
    return () => ctrl.stop()
  }, [waveFinished, jobDone, outputSrc, reducedMotion])

  const showResult = revealDone && jobDone && !!outputSrc
  const showOverlay = waveEligible && !revealDone
  const revealing = showOverlay && waveFinished && jobDone && !!outputSrc
  const overlayOpacity = revealing ? 1 - revealT : showOverlay ? 1 : 0
  const useShader = canUseWebGL()
  const boxW = Math.max(1, Math.round(width))
  const boxH = Math.max(1, Math.round(height))

  const finalSrc = showResult && outputSrc ? outputSrc : sourcePreview
  const showFinalImg = !showOverlay

  return (
    <div className="file-node__preview" style={{ width: '100%', height: '100%' }}>
      {showFinalImg && (
        <img
          key={finalSrc}
          src={finalSrc}
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
      )}
      {revealing && outputSrc && (
        <img
          key={outputSrc}
          src={outputSrc}
          alt=""
          draggable={false}
          decoding="async"
          className="file-node__preview-img"
          style={{ opacity: revealT }}
          onLoad={(e) => {
            const img = e.currentTarget
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              onNaturalSize?.(img.naturalWidth, img.naturalHeight)
            }
          }}
        />
      )}
      {showOverlay && sourcePreview && (
        <DitherWaveOverlay
          src={sourcePreview}
          width={boxW}
          height={boxH}
          waveT={waveT}
          revealT={revealT}
          opacity={overlayOpacity}
          useShader={useShader}
        />
      )}
      {!showFinalImg && !revealing && sourcePreview && (
        <img
          src={sourcePreview}
          alt=""
          className="file-node__preview-img file-node__preview-img--probe"
          aria-hidden
          onLoad={(e) => {
            const img = e.currentTarget
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              onNaturalSize?.(img.naturalWidth, img.naturalHeight)
            }
          }}
        />
      )}
    </div>
  )
}

function DitherWaveOverlay({
  src,
  width,
  height,
  waveT,
  revealT,
  opacity,
  useShader,
}: {
  src: string
  width: number
  height: number
  waveT: number
  revealT: number
  opacity: number
  useShader: boolean
}) {
  const [shaderFailed, setShaderFailed] = useState(false)
  const [sourceReady, setSourceReady] = useState(false)

  useEffect(() => {
    if (!src) {
      setSourceReady(false)
      return
    }
    let cancelled = false
    setSourceReady(false)
    const img = new Image()
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      if (!cancelled) setSourceReady(true)
    }
    img.onerror = () => {
      if (!cancelled) {
        setSourceReady(false)
        setShaderFailed(true)
      }
    }
    img.src = src
    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
    }
  }, [src])

  const showShader = useShader && !shaderFailed && sourceReady

  return (
    <div
      className="file-node__preview-halftone"
      style={{ opacity, transition: opacity < 1 ? 'none' : undefined }}
    >
      {!showShader ? (
        <DitherCanvasFallback src={src} width={width} height={height} />
      ) : (
        <div className="file-node__preview-halftone-shader" aria-hidden>
          <ImageDithering
            image={src}
            width={width}
            height={height}
            maxPixelCount={DITHER_MAX_PIXEL_COUNT}
            speed={0}
            frame={0}
            {...IMAGE_DITHERING}
            onError={() => setShaderFailed(true)}
          />
        </div>
      )}
      <PixelationWave
        src={src}
        width={width}
        height={height}
        waveT={waveT}
        revealT={revealT}
        showGrid
      />
    </div>
  )
}
