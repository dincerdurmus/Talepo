-- Üyelik numarası sırası (TLP-100001'den başlar)
CREATE SEQUENCE "User_membershipNumber_seq" START WITH 100001;

-- Geçici nullable sütun
ALTER TABLE "User" ADD COLUMN "membershipNumber" TEXT;

-- Mevcut kullanıcılara numara ata
UPDATE "User"
SET "membershipNumber" = 'TLP-' || nextval('"User_membershipNumber_seq"')::text
WHERE "membershipNumber" IS NULL;

-- Zorunlu ve benzersiz
ALTER TABLE "User" ALTER COLUMN "membershipNumber" SET NOT NULL;
CREATE UNIQUE INDEX "User_membershipNumber_key" ON "User"("membershipNumber");
