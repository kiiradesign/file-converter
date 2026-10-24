# Tauri readiness (future macOS app)

The **shipping product today is the web app** (`npm run build` → static `dist/`). A Tauri macOS wrapper is **planned, not implemented**. This document describes the separation already in the repo so a later shell can plug in without rewriting conversion logic.

## Runtime detection

- `src/platform.ts` — `detectRuntime()` returns `'desktop'` when `window.__TAURI__` is present (Tauri’s inject), otherwise `'web'`.
- Call **`isDesktop()` at use time**, not at module init, so detection stays correct after the Tauri bootstrap loads.

## I/O abstraction

| Module | Role |
|--------|------|
| `src/io/web.ts` | File inputs, drag-drop, object URLs, `<a download>`, JSZip |
| `src/io/desktop.ts` | Stub: re-exports web today; path-based pick/save will live here |
| `src/io/index.ts` | Facade — dispatches to web vs desktop per call |

UI and store code should import from `src/io` (or the store’s existing re-exports), not from `web.ts` directly, so desktop can swap save/pick later.

## Conversion abstraction

| Module | Role |
|--------|------|
| `src/convert/web/*` | All encoders used in production today |
| `src/convert/desktop/index.ts` | Stub delegating to web encoders; hook for native/CLI backends later |
| `src/convert/jobs.ts` | `runConversion()` chooses web vs desktop per job via `isDesktop()` |
| `src/convert/formats.ts` | Shared format lists and helpers (no DOM) |

Shared paths (`formats.ts`, `jobs.ts`, types, placement libs) avoid assuming `window` except where encoding truly needs canvas (web and Tauri webview both provide it).

## What a Tauri integration would add (out of scope now)

1. Tauri project + `tauri.conf.json` pointing at Vite `dist/`.
2. Replace `src/io/desktop.ts` with dialog + filesystem writes (and optional folder pick).
3. Optionally route heavy codecs through Rust sidecars instead of WASM/canvas.
4. Gate dev-only hooks (e.g. `window.__FC_STORE__` in `main.tsx`) behind `import.meta.env.DEV`.

No Tauri crate or config lives in this repo yet — intentionally.

## Web-only assumptions to keep isolated

- Hidden `<input type="file">` and `webkitdirectory` — `io/web.ts` only.
- `downloadBlob` / anchor clicks — web save path; desktop should use native save dialogs.
- `readDroppedItems(DataTransfer)` — canvas drop handler; desktop may use Tauri drag-drop events separately in `Canvas.tsx` later.

Canvas store and React Flow remain shared; only I/O and optional save entry points need desktop variants.
