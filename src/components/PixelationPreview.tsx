import { animate } from 'motion'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { DitherBlockWaveWebGL } from './DitherBlockWaveWebGL'
import {
  HALFTONE_COLOR_BACK_DARK,
  REVEAL_CROSSFADE_S,
  WAVE_DURATION_S,
  WAVE_EASE,
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
  /** When true, play the dither block wave (duration from config; independent of encode). */
  conversionWavePending?: boolean
  onWaveComplete?: () => void
  onNaturalSize?: (width: number, height: number) => void
}

/**
 * Node preview: dithered WebGL block wave while converting; crossfade to full output when ready.
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
  const [webglOpacity, setWebglOpacity] = useState(waveEligible ? 1 : 0)
  const [resultOpacity, setResultOpacity] = useState(0)
  const waveSessionRef = useRef(0)
  const crossfadeSessionRef = useRef(0)
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
      return
    }

    waveSessionRef.current += 1
    const session = waveSessionRef.current
    setWaveT(0)
    setWaveFinished(false)
    setWebglOpacity(1)
    setResultOpacity(0)

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
      ease: WAVE_EASE,
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

  const readyToReveal = waveFinished && jobDone && !!outputSrc

  useEffect(() => {
    if (!readyToReveal) {
      if (!waveEligible && waveFinished) {
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
      return
    }

    const ctrl = animate(0, 1, {
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
  const showResultImg = !!outputSrc && (readyToReveal || resultOpacity > 0)
  const resultVisible = readyToReveal && resultOpacity >= 0.999
  const showPreviewImg = !showWebgl && !showResultImg

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      onNaturalSize?.(img.naturalWidth, img.naturalHeight)
    }
  }

  return (
    <div
      className={`file-node__preview${showWebgl ? ' file-node__preview--wave' : ''}`}
      style={{ width: '100%', height: '100%' }}
    >
      {showPreviewImg ? (
        <img
          key={sourcePreview}
          src={sourcePreview}
          alt=""
          draggable={false}
          decoding="async"
          className="file-node__preview-img"
          onLoad={onImgLoad}
        />
      ) : null}
      {showResultImg && outputSrc ? (
        <img
          key={outputSrc}
          src={outputSrc}
          alt=""
          draggable={false}
          decoding="async"
          className="file-node__preview-img file-node__preview-img--result"
          style={{ opacity: resultVisible ? 1 : resultOpacity }}
          onLoad={onImgLoad}
        />
      ) : null}
      {showWebgl ? (
        <>
          <img
            src={sourcePreview}
            alt=""
            className="file-node__preview-img file-node__preview-img--probe"
            aria-hidden
            onLoad={onImgLoad}
          />
          <DitherBlockWaveWebGL
            src={sourcePreview}
            width={width}
            height={height}
            waveT={waveT}
            layerOpacity={webglOpacity}
            colorBack={colorBack}
          />
        </>
      ) : null}
    </div>
  )
}
