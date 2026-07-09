/**
 * registerIpc — punto único de cableado entre el renderer y los servicios.
 *
 * Cada handler valida/adapta la entrada y delega en el servicio adecuado;
 * aquí no hay lógica de negocio (Clean Architecture: esta capa es solo
 * "controladores").
 */
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { IPC } from '@shared/ipc'
import type { AppSettings, BinaryName, JobRequest } from '@shared/types'
import type { AppServices } from '../services/container'

export function registerIpc(services: AppServices): void {
  const {
    settings, queue, history, logger, binaries, updates, contextMenu, ffmpeg
  } = services

  /* ---------------- Diálogos y shell ---------------- */

  ipcMain.handle(IPC.DIALOG_SELECT_FILES, async (_e, filters: Electron.FileFilter[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle(IPC.DIALOG_SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.SHELL_SHOW_ITEM, (_e, itemPath: string) => shell.showItemInFolder(itemPath))
  ipcMain.handle(IPC.SHELL_OPEN_PATH, (_e, target: string) => shell.openPath(target))
  ipcMain.handle(IPC.SHELL_OPEN_EXTERNAL, (_e, url: string) => {
    // Solo se permiten enlaces web (nunca file:// u otros esquemas).
    if (/^https?:\/\//.test(url)) return shell.openExternal(url)
    return Promise.resolve()
  })

  ipcMain.handle(IPC.SYSTEM_INFO, () => ({
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    totalMemGb: Math.round(os.totalmem() / 1024 ** 3)
  }))

  /**
   * Vista previa segura: el renderer no puede leer file:// con contextIsolation,
   * así que main lee la imagen y la devuelve como data URL (limitado a 40 MB).
   */
  ipcMain.handle(IPC.FILE_TO_DATA_URL, async (_e, filePath: string) => {
    const stat = await fs.stat(filePath)
    if (stat.size > 40 * 1024 * 1024) return null
    const ext = path.extname(filePath).slice(1).toLowerCase()
    const mime = ext === 'jpg' ? 'jpeg' : ext
    const buf = await fs.readFile(filePath)
    return `data:image/${mime};base64,${buf.toString('base64')}`
  })

  /* ---------------- Ajustes ---------------- */

  ipcMain.handle(IPC.SETTINGS_GET, () => settings.get())
  ipcMain.handle(IPC.SETTINGS_SET, (_e, partial: Partial<AppSettings>) => settings.set(partial))

  /* ---------------- Cola de trabajos ---------------- */

  ipcMain.handle(IPC.JOBS_ENQUEUE, (_e, request: JobRequest) => queue.enqueue(request))
  ipcMain.handle(IPC.JOBS_CANCEL, (_e, id: string) => queue.cancel(id))
  ipcMain.handle(IPC.JOBS_LIST, () => queue.list())
  ipcMain.handle(IPC.JOBS_CLEAR_FINISHED, () => queue.clearFinished())

  // Difusión de actualizaciones de trabajos a todas las ventanas.
  queue.onJobUpdated((job) => broadcast(IPC.JOBS_EVENT_UPDATED, job))

  /* ---------------- Historial ---------------- */

  ipcMain.handle(IPC.HISTORY_LIST, () => history.list())
  ipcMain.handle(IPC.HISTORY_REMOVE, (_e, id: string) => history.remove(id))
  ipcMain.handle(IPC.HISTORY_CLEAR, () => history.clear())

  /* ---------------- Logs ---------------- */

  ipcMain.handle(IPC.LOGS_LIST, () => logger.list())
  ipcMain.handle(IPC.LOGS_CLEAR, () => logger.clear())
  ipcMain.handle(IPC.LOGS_EXPORT, async () => {
    const result = await dialog.showSaveDialog({
      defaultPath: `escalador-logs-${new Date().toISOString().slice(0, 10)}.log`,
      filters: [{ name: 'Log', extensions: ['log', 'txt'] }]
    })
    if (result.canceled || !result.filePath) return false
    logger.exportTo(result.filePath)
    return true
  })

  /* ---------------- Binarios / modelos IA ---------------- */

  ipcMain.handle(IPC.BINARIES_STATUS, () => binaries.status())
  ipcMain.handle(IPC.BINARIES_ENSURE, (_e, name: BinaryName) => binaries.ensure(name))
  ipcMain.handle(IPC.BINARIES_UPDATE, (_e, name: BinaryName) => binaries.update(name))
  binaries.onProgress((p) => broadcast(IPC.BINARIES_EVENT_PROGRESS, p))

  /* ---------------- Multimedia ---------------- */

  ipcMain.handle(IPC.MEDIA_PROBE, (_e, filePath: string) => ffmpeg.probe(filePath))

  /* ---------------- Actualizaciones ---------------- */

  ipcMain.handle(IPC.UPDATES_CHECK, () => updates.check())
  ipcMain.handle(IPC.UPDATES_INSTALL, () => updates.install())
  updates.onEvent((payload) => broadcast(IPC.UPDATES_EVENT, payload))

  /* ---------------- Menú contextual (Windows) ---------------- */

  ipcMain.handle(IPC.CONTEXT_MENU_STATUS, async () => ({
    supported: contextMenu.isSupported(),
    registered: await contextMenu.isRegistered()
  }))
  ipcMain.handle(IPC.CONTEXT_MENU_REGISTER, () => contextMenu.register())
  ipcMain.handle(IPC.CONTEXT_MENU_UNREGISTER, () => contextMenu.unregister())
}

/** Envía un evento a todas las ventanas abiertas. */
function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}
