# ============================================================================
# setup.ps1 — instalación automática de dependencias (Windows)
#
# Uso:  powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
#
# 1. Comprueba Node.js >= 18.
# 2. Instala las dependencias npm (incluye ffmpeg/ffprobe estáticos y sharp).
# 3. Genera el icono de la app a partir del SVG.
#
# Los motores de IA (Real-ESRGAN, RIFE) y yt-dlp NO se instalan aquí: la app
# los descarga automáticamente la primera vez que se usan, con progreso y
# verificación de integridad.
# ============================================================================

$ErrorActionPreference = 'Stop'

Write-Host '== Escalador · setup ==' -ForegroundColor Cyan

# --- Node.js ---
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host 'ERROR: Node.js no está instalado. Descárgalo de https://nodejs.org (v18 o superior).' -ForegroundColor Red
    exit 1
}
$version = (node --version).TrimStart('v')
if ([int]($version.Split('.')[0]) -lt 18) {
    Write-Host "ERROR: se requiere Node.js >= 18 (tienes $version)." -ForegroundColor Red
    exit 1
}
Write-Host "Node.js $version detectado" -ForegroundColor Green

# --- Dependencias npm ---
Write-Host 'Instalando dependencias npm…'
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# --- Icono de la app ---
Write-Host 'Generando icono…'
npm run icons
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Listo. Arranca la app con:  npm run dev' -ForegroundColor Green
