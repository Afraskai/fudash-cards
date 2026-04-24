#!/usr/bin/env bash
# Konkateniert die src/-Dateien in eine einzelne dist/fudash-cards.js.
# Kein Minifier, kein Bundler - das Ergebnis bleibt lesbar und ist direkt
# in /config/www/ von Home Assistant kopierbar.

set -euo pipefail
cd "$(dirname "$0")"

mkdir -p dist

FILES=(
  src/shared/utils.js
  src/shared/theme.js
  src/shared/base-card.js
  src/shared/action-handler.js
  src/shared/sparkline.js
  src/shared/history.js
  src/bar-card/fudash-bar-card.js
  src/bar-card/fudash-bar-card-editor.js
  src/gauge-card/fudash-gauge-card.js
  src/gauge-card/fudash-gauge-card-editor.js
  src/donut-card/fudash-donut-card.js
  src/donut-card/fudash-donut-card-editor.js
  src/stat-card/fudash-stat-card.js
  src/stat-card/fudash-stat-card-editor.js
  src/fudash-cards.js
)

OUT=dist/fudash-cards.js

{
  echo "/*! fudash-cards - Home Assistant Custom Cards"
  echo " *  License: MIT"
  echo " *  Built: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo " *  Source: https://github.com/ (siehe README)"
  echo " */"
  echo "(function () {"
  echo "'use strict';"
  for f in "${FILES[@]}"; do
    echo ""
    echo "// ===== $f ====="
    cat "$f"
  done
  echo "})();"
} > "$OUT"

echo "Built $OUT ($(wc -c < "$OUT") bytes)"
