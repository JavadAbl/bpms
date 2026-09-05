#!/usr/bin/env bash
# Build bpms-v2.zip export: frontend/ + backend/ + docs/ + scripts/ + root docs
set -euo pipefail
ROOT=/home/z/my-project
STAGE=$ROOT/.v2stage
OUT=$ROOT/download/bpms-v2.zip

rm -rf "$STAGE"
mkdir -p "$STAGE/frontend" "$STAGE/backend"

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
  package.json nest-cli.json tsconfig.json tsconfig.build.json README.md bun.lock \
  "$STAGE/backend/"

echo "--- docs / scripts / root files ---"
cp -r "$ROOT/docs" "$STAGE/docs"
cp -r "$ROOT/scripts" "$STAGE/scripts"
cp "$ROOT/AGENTS.md" "$ROOT/worklog.md" "$ROOT/README.md" "$STAGE/"

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
echo "=== LEAK CHECK (must be clean) ==="
if unzip -l "$OUT" | grep -E 'node_modules|\.next/|/dist/|/uploads/|\.db$|dev\.log|server\.log|\.git/'; then
  echo "!!! LEAKS FOUND !!!"; exit 1
else
  echo "clean"
fi
