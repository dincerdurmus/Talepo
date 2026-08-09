# Talepo — Kişisel vs Firma Üyelik Kuralları

**Durum:** Uygulandı (kod + UX)  
**Tarih:** 9 Ağustos 2026

## Özet

Tedarikçi/ekip özellikleri **firma bağlamında yalnızca `Company.planTier`** üzerinden çözülür. Kişisel `User.planTier` ekip arkadaşlarına veya firma kotasına yansımaz.

## Kurallar

| Senaryo | Geçerli plan | Özellikler |
|---------|--------------|------------|
| Kullanıcının firması yok | `User.planTier` | Kişisel haklar |
| Firma bağlamı aktif (cookie veya varsayılan) | `Company.planTier` | Ekip hakları — User.planTier yok sayılır |
| Kişisel mod seçili (`__personal__` cookie) | `User.planTier` | Kişisel haklar |
| User PREMIUM + Company STANDARD | Company STANDARD | Uyarı banner gösterilir |
| Company CORPORATE | CORPORATE | Tüm ACTIVE üyeler firma bağlamında Kurumsal hakları alır |

## Kod

- `resolveEntitlements` — company-first resolver (`src/lib/membership/resolve-entitlements.ts`)
- `plan-tier-utils.ts` — süre dolumu ve kişisel plan snapshot
- `membership-rules.ts` — uyarı metinleri + `hasPersonalPlanMismatch`
- `PersonalPlanMismatchBanner` — özet / plan / firma ayarları UX

## Mental test

1. **User A PREMIUM, Company STANDARD, A üye** → firma bağlamında STANDARD (AI asistan kapalı, 5 teklif/ay)
2. **Company CORPORATE** → tüm üyeler gizli envanter + uyarı kuralları alır
3. **Firma yok** → User.planTier geçerli
4. **Kişisel mod + firma üyeliği** → User.planTier geçerli (firma planı devre dışı)

## Demo

1. Mock upgrade ile User PREMIUM, Company STANDARD ayarla (`ALLOW_MOCK_UPGRADE=true`)
2. `/panel` — kurumsal özet sayfasında amber uyarı banner
3. `/panel/plan` — kişisel plan satırı + “firma bağlamında geçerli değil” notu
4. `/panel/firma` — ekip kapsamı notu + uyarı
5. Plan bağlamını “Kişisel hesap”a çevir → Premium özellikleri geri gelir (yalnızca kişisel teklifler)
