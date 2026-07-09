/**
 * HistoryService — historial persistente de conversiones, descargas y
 * escalados IA. Guarda en userData/history.json (máx. 500 entradas).
 */
import { app } from 'electron'
import { promises as fs, readFileSync, existsSync } from 'fs'
import path from 'path'
import type { HistoryEntry } from '@shared/types'

const MAX_ENTRIES = 500

export class HistoryService {
  private readonly filePath: string
  private entries: HistoryEntry[]

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'history.json')
    this.entries = this.load()
  }

  list(): HistoryEntry[] {
    // Más recientes primero.
    return [...this.entries].sort((a, b) => b.createdAt - a.createdAt)
  }

  async add(entry: HistoryEntry): Promise<void> {
    this.entries.push(entry)
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES)
    }
    await this.persist()
  }

  async remove(id: string): Promise<void> {
    this.entries = this.entries.filter((e) => e.id !== id)
    await this.persist()
  }

  async clear(): Promise<void> {
    this.entries = []
    await this.persist()
  }

  private load(): HistoryEntry[] {
    try {
      if (existsSync(this.filePath)) {
        return JSON.parse(readFileSync(this.filePath, 'utf8'))
      }
    } catch {
      // Historial corrupto → se descarta.
    }
    return []
  }

  private async persist(): Promise<void> {
    const tmp = `${this.filePath}.tmp`
    await fs.writeFile(tmp, JSON.stringify(this.entries, null, 2), 'utf8')
    await fs.rename(tmp, this.filePath)
  }
}
