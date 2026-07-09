/**
 * Preload — puente seguro entre el proceso principal y el renderer.
 *
 * Expone `window.api`, una superficie tipada y mínima: el renderer nunca
 * toca Node.js ni Electron directamente (contextIsolation). Cada método
 * invoca un canal IPC concreto; los eventos main→renderer se suscriben con
 * funciones on* que devuelven un "unsubscribe".
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AppSettings,
  BinaryDownloadProgress,
  BinaryName,
  BinaryStatus,
  HistoryEntry,
  Job,
  JobRequest,
  LogEntry,
  MediaInfo,
  UpdateInfoPayload
} from '@shared/types'

/** Crea un suscriptor tipado para un canal de eventos main→renderer. */
function subscribe<T>(channel: string) {
  return (callback: (payload: T) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: T): void => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

const api = {
  /* Diálogos y sistema */
  selectFiles: (filters: { name: string; extensions: string[] }[]): Promise<string[]> =>
    ipcRenderer.invoke(IPC.DIALOG_SELECT_FILES, filters),
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke(IPC.DIALOG_SELECT_DIRECTORY),
  showItemInFolder: (p: string): Promise<void> => ipcRenderer.invoke(IPC.SHELL_SHOW_ITEM, p),
  openPath: (p: string): Promise<string> => ipcRenderer.invoke(IPC.SHELL_OPEN_PATH, p),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.SHELL_OPEN_EXTERNAL, url),
  systemInfo: (): Promise<{ platform: string; arch: string; cpus: number; totalMemGb: number }> =>
    ipcRenderer.invoke(IPC.SYSTEM_INFO),
  fileToDataUrl: (p: string): Promise<string | null> => ipcRenderer.invoke(IPC.FILE_TO_DATA_URL, p),
  /** Ruta real de un File soltado por drag&drop (Electron ≥ 32). */
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  /* Ajustes */
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, partial),

  /* Cola de trabajos */
  enqueueJob: (request: JobRequest): Promise<Job> => ipcRenderer.invoke(IPC.JOBS_ENQUEUE, request),
  cancelJob: (id: string): Promise<void> => ipcRenderer.invoke(IPC.JOBS_CANCEL, id),
  listJobs: (): Promise<Job[]> => ipcRenderer.invoke(IPC.JOBS_LIST),
  clearFinishedJobs: (): Promise<void> => ipcRenderer.invoke(IPC.JOBS_CLEAR_FINISHED),
  onJobUpdated: subscribe<Job>(IPC.JOBS_EVENT_UPDATED),

  /* Historial */
  listHistory: (): Promise<HistoryEntry[]> => ipcRenderer.invoke(IPC.HISTORY_LIST),
  removeHistory: (id: string): Promise<void> => ipcRenderer.invoke(IPC.HISTORY_REMOVE, id),
  clearHistory: (): Promise<void> => ipcRenderer.invoke(IPC.HISTORY_CLEAR),

  /* Logs */
  listLogs: (): Promise<LogEntry[]> => ipcRenderer.invoke(IPC.LOGS_LIST),
  clearLogs: (): Promise<void> => ipcRenderer.invoke(IPC.LOGS_CLEAR),
  exportLogs: (): Promise<boolean> => ipcRenderer.invoke(IPC.LOGS_EXPORT),

  /* Binarios / modelos IA */
  binariesStatus: (): Promise<BinaryStatus[]> => ipcRenderer.invoke(IPC.BINARIES_STATUS),
  ensureBinary: (name: BinaryName): Promise<string> => ipcRenderer.invoke(IPC.BINARIES_ENSURE, name),
  updateBinary: (name: BinaryName): Promise<string> => ipcRenderer.invoke(IPC.BINARIES_UPDATE, name),
  onBinaryProgress: subscribe<BinaryDownloadProgress>(IPC.BINARIES_EVENT_PROGRESS),

  /* Multimedia */
  probeMedia: (p: string): Promise<MediaInfo> => ipcRenderer.invoke(IPC.MEDIA_PROBE, p),

  /* Actualizaciones */
  checkUpdates: (): Promise<void> => ipcRenderer.invoke(IPC.UPDATES_CHECK),
  installUpdate: (): Promise<void> => ipcRenderer.invoke(IPC.UPDATES_INSTALL),
  onUpdateEvent: subscribe<UpdateInfoPayload>(IPC.UPDATES_EVENT),

  /* Menú contextual de Windows */
  contextMenuStatus: (): Promise<{ supported: boolean; registered: boolean }> =>
    ipcRenderer.invoke(IPC.CONTEXT_MENU_STATUS),
  registerContextMenu: (): Promise<void> => ipcRenderer.invoke(IPC.CONTEXT_MENU_REGISTER),
  unregisterContextMenu: (): Promise<void> => ipcRenderer.invoke(IPC.CONTEXT_MENU_UNREGISTER),

  /* Archivos abiertos desde el explorador */
  onOpenWithFiles: subscribe<string[]>(IPC.OPEN_WITH_FILES)
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
