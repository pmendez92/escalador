/**
 * VideoUpscaleExecutor — mejora IA de vídeo con pipeline por fotogramas.
 *
 * Fases (el progreso se reparte entre ellas y el ETA se calcula por
 * velocidad real de fotogramas procesados):
 *
 *   1. ffprobe        — fps, duración y resolución originales.
 *   2. FFmpeg         — extraer todos los fotogramas a PNG.        (0-15 %)
 *   3. Real-ESRGAN    — escalar cada fotograma con IA.             (15-75 %)
 *   4. RIFE (opcional)— interpolar fotogramas (duplica FPS).       (75-85 %)
 *   5. FFmpeg         — reensamblar a la resolución objetivo con el
 *      audio ORIGINAL muxeado (sincronía garantizada: mismos fps). (85-100 %)
 *
 * FPS: se reensambla exactamente al fps original (o al doble con RIFE),
 * por lo que audio y vídeo mantienen la sincronización.
 * GPU: ncnn-vulkan usa la GPU si existe; `-g -1` fuerza CPU.
 */
import { spawn } from 'child_process'
import path from 'path'
import { promises as fs } from 'fs'
import { VIDEO_TARGET_RESOLUTIONS } from '@shared/formats'
import type { Job, VideoUpscaleOptions } from '@shared/types'
import { baseName, createTempDir, ensureDir, removeDir, uniqueOutputPath } from '../utils/fs'
import { CancelledError, throwIfAborted, type ExecutionContext, type JobExecutor, type JobResult } from './types'

export class VideoUpscaleExecutor implements JobExecutor {
  readonly type = 'video-upscale' as const

  async execute(job: Job, ctx: ExecutionContext): Promise<JobResult> {
    const options = job.options as VideoUpscaleOptions
    const input = job.inputPath
    if (!input) throw new Error('Falta el archivo de entrada')
    const { ffmpeg, binaries, settings } = ctx.services

    // ---- Fase 0: preparar binarios y analizar el vídeo ----
    ctx.reportProgress({ percent: 0, phase: 'Preparando modelos IA' })
    const realesrgan = await binaries.ensure('realesrgan')
    const rife = options.interpolate ? await binaries.ensure('rife') : null
    throwIfAborted(ctx.signal)

    const info = await ffmpeg.probe(input)
    if (!info.fps || !info.durationSeconds) throw new Error('No se pudo analizar el vídeo')
    const targetRes = VIDEO_TARGET_RESOLUTIONS.find((r) => r.id === options.targetResolution)
    if (!targetRes) throw new Error(`Resolución desconocida: ${options.targetResolution}`)

    await ensureDir(job.outputDir)
    const outputPath = await uniqueOutputPath(
      job.outputDir,
      `${baseName(input)}_${options.targetResolution}`,
      'mp4'
    )

    const tempDir = await createTempDir('vupscale')
    const framesDir = path.join(tempDir, 'frames')
    const upscaledDir = path.join(tempDir, 'upscaled')
    const interpolatedDir = path.join(tempDir, 'interpolated')
    await Promise.all([ensureDir(framesDir), ensureDir(upscaledDir)])

    try {
      // ---- Fase 1: extraer fotogramas (0-15 %) ----
      await ffmpeg.run({
        args: ['-i', input, path.join(framesDir, 'f%08d.png')],
        totalDurationSeconds: info.durationSeconds,
        onProgress: (p) =>
          ctx.reportProgress({ percent: p * 0.15, phase: 'Extrayendo fotogramas' }),
        signal: ctx.signal
      })

      const frames = (await fs.readdir(framesDir)).length
      if (frames === 0) throw new Error('No se extrajo ningún fotograma')

      // ---- Fase 2: escalar con Real-ESRGAN (15-75 %) ----
      // ncnn-vulkan acepta directorios: procesa todos los PNG del directorio.
      await this.runNcnnOnDir({
        exe: realesrgan,
        args: [
          '-i', framesDir,
          '-o', upscaledDir,
          '-n', options.model,
          '-s', '4',
          '-m', binaries.modelsDir('realesrgan'),
          '-f', 'png',
          ...(settings.get().useGpu ? [] : ['-g', '-1'])
        ],
        watchDir: upscaledDir,
        totalFrames: frames,
        phase: 'Escalando fotogramas con IA',
        range: [15, 75],
        ctx
      })

      // ---- Fase 3 (opcional): interpolación RIFE (75-85 %) ----
      let finalFramesDir = upscaledDir
      let finalFps = info.fps
      if (rife) {
        await ensureDir(interpolatedDir)
        await this.runNcnnOnDir({
          exe: rife,
          args: ['-i', upscaledDir, '-o', interpolatedDir, '-m', path.join(path.dirname(rife), 'rife-v4.6')],
          watchDir: interpolatedDir,
          totalFrames: frames * 2,
          phase: 'Interpolando fotogramas (RIFE)',
          range: [75, 85],
          ctx
        })
        finalFramesDir = interpolatedDir
        finalFps = info.fps * 2 // RIFE duplica los FPS manteniendo la duración
      }

      // ---- Fase 4: reensamblar con audio original (85-100 %) ----
      // -shortest evita desincronía si sobra un fotograma; el audio se copia
      // del archivo original sin recodificar.
      const encodeArgs = [
        '-framerate', String(finalFps),
        '-i', path.join(finalFramesDir, this.detectPattern(finalFramesDir === upscaledDir)),
        '-i', input,
        '-map', '0:v:0',
        '-map', '1:a?',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-pix_fmt', 'yuv420p',
        // Redimensionar a la resolución objetivo exacta (alto par obligatorio)
        '-vf', `scale=-2:${targetRes.height}:flags=lanczos`,
        ...(options.videoBitrate ? ['-b:v', options.videoBitrate] : ['-crf', '18']),
        '-c:a', 'copy',
        '-shortest',
        outputPath
      ]
      await ffmpeg.run({
        args: encodeArgs,
        totalDurationSeconds: info.durationSeconds,
        onProgress: (p, eta, speed) =>
          ctx.reportProgress({
            percent: 85 + p * 0.15,
            etaSeconds: eta,
            speed,
            phase: 'Codificando vídeo final'
          }),
        signal: ctx.signal
      })

      ctx.reportProgress({ percent: 100 })
      return { outputPath }
    } finally {
      // Los fotogramas temporales pueden ocupar GB: limpiar siempre.
      await removeDir(tempDir)
    }
  }

  /** Patrón de entrada para ffmpeg según la fase que generó los frames. */
  private detectPattern(fromUpscale: boolean): string {
    // Real-ESRGAN conserva el nombre (f%08d.png); RIFE numera %08d.png.
    return fromUpscale ? 'f%08d.png' : '%08d.png'
  }

  /**
   * Ejecuta un binario ncnn sobre un directorio de fotogramas.
   * El progreso y el ETA se derivan contando los archivos de salida
   * generados por segundo (los binarios no informan del total).
   */
  private runNcnnOnDir(params: {
    exe: string
    args: string[]
    watchDir: string
    totalFrames: number
    phase: string
    range: [number, number]
    ctx: ExecutionContext
  }): Promise<void> {
    const { exe, args, watchDir, totalFrames, phase, range, ctx } = params
    ctx.services.logger.info('ncnn', `${exe} ${args.join(' ')}`)

    return new Promise((resolve, reject) => {
      const child = spawn(exe, args, { windowsHide: true })
      const startedAt = Date.now()

      const onAbort = (): void => {
        child.kill('SIGKILL')
      }
      ctx.signal.addEventListener('abort', onAbort, { once: true })

      // Sondeo del directorio de salida cada segundo para % y ETA.
      const timer = setInterval(async () => {
        try {
          const done = (await fs.readdir(watchDir)).length
          if (done === 0) return
          const fraction = Math.min(1, done / totalFrames)
          const elapsed = (Date.now() - startedAt) / 1000
          const fps = done / Math.max(1, elapsed)
          const eta = fps > 0 ? (totalFrames - done) / fps : undefined
          ctx.reportProgress({
            percent: range[0] + fraction * (range[1] - range[0]),
            etaSeconds: eta,
            speed: `${fps.toFixed(1)} fps`,
            phase
          })
        } catch {
          /* el directorio puede no existir aún */
        }
      }, 1000)

      let stderrTail = ''
      child.stderr.on('data', (d: Buffer) => {
        stderrTail = (stderrTail + d.toString()).slice(-2000)
      })
      child.on('error', (err) => {
        clearInterval(timer)
        reject(err)
      })
      child.on('close', (code) => {
        clearInterval(timer)
        ctx.signal.removeEventListener('abort', onAbort)
        if (ctx.signal.aborted) reject(new CancelledError())
        else if (code === 0) resolve()
        else reject(new Error(`${path.basename(exe)} terminó con código ${code}: ${stderrTail.trim().split('\n').pop()}`))
      })
    })
  }
}
