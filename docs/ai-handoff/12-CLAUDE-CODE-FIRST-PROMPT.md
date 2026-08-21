# 12 — Claude Code First Prompt

Aşağıdaki bloğu Claude Code’a **ilk mesaj** olarak yapıştır. Bu prompt kod değişikliği istemez.

---

## FIRST PROMPT (copy/paste)

```text
Sen Talepo için devralan geliştirme ajanısın. Bu turda KOD DEĞİŞTİRMEYECEKSİN.

Çalışma kökü (zorunlu):
C:\Users\HP\Documents\Talepo-matching-v3

Yasak kök:
C:\Users\HP\Documents\Talepo

Beklenen branch: feature/dincer-request-matching-v3
Beklenen HEAD (handoff anı): 27806c33bf544aa912e6ea2423623e01ffa18310
(HEAD ilerlemişse bunu raporla; sessizce başka branch’e geçme.)

## Adım 1 — Handoff oku (zorunlu sıra)
docs/ai-handoff/00-START-HERE.md
docs/ai-handoff/01-PRODUCT-VISION-AND-TRUST-CONTRACTS.md
docs/ai-handoff/01A-FOUNDER-INTENT-AND-OPERATING-PRINCIPLES.md
docs/ai-handoff/02-CURRENT-ARCHITECTURE.md
… 03 … 11 …
docs/ai-handoff/12-CLAUDE-CODE-FIRST-PROMPT.md

01A = PRODUCT-INTENT. Kodda uygulanmış kabul etme.

## Adım 2 — Ürün vizyonunu kendi cümlelerinle geri anlat (kod yazmadan ÖNCE zorunlu)
1) Talepo’nun ne olduğunu ve ne olmadığını 5–8 cümleyle yaz.
2) Kurucunun iki temel korkusunu yaz.
3) Şu listeyi çıkar:
   - 10 değişmez ilke
   - 5 anti-hedef (yapılmaması gerekenler / yanlış başarı tanımları)
   - Hâlâ belirsiz olan kararlar (handoff’ta PRODUCT-INTENT veya açık politika boşluğu olanlar)
Bu adım olmadan mimari denetime veya öneriye geçme.

## Adım 3 — Git doğrula
- git status --short
- branch, HEAD, upstream, local==remote
- worktree list
- package-lock ve distribute-request dirty mi?
Hiçbir commit/push/checkout/merge yapma.

## Adım 4 — Read-only mimari denetim
Handoff iddialarını kodla karşılaştır. Özellikle doğrula:
1) rawInput: AI/professionalDescription otomatik ezemez; açık update payload alanı değiştirebilir (update-request.ts) — immutability politikası açık değil
2) understanding snapshot / unresolved category (Phase 1)
3) question scheduler MAX_VISIBLE=3 ve publish readiness budget/location (Phase 2)
4) matching-v3 shadow; distribute-request içinde matching-v3 import YOK (Phase 3 Dilim 1)
5) Relevance / delivery policy / notification ayrımı
6) Missing ≠ excluded; brandModelPairs; plan-independent scoring
7) BRANCH-WIRED ≠ PRODUCTION-DEPLOYED (deploy kanıtı yoksa PRODUCTION-STATUS-NOT-VERIFIED)

Her bulguyu etiketle: CODE-VERIFIED | GIT-VERIFIED | TEST-VERIFIED | NOT-VERIFIED | CONFLICT-WITH-HANDOFF
| BRANCH-WIRED | SHADOW | TEST-ONLY | PRODUCTION-DEPLOYED | PRODUCTION-STATUS-NOT-VERIFIED

## Adım 5 — Güvenli test (isteğe bağlı)
Yalnız npx tsx ile mevcut verifier’lar. npm install / prisma generate / dev server / browser / migration YASAK.
Beklenen yeşil set: matching-v3-shadow, request-authority, taxonomy-drift, request-composer-v2-* 

## Adım 6 — Çıktı (kod yok)
Raporla:
A) Worktree/branch/HEAD
B) Ürün vizyonu geri anlatımı + 10 ilke / 5 anti-hedef / belirsiz kararlar
C) Handoff ile kod çatışmaları
D) BRANCH-WIRED vs SHADOW vs TEST-ONLY vs PRODUCTION-STATUS-NOT-VERIFIED ayrımı
E) En kritik 5 risk (senin doğrulaman)
F) Tek sonraki güvenli uygulama dilimi önerisi (docs/09 ile karşılaştır; kör kopyalama)
G) Hâlâ doğrulanamayanlar
H) rawInput sözleşmesinin kodla uyumu

Sonra DUR. Uygulama dilimine ancak insan onayı sonrası geç.
```

---

**Bunu ne için yapıyoruz?**  
Yeni ajanın önce ürün sahibinin korkularını ve ilkelerini sindirmeden fanout’a veya süs özelliğe atlamasını engellemek; önce niyet, sonra harita, sonra tek güvenli adım.
