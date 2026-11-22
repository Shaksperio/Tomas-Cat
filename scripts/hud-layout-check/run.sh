#!/bin/bash
# Checa o layout do HUD em tela de celular (384x720). Uso: run.sh [raiz-do-repo] [saida] [rotulo]
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="${1:-$HERE/../..}"; OUT="${2:-${TMPDIR:-/tmp}/hud-layout-check}"; TAG="${3:-depois}"
if [ "$(cd "$ROOT" && pwd)" != "$(cd "$HERE/../.." && pwd)" ]; then mkdir -p "$ROOT/scripts"; cp -r "$HERE" "$ROOT/scripts/"; fi
node "$HERE/build.cjs" "$ROOT" "$OUT"
NODE_PATH=/opt/npm-tools/node_modules:${NODE_PATH:-} node "$HERE/check.cjs" "$OUT" "$TAG"
