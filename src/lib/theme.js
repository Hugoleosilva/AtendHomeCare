import { useSyncExternalStore } from 'react'

// Tema: 'light' (padrão) ou 'dark'.
const KEY = 'homecare:theme'
const listeners = new Set()

export function getTheme() {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}
export function applyTheme(t = getTheme()) {
  const el = document.documentElement
  el.dataset.theme = t === 'dark' ? 'dark' : 'light'
}
export function setTheme(t) {
  try { localStorage.setItem(KEY, t) } catch { /* ignore */ }
  applyTheme(t)
  listeners.forEach((l) => l())
}
export const useTheme = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, getTheme)

// Para o botão de alternar: no modo automático, considera o que o sistema está mostrando agora.
export const isDarkNow = (t) => t === 'dark'
