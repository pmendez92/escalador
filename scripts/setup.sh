#!/usr/bin/env bash
# ============================================================================
# setup.sh — instalación automática de dependencias (macOS / Linux)
#
# Uso:  bash scripts/setup.sh
#
# 1. Comprueba Node.js >= 18.
# 2. Instala las dependencias npm (incluye ffmpeg/ffprobe estáticos y sharp).
# 3. Genera el icono de la app a partir del SVG.
#
# Los motores de IA (Real-ESRGAN, RIFE) y yt-dlp NO se instalan aquí: la app
# los descarga automáticamente la primera vez que se usan, con progreso y
# verificación de integridad.
# ============================================================================
set -euo pipefail

echo '== Escalador · setup =='

if ! command -v node >/dev/null 2>&1; then
  echo 'ERROR: Node.js no está instalado. Instálalo desde https://nodejs.org (v18+).' >&2
  exit 1
fi

MAJOR=$(node --version | sed 's/^v//' | cut -d. -f1)
if [ "$MAJOR" -lt 18 ]; then
  echo "ERROR: se requiere Node.js >= 18 (tienes $(node --version))." >&2
  exit 1
fi
echo "Node.js $(node --version) detectado"

echo 'Instalando dependencias npm…'
npm install

echo 'Generando icono…'
npm run icons

echo
echo 'Listo. Arranca la app con:  npm run dev'
