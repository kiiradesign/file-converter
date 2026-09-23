import { ImageDithering } from '@paper-design/shaders-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  BLOCK_WAVE,
  DITHER_MAX_PIXEL_COUNT,
  IMAGE_DITHERING,
  blockGridDimensions,
} from './pixelationWaveConfig'

interface Props {
  src: string
  width: number
  height: number
  /** Wave progress 0 → 1 (top to bottom). */
  waveT: number
  /** 1 = fully visible WebGL layer; 0 = hidden (crossfade to output img). */
  layerOpacity?: number
  colorBack: string
}

function waitForDitherCanvas(root: HTMLElement): Promise<HTMLCanvasElement> {
  const existing = root.querySelector('canvas')
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve, reject) => {
    const obs = new MutationObserver(() => {
      const canvas = root.querySelector('canvas')
      if (canvas) {
        obs.disconnect()
        resolve(canvas)
      }
    })
    obs.observe(root, { childList: true, subtree: true })
    window.setTimeout(() => {
      obs.disconnect()
      const canvas = root.querySelector('canvas')
      if (canvas) resolve(canvas)
      else reject(new Error('dither canvas timeout'))
    }, 4000)
  })
}

function applyWaveMatrices(
  mesh: THREE.InstancedMesh,
  cols: number,
  rows: number,
  worldW: number,
  worldH: number,
  waveT: number,
) {
  const cellW = worldW / cols
  const cellH = worldH / rows
  const dummy = new THREE.Object3D()
  let i = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const yNorm = (row + 0.5) / rows
      const d = yNorm - waveT
      const band = BLOCK_WAVE.band
      const influence = Math.exp(-(d * d) / (2 * band * band))

      const gap = influence * BLOCK_WAVE.gapPeak
      const cx = -worldW / 2 + (col + 0.5) * cellW
      const cy = worldH / 2 - (row + 0.5) * cellH
      const spreadX = (col - (cols - 1) / 2) * gap * cellW * 0.08
      const spreadY = (row - (rows - 1) / 2) * gap * cellH * 0.08
      const jitterX = (Math.sin(col * 12.9898 + row * 78.233) * 43758.5453) % 1
      const jitterY = (Math.sin(col * 93.989 + row * 67.345) * 12741.5453) % 1

      dummy.position.set(
        cx + spreadX + (jitterX - 0.5) * influence * BLOCK_WAVE.jitter,
        cy + spreadY + (jitterY - 0.5) * influence * BLOCK_WAVE.jitter,
        influence * BLOCK_WAVE.zPeak,
      )
      dummy.rotation.set(
        influence * 0.12 * (jitterX - 0.5),
        influence * 0.12 * (jitterY - 0.5),
        influence * 0.08 * (jitterX - 0.5),
      )
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      i++
    }
  }
  mesh.instanceMatrix.needsUpdate = true
}

export function DitherBlockWaveWebGL({
  src,
  width,
  height,
  waveT,
  layerOpacity = 1,
  colorBack,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const ditherHostRef = useRef<HTMLDivElement>(null)
  const [ditherFailed, setDitherFailed] = useState(false)

  const boxW = Math.max(1, Math.round(width))
  const boxH = Math.max(1, Math.round(height))
  const grid = useMemo(() => blockGridDimensions(boxW, boxH), [boxW, boxH])

  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    mesh: THREE.InstancedMesh
    texture: THREE.CanvasTexture
    cols: number
    rows: number
    worldW: number
    worldH: number
  } | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    const ditherHost = ditherHostRef.current
    if (!mount || !ditherHost || ditherFailed) return

    let disposed = false
    let raf = 0

    const setup = async () => {
      let ditherCanvas: HTMLCanvasElement
      try {
        ditherCanvas = await waitForDitherCanvas(ditherHost)
      } catch {
        setDitherFailed(true)
        return
      }
      if (disposed) return

      const { cols, rows } = grid
      const worldW = 2
      const worldH = (boxH / boxW) * worldW
      const cellW = worldW / cols
      const cellH = worldH / rows

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(boxW, boxH, false)
      renderer.setClearColor(0x000000, 0)
      mount.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(
        BLOCK_WAVE.fov,
        boxW / boxH,
        0.01,
        20,
      )
      camera.position.set(0, 0, BLOCK_WAVE.cameraZ)
      camera.lookAt(0, 0, 0)

      const texture = new THREE.CanvasTexture(ditherCanvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.NearestFilter

      const geometry = new THREE.PlaneGeometry(cellW * 0.92, cellH * 0.92)
      const uvOffsets = new Float32Array(cols * rows * 2)
      const uvScales = new Float32Array(cols * rows * 2)
      let idx = 0
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const u0 = col / cols
          const v0 = 1 - (row + 1) / rows
          const u1 = (col + 1) / cols
          const v1 = 1 - row / rows
          uvOffsets[idx * 2] = u0
          uvOffsets[idx * 2 + 1] = v0
          uvScales[idx * 2] = u1 - u0
          uvScales[idx * 2 + 1] = v1 - v0
          idx++
        }
      }
      geometry.setAttribute(
        'instanceUvOffset',
        new THREE.InstancedBufferAttribute(uvOffsets, 2),
      )
      geometry.setAttribute(
        'instanceUvScale',
        new THREE.InstancedBufferAttribute(uvScales, 2),
      )

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
      })
      material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
          attribute vec2 instanceUvOffset;
          attribute vec2 instanceUvScale;
          varying vec2 vBlockUv;`,
        )
        shader.vertexShader = shader.vertexShader.replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
          vBlockUv = instanceUvOffset + uv * instanceUvScale;`,
        )
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
          varying vec2 vBlockUv;`,
        )
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
            vec4 sampledDiffuseColor = texture2D( map, vBlockUv );
            diffuseColor *= sampledDiffuseColor;
          #endif`,
        )
      }

      const mesh = new THREE.InstancedMesh(geometry, material, cols * rows)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      applyWaveMatrices(mesh, cols, rows, worldW, worldH, 0)

      scene.add(mesh)

      threeRef.current = {
        renderer,
        scene,
        camera,
        mesh,
        texture,
        cols,
        rows,
        worldW,
        worldH,
      }

      const tick = () => {
        if (disposed || !threeRef.current) return
        threeRef.current.texture.needsUpdate = true
        renderer.render(scene, camera)
        raf = requestAnimationFrame(tick)
      }
      tick()
    }

    void setup()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      const t = threeRef.current
      if (t) {
        t.mesh.geometry.dispose()
        ;(t.mesh.material as THREE.Material).dispose()
        t.texture.dispose()
        t.renderer.dispose()
        if (t.renderer.domElement.parentElement === mount) {
          mount.removeChild(t.renderer.domElement)
        }
        threeRef.current = null
      }
    }
  }, [boxW, boxH, grid, ditherFailed, src])

  useEffect(() => {
    const t = threeRef.current
    if (!t) return
    applyWaveMatrices(
      t.mesh,
      t.cols,
      t.rows,
      t.worldW,
      t.worldH,
      waveT,
    )
  }, [waveT])

  useEffect(() => {
    const t = threeRef.current
    if (!t) return
    t.renderer.domElement.style.opacity = String(layerOpacity)
  }, [layerOpacity])

  const ditherPx = Math.min(boxW * boxH, DITHER_MAX_PIXEL_COUNT)
  const ditherScale = Math.sqrt(ditherPx / (boxW * boxH))
  const ditherW = Math.max(1, Math.round(boxW * ditherScale))
  const ditherH = Math.max(1, Math.round(boxH * ditherScale))

  return (
    <>
      <div
        ref={ditherHostRef}
        className="file-node__preview-dither-capture"
        aria-hidden
        style={{ width: ditherW, height: ditherH }}
      >
        {!ditherFailed ? (
          <ImageDithering
            image={src}
            width={ditherW}
            height={ditherH}
            speed={0}
            frame={0}
            {...IMAGE_DITHERING}
            colorBack={colorBack}
            onError={() => setDitherFailed(true)}
          />
        ) : null}
      </div>
      <div
        ref={mountRef}
        className="file-node__preview-webgl"
        style={{
          opacity: layerOpacity,
          background: colorBack,
        }}
      />
    </>
  )
}
