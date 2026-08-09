-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'NEW_REQUEST_MATCH';

-- CreateTable
CREATE TABLE "RequestMatch" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "matchReason" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestMatch_requestId_idx" ON "RequestMatch"("requestId");

-- CreateIndex
CREATE INDEX "RequestMatch_companyId_idx" ON "RequestMatch"("companyId");

-- CreateIndex
CREATE INDEX "RequestMatch_score_idx" ON "RequestMatch"("score");

-- CreateIndex
CREATE INDEX "RequestMatch_createdAt_idx" ON "RequestMatch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequestMatch_requestId_companyId_key" ON "RequestMatch"("requestId", "companyId");

-- AddForeignKey
ALTER TABLE "RequestMatch" ADD CONSTRAINT "RequestMatch_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestMatch" ADD CONSTRAINT "RequestMatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
