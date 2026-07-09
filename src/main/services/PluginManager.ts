/**
 * PluginManager — sistema de plugins preparado para futuras funciones.
 *
 * Un plugin es una carpeta dentro de userData/plugins con:
 *   plugin.json  → { "id", "name", "version", "main" }
 *   <main>.js    → módulo CommonJS que exporta `activate(context)`
 *
 * El contexto expone puntos de extensión estables y limitados (no toda la
 * API de Electron), de modo que la app puede evolucionar sin romper plugins:
 *   - registerExecutor(executor)  → nuevos tipos de trabajo en la cola
 *   - log(message)                → escribir en el log de la app
 *
 * Ejemplo completo en la carpeta /plugins del repositorio.
 */
import { app } from 'electron'
import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'
import type { LoggerService } from './LoggerService'
import type { QueueService } from './QueueService'
import type { JobExecutor } from '../executors/types'

interface PluginManifest {
  id: string
  name: string
  version: string
  main: string
}

export interface PluginContext {
  registerExecutor(executor: JobExecutor): void
  log(message: string): void
}

export class PluginManager {
  readonly pluginsDir: string
  private loaded: PluginManifest[] = []

  constructor(
    private readonly logger: LoggerService,
    private readonly queue: QueueService
  ) {
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins')
  }

  list(): PluginManifest[] {
    return this.loaded
  }

  /** Carga todos los plugins válidos. Un plugin roto nunca tumba la app. */
  loadAll(): void {
    if (!existsSync(this.pluginsDir)) return
    for (const dir of readdirSync(this.pluginsDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      try {
        this.loadOne(path.join(this.pluginsDir, dir.name))
      } catch (err) {
        this.logger.error('plugins', `Error cargando plugin "${dir.name}": ${err instanceof Error ? err.message : err}`)
      }
    }
  }

  private loadOne(dir: string): void {
    const manifestPath = path.join(dir, 'plugin.json')
    if (!existsSync(manifestPath)) return
    const manifest: PluginManifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

    const entry = path.join(dir, manifest.main)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(entry) as { activate?: (ctx: PluginContext) => void }
    if (typeof mod.activate !== 'function') {
      throw new Error('El plugin no exporta activate()')
    }

    const context: PluginContext = {
      registerExecutor: (executor) => this.queue.register(executor),
      log: (message) => this.logger.info(`plugin:${manifest.id}`, message)
    }
    mod.activate(context)
    this.loaded.push(manifest)
    this.logger.info('plugins', `Plugin cargado: ${manifest.name} v${manifest.version}`)
  }
}
