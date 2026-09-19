# File Converter

**Convert images on an infinite canvas — formats, quality, and folders, all in the browser.**

File Converter is a local-first tool for turning PNGs, JPGs, WEBPs (and more) into other formats without uploading anything. Drop files or whole folders onto a dotted canvas, wire conversions with `+`, tweak quality and resolution, then save results.

Built for people who want conversion to feel like arranging work on a desk — not filling out a form.

---

## Why File Converter?

Most converters are upload → wait → download, with no sense of history. Here every convert and compress step is a **new node** on the canvas. The graph *is* the version history. Folders drill in. Nothing leaves your machine.

---

## Features

- **Infinite dotted canvas** with file and folder nodes (aspect-correct previews at full source resolution)
- **Add files or an entire folder** — double-click → Files / Folder chooser; Shift-double-click → folder picker; drag-and-drop folders
- **In-browser encode:** PNG, JPG, WEBP, AVIF, GIF, BMP, PDF
- Convert list shows **other formats only** (same-format re-encode stays on **Compress**)
- **Quality** and **Resolution** sliders; convert panel titled **Convert to JPG** (etc.)
- **Compress** creates a new chained same-format result (never mutates the source)
- **Save** downloads a file; folder Save zips contents
- Folder drill-in with breadcrumb back navigation
- Dark / light chrome
- Fully **client-side** — no server uploads, no tracking

---

## How to use

1. **Add media**
   - Double-click empty canvas → choose **Files** or **Folder**
   - Or **drop** files/folders onto the canvas
   - Or **Shift-double-click** to open the folder picker directly
2. Hover a file → click **`+`** to convert to another format (source format is not listed).
3. Pick a format, tune quality / resolution, click **Convert**.
4. Hover a result → **Compress** to re-encode further (same type); or **Save** to download.
5. Click a **folder** node to drill in; use the breadcrumb to go back.

That's it.

---

## Tech

- Vite + React 19 + TypeScript
- React Flow (`@xyflow/react`) canvas
- Geist typography + Dialkit sliders
- Encoders: Canvas (`png` / `jpg` / `webp`), `@jsquash/avif`, `gifenc`, BMP writer, `jspdf`
- Zustand store; JSZip for folder download

No backend. No uploads. No tracking.

---

## Local development

```bash
git clone https://github.com/kiiradesign/file-converter.git
cd file-converter
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/).

```bash
npm run build   # production build
npm run lint    # oxlint
```
