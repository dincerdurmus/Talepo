/**
 * BAĞLAM MI, ARANAN ŞEY Mİ — kalıcı doğrulayıcı (2026-09-15).
 *
 * Bir talepte geçen yer ve nesne sözcükleri iki farklı rol oynar: ya aranan
 * şeydir ya da onun nerede/kimin için kullanılacağını söyleyen bağlamdır.
 * Bu ayrım yanlış yapıldığında talep sessizce yanlış tedarikçiye gider.
 *
 * Bu dosya bir SONDA değil KAPIDIR: aşağıdaki 18 girdi, bu ayrımın üç kez
 * kırıldığı ve üçünde de ölçümle yakalandığı gerçek vakaları taşır.
 *   A) "için" SONDA ise aranan şey SOLDADIR ("ev arıyorum ailem için").
 *   B) "için" ORTADA ise aranan şey SAĞDADIR ("daire için mobilya").
 *   C) İyelik eki nesne adında kategoriyi SİLMEMELİDİR
 *      ("buzdolabımın kapağı bozuldu" beyaz eşyadır).
 *
 * Beklenen kategoriler motora bakılmadan, bir insanın vereceği cevap olarak
 * yazıldı. Bir düzeltme bu dosyayı kırıyorsa düzeltme fazla geniştir.
 */
process.env.DATABASE_URL ??= "postgresql://p:p@127.0.0.1:5432/p";
import { detectCategoryResult } from "../src/lib/ai/parser/category";

/**
 * Bilinen tek açık: "kamera sistemi" kategori sözlüğünde yok, skor 0 kalıyor
 * ve kart çıkıyor (güvenli). Bağlam/özne ayrımının kusuru DEĞİLDİR; sözlük
 * boşluğudur. Sözlük tamamlanırsa bu sayı 0'a çekilmeli.
 */
const IZIN_VERILEN = 1;

/** "için" SONDA — aranan şey SOLDA. Kural tersine dönmemeli. */
const SONDA: { t: string; bekle: string }[] = [
  { t: "kiralık ev lazım öğrenci için", bekle: "real-estate" },
  { t: "ev arıyorum ailem için", bekle: "real-estate" },
  { t: "ofis arıyorum şirketim için", bekle: "real-estate" },
  { t: "dükkan arıyorum işyeri için", bekle: "real-estate" },
  { t: "arsa satın almak istiyorum yatırım için", bekle: "real-estate" },
  { t: "satılık daire bakıyorum kendim için", bekle: "real-estate" },
  { t: "koltuk takımı arıyorum salon için", bekle: "furniture" },
  { t: "buzdolabı lazım mutfak için", bekle: "appliances" },
];

/** "için" ORTADA — aranan şey SAĞDA. Kural çalışmalı. */
const ORTADA: { t: string; bekle: string }[] = [
  { t: "daire için mobilya", bekle: "furniture" },
  { t: "villa bahçesi için çim biçme makinesi", bekle: "machinery" },
  { t: "apartman girişi için kamera sistemi", bekle: "technology" },
  { t: "ev için çamaşır makinesi", bekle: "appliances" },
  { t: "dükkan için tabela", bekle: "printing" },
];

/** İyelik genişletmesinin NESNE adlarına yan etkisi. */
const NESNE: { t: string; bekle: string }[] = [
  { t: "buzdolabımın kapağı bozuldu", bekle: "appliances" },
  { t: "bilgisayarımdan veri kurtarma", bekle: "technology" },
  { t: "arabamın camı kırıldı", bekle: "automotive" },
  { t: "klimamın bakımı", bekle: "appliances" },
  { t: "dükkanımın tabelası", bekle: "printing" },
];

function bak(t: string) {
  const r = detectCategoryResult(t);
  return { cat: r.categoryId, score: r.score, confident: r.confident };
}

let kotu = 0;
function grup(ad: string, liste: { t: string; bekle: string }[]) {
  console.log(`\n=== ${ad} ===`);
  for (const c of liste) {
    const r = bak(c.t);
    const ok = r.cat === c.bekle;
    if (!ok) kotu++;
    console.log(
      `${ok ? "  " : "XX"} "${c.t}" -> ${r.cat} (skor ${r.score}${r.confident ? ", EMİN" : ""}) beklenen=${c.bekle}`,
    );
  }
}
grup("A. 'için' SONDA — aranan sey SOLDA", SONDA);
grup("B. 'için' ORTADA — aranan sey SAGDA", ORTADA);
grup("C. iyelik genisletmesi NESNE adlarinda", NESNE);
const toplam = SONDA.length + ORTADA.length + NESNE.length;
console.log(`\nSORUNLU: ${kotu}/${toplam} (izin verilen: ${IZIN_VERILEN})`);
if (kotu > IZIN_VERILEN) {
  console.log("KIRMIZI — bağlam/özne ayrımı bozuldu.");
  process.exit(1);
}
if (kotu < IZIN_VERILEN) {
  console.log(
    `İYİLEŞME — izin verilen sayı ${IZIN_VERILEN} → ${kotu} olarak güncellenmeli.`,
  );
  process.exit(1);
}
console.log("GEÇTİ.");
