# Escalador

Aplicación de escritorio profesional y multiplataforma (Windows, macOS y Linux) para la **conversión y mejora mediante IA de imágenes y vídeos**.

| Módulo | Tecnología |
|---|---|
| Conversión de imágenes | sharp + pdf-lib + png-to-ico |
| Conversión de vídeo / audio | FFmpeg (binario estático incluido) |
| Escalado IA de imágenes | Real-ESRGAN (ncnn-vulkan, GPU o CPU) |
| Mejora IA de vídeo | Real-ESRGAN + RIFE + FFmpeg |
| Descargas | yt-dlp |
| Interfaz | Electron + React + TypeScript + Vite |

---

## 🚀 Puesta en marcha

Requisito único: **Node.js ≥ 18** (https://nodejs.org).

```bash
# 1. Instalación automática de dependencias
#    Windows:
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
#    macOS / Linux:
bash scripts/setup.sh

# 2. Ejecutar en desarrollo (con hot-reload)
npm run dev
```

Eso es todo. FFmpeg y ffprobe se instalan con npm (binarios estáticos); **Real-ESRGAN, RIFE y yt-dlp se descargan automáticamente la primera vez que se usan**, con barra de progreso y verificación de integridad SHA-256 (también se pueden instalar/actualizar desde ⚙ Configuración).

### Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Desarrollo con HMR |
| `npm run typecheck` | Comprobación TypeScript estricta (main + renderer) |
| `npm run build` | Typecheck + build de producción |
| `npm run build:win` | Instalador Windows **.exe** (NSIS) |
| `npm run build:mac` | Imagen macOS **.dmg** (x64 + arm64) |
| `npm run build:linux` | **.AppImage** de Linux |
| `npm run icons` | Regenera `resources/icon.png` desde el SVG |

Los instaladores se generan en `dist/`.

---

## ✨ Funcionalidades

### 🖼 Conversor de imágenes
- Formatos: **PNG, JPG, JPEG, WEBP, GIF, GIF (baja calidad), ICO, PDF**.
- Conversión individual o **por lotes**, con **drag & drop**.
- Carpeta de salida configurable, **conservación de metadatos** (EXIF/ICC/DPI) o eliminación total (privacidad), compresión opcional y progreso por archivo.

### 🎥 Conversor de vídeo
- Contenedores: **MKV, MP4, MP4 (LQ), WEBM, OGV, AVI, GIF, GIF (LQ)**.
- Extracción de audio a **MP3, WAV, OGG**.
- Conserva **FPS, resolución y audio**; **bitrate configurable** (vacío = CRF, calidad constante); **subtítulos** copiados a MKV / mov_text en MP4.
- Lotes, drag & drop, barra de progreso y **cancelación**.

### ✨ Escalado IA de imágenes
- Real-ESRGAN con escalas **2x, 4x y 8x** (8x = doble pasada).
- Modelos seleccionables: x4plus (foto), x4plus-anime, animevideov3.
- Reduce ruido, mejora nitidez y **mantiene el DPI original**.
- **GPU** vía Vulkan (NVIDIA/AMD/Intel — en NVIDIA usa los mismos núcleos que CUDA) o **CPU** si se desactiva en Ajustes.
- Comparador **antes/después con slider** al completar cada escalado.
- Alternativa PyTorch/CUDA pura en [`python/realesrgan_upscale.py`](python/realesrgan_upscale.py).

### 🎬 Mejora IA de vídeo
- Resoluciones objetivo: **1080p, 2K, 4K**.
- Pipeline: extracción de fotogramas → Real-ESRGAN → RIFE (opcional, duplica FPS) → recodificación con el **audio original** (sincronización garantizada) y **FPS originales**.
- Bitrate configurable y **tiempo restante estimado** en vivo.

### ⬇ Descargas (yt-dlp)
- YouTube, Instagram, TikTok, Facebook, Vimeo, X (Twitter), Twitch, Dailymotion y cientos más.
- Resolución y formato a elegir, **miniatura**, **subtítulos**, **playlists** y carpeta de salida.
- **Solo audio**: MP3/WAV/OGG con bitrate, nombre de archivo personalizado y **portada embebida**.

### ⚙ Configuración
Carpeta por defecto · procesos simultáneos (1-8) · GPU/CPU · calidad por defecto · idioma (ES/EN) · tema (oscuro/claro/sistema) · comprobación de actualizaciones · menú contextual de Windows · gestión de motores IA.

### Extras incluidos
- **Historial** persistente (reabrir carpeta, repetir proceso, eliminar).
- **Visor de logs** con exportación a archivo.
- **Auto-update** (electron-updater + GitHub Releases).
- **Clic derecho en el Explorador de Windows** («Convertir con Escalador»): actívalo en Configuración; no requiere permisos de administrador (HKCU).
- **Compresión** de imágenes y vídeo, **eliminación de metadatos**.
- **Sistema de plugins**: carpeta `plugins/example-plugin` como plantilla; se cargan desde `<userData>/plugins/`.

---

## 🏗 Arquitectura

```
ESCALADOR/
├── src/
│   ├── shared/                 # Contratos compartidos main ⇆ renderer
│   │   ├── types.ts            #   Tipos del dominio (Job, Settings, …)
│   │   ├── ipc.ts              #   Nombres de canales IPC centralizados
│   │   └── formats.ts          #   Catálogo de formatos y modelos IA
│   │
│   ├── main/                   # Backend (proceso principal, Node.js)
│   │   ├── index.ts            #   Bootstrap + instancia única + argv
│   │   ├── window.ts           #   Ventana (seguridad: contextIsolation)
│   │   ├── ipc/registerIpc.ts  #   "Controladores": IPC → servicios
│   │   ├── services/           #   Lógica de negocio
│   │   │   ├── container.ts    #     Inyección de dependencias explícita
│   │   │   ├── QueueService.ts #     Cola con concurrencia y cancelación
│   │   │   ├── FFmpegService.ts#     ffmpeg/ffprobe con progreso
│   │   │   ├── BinaryManager.ts#     Descarga+verificación de motores IA
│   │   │   ├── SettingsService / HistoryService / LoggerService
│   │   │   ├── UpdateService / PluginManager / ContextMenuWindows
│   │   └── executors/          #   Estrategias por tipo de trabajo (SOLID)
│   │       ├── ImageConvertExecutor.ts
│   │       ├── VideoConvertExecutor.ts
│   │       ├── ImageUpscaleExecutor.ts
│   │       ├── VideoUpscaleExecutor.ts
│   │       └── DownloadExecutor.ts
│   │
│   ├── preload/                # Puente seguro (contextBridge tipado)
│   └── renderer/src/           # Frontend React
│       ├── pages/              #   Una página por módulo
│       ├── components/         #   Sidebar, DropZone, cola, comparador…
│       ├── hooks/              #   useSettings, useI18n, useJobs
│       ├── utils/              #   Formato de fechas/ETAs
│       ├── locales/            #   es.json / en.json
│       └── styles/global.css   #   Design system (temas claro/oscuro)
│
├── python/                     # IA opcional vía PyTorch/CUDA
├── plugins/                    # Plugin de ejemplo (plantilla)
├── scripts/                    # setup.ps1 / setup.sh / generate-icons
├── resources/                  # Icono de la app
├── electron.vite.config.ts     # Build de main/preload/renderer
└── electron-builder.yml        # Instaladores + auto-update
```

### Principios aplicados
- **Strategy + Open/Closed**: la cola (`QueueService`) solo conoce la interfaz `JobExecutor`; cada funcionalidad es un ejecutor registrado en `container.ts`. Añadir una función nueva = un ejecutor nuevo (o un plugin).
- **Dependency Injection** explícita en `container.ts`: sin singletons ocultos, fácil de testear.
- **Single Responsibility**: logging, ajustes, historial, binarios y cola viven en servicios independientes.
- **DRY**: formatos, tipos y canales IPC definidos una sola vez en `src/shared/` y consumidos por ambos procesos.
- **Rendimiento**: todo trabajo pesado corre en procesos hijos (ffmpeg, realesrgan, yt-dlp); la UI nunca se bloquea. Concurrencia configurable con cola FIFO.
- **Seguridad**: `contextIsolation` + API mínima tipada por `contextBridge`; CSP estricta; enlaces externos solo por el navegador.

---

## 📦 Distribución y auto-update

1. Ajusta `owner/repo` en `electron-builder.yml` (sección `publish`) y en `package.json`.
2. `npm run build:win` / `build:mac` / `build:linux` — o `build:all`.
3. Publica los artefactos en GitHub Releases (`npx electron-builder --publish always` con `GH_TOKEN`).
4. Las instalaciones existentes detectan la release nueva al arrancar (o con «Comprobar ahora» en Configuración), la descargan en segundo plano y se instalan al reiniciar.

> **macOS**: para distribuir fuera de tu máquina necesitas firmar/notarizar la app (variables `CSC_LINK`/`CSC_KEY_PASSWORD` + notarización). Sin firma, la app funciona localmente con clic derecho → Abrir.

### Instalar el .dmg sin firmar en macOS

El `.dmg` generado por CI no está firmado con un certificado de Apple Developer (99 $/año) ni notarizado, así que Gatekeeper lo bloquea con *"Apple no ha podido verificar que no contiene malware"*. Cada persona que lo instale debe hacer **una sola vez**:

**A) Desde Ajustes del Sistema (sin Terminal):**
1. Intentar abrir la app (doble clic) → aparece el aviso de bloqueo.
2. **Ajustes del Sistema → Privacidad y seguridad** → bajar hasta "Seguridad".
3. Pulsar **Abrir de todas formas** junto al mensaje sobre Escalador, confirmar con contraseña/Touch ID.
4. Volver a abrir la app (doble clic) → ahora aparece un diálogo con botón **Abrir**.

**B) Con Terminal (un solo comando, más fiable):**
```bash
xattr -cr /Applications/Escalador.app
```
Elimina el atributo de cuarentena que macOS añade a los archivos descargados de internet; tras esto abre sin avisos.

Para eliminar este paso por completo hace falta firmar y notarizar el build (cuenta de Apple Developer + `CSC_LINK`/`CSC_KEY_PASSWORD` como secrets del repo, y el hook `afterSign` de electron-builder con `@electron/notarize` en el workflow de CI).

---

## 🧩 Crear un plugin

```js
// <userData>/plugins/mi-plugin/plugin.json
{ "id": "mi-plugin", "name": "Mi plugin", "version": "1.0.0", "main": "index.js" }

// <userData>/plugins/mi-plugin/index.js
module.exports.activate = (context) => {
  context.log('hola')
  context.registerExecutor({
    type: 'mi-trabajo',
    async execute(job, ctx) {
      ctx.reportProgress({ percent: 50, phase: 'Trabajando…' })
      return { outputPath: job.outputDir }
    }
  })
}
```

Copia la carpeta, reinicia la app y el ejecutor queda disponible en la cola. La plantilla completa está en [`plugins/example-plugin`](plugins/example-plugin).

---

## ❓ Solución de problemas

| Problema | Solución |
|---|---|
| `sharp` falla al instalar | Requiere conexión a internet la primera vez (descarga binarios). Reintenta `npm install`. |
| El escalado IA es muy lento | Activa **GPU** en Configuración. Sin GPU Vulkan, Real-ESRGAN usa CPU (mucho más lento, especialmente en vídeo). |
| yt-dlp falla con un sitio | Usa **Actualizar** en Configuración → Motores: los sitios cambian y yt-dlp publica arreglos casi a diario. |
| Antivirus bloquea la descarga de binarios | Los motores se descargan de GitHub Releases oficiales (xinntao/Real-ESRGAN, nihui/rife-ncnn-vulkan, yt-dlp/yt-dlp) y se verifican por SHA-256. |

## Licencia

MIT © 2026 Pedro Méndez
