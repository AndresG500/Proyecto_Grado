#!/bin/bash
# =============================================================
# exportar.sh — Exporta la BD local de MongoDB a docker/dump/
# Ejecutar UNA VEZ desde la raíz del proyecto:
#   bash docker/exportar.sh
#
# Requisito: mongodump instalado en tu máquina.
#   Ubuntu/Debian: https://www.mongodb.com/try/download/database-tools
#   macOS:         brew install mongodb/brew/mongodb-database-tools
# =============================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DUMP_DIR="$ROOT_DIR/docker/dump"

# ── 1. Verificar que mongodump está instalado ─────────────────
if ! command -v mongodump &>/dev/null; then
  echo "ERROR: mongodump no está instalado."
  echo "       Instálalo desde: https://www.mongodb.com/try/download/database-tools"
  exit 1
fi

# ── 2. Exportar desde MongoDB local ───────────────────────────
mkdir -p "$DUMP_DIR"
echo "Exportando base de datos UbiLife desde MongoDB local..."
mongodump --host localhost --port 27017 --db UbiLife --out "$DUMP_DIR"

echo ""
echo "Exportación completada. Archivos en: docker/dump/"
echo ""
echo "Próximos pasos:"
echo "  1. Haz commit de docker/dump/ o compártela con tu compañero."
echo "  2. Tu compañero ejecuta:  docker-compose up -d"
echo "  3. Tu compañero ejecuta:  bash docker/restaurar.sh"
