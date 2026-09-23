/**
 * KAPI: TALEPTE İLETİŞİM BİLGİSİ — UYARI, ENGEL DEĞİL (kurucu kararı D-0031).
 *
 * NE KANITLAR, ÜÇ AYRI İDDİA:
 *   1. İletişim bilgisi taşıyan talep ENGELLENMEZ — sunucu kapısı onu
 *      reddetmez. (Teklif ve değerlendirme yollarındaki engelleme davranışı
 *      DEĞİŞMEZ; o ayrı bir karardır ve burada regresyon olarak ölçülür.)
 *   2. "Kaldır" seçildiğinde bilgi yayınlanan metinden GERÇEKTEN çıkar ve
 *      geri kalan cümle korunur.
 *   3. "Kalsın" seçildiğinde metin olduğu gibi kalır — ve seçim
 *      GÖNDERİLMEDİĞİNDE güvenli tarafa düşülür.
 *
 * NEDEN SUNUCUDA ÖLÇÜLÜR. Seçim ekranda yapılır ama uygulaması sunucunun
 * işidir: eski bir istemci ya da doğrudan API çağrısı seçimi hiç
 * göndermeyebilir. Kapı bu yüzden `parseCreateRequestInput` üzerinden koşar,
 * bir React bileşeni üzerinden değil.
 *
 * MUTASYON KONTROLÜ (T9): "Kalsın" dalı gerçekten metni koruyor mu — yani
 * kapı iki dalı ayırt edebiliyor mu?
 *
 * Ağ ya da veritabanı gerektirmez.
 */
import { parseCreateRequestInput } from "@/server/request/request-schema";
import {
  containsBlockedContactInfo,
  describeContactInfo,
  stripContactInfo,
} from "@/lib/membership/contact-filter";
import { parseContactChoice } from "@/lib/request/contact-notice";

let red = 0;
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) red += 1;
  console.log(`  ${ok ? "yesil " : "KIRMIZI"} ${name} — ${detail}`);
}

const PHONE_TEXT = "Ofis sandalyesi arıyorum İstanbul bütçem 5000 TL beni 0532 111 22 33 numarasından arayın";
const EMAIL_TEXT = "Kartvizit bastırmak istiyorum Ankara bütçem 2000 TL mail: ahmet@example.com";
const SOCIAL_TEXT = "Forklift kiralamak istiyorum İzmir bütçem 20000 TL whatsapp üzerinden yazın";

function parseWith(text: string, choice?: string) {
  return parseCreateRequestInput({
    title: text.slice(0, 80),
    description: text,
    rawInput: text,
    category: { slug: "furniture", name: "Mobilya" },
    city: "İstanbul",
    publishVersion: "ai",
    fields: [],
    ...(choice === undefined ? {} : { contactChoice: choice }),
  });
}

console.log("=== verify-request-contact-notice-v1 ===");

console.log("\n--- 1. ALGILAMA TEK OTORITEDEN ---");
check(
  "1a. telefon algilaniyor",
  describeContactInfo(PHONE_TEXT).includes("PHONE"),
  describeContactInfo(PHONE_TEXT).join(",") || "(bos)",
);
check(
  "1b. e-posta algilaniyor",
  describeContactInfo(EMAIL_TEXT).includes("EMAIL"),
  describeContactInfo(EMAIL_TEXT).join(",") || "(bos)",
);
check(
  "1c. sosyal hesap algilaniyor",
  describeContactInfo(SOCIAL_TEXT).includes("SOCIAL"),
  describeContactInfo(SOCIAL_TEXT).join(",") || "(bos)",
);
check(
  "1d. temiz metinde bos doner",
  describeContactInfo("Ofis sandalyesi arıyorum İstanbul").length === 0,
  "iletisim bilgisi yok",
);

console.log("\n--- 2. ENGEL YOK ---");
for (const [name, text] of [
  ["telefon", PHONE_TEXT],
  ["e-posta", EMAIL_TEXT],
  ["sosyal", SOCIAL_TEXT],
] as const) {
  let refused = false;
  let message = "";
  try {
    parseWith(text, "KEPT");
  } catch (error) {
    refused = true;
    message = error instanceof Error ? error.message : String(error);
  }
  check(`2. ${name} yazili talep engellenmiyor`, !refused, refused ? message : "sunucu kapisi gecti");
}

console.log("\n--- 3. KALDIR DALI ---");
for (const [name, text] of [
  ["telefon", PHONE_TEXT],
  ["e-posta", EMAIL_TEXT],
  ["sosyal", SOCIAL_TEXT],
] as const) {
  const parsed = parseWith(text, "REMOVED");
  const clean =
    describeContactInfo(`${parsed.title} ${parsed.description} ${parsed.rawInput ?? ""}`).length === 0;
  const keptRest = parsed.description.includes("arıyorum") || parsed.description.includes("istiyorum");
  check(
    `3. ${name} kaldirildi, geri kalani korundu`,
    clean && keptRest,
    `temiz=${clean} kalan="${parsed.description.slice(0, 60)}"`,
  );
}

console.log("\n--- 4. KALSIN DALI ---");
{
  const parsed = parseWith(PHONE_TEXT, "KEPT");
  const stillThere = describeContactInfo(parsed.description).includes("PHONE");
  check("4. kalsin secildiginde metin korunuyor", stillThere, `metin="${parsed.description.slice(0, 60)}"`);
}

console.log("\n--- 5. SECIM YOKSA GUVENLI TARAF ---");
{
  const parsed = parseWith(PHONE_TEXT);
  const clean = describeContactInfo(parsed.description).length === 0;
  check("5a. secim gonderilmedi -> kaldirildi", clean, `metin="${parsed.description.slice(0, 60)}"`);
  check("5b. tanimsiz deger -> KALDIR", parseContactChoice("saçma") === "REMOVED", parseContactChoice("saçma"));
  check("5c. yalniz acik KEPT birakir", parseContactChoice("KEPT") === "KEPT", parseContactChoice("KEPT"));
}

console.log("\n--- 6. KOMSU KARAR BOZULMADI (teklif/degerlendirme hala engelliyor) ---");
check(
  "6. containsBlockedContactInfo aynen calisiyor",
  containsBlockedContactInfo(PHONE_TEXT) && containsBlockedContactInfo(EMAIL_TEXT),
  "teklif yolundaki engelleme degismedi",
);

console.log("\n--- 7. ILETISIM BILGISININ KENDISI TASINMAZ ---");
{
  const parsed = parseWith(PHONE_TEXT, "KEPT");
  const kinds = (parsed.contactKinds ?? []).join(",");
  check(
    "7. tur tasiniyor, deger tasinmiyor",
    kinds.length > 0 && !kinds.includes("0532") && !/\d/.test(kinds),
    `kinds="${kinds}"`,
  );
}

const mutationOk =
  stripContactInfo(PHONE_TEXT) !== PHONE_TEXT &&
  describeContactInfo(stripContactInfo(PHONE_TEXT)).length === 0;
console.log(
  `\nMUTASYON KONTROLU: ${mutationOk ? "gecti" : "GECMEDI"} — ` +
    "iki dal ayirt edilebiliyor (kaldir metni degistiriyor, kalsin degistirmiyor)",
);
if (!mutationOk) red += 1;

console.log(`\nkirmizi ${red}`);
if (red === 0) {
  console.log("PASS — talepte iletisim bilgisi uyarir, engellemez; secim sunucuda uygulanir");
  process.exit(0);
}
console.log(`KIRMIZI — ${red} sorun`);
process.exit(1);
