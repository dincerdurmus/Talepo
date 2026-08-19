CREATE TABLE "RoleUserNote" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleUserNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoleUserNote_targetUserId_createdAt_idx" ON "RoleUserNote"("targetUserId", "createdAt");
CREATE INDEX "RoleUserNote_authorId_createdAt_idx" ON "RoleUserNote"("authorId", "createdAt");

ALTER TABLE "RoleUserNote" ADD CONSTRAINT "RoleUserNote_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleUserNote" ADD CONSTRAINT "RoleUserNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
