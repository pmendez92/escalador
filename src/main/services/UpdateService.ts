/**
 * UpdateService — auto-actualización con electron-updater.
 *
 * Publica eventos de estado hacia el renderer (UPDATES_EVENT) y, cuando el
 * usuario lo confirma, reinicia e instala. La fuente de actualizaciones es
 * GitHub Releases (configurada en electron-builder.yml → publish).
 *
 * En desarrollo (app sin empaquetar) las comprobaciones se omiten.
 */
import { app } from 'electron'
import electronUpdater from 'electron-updater'
import type { LoggerService } from './LoggerService'
import type { UpdateInfoPayload } from '@shared/types'

const { autoUpdater } = electronUpdater

type UpdateListener = (payload: UpdateInfoPayload) => void

export class UpdateService {
  private listeners = new Set<UpdateListener>()

  constructor(private readonly logger: LoggerService) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => this.emit({ status: 'checking' }))
    autoUpdater.on('update-available', (info) =>
      this.emit({ status: 'available', version: info.version })
    )
    autoUpdater.on('update-not-available', () => this.emit({ status: 'not-available' }))
    autoUpdater.on('download-progress', (p) =>
      this.emit({ status: 'downloading', percent: Math.round(p.percent) })
    )
    autoUpdater.on('update-downloaded', (info) =>
      this.emit({ status: 'downloaded', version: info.version })
    )
    autoUpdater.on('error', (err) => {
      this.logger.warn('updates', `Auto-update: ${err.message}`)
      this.emit({ status: 'error', error: err.message })
    })
  }

  onEvent(listener: UpdateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async check(): Promise<void> {
    if (!app.isPackaged) {
      // En dev no hay feed de actualizaciones: informamos y salimos.
      this.emit({ status: 'not-available' })
      return
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      this.emit({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }

  install(): void {
    autoUpdater.quitAndInstall()
  }

  private emit(payload: UpdateInfoPayload): void {
    for (const l of this.listeners) l(payload)
  }
}
