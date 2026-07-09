/**
 * VideoConvertExecutor — conversión de vídeo y extracción de audio (FFmpeg).
 *
 * Contenedores: MKV, MP4, MP4-LQ, WEBM, OGV, AVI, GIF, GIF-LQ.
 * Audio: MP3, WAV, OGG.
 *
 * Política de calidad:
 *  - Sin bitrate explícito se usa CRF (calidad constante), que conserva mejor
 *    el detalle que un bitrate fijo.
 *  - FPS y resolución se mantienen siempre (no se re-escala salvo GIF).
 *  - Subtítulos: se copian a MKV; a MP4 se transcodifican a mov_text.
 *  - GIF usa la técnica de dos pasadas palettegen/paletteuse para máxima
 *    calidad de paleta.
 */
import { AUDIO_TARGET_FORMATS, VIDEO_TARGET_FORMATS } from '@shared/formats'
import type { Job, VideoConvertOptions } from '@shared/types'
import { baseName, ensureDir, uniqueOutputPath } from '../utils/fs'
import { throwIfAborted, type ExecutionContext, type JobExecutor, type JobResult } from './types'

const AUDIO_ONLY = new Set(['mp3', 'wav', 'ogg'])

export class VideoConvertExecutor implements JobExecutor {
  readonly type = 'video-convert' as const

  async execute(job: Job, ctx: ExecutionContext): Promise<JobResult> {
    const options = job.options as VideoConvertOptions
    const input = job.inputPath
    if (!input) throw new Error('Falta el archivo de entrada')
    const { ffmpeg } = ctx.services

    throwIfAborted(ctx.signal)
    ctx.reportProgress({ percent: 0, phase: 'Analizando vídeo' })
    const info = await ffmpeg.probe(input)

    await ensureDir(job.outputDir)
    const formatDef = [...VIDEO_TARGET_FORMATS, ...AUDIO_TARGET_FORMATS].find(
      (f) => f.id === options.targetFormat
    )
    if (!formatDef) throw new Error(`Formato desconocido: ${options.targetFormat}`)
    const outputPath = await uniqueOutputPath(job.outputDir, baseName(input), formatDef.extension)

    const report = (percent: number, eta?: number, speed?: string): void =>
      ctx.reportProgress({ percent, etaSeconds: eta, speed, phase: 'Convirtiendo' })

    if (options.targetFormat === 'gif' || options.targetFormat === 'gif-lq') {
      await this.toGif(input, outputPath, options.targetFormat === 'gif-lq', info.durationSeconds, ctx)
    } else {
      const args = AUDIO_ONLY.has(options.targetFormat)
        ? this.audioArgs(input, outputPath, options)
        : this.videoArgs(input, outputPath, options, info.hasSubtitles)
      await ffmpeg.run({
        args,
        totalDurationSeconds: info.durationSeconds,
        onProgress: report,
        signal: ctx.signal
      })
    }

    ctx.reportProgress({ percent: 100 })
    return { outputPath }
  }

  /* ------------------------------------------------------------------ */
  /* Construcción de argumentos                                          */
  /* ------------------------------------------------------------------ */

  private videoArgs(
    input: string,
    output: string,
    o: VideoConvertOptions,
    hasSubtitles: boolean
  ): string[] {
    const args: string[] = ['-i', input]

    // Mapear todas las pistas de vídeo/audio; subtítulos solo si se piden
    // y el contenedor los soporta.
    args.push('-map', '0:v:0')
    args.push('-map', '0:a?')
    const subsSupported = o.targetFormat === 'mkv' || o.targetFormat.startsWith('mp4')
    if (o.keepSubtitles && hasSubtitles && subsSupported) {
      args.push('-map', '0:s?')
      // MKV admite copiar el códec original; MP4 requiere mov_text.
      args.push('-c:s', o.targetFormat === 'mkv' ? 'copy' : 'mov_text')
    }

    if (o.stripMetadata) args.push('-map_metadata', '-1')

    // CRF base según formato y modo compresión.
    const crfDelta = o.compress ? 6 : 0

    switch (o.targetFormat) {
      case 'mp4':
      case 'mkv':
        args.push('-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p')
        if (o.videoBitrate) args.push('-b:v', o.videoBitrate)
        else args.push('-crf', String(20 + crfDelta))
        args.push('-c:a', 'aac', '-b:a', o.audioBitrate || '192k')
        break
      case 'mp4-lq':
        // Baja calidad: CRF alto + preset rápido; misma resolución/FPS.
        args.push('-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p')
        args.push('-crf', '32')
        args.push('-c:a', 'aac', '-b:a', '96k')
        break
      case 'webm':
        args.push('-c:v', 'libvpx-vp9', '-row-mt', '1')
        if (o.videoBitrate) args.push('-b:v', o.videoBitrate)
        else args.push('-crf', String(31 + crfDelta), '-b:v', '0')
        args.push('-c:a', 'libopus', '-b:a', o.audioBitrate || '128k')
        break
      case 'ogv':
        args.push('-c:v', 'libtheora', '-q:v', o.compress ? '5' : '7')
        if (o.videoBitrate) args.push('-b:v', o.videoBitrate)
        args.push('-c:a', 'libvorbis', '-q:a', '5')
        break
      case 'avi':
        args.push('-c:v', 'mpeg4', '-vtag', 'xvid', '-q:v', o.compress ? '8' : '4')
        if (o.videoBitrate) args.push('-b:v', o.videoBitrate)
        args.push('-c:a', 'libmp3lame', '-b:a', o.audioBitrate || '192k')
        break
      default:
        throw new Error(`Formato de vídeo no implementado: ${o.targetFormat}`)
    }

    args.push(output)
    return args
  }

  private audioArgs(input: string, output: string, o: VideoConvertOptions): string[] {
    const args: string[] = ['-i', input, '-vn'] // -vn: descartar vídeo
    if (o.stripMetadata) args.push('-map_metadata', '-1')

    switch (o.targetFormat) {
      case 'mp3':
        args.push('-c:a', 'libmp3lame', '-b:a', o.audioBitrate || '192k')
        break
      case 'wav':
        args.push('-c:a', 'pcm_s16le') // WAV sin pérdida: el bitrate no aplica
        break
      case 'ogg':
        args.push('-c:a', 'libvorbis', '-b:a', o.audioBitrate || '160k')
        break
      default:
        throw new Error(`Formato de audio no implementado: ${o.targetFormat}`)
    }

    args.push(output)
    return args
  }

  /**
   * GIF de dos pasadas: 1) genera la paleta óptima, 2) aplica la paleta.
   * LQ reduce fps y ancho para archivos mucho más pequeños.
   */
  private async toGif(
    input: string,
    output: string,
    lowQuality: boolean,
    duration: number,
    ctx: ExecutionContext
  ): Promise<void> {
    const fps = lowQuality ? 10 : 15
    const width = lowQuality ? 360 : 640
    const dither = lowQuality ? 'none' : 'sierra2_4a'
    const filters = `fps=${fps},scale=${width}:-1:flags=lanczos`

    await ctx.services.ffmpeg.run({
      args: [
        '-i', input,
        '-filter_complex',
        `[0:v]${filters},split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=${dither}`,
        output
      ],
      totalDurationSeconds: duration,
      onProgress: (p, eta, speed) =>
        ctx.reportProgress({ percent: p, etaSeconds: eta, speed, phase: 'Generando GIF' }),
      signal: ctx.signal
    })
  }
}
