DO $$ BEGIN
  CREATE TYPE "PlatformRole" AS ENUM ('USER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';

UPDATE "User"
SET "platformRole" = 'ADMIN'
WHERE LOWER("email") = 'tugrul.tastekin@talepo.com';

CREATE INDEX IF NOT EXISTS "User_platformRole_idx" ON "User"("platformRole");
