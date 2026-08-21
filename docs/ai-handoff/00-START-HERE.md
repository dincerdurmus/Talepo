# 00 — START HERE (Claude Code / sonraki ajan)

> Etiketler: `GIT-VERIFIED` · `CODE-VERIFIED` · `PRODUCT-INTENT`  
> Handoff paketi tarihi: 2026-08-22 (doğruluk düzeltmesi aynı gün)  
> Bu belge uygulama kodu değildir; yalnız yönlendirme ve doğrulama rehberidir.

## Talepo bir paragrafta

Talepo klasik ilan sitesi değil; **talep odaklı bir pazar yeridir**. Alıcı ihtiyacını doğal dilde yazar; sistem bunu anlamlandırır, birkaç kritik bilgiyi sorar ve uygun tedarikçilere yönlendirir. Hedef: alıcı 15–30 saniyede yayınlayabilsin; ücretli Pro tedarikçi uygun talebi sessizce kaçırmasın. [`PRODUCT-INTENT`]

## Durum etiketi sözlüğü (zorunlu)

Bu pakette **“LIVE / canlıda yayın” tek başına production deploy anlamına gelmez.** Kullanılacak etiketler:

| Etiket | Anlam |
|--------|--------|
| `BRANCH-WIRED` | Bu branch’in runtime kod yoluna bağlı (çağrı grafiği / import ile) |
| `SHADOW` | Karar/bildirim etkisiz veya yalnız shadow amaçlı bağlı |
| `TEST-ONLY` | Yalnız verifier / fixture |
| `PRODUCTION-DEPLOYED` | Yalnız gerçek deploy kanıtı varsa |
| `PRODUCTION-STATUS-NOT-VERIFIED` | Deploy durumu bu handoff’ta doğrulanamadı |
| `DECIDED-NOT-IMPLEMENTED` | Ürün kararı verildi ve mühürlendi; kod/şema karşılığı **henüz yok** |
| `REMOTE-FRESHNESS-NOT-VERIFIED` | `git fetch` yapılmadı; uzak durum yalnız yerel takip ref’inden okundu |
| `PRODUCTION-SINK-NOT-VERIFIED` | Log/telemetri olayı kodda üretiliyor, fakat **merkezî log sisteminde sorgulanabildiği doğrulanmadı** |

Phase 1/2’nin branch lineage’de olması **production deploy kanıtı değildir**.

`DECIDED-NOT-IMPLEMENTED` özellikle tehlikelidir: karar `11-DECISION-LOG.md`’de yazılıdır, fakat kod hâlâ eski davranışı sürdürür. Kararı okuyup “uygulanmış” sanma.

## Doğru çalışma konumu (doğrulanmış)

| Alan | Değer | Etiket |
|------|--------|--------|
| Worktree | `C:\Users\HP\Documents\Talepo-matching-v3` | `GIT-VERIFIED` |
| Branch | `feature/dincer-request-matching-v3` | `GIT-VERIFIED` |
| HEAD | `27806c33bf544aa912e6ea2423623e01ffa18310` | `GIT-VERIFIED` |
| Upstream | `origin/feature/dincer-request-matching-v3` | `GIT-VERIFIED` |
| Local == Remote | Evet (handoff hazırlık anında) | `GIT-VERIFIED` |

**Dokunma:** `C:\Users\HP\Documents\Talepo` (günlük kirli klasör; başka branch).

## Mevcut geliştirme aşaması

- **Tamamlanan son aşama (branch):** Phase 3 Dilim 1 — explainable **shadow** relevance engine (`27806c3`). [`GIT-VERIFIED`]
- **Branch lineage’de bulunan (deploy ≠ kanıt):** Phase 1 rawInput/authority (`0975ab9`) + Phase 2 guided composer (`b0e9a22`). Bunlar bu branch’te `BRANCH-WIRED`. Production’a çıkıp çıkmadıkları: **`PRODUCTION-STATUS-NOT-VERIFIED`**. [`GIT-VERIFIED` + `NOT-VERIFIED` deploy]
- **Henüz başlanmayan:** Phase 3 Dilim 2+ (production-shaped shadow wiring, match persistence, review queue, notification delivery log, kalibrasyon). [`PRODUCT-INTENT` / `PROPOSED` — bkz. `09-NEXT-PHASE-RECOMMENDATION.md`]
- Matching V3 **legacy fanout’a bağlı değil** (`apps/web/src/server/request/distribute-request.ts` içinde `matching-v3` import yok). Durum: `SHADOW` + `TEST-ONLY`. [`CODE-VERIFIED`]
- **Create = immediate publish** (branch create path); edit path’te otomatik re-fanout yok. [`CODE-VERIFIED`]
- **Edit path iki kere bayat:** `update-request.ts` ne re-fanout çağırır (`distribute` → 0 hit) ne de understanding snapshot’ı yeniden kurar (`understanding` → 0 hit). Düzenlenen talep hem eski eşleşme kümesinde hem eski anlama kaydında kalır. [`CODE-VERIFIED` — bkz. `02` / `08` #2b]
- **Legacy zero-match tamamen sessizdir:** `distribute-request.ts:164-165` logsuz/metriksiz erken dönüş. Bugün “kaç talep hiç kimseye ulaşmadı?” sorusunun kaydı **yoktur**. [`CODE-VERIFIED` — bkz. `06`]
- **Onaylanmış sonraki dilim:** Dilim 2a — legacy fanout gözlemlenebilirliği (yalnız ölçüm, davranış değişmez). Bkz. `09`. [`PROPOSED` → **onaylandı 2026-08-22**]

## İlk yapılacak iş

1. Bu klasördeki belgeleri **okuma sırasıyla** oku (`12-CLAUDE-CODE-FIRST-PROMPT.md` ile aynı).
2. Worktree / branch / HEAD’i yeniden doğrula.
3. Handoff iddialarını kodla karşılaştır; uyuşmazlıkları listele.
4. **Kod değiştirme.** Önce read-only mimari denetim.
5. `BRANCH-WIRED` ile `PRODUCTION-DEPLOYED`’i karıştırma.

## Kesinlikle yapma

- `C:\Users\HP\Documents\Talepo` üzerinde geliştirme
- Commit / push / merge / rebase (onaysız)
- Migration, deploy, DB yazma, seed, `prisma generate`
- `npm install`, lockfile değişikliği
- Matching V3’ü `distribute-request`’e onaysız bağlama
- Bildirim gönderme / RequestMatch yazma denemesi
- `.env` okuma veya sırları yazma
- Ücretli planı relevance skoruna karıştırma
- Branch’te görmeyi “production’da çalışıyor” sanma

## Okuma sırası

1. `00-START-HERE.md` (bu dosya)
2. `01-PRODUCT-VISION-AND-TRUST-CONTRACTS.md`
3. `01A-FOUNDER-INTENT-AND-OPERATING-PRINCIPLES.md` (kurucu niyeti — kodda uygulanmış sayma)
4. `02-CURRENT-ARCHITECTURE.md`
5. `03-PHASE-HISTORY.md`
6. `04-CANONICAL-REQUEST-AND-KNOWLEDGE.md`
7. `05-QUESTION-ENGINE.md`
8. `06-MATCHING-AND-PRO-NOTIFICATIONS.md`
9. `07-TESTS-AND-EVIDENCE.md`
10. `08-KNOWN-RISKS-AND-GAPS.md`
11. `09-NEXT-PHASE-RECOMMENDATION.md`
12. `10-FILE-MAP.md`
13. `11-DECISION-LOG.md`
14. `12-CLAUDE-CODE-FIRST-PROMPT.md` (çalışma talimatı)

## Kod yazmadan önce doğrula (checklist)

- [ ] `pwd` = `...\Talepo-matching-v3`
- [ ] `git branch --show-current` = `feature/dincer-request-matching-v3`
- [ ] `git rev-parse HEAD` = beklenen HEAD (veya kullanıcı onayıyla güncel Dilim HEAD)
- [ ] `git status --short` temiz veya yalnız bilinen handoff docs
- [ ] `package-lock.json` dirty değil
- [ ] `distribute-request.ts` beklenmedik dirty değil
- [ ] Phase commit’ler: `0975ab9` → `b0e9a22` → `27806c3` ancestry
- [ ] Matching V3 import’u `distribute-request.ts` içinde yok
- [ ] İlgili verifier’lar yeşil (bkz. `07-TESTS-AND-EVIDENCE.md`)
- [ ] Deploy varsayımı yok (`PRODUCTION-STATUS-NOT-VERIFIED` kabul)

---

**Bunu ne için yapıyoruz?**  
Claude Code’un yanlış klasörde veya “branch’te var = production’da çalışıyor” yanılgısıyla kod yazmasını engellemek; alıcı ve tedarikçi güven sözleşmelerini bozmadan güvenli devam etmek için ortak bir başlangıç noktası oluşturuyoruz.
