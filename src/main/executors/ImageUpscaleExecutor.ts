/**
 * ImageUpscaleExecutor — super-resolución de imágenes con Real-ESRGAN
 * (distribución ncnn-vulkan: GPU NVIDIA/AMD/Intel vía Vulkan, o CPU).
 *
 * Escalas: 2x, 4x y 8x.
 *  - Los modelos x4plus solo escalan ×4 de forma nativa; para 2x se escala
 *    ×4 y se reduce con sharp (Lanczos) — así se conserva más detalle que
 *    con un modelo ×2 directo.
 *  - 8x = dos pasadas (×4 → ×2 relativo) encadenadas.
 *  - El DPI (densidad) original se re-aplica al resultado con sharp para
 *    que documentos/escaneos mantengan su tamaño físico de impresión.
 *
 * GPU/CPU: el flag `-g -1` fuerza CPU cuando el usuario desactiva la GPU.
 * Progreso: el binario emite "12,34%" por stderr; se re-mapea por pasada.
 */
import { spawn } from 'child_process'
import path from 'path'
import sharp from 'sharp'
import { AI_IMAGE_MODELS } from '@shared/formats'
import type { ImageUpscaleOptions, Job } from '@shared/types'
import { baseName, createTempDir, ensureDir, removeDir, uniqueOutputPath } from '../utils/fs'
import { CancelledError, throwIfAborted, type ExecutionContext, type JobExecutor, type JobResult } from './types'

export class ImageUpscaleExecutor implements JobExecutor {
  readonly type = 'image-upscale' as const

  async execute(job: Job, ctx: ExecutionContext): Promise<JobResult> {
    const options = job.options as ImageUpscaleOptions
    const input = job.inputPath
    if (!input) throw new Error('Falta el archivo de entrada')

    // 1. Asegurar binario + modelos (descarga automática con progreso).
    ctx.reportProgress({ percent: 0, phase: 'Preparando Real-ESRGAN' })
    const exe = await ctx.services.binaries.ensure('realesrgan')
    const modelsDir = ctx.services.binaries.modelsDir('realesrgan')
    throwIfAborted(ctx.signal)

    const model = AI_IMAGE_MODELS.find((m) => m.id === options.model) ?? AI_IMAGE_MODELS[0]
    // DPI original: se conserva para mantener PPP en el resultado.
    const srcMeta = await sharp(input).metadata()

    await ensureDir(job.outputDir)
    const outputPath = await uniqueOutputPath(
      job.outputDir,
      `${baseName(input)}_x${options.scale}`,
      'png'
    )

    const tempDir = await createTempDir('upscale')
    try {
      // 2. Planificar pasadas: cada pasada usa la escala nativa del modelo.
      const passes = this.planPasses(options.scale, model.scales)
      let current = input

      for (let i = 0; i < passes.length; i++) {
        throwIfAborted(ctx.signal)
        const passOut = path.join(tempDir, `pass-${i}.png`)
        await this.runPassResilient(exe, modelsDir, model.id, current, passOut, passes[i], ctx, i, passes.length)
        current = passOut
      }

      // 3. Ajuste final: si la escala pedida no coincide con el producto de
      //    pasadas (p. ej. 2x con modelo ×4), reducir con Lanczos.
      ctx.reportProgress({ percent: 88, phase: 'Ajuste final' })
      const targetWidth = Math.round((srcMeta.width ?? 0) * options.scale)
      const targetHeight = Math.round((srcMeta.height ?? 0) * options.scale)
      let result = sharp(current)
      const curMeta = await sharp(current).metadata()
      if (targetWidth > 0 && curMeta.width !== targetWidth) {
        result = result.resize({ width: targetWidth, kernel: 'lanczos3' })
      }
      let buffer = await result.png().toBuffer()

      // 4. Textura natural: Real-ESRGAN elimina el grano fotográfico y deja
      //    la piel con aspecto "de cera". Mezclamos encima un porcentaje de
      //    la imagen ORIGINAL reescalada con Lanczos: la nitidez IA se
      //    conserva (domina el 65-80 % de la mezcla) pero el microdetalle
      //    real de piel/tela vuelve a aparecer.
      const texture = Math.max(0, Math.min(60, options.texture ?? 0))
      if (texture > 0 && targetWidth > 0 && targetHeight > 0) {
        ctx.reportProgress({ percent: 94, phase: 'Recuperando textura natural' })
        const grain = await sharp(input)
          .resize(targetWidth, targetHeight, { kernel: 'lanczos3', fit: 'fill' })
          // removeAlpha + ensureAlpha(opacidad): capa uniforme semitransparente
          // que se funde sobre el resultado IA.
          .removeAlpha()
          .ensureAlpha(texture / 100)
          .png()
          .toBuffer()
        buffer = await sharp(buffer).composite([{ input: grain }]).png().toBuffer()
      }

      // Mantener DPI original (metadata density → PPP).
      let out = sharp(buffer)
      if (srcMeta.density) {
        out = out.withMetadata({ density: srcMeta.density })
      }
      await out.png().toFile(outputPath)

      ctx.reportProgress({ percent: 100 })
      return { outputPath }
    } finally {
      await removeDir(tempDir)
    }
  }

  /**
   * Descompone la escala pedida en pasadas nativas del modelo.
   * Ej.: modelo ×4 → 2x: [4] (+reducción) | 4x: [4] | 8x: [4, 4] (+reducción)
   * Ej.: modelo 2/3/4 → 2x: [2] | 8x: [4, 2]
   */
  private planPasses(target: 2 | 4 | 8, native: number[]): number[] {
    const best = Math.max(...native)
    if (native.includes(target)) return [target]
    if (target === 2) return [best] // se reducirá después
    if (target === 4) return [best]
    // target === 8
    if (native.includes(2)) return [4, 2]
    return [best, best] // ×16 → se reduce a ×8 al final
  }

  /**
   * Ejecuta una pasada de Real-ESRGAN con reintentos automáticos.
   *
   * El binario ncnn-vulkan crashea con violación de acceso (código
   * 3221225477 / 0xC0000005 en Windows) cuando la GPU se queda sin VRAM —
   * habitual en 8x, donde la segunda pasada procesa una imagen ya 4 veces
   * más grande. El parámetro -t (tile) trocea la imagen en teselas y acota
   * el pico de memoria a costa de algo de velocidad.
   *
   * Escalera: modo normal → teselas 256 → 128 → 64 → CPU (último recurso).
   * Cada reintento se registra en el log y se refleja en la fase de la UI.
   */
  private async runPassResilient(
    exe: string,
    modelsDir: string,
    modelId: string,
    input: string,
    output: string,
    scale: number,
    ctx: ExecutionContext,
    passIndex: number,
    passCount: number
  ): Promise<void> {
    const useGpu = ctx.services.settings.get().useGpu
    const attempts: Array<{ tileSize?: number; forceCpu?: boolean }> = [
      {},
      { tileSize: 256 },
      { tileSize: 128 },
      { tileSize: 64 }
    ]
    // Si la GPU está activada, añadir CPU como último recurso absoluto.
    if (useGpu) attempts.push({ forceCpu: true, tileSize: 128 })

    let lastError: Error | null = null
    for (let i = 0; i < attempts.length; i++) {
      throwIfAborted(ctx.signal)
      const attempt = attempts[i]
      if (i > 0) {
        const detail = attempt.forceCpu
          ? 'reintentando con CPU'
          : `reintentando con teselas de ${attempt.tileSize}px (menos VRAM)`
        ctx.services.logger.warn(
          'realesrgan',
          `Pasada ${passIndex + 1} falló (${lastError?.message}); ${detail}`
        )
        ctx.reportProgress({
          percent: (passIndex / passCount) * 90,
          phase: `IA — ${detail}`
        })
      }
      try {
        await this.runRealesrgan(exe, modelsDir, modelId, input, output, scale, ctx, passIndex, passCount, attempt)
        return
      } catch (err) {
        if (err instanceof CancelledError) throw err
        lastError = err instanceof Error ? err : new Error(String(err))
      }
    }
    throw lastError ?? new Error('Real-ESRGAN falló sin detalle')
  }

  private runRealesrgan(
    exe: string,
    modelsDir: string,
    modelId: string,
    input: string,
    output: string,
    scale: number,
    ctx: ExecutionContext,
    passIndex: number,
    passCount: number,
    opts: { tileSize?: number; forceCpu?: boolean } = {}
  ): Promise<void> {
    const useGpu = ctx.services.settings.get().useGpu && !opts.forceCpu
    const args = [
      '-i', input,
      '-o', output,
      '-n', modelId,
      '-s', String(scale),
      '-m', modelsDir,
      '-f', 'png'
    ]
    // -t: tamaño de tesela; acota el uso de VRAM en imágenes grandes.
    if (opts.tileSize) args.push('-t', String(opts.tileSize))
    // -g -1 = CPU; por defecto autodetecta la GPU Vulkan (CUDA en NVIDIA).
    if (!useGpu) args.push('-g', '-1')

    ctx.services.logger.info('realesrgan', `${exe} ${args.join(' ')}`)

    return new Promise((resolve, reject) => {
      const child = spawn(exe, args, { windowsHide: true })
      const onAbort = (): void => {
        child.kill('SIGKILL')
      }
      ctx.signal.addEventListener('abort', onAbort, { once: true })

      let stderrTail = ''
      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString()
        stderrTail = (stderrTail + text).slice(-2000)
        // El binario informa "12,34%" o "12.34%".
        const m = /([\d]+[.,]\d+)%/.exec(text)
        if (m) {
          const passPercent = parseFloat(m[1].replace(',', '.'))
          // Re-mapear al progreso global: cada pasada ocupa un tramo de 0-90.
          const overall = ((passIndex + passPercent / 100) / passCount) * 90
          ctx.reportProgress({
            percent: Math.min(90, overall),
            phase: passCount > 1 ? `IA — pasada ${passIndex + 1}/${passCount}` : 'Escalando con IA'
          })
        }
      })

      child.on('error', reject)
      child.on('close', (code) => {
        ctx.signal.removeEventListener('abort', onAbort)
        if (ctx.signal.aborted) reject(new CancelledError())
        else if (code === 0) resolve()
        else {
          // 3221225477 = 0xC0000005 (violación de acceso): casi siempre
          // significa que la GPU agotó su VRAM con la imagen completa.
          const reason =
            code === 3221225477
              ? 'memoria de GPU agotada'
              : stderrTail.trim().split('\n').pop() || 'sin detalle'
          reject(new Error(`Real-ESRGAN terminó con código ${code}: ${reason}`))
        }
      })
    })
  }
}
