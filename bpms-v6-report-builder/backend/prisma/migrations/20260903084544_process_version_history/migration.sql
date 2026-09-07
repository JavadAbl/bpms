-- CreateTable
CREATE TABLE "process_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "bpmnXml" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "process_versions_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "process_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "process_versions_processId_version_key" ON "process_versions"("processId", "version");

-- Backfill: every existing process gets an immutable v-row for its current
-- version so history is complete from this point on.
INSERT INTO "process_versions" ("id", "processId", "version", "bpmnXml", "note", "createdById", "createdAt")
SELECT
    lower(hex(randomblob(16))),
    "id",
    "version",
    "bpmnXml",
    NULL,
    "createdById",
    "createdAt"
FROM "processes";
