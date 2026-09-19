export type Runtime = 'web' | 'desktop'

declare global {
  interface Window {
    __TAURI__?: unknown
  }
}

export function detectRuntime(): Runtime {
  if (typeof window !== 'undefined' && window.__TAURI__) {
    return 'desktop'
  }
  return 'web'
}

export const isDesktop = (): boolean => detectRuntime() === 'desktop'
export const isWeb = (): boolean => detectRuntime() === 'web'
