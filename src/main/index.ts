/**
 * Punto de entrada del proceso principal de Electron.
 *
 * Orquesta el arranque:
 *  1. Instancia única (los archivos abiertos con clic derecho desde el
 *     Explorador llegan por argv a la instancia existente).
 *  2. Composición de servicios (container.ts) y registro de IPC.
 *  3. Creación de la ventana y carga de plugins.
 *  4. Comprobación de actualizaciones (si está activada en Ajustes).
 */
import { app, BrowserWindow } from 'electron'
import path from 'path'
import { existsSync } from 'fs'
import { createServices } from './services/container'
import { registerIpc } from './ipc/registerIpc'
import { createMainWindow } from './window'
import { IPC } from '@shared/ipc'
import { IMAGE_INPUT_EXTENSIONS, VIDEO_INPUT_EXTENSIONS } from '@shared/formats'

let mainWindow: BrowserWindow | null = null
/** Archivos recibidos por argv antes de que la ventana esté lista. */
let pendingFiles: string[] = []

/* -------------------------------------------------------------------- */
/* Instancia única: reenviar archivos de un segundo lanzamiento          */
/* -------------------------------------------------------------------- */
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const files = extractFileArgs(argv)
    if (files.length > 0) sendOpenFiles(files)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(() => {
    // Identificador de la app en Windows (notificaciones, jump list…)
    app.setAppUserModelId('com.pedromendez.escalador')

    const services = createServices()
    registerIpc(services)
    services.plugins.loadAll()
    services.logger.info('app', `Escalador ${app.getVersion()} iniciado (${process.platform})`)

    mainWindow = createMainWindow()

    // Archivos pasados en el primer argv (clic derecho / "Abrir con").
    pendingFiles = extractFileArgs(process.argv)
    mainWindow.webContents.once('did-finish-load', () => {
      if (pendingFiles.length > 0) sendOpenFiles(pendingFiles)
    })

    // Comprobación automática de actualizaciones.
    if (services.settings.get().checkUpdatesOnStartup) {
      void services.updates.check()
    }

    // macOS: recrear la ventana al hacer clic en el dock.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    // Convención macOS: la app sigue viva sin ventanas.
    if (process.platform !== 'darwin') app.quit()
  })
}

/* -------------------------------------------------------------------- */
/* Helpers                                                                */
/* -------------------------------------------------------------------- */

/** Filtra de argv las rutas de archivos multimedia existentes. */
function extractFileArgs(argv: string[]): string[] {
  const valid = new Set([...IMAGE_INPUT_EXTENSIONS, ...VIDEO_INPUT_EXTENSIONS])
  return argv.filter((arg) => {
    if (arg.startsWith('-')) return false
    const ext = path.extname(arg).slice(1).toLowerCase()
    return valid.has(ext) && existsSync(arg)
  })
}

function sendOpenFiles(files: string[]): void {
  mainWindow?.webContents.send(IPC.OPEN_WITH_FILES, files)
}
