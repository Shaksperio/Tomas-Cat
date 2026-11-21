#!/bin/bash
# Tour visual headless: inventário do mundo (JSON) + capturas por tipo de objeto, loja, habitante e distrito.
# Requer esbuild, playwright + chromium e three. Não roda no CI. Saída: $OUT (padrão /tmp/game-tour).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; OUT="${1:-${TMPDIR:-/tmp}/game-tour}"
mkdir -p "$OUT"; cp "$HERE/index.html" "$OUT/index.html"
ESB="$(command -v esbuild || echo "npx esbuild")"; $ESB "$HERE/entry.ts" --bundle --format=iife --outfile="$OUT/out.js" --log-level=error \
  --define:import.meta.env='{"VITE_COWILA_AI_URL":"","BASE_URL":"/"}'
node "$HERE/tour.cjs" "$OUT"
