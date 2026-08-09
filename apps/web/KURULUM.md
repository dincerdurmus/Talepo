# Talepo Sprint 1 kurulumu

Bu sürümde gerçek talep kaydı, Taleplerim listesi ve talep detay sayfası eklendi.

## Mevcut projeye aktarma

1. Çalışan projenizdeki `.env` ve `.env.local` dosyalarını koruyun.
2. Bu paketteki dosyaları mevcut `apps/web` klasörünün üzerine kopyalayın.
3. Terminalde `apps/web` klasörüne geçin.
4. Şunları çalıştırın:

```bash
npm install
npx prisma generate
npm run dev
```

## Test

1. Google ile giriş yapın.
2. `http://localhost:3000/talep` adresine gidin.
3. Talebi doldurup `AI sürümünü yayınla` veya `Talebimi yayınla` butonuna basın.
4. Kayıt sonrası talep detay ekranına yönlendirilirsiniz.
5. Tüm taleplerinizi `http://localhost:3000/panel/taleplerim` adresinde görebilirsiniz.

## Eklenen ana dosyalar

- `src/app/api/requests/route.ts`
- `src/server/auth/require-user.ts`
- `src/server/request/request-schema.ts`
- `src/server/request/mapper.ts`
- `src/server/request/create-request.ts`
- `src/app/panel/taleplerim/page.tsx`
- `src/app/panel/taleplerim/[id]/page.tsx`

Talep oluşturma ekranı gerçek API'ye bağlandı.
