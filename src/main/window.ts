/**
 * Creación de la ventana principal.
 *
 * Seguridad: contextIsolation activado, nodeIntegration desactivado y
 * sandbox=false solo porque el preload necesita módulos de Electron; toda
 * la comunicación pasa por el contextBridge tipado.
 */
import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from './utils/env'

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    show: false, // se muestra en ready-to-show para evitar el "flash" blanco
    autoHideMenuBar: true,
    backgroundColor: '#101014',
    title: 'Escalador',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.on('ready-to-show', () => window.show())

  // Los enlaces externos se abren en el navegador, nunca en la app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // En dev, electron-vite sirve el renderer con HMR; en prod, archivo local.
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}
