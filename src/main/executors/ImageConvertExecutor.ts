/**
 * ImageConvertExecutor — conversión y compresión de imágenes con sharp.
 *
 * Formatos de salida: PNG, JPG, JPEG, WEBP, GIF, GIF-LQ, ICO y PDF.
 *  - sharp cubre png/jpg/webp/gif con control de calidad y metadatos.
 *  - ICO: se redimensiona a ≤256px y se codifica con png-to-ico.
 *  - PDF: se incrusta la imagen en una página con pdf-lib.
 *
 * Metadatos: `keepMetadata` conserva EXIF/ICC/DPI vía sharp.withMetadata();
 * `stripMetadata` los elimina por completo (extra de privacidad).
 */
import { promises as fs } from 'fs'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { PDFDocument } from 'pdf-lib'
import { IMAGE_TARGET_FORMATS } from '@shared/formats'
import type { ImageConvertOptions, Job } from '@shared/types'
import { baseName, ensureDir, uniqueOutputPath } from '../utils/fs'
import { throwIfAborted, type ExecutionContext, type JobExecutor, type JobResult } from './types'

export class ImageConvertExecutor implements JobExecutor {
  readonly type = 'image-convert' as const

  async execute(job: Job, ctx: ExecutionContext): Promise<JobResult> {
    const options = job.options as ImageConvertOptions
    const input = job.inputPath
    if (!input) throw new Error('Falta el archivo de entrada')

    throwIfAborted(ctx.signal)
    ctx.reportProgress({ percent: 5, phase: 'Leyendo imagen' })

    await ensureDir(job.outputDir)
    const format = IMAGE_TARGET_FORMATS.find((f) => f.id === options.targetFormat)
    if (!format) throw new Error(`Formato desconocido: ${options.targetFormat}`)
    const outputPath = await uniqueOutputPath(job.outputDir, baseName(input), format.extension)

    // Calidad efectiva: la del trabajo, o derivada del ajuste global.
    const quality = this.effectiveQuality(options, ctx)

    let pipeline = sharp(input, { animated: options.targetFormat.startsWith('gif') })

    // Conservar metadatos (EXIF, perfil ICC y densidad/DPI) salvo strip.
    if (options.keepMetadata && !options.stripMetadata) {
      pipeline = pipeline.withMetadata()
    }

    ctx.reportProgress({ percent: 30, phase: 'Convirtiendo' })

    switch (options.targetFormat) {
      case 'png':
        await pipeline.png({ compressionLevel: options.compress ? 9 : 6 }).toFile(outputPath)
        break
      case 'jpg':
      case 'jpeg':
        await pipeline
          .flatten({ background: '#ffffff' }) // JPG no soporta transparencia
          .jpeg({ quality, mozjpeg: true })
          .toFile(outputPath)
        break
      case 'webp':
        await pipeline.webp({ quality }).toFile(outputPath)
        break
      case 'gif':
        await pipeline.gif({ colours: 256 }).toFile(outputPath)
        break
      case 'gif-lq':
        // Baja calidad: paleta reducida y dithering bajo → archivos mínimos.
        await pipeline.gif({ colours: 48, dither: 0.3 }).toFile(outputPath)
        break
      case 'ico':
        await this.toIco(input, outputPath)
        break
      case 'pdf':
        await this.toPdf(input, outputPath, quality)
        break
      default: {
        const exhaustive: never = options.targetFormat
        throw new Error(`Formato no implementado: ${exhaustive}`)
      }
    }

    throwIfAborted(ctx.signal)
    ctx.reportProgress({ percent: 100 })
    return { outputPath }
  }

  /** ICO estándar de Windows: PNG cuadrado de hasta 256px embebido. */
  private async toIco(input: string, outputPath: string): Promise<void> {
    const png = await sharp(input)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    await fs.writeFile(outputPath, await pngToIco(png))
  }

  /** PDF de una página con la imagen a tamaño natural (72 pt = 1 px). */
  private async toPdf(input: string, outputPath: string, quality: number): Promise<void> {
    // Normalizamos a JPEG dentro del PDF: soporte universal y peso contenido.
    const jpeg = await sharp(input).flatten({ background: '#ffffff' }).jpeg({ quality }).toBuffer()
    const meta = await sharp(input).metadata()
    const width = meta.width ?? 800
    const height = meta.height ?? 600

    const pdf = await PDFDocument.create()
    const image = await pdf.embedJpg(jpeg)
    const page = pdf.addPage([width, height])
    page.drawImage(image, { x: 0, y: 0, width, height })
    await fs.writeFile(outputPath, await pdf.save())
  }

  private effectiveQuality(options: ImageConvertOptions, ctx: ExecutionContext): number {
    if (options.quality) return options.quality
    const preset = ctx.services.settings.get().defaultQuality
    const base = preset === 'high' ? 90 : preset === 'medium' ? 75 : 55
    // El modo compresión resta calidad para reducir peso.
    return options.compress ? Math.max(35, base - 25) : base
  }
}
