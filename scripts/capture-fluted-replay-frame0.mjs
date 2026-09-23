import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://127.0.0.1:5173/'
const OUT_DIR =
  '/cursor/stores/bc-c6100606-1463-4809-a0d0-30bd18709baf/media'
fs.mkdirSync(OUT_DIR, { recursive: true })

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
  c.width = 640
  c.height = 480
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 640, 480)
  g.addColorStop(0, '#0ea5e9')
  g.addColorStop(1, '#f97316')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 640, 480)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 48px sans-serif'
  ctx.fillText('FLUTE', 180, 260)
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
  const file = new File([blob], 'replay-test.png', { type: 'image/png' })
  await store.getState().addFilesAt([file], { x: 480, y: 260 })
})

await new Promise((r) => setTimeout(r, 400))

await page.evaluate(async () => {
  const store = window.__FC_STORE__
  const fileNode = store
    .getState()
    .nodes.find((n) => n.data.kind === 'file' && !n.data.isResult && n.data.canvasId === null)
  store.getState().startConnect(fileNode.id, { x: 0, y: 0 })
  store.getState().updateDraftSettings({ format: 'webp', quality: 85, resolution: 100 })
  await store.getState().confirmDraft()
})

for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 100))
  const done = await page.evaluate(() => {
    const result = [...document.querySelectorAll('.file-node')].find((el) =>
      /\.webp/i.test(el.querySelector('.file-node__label')?.textContent || ''),
    )
    return !!result?.querySelector('.file-node__preview-img--result')
  })
  if (done) break
}

await new Promise((r) => setTimeout(r, 500))
await page.click('.chrome-replay')
await new Promise((r) => setTimeout(r, 80))

const frame0 = path.join(OUT_DIR, 'fluted-replay-frame0.png')
const card = await page.evaluateHandle(() => {
  const result = [...document.querySelectorAll('.file-node')].find((el) =>
    /\.webp/i.test(el.querySelector('.file-node__label')?.textContent || ''),
  )
  return result?.querySelector('.file-node__card-media') ?? null
})
const cardEl = card.asElement()
if (cardEl) {
  await cardEl.screenshot({ path: frame0 })
} else {
  await page.screenshot({ path: frame0, fullPage: true })
}

await new Promise((r) => setTimeout(r, 1200))
const mid = path.join(OUT_DIR, 'fluted-replay-mid.png')
if (cardEl) {
  await cardEl.screenshot({ path: mid })
}

await browser.close()
console.log('Wrote', frame0, mid)
