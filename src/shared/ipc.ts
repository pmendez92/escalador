/**
 * Nombres de canales IPC centralizados.
 *
 * Mantenerlos en un único módulo evita "strings mágicos" repartidos por el
 * código y garantiza que main, preload y renderer siempre hablan el mismo
 * protocolo (principio DRY).
 */
export const IPC = {
  // Diálogos y sistema
  DIALOG_SELECT_FILES: 'dialog:select-files',
  DIALOG_SELECT_DIRECTORY: 'dialog:select-directory',
  SHELL_SHOW_ITEM: 'shell:show-item-in-folder',
  SHELL_OPEN_PATH: 'shell:open-path',
  SHELL_OPEN_EXTERNAL: 'shell:open-external',
  SYSTEM_INFO: 'system:info',
  FILE_TO_DATA_URL: 'file:to-data-url',

  // Ajustes
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Cola de trabajos
  JOBS_ENQUEUE: 'jobs:enqueue',
  JOBS_CANCEL: 'jobs:cancel',
  JOBS_LIST: 'jobs:list',
  JOBS_CLEAR_FINISHED: 'jobs:clear-finished',
  JOBS_EVENT_UPDATED: 'jobs:event:updated', // main → renderer

  // Historial
  HISTORY_LIST: 'history:list',
  HISTORY_REMOVE: 'history:remove',
  HISTORY_CLEAR: 'history:clear',

  // Logs
  LOGS_LIST: 'logs:list',
  LOGS_CLEAR: 'logs:clear',
  LOGS_EXPORT: 'logs:export',

  // Binarios / modelos de IA
  BINARIES_STATUS: 'binaries:status',
  BINARIES_ENSURE: 'binaries:ensure',
  BINARIES_UPDATE: 'binaries:update',
  BINARIES_EVENT_PROGRESS: 'binaries:event:progress', // main → renderer

  // Información multimedia
  MEDIA_PROBE: 'media:probe',

  // Actualizaciones de la app
  UPDATES_CHECK: 'updates:check',
  UPDATES_INSTALL: 'updates:install',
  UPDATES_EVENT: 'updates:event', // main → renderer

  // Menú contextual de Windows
  CONTEXT_MENU_STATUS: 'context-menu:status',
  CONTEXT_MENU_REGISTER: 'context-menu:register',
  CONTEXT_MENU_UNREGISTER: 'context-menu:unregister',

  // Archivos abiertos desde el explorador (clic derecho / argv)
  OPEN_WITH_FILES: 'app:event:open-with-files' // main → renderer
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
