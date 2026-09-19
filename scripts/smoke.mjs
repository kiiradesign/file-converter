/**
 * Headless smoke test for Milestone 1 conversion flow.
 * Uses the already-running dev server on 5173 when available.
 * Run: node scripts/smoke.mjs
 */
import puppeteer from 'puppeteer-core'

const BASE = process.env.FC_URL || 'http://127.0.0.1:5173/'

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 })

const sun = await page.$('button[aria-label="Toggle theme"]')
const title = await page.$('.chrome-title h1')
const credit = await page.$('.chrome-credit')
if (!sun || !title || !credit) {
  console.error('Chrome elements missing', { sun: !!sun, title: !!title, credit: !!credit })
  process.exit(1)
}

await sun.click()
await page.waitForSelector('[data-theme="light"]')
await sun.click()
await page.waitForSelector('[data-theme="dark"]')

await page.screenshot({
  path: '/opt/cursor/artifacts/screenshots/smoke-chrome.png',
})

const result = await page.evaluate(async () => {
  const store = window.__FC_STORE__
  if (!store) return { ok: false, reason: 'no store' }

  const c = document.createElement('canvas')
  c.width = 240
  c.height = 300
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 240, 300)
  g.addColorStop(0, '#5b9cff')
  g.addColorStop(1, '#ff6b6b')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 240, 300)
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
  const file = new File([blob], 'FILENAME.png', { type: 'image/png' })
  await store.getState().addFilesAt([file], { x: 200, y: 160 })

  const nodes = store.getState().nodes
  const fileNode = nodes.find((n) => n.data.kind === 'file')
  if (!fileNode) return { ok: false, reason: 'no file node' }

  store.getState().startConnect(fileNode.id, { x: 0, y: 0 })
  store.getState().updateDraftSettings({ format: 'webp', quality: 70, resolution: 80 })
  await store.getState().confirmDraft()

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100))
    const resultNode = store
      .getState()
      .nodes.find((n) => n.data.kind === 'file' && n.data.isResult)
    if (resultNode?.data.jobStatus === 'done') {
      store.getState().startAdjust(resultNode.id, { x: 0, y: 0 })
      store.getState().updateDraftSettings({ format: 'jpg', quality: 60 })
      await store.getState().confirmDraft()
      for (let j = 0; j < 50; j++) {
        await new Promise((r) => setTimeout(r, 100))
        const chain = store
          .getState()
          .nodes.filter((n) => n.data.kind === 'file' && n.data.isResult)
        if (chain.length >= 2 && chain.every((n) => n.data.jobStatus === 'done')) {
          const f1blob = await new Promise((r) => {
            const c2 = document.createElement('canvas')
            c2.width = 64
            c2.height = 64
            const x = c2.getContext('2d')
            x.fillStyle = '#4ade80'
            x.fillRect(0, 0, 64, 64)
            c2.toBlob(r, 'image/png')
          })
          const f2blob = await new Promise((r) => {
            const c2 = document.createElement('canvas')
            c2.width = 64
            c2.height = 64
            const x = c2.getContext('2d')
            x.fillStyle = '#f472b6'
            x.fillRect(0, 0, 64, 64)
            c2.toBlob(r, 'image/png')
          })
          await store.getState().addFolderAt(
            'Folder Name',
            [
              {
                file: new File([f1blob], 'a.png', { type: 'image/png' }),
                relativePath: 'Folder Name/a.png',
              },
              {
                file: new File([f2blob], 'b.png', { type: 'image/png' }),
                relativePath: 'Folder Name/b.png',
              },
            ],
            { x: 560, y: 120 },
          )
          const folderNode = store
            .getState()
            .nodes.find((n) => n.data.kind === 'folder' && !n.data.isResult)
          store.getState().enterFolder(folderNode.data.folderId)
          const inside = store.getState().visibleNodes().length
          store.getState().goBack()
          const back = store.getState().folderStack.length

          return {
            ok: true,
            nodes: store.getState().nodes.length,
            edges: store.getState().edges.length,
            results: chain.length,
            folderInside: inside,
            folderStackAfterBack: back,
          }
        }
      }
      return { ok: false, reason: 'chain incomplete' }
    }
    if (resultNode?.data.jobStatus === 'error') {
      return { ok: false, reason: 'conversion error' }
    }
  }
  return { ok: false, reason: 'timeout' }
})

await page.screenshot({
  path: '/opt/cursor/artifacts/screenshots/smoke-after-convert.png',
})
await page.screenshot({
  path: '/cursor/stores/bc-c6100606-1463-4809-a0d0-30bd18709baf/media/file-converter-demo-convert.png',
})

// Open convert panel visually for Dialkit screenshot
await page.evaluate(() => {
  const store = window.__FC_STORE__
  const fileNode = store.getState().nodes.find((n) => n.data.kind === 'file' && !n.data.isResult)
  if (fileNode) store.getState().startConnect(fileNode.id, { x: 0, y: 0 })
})
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({
  path: '/opt/cursor/artifacts/screenshots/smoke-panel.png',
})
await page.screenshot({
  path: '/cursor/stores/bc-c6100606-1463-4809-a0d0-30bd18709baf/media/file-converter-demo-chain.png',
})

console.log(JSON.stringify({ result, errors }, null, 2))
await browser.close()

if (!result?.ok || errors.length) process.exit(1)
