/**
 * Tipos compartidos entre el proceso principal (backend Node.js) y el
 * renderer (React). Es la única "fuente de verdad" del dominio: trabajos,
 * ajustes, historial, binarios y progreso.
 */

/* ========================================================================== */
/* Trabajos (cola de procesos)                                                */
/* ========================================================================== */

export type JobType =
  | 'image-convert'
  | 'video-convert'
  | 'image-upscale'
  | 'video-upscale'
  | 'download'

export type JobStatus = 'pending' | 'running' | 'completed' | 'error' | 'cancelled'

export interface JobProgress {
  /** 0..100 */
  percent: number
  /** Segundos restantes estimados (si se pueden calcular) */
  etaSeconds?: number
  /** Texto libre de velocidad, p. ej. "2.4x" o "1.2 MiB/s" */
  speed?: string
  /** Fase actual para pipelines multi-paso ("Extrayendo fotogramas"…) */
  phase?: string
}

/** Opciones de conversión de imagen */
export interface ImageConvertOptions {
  targetFormat: ImageTargetFormat
  /** 1..100 — calidad para formatos con pérdida */
  quality?: number
  /** Conservar EXIF / ICC / DPI cuando el formato lo permita */
  keepMetadata: boolean
  /** Eliminar todos los metadatos (tiene prioridad sobre keepMetadata) */
  stripMetadata?: boolean
  /** Modo compresión: mismo formato, menor peso */
  compress?: boolean
}

/** Opciones de conversión de vídeo / extracción de audio */
export interface VideoConvertOptions {
  targetFormat: VideoTargetFormat
  /** Bitrate de vídeo, p. ej. "4M". Vacío = decide el códec (CRF) */
  videoBitrate?: string
  /** Bitrate de audio, p. ej. "192k" */
  audioBitrate?: string
  /** Copiar subtítulos cuando el contenedor lo permita */
  keepSubtitles: boolean
  /** Eliminar metadatos del contenedor */
  stripMetadata?: boolean
  /** Modo compresión: mismo formato, CRF alto */
  compress?: boolean
}

/** Opciones de escalado IA de imágenes */
export interface ImageUpscaleOptions {
  scale: 2 | 4 | 8
  /** Nombre del modelo Real-ESRGAN (ver AI_IMAGE_MODELS) */
  model: string
  /**
   * Textura natural (0..60): porcentaje de la imagen original (reescalada
   * con Lanczos) que se mezcla sobre el resultado IA. Real-ESRGAN tiende a
   * "plastificar" la piel al eliminar el grano fotográfico como si fuera
   * ruido; reinyectar un 20-35 % de textura original devuelve un acabado
   * realista sin perder la nitidez ganada. 0 = desactivado.
   */
  texture?: number
}

/** Opciones de mejora IA de vídeo */
export interface VideoUpscaleOptions {
  targetResolution: '1080p' | '2k' | '4k'
  model: string
  /** Interpolación de fotogramas con RIFE (duplica los FPS) */
  interpolate: boolean
  /** Bitrate de salida, p. ej. "8M". Vacío = CRF 18 */
  videoBitrate?: string
}

/** Opciones de descarga con yt-dlp */
export interface DownloadOptions {
  url: string
  mode: 'video' | 'audio'
  /** 'best' | '2160' | '1440' | '1080' | '720' | '480' */
  resolution: string
  /** Contenedor de vídeo: 'mp4' | 'mkv' | 'webm' */
  format: string
  downloadThumbnail: boolean
  downloadSubtitles: boolean
  playlist: boolean
  /** Solo modo audio */
  audioFormat?: 'mp3' | 'wav' | 'ogg'
  /** Bitrate de audio, p. ej. "192" (kbps) */
  audioBitrate?: string
  embedThumbnail?: boolean
  /** Nombre de archivo personalizado (sin extensión). Vacío = título original */
  filename?: string
}

export type JobOptions =
  | ImageConvertOptions
  | VideoConvertOptions
  | ImageUpscaleOptions
  | VideoUpscaleOptions
  | DownloadOptions

export interface Job {
  id: string
  type: JobType
  /** Título legible mostrado en la cola ("foto.png → WEBP") */
  title: string
  /** Ruta del archivo de entrada (no aplica a descargas) */
  inputPath?: string
  /** Carpeta de salida elegida */
  outputDir: string
  options: JobOptions
  status: JobStatus
  progress: JobProgress
  /** Ruta del resultado una vez completado */
  outputPath?: string
  error?: string
  createdAt: number
  startedAt?: number
  finishedAt?: number
}

/** Petición de creación de trabajo desde el renderer */
export interface JobRequest {
  type: JobType
  inputPath?: string
  outputDir?: string
  options: JobOptions
}

/* ========================================================================== */
/* Formatos                                                                   */
/* ========================================================================== */

export type ImageTargetFormat =
  | 'png'
  | 'jpg'
  | 'jpeg'
  | 'webp'
  | 'gif'
  | 'gif-lq'
  | 'ico'
  | 'pdf'

export type VideoTargetFormat =
  | 'mkv'
  | 'mp4'
  | 'mp4-lq'
  | 'webm'
  | 'ogv'
  | 'avi'
  | 'gif'
  | 'gif-lq'
  | 'mp3'
  | 'wav'
  | 'ogg'

/* ========================================================================== */
/* Ajustes                                                                    */
/* ========================================================================== */

export interface AppSettings {
  /** Carpeta de salida por defecto */
  outputDir: string
  /** Número máximo de trabajos simultáneos (1..8) */
  maxConcurrentJobs: number
  /** Usar GPU (Vulkan/CUDA) si está disponible */
  useGpu: boolean
  /** Calidad por defecto en conversiones */
  defaultQuality: 'low' | 'medium' | 'high'
  language: 'es' | 'en'
  theme: 'dark' | 'light' | 'system'
  checkUpdatesOnStartup: boolean
}

/* ========================================================================== */
/* Historial                                                                  */
/* ========================================================================== */

export interface HistoryEntry {
  id: string
  jobType: JobType
  title: string
  inputPath?: string
  outputPath?: string
  outputDir: string
  options: JobOptions
  status: Extract<JobStatus, 'completed' | 'error' | 'cancelled'>
  createdAt: number
  durationMs: number
}

/* ========================================================================== */
/* Logs                                                                       */
/* ========================================================================== */

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: number
  level: LogLevel
  scope: string
  message: string
}

/* ========================================================================== */
/* Binarios y modelos de IA                                                   */
/* ========================================================================== */

export type BinaryName = 'realesrgan' | 'rife' | 'ytdlp'

export interface BinaryStatus {
  name: BinaryName
  installed: boolean
  /** Ruta al ejecutable si está instalado */
  path?: string
  /** SHA-256 registrado en la instalación (verificación de integridad) */
  sha256?: string
  installedAt?: number
}

export interface BinaryDownloadProgress {
  name: BinaryName
  /** 0..100, -1 = tamaño desconocido */
  percent: number
  downloadedBytes: number
  totalBytes: number
  phase: 'downloading' | 'extracting' | 'verifying' | 'done' | 'error'
  error?: string
}

/** Modelo de IA seleccionable para Real-ESRGAN */
export interface AiModel {
  id: string
  label: string
  /** Escalas nativas soportadas por el modelo */
  scales: number[]
  description: string
}

/* ========================================================================== */
/* Información multimedia (ffprobe)                                           */
/* ========================================================================== */

export interface MediaInfo {
  durationSeconds: number
  width: number
  height: number
  fps: number
  videoCodec?: string
  audioCodec?: string
  bitrate?: number
  hasAudio: boolean
  hasSubtitles: boolean
}

/* ========================================================================== */
/* Actualizaciones de la app                                                  */
/* ========================================================================== */

export interface UpdateInfoPayload {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  error?: string
}
