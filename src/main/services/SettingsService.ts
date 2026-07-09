/**
 * SettingsService — persistencia de ajustes de usuario en JSON.
 *
 * Guarda en userData/settings.json con escritura atómica (tmp + rename)
 * para no corromper el archivo si la app se cierra a mitad de escritura.
 */
import { app } from 'electron'
import { promises as fs, readFileSync, existsSync } from 'fs'
import path from 'path'
import type { AppSettings } from '@shared/types'

export class SettingsService {
  private readonly filePath: string
  private settings: AppSettings

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'settings.json')
    this.settings = this.load()
  }

  /** Valores por defecto seguros para el primer arranque. */
  static defaults(): AppSettings {
    return {
      outputDir: app.getPath('downloads'),
      maxConcurrentJobs: 2,
      useGpu: true,
      defaultQuality: 'high',
      language: 'es',
      theme: 'system',
      checkUpdatesOnStartup: true
    }
  }

  get(): AppSettings {
    return { ...this.settings }
  }

  async set(partial: Partial<AppSettings>): Promise<AppSettings> {
    this.settings = { ...this.settings, ...partial }
    // Saneado: la concurrencia siempre entre 1 y 8.
    this.settings.maxConcurrentJobs = Math.min(8, Math.max(1, this.settings.maxConcurrentJobs))
    await this.persist()
    return this.get()
  }

  private load(): AppSettings {
    try {
      if (existsSync(this.filePath)) {
        const raw = JSON.parse(readFileSync(this.filePath, 'utf8'))
        // Merge con defaults: ajustes nuevos en versiones futuras no rompen.
        return { ...SettingsService.defaults(), ...raw }
      }
    } catch {
      // Archivo corrupto → se regenera con defaults.
    }
    return SettingsService.defaults()
  }

  private async persist(): Promise<void> {
    const tmp = `${this.filePath}.tmp`
    await fs.writeFile(tmp, JSON.stringify(this.settings, null, 2), 'utf8')
    await fs.rename(tmp, this.filePath)
  }
}
