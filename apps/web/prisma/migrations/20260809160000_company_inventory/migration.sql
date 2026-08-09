-- CreateTable
CREATE TABLE "CompanyInventoryItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryLabel" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "sku" TEXT,
    "city" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyInventoryItem_companyId_idx" ON "CompanyInventoryItem"("companyId");

-- CreateIndex
CREATE INDEX "CompanyInventoryItem_isActive_idx" ON "CompanyInventoryItem"("isActive");

-- CreateIndex
CREATE INDEX "CompanyInventoryItem_createdAt_idx" ON "CompanyInventoryItem"("createdAt");

-- AddForeignKey
ALTER TABLE "CompanyInventoryItem" ADD CONSTRAINT "CompanyInventoryItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
