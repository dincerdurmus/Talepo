/*
  Warnings:

  - You are about to drop the column `parentId` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `sectorId` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `adminNote` on the `CategorySuggestion` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedAt` on the `CategorySuggestion` table. All the data in the column will be lost.
  - You are about to drop the column `suggestedName` on the `CategorySuggestion` table. All the data in the column will be lost.
  - You are about to drop the column `isPrimary` on the `CompanyCategory` table. All the data in the column will be lost.
  - You are about to drop the column `fieldKey` on the `FormField` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `FormField` table. All the data in the column will be lost.
  - You are about to drop the column `isDefault` on the `RequestForm` table. All the data in the column will be lost.
  - You are about to drop the `CategoryAlias` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FieldOption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Sector` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[slug]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[formId,key]` on the table `FormField` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `CategorySuggestion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `key` to the `FormField` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RECEIVING_OFFERS', 'OFFER_SELECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VIEWED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('TRY', 'USD', 'EUR', 'GBP');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'FILE', 'IMAGE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('GENERAL', 'REQUEST_PUBLISHED', 'NEW_OFFER', 'OFFER_VIEWED', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'NEW_MESSAGE', 'COMPANY_INVITATION', 'COMPANY_MEMBER_JOINED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_sectorId_fkey";

-- DropForeignKey
ALTER TABLE "CategoryAlias" DROP CONSTRAINT "CategoryAlias_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "FieldOption" DROP CONSTRAINT "FieldOption_fieldId_fkey";

-- DropIndex
DROP INDEX "Category_name_idx";

-- DropIndex
DROP INDEX "Category_parentId_idx";

-- DropIndex
DROP INDEX "Category_sectorId_isActive_sortOrder_idx";

-- DropIndex
DROP INDEX "Category_sectorId_parentId_slug_key";

-- DropIndex
DROP INDEX "CategorySuggestion_status_createdAt_idx";

-- DropIndex
DROP INDEX "CategorySuggestion_userId_idx";

-- DropIndex
DROP INDEX "CompanyCategory_categoryId_idx";

-- DropIndex
DROP INDEX "CompanyCategory_companyId_isPrimary_idx";

-- DropIndex
DROP INDEX "CompanyMember_companyId_role_idx";

-- DropIndex
DROP INDEX "CompanyMember_userId_status_idx";

-- DropIndex
DROP INDEX "FormField_formId_fieldKey_key";

-- DropIndex
DROP INDEX "FormField_formId_isActive_sortOrder_idx";

-- DropIndex
DROP INDEX "RequestForm_categoryId_isActive_idx";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "parentId",
DROP COLUMN "sectorId";

-- AlterTable
ALTER TABLE "CategorySuggestion" DROP COLUMN "adminNote",
DROP COLUMN "reviewedAt",
DROP COLUMN "suggestedName",
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CompanyCategory" DROP COLUMN "isPrimary";

-- AlterTable
ALTER TABLE "FormField" DROP COLUMN "fieldKey",
DROP COLUMN "unit",
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "options" JSONB,
ADD COLUMN     "validation" JSONB;

-- AlterTable
ALTER TABLE "RequestForm" DROP COLUMN "isDefault";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "biography" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'Türkiye';

-- DropTable
DROP TABLE "CategoryAlias";

-- DropTable
DROP TABLE "FieldOption";

-- DropTable
DROP TABLE "Sector";

-- CreateTable
CREATE TABLE "RequestFieldValue" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "textValue" TEXT,
    "numberValue" DECIMAL(18,4),
    "booleanValue" BOOLEAN,
    "dateValue" TIMESTAMP(3),
    "jsonValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "companyId" TEXT,
    "categoryId" TEXT NOT NULL,
    "formId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "country" TEXT NOT NULL DEFAULT 'Türkiye',
    "city" TEXT,
    "district" TEXT,
    "budgetMin" DECIMAL(18,2),
    "budgetMax" DECIMAL(18,2),
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "deadlineAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "companyId" TEXT,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "deliveryDays" INTEGER,
    "validUntil" TIMESTAMP(3),
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "title" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT,
    "companyId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "senderCompanyId" TEXT,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "requestId" TEXT,
    "offerId" TEXT,
    "companyId" TEXT,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestFieldValue_requestId_idx" ON "RequestFieldValue"("requestId");

-- CreateIndex
CREATE INDEX "RequestFieldValue_fieldId_idx" ON "RequestFieldValue"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestFieldValue_requestId_fieldId_key" ON "RequestFieldValue"("requestId", "fieldId");

-- CreateIndex
CREATE INDEX "Request_createdById_idx" ON "Request"("createdById");

-- CreateIndex
CREATE INDEX "Request_companyId_idx" ON "Request"("companyId");

-- CreateIndex
CREATE INDEX "Request_categoryId_idx" ON "Request"("categoryId");

-- CreateIndex
CREATE INDEX "Request_formId_idx" ON "Request"("formId");

-- CreateIndex
CREATE INDEX "Request_status_idx" ON "Request"("status");

-- CreateIndex
CREATE INDEX "Request_city_district_idx" ON "Request"("city", "district");

-- CreateIndex
CREATE INDEX "Request_publishedAt_idx" ON "Request"("publishedAt");

-- CreateIndex
CREATE INDEX "Request_createdAt_idx" ON "Request"("createdAt");

-- CreateIndex
CREATE INDEX "Offer_requestId_idx" ON "Offer"("requestId");

-- CreateIndex
CREATE INDEX "Offer_submittedById_idx" ON "Offer"("submittedById");

-- CreateIndex
CREATE INDEX "Offer_companyId_idx" ON "Offer"("companyId");

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");

-- CreateIndex
CREATE INDEX "Offer_submittedAt_idx" ON "Offer"("submittedAt");

-- CreateIndex
CREATE INDEX "Offer_createdAt_idx" ON "Offer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_offerId_key" ON "Conversation"("offerId");

-- CreateIndex
CREATE INDEX "Conversation_status_idx" ON "Conversation"("status");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_idx" ON "ConversationParticipant"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_companyId_idx" ON "ConversationParticipant"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_companyId_key" ON "ConversationParticipant"("conversationId", "companyId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderUserId_idx" ON "Message"("senderUserId");

-- CreateIndex
CREATE INDEX "Message_senderCompanyId_idx" ON "Message"("senderCompanyId");

-- CreateIndex
CREATE INDEX "Notification_userId_status_idx" ON "Notification"("userId", "status");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_requestId_idx" ON "Notification"("requestId");

-- CreateIndex
CREATE INDEX "Notification_offerId_idx" ON "Notification"("offerId");

-- CreateIndex
CREATE INDEX "Notification_companyId_idx" ON "Notification"("companyId");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_slug_idx" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_isActive_idx" ON "Category"("isActive");

-- CreateIndex
CREATE INDEX "CategorySuggestion_status_idx" ON "CategorySuggestion"("status");

-- CreateIndex
CREATE INDEX "CompanyMember_companyId_idx" ON "CompanyMember"("companyId");

-- CreateIndex
CREATE INDEX "CompanyMember_userId_idx" ON "CompanyMember"("userId");

-- CreateIndex
CREATE INDEX "FormField_formId_sortOrder_idx" ON "FormField"("formId", "sortOrder");

-- CreateIndex
CREATE INDEX "FormField_isActive_idx" ON "FormField"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FormField_formId_key_key" ON "FormField"("formId", "key");

-- CreateIndex
CREATE INDEX "RequestForm_categoryId_idx" ON "RequestForm"("categoryId");

-- CreateIndex
CREATE INDEX "RequestForm_isActive_idx" ON "RequestForm"("isActive");

-- CreateIndex
CREATE INDEX "User_city_district_idx" ON "User"("city", "district");

-- AddForeignKey
ALTER TABLE "RequestFieldValue" ADD CONSTRAINT "RequestFieldValue_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestFieldValue" ADD CONSTRAINT "RequestFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FormField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_formId_fkey" FOREIGN KEY ("formId") REFERENCES "RequestForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderCompanyId_fkey" FOREIGN KEY ("senderCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
