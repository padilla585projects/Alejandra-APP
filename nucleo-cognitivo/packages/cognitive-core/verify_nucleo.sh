#!/usr/bin/env bash
# verify_nucleo.sh — valida que todos los módulos de src/* (salvo index.js) se exponen desde src/index.js
set -euo pipefail

PAQUETE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$PAQUETE_DIR/src"
INDEX="$SRC_DIR/index.js"

if [ ! -f "$INDEX" ]; then
  echo "ERROR: no se encuentra src/index.js en $INDEX"
  exit 1
fi

ERRORES=0

for modulo in "$SRC_DIR"/*.js; do
  nombre="$(basename "$modulo" .js)"
  if [ "$nombre" = "index" ]; then
    continue
  fi
  if grep -q "$nombre" "$INDEX"; then
    echo "OK  módulo expuesto: $nombre"
  else
    echo "FALLO módulo NO expuesto: $nombre"
    ERRORES=$((ERRORES + 1))
  fi
done

if [ "$ERRORES" -gt 0 ]; then
  echo "verify_nucleo: $ERRORES módulo(s) no expuestos"
  exit 1
fi

echo "verify_nucleo: todos los módulos de src/ quedan expuestos por src/index.js"