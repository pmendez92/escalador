/**
 * FFmpegService — envoltorio de ffmpeg/ffprobe.
 *
 * Responsabilidades:
 *  - Resolver las rutas de los binarios (ffmpeg-static / ffprobe-static),
 *    teniendo en cuenta el empaquetado asar (app.asar → app.asar.unpacked).
 *  - Ejecutar ffmpeg con progreso en tiempo real (`-progress pipe:1`).
 *  - Sondear archivos con ffprobe (duración, fps, resolución, pistas).
 *  - Cancelación cooperativa mediante AbortSignal.
 *
 * Todos los ejecutores multimedia dependen de este servicio (DIP: dependen
 * de la abstracción, no de `child_process` directamente).
 */
import { spawn } from 'child_process'
import ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import type { LoggerService } from './LoggerService'
import type { MediaInfo } from '@shared/types'

export interface FFmpegRunOptions {
  args: string[]
  /** Duración total en segundos: permite calcular % y ETA */
  totalDurationSeconds?: number
  onProgress?: (percent: number, etaSeconds?: number, speed?: string) => void
  signal?: AbortSignal
}

/** Corrige rutas cuando la app está empaquetada dentro de app.asar. */
function unpackedPath(p: string | null): string {
  if (!p) throw new Error('Binario FFmpeg no encontrado')
  return p.replace('app.asar', 'app.asar.unpacked')
}

export class FFmpegService {
  readonly ffmpegPath: string
  readonly ffprobePath: string

  constructor(private readonly logger: LoggerService) {
    this.ffmpegPath = unpackedPath(ffmpegPath as unknown as string)
    this.ffprobePath = unpackedPath(ffprobeStatic.path)
  }

  /**
   * Ejecuta ffmpeg. El progreso se emite parseando la salida de
   * `-progress pipe:1` (clave out_time_ms) contra la duración total.
   */
  run(options: FFmpegRunOptions): Promise<void> {
    const { args, totalDurationSeconds, onProgress, signal } = options
    const fullArgs = ['-hide_banner', '-y', ...args, '-progress', 'pipe:1', '-nostats']
    this.logger.info('ffmpeg', `ffmpeg ${fullArgs.join(' ')}`)

    return new Promise((resolve, reject) => {
      const child = spawn(this.ffmpegPath, fullArgs, { windowsHide: true })
      let stderrTail = ''
      const startedAt = Date.now()

      const onAbort = (): void => {
        child.kill('SIGKILL')
      }
      signal?.addEventListener('abort', onAbort, { once: true })

      child.stdout.on('data', (data: Buffer) => {
        // Formato "clave=valor" por líneas; nos interesan out_time_ms y speed.
        const text = data.toString()
        const timeMatch = /out_time_ms=(\d+)/.exec(text)
        const speedMatch = /speed=\s*([\d.]+x)/.exec(text)
        if (timeMatch && totalDurationSeconds && totalDurationSeconds > 0) {
          const elapsedMedia = Number(timeMatch[1]) / 1_000_000
          const percent = Math.min(99.9, (elapsedMedia / totalDurationSeconds) * 100)
          // ETA a partir del tiempo real transcurrido y el % completado.
          const elapsedReal = (Date.now() - startedAt) / 1000
          const eta = percent > 0.5 ? (elapsedReal / percent) * (100 - percent) : undefined
          onProgress?.(percent, eta, speedMatch?.[1])
        }
      })

      child.stderr.on('data', (data: Buffer) => {
        stderrTail = (stderrTail + data.toString()).slice(-4000)
      })

      child.on('error', reject)
      child.on('close', (code) => {
        signal?.removeEventListener('abort', onAbort)
        if (signal?.aborted) {
          reject(new Error('cancelled'))
        } else if (code === 0) {
          resolve()
        } else {
          this.logger.error('ffmpeg', stderrTail)
          reject(new Error(`ffmpeg terminó con código ${code}: ${lastLines(stderrTail)}`))
        }
      })
    })
  }

  /** Extrae metadatos del archivo con ffprobe (JSON). */
  async probe(filePath: string): Promise<MediaInfo> {
    const json = await this.runProbe([
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ])
    const data = JSON.parse(json)
    const streams: Array<Record<string, unknown>> = data.streams ?? []
    const video = streams.find((s) => s.codec_type === 'video')
    const audio = streams.find((s) => s.codec_type === 'audio')
    const subs = streams.some((s) => s.codec_type === 'subtitle')

    // fps viene como fracción "30000/1001".
    let fps = 0
    const rate = (video?.r_frame_rate as string) ?? '0/1'
    const [num, den] = rate.split('/').map(Number)
    if (num && den) fps = num / den

    return {
      durationSeconds: Number(data.format?.duration ?? 0),
      width: Number(video?.width ?? 0),
      height: Number(video?.height ?? 0),
      fps: Math.round(fps * 1000) / 1000,
      videoCodec: video?.codec_name as string | undefined,
      audioCodec: audio?.codec_name as string | undefined,
      bitrate: Number(data.format?.bit_rate ?? 0) || undefined,
      hasAudio: Boolean(audio),
      hasSubtitles: subs
    }
  }

  private runProbe(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.ffprobePath, args, { windowsHide: true })
      let out = ''
      let err = ''
      child.stdout.on('data', (d: Buffer) => (out += d.toString()))
      child.stderr.on('data', (d: Buffer) => (err += d.toString()))
      child.on('error', reject)
      child.on('close', (code) =>
        code === 0 ? resolve(out) : reject(new Error(`ffprobe: ${err.trim()}`))
      )
    })
  }
}

function lastLines(text: string, n = 3): string {
  return text.trim().split('\n').slice(-n).join(' | ')
}
