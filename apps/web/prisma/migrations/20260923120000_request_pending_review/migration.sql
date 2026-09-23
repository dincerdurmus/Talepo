-- D-0032: supheli talep admin onayina duser.
-- Yeni durum degeri: PENDING_REVIEW. Kayit olusur, yayinlanmaz.
-- ALTER TYPE ... ADD VALUE geri alinamaz; deger eklemek mevcut satirlari etkilemez.
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW' BEFORE 'PUBLISHED';
