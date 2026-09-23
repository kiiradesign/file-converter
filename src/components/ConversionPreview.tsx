import { FlutedGlass } from '@paper-design/shaders-react'
import { animate } from 'motion'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  FLUTED_GLASS_MAX_PIXEL_COUNT,
  PREVIEW_COLOR_BACK_DARK,
  REVEAL_CROSSFADE_S,
  WAVE_DURATION_S,
  WAVE_EASE,
  flutedGlassAtProgress,
  glassAmountAtProgress,
  resultBlendAtProgress,
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
  /** Incremented to restart the wave without toggling pending (debug replay). */
  conversionWaveReplayKey?: number
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
  conversionWaveReplayKey,
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
      conversionWaveReplayKey={conversionWaveReplayKey}
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
  conversionWaveReplayKey,
  width,
  height,
  onNaturalSize,
  onWaveComplete,
}: {
  sourcePreview: string
  outputSrc?: string | null
  jobDone: boolean
  waveEligible: boolean
  conversionWaveReplayKey?: number
  width: number
  height: number
  onNaturalSize?: (width: number, height: number) => void
  onWaveComplete?: () => void
}) {
  const [waveT, setWaveT] = useState(() => (waveEligible ? 0 : 1))
  const [waveFinished, setWaveFinished] = useState(() => !waveEligible)
  const [lateRevealOpacity, setLateRevealOpacity] = useState(0)
  const [shaderFailed, setShaderFailed] = useState(false)
  const [shaderPaintReady, setShaderPaintReady] = useState(false)
  const shaderWrapRef = useRef<HTMLDivElement>(null)
  const waveSessionRef = useRef(0)
  const crossfadeSessionRef = useRef(0)
  const encodeFinishedAfterWaveRef = useRef(false)
  const onWaveCompleteRef = useRef(onWaveComplete)
  onWaveCompleteRef.current = onWaveComplete
  const jobReadyRef = useRef(false)
  jobReadyRef.current = jobDone && !!outputSrc

  const previewFill = usePreviewFillColor()
  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useLayoutEffect(() => {
    if (!waveEligible) {
      setWaveT(1)
      setWaveFinished(true)
      return
    }

    waveSessionRef.current += 1
    const session = waveSessionRef.current
    setWaveT(0)
    setWaveFinished(false)
    setLateRevealOpacity(0)
    setShaderFailed(false)
    setShaderPaintReady(false)
    encodeFinishedAfterWaveRef.current = false

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
        if (!jobReadyRef.current) {
          encodeFinishedAfterWaveRef.current = true
        } else {
          setLateRevealOpacity(1)
        }
        onWaveCompleteRef.current?.()
      },
    })
    return () => ctrl.stop()
  }, [waveEligible, reducedMotion, conversionWaveReplayKey])

  useLayoutEffect(() => {
    if (!waveEligible || shaderFailed) {
      setShaderPaintReady(false)
      return
    }
    let cancelled = false
    const markReady = () => {
      if (!cancelled) setShaderPaintReady(true)
    }
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(markReady)
    })
    const el = shaderWrapRef.current
    const canvas = el?.querySelector('canvas')
    if (canvas) {
      canvas.addEventListener('webglcontextrestored', markReady)
    }
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      canvas?.removeEventListener('webglcontextrestored', markReady)
    }
  }, [waveEligible, shaderFailed, sourcePreview, conversionWaveReplayKey])

  const jobReady = jobDone && !!outputSrc
  const waveActive = waveEligible && !waveFinished
  const unifiedReveal = jobReady && waveEligible && waveActive
  const lateRevealPending = jobReady && waveFinished && lateRevealOpacity < 0.999

  useEffect(() => {
    if (!waveEligible && waveFinished && jobReady) {
      setLateRevealOpacity(1)
      return
    }
    if (!jobReady || !waveFinished) {
      if (!jobReady) setLateRevealOpacity(0)
      return
    }
    if (!encodeFinishedAfterWaveRef.current) {
      setLateRevealOpacity(1)
      return
    }
    encodeFinishedAfterWaveRef.current = false

    crossfadeSessionRef.current += 1
    const session = crossfadeSessionRef.current

    if (reducedMotion) {
      setLateRevealOpacity(1)
      return
    }

    const ctrl = animate(0, 1, {
      duration: REVEAL_CROSSFADE_S,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (v) => {
        if (session !== crossfadeSessionRef.current) return
        setLateRevealOpacity(v)
      },
      onComplete: () => {
        if (session !== crossfadeSessionRef.current) return
        setLateRevealOpacity(1)
      },
    })
    return () => ctrl.stop()
  }, [jobReady, reducedMotion, waveEligible, waveFinished])

  const glassAmount = glassAmountAtProgress(waveT)
  const unifiedResultOpacity = unifiedReveal ? resultBlendAtProgress(waveT) : 0
  const unifiedShaderOpacity = unifiedReveal ? glassAmount : waveEligible || waveFinished ? 1 : 0

  const resultOpacity = unifiedReveal ? unifiedResultOpacity : lateRevealOpacity
  const shaderOpacity = unifiedReveal
    ? unifiedShaderOpacity
    : lateRevealPending
      ? 1 - lateRevealOpacity
      : waveEligible || (waveFinished && !jobReady)
        ? 1
        : 0

  const showShaderLayer =
    !shaderFailed && shaderOpacity > 0.001 && (waveEligible || waveFinished)
  const shaderRevealReady = !waveActive || shaderPaintReady
  const showResultImg = !!outputSrc && resultOpacity > 0.001
  const resultVisible = resultOpacity >= 0.999
  const showPreviewImg =
    !waveEligible &&
    ((!showShaderLayer && !showResultImg) ||
      (shaderFailed && !showResultImg))

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
      className={`file-node__preview${waveActive ? ' file-node__preview--wave' : ''}`}
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
      {showShaderLayer ? (
        <>
          <img
            src={sourcePreview}
            alt=""
            className="file-node__preview-img file-node__preview-img--probe"
            aria-hidden
            onLoad={onImgLoad}
          />
          <div
            ref={shaderWrapRef}
            className="file-node__preview-shader"
            style={{
              opacity: shaderRevealReady ? shaderOpacity : 0,
              background: previewFill,
            }}
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
