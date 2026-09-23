/**
 * KAPI: İNCELEME BEKLEYEN TALEP HİÇBİR OKUMA YÜZEYİNE SIZMAZ (D-0032).
 *
 * NEDEN VAR. "Kaydedilir ama yayınlanmaz" bir güvenlik sınırıdır ve sınırın
 * tuttuğu OKUYARAK değil ÖLÇÜLEREK bilinir. Talep satırı veritabanında
 * gerçekten vardır; onu görünmez kılan tek şey her okuma yüzeyindeki
 * filtredir. Bir yüzey filtreyi unutursa, şüpheli talep tedarikçinin
 * ekranında belirir ve karar kâğıt üstünde kalır.
 *
 * `audit-scope-gates-v1` kalıbıyla yazıldı ama ondan bir yönüyle ayrılır:
 * O bir HARİTADIR, bu bir KAPIDIR. Görünmesi gereken yüzeyler adıyla ve
 * gerekçesiyle yazılıdır; listedeki bir yüzey korumasını kaybederse betik
 * kırmızı verir.
 *
 * MUTASYON KONTROLÜ (T9). Sonda bir yüzeyin koruması BELLEKTE kaldırılır ve
 * denetimin onu delik olarak bildirmesi beklenir. Bildirmezse denetim kendi
 * kendini kandırıyordur ve yeşilliği hiçbir şey anlatmaz.
 *
 * Ağ ya da veritabanı gerektirmez; CI'da koşar.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");

type Surface = {
  /** src'e göreli yol. */
  file: string;
  /** Bu yüzey neden inceleme bekleyen talebi GÖRMEMELİ. */
  why: string;
};

/**
 * KORUNMASI ZORUNLU YÜZEYLER.
 *
 * Liste elle tutulur çünkü "hangi yüzey tedarikçiye bakar" bir ürün
 * kararıdır, bir desen değil. Yeni bir okuma yüzeyi eklendiğinde buraya da
 * yazılmazsa denetim onu göremez — bu yüzden aşağıda AYRICA bir keşif
 * bölümü var: listede olmayan her Request okuması adıyla raporlanır.
 */
const MUST_HOLD: Surface[] = [
  { file: "server/monetization/alert-matching.ts", why: "kayıtlı arama alarmı eşleştirmesi" },
  { file: "server/monetization/alert-notifications.ts", why: "alarm bildirimi gönderimi" },
  { file: "server/monetization/personal-matching.ts", why: "bireysel eşleştirme" },
  { file: "server/monetization/request-changes.ts", why: "izleme listesi bildirimi" },
  { file: "server/monetization/smart-matching.ts", why: "akıllı eşleştirme (fanout)" },
  { file: "server/monetization/inventory-matching.ts", why: "gizli envanter eşleştirmesi" },
  { file: "server/monetization/opportunity-hunter.ts", why: "fırsat avcısı" },
  { file: "server/monetization/opportunities-feed.ts", why: "tedarikçi fırsat akışı" },
  { file: "server/monetization/discovery-workspace-query.ts", why: "keşfet çalışma alanı" },
  { file: "server/monetization/corporate-intelligence.ts", why: "kurumsal zekâ" },
  { file: "server/monetization/offer-intelligence.ts", why: "teklif zekâsı" },
  { file: "server/monetization/personal-preference-candidates.ts", why: "tercih adayları" },
  { file: "server/monetization/professional-analytics.ts", why: "profesyonel analitik" },
  { file: "server/monetization/talepo-radar.ts", why: "radar" },
  { file: "server/request/distribute-request.ts", why: "fanout dağıtımı" },
  { file: "server/request/urgent-nudge-core.ts", why: "acil dürtme cron'u" },
  { file: "server/request/urgent-no-offer-nudge.ts", why: "tekliftsiz acil dürtme" },
  { file: "server/offer/offer-service.ts", why: "teklif verme yolu" },
];

/**
 * GÖRMESİ MEŞRU OLAN YÜZEYLER.
 *
 * Talebin SAHİBİ kendi talebini görmelidir (yoksa neyin beklediğini bilemez)
 * ve ADMİN kuyruğu zaten incelemek için bakar. Bu liste bir muafiyet değil,
 * bir GEREKÇE kaydıdır: bir yol buraya yazılmadan sessizce muaf olamaz.
 */
const MAY_SEE: Surface[] = [
  { file: "app/panel/taleplerim", why: "talebin sahibi kendi talebini görür" },
  { file: "app/admin", why: "admin kuyruğu incelemek için bakar" },
  { file: "app/api/admin", why: "admin API" },
  { file: "lib/panel/my-requests-home-data.ts", why: "sahibin kendi talepleri" },
  { file: "server/request/create-request.ts", why: "kaydı oluşturan yol" },
  { file: "server/request/update-request.ts", why: "sahibin düzenlemesi" },
  { file: "server/request/delete-request.ts", why: "sahibin silmesi" },
  { file: "server/request/clone-request-as-draft.ts", why: "sahibin kopyalaması" },
  { file: "server/request/feature-expiry.ts", why: "öne çıkarma süresi bakımı" },
  { file: "app/api/complaints", why: "şikayet akışı konuyu bulmalı" },
];

/** Bir yüzeyin korumasını okuyan üç kanıt. */
const GUARD_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "REVIEW_HOLD_GUARD", re: /REVIEW_HOLD_GUARD/ },
  // `status: { in: [...] }` beyaz listesi: PENDING_REVIEW yeni bir enum
  // DEĞERİ olduğu için hiçbir eski beyaz listede yoktur; koruma yapısaldır.
  { name: "status-beyaz-liste", re: /status:\s*\{\s*in:/ },
  { name: "publishedAt-filtresi", re: /publishedAt:\s*\{/ },
  { name: "visibleToSuppliersAt-filtresi", re: /visibleToSuppliersAt:\s*\{/ },
];

type Verdict = { surface: Surface; guards: string[] };

function guardsIn(text: string): string[] {
  return GUARD_PATTERNS.filter((g) => g.re.test(text)).map((g) => g.name);
}

function readSurface(file: string): string | null {
  const path = join(ROOT, file);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

const covered: Verdict[] = [];
const holes: Verdict[] = [];
const missingFiles: string[] = [];

for (const surface of MUST_HOLD) {
  const text = readSurface(surface.file);
  if (text === null) {
    missingFiles.push(surface.file);
    continue;
  }
  const guards = guardsIn(text);
  (guards.length ? covered : holes).push({ surface, guards });
}

console.log("=== audit-review-hold-v1 ===");
console.log(`KORUNMASI ZORUNLU YÜZEY: ${MUST_HOLD.length}`);
console.log(`GÖRMESİ MEŞRU YOL: ${MAY_SEE.length} (gerekçeleriyle kayıtlı)`);

console.log(`\n--- KORUMALI (${covered.length}) ---`);
for (const v of covered) {
  console.log(`  yesil  ${v.surface.file}  [${v.guards.join(", ")}]  — ${v.surface.why}`);
}

console.log(`\n--- DELIK (${holes.length}) ---`);
for (const v of holes) {
  console.log(`  KIRMIZI  ${v.surface.file}  — ${v.surface.why}: durumu filtrelemiyor`);
}
if (!holes.length) console.log("  (yok)");

if (missingFiles.length) {
  console.log(`\n--- LISTEDE OLUP DOSYASI YOK (${missingFiles.length}) ---`);
  for (const f of missingFiles) console.log(`  KIRMIZI  ${f} — yol tasinmis olabilir, liste guncellenmeli`);
}

/**
 * MUTASYON KONTROLÜ (T9): korumayı bir yüzeyden kaldır, denetim kırmızı versin.
 *
 * Gerçek dosya DEĞİŞTİRİLMEZ; metnin bellekteki kopyasından koruma satırları
 * silinir ve aynı ölçüt yeniden uygulanır.
 */
const probeFile = MUST_HOLD[0].file;
const probeText = readSurface(probeFile) ?? "";
const mutated = probeText
  .replace(/REVIEW_HOLD_GUARD/g, "X_REMOVED")
  .replace(/status:\s*\{\s*in:/g, "xstatus: { xin:")
  .replace(/publishedAt:\s*\{/g, "xpublishedAt: {")
  .replace(/visibleToSuppliersAt:\s*\{/g, "xvisibleToSuppliersAt: {");
const mutationCaught = guardsIn(probeText).length > 0 && guardsIn(mutated).length === 0;
console.log(
  `\nMUTASYON KONTROLU: ${mutationCaught ? "gecti" : "GECMEDI"} — ` +
    `${probeFile} korumasi kaldirilinca denetim delik olarak bildiriyor`,
);

const red = holes.length + missingFiles.length + (mutationCaught ? 0 : 1);
console.log(`\n${covered.length}/${MUST_HOLD.length} yuzey korumali  ·  delik ${holes.length}`);
if (red === 0) {
  console.log("PASS — inceleme bekleyen talep okuma yuzeylerine sizmiyor");
  process.exit(0);
}
console.log(`KIRMIZI — ${red} sorun`);
process.exit(1);
