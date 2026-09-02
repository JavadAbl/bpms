-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_task_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "assigneeId" TEXT,
    "positionId" TEXT,
    "selfService" BOOLEAN NOT NULL DEFAULT false,
    "formId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "task_assignments_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_assignments_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "task_assignments_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "task_assignments_formId_fkey" FOREIGN KEY ("formId") REFERENCES "forms" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_task_assignments" ("assigneeId", "createdAt", "formId", "id", "positionId", "processId", "taskName", "updatedAt") SELECT "assigneeId", "createdAt", "formId", "id", "positionId", "processId", "taskName", "updatedAt" FROM "task_assignments";
DROP TABLE "task_assignments";
ALTER TABLE "new_task_assignments" RENAME TO "task_assignments";
CREATE UNIQUE INDEX "task_assignments_processId_taskName_key" ON "task_assignments"("processId", "taskName");
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processInstanceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT,
    "positionId" TEXT,
    "selfService" BOOLEAN NOT NULL DEFAULT false,
    "formId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "activityId" TEXT,
    "executionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "tasks_processInstanceId_fkey" FOREIGN KEY ("processInstanceId") REFERENCES "process_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_formId_fkey" FOREIGN KEY ("formId") REFERENCES "forms" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("activityId", "assigneeId", "completedAt", "createdAt", "description", "executionId", "formId", "id", "name", "positionId", "processInstanceId", "status") SELECT "activityId", "assigneeId", "completedAt", "createdAt", "description", "executionId", "formId", "id", "name", "positionId", "processInstanceId", "status" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
