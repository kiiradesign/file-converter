import { FlutedGlass } from '@paper-design/shaders-react'
import { animate } from 'motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FLUTED_GLASS_MAX_PIXEL_COUNT,
  PREVIEW_COLOR_BACK_DARK,
  REVEAL_CROSSFADE_S,
  WAVE_DURATION_S,
  WAVE_EASE,
  flutedGlassAtProgress,
} from './conversionPreviewConfig'

function usePreviewFillColor(): string {
  const [color, setColor] = useState(PREVIEW_COLOR_BACK_DARK)
  useEffect(() => {
    const read = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue('--fc-preview')
        .trim()
      setColor(v || PREVIEW_COLOR_BACK_DARK)
    }
    read()
    const root = document.documentElement
    const obs = new MutationObserver(read)
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return color
}

interface Props {
  src: string | null
  /** Source preview URL while a conversion result is pending (usually previewUrl). */
  previewSrc?: string | null
  /** Converted blob URL when the job has finished. */
  outputSrc?: string | null
  /** Display box size (CSS); source image stays full-resolution via shader / img. */
  width: number
  height: number
  mimeType?: string
  isResult?: boolean
  jobStatus?: 'idle' | 'running' | 'done' | 'error'
  /** When true, play the fluted-glass reveal (duration from config; independent of encode). */
  conversionWavePending?: boolean
  onWaveComplete?: () => void
  onNaturalSize?: (width: number, height: number) => void
}

/**
 * Node preview: fluted-glass shader on the source image while converting;
 * crossfade to full output when encode finishes and the reveal completes.
 */
export function ConversionPreview({
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
  const [shaderOpacity, setShaderOpacity] = useState(waveEligible ? 1 : 0)
  const [resultOpacity, setResultOpacity] = useState(0)
  const [shaderFailed, setShaderFailed] = useState(false)
  const waveSessionRef = useRef(0)
  const crossfadeSessionRef = useRef(0)
  const onWaveCompleteRef = useRef(onWaveComplete)
  onWaveCompleteRef.current = onWaveComplete

  const previewFill = usePreviewFillColor()
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
    setShaderOpacity(1)
    setResultOpacity(0)
    setShaderFailed(false)

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
        setShaderOpacity(0)
        setResultOpacity(1)
      }
      return
    }

    crossfadeSessionRef.current += 1
    const session = crossfadeSessionRef.current

    if (reducedMotion) {
      setShaderOpacity(0)
      setResultOpacity(1)
      return
    }

    const ctrl = animate(0, 1, {
      duration: REVEAL_CROSSFADE_S,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (v) => {
        if (session !== crossfadeSessionRef.current) return
        setResultOpacity(v)
        setShaderOpacity(1 - v)
      },
      onComplete: () => {
        if (session !== crossfadeSessionRef.current) return
        setResultOpacity(1)
        setShaderOpacity(0)
      },
    })
    return () => ctrl.stop()
  }, [readyToReveal, reducedMotion, waveEligible, waveFinished])

  const showShader =
    !shaderFailed && shaderOpacity > 0.001 && (waveEligible || waveFinished)
  const showResultImg = !!outputSrc && (readyToReveal || resultOpacity > 0)
  const resultVisible = readyToReveal && resultOpacity >= 0.999
  const showPreviewImg =
    (!showShader && !showResultImg) ||
    (shaderFailed && waveEligible && !showResultImg)

  const glassParams = useMemo(
    () => ({ ...flutedGlassAtProgress(waveT), colorBack: previewFill }),
    [waveT, previewFill],
  )
  const boxW = Math.max(1, Math.round(width))
  const boxH = Math.max(1, Math.round(height))

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      onNaturalSize?.(img.naturalWidth, img.naturalHeight)
    }
  }

  return (
    <div
      className="file-node__preview"
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
      {showShader ? (
        <>
          <img
            src={sourcePreview}
            alt=""
            className="file-node__preview-img file-node__preview-img--probe"
            aria-hidden
            onLoad={onImgLoad}
          />
          <div
            className="file-node__preview-shader"
            style={{ opacity: shaderOpacity }}
          >
            <FlutedGlass
              image={sourcePreview}
              width={boxW}
              height={boxH}
              maxPixelCount={FLUTED_GLASS_MAX_PIXEL_COUNT}
              speed={0}
              frame={0}
              colorBack={glassParams.colorBack}
              colorShadow={glassParams.colorShadow}
              colorHighlight={glassParams.colorHighlight}
              shadows={glassParams.shadows}
              highlights={glassParams.highlights}
              size={glassParams.size}
              shape={glassParams.shape}
              angle={glassParams.angle}
              distortionShape={glassParams.distortionShape}
              distortion={glassParams.distortion}
              shift={glassParams.shift}
              stretch={glassParams.stretch}
              blur={glassParams.blur}
              edges={glassParams.edges}
              margin={glassParams.margin}
              grainMixer={glassParams.grainMixer}
              grainOverlay={glassParams.grainOverlay}
              fit={glassParams.fit}
              scale={glassParams.scale}
              onError={() => setShaderFailed(true)}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

/** @deprecated Use ConversionPreview */
export const PixelationPreview = ConversionPreview
