-- CreateTable
CREATE TABLE "process_starters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "process_starters_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "process_starters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "process_starters_processId_userId_key" ON "process_starters"("processId", "userId");
