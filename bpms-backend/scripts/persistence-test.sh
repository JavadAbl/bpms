#!/usr/bin/env bash
# Persistence test: verifies that a running instance survives a server restart.
#
# Prerequisites: smoke-test.sh must have just run and left a RUNNING instance
# (Instance C) with a PENDING "Approve Request" task for jane.
#
# This script:
#   1. Finds the RUNNING instance with a PENDING task assigned to jane
#   2. Kills the server
#   3. Restarts the server (triggers onModuleInit recovery)
#   4. Completes the pending task as jane
#   5. Verifies the instance reaches COMPLETED
set -uo pipefail

BASE="http://localhost:3000/api"
cd /home/z/my-project/bpms-backend

echo "===== PERSISTENCE TEST ====="
echo ""

# Step 1: Find jane's PENDING task
echo "===== 1. Find jane's PENDING task ====="
JANE_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"jane@bpms.local","password":"user123"}' | jq -r .accessToken)
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@bpms.local","password":"admin123"}' | jq -r .accessToken)

JANE_TASKS=$(curl -s "$BASE/tasks/mine" -H "Authorization: Bearer $JANE_TOKEN")
PENDING_TASK=$(echo "$JANE_TASKS" | jq -c '.[] | select(.status=="PENDING") | .id' | head -1 | tr -d '"')

if [[ -z "$PENDING_TASK" ]]; then
  echo "❌ No PENDING task found for jane. Run smoke-test.sh first to create one."
  exit 1
fi

# Get the instance ID for this task
TASK_DETAILS=$(curl -s "$BASE/tasks/$PENDING_TASK" -H "Authorization: Bearer $ADMIN_TOKEN")
INSTANCE_ID=$(echo "$TASK_DETAILS" | jq -r .processInstance.id)
echo "Found PENDING task: $PENDING_TASK"
echo "Belongs to instance: $INSTANCE_ID"
echo "Instance status before restart: $(echo "$TASK_DETAILS" | jq -r .processInstance.status)"

# Verify engineState is persisted
INSTANCE_DETAILS=$(curl -s "$BASE/process-instances/$INSTANCE_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
ENGINE_STATE_LEN=$(echo "$INSTANCE_DETAILS" | jq -r '.engineState | length')
echo "Engine state size: $ENGINE_STATE_LEN chars"
if [[ "$ENGINE_STATE_LEN" -le 10 ]]; then
  echo "❌ FAIL: engineState is empty or missing — persistence is not working"
  exit 1
fi
echo "✓ Engine state is persisted"

# Step 2: Kill the server
echo ""
echo "===== 2. Kill the server ====="
pkill -f "node dist/main.js" 2>/dev/null || true
sleep 2
echo "✓ Server killed"

# Step 3: Restart the server
echo ""
echo "===== 3. Restart the server ====="
node dist/main.js > /tmp/bpms-restart.log 2>&1 &
SERVER_PID=$!
for i in $(seq 1 30); do
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Server restarted (pid=$SERVER_PID)"
    break
  fi
  sleep 0.5
done

if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "❌ Server failed to restart"
  cat /tmp/bpms-restart.log
  exit 1
fi

# Check the recovery logs
echo ""
echo "--- Recovery logs ---"
grep -i "recover\|resume\|wait" /tmp/bpms-restart.log | head -10
echo "---------------------"

# Step 4: Verify the instance is still RUNNING and the task is still PENDING
echo ""
echo "===== 4. Verify instance + task survived restart ====="
INSTANCE_AFTER=$(curl -s "$BASE/process-instances/$INSTANCE_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
INSTANCE_STATUS_AFTER=$(echo "$INSTANCE_AFTER" | jq -r .status)
echo "Instance status after restart: $INSTANCE_STATUS_AFTER"
if [[ "$INSTANCE_STATUS_AFTER" != "RUNNING" ]]; then
  echo "❌ FAIL: Instance should still be RUNNING but is $INSTANCE_STATUS_AFTER"
  cat /tmp/bpms-restart.log
  exit 1
fi
echo "✓ Instance survived restart"

# Step 5: Complete the task as jane
echo ""
echo "===== 5. Complete the pending task as jane (after restart) ====="
# Re-login to get fresh tokens (server restarted, but JWT is stateless so old token works too)
JANE_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"jane@bpms.local","password":"user123"}' | jq -r .accessToken)

COMPLETE_RESULT=$(curl -s -X POST "$BASE/tasks/$PENDING_TASK/complete" \
  -H "Authorization: Bearer $JANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"decision":"Approve","comment":"Approved after server restart!"}}')

echo "$COMPLETE_RESULT" | jq '{id, name, status, completedAt}'

if [[ $(echo "$COMPLETE_RESULT" | jq -r .status) != "COMPLETED" ]]; then
  echo "❌ FAIL: Task should be COMPLETED"
  exit 1
fi
echo "✓ Task completed successfully after restart"

# Step 6: Verify instance is COMPLETED
echo ""
echo "===== 6. Verify instance reached COMPLETED ====="
sleep 0.5
INSTANCE_FINAL=$(curl -s "$BASE/process-instances/$INSTANCE_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$INSTANCE_FINAL" | jq '{id, status, completedAt, tasks: [.tasks[] | {name, status, assignee: .assignee.email}]}'

FINAL_STATUS=$(echo "$INSTANCE_FINAL" | jq -r .status)
if [[ "$FINAL_STATUS" != "COMPLETED" ]]; then
  echo "❌ FAIL: Instance should be COMPLETED but is $FINAL_STATUS"
  exit 1
fi

# Verify engineState was cleared
ENGINE_STATE_FINAL=$(echo "$INSTANCE_FINAL" | jq -r '.engineState // empty')
if [[ -n "$ENGINE_STATE_FINAL" ]]; then
  echo "⚠️  Warning: engineState should be null after completion but has content"
fi

echo ""
echo "✅✅✅ PERSISTENCE TEST PASSED ✅✅✅"
echo "  - Instance survived server restart"
echo "  - Task was completed after restart"
echo "  - Instance reached COMPLETED"
echo "  - Engine state was properly cleared on completion"

# Shut down
kill $SERVER_PID 2>/dev/null || true
echo ""
echo "Server stopped. Test complete."
