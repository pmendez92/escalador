/**
 * DownloadExecutor — descargas de vídeo/audio con yt-dlp.
 *
 * Soporta YouTube, Instagram, TikTok, Facebook, Vimeo, X/Twitter, Twitch,
 * Dailymotion y cientos de sitios más (todo lo que soporte yt-dlp).
 *
 * Modo vídeo: selección de resolución/contenedor, miniatura, subtítulos y
 * playlists. Modo audio: extracción a MP3/WAV/OGG con bitrate, nombre de
 * archivo personalizado y portada embebida (--embed-thumbnail).
 *
 * yt-dlp usa el ffmpeg incluido en la app (--ffmpeg-location) para el
 * muxing/extracción, así el usuario no necesita nada instalado.
 */
import { spawn } from 'child_process'
import path from 'path'
import type { DownloadOptions, Job } from '@shared/types'
import { ensureDir } from '../utils/fs'
import { CancelledError, throwIfAborted, type ExecutionContext, type JobExecutor, type JobResult } from './types'

export class DownloadExecutor implements JobExecutor {
  readonly type = 'download' as const

  async execute(job: Job, ctx: ExecutionContext): Promise<JobResult> {
    const options = job.options as DownloadOptions
    if (!options.url) throw new Error('Falta la URL')

    ctx.reportProgress({ percent: 0, phase: 'Preparando yt-dlp' })
    const ytdlp = await ctx.services.binaries.ensure('ytdlp')
    throwIfAborted(ctx.signal)
    await ensureDir(job.outputDir)

    const args = this.buildArgs(options, job.outputDir, ctx)
    ctx.services.logger.info('yt-dlp', `yt-dlp ${args.join(' ')}`)

    const outputPath = await this.run(ytdlp, args, job.outputDir, ctx)
    ctx.reportProgress({ percent: 100 })
    return { outputPath }
  }

  private buildArgs(o: DownloadOptions, outputDir: string, ctx: ExecutionContext): string[] {
    const ffmpegDir = path.dirname(ctx.services.ffmpeg.ffmpegPath)
    // Plantilla de nombre: personalizado o título original saneado.
    const name = o.filename?.trim() ? o.filename.trim() : '%(title)s'
    const args: string[] = [
      o.url,
      '--ffmpeg-location', ffmpegDir,
      '--no-mtime',
      '--newline', // progreso línea a línea, fácil de parsear
      '--output', path.join(outputDir, `${name}.%(ext)s`),
      // Imprime la ruta final del archivo para poder abrir su carpeta.
      '--print', 'after_move:filepath',
      '--no-simulate'
    ]

    args.push(o.playlist ? '--yes-playlist' : '--no-playlist')
    if (o.downloadThumbnail) args.push('--write-thumbnail')
    if (o.downloadSubtitles) args.push('--write-subs', '--sub-langs', 'all', '--write-auto-subs')

    if (o.mode === 'audio') {
      args.push('--extract-audio', '--audio-format', o.audioFormat ?? 'mp3')
      // Calidad/bitrate: yt-dlp acepta kbps ("192K") para formatos con pérdida.
      if (o.audioBitrate && o.audioFormat !== 'wav') {
        args.push('--audio-quality', `${o.audioBitrate}K`)
      }
      if (o.embedThumbnail) args.push('--embed-thumbnail', '--add-metadata')
    } else {
      // Selección de formato: mejor vídeo hasta la resolución pedida + mejor audio.
      const height = o.resolution === 'best' ? '' : `[height<=${o.resolution}]`
      args.push('-f', `bestvideo${height}+bestaudio/best${height}`)
      if (o.format) args.push('--merge-output-format', o.format)
    }

    return args
  }

  /**
   * Ejecuta yt-dlp parseando el progreso:
   *   "[download]  45.2% of 120.5MiB at 2.3MiB/s ETA 00:35"
   */
  private run(exe: string, args: string[], outputDir: string, ctx: ExecutionContext): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(exe, args, { windowsHide: true })
      const onAbort = (): void => {
        child.kill('SIGKILL')
      }
      ctx.signal.addEventListener('abort', onAbort, { once: true })

      let lastFile = ''
      let stderrTail = ''

      child.stdout.on('data', (data: Buffer) => {
        for (const line of data.toString().split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) continue

          const progress = /\[download\]\s+([\d.]+)%(?:.*?at\s+(\S+))?(?:.*?ETA\s+([\d:]+))?/.exec(trimmed)
          if (progress) {
            ctx.reportProgress({
              percent: Math.min(99, parseFloat(progress[1])),
              speed: progress[2],
              etaSeconds: progress[3] ? parseEta(progress[3]) : undefined,
              phase: 'Descargando'
            })
            continue
          }
          if (trimmed.startsWith('[ExtractAudio]') || trimmed.startsWith('[Merger]')) {
            ctx.reportProgress({ percent: 99, phase: 'Procesando con FFmpeg' })
            continue
          }
          // Línea emitida por --print after_move:filepath → ruta final.
          if (/^([A-Za-z]:\\|\/)/.test(trimmed)) {
            lastFile = trimmed
          }
        }
      })

      child.stderr.on('data', (d: Buffer) => {
        stderrTail = (stderrTail + d.toString()).slice(-3000)
      })

      child.on('error', reject)
      child.on('close', (code) => {
        ctx.signal.removeEventListener('abort', onAbort)
        if (ctx.signal.aborted) reject(new CancelledError())
        else if (code === 0) resolve(lastFile || outputDir)
        else {
          const reason = stderrTail.trim().split('\n').filter((l) => l.includes('ERROR')).pop()
          reject(new Error(reason || `yt-dlp terminó con código ${code}`))
        }
      })
    })
  }
}

/** "00:35" | "01:02:03" → segundos */
function parseEta(text: string): number {
  const parts = text.split(':').map(Number)
  return parts.reduce((acc, v) => acc * 60 + v, 0)
}
