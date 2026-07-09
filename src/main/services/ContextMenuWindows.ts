/**
 * ContextMenuWindows — integración con el clic derecho del Explorador.
 *
 * Registra entradas "Convertir con Escalador" en HKCU (no requiere admin)
 * para las extensiones de imagen y vídeo soportadas. Al hacer clic, Windows
 * lanza la app con la ruta del archivo como argumento; el manejador de
 * segunda instancia (index.ts) la reenvía al renderer, que abre la pantalla
 * de conversión adecuada con el archivo ya cargado.
 *
 * Solo disponible en win32; en macOS/Linux las funciones son no-op.
 */
import { app } from 'electron'
import { spawn } from 'child_process'
import { IMAGE_INPUT_EXTENSIONS, VIDEO_INPUT_EXTENSIONS } from '@shared/formats'
import type { LoggerService } from './LoggerService'

const MENU_KEY = 'EscaladorConvert'

export class ContextMenuWindows {
  constructor(private readonly logger: LoggerService) {}

  isSupported(): boolean {
    return process.platform === 'win32'
  }

  /** ¿Está registrada la entrada del menú contextual? */
  async isRegistered(): Promise<boolean> {
    if (!this.isSupported()) return false
    try {
      await this.reg(['query', this.keyFor('.png')])
      return true
    } catch {
      return false
    }
  }

  /** Crea las claves de registro para todas las extensiones soportadas. */
  async register(): Promise<void> {
    if (!this.isSupported()) return
    const exe = app.isPackaged ? process.execPath : `${process.execPath}" "${app.getAppPath()}`
    const extensions = [...IMAGE_INPUT_EXTENSIONS, ...VIDEO_INPUT_EXTENSIONS]

    for (const ext of extensions) {
      const key = this.keyFor(`.${ext}`)
      await this.reg(['add', key, '/ve', '/d', 'Convertir con Escalador', '/f'])
      await this.reg(['add', key, '/v', 'Icon', '/d', process.execPath, '/f'])
      await this.reg(['add', `${key}\\command`, '/ve', '/d', `"${exe}" "%1"`, '/f'])
    }
    this.logger.info('context-menu', `Menú contextual registrado (${extensions.length} extensiones)`)
  }

  /** Elimina las claves de registro. */
  async unregister(): Promise<void> {
    if (!this.isSupported()) return
    const extensions = [...IMAGE_INPUT_EXTENSIONS, ...VIDEO_INPUT_EXTENSIONS]
    for (const ext of extensions) {
      await this.reg(['delete', this.keyFor(`.${ext}`), '/f']).catch(() => {})
    }
    this.logger.info('context-menu', 'Menú contextual eliminado')
  }

  private keyFor(ext: string): string {
    // SystemFileAssociations aplica el menú a la extensión sin robar la
    // asociación de "abrir con" por defecto.
    return `HKCU\\Software\\Classes\\SystemFileAssociations\\${ext}\\shell\\${MENU_KEY}`
  }

  private reg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('reg', args, { windowsHide: true })
      let err = ''
      child.stderr.on('data', (d: Buffer) => (err += d.toString()))
      child.on('error', reject)
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || `reg exit ${code}`))))
    })
  }
}
