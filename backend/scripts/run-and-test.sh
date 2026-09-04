#!/usr/bin/env bash
# Start the BPMS server, wait for it to be ready, run smoke tests.
# Leaves the server running so you can do the persistence restart test manually.
set -uo pipefail

cd /home/z/my-project/bpms-backend

# Kill any old instance
pkill -f "node dist/main.js" 2>/dev/null || true
sleep 1

# Reset DB to a clean state
echo "Resetting database..."
npx prisma migrate reset --force --skip-generate 2>&1 | tail -3
npx ts-node prisma/seed.ts 2>&1 | tail -3
echo ""

# Start fresh
node dist/main.js > /tmp/bpms.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
for i in $(seq 1 30); do
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Server ready (pid=$SERVER_PID)"
    break
  fi
  sleep 0.5
done

if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "❌ Server failed to start"
  cat /tmp/bpms.log
  kill $SERVER_PID 2>/dev/null || true
  exit 1
fi

# Run the smoke test
bash /home/z/my-project/bpms-backend/scripts/smoke-test.sh
TEST_EXIT=$?

if [[ $TEST_EXIT -ne 0 ]]; then
  kill $SERVER_PID 2>/dev/null || true
  echo "Server stopped (test failed)"
  exit $TEST_EXIT
fi

# Leave server running for manual restart test
echo ""
echo "Server still running (pid=$SERVER_PID). To test persistence:"
echo "  1. Note the Instance C ID and Task C2 ID from the test output above"
echo "  2. Run: kill $SERVER_PID"
echo "  3. Run: cd /home/z/my-project/bpms-backend && node dist/main.js"
echo "  4. Wait for 'Recovered N running instance(s)' in the logs"
echo "  5. Complete Task C2 as jane — instance should COMPLETED"
echo ""
echo "Or run: bash scripts/persistence-test.sh"
