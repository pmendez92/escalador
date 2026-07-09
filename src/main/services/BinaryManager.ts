/**
 * BinaryManager — gestiona los binarios externos que la app necesita en
 * tiempo de ejecución: Real-ESRGAN (ncnn-vulkan), RIFE (ncnn-vulkan) y yt-dlp.
 *
 * Flujo:
 *  1. `ensure(name)` comprueba si el binario existe en userData/bin/<name>.
 *  2. Si no existe, lo descarga desde GitHub Releases con progreso
 *     (evento BINARIES_EVENT_PROGRESS hacia el renderer).
 *  3. Extrae el .zip (Real-ESRGAN/RIFE incluyen los modelos .param/.bin).
 *  4. Calcula y registra el SHA-256 del ejecutable en manifest.json; en
 *     arranques posteriores se re-verifica la integridad y, si no coincide,
 *     se fuerza una reinstalación.
 *  5. `update(name)` borra la instalación y vuelve a descargar la última
 *     versión publicada.
 *
 * Los binarios ncnn-vulkan usan la GPU vía Vulkan (NVIDIA/AMD/Intel) y caen
 * automáticamente a CPU si no hay GPU compatible (`-g -1` fuerza CPU).
 */
import { app } from 'electron'
import { promises as fs, existsSync, readFileSync, chmodSync } from 'fs'
import path from 'path'
import extractZip from 'extract-zip'
import { downloadFile } from '../utils/download'
import { ensureDir, removeDir, sha256File } from '../utils/fs'
import type { LoggerService } from './LoggerService'
import type { BinaryDownloadProgress, BinaryName, BinaryStatus } from '@shared/types'

interface BinarySpec {
  name: BinaryName
  /** URL de descarga por plataforma */
  url: Record<'win32' | 'darwin' | 'linux', string>
  /** Nombre del ejecutable por plataforma */
  exe: Record<'win32' | 'darwin' | 'linux', string>
  /** true si la descarga es un zip que hay que extraer */
  isZip: boolean
}

const REALESRGAN_RELEASE =
  'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424'
const RIFE_RELEASE =
  'https://github.com/nihui/rife-ncnn-vulkan/releases/download/20221029/rife-ncnn-vulkan-20221029'
const YTDLP_RELEASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download'

const SPECS: Record<BinaryName, BinarySpec> = {
  realesrgan: {
    name: 'realesrgan',
    url: {
      win32: `${REALESRGAN_RELEASE}-windows.zip`,
      darwin: `${REALESRGAN_RELEASE}-macos.zip`,
      linux: `${REALESRGAN_RELEASE}-ubuntu.zip`
    },
    exe: {
      win32: 'realesrgan-ncnn-vulkan.exe',
      darwin: 'realesrgan-ncnn-vulkan',
      linux: 'realesrgan-ncnn-vulkan'
    },
    isZip: true
  },
  rife: {
    name: 'rife',
    url: {
      win32: `${RIFE_RELEASE}-windows.zip`,
      darwin: `${RIFE_RELEASE}-macos.zip`,
      linux: `${RIFE_RELEASE}-ubuntu.zip`
    },
    exe: {
      win32: 'rife-ncnn-vulkan.exe',
      darwin: 'rife-ncnn-vulkan',
      linux: 'rife-ncnn-vulkan'
    },
    isZip: true
  },
  ytdlp: {
    name: 'ytdlp',
    url: {
      win32: `${YTDLP_RELEASE}/yt-dlp.exe`,
      darwin: `${YTDLP_RELEASE}/yt-dlp_macos`,
      linux: `${YTDLP_RELEASE}/yt-dlp`
    },
    exe: { win32: 'yt-dlp.exe', darwin: 'yt-dlp', linux: 'yt-dlp' },
    isZip: false
  }
}

interface Manifest {
  [name: string]: { sha256: string; installedAt: number }
}

type ProgressListener = (p: BinaryDownloadProgress) => void

export class BinaryManager {
  private readonly binRoot: string
  private readonly manifestPath: string
  private manifest: Manifest
  private listeners = new Set<ProgressListener>()
  /** Evita descargas duplicadas concurrentes del mismo binario */
  private inFlight = new Map<BinaryName, Promise<string>>()

  constructor(private readonly logger: LoggerService) {
    this.binRoot = path.join(app.getPath('userData'), 'bin')
    this.manifestPath = path.join(this.binRoot, 'manifest.json')
    this.manifest = this.loadManifest()
  }

  onProgress(listener: ProgressListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  status(): BinaryStatus[] {
    return (Object.keys(SPECS) as BinaryName[]).map((name) => {
      const exePath = this.exePath(name)
      const installed = existsSync(exePath)
      return {
        name,
        installed,
        path: installed ? exePath : undefined,
        sha256: this.manifest[name]?.sha256,
        installedAt: this.manifest[name]?.installedAt
      }
    })
  }

  /**
   * Garantiza que el binario está instalado y verificado; lo descarga si
   * hace falta. Devuelve la ruta del ejecutable.
   */
  ensure(name: BinaryName): Promise<string> {
    const existing = this.inFlight.get(name)
    if (existing) return existing
    const promise = this.ensureInternal(name).finally(() => this.inFlight.delete(name))
    this.inFlight.set(name, promise)
    return promise
  }

  /** Fuerza la reinstalación (actualización) del binario. */
  async update(name: BinaryName): Promise<string> {
    await removeDir(this.dir(name))
    delete this.manifest[name]
    await this.saveManifest()
    return this.ensure(name)
  }

  /** Carpeta de modelos de Real-ESRGAN (los .param/.bin del zip). */
  modelsDir(name: BinaryName): string {
    return path.join(this.dir(name), 'models')
  }

  private async ensureInternal(name: BinaryName): Promise<string> {
    const exePath = this.exePath(name)

    if (existsSync(exePath)) {
      // Verificación de integridad contra el manifest.
      const recorded = this.manifest[name]?.sha256
      if (recorded) {
        const actual = await sha256File(exePath)
        if (actual === recorded) return exePath
        this.logger.warn('binaries', `Integridad inválida en ${name}; reinstalando`)
        await removeDir(this.dir(name))
      } else {
        return exePath
      }
    }

    const spec = SPECS[name]
    const platform = process.platform as 'win32' | 'darwin' | 'linux'
    const url = spec.url[platform]
    if (!url) throw new Error(`Plataforma no soportada para ${name}`)

    await ensureDir(this.dir(name))
    this.logger.info('binaries', `Descargando ${name} desde ${url}`)

    const downloadTarget = spec.isZip
      ? path.join(this.dir(name), `${name}.zip`)
      : exePath

    await downloadFile(url, downloadTarget, (p) =>
      this.emit({ name, ...p, phase: 'downloading' })
    )

    if (spec.isZip) {
      this.emit({ name, percent: 100, downloadedBytes: 0, totalBytes: 0, phase: 'extracting' })
      // Los zips de Real-ESRGAN extraen a la raíz; los de RIFE crean subcarpeta.
      await extractZip(downloadTarget, { dir: this.dir(name) })
      await this.flattenSingleSubdir(this.dir(name), spec.exe[platform])
      await fs.unlink(downloadTarget).catch(() => {})
    }

    if (!existsSync(exePath)) {
      this.emit({ name, percent: 0, downloadedBytes: 0, totalBytes: 0, phase: 'error', error: 'Ejecutable no encontrado tras extraer' })
      throw new Error(`No se encontró ${exePath} tras la instalación`)
    }

    // En macOS/Linux hay que dar permisos de ejecución.
    if (platform !== 'win32') chmodSync(exePath, 0o755)

    this.emit({ name, percent: 100, downloadedBytes: 0, totalBytes: 0, phase: 'verifying' })
    this.manifest[name] = { sha256: await sha256File(exePath), installedAt: Date.now() }
    await this.saveManifest()

    this.emit({ name, percent: 100, downloadedBytes: 0, totalBytes: 0, phase: 'done' })
    this.logger.info('binaries', `${name} instalado en ${exePath}`)
    return exePath
  }

  /**
   * Si el zip extrajo todo dentro de una única subcarpeta (caso RIFE),
   * mueve su contenido a la raíz de la instalación.
   */
  private async flattenSingleSubdir(dir: string, exeName: string): Promise<void> {
    if (existsSync(path.join(dir, exeName))) return
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const subdirs = entries.filter((e) => e.isDirectory())
    for (const sub of subdirs) {
      const candidate = path.join(dir, sub.name, exeName)
      if (existsSync(candidate)) {
        const subPath = path.join(dir, sub.name)
        for (const item of await fs.readdir(subPath)) {
          await fs.rename(path.join(subPath, item), path.join(dir, item))
        }
        await removeDir(subPath)
        return
      }
    }
  }

  private dir(name: BinaryName): string {
    return path.join(this.binRoot, name)
  }

  private exePath(name: BinaryName): string {
    const platform = process.platform as 'win32' | 'darwin' | 'linux'
    return path.join(this.dir(name), SPECS[name].exe[platform])
  }

  private emit(p: BinaryDownloadProgress): void {
    for (const l of this.listeners) l(p)
  }

  private loadManifest(): Manifest {
    try {
      if (existsSync(this.manifestPath)) {
        return JSON.parse(readFileSync(this.manifestPath, 'utf8'))
      }
    } catch {
      /* manifest corrupto → se regenera */
    }
    return {}
  }

  private async saveManifest(): Promise<void> {
    await ensureDir(this.binRoot)
    await fs.writeFile(this.manifestPath, JSON.stringify(this.manifest, null, 2), 'utf8')
  }
}
