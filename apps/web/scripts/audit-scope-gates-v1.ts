/**
 * DENETİM: KAPSAM KAPILARI NEREDE OKUNUYOR (2026-09-21).
 *
 * NEDEN VAR. "İlaç talebi hiçbir yerde ilerlemesin" bir güvenlik sınırıdır;
 * sınırın tutup tutmadığı OKUYARAK değil ÖLÇÜLEREK bilinir. Bu betik depoyu
 * tarar ve kapsam kararının kimler tarafından okunduğunu listeler:
 *
 *   A. `isUnsupportedRequestScope(...)` çağıranlar  → kapı OTOMATİK kapandı
 *      (yeni bir kapsam değeri eklendiğinde de kapanır)
 *   B. kapsam değerlerini ELLE sayanlar             → DELİK ADAYI
 *      ("UNSUPPORTED_SUPPLY" === x gibi; yeni değer eklenince sessizce açık kalır)
 *   C. `requestScope` alanını okuyup hiç kapı kurmayanlar → İNCELENECEK
 *
 * Hiçbir şeyi değiştirmez, hiçbir şeyi kırmızıya bağlamaz. Haritadır.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const KOK = join(process.cwd(), "src");
const UZANTI = /\.(ts|tsx|mts)$/;

const HELPER = /isUnsupportedRequestScope\s*\(/;
const ELLE = /["'`]UNSUPPORTED_(SUPPLY|MEDICAL_ADVICE|PHARMACY|REMOVED_SCOPE)["'`]/;
const ALAN = /requestScope/;
/** Tip tanımı ve union'ın kendisi "elle sayma" değildir. */
const TIP_DOSYASI = /request-understanding[\\/]types\.ts$/;

type Bulgu = { dosya: string; helper: number; elle: number; alan: number };
const bulgular: Bulgu[] = [];

function gez(dizin: string): void {
  for (const ad of readdirSync(dizin)) {
    const tam = join(dizin, ad);
    const st = statSync(tam);
    if (st.isDirectory()) {
      if (ad === "node_modules" || ad === ".next") continue;
      gez(tam);
      continue;
    }
    if (!UZANTI.test(ad)) continue;
    const metin = readFileSync(tam, "utf8");
    if (!ALAN.test(metin) && !HELPER.test(metin) && !ELLE.test(metin)) continue;
    const say = (re: RegExp) => metin.split("\n").filter((l) => re.test(l)).length;
    bulgular.push({
      dosya: relative(process.cwd(), tam),
      helper: say(HELPER),
      elle: TIP_DOSYASI.test(tam) ? 0 : say(ELLE),
      alan: say(ALAN),
    });
  }
}

gez(KOK);

const A = bulgular.filter((b) => b.helper > 0);
const B = bulgular.filter((b) => b.helper === 0 && b.elle > 0);
const C = bulgular.filter((b) => b.helper === 0 && b.elle === 0 && b.alan > 0);

console.log("=== audit-scope-gates-v1 ===");
console.log(`taranan dosya: ${bulgular.length} (kapsamla ilgili)`);

console.log(`\n--- A. TEK YARDIMCIYI OKUYANLAR (${A.length}) — yeni deger otomatik kapatir ---`);
for (const b of A) console.log(`  ${b.dosya}  (helper x${b.helper})`);

console.log(`\n--- B. KAPSAM DEGERLERINI ELLE SAYANLAR (${B.length}) — DELIK ADAYI ---`);
for (const b of B) console.log(`  ${b.dosya}  (elle x${b.elle})`);
if (!B.length) console.log("  (yok)");

/**
 * C LISTESI ICIN INCELEME KAYDI (2026-09-21).
 *
 * "Incelenecek" bir durum degil bir borctur; kapanisi yaziya gecmezse liste
 * her kosuda ayni satirlari basar ve kimse hangisine bakildigini bilmez.
 * Asagidaki kayit yalniz BAKILMIS dosyalari tasir ve gerekcesini soyler.
 * Kayitta olmayan bir dosya C'ye girdigi anda INCELENMEDI olarak isaretlenir
 * - yani kapsam okuyan yeni bir yuzey sessizce "bakildi" sayilmaz.
 */
const C_INCELEME: Record<string, string> = {
  "src/app/api/admin/health/route.ts":
    "ad cakismasi - yerel requestScope(filters) Prisma filtresi uretir, kapsam karariyla ilgisi yok",
  "src/lib/request/publish-understanding.ts":
    "karari snapshot'a TASIR; yetki sunucu kapisindadir (request-schema), burada kapi kurulmaz",
  "src/lib/request/understanding-snapshot.ts":
    "snapshot alan tanimi - denetim kaydi, karar uretmez",
  "src/lib/request-composer/v2/composer-flow.ts":
    "karari publish-readiness'e GECIRIR; kapi orada tek yardimciyla kurulur",
};

console.log(`\n--- C. requestScope OKUYUP KAPI KURMAYANLAR (${C.length}) — incelenecek ---`);
let incelenmemis = 0;
for (const b of C) {
  const anahtar = b.dosya.split("\\").join("/");
  const not = C_INCELEME[anahtar];
  if (not) {
    console.log(`  ${b.dosya}  (alan x${b.alan})  -- incelendi: ${not}`);
  } else {
    incelenmemis += 1;
    console.log(`  ${b.dosya}  (alan x${b.alan})  -- INCELENMEDI`);
  }
}
if (!C.length) console.log("  (yok)");
if (incelenmemis > 0) {
  console.log(`\n  ${incelenmemis} dosya INCELENMEDI - kapsam okuyan yeni yuzey var.`);
}

console.log("\nBu bir HARITADIR, kapi degil. B listesi bosalmadan 'her yuzeyde kapali' denemez.");
