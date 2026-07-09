/**
 * Contenedor de servicios (composición de dependencias).
 *
 * Único lugar donde se instancian los servicios y se inyectan unos en otros
 * (Dependency Injection manual y explícita: fácil de testear y de leer).
 */
import { LoggerService } from './LoggerService'
import { SettingsService } from './SettingsService'
import { HistoryService } from './HistoryService'
import { FFmpegService } from './FFmpegService'
import { BinaryManager } from './BinaryManager'
import { QueueService } from './QueueService'
import { UpdateService } from './UpdateService'
import { ContextMenuWindows } from './ContextMenuWindows'
import { PluginManager } from './PluginManager'
import { ImageConvertExecutor } from '../executors/ImageConvertExecutor'
import { VideoConvertExecutor } from '../executors/VideoConvertExecutor'
import { ImageUpscaleExecutor } from '../executors/ImageUpscaleExecutor'
import { VideoUpscaleExecutor } from '../executors/VideoUpscaleExecutor'
import { DownloadExecutor } from '../executors/DownloadExecutor'

export interface AppServices {
  logger: LoggerService
  settings: SettingsService
  history: HistoryService
  ffmpeg: FFmpegService
  binaries: BinaryManager
  queue: QueueService
  updates: UpdateService
  contextMenu: ContextMenuWindows
  plugins: PluginManager
}

export function createServices(): AppServices {
  const logger = new LoggerService()
  const settings = new SettingsService()
  const history = new HistoryService()
  const ffmpeg = new FFmpegService(logger)
  const binaries = new BinaryManager(logger)

  const queue = new QueueService({ ffmpeg, binaries, settings, logger }, history)

  // Registro de estrategias de ejecución (una por funcionalidad).
  queue.register(new ImageConvertExecutor())
  queue.register(new VideoConvertExecutor())
  queue.register(new ImageUpscaleExecutor())
  queue.register(new VideoUpscaleExecutor())
  queue.register(new DownloadExecutor())

  const updates = new UpdateService(logger)
  const contextMenu = new ContextMenuWindows(logger)
  const plugins = new PluginManager(logger, queue)

  return { logger, settings, history, ffmpeg, binaries, queue, updates, contextMenu, plugins }
}
