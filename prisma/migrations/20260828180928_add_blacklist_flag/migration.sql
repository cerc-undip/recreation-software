-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "token" TEXT,
    "joinedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Participant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Participant" ("id", "isActive", "joinedAt", "lastSeenAt", "sessionId", "token", "username") SELECT "id", "isActive", "joinedAt", "lastSeenAt", "sessionId", "token", "username" FROM "Participant";
DROP TABLE "Participant";
ALTER TABLE "new_Participant" RENAME TO "Participant";
CREATE UNIQUE INDEX "Participant_token_key" ON "Participant"("token");
CREATE UNIQUE INDEX "Participant_sessionId_username_key" ON "Participant"("sessionId", "username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
