import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://127.0.0.1:5173/'
const OUT =
  '/cursor/stores/bc-c6100606-1463-4809-a0d0-30bd18709baf/media/fluted-glass-edges-fix.png'
fs.mkdirSync(path.dirname(OUT), { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
await page.goto(BASE, { waitUntil: 'networkidle0' })

await page.evaluate(async () => {
  const store = window.__FC_STORE__
  store.setState({ nodes: [], edges: [], files: {}, folders: {}, folderStack: [], draft: null })

  const c = document.createElement('canvas')
  c.width = 800
  c.height = 640
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 800, 640)
  g.addColorStop(0, '#2563eb')
  g.addColorStop(0.5, '#7c3aed')
  g.addColorStop(1, '#ea580c')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 800, 640)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 8
  ctx.strokeRect(4, 4, 792, 632)
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
  const file = new File([blob], 'edge-test.png', { type: 'image/png' })
  await store.getState().addFilesAt([file], { x: 480, y: 260 })
})

await new Promise((r) => setTimeout(r, 500))

await page.evaluate(async () => {
  const store = window.__FC_STORE__
  const fileNode = store
    .getState()
    .nodes.find((n) => n.data.kind === 'file' && !n.data.isResult && n.data.canvasId === null)
  store.getState().startConnect(fileNode.id, { x: 0, y: 0 })
  store.getState().updateDraftSettings({ format: 'webp', quality: 85, resolution: 100 })
  await store.getState().confirmDraft()
})

let captured = false
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 50))
  const mid = await page.evaluate(() => {
    const shader = document.querySelector('.file-node__preview-shader')
    if (!shader) return false
    const op = parseFloat(getComputedStyle(shader).opacity || '0')
    return op > 0.5
  })
  if (mid) {
    const card = await page.evaluateHandle(() => {
      const nodes = [...document.querySelectorAll('.file-node')]
      const result = nodes.find((el) =>
        /\.webp/i.test(el.querySelector('.file-node__label')?.textContent || ''),
      )
      return result?.querySelector('.file-node__card-media') ?? null
    })
    const cardEl = card.asElement()
    if (card) {
      await card.screenshot({ path: OUT })
      captured = true
      break
    }
  }
}

if (!captured) {
  await page.screenshot({ path: OUT, fullPage: true })
}

await browser.close()
console.log('Wrote', OUT, captured ? '(mid-wave card crop)' : '(fallback full page)')
