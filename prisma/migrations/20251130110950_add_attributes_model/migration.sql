-- CreateTable
CREATE TABLE "Attribute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ops" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enumValues" TEXT,
    "min" REAL,
    "max" REAL,
    "itemType" TEXT,
    "schema" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SyncMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "lastSyncAt" DATETIME,
    "isInitialSync" BOOLEAN NOT NULL DEFAULT true,
    "totalSegments" INTEGER NOT NULL DEFAULT 0,
    "totalAttributes" INTEGER NOT NULL DEFAULT 0,
    "totalUsers" INTEGER NOT NULL DEFAULT 0,
    "maxPageSize" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SyncMetadata" ("createdAt", "id", "isInitialSync", "lastSyncAt", "maxPageSize", "totalSegments", "totalUsers", "updatedAt") SELECT "createdAt", "id", "isInitialSync", "lastSyncAt", "maxPageSize", "totalSegments", "totalUsers", "updatedAt" FROM "SyncMetadata";
DROP TABLE "SyncMetadata";
ALTER TABLE "new_SyncMetadata" RENAME TO "SyncMetadata";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Attribute_id_idx" ON "Attribute"("id");

-- CreateIndex
CREATE INDEX "Attribute_type_idx" ON "Attribute"("type");
