/**
 * Contratos de los ejecutores de trabajos (patrón Strategy).
 *
 * La cola (QueueService) no sabe nada de FFmpeg, Real-ESRGAN ni yt-dlp:
 * solo conoce esta interfaz. Añadir una nueva funcionalidad = registrar un
 * nuevo ejecutor (Open/Closed, SOLID).
 */
import type { Job, JobProgress, JobType } from '@shared/types'
import type { FFmpegService } from '../services/FFmpegService'
import type { BinaryManager } from '../services/BinaryManager'
import type { SettingsService } from '../services/SettingsService'
import type { LoggerService } from '../services/LoggerService'

export interface ExecutorServices {
  ffmpeg: FFmpegService
  binaries: BinaryManager
  settings: SettingsService
  logger: LoggerService
}

export interface ExecutionContext {
  /** Publica el progreso del trabajo hacia la UI */
  reportProgress(progress: JobProgress): void
  /** Señal de cancelación: los ejecutores deben abortar procesos hijos */
  signal: AbortSignal
  services: ExecutorServices
}

export interface JobResult {
  /** Ruta del archivo principal generado */
  outputPath: string
}

export interface JobExecutor {
  readonly type: JobType
  execute(job: Job, ctx: ExecutionContext): Promise<JobResult>
}

/** Error especial lanzado al cancelar; la cola lo traduce a estado 'cancelled'. */
export class CancelledError extends Error {
  constructor() {
    super('cancelled')
    this.name = 'CancelledError'
  }
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new CancelledError()
}
