#!/bin/bash
# Regressão visual da batalha (tela branca). Requer: esbuild, playwright + chromium, three (node_modules/three).
# Uso: scripts/battle-render-check/run.sh   — não roda no CI (depende de navegador); rode antes de mexer em BattleStage/GameEngine.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."; OUT="${TMPDIR:-/tmp}/battle-render-check"
mkdir -p "$OUT"; cp "$HERE/index.html" "$OUT/index.html"
npx esbuild "$HERE/entry.ts" --bundle --format=iife --outfile="$OUT/out.js" --log-level=error \
  --define:import.meta.env='{"VITE_COWILA_AI_URL":"","BASE_URL":"/"}'
node "$HERE/check.cjs" "$OUT"
