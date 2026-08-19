ALTER TABLE "ModerationCase" ADD COLUMN "escalationNotifiedAt" TIMESTAMP(3);

ALTER TABLE "RoleUserNote" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "RoleUserNote" ADD COLUMN "deletedById" TEXT;

CREATE TABLE "RoleUserNoteEvent" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeBody" TEXT,
    "afterBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleUserNoteEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoleUserNoteEvent_targetUserId_createdAt_idx" ON "RoleUserNoteEvent"("targetUserId", "createdAt");
CREATE INDEX "RoleUserNoteEvent_noteId_createdAt_idx" ON "RoleUserNoteEvent"("noteId", "createdAt");

ALTER TABLE "RoleUserNoteEvent" ADD CONSTRAINT "RoleUserNoteEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleUserNoteEvent" ADD CONSTRAINT "RoleUserNoteEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
