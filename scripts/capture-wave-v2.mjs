/**
 * Capture mid-wave screenshot + 300% zoom sliver check for conversion wave v2.
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.FC_URL || 'http://127.0.0.1:5173/'
const MEDIA =
  '/cursor/stores/bc-c6100606-1463-4809-a0d0-30bd18709baf/media/conversion-wave-demo-v2.png'
const ART = '/opt/cursor/artifacts/screenshots/conversion-wave-demo-v2.png'
fs.mkdirSync(path.dirname(ART), { recursive: true })
fs.mkdirSync(path.dirname(MEDIA), { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 })

// Dark theme (default)
await page.evaluate(async () => {
  const store = window.__FC_STORE__
  store.setState({ nodes: [], edges: [], files: {}, folders: {}, folderStack: [], draft: null })

  const c = document.createElement('canvas')
  c.width = 400
  c.height = 500
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 400, 500)
  g.addColorStop(0, '#2563eb')
  g.addColorStop(0.5, '#7c3aed')
  g.addColorStop(1, '#db2777')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 400, 500)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 28px sans-serif'
  ctx.fillText('WAVE TEST', 40, 80)
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
  const file = new File([blob], 'wave-test.png', { type: 'image/png' })
  await store.getState().addFilesAt([file], { x: 320, y: 220 })

  const fileNode = store.getState().nodes.find((n) => n.data.kind === 'file' && !n.data.isResult)
  store.getState().startConnect(fileNode.id, { x: 0, y: 0 })
  store.getState().updateDraftSettings({ format: 'webp', quality: 80, resolution: 100 })
  await store.getState().confirmDraft()
})

// Mid-wave (~500ms into 1s animation)
await new Promise((r) => setTimeout(r, 520))

const waveState = await page.evaluate(() => {
  const store = window.__FC_STORE__
  const result = store.getState().nodes.find((n) => n.data.kind === 'file' && n.data.isResult)
  const halftone = document.querySelector('.file-node__preview-halftone')
  const canvas = document.querySelector('.file-node__preview-wave-fallback')
  const img = document.querySelector('.file-node__preview-img')
  return {
    jobStatus: result?.data.jobStatus,
    wavePending: result?.data.conversionWavePending,
    halftone: !!halftone,
    canvasW: canvas?.width ?? 0,
    canvasH: canvas?.height ?? 0,
    imgSrc: img?.getAttribute('src')?.slice(0, 12) ?? null,
    previewUrl: !!store.getState().files[result?.data.fileId ?? '']?.previewUrl,
  }
})
console.log('waveState', waveState)

await page.screenshot({ path: ART, type: 'png' })
fs.copyFileSync(ART, MEDIA)
console.log('saved', MEDIA)

// Zoom canvas to 300% via React Flow viewport
await page.evaluate(() => {
  const rf = document.querySelector('.react-flow')
  if (!rf) return
  rf.dispatchEvent(new WheelEvent('wheel', { deltaY: -800, ctrlKey: true, bubbles: true }))
})
await new Promise((r) => setTimeout(r, 400))

const sliverCheck = await page.evaluate(() => {
  const media = document.querySelector('.file-node__card-media')
  if (!media) return { ok: false, reason: 'no card media' }
  const rect = media.getBoundingClientRect()
  const ctx = document.createElement('canvas').getContext('2d')
  const sample = (x, y) => {
    const el = document.elementFromPoint(x, y)
    if (!el) return null
    const style = getComputedStyle(el)
    return style.backgroundColor
  }
  const corners = [
    [rect.left + 2, rect.top + 2],
    [rect.right - 2, rect.top + 2],
    [rect.left + 2, rect.bottom - 2],
    [rect.right - 2, rect.bottom - 2],
  ].map(([x, y]) => sample(x, y))
  const whiteish = corners.filter(
    (c) => c && (c.includes('255, 255, 255') || c.includes('rgb(255, 255, 255)')),
  )
  return { corners, whiteishCount: whiteish.length, ok: whiteish.length === 0 }
})
console.log('sliverCheck', sliverCheck)

await browser.close()

if (!waveState.halftone || waveState.canvasW < 1) {
  console.error('Wave overlay missing or canvas 0×0')
  process.exit(1)
}
if (!waveState.previewUrl) {
  console.error('Result node missing previewUrl during wave')
  process.exit(1)
}
console.log('wave verify ok')
