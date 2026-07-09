/**
 * Utilidades de formato para la UI.
 */

/** Segundos → "3 min 20 s" / "45 s" */
export function formatEta(seconds?: number): string {
  if (seconds === undefined || !isFinite(seconds)) return ''
  const s = Math.round(seconds)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${s % 60} s`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}

/** Milisegundos → duración legible */
export function formatDuration(ms: number): string {
  return formatEta(ms / 1000)
}

/** Timestamp → "09/07/2026 14:32" según el locale del sistema */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** Nombre de archivo desde una ruta (win o posix) */
export function fileName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}
