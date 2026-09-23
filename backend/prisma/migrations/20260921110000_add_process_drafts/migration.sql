-- CreateTable
CREATE TABLE "process_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "firstTaskName" TEXT NOT NULL,
    "formId" TEXT,
    "formData" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "process_drafts_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "process_drafts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "process_drafts_formId_fkey" FOREIGN KEY ("formId") REFERENCES "forms" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
