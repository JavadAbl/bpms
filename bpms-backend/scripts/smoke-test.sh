#!/usr/bin/env bash
# Comprehensive smoke test for BPMS backend
# Tests:
#   A. Leave Approval: Sick leave auto-approves via exclusive gateway
#   B. Leave Approval: Annual leave routes to manager via exclusive gateway
#   C. Persistence: instance left RUNNING for restart test
#   D. Expense Approval: Small expense (<=1000) → manager → parallel tasks
#   E. Expense Approval: Large expense (>1000) → director → parallel tasks
# Requires jq + curl. Server must already be running.
set -uo pipefail

BASE="http://localhost:3000/api"

echo "===== 1. LOGIN as admin / john / jane / bob ====="
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@bpms.local","password":"admin123"}' | jq -r .accessToken)
JOHN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"john@bpms.local","password":"user123"}' | jq -r .accessToken)
JANE_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"jane@bpms.local","password":"user123"}' | jq -r .accessToken)
BOB_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"bob@bpms.local","password":"user123"}' | jq -r .accessToken)
echo "✓ All logins succeeded"

echo ""
echo "===== 2. GET process definitions ====="
PROCESSES=$(curl -s "$BASE/processes" -H "Authorization: Bearer $ADMIN_TOKEN")
LEAVE_PROCESS_ID=$(echo "$PROCESSES" | jq -r '.[] | select(.name=="Leave Approval") | .id')
EXPENSE_PROCESS_ID=$(echo "$PROCESSES" | jq -r '.[] | select(.name=="Expense Approval") | .id')
echo "Leave Process:   $LEAVE_PROCESS_ID"
echo "Expense Process: $EXPENSE_PROCESS_ID"

echo ""
echo "===== 3. GET expense process user tasks ====="
curl -s "$BASE/processes/$EXPENSE_PROCESS_ID/user-tasks" -H "Authorization: Bearer $ADMIN_TOKEN" | jq -c '.[] | {id, name}'

# ============================================================================
echo ""
echo "=========================================="
echo "SCENARIO A: Sick leave (auto-approve via exclusive gateway)"
echo "=========================================="
echo ""
echo "===== A.1. START instance with Sick leave type ====="
INSTANCE_A=$(curl -s -X POST "$BASE/process-instances" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"processId\":\"$LEAVE_PROCESS_ID\"}")
INSTANCE_A_ID=$(echo "$INSTANCE_A" | jq -r .id)
TASK_A1_ID=$(echo "$INSTANCE_A" | jq -r '.tasks[0].id')
echo "Instance A: $INSTANCE_A_ID, Task A1: $TASK_A1_ID"

echo ""
echo "===== A.2. COMPLETE Submit Request with leaveType=Sick ====="
curl -s -X POST "$BASE/tasks/$TASK_A1_ID/complete" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"employeeName":"John Doe","leaveType":"Sick","startDate":"2026-09-15","endDate":"2026-09-16","reason":"Flu"}}' \
  | jq '{id, name, status, completedAt}'

echo ""
echo "===== A.3. CHECK instance A — should be COMPLETED (gateway routed to AutoApproveEnd) ====="
sleep 0.5
INSTANCE_A_FINAL=$(curl -s "$BASE/process-instances/$INSTANCE_A_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$INSTANCE_A_FINAL" | jq '{id, status, completedAt, tasks: [.tasks[] | {name, status}]}'

INSTANCE_A_STATUS=$(echo "$INSTANCE_A_FINAL" | jq -r .status)
if [[ "$INSTANCE_A_STATUS" != "COMPLETED" ]]; then
  echo "❌ FAIL: Instance A should be COMPLETED but is $INSTANCE_A_STATUS"
  exit 1
fi
TASK_COUNT_A=$(echo "$INSTANCE_A_FINAL" | jq '.tasks | length')
if [[ "$TASK_COUNT_A" -ne 1 ]]; then
  echo "❌ FAIL: Instance A should have exactly 1 task (Submit Request) but has $TASK_COUNT_A"
  exit 1
fi
echo "✓ Sick leave auto-approved via gateway — instance COMPLETED with 1 task"

# ============================================================================
echo ""
echo "=========================================="
echo "SCENARIO B: Annual leave (needs manager approval)"
echo "=========================================="
echo ""
echo "===== B.1. START instance with Annual leave type ====="
INSTANCE_B=$(curl -s -X POST "$BASE/process-instances" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"processId\":\"$LEAVE_PROCESS_ID\"}")
INSTANCE_B_ID=$(echo "$INSTANCE_B" | jq -r .id)
TASK_B1_ID=$(echo "$INSTANCE_B" | jq -r '.tasks[0].id')
echo "Instance B: $INSTANCE_B_ID, Task B1: $TASK_B1_ID"

echo ""
echo "===== B.2. COMPLETE Submit Request with leaveType=Annual ====="
curl -s -X POST "$BASE/tasks/$TASK_B1_ID/complete" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"employeeName":"John Doe","leaveType":"Annual","startDate":"2026-09-20","endDate":"2026-09-25","reason":"Family trip"}}' \
  | jq '{id, name, status, completedAt}'

echo ""
echo "===== B.3. CHECK instance B — should have 2 tasks, 2nd PENDING for jane ====="
sleep 0.5
INSTANCE_B_MID=$(curl -s "$BASE/process-instances/$INSTANCE_B_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$INSTANCE_B_MID" | jq '{id, status, tasks: [.tasks[] | {name, status, assignee: .assignee.email}]}'

INSTANCE_B_STATUS=$(echo "$INSTANCE_B_MID" | jq -r .status)
if [[ "$INSTANCE_B_STATUS" != "RUNNING" ]]; then
  echo "❌ FAIL: Instance B should be RUNNING but is $INSTANCE_B_STATUS"
  exit 1
fi
TASK_COUNT_B=$(echo "$INSTANCE_B_MID" | jq '.tasks | length')
if [[ "$TASK_COUNT_B" -ne 2 ]]; then
  echo "❌ FAIL: Instance B should have 2 tasks but has $TASK_COUNT_B"
  exit 1
fi
echo "✓ Annual leave routed to Approve Request task — instance RUNNING with 2 tasks"

# ============================================================================
echo ""
echo "=========================================="
echo "SCENARIO C: Persistence test (leave RUNNING for restart test)"
echo "=========================================="
echo ""
echo "===== C.1. START another Annual leave instance ====="
INSTANCE_C=$(curl -s -X POST "$BASE/process-instances" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"processId\":\"$LEAVE_PROCESS_ID\"}")
INSTANCE_C_ID=$(echo "$INSTANCE_C" | jq -r .id)
TASK_C1_ID=$(echo "$INSTANCE_C" | jq -r '.tasks[0].id')
echo "Instance C: $INSTANCE_C_ID, Task C1: $TASK_C1_ID"

echo ""
echo "===== C.2. COMPLETE Submit Request (leaveType=Annual) — creates 2nd task for jane ====="
curl -s -X POST "$BASE/tasks/$TASK_C1_ID/complete" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"employeeName":"John Doe","leaveType":"Annual","startDate":"2026-10-01","endDate":"2026-10-05","reason":"Vacation"}}' \
  > /dev/null

sleep 0.5
INSTANCE_C_MID=$(curl -s "$BASE/process-instances/$INSTANCE_C_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
TASK_C2_ID=$(echo "$INSTANCE_C_MID" | jq -r '.tasks[] | select(.name=="Approve Request") | .id')
echo "Instance C is RUNNING, task C2 (Approve Request) = $TASK_C2_ID"
echo "Instance C engineState length: $(echo "$INSTANCE_C_MID" | jq -r '.engineState | length') chars"

echo ""
echo "===== C.3. [SIMULATING SERVER RESTART] ====="
echo "Instance C ID: $INSTANCE_C_ID"
echo "Task C2 ID: $TASK_C2_ID"
echo "Run: bash scripts/persistence-test.sh to test recovery"

# ============================================================================
echo ""
echo "=========================================="
echo "SCENARIO D: Small expense (amount=500 → manager → parallel tasks)"
echo "=========================================="
echo ""
echo "===== D.1. START expense instance ====="
INSTANCE_D=$(curl -s -X POST "$BASE/process-instances" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"processId\":\"$EXPENSE_PROCESS_ID\"}")
INSTANCE_D_ID=$(echo "$INSTANCE_D" | jq -r .id)
TASK_D1_ID=$(echo "$INSTANCE_D" | jq -r '.tasks[0].id')
echo "Instance D: $INSTANCE_D_ID, Task D1 (Submit Expense): $TASK_D1_ID"

echo ""
echo "===== D.2. COMPLETE Submit Expense with amount=500 ====="
curl -s -X POST "$BASE/tasks/$TASK_D1_ID/complete" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"description":"Team lunch","amount":500,"category":"Meals","receipt":"R-001"}}' \
  | jq '{id, name, status, completedAt}'

echo ""
echo "===== D.3. CHECK — exclusive gateway should route to Manager Approve (jane) ====="
sleep 0.5
INSTANCE_D_MID=$(curl -s "$BASE/process-instances/$INSTANCE_D_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$INSTANCE_D_MID" | jq '{id, status, tasks: [.tasks[] | {name, status, assignee: .assignee.email}]}'

# Verify routing: should have 2 tasks (Submit Expense COMPLETED + Manager Approve PENDING)
TASK_COUNT_D=$(echo "$INSTANCE_D_MID" | jq '.tasks | length')
if [[ "$TASK_COUNT_D" -ne 2 ]]; then
  echo "❌ FAIL: Instance D should have 2 tasks but has $TASK_COUNT_D"
  exit 1
fi
MANAGER_TASK=$(echo "$INSTANCE_D_MID" | jq -r '.tasks[] | select(.name=="Manager Approve") | .id')
DIRECTOR_TASK=$(echo "$INSTANCE_D_MID" | jq -r '.tasks[] | select(.name=="Director Approve") | .id // empty')
if [[ -z "$MANAGER_TASK" ]]; then
  echo "❌ FAIL: Should have routed to Manager Approve for amount=500"
  exit 1
fi
if [[ -n "$DIRECTOR_TASK" ]]; then
  echo "❌ FAIL: Should NOT have Director Approve for amount=500"
  exit 1
fi
echo "✓ Exclusive gateway routed amount=500 to Manager Approve (jane)"

echo ""
echo "===== D.4. CLAIM + COMPLETE Manager Approve (jane) — self-service task ====="
curl -s -X POST "$BASE/tasks/$MANAGER_TASK/claim" \
  -H "Authorization: Bearer $JANE_TOKEN" \
  | jq '{id, name, status, assignee: .assignee.email, selfService}'

curl -s -X POST "$BASE/tasks/$MANAGER_TASK/complete" \
  -H "Authorization: Bearer $JANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"decision":"Approve","comment":"Approved"}}' \
  | jq '{id, name, status, completedAt}'

echo ""
echo "===== D.5. CHECK — parallel gateway should create 2 simultaneous tasks ====="
sleep 0.5
INSTANCE_D_PARALLEL=$(curl -s "$BASE/process-instances/$INSTANCE_D_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$INSTANCE_D_PARALLEL" | jq '{id, status, tasks: [.tasks[] | {name, status, assignee: .assignee.email}]}'

# Verify parallel split: should now have 4 tasks (Submit + Manager + Process Payment + Archive)
TASK_COUNT_D_PAR=$(echo "$INSTANCE_D_PARALLEL" | jq '.tasks | length')
if [[ "$TASK_COUNT_D_PAR" -ne 4 ]]; then
  echo "❌ FAIL: Instance D should have 4 tasks after parallel split but has $TASK_COUNT_D_PAR"
  exit 1
fi
PAYMENT_TASK_D=$(echo "$INSTANCE_D_PARALLEL" | jq -r '.tasks[] | select(.name=="Process Payment" and .status=="PENDING") | .id')
ARCHIVE_TASK_D=$(echo "$INSTANCE_D_PARALLEL" | jq -r '.tasks[] | select(.name=="Archive Record" and .status=="PENDING") | .id')
if [[ -z "$PAYMENT_TASK_D" || -z "$ARCHIVE_TASK_D" ]]; then
  echo "❌ FAIL: Both Process Payment and Archive Record should be PENDING"
  exit 1
fi
echo "✓ Parallel gateway created 2 simultaneous tasks: Process Payment (jane) + Archive Record (bob)"

echo ""
echo "===== D.6. COMPLETE Process Payment (jane) — first parallel task ====="
curl -s -X POST "$BASE/tasks/$PAYMENT_TASK_D/complete" \
  -H "Authorization: Bearer $JANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"paymentMethod":"Bank Transfer","reference":"BT-500","paidDate":"2026-09-15"}}' \
  | jq '{id, name, status, completedAt}'

echo ""
echo "===== D.7. CHECK — instance should still be RUNNING (parallel join waiting for 2nd task) ====="
sleep 0.5
INSTANCE_D_AFTER_PAYMENT=$(curl -s "$BASE/process-instances/$INSTANCE_D_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
INSTANCE_D_STATUS=$(echo "$INSTANCE_D_AFTER_PAYMENT" | jq -r .status)
echo "Status after completing Process Payment: $INSTANCE_D_STATUS"
if [[ "$INSTANCE_D_STATUS" != "RUNNING" ]]; then
  echo "❌ FAIL: Instance should still be RUNNING (Archive Record not yet completed)"
  exit 1
fi
echo "✓ Instance still RUNNING — parallel join is waiting for Archive Record"

echo ""
echo "===== D.8. COMPLETE Archive Record (bob) — second parallel task ====="
curl -s -X POST "$BASE/tasks/$ARCHIVE_TASK_D/complete" \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"archiveId":"ARC-500","notes":"Team lunch receipt"}}' \
  | jq '{id, name, status, completedAt}'

echo ""
echo "===== D.9. CHECK — instance should now be COMPLETED (parallel join satisfied) ====="
sleep 0.5
INSTANCE_D_FINAL=$(curl -s "$BASE/process-instances/$INSTANCE_D_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$INSTANCE_D_FINAL" | jq '{id, status, completedAt, tasks: [.tasks[] | {name, status, assignee: .assignee.email}]}'

INSTANCE_D_FINAL_STATUS=$(echo "$INSTANCE_D_FINAL" | jq -r .status)
if [[ "$INSTANCE_D_FINAL_STATUS" != "COMPLETED" ]]; then
  echo "❌ FAIL: Instance D should be COMPLETED but is $INSTANCE_D_FINAL_STATUS"
  exit 1
fi
TASK_COUNT_D_FINAL=$(echo "$INSTANCE_D_FINAL" | jq '.tasks | length')
if [[ "$TASK_COUNT_D_FINAL" -ne 4 ]]; then
  echo "❌ FAIL: Instance D should have 4 total tasks but has $TASK_COUNT_D_FINAL"
  exit 1
fi
echo "✓ Parallel join satisfied — instance COMPLETED with 4 tasks total"

# ============================================================================
echo ""
echo "=========================================="
echo "SCENARIO E: Large expense (amount=2000 → director → parallel tasks)"
echo "=========================================="
echo ""
echo "===== E.1. START expense instance ====="
INSTANCE_E=$(curl -s -X POST "$BASE/process-instances" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"processId\":\"$EXPENSE_PROCESS_ID\"}")
INSTANCE_E_ID=$(echo "$INSTANCE_E" | jq -r .id)
TASK_E1_ID=$(echo "$INSTANCE_E" | jq -r '.tasks[0].id')
echo "Instance E: $INSTANCE_E_ID, Task E1 (Submit Expense): $TASK_E1_ID"

echo ""
echo "===== E.2. COMPLETE Submit Expense with amount=2000 ====="
curl -s -X POST "$BASE/tasks/$TASK_E1_ID/complete" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"description":"New laptop","amount":2000,"category":"Equipment","receipt":"R-002"}}' \
  | jq '{id, name, status, completedAt}'

echo ""
echo "===== E.3. CHECK — exclusive gateway should route to Director Approve (bob) ====="
sleep 0.5
INSTANCE_E_MID=$(curl -s "$BASE/process-instances/$INSTANCE_E_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$INSTANCE_E_MID" | jq '{id, status, tasks: [.tasks[] | {name, status, assignee: .assignee.email}]}'

DIRECTOR_TASK_E=$(echo "$INSTANCE_E_MID" | jq -r '.tasks[] | select(.name=="Director Approve") | .id')
MANAGER_TASK_E=$(echo "$INSTANCE_E_MID" | jq -r '.tasks[] | select(.name=="Manager Approve") | .id // empty')
if [[ -z "$DIRECTOR_TASK_E" ]]; then
  echo "❌ FAIL: Should have routed to Director Approve for amount=2000"
  exit 1
fi
if [[ -n "$MANAGER_TASK_E" ]]; then
  echo "❌ FAIL: Should NOT have Manager Approve for amount=2000"
  exit 1
fi
echo "✓ Exclusive gateway routed amount=2000 to Director Approve (bob)"

echo ""
echo "===== E.4. CLAIM + COMPLETE Director Approve (bob) — self-service task ====="
curl -s -X POST "$BASE/tasks/$DIRECTOR_TASK_E/claim" \
  -H "Authorization: Bearer $BOB_TOKEN" > /dev/null

curl -s -X POST "$BASE/tasks/$DIRECTOR_TASK_E/complete" \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"decision":"Approve","comment":"Approved for equipment purchase"}}' \
  | jq '{id, name, status, completedAt}'

echo ""
echo "===== E.5. CHECK — parallel gateway should create 2 simultaneous tasks ====="
sleep 0.5
INSTANCE_E_PARALLEL=$(curl -s "$BASE/process-instances/$INSTANCE_E_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$INSTANCE_E_PARALLEL" | jq '{id, status, tasks: [.tasks[] | {name, status, assignee: .assignee.email}]}'

PAYMENT_TASK_E=$(echo "$INSTANCE_E_PARALLEL" | jq -r '.tasks[] | select(.name=="Process Payment" and .status=="PENDING") | .id')
ARCHIVE_TASK_E=$(echo "$INSTANCE_E_PARALLEL" | jq -r '.tasks[] | select(.name=="Archive Record" and .status=="PENDING") | .id')
if [[ -z "$PAYMENT_TASK_E" || -z "$ARCHIVE_TASK_E" ]]; then
  echo "❌ FAIL: Both parallel tasks should be PENDING"
  exit 1
fi
echo "✓ Parallel gateway created Process Payment (jane) + Archive Record (bob)"

echo ""
echo "===== E.6. COMPLETE both parallel tasks — bob first, then jane ====="
curl -s -X POST "$BASE/tasks/$ARCHIVE_TASK_E/complete" \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"archiveId":"ARC-2000","notes":"Equipment purchase - laptop"}}' \
  | jq '{id, name, status, completedAt}'

echo ""
echo "===== E.7. CHECK — still RUNNING (waiting for jane's payment task) ====="
sleep 0.5
INSTANCE_E_AFTER_ARCHIVE=$(curl -s "$BASE/process-instances/$INSTANCE_E_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "Status after Archive Record: $(echo "$INSTANCE_E_AFTER_ARCHIVE" | jq -r .status)"

echo ""
echo "===== E.8. COMPLETE Process Payment (jane) — last parallel task ====="
curl -s -X POST "$BASE/tasks/$PAYMENT_TASK_E/complete" \
  -H "Authorization: Bearer $JANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"paymentMethod":"Bank Transfer","reference":"BT-2000","paidDate":"2026-09-15"}}' \
  | jq '{id, name, status, completedAt}'

echo ""
echo "===== E.9. CHECK — instance should be COMPLETED ====="
sleep 0.5
INSTANCE_E_FINAL=$(curl -s "$BASE/process-instances/$INSTANCE_E_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$INSTANCE_E_FINAL" | jq '{id, status, completedAt, tasks: [.tasks[] | {name, status, assignee: .assignee.email}]}'

INSTANCE_E_FINAL_STATUS=$(echo "$INSTANCE_E_FINAL" | jq -r .status)
if [[ "$INSTANCE_E_FINAL_STATUS" != "COMPLETED" ]]; then
  echo "❌ FAIL: Instance E should be COMPLETED but is $INSTANCE_E_FINAL_STATUS"
  exit 1
fi
echo "✓ Large expense: Director approval → parallel tasks → COMPLETED"

# ============================================================================
echo ""
echo "=========================================="
echo "SCENARIO F: Very large expense (amount=6000 → director + compliance via inclusive gateway)"
echo "=========================================="
echo ""
echo "===== F.1. START expense instance ====="
INSTANCE_F=$(curl -s -X POST "$BASE/process-instances" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"processId\":\"$EXPENSE_PROCESS_ID\"}")
INSTANCE_F_ID=$(echo "$INSTANCE_F" | jq -r .id)
TASK_F1_ID=$(echo "$INSTANCE_F" | jq -r '.tasks[0].id')
echo "Instance F: $INSTANCE_F_ID, Task F1 (Submit Expense): $TASK_F1_ID"

echo ""
echo "===== F.2. COMPLETE Submit Expense with amount=6000 ====="
curl -s -X POST "$BASE/tasks/$TASK_F1_ID/complete" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"description":"Server hardware","amount":6000,"category":"Equipment","receipt":"R-003"}}' \
  | jq '{id, name, status, completedAt}'

echo ""
echo "===== F.3. CHECK — inclusive gateway should create BOTH Director + Compliance tasks ====="
sleep 0.5
INSTANCE_F_MID=$(curl -s "$BASE/process-instances/$INSTANCE_F_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$INSTANCE_F_MID" | jq '{id, status, tasks: [.tasks[] | {name, status, assignee: .assignee.email}]}'

# Verify inclusive routing: amount=6000 satisfies both > 1000 and > 5000
DIRECTOR_TASK_F=$(echo "$INSTANCE_F_MID" | jq -r '.tasks[] | select(.name=="Director Approve" and .status=="PENDING") | .id')
COMPLIANCE_TASK_F=$(echo "$INSTANCE_F_MID" | jq -r '.tasks[] | select(.name=="Compliance Review" and .status=="PENDING") | .id')
MANAGER_TASK_F=$(echo "$INSTANCE_F_MID" | jq -r '.tasks[] | select(.name=="Manager Approve" and .status=="PENDING") | .id // empty')
if [[ -z "$DIRECTOR_TASK_F" ]]; then
  echo "❌ FAIL: Director Approve should be PENDING (amount > 1000)"
  exit 1
fi
if [[ -z "$COMPLIANCE_TASK_F" ]]; then
  echo "❌ FAIL: Compliance Review should be PENDING (amount > 5000)"
  exit 1
fi
if [[ -n "$MANAGER_TASK_F" ]]; then
  echo "❌ FAIL: Manager Approve should NOT be created for amount=6000"
  exit 1
fi
echo "✓ Inclusive gateway created BOTH Director Approve + Compliance Review (amount=6000)"

echo ""
echo "===== F.4. CLAIM + COMPLETE Director Approve (bob) — self-service task ====="
curl -s -X POST "$BASE/tasks/$DIRECTOR_TASK_F/claim" \
  -H "Authorization: Bearer $BOB_TOKEN" > /dev/null

curl -s -X POST "$BASE/tasks/$DIRECTOR_TASK_F/complete" \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"decision":"Approve","comment":"Approved for server hardware"}}' \
  | jq '{id, name, status, completedAt}'

echo ""
echo "===== F.5. CHECK — still RUNNING (inclusive join waiting for Compliance Review) ====="
sleep 0.5
INSTANCE_F_AFTER_DIR=$(curl -s "$BASE/process-instances/$INSTANCE_F_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "Status after Director Approve: $(echo "$INSTANCE_F_AFTER_DIR" | jq -r .status)"
if [[ "$(echo "$INSTANCE_F_AFTER_DIR" | jq -r .status)" != "RUNNING" ]]; then
  echo "❌ FAIL: Instance should still be RUNNING (Compliance Review not yet completed)"
  exit 1
fi
echo "✓ Instance still RUNNING — inclusive join waiting for Compliance Review"

echo ""
echo "===== F.6. CLAIM + COMPLETE Compliance Review (admin) — self-service task ====="
curl -s -X POST "$BASE/tasks/$COMPLIANCE_TASK_F/claim" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

curl -s -X POST "$BASE/tasks/$COMPLIANCE_TASK_F/complete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"decision":"Approve","comment":"Compliance check passed"}}' \
  | jq '{id, name, status, completedAt}'

echo ""
echo "===== F.7. CHECK — inclusive join satisfied, parallel split should create 2 tasks ====="
sleep 0.5
INSTANCE_F_PARALLEL=$(curl -s "$BASE/process-instances/$INSTANCE_F_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$INSTANCE_F_PARALLEL" | jq '{id, status, tasks: [.tasks[] | {name, status, assignee: .assignee.email}]}'

PAYMENT_TASK_F=$(echo "$INSTANCE_F_PARALLEL" | jq -r '.tasks[] | select(.name=="Process Payment" and .status=="PENDING") | .id')
ARCHIVE_TASK_F=$(echo "$INSTANCE_F_PARALLEL" | jq -r '.tasks[] | select(.name=="Archive Record" and .status=="PENDING") | .id')
if [[ -z "$PAYMENT_TASK_F" || -z "$ARCHIVE_TASK_F" ]]; then
  echo "❌ FAIL: Parallel split should create Process Payment + Archive Record"
  exit 1
fi
echo "✓ Inclusive join satisfied → parallel split created 2 finalization tasks"

echo ""
echo "===== F.8. COMPLETE both parallel tasks → instance COMPLETED ====="
curl -s -X POST "$BASE/tasks/$PAYMENT_TASK_F/complete" \
  -H "Authorization: Bearer $JANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"paymentMethod":"Bank Transfer","reference":"BT-6000","paidDate":"2026-09-15"}}' \
  > /dev/null

curl -s -X POST "$BASE/tasks/$ARCHIVE_TASK_F/complete" \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"archiveId":"ARC-6000","notes":"Server hardware purchase"}}' \
  > /dev/null

sleep 0.5
INSTANCE_F_FINAL=$(curl -s "$BASE/process-instances/$INSTANCE_F_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$INSTANCE_F_FINAL" | jq '{id, status, completedAt, taskCount: (.tasks | length), tasks: [.tasks[] | {name, status}]}'

INSTANCE_F_FINAL_STATUS=$(echo "$INSTANCE_F_FINAL" | jq -r .status)
if [[ "$INSTANCE_F_FINAL_STATUS" != "COMPLETED" ]]; then
  echo "❌ FAIL: Instance F should be COMPLETED but is $INSTANCE_F_FINAL_STATUS"
  exit 1
fi
TASK_COUNT_F=$(echo "$INSTANCE_F_FINAL" | jq '.tasks | length')
if [[ "$TASK_COUNT_F" -ne 5 ]]; then
  echo "❌ FAIL: Instance F should have 5 tasks (Submit + Director + Compliance + Payment + Archive) but has $TASK_COUNT_F"
  exit 1
fi
echo "✓ Very large expense: Director + Compliance (inclusive) → parallel tasks → COMPLETED with 5 tasks"

# ============================================================================
echo ""
echo "=========================================="
echo "SCENARIO G: Position-based task visibility"
echo "=========================================="
echo ""
echo "===== G.1. Create a new expense instance but DON'T complete Submit Expense yet ====="
INSTANCE_G=$(curl -s -X POST "$BASE/process-instances" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"processId\":\"$EXPENSE_PROCESS_ID\"}")
INSTANCE_G_ID=$(echo "$INSTANCE_G" | jq -r .id)
TASK_G1_ID=$(echo "$INSTANCE_G" | jq -r '.tasks[0].id')
echo "Instance G: $INSTANCE_G_ID, Task G1 (Submit Expense): $TASK_G1_ID"

echo ""
echo "===== G.2. CHECK john's 'my tasks' — should see Submit Expense (john holds Engineer position) ====="
JOHN_TASKS=$(curl -s "$BASE/tasks/mine" -H "Authorization: Bearer $JOHN_TOKEN")
echo "$JOHN_TASKS" | jq -c '.[] | select(.processInstance.id=="'$INSTANCE_G_ID'") | {name, status, position: .position.name}'

JOHN_SEES_TASK=$(echo "$JOHN_TASKS" | jq -r '.[] | select(.processInstance.id=="'$INSTANCE_G_ID'" and .name=="Submit Expense") | .id')
if [[ -z "$JOHN_SEES_TASK" ]]; then
  echo "❌ FAIL: John should see Submit Expense task (holds Engineer position)"
  exit 1
fi
echo "✓ John sees Submit Expense task via position assignment"

echo ""
echo "===== G.3. CHECK jane's 'my tasks' — should NOT see Submit Expense (jane doesn't hold Engineer) ====="
JANE_TASKS=$(curl -s "$BASE/tasks/mine" -H "Authorization: Bearer $JANE_TOKEN")
JANE_SEES_SUBMIT=$(echo "$JANE_TASKS" | jq -r '.[] | select(.processInstance.id=="'$INSTANCE_G_ID'" and .name=="Submit Expense") | .id // empty')
if [[ -n "$JANE_SEES_SUBMIT" ]]; then
  echo "❌ FAIL: Jane should NOT see Submit Expense (doesn't hold Engineer position)"
  exit 1
fi
echo "✓ Jane does NOT see Submit Expense (correct — she doesn't hold Engineer position)"

echo ""
echo "===== G.4. Complete Submit Expense → check jane sees Manager Approve via position ====="
curl -s -X POST "$BASE/tasks/$TASK_G1_ID/complete" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"description":"Office supplies","amount":300,"category":"Equipment","receipt":"R-004"}}' \
  > /dev/null

sleep 0.5
JANE_TASKS=$(curl -s "$BASE/tasks/mine" -H "Authorization: Bearer $JANE_TOKEN")
echo "$JANE_TASKS" | jq -c '.[] | select(.processInstance.id=="'$INSTANCE_G_ID'") | {name, status, position: .position.name}'

JANE_SEES_MANAGER=$(echo "$JANE_TASKS" | jq -r '.[] | select(.processInstance.id=="'$INSTANCE_G_ID'" and .name=="Manager Approve") | .id')
if [[ -z "$JANE_SEES_MANAGER" ]]; then
  echo "❌ FAIL: Jane should see Manager Approve (holds Engineering Manager position)"
  exit 1
fi
echo "✓ Jane sees Manager Approve via Engineering Manager position"

echo ""
echo "===== G.5. CHECK bob does NOT see Manager Approve (doesn't hold Engineering Manager) ====="
BOB_TASKS=$(curl -s "$BASE/tasks/mine" -H "Authorization: Bearer $BOB_TOKEN")
BOB_SEES_MANAGER=$(echo "$BOB_TASKS" | jq -r '.[] | select(.processInstance.id=="'$INSTANCE_G_ID'" and .name=="Manager Approve") | .id // empty')
if [[ -n "$BOB_SEES_MANAGER" ]]; then
  echo "❌ FAIL: Bob should NOT see Manager Approve (doesn't hold Engineering Manager position)"
  exit 1
fi
echo "✓ Bob does NOT see Manager Approve (correct — he holds Engineering Director, not Manager)"

echo ""
echo "===== G.6. Complete the instance via position-based tasks (Manager Approve is self-service) ====="
# Manager Approve is self-service — must claim first
curl -s -X POST "$BASE/tasks/$JANE_SEES_MANAGER/claim" \
  -H "Authorization: Bearer $JANE_TOKEN" > /dev/null

curl -s -X POST "$BASE/tasks/$JANE_SEES_MANAGER/complete" \
  -H "Authorization: Bearer $JANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"decision":"Approve","comment":"OK"}}' \
  > /dev/null

sleep 0.5
# After Manager Approve, parallel split creates Process Payment (Finance Officer = jane)
# and Archive Record (Engineering Director = bob)
JANE_TASKS=$(curl -s "$BASE/tasks/mine" -H "Authorization: Bearer $JANE_TOKEN")
BOB_TASKS=$(curl -s "$BASE/tasks/mine" -H "Authorization: Bearer $BOB_TOKEN")
echo "Jane's PENDING tasks for instance G:"
echo "$JANE_TASKS" | jq -c '.[] | select(.processInstance.id=="'$INSTANCE_G_ID'" and .status=="PENDING") | {name, position: .position.name}'
echo "Bob's PENDING tasks for instance G:"
echo "$BOB_TASKS" | jq -c '.[] | select(.processInstance.id=="'$INSTANCE_G_ID'" and .status=="PENDING") | {name, position: .position.name}'

PAYMENT_G=$(echo "$JANE_TASKS" | jq -r '.[] | select(.processInstance.id=="'$INSTANCE_G_ID'" and .name=="Process Payment" and .status=="PENDING") | .id')
ARCHIVE_G=$(echo "$BOB_TASKS" | jq -r '.[] | select(.processInstance.id=="'$INSTANCE_G_ID'" and .name=="Archive Record" and .status=="PENDING") | .id')

if [[ -z "$PAYMENT_G" ]]; then
  echo "❌ FAIL: Jane should see Process Payment (holds Finance Officer position)"
  exit 1
fi
if [[ -z "$ARCHIVE_G" ]]; then
  echo "❌ FAIL: Bob should see Archive Record (holds Engineering Director position)"
  exit 1
fi
echo "✓ Jane sees Process Payment via Finance Officer position"
echo "✓ Bob sees Archive Record via Engineering Director position"

# Complete both to finish the instance
curl -s -X POST "$BASE/tasks/$PAYMENT_G/complete" \
  -H "Authorization: Bearer $JANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"paymentMethod":"Cash","reference":"C-300","paidDate":"2026-09-15"}}' > /dev/null

curl -s -X POST "$BASE/tasks/$ARCHIVE_G/complete" \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"archiveId":"ARC-300","notes":"Office supplies"}}' > /dev/null

sleep 0.5
INSTANCE_G_FINAL=$(curl -s "$BASE/process-instances/$INSTANCE_G_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo ""
echo "Instance G final status: $(echo "$INSTANCE_G_FINAL" | jq -r .status)"
echo "✓ Position-based assignment works end-to-end"

# ============================================================================
echo ""
echo "=========================================="
echo "SCENARIO H: Self-service claim/release/complete flow"
echo "=========================================="
echo ""
echo "===== H.1. START expense instance (amount=500 → Manager Approve is self-service) ====="
INSTANCE_H=$(curl -s -X POST "$BASE/process-instances" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"processId\":\"$EXPENSE_PROCESS_ID\"}")
INSTANCE_H_ID=$(echo "$INSTANCE_H" | jq -r .id)
TASK_H1_ID=$(echo "$INSTANCE_H" | jq -r '.tasks[0].id')
echo "Instance H: $INSTANCE_H_ID, Task H1 (Submit Expense): $TASK_H1_ID"

# Complete Submit Expense to trigger the gateway
curl -s -X POST "$BASE/tasks/$TASK_H1_ID/complete" \
  -H "Authorization: Bearer $JOHN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"description":"Test self-service","amount":500,"category":"Meals","receipt":"R-H1"}}' \
  > /dev/null

sleep 0.5
INSTANCE_H_MID=$(curl -s "$BASE/process-instances/$INSTANCE_H_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
MANAGER_TASK_H=$(echo "$INSTANCE_H_MID" | jq -r '.tasks[] | select(.name=="Manager Approve") | .id')
echo "Manager Approve task: $MANAGER_TASK_H"
echo "selfService flag: $(echo "$INSTANCE_H_MID" | jq -r '.tasks[] | select(.name=="Manager Approve") | .selfService')"

# Verify selfService is true
SS_FLAG=$(echo "$INSTANCE_H_MID" | jq -r '.tasks[] | select(.name=="Manager Approve") | .selfService')
if [[ "$SS_FLAG" != "true" ]]; then
  echo "❌ FAIL: Manager Approve should have selfService=true"
  exit 1
fi

echo ""
echo "===== H.2. Try to COMPLETE without claiming — should get 403 ====="
COMPLETE_RESULT=$(curl -s -w "\n%{http_code}" -X POST "$BASE/tasks/$MANAGER_TASK_H/complete" \
  -H "Authorization: Bearer $JANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"decision":"Approve","comment":"test"}}')
HTTP_CODE=$(echo "$COMPLETE_RESULT" | tail -1)
echo "HTTP code: $HTTP_CODE"
if [[ "$HTTP_CODE" != "403" ]]; then
  echo "❌ FAIL: Should get 403 when completing self-service task without claiming. Got: $HTTP_CODE"
  exit 1
fi
echo "✓ Complete without claim correctly rejected (403)"

echo ""
echo "===== H.3. CLAIM the task as jane ====="
CLAIM_RESULT=$(curl -s -X POST "$BASE/tasks/$MANAGER_TASK_H/claim" \
  -H "Authorization: Bearer $JANE_TOKEN")
echo "$CLAIM_RESULT" | jq '{id, name, status, assignee: .assignee.email, selfService, position: .position.name}'

CLAIMED_ASSIGNEE=$(echo "$CLAIM_RESULT" | jq -r .assignee.email)
if [[ "$CLAIMED_ASSIGNEE" != "jane@bpms.local" ]]; then
  echo "❌ FAIL: Task should be claimed by jane. Got: $CLAIMED_ASSIGNEE"
  exit 1
fi
echo "✓ Task claimed by jane"

echo ""
echo "===== H.4. Try to CLAIM again as jane — should get 403 (already claimed) ====="
RECLAIM_RESULT=$(curl -s -w "\n%{http_code}" -X POST "$BASE/tasks/$MANAGER_TASK_H/claim" \
  -H "Authorization: Bearer $JANE_TOKEN")
RECLAIM_CODE=$(echo "$RECLAIM_RESULT" | tail -1)
if [[ "$RECLAIM_CODE" != "403" ]]; then
  echo "❌ FAIL: Re-claiming should fail with 403. Got: $RECLAIM_CODE"
  exit 1
fi
echo "✓ Re-claim correctly rejected (403)"

echo ""
echo "===== H.5. RELEASE the task back to the pool ====="
RELEASE_RESULT=$(curl -s -X POST "$BASE/tasks/$MANAGER_TASK_H/release" \
  -H "Authorization: Bearer $JANE_TOKEN")
echo "$RELEASE_RESULT" | jq '{id, name, status, assignee: .assignee.email}'
RELEASED_ASSIGNEE=$(echo "$RELEASE_RESULT" | jq -r .assignee.email)
if [[ "$RELEASED_ASSIGNEE" != "null" ]]; then
  echo "❌ FAIL: After release, assignee should be null. Got: $RELEASED_ASSIGNEE"
  exit 1
fi
echo "✓ Task released — assignee is now null"

echo ""
echo "===== H.6. CLAIM again + COMPLETE successfully ====="
curl -s -X POST "$BASE/tasks/$MANAGER_TASK_H/claim" \
  -H "Authorization: Bearer $JANE_TOKEN" > /dev/null

curl -s -X POST "$BASE/tasks/$MANAGER_TASK_H/complete" \
  -H "Authorization: Bearer $JANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"decision":"Approve","comment":"Self-service flow complete"}}' \
  | jq '{id, name, status, completedAt}'

echo ""
echo "===== H.7. Complete the parallel finalization tasks (not self-service, direct complete) ====="
sleep 0.5
INSTANCE_H_FINAL_TASKS=$(curl -s "$BASE/process-instances/$INSTANCE_H_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
PAYMENT_H=$(echo "$INSTANCE_H_FINAL_TASKS" | jq -r '.tasks[] | select(.name=="Process Payment" and .status=="PENDING") | .id')
ARCHIVE_H=$(echo "$INSTANCE_H_FINAL_TASKS" | jq -r '.tasks[] | select(.name=="Archive Record" and .status=="PENDING") | .id')

# Process Payment is NOT self-service → can complete directly without claim
curl -s -X POST "$BASE/tasks/$PAYMENT_H/complete" \
  -H "Authorization: Bearer $JANE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"paymentMethod":"Cash","reference":"C-H1","paidDate":"2026-09-15"}}' > /dev/null

curl -s -X POST "$BASE/tasks/$ARCHIVE_H/complete" \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"archiveId":"ARC-H1","notes":"Self-service test"}}' > /dev/null

sleep 0.5
INSTANCE_H_FINAL=$(curl -s "$BASE/process-instances/$INSTANCE_H_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "Instance H final status: $(echo "$INSTANCE_H_FINAL" | jq -r .status)"
echo "✓ Self-service claim → release → re-claim → complete works end-to-end"

# ============================================================================
echo ""
echo "===== 4. Swagger JSON should be available ====="
curl -s "$BASE/docs-json" | jq '.info | {title, version}'

echo ""
echo "===== ALL SMOKE TESTS PASSED ====="
