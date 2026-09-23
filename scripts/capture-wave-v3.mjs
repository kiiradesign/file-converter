import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://127.0.0.1:5173/'
const OUT = '/cursor/stores/bc-c6100606-1463-4809-a0d0-30bd18709baf/media/pixelation-wave-v3.png'
fs.mkdirSync(path.dirname(OUT), { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto(BASE, { waitUntil: 'networkidle0' })

await page.evaluate(async () => {
  const store = window.__FC_STORE__
  store.setState({ nodes: [], edges: [], files: {}, folders: {}, folderStack: [], draft: null })

  const c = document.createElement('canvas')
  c.width = 1200
  c.height = 960
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 400, 320)
  g.addColorStop(0, '#3b82f6')
  g.addColorStop(0.5, '#a855f7')
  g.addColorStop(1, '#f97316')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 400, 320)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 28px sans-serif'
  ctx.fillText('WAVE', 480, 510)
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
  const file = new File([blob], 'wave-test.png', { type: 'image/png' })
  await store.getState().addFilesAt([file], { x: 420, y: 220 })
})

await new Promise((r) => setTimeout(r, 400))

await page.evaluate(async () => {
  const store = window.__FC_STORE__
  const fileNode = store
    .getState()
    .nodes.find((n) => n.data.kind === 'file' && !n.data.isResult && n.data.canvasId === null)
  store.getState().startConnect(fileNode.id, { x: 0, y: 0 })
  store.getState().updateDraftSettings({ format: 'webp', quality: 80, resolution: 100 })
  await store.getState().confirmDraft()
})

let shot = false
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 40))
  const mid = await page.evaluate(() => {
    const overlay = document.querySelector('.file-node__preview-halftone')
    if (!overlay) return false
    const op = parseFloat(getComputedStyle(overlay).opacity || '1')
    const result = window.__FC_STORE__
      .getState()
      .nodes.find((n) => n.data.kind === 'file' && n.data.isResult)
    return op > 0.85 && result?.data?.conversionWavePending === true
  })
  if (mid) {
    const nodes = await page.$$('.file-node')
    const resultNode = nodes[nodes.length - 1]
    if (resultNode) {
      await resultNode.screenshot({ path: OUT, type: 'png' })
      console.log('saved mid-wave', OUT)
      shot = true
      break
    }
  }
}

if (!shot) {
  await page.screenshot({ path: OUT, type: 'png' })
  console.log('fallback full page', OUT)
}

await browser.close()
