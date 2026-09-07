-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_positions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "positions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_positions" ("createdAt", "departmentId", "description", "id", "name", "updatedAt") SELECT "createdAt", "departmentId", "description", "id", "name", "updatedAt" FROM "positions";
DROP TABLE "positions";
ALTER TABLE "new_positions" RENAME TO "positions";
CREATE UNIQUE INDEX "positions_departmentId_name_key" ON "positions"("departmentId", "name");
CREATE TABLE "new_task_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "strategy" TEXT NOT NULL DEFAULT 'FIXED_USER',
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
INSERT INTO "new_task_assignments" ("assigneeId", "createdAt", "formId", "id", "positionId", "processId", "selfService", "taskName", "updatedAt") SELECT "assigneeId", "createdAt", "formId", "id", "positionId", "processId", "selfService", "taskName", "updatedAt" FROM "task_assignments";
DROP TABLE "task_assignments";
ALTER TABLE "new_task_assignments" RENAME TO "task_assignments";
CREATE UNIQUE INDEX "task_assignments_processId_taskName_key" ON "task_assignments"("processId", "taskName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
