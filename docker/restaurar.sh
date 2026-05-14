#!/bin/bash
# =============================================================
# restaurar.sh — Carga el dump de MongoDB en el contenedor Docker
# Ejecutar UNA SOLA VEZ después del primer "docker-compose up -d":
#   bash docker/restaurar.sh
#
# Requisito: Docker corriendo con el contenedor ubilife_mongo activo.
# =============================================================

set -e

CONTENEDOR="ubilife_mongo"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DUMP_DIR="$ROOT_DIR/docker/dump"

# ── 1. Verificar que el contenedor está corriendo ─────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTENEDOR}$"; then
  echo "ERROR: El contenedor '${CONTENEDOR}' no está corriendo."
  echo "       Ejecuta primero:  docker-compose up -d"
  echo "       Espera unos segundos y vuelve a intentarlo."
  exit 1
fi

# ── 2. Verificar que existe el dump ───────────────────────────
if [ ! -d "$DUMP_DIR/UbiLife" ]; then
  echo "ERROR: No se encontró docker/dump/UbiLife/"
  echo "       Pídele a tu compañero que ejecute docker/exportar.sh"
  echo "       y que comparta la carpeta docker/dump/."
  exit 1
fi

# ── 3. Copiar dump al contenedor ──────────────────────────────
echo "Copiando dump al contenedor..."
docker cp "$DUMP_DIR/." "${CONTENEDOR}:/dump"

# ── 4. Restaurar con mongorestore ─────────────────────────────
echo "Restaurando base de datos UbiLife..."
docker exec "${CONTENEDOR}" mongorestore --drop /dump

echo ""
echo "Base de datos restaurada exitosamente."
echo ""
echo "Próximos pasos:"
echo "  - Abre http://localhost:8081 para ver la BD con mongo-express."
echo "  - Copia Backend/.env.docker → Backend/.env y completa las variables."
echo "  - Inicia el backend: cd Backend && source env/bin/activate && uvicorn app:app --reload"
