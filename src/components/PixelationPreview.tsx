<<<<<<< HEAD
import { ImageDithering } from '@paper-design/shaders-react'
import { animate } from 'motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DitherCanvasFallback, PixelationWave } from './PixelationWave'
import {
  DITHER_MAX_PIXEL_COUNT,
  IMAGE_DITHERING,
  REVEAL_DURATION_S,
=======
import { animate } from 'motion'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { DitherBlockWaveWebGL } from './DitherBlockWaveWebGL'
import {
  HALFTONE_COLOR_BACK_DARK,
  REVEAL_CROSSFADE_S,
>>>>>>> ab03aa9 (Rebuild conversion loading as WebGL dither block wave)
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
<<<<<<< HEAD
  /** When true, play the fixed 1s dither wave (independent of encode progress). */
=======
  /** When true, play the fixed 1s dither block wave (independent of encode progress). */
>>>>>>> ab03aa9 (Rebuild conversion loading as WebGL dither block wave)
  conversionWavePending?: boolean
  onWaveComplete?: () => void
  onNaturalSize?: (width: number, height: number) => void
}

/**
<<<<<<< HEAD
 * Node preview: during conversion, only dithered source + pixel grid wave (no output blob).
 * After wave + encode, crossfade to the real converted image.
=======
 * Node preview: dithered WebGL block wave while converting; crossfade to full output when ready.
>>>>>>> ab03aa9 (Rebuild conversion loading as WebGL dither block wave)
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

function subscribeTheme(onStoreChange: () => void) {
  const obs = new MutationObserver(onStoreChange)
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  return () => obs.disconnect()
}

function readDitherBack(): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--fc-halftone-back')
    .trim()
  return v || HALFTONE_COLOR_BACK_DARK
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
<<<<<<< HEAD
  const [revealT, setRevealT] = useState(0)
  const [revealDone, setRevealDone] = useState(!waveEligible)
  const waveSessionRef = useRef(0)
  const revealSessionRef = useRef(0)
=======
  const [webglOpacity, setWebglOpacity] = useState(waveEligible ? 1 : 0)
  const [resultOpacity, setResultOpacity] = useState(0)
  const waveSessionRef = useRef(0)
  const crossfadeSessionRef = useRef(0)
>>>>>>> ab03aa9 (Rebuild conversion loading as WebGL dither block wave)
  const onWaveCompleteRef = useRef(onWaveComplete)
  onWaveCompleteRef.current = onWaveComplete

  const colorBack = useSyncExternalStore(
    subscribeTheme,
    readDitherBack,
    () => HALFTONE_COLOR_BACK_DARK,
  )

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
<<<<<<< HEAD
    setRevealT(0)
    setRevealDone(false)
=======
    setWebglOpacity(1)
    setResultOpacity(0)
>>>>>>> ab03aa9 (Rebuild conversion loading as WebGL dither block wave)

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

<<<<<<< HEAD
  useEffect(() => {
    if (!waveFinished || !jobDone || !outputSrc) return

    revealSessionRef.current += 1
    const session = revealSessionRef.current
    setRevealT(0)
    setRevealDone(false)

    if (reducedMotion) {
      setRevealT(1)
      setRevealDone(true)
=======
  const readyToReveal = waveFinished && jobDone && !!outputSrc

  useEffect(() => {
    if (!readyToReveal) {
      if (!waveEligible && !waveFinished) {
        setWebglOpacity(0)
        setResultOpacity(1)
      }
      return
    }

    crossfadeSessionRef.current += 1
    const session = crossfadeSessionRef.current

    if (reducedMotion) {
      setWebglOpacity(0)
      setResultOpacity(1)
>>>>>>> ab03aa9 (Rebuild conversion loading as WebGL dither block wave)
      return
    }

    const ctrl = animate(0, 1, {
<<<<<<< HEAD
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
=======
      duration: REVEAL_CROSSFADE_S,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (v) => {
        if (session !== crossfadeSessionRef.current) return
        setResultOpacity(v)
        setWebglOpacity(1 - v)
      },
      onComplete: () => {
        if (session !== crossfadeSessionRef.current) return
        setResultOpacity(1)
        setWebglOpacity(0)
      },
    })
    return () => ctrl.stop()
  }, [readyToReveal, reducedMotion, waveEligible, waveFinished])

  const showWebgl = webglOpacity > 0.001 && (waveEligible || waveFinished)
  const waveSource = previewSrc || fallbackSrc

  const showResultImg = !!outputSrc && (readyToReveal || resultOpacity > 0)
  const resultVisible = readyToReveal && resultOpacity >= 0.999
  const showPreviewImg = !showWebgl && !showResultImg

  return (
    <div
      className={`file-node__preview${showWebgl ? ' file-node__preview--wave' : ''}`}
      style={{ width: '100%', height: '100%' }}
    >
      {showPreviewImg ? (
        <img
          key={waveSource}
          src={waveSource}
>>>>>>> ab03aa9 (Rebuild conversion loading as WebGL dither block wave)
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
<<<<<<< HEAD
      )}
      {revealing && outputSrc && (
=======
      ) : null}
      {showResultImg && outputSrc ? (
>>>>>>> ab03aa9 (Rebuild conversion loading as WebGL dither block wave)
        <img
          key={outputSrc}
          src={outputSrc}
          alt=""
          draggable={false}
          decoding="async"
<<<<<<< HEAD
          className="file-node__preview-img"
          style={{ opacity: revealT }}
=======
          className="file-node__preview-img file-node__preview-img--result"
          style={{ opacity: resultVisible ? 1 : resultOpacity }}
>>>>>>> ab03aa9 (Rebuild conversion loading as WebGL dither block wave)
          onLoad={(e) => {
            const img = e.currentTarget
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              onNaturalSize?.(img.naturalWidth, img.naturalHeight)
            }
          }}
        />
<<<<<<< HEAD
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
=======
      ) : null}
      {showWebgl ? (
        <DitherBlockWaveWebGL
          src={waveSource}
          width={width}
          height={height}
          waveT={waveT}
          layerOpacity={webglOpacity}
          colorBack={colorBack}
        />
      ) : null}
>>>>>>> ab03aa9 (Rebuild conversion loading as WebGL dither block wave)
    </div>
  )
}
