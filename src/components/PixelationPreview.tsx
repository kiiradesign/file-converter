import { HalftoneCmyk } from '@paper-design/shaders-react'
import { animate } from 'motion'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  HALFTONE_CMYK,
  HALFTONE_COLOR_BACK_DARK,
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
  /** Play wave for the full 1s once a result conversion starts (flag or running job). */
  const waveEligible =
    !!isResult &&
    jobStatus !== 'error' &&
    (conversionWavePending === true || jobStatus === 'running')

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
  const waveSessionRef = useRef(0)
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
      return
    }

    waveSessionRef.current += 1
    const session = waveSessionRef.current
    setWaveT(0)
    setWaveFinished(false)

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

  const showResult = waveFinished && jobDone && !!outputSrc
  const underlaySrc = previewSrc || fallbackSrc
  const displaySrc = showResult ? outputSrc! : underlaySrc
  const showWave = waveEligible && !waveFinished
  const useShader = canUseWebGL()

  return (
    <div className="file-node__preview" style={{ width: '100%', height: '100%' }}>
      <img
        key={showWave ? underlaySrc : displaySrc}
        src={showWave ? underlaySrc : displaySrc}
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
          src={underlaySrc}
          width={width}
          height={height}
          waveT={waveT}
          useShader={useShader}
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
  return v || HALFTONE_CMYK.colorBack || HALFTONE_COLOR_BACK_DARK
}

function waveMaskStyle(waveT: number): React.CSSProperties {
  const reveal = Math.min(1, Math.max(0, waveT))
  const softPct = WAVE_SOFTNESS * 100
  const frontPct = reveal * 100
  const maskImage = `linear-gradient(to bottom, black 0%, black ${Math.max(0, frontPct - softPct)}%, transparent ${Math.min(100, frontPct + softPct)}%, transparent 100%)`
  return {
    WebkitMaskImage: maskImage,
    maskImage,
  }
}

function HalftoneWaveOverlay({
  src,
  width,
  height,
  waveT,
  useShader,
}: {
  src: string
  width: number
  height: number
  waveT: number
  useShader: boolean
}) {
  const colorBack = useSyncExternalStore(
    subscribeTheme,
    readHalftoneBack,
    () => HALFTONE_COLOR_BACK_DARK,
  )
  const [shaderFailed, setShaderFailed] = useState(false)
  const [sourceReady, setSourceReady] = useState(false)
  const boxW = Math.max(1, Math.round(width))
  const boxH = Math.max(1, Math.round(height))

  useEffect(() => {
    if (!src) {
      setSourceReady(false)
      return
    }
    let cancelled = false
    setSourceReady(false)
    const img = new Image()
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
    <div className="file-node__preview-halftone" style={waveMaskStyle(waveT)}>
      {showShader ? (
        <div className="file-node__preview-halftone-shader" aria-hidden>
          <HalftoneCmyk
            image={src}
            width={boxW}
            height={boxH}
            maxPixelCount={HALFTONE_MAX_PIXEL_COUNT}
            speed={0}
            frame={0}
            {...HALFTONE_CMYK}
            colorBack={colorBack}
            onError={() => setShaderFailed(true)}
          />
        </div>
      ) : null}
      <PixelGridWaveFallback
        src={src}
        width={boxW}
        height={boxH}
        colorBack={colorBack}
      />
    </div>
  )
}

/** Visible top→bottom pixel-grid wave when WebGL halftone is unavailable. */
function PixelGridWaveFallback({
  src,
  width,
  height,
  colorBack,
}: {
  src: string
  width: number
  height: number
  colorBack: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false
    const img = new Image()
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      if (cancelled) return
      const cell = Math.max(4, Math.round(Math.min(width, height) / 28))
      const cols = Math.ceil(width / cell)
      const rows = Math.ceil(height / cell)
      const off = document.createElement('canvas')
      off.width = cols
      off.height = rows
      const octx = off.getContext('2d')
      if (!octx) return
      octx.drawImage(img, 0, 0, cols, rows)
      const data = octx.getImageData(0, 0, cols, rows).data

      ctx.fillStyle = colorBack
      ctx.fillRect(0, 0, width, height)

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4
          const r = data[i]!
          const g = data[i + 1]!
          const b = data[i + 2]!
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
          const dot = (1 - lum) * (cell * 0.42)
          if (dot < 0.6) continue
          const cx = x * cell + cell / 2
          const cy = y * cell + cell / 2
          ctx.fillStyle =
            lum < 0.35
              ? HALFTONE_CMYK.colorK
              : x % 3 === 0
                ? HALFTONE_CMYK.colorC
                : x % 3 === 1
                  ? HALFTONE_CMYK.colorM
                  : HALFTONE_CMYK.colorY
          ctx.beginPath()
          ctx.arc(cx, cy, dot, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    img.onerror = () => {
      if (cancelled || !canvasRef.current) return
      const c = canvasRef.current.getContext('2d')
      if (!c) return
      c.fillStyle = colorBack
      c.fillRect(0, 0, width, height)
      c.fillStyle = HALFTONE_CMYK.colorC
      const cell = 8
      for (let y = 0; y < height; y += cell) {
        for (let x = 0; x < width; x += cell) {
          if ((x + y) % (cell * 2) === 0) {
            c.fillRect(x, y, cell - 1, cell - 1)
          }
        }
      }
    }
    img.src = src

    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
    }
  }, [src, width, height, colorBack])

  return (
    <canvas
      ref={canvasRef}
      className="file-node__preview-wave-fallback"
      width={width}
      height={height}
      aria-hidden
    />
  )
}
