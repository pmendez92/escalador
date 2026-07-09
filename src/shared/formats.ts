/**
 * Catálogo de formatos soportados y modelos de IA disponibles.
 * Usado por la UI (selectores) y por los ejecutores del backend.
 */
import type { AiModel, ImageTargetFormat, VideoTargetFormat } from './types'

/** Extensiones de imagen aceptadas como entrada */
export const IMAGE_INPUT_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'tif', 'avif', 'heic', 'ico'
]

/** Extensiones de vídeo aceptadas como entrada */
export const VIDEO_INPUT_EXTENSIONS = [
  'mp4', 'mkv', 'webm', 'avi', 'mov', 'ogv', 'wmv', 'flv', 'ts', 'm4v', 'mpg', 'mpeg', 'gif', '3gp'
]

export interface FormatDef<T extends string> {
  id: T
  label: string
  /** Extensión real del archivo generado */
  extension: string
}

export const IMAGE_TARGET_FORMATS: FormatDef<ImageTargetFormat>[] = [
  { id: 'png', label: 'PNG', extension: 'png' },
  { id: 'jpg', label: 'JPG', extension: 'jpg' },
  { id: 'jpeg', label: 'JPEG', extension: 'jpeg' },
  { id: 'webp', label: 'WEBP', extension: 'webp' },
  { id: 'gif', label: 'GIF', extension: 'gif' },
  { id: 'gif-lq', label: 'GIF (baja calidad)', extension: 'gif' },
  { id: 'ico', label: 'ICO', extension: 'ico' },
  { id: 'pdf', label: 'PDF', extension: 'pdf' }
]

export const VIDEO_TARGET_FORMATS: FormatDef<VideoTargetFormat>[] = [
  { id: 'mkv', label: 'MKV', extension: 'mkv' },
  { id: 'mp4', label: 'MP4', extension: 'mp4' },
  { id: 'mp4-lq', label: 'MP4 (baja calidad)', extension: 'mp4' },
  { id: 'webm', label: 'WEBM', extension: 'webm' },
  { id: 'ogv', label: 'OGV', extension: 'ogv' },
  { id: 'avi', label: 'AVI', extension: 'avi' },
  { id: 'gif', label: 'GIF', extension: 'gif' },
  { id: 'gif-lq', label: 'GIF (baja calidad)', extension: 'gif' }
]

/** Extracción de audio desde vídeo (comparte ejecutor con la conversión) */
export const AUDIO_TARGET_FORMATS: FormatDef<VideoTargetFormat>[] = [
  { id: 'mp3', label: 'MP3', extension: 'mp3' },
  { id: 'wav', label: 'WAV', extension: 'wav' },
  { id: 'ogg', label: 'OGG', extension: 'ogg' }
]

/**
 * Modelos Real-ESRGAN incluidos en la distribución ncnn-vulkan.
 * `scales` indica las escalas nativas: para 8x se aplican dos pasadas.
 */
export const AI_IMAGE_MODELS: AiModel[] = [
  {
    id: 'realesrgan-x4plus',
    label: 'Real-ESRGAN x4plus (fotografía)',
    scales: [4],
    description: 'Modelo general de máxima calidad para fotografías reales.'
  },
  {
    id: 'realesrgan-x4plus-anime',
    label: 'Real-ESRGAN x4plus Anime',
    scales: [4],
    description: 'Optimizado para ilustración y anime: bordes limpios, menos ruido.'
  },
  {
    id: 'realesr-animevideov3',
    label: 'Real-ESR AnimeVideo v3 (rápido)',
    scales: [2, 3, 4],
    description: 'Modelo ligero pensado para vídeo; el más rápido en CPU.'
  }
]

/** Modelos recomendados para vídeo (el pipeline procesa fotograma a fotograma) */
export const AI_VIDEO_MODELS: AiModel[] = [
  AI_IMAGE_MODELS[2], // animevideov3: el más razonable en tiempo
  AI_IMAGE_MODELS[0],
  AI_IMAGE_MODELS[1]
]

/** Resoluciones objetivo del escalado de vídeo */
export const VIDEO_TARGET_RESOLUTIONS = [
  { id: '1080p', label: '1080p (Full HD)', height: 1080 },
  { id: '2k', label: '2K (1440p)', height: 1440 },
  { id: '4k', label: '4K (2160p)', height: 2160 }
] as const

/** Sitios soportados mostrados en la pantalla de descargas */
export const SUPPORTED_SITES = [
  'YouTube', 'Instagram', 'TikTok', 'Facebook', 'Vimeo', 'X (Twitter)', 'Twitch', 'Dailymotion'
]
