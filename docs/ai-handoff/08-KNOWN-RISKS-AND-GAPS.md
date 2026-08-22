# 08 — Known Risks and Gaps

Önem sırasıyla. Etiketler: kanıt `CODE-VERIFIED` / `TEST-VERIFIED` / `PRODUCT-INTENT` / `NOT-VERIFIED`.

| # | Risk | Kanıt | Etki | Olasılık | Güven sözleşmesi | Önerilen sıra |
|---|------|-------|------|----------|------------------|---------------|
| 1 | Legacy fanout yalnız kategori+şehir; brand/model yok | distribute-request | Pro yanlış/kaçırma | Yüksek | Sözleşme 2 | V3 shadow→measured wire |
| 2 | Zero-match kaybı — **kayıp sürüyor, görünmezliği bitti** | `distribute-request.ts:253` artık `zero_match` olayı üretir (`466436b`); ama ops queue hâlâ yok ve **sink doğrulanmadı** | Talep hâlâ kaybolur; artık ölçülebilir — fakat sink bağlanana kadar hiçbir sayı sorgulanamaz | Yüksek → **Orta** (ölçülebilirlik kazanıldı) | 1+2 | Sink doğrulama kapısı → sonra ops queue (Dilim 3) |
| 2b | Edit sonrası **hem** re-fanout **hem** snapshot rebuild yok | `update-request.ts`: `distribute` → 0 hit, `understanding` → 0 hit; `:162-163` yalnız client projection’ı yazar | Talep hem eski eşleşmede hem **eski anlama kaydında** kalır; audit yanlış metni anlatır | **Orta-Yüksek** | 1+2 | rawInput revizyon dilimi (`DECIDED-NOT-IMPLEMENTED`) |
| 2c | BTU / capacity schema–runtime boşluğu | capacityBtu schema; number-role’da extractor yok | Klima taleplerinde eksik attribute | Orta | UX + match | number-role + lexicon dilimi |
| 3 | Tarama cap 200/300/40 **+ backfill 100 + estimator 400** | `:161`/`:193`/`:230`/`:522`/`:680` | Uygun firma dışarıda | Orta | 2 | **Cap doygunluk telemetrisi uygulandı** (`466436b`): her tarama olayı `cap` + `found` + `capSaturated` taşır, böylece doygunluk **oranı** hesaplanabilir. Kaldırma kararı canlı veriye bağlı |
| 3b | İkinci RequestMatch yazıcısı — **artık belgeli ve ölçülü** | `backfillMatchesForCompany` (`:431+`), `:577` ikinci `createMany`; `request.backfill.*` span’i | Ölçüm ve dedupe tasarımı artık bu yolu görebiliyor | Düşük-Orta | 2 | Sink sonrası hacim ölçümü (aşağıda #25) |
| 3c | **Projection AI metninden kurulabiliyor** | `create-request.ts:46-50` fallback zinciri `rawInput → description → professionalDescription → title`; provenance kaydı yok | Türetilmiş taxonomy/constraint okuması AI yorumuna dayanabilir, kaynağı izlenemez | Düşük-Orta | 1 | Provenance alanı (revizyon dilimiyle birlikte) |
| 4 | Yanlış category resolution / user lock | composer + fanout FK | Yanlış havuz | Orta | 2 | Guidance + soft category + V3 channels |
| 5 | Çoklu category authority drift | engine/Prisma/taxonomy | Bug + yanlış match | Orta | 2 | Namespace disiplin (V3 başladı) |
| 6 | Product/brand/model role hataları | entity-roles; A55/Bosch örnekleri | Yanlış soru + match | Orta | 2 | Lexicon + pair evidence |
| 7 | Alias çakışmaları (pompa, digger, …) | taxonomy-drift digger; V3 water-pump | Yanlış aday | Orta | 2 | Alias governance |
| 8 | Katalog dışı ürün | accept-free-text kuralı + authority test | Engel riski (mitige) | Düşük-Orta | 1 | unresolved + product preserve |
| 9 | Question profile boşlukları (6 kategori) | profiles satır yoğunluğu | Eksik/ fazla soru | Orta | UX + match kalitesi | Profile genişletme dilimleri |
| 10 | Gereksiz / eksik kritik soru | scheduler importance | Süre / kötü teklif | Orta | UX | Scheduler ölçümü |
| 11 | Bildirim retry/delivery log zayıf | fire-and-forget void.catch | Kayıp bildirim | Orta | 2 | Delivery log + queue |
| 12 | Çift bildirim (fanout+alert+hunter) | paralel void çağrılar | Gürültü | Orta | Güven/UX | Dedupe keys |
| 13 | Unresolved operasyon kuyruğu yok | no queue model wired | Sessiz belirsizlik | Yüksek | 1 | Ops review Dilim |
| 14 | Gerçek supplier expertise eksik | V3 synthetic profiles | Kalibrasyon imkânsız | Yüksek | 2 | Expertise model + adapters |
| 15 | Semantic/vector retrieval yok | fanout’ta vector path yok | Recall tavanı | Orta (şimdilik OK) | 2 | **Erken ekleme** — kalibrasyondan sonra |
| 16 | Precision/recall / eşik kalibrasyonu yok | V3 thresholds “uncalibrated” yorumları | Yanlış EXACT | Yüksek | 2 | Labeling + shadow metrics |
| 17 | PII / hassas veri | rawInput serbest metin | Gizlilik | Orta | Trust | Sanitize + retention policy |
| 18 | Attachment eksikliği | schema/UI | Kanıt zayıf talep | Düşük-Orta | UX | Ayrı dilim |
| 19 | Admin/kürasyon yüzeyi eksik | no match review UI | Ops kör | Yüksek | 1+2 | Review queue UI |
| 20 | **rawInput üzerine yazılabilir; revizyon/aktör/zaman kaydı yok** | `update-request.ts:155-156` açık payload alanı geri dönüşsüz değiştirir | Kullanıcının orijinal metni denetlenemez biçimde kaybolur (Sözleşme 1) | Orta | 1 | Revizyon şeması — karar verildi, `DECIDED-NOT-IMPLEMENTED` (`11`) |
| 21 | **Verifier’ların hiçbiri npm script / CI değil** | `package.json`’da yalnız `verify:core` ve `verify:phase4b`; handoff’un dayandığı **12** verifier (yeni `verify-fanout-telemetry-v1` dahil) kayıtlı değil | Phase 1/2/3 güvenceleri otomatik regresyon koruması altında **değil**; sözleşme bozulursa kimse yakalamaz | **Yüksek** | 1+2 | Verifier’ları script’e bağla (ayrı küçük dilim) — Dilim 2a bunu bilinçli olarak kapsam dışında bıraktı |
| 22 | **Bildirim dedupe asimetrisi** | `requestMatch.createMany` `skipDuplicates: true` (`:273`/`:577`) ama `notification.createMany` (`:375`) dedupe’suz | Aynı kullanıcıya tekrarlı bildirim | Orta | Güven/UX | Hacmi artık `notifications_written` olayının `dedupeFiltered` alanıyla ölçülebilir; düzeltme hâlâ revizyon × firma idempotency (`DECIDED-NOT-IMPLEMENTED`) |
| 23 | **Log sink’i doğrulanmamış** — olay üretmek ≠ ölçebilmek | `addLogSink`’in `src/` altında **0 çağrısı** var; `instrumentation.ts` sink kaydetmiyor → olaylar yalnız stdout. `PRODUCTION-SINK-NOT-VERIFIED` | “Telemetri var” sanılır, hiçbir sayı sorgulanamaz; Dilim 2b önkoşulu sahte biçimde sağlanmış görünür | **Yüksek** — Dilim 2a sonrası **en kritik açık risk** | 2 | Sink doğrulama kapısı + non-blocking kabul kriteri (`09`, `11` Karar D). `verify-fanout-telemetry-v1` sink kaydedilirse kırmızıya döner |
| 24 | Konum telemetrisinde yeniden kimliklendirme riski — **mitige edildi** | Karar C uygulandı (`466436b`): yalnız `locationScope` + allowlist `provinceCode` (`TR-NN`) + `resolutionStatus`; ilçe API’si yok; ham metin çözümleyiciden çıkmaz; `matchReason` (`Şehir (…)`) hiçbir olayda geçmez | Kalan risk düşük: il × kategori × zaman damgası çok küçük illerde hâlâ daraltıcı olabilir | Düşük | Trust | Retention politikası (#17 ile birlikte) |
| 25 | **Backfill telemetri hacmi ölçülmedi** | `backfillMatchesForCompany`, `panel/talepler/page.tsx:206`’da her sayfa render’ında koşulsuz çalışır → **görüntüleme başına 2 olay** | Sink’e bağlanınca beklenmeyen hacim/maliyet; sessiz sampling’e kaçma baskısı | Orta | 2 | Sink öncesi beklenen günlük hacmi ölç. Sampling yapılırsa `samplingRate` **açıkça** loglanmalı ve metrikler ağırlıklandırılmalı; **sessiz sampling kabul edilmez** (`09`) |

---

**Bunu ne için yapıyoruz?**  
Önce en çok “Pro’nun iş kaçırması” ve “alıcı talebinin kaybolması”na yol açan delikleri sıralıyoruz; süs özelliklerden önce güveni onaracak dilimleri seçmek için.
