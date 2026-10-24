# File Converter

File Converter is a local-first tool for turning PNGs, JPGs, WEBPs, HEIC, SVG, and more into other formats without leaving your machine. Drop files or whole folders onto a dotted canvas, connect conversions with **`+`**, tune quality and resolution, then save results. Each convert or compress step becomes a **new node** on the canvas — the graph is your version history.

### Key UX

| Area | Behavior |
|------|----------|
| **Infinite canvas** | React Flow dotted surface; pan/zoom; file and folder nodes with aspect-correct previews at full source resolution |
| **Folders** | Import a directory (picker or drag-and-drop), drill in with a click, navigate back with breadcrumbs |
| **Convert** | Hover a file → **`+`** → pick a target format (source format is excluded; use **Compress** to re-encode same type) |
| **Batch folder convert** | Start connect from a **folder** node → same quality/resolution panel → **Convert** runs all convertible children into a new result folder tree |
| **Compress** | On a result node, re-encode further in the same format (never mutates the original source node) |
| **Fluted-glass preview** | While encoding, a shader “wave” reveals the output; when the job finishes, crossfade to the final image |
| **Save** | Download a single file, or zip an entire folder (keeps relative paths) |
| **Theme** | Dark / light chrome |

---

## Supported formats

| Role | Extensions |
|------|------------|
| **Decode (sources)** | PNG, JPG/JPEG, WEBP, GIF, BMP, AVIF, HEIC/HEIF, SVG |
| **Encode (outputs)** | PNG, JPG, WEBP, AVIF, GIF, BMP, PDF |
| **Notes** | HEIC/HEIF and SVG are decode-only in the browser (preview + convert *from* them). PDF output rasterizes the image. |

Encoders: Canvas API (PNG/JPG/WEBP), `@jsquash/avif`, `gifenc`, BMP writer, `jspdf`, `libheif-js` (HEIC preview), SVG rasterization.

---

## How to use

1. **Add media** — Double-click empty canvas → **Files** or **Folder**; drag-and-drop files/folders; or **Shift-double-click** for the folder picker.
2. **Convert** — Hover a file → **`+`** → choose format → adjust **Quality** / **Resolution** → **Convert**.
3. **Folder batch** — Hover a folder → **`+`** → format and sliders → **Convert** (creates a parallel result folder).
4. **Compress** — Hover a finished result → **Compress** to chain another same-format encode.
5. **Save** — **Save** on a file or folder node to download (folder → ZIP).
6. **Drill-in** — Click a folder node; use the breadcrumb to go back.

---

## Run and build

**Requirements:** Node.js 20+ (LTS recommended), npm.

```bash
git clone https://github.com/kiiradesign/file-converter.git
cd file-converter
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/).

```bash
npm run build    # typecheck + production bundle → dist/
npm run preview  # serve dist/ locally
npm run lint     # oxlint
npm run smoke    # headless UI smoke (dev server must be running)
```

There is **no backend**. The app is static assets after `npm run build`; deploy `dist/` to any static host.

---

## Tech stack

- **UI:** Vite, React 19, TypeScript, `@xyflow/react`, Geist, Dialkit sliders, Motion
- **Preview:** `@paper-design/shaders-react` (fluted-glass reveal)
- **State:** Zustand
- **I/O:** Browser file APIs + JSZip for folder download
- **Conversion:** `src/convert/web/*` encoders; job queue with bounded concurrency

Platform routing (`src/platform.ts`, `src/io/*`, `src/convert/desktop/*`) keeps web and future desktop paths separate — details in [docs/tauri-readiness.md](docs/tauri-readiness.md).

---

**Final web app (v0.1)** — convert images on an infinite canvas in the browser. Everything runs locally in your tab; nothing is uploaded to a server.

A **native macOS desktop app** is planned later via [Tauri](https://tauri.app/). That wrapper is **not shipped yet**; this repository is the production web build. See [docs/tauri-readiness.md](docs/tauri-readiness.md) for how the codebase stays ready for a future shell.

---

## License

See [LICENSE](LICENSE).
