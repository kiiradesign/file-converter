/**
 * Capture demo screenshots for the PR / media store.
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.FC_URL || 'http://127.0.0.1:5173/'
const MEDIA = '/cursor/stores/bc-c6100606-1463-4809-a0d0-30bd18709baf/media'
const ART = '/opt/cursor/artifacts/screenshots'
fs.mkdirSync(ART, { recursive: true })
fs.mkdirSync(MEDIA, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto(BASE, { waitUntil: 'networkidle0' })

async function shot(name) {
  const p1 = path.join(ART, name)
  const p2 = path.join(MEDIA, name)
  await page.screenshot({ path: p1, type: 'png' })
  fs.copyFileSync(p1, p2)
  console.log('saved', p2)
}

await shot('file-converter-demo-chrome.png')

await page.evaluate(async () => {
  const store = window.__FC_STORE__
  // reset
  store.setState({ nodes: [], edges: [], files: {}, folders: {}, folderStack: [], draft: null })

  const makePng = async (w, h, colorA, colorB, label) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, colorA)
    g.addColorStop(1, colorB)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = 'bold 22px Geist, sans-serif'
    ctx.fillText(label, 24, 48)
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
    return new File([blob], `${label}.png`, { type: 'image/png' })
  }

  const file = await makePng(320, 400, '#c4c4c4', '#e8e8e8', 'FILENAME')
  await store.getState().addFilesAt([file], { x: 220, y: 180 })

  const f1 = await makePng(64, 64, '#4ade80', '#22c55e', 'a')
  const f2 = await makePng(64, 64, '#f472b6', '#ec4899', 'b')
  await store.getState().addFolderAt(
    'Folder Name',
    [
      { file: f1, relativePath: 'Folder Name/a.png' },
      { file: f2, relativePath: 'Folder Name/b.png' },
    ],
    { x: 700, y: 160 },
  )
})

await new Promise((r) => setTimeout(r, 400))

// Convert source file
await page.evaluate(async () => {
  const store = window.__FC_STORE__
  const fileNode = store.getState().nodes.find((n) => n.data.kind === 'file' && !n.data.isResult && n.data.canvasId === null)
  store.getState().startConnect(fileNode.id, { x: 0, y: 0 })
  store.getState().updateDraftSettings({ format: 'webp', quality: 75, resolution: 100 })
  await store.getState().confirmDraft()
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 80))
    const done = store.getState().nodes.find((n) => n.data.isResult && n.data.kind === 'file' && n.data.jobStatus === 'done')
    if (done) break
  }
})

await new Promise((r) => setTimeout(r, 300))

// Convert folder
await page.evaluate(async () => {
  const store = window.__FC_STORE__
  const folder = store.getState().nodes.find((n) => n.data.kind === 'folder' && !n.data.isResult && n.data.canvasId === null)
  store.getState().startConnect(folder.id, { x: 0, y: 0 })
  store.getState().updateDraftSettings({ format: 'jpg', quality: 80 })
  await store.getState().confirmDraft()
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 80))
    const done = store.getState().nodes.find((n) => n.data.isResult && n.data.kind === 'folder' && n.data.jobStatus === 'done')
    if (done) break
  }
})

await new Promise((r) => setTimeout(r, 400))
await shot('file-converter-demo-convert.png')

// Hover-ish: open panel on result for adjust, and force hover class via evaluate
await page.evaluate(() => {
  const store = window.__FC_STORE__
  const result = store.getState().nodes.find((n) => n.data.kind === 'file' && n.data.isResult)
  store.getState().startAdjust(result.id, { x: 0, y: 0 })
})
await new Promise((r) => setTimeout(r, 400))
await shot('file-converter-demo-panel.png')

await page.evaluate(async () => {
  const store = window.__FC_STORE__
  store.getState().updateDraftSettings({ format: 'jpg', quality: 55 })
  await store.getState().confirmDraft()
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 80))
    const chain = store.getState().nodes.filter((n) => n.data.kind === 'file' && n.data.isResult)
    if (chain.length >= 2 && chain.every((n) => n.data.jobStatus === 'done')) break
  }
})
await new Promise((r) => setTimeout(r, 300))
await shot('file-converter-demo-chain.png')

// Folder drill-in
await page.evaluate(() => {
  const store = window.__FC_STORE__
  store.getState().cancelDraft()
  const folder = store.getState().nodes.find((n) => n.data.kind === 'folder' && !n.data.isResult)
  store.getState().enterFolder(folder.data.folderId)
})
await new Promise((r) => setTimeout(r, 300))
await shot('file-converter-demo-folder.png')

await browser.close()
console.log('done')
