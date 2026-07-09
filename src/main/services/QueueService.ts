/**
 * QueueService — cola de procesos en segundo plano.
 *
 * - Los trabajos se encolan con estado 'pending' y se ejecutan cuando hay
 *   hueco (maxConcurrentJobs, configurable en Ajustes).
 * - Cada trabajo corre en un proceso hijo (ffmpeg, realesrgan, yt-dlp…), por
 *   lo que la UI nunca se bloquea.
 * - La cancelación usa AbortController: el ejecutor mata su proceso hijo.
 * - Cada cambio de estado/progreso se difunde al renderer (evento
 *   JOBS_EVENT_UPDATED) y los trabajos terminados se vuelcan al historial.
 *
 * La cola desconoce los detalles de cada tipo de trabajo: delega en los
 * JobExecutor registrados (Strategy + Open/Closed).
 */
import { randomUUID } from 'crypto'
import path from 'path'
import type { Job, JobProgress, JobRequest } from '@shared/types'
import { CancelledError, type ExecutorServices, type JobExecutor } from '../executors/types'
import type { HistoryService } from './HistoryService'

type JobListener = (job: Job) => void

export class QueueService {
  private executors = new Map<string, JobExecutor>()
  private jobs = new Map<string, Job>()
  private controllers = new Map<string, AbortController>()
  private listeners = new Set<JobListener>()
  private runningCount = 0

  constructor(
    private readonly services: ExecutorServices,
    private readonly history: HistoryService
  ) {}

  /** Registra una estrategia de ejecución para un tipo de trabajo. */
  register(executor: JobExecutor): void {
    this.executors.set(executor.type, executor)
  }

  onJobUpdated(listener: JobListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  list(): Job[] {
    return [...this.jobs.values()].sort((a, b) => a.createdAt - b.createdAt)
  }

  /** Crea el trabajo, lo encola y devuelve su snapshot inicial. */
  enqueue(request: JobRequest): Job {
    const settings = this.services.settings.get()
    const outputDir = request.outputDir || settings.outputDir
    const job: Job = {
      id: randomUUID(),
      type: request.type,
      title: this.buildTitle(request),
      inputPath: request.inputPath,
      outputDir,
      options: request.options,
      status: 'pending',
      progress: { percent: 0 },
      createdAt: Date.now()
    }
    this.jobs.set(job.id, job)
    this.emit(job)
    this.tick()
    return job
  }

  /** Cancela un trabajo pendiente o en ejecución. */
  cancel(id: string): void {
    const job = this.jobs.get(id)
    if (!job) return
    if (job.status === 'pending') {
      this.finish(job, 'cancelled')
    } else if (job.status === 'running') {
      // El AbortSignal llega al ejecutor, que mata su proceso hijo.
      this.controllers.get(id)?.abort()
    }
  }

  /** Limpia de la cola los trabajos ya terminados. */
  clearFinished(): void {
    for (const [id, job] of this.jobs) {
      if (job.status !== 'pending' && job.status !== 'running') {
        this.jobs.delete(id)
      }
    }
  }

  /** Arranca trabajos pendientes mientras haya capacidad. */
  private tick(): void {
    const max = this.services.settings.get().maxConcurrentJobs
    for (const job of this.list()) {
      if (this.runningCount >= max) break
      if (job.status !== 'pending') continue
      void this.run(job)
    }
  }

  private async run(job: Job): Promise<void> {
    const executor = this.executors.get(job.type)
    if (!executor) {
      job.error = `Sin ejecutor para el tipo ${job.type}`
      this.finish(job, 'error')
      return
    }

    const controller = new AbortController()
    this.controllers.set(job.id, controller)
    this.runningCount++
    job.status = 'running'
    job.startedAt = Date.now()
    this.emit(job)
    this.services.logger.info('queue', `Iniciado ${job.type}: ${job.title}`)

    try {
      const result = await executor.execute(job, {
        signal: controller.signal,
        services: this.services,
        reportProgress: (progress: JobProgress) => {
          job.progress = progress
          this.emit(job)
        }
      })
      job.outputPath = result.outputPath
      this.finish(job, 'completed')
      this.services.logger.info('queue', `Completado: ${job.title} → ${result.outputPath}`)
    } catch (err) {
      const isCancel =
        err instanceof CancelledError ||
        controller.signal.aborted ||
        (err instanceof Error && err.message === 'cancelled')
      if (isCancel) {
        this.finish(job, 'cancelled')
        this.services.logger.info('queue', `Cancelado: ${job.title}`)
      } else {
        job.error = err instanceof Error ? err.message : String(err)
        this.finish(job, 'error')
        this.services.logger.error('queue', `Error en ${job.title}: ${job.error}`)
      }
    } finally {
      this.controllers.delete(job.id)
      this.runningCount--
      this.tick() // Da paso al siguiente trabajo pendiente.
    }
  }

  private finish(job: Job, status: 'completed' | 'error' | 'cancelled'): void {
    job.status = status
    job.finishedAt = Date.now()
    if (status === 'completed') job.progress = { percent: 100 }
    this.emit(job)

    // Persistir en historial (fire-and-forget: no bloquea la cola).
    void this.history.add({
      id: job.id,
      jobType: job.type,
      title: job.title,
      inputPath: job.inputPath,
      outputPath: job.outputPath,
      outputDir: job.outputDir,
      options: job.options,
      status,
      createdAt: job.createdAt,
      durationMs: (job.finishedAt ?? Date.now()) - (job.startedAt ?? job.createdAt)
    })
  }

  private buildTitle(request: JobRequest): string {
    const opts = request.options as unknown as Record<string, unknown>
    if (request.type === 'download') {
      return String(opts.url ?? 'Descarga')
    }
    const name = request.inputPath ? path.basename(request.inputPath) : '¿?'
    if (request.type === 'image-convert' || request.type === 'video-convert') {
      return `${name} → ${String(opts.targetFormat).toUpperCase()}`
    }
    if (request.type === 'image-upscale') return `${name} × ${opts.scale}`
    if (request.type === 'video-upscale') return `${name} → ${opts.targetResolution}`
    return name
  }

  private emit(job: Job): void {
    const snapshot = { ...job, progress: { ...job.progress } }
    for (const l of this.listeners) l(snapshot)
  }
}
