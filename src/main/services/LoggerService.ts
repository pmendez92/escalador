/**
 * LoggerService — registro centralizado de eventos y errores.
 *
 * - Mantiene un buffer en memoria consultable desde el visor de logs de la UI.
 * - Persiste cada línea en un archivo diario dentro de userData/logs.
 * - Permite exportar el log completo a un archivo elegido por el usuario.
 *
 * Responsabilidad única (SOLID): ningún otro servicio escribe archivos de log.
 */
import { app } from 'electron'
import { appendFileSync, mkdirSync, copyFileSync } from 'fs'
import path from 'path'
import type { LogEntry, LogLevel } from '@shared/types'

const MAX_MEMORY_ENTRIES = 2000

export class LoggerService {
  private entries: LogEntry[] = []
  private readonly logDir: string

  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs')
    mkdirSync(this.logDir, { recursive: true })
  }

  info(scope: string, message: string): void {
    this.write('info', scope, message)
  }

  warn(scope: string, message: string): void {
    this.write('warn', scope, message)
  }

  error(scope: string, message: string): void {
    this.write('error', scope, message)
  }

  list(): LogEntry[] {
    return this.entries
  }

  clear(): void {
    this.entries = []
  }

  /** Copia el archivo de log de hoy a la ruta indicada por el usuario. */
  exportTo(destPath: string): void {
    copyFileSync(this.currentFile(), destPath)
  }

  currentFile(): string {
    const day = new Date().toISOString().slice(0, 10)
    return path.join(this.logDir, `escalador-${day}.log`)
  }

  private write(level: LogLevel, scope: string, message: string): void {
    const entry: LogEntry = { timestamp: Date.now(), level, scope, message }
    this.entries.push(entry)
    if (this.entries.length > MAX_MEMORY_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_MEMORY_ENTRIES)
    }
    const line = `${new Date(entry.timestamp).toISOString()} [${level.toUpperCase()}] (${scope}) ${message}\n`
    try {
      appendFileSync(this.currentFile(), line, 'utf8')
    } catch {
      // No dejamos que un fallo de disco tumbe la app por un log.
    }
    if (level === 'error') console.error(line.trim())
  }
}
