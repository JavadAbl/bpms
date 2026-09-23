-- AlterTable: add login username (derived from email local-part for existing rows)

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_users" ("id", "username", "email", "name", "password", "role", "createdAt", "updatedAt")
SELECT
    "id",
    CASE
        WHEN instr("email", '@') > 1 THEN lower(substr("email", 1, instr("email", '@') - 1))
        ELSE lower("email")
    END,
    "email",
    "name",
    "password",
    "role",
    "createdAt",
    "updatedAt"
FROM "users";

DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
