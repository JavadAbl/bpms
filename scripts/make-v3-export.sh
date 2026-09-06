#!/usr/bin/env bash
# Build bpms-v3.zip export: frontend/ + backend/ + docs/ + scripts/ + root docs
# Same layout as the v2 export (see make-v2-export.sh), plus v3 additions:
#   - docs/v3-changelog.md (+ v2 build history preserved as docs/v2-build-worklog.md)
#   - backend/.env.example (portable env template)
set -euo pipefail
ROOT=/home/z/my-project
STAGE=$ROOT/.v3stage
OUT=$ROOT/download/bpms-v3.zip

rm -rf "$STAGE"
mkdir -p "$STAGE/frontend" "$STAGE/backend" "$STAGE/docs"

echo "--- frontend ---"
rsync -a \
  "$ROOT/src" "$ROOT/public" \
  "$ROOT/package.json" "$ROOT/tsconfig.json" "$ROOT/next.config.ts" \
  "$ROOT/tailwind.config.ts" "$ROOT/postcss.config.mjs" \
  "$ROOT/components.json" "$ROOT/eslint.config.mjs" \
  "$ROOT/next-env.d.ts" "$ROOT/bun.lock" \
  "$STAGE/frontend/"

echo "--- backend ---"
cd "$ROOT/mini-services/bpms-backend"
rsync -a \
  src prisma scripts \
  package.json nest-cli.json tsconfig.json tsconfig.build.json README.md bun.lock .env.example \
  "$STAGE/backend/"

echo "--- docs / scripts / root files ---"
# v2 guides + build history, then v3 changelog on top
cp -r "$ROOT/bpms-v2/docs/." "$STAGE/docs/"
cp "$ROOT/bpms-v2/worklog.md" "$STAGE/docs/v2-build-worklog.md"
rsync -a "$ROOT/docs/" "$STAGE/docs/"
cp -r "$ROOT/scripts" "$STAGE/scripts"
cp "$ROOT/bpms-v2/AGENTS.md" "$ROOT/bpms-v2/README.md" "$ROOT/worklog.md" "$STAGE/"

echo "--- zip ---"
mkdir -p "$ROOT/download"
rm -f "$OUT"
cd "$STAGE"
zip -rq "$OUT" .
cd "$ROOT"
rm -rf "$STAGE"

echo "=== RESULT ==="
ls -lh "$OUT"
unzip -l "$OUT" | tail -1
echo "=== TOP LEVEL ==="
unzip -l "$OUT" | awk '{print $4}' | grep -E '^[^/]+/?$' | sort
echo "=== V3 SPOT CHECKS ==="
# Capture the listing ONCE: piping unzip into grep -q under pipefail races
# (grep exits on match, unzip gets SIGPIPE=141) and flips results nondeterministically.
LISTING=$(unzip -l "$OUT")
for f in \
  frontend/src/components/processes/start-process-dialog.tsx \
  frontend/src/app/ensure-backend/route.ts \
  frontend/src/components/common/material-data-grid.tsx \
  backend/.env.example \
  backend/prisma/schema.prisma \
  scripts/test-task-isolation.mjs \
  docs/v3-changelog.md \
  docs/v2-build-worklog.md \
  worklog.md AGENTS.md README.md; do
  if grep -q " $f\$" <<<"$LISTING"; then echo "ok  $f"; else echo "MISSING  $f"; exit 1; fi
done
echo "=== LEAK CHECK (must be clean) ==="
if grep -E 'node_modules|\.next/|/dist/|/uploads/|\.db$|dev\.log|server\.log|\.git/|\.env$' <<<"$LISTING"; then
  echo "!!! LEAKS FOUND !!!"; exit 1
else
  echo "clean"
fi
