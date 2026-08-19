ALTER TABLE "RoleUserNote"
ADD COLUMN "visibleToRoles" "PlatformRole"[] NOT NULL DEFAULT ARRAY['ADMIN', 'SUPER_ADMIN']::"PlatformRole"[];
