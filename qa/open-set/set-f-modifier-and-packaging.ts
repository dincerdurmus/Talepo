/**
 * F KÜMESİ — NİTELEYİCİ VE AMBALAJ SÖZCÜĞÜ TUZAKLARI (holdout, 2026-09-25).
 *
 * NEDEN YENİ BİR KÜME. A/B/E kümeleri 2026-09-25 sabahı yazıldı, kilitlendi ve
 * test yarıları BİR KEZ koşuldu. Onlara satır eklemek o kilidi kırar ve ikinci
 * koşuyu bir sınav değil bir tekrar yapar. Bu yüzden akşam bulunan iki kusur
 * sınıfı için AYRI bir holdout açıldı: bu dosya HİÇBİR düzeltme yazılmadan önce
 * tamamlandı ve sonra dokunulmadı. Düzeltmeler bu dosyanın satırlarına bakarak
 * değil, kendi geliştirme sondalarım (`scripts/probe-*.ts`, gitignore'da)
 * üzerinde yazıldı.
 *
 * BEKLENTİ BİÇİMİ BİLEREK "ŞU KÖKE BAĞLANMASIN"DIR. Bir "kedi kumu kutusu"nun
 * ya da "saklama kutusu"nun DOĞRU Talepo kökü tartışmalıdır (evcil hayvan kök
 * değildir; saklama kabı Ev ve Mutfak olabilir). Tartışmalı bir etiketi hüküm
 * gibi yazmak kümeyi zayıflatırdı. Ölçülebilir ve tartışmasız olan şudur: bu
 * talepler MATBAA değildir ve matbaacının ücretli akışına düşmemelidir. Kontrol
 * satırları ise ters yönü tutar: gerçekten matbaa/beyaz eşya olan talep
 * kaybolmamalıdır.
 *
 * İKİ KUSUR SINIFI (ikisi de kendi sondamla ölçüldü, kilitli test yarısından
 * tek satır okunmadan):
 *
 *   F1 AMBALAJ/SARF SÖZCÜĞÜ ÜRÜN SANILIYOR. Matbaa sözlüğü "kutu", "poşet",
 *      "etiket", "promosyon", "karton" sözcüklerini serbest alt dizge olarak
 *      arıyor. Ölçüldü: "Kedi kumu kutusu arıyorum, kapalı model" → printing
 *      skor 4, EMİN. "Etiket makinesi arıyorum, termal" → printing skor 6,
 *      EMİN. Eksen tek: bu sözcükler matbaa ÜRÜNÜNÜ de, sıradan bir perakende
 *      nesnesini de adlandırır; ayrımı yapan şey ÜRETİM kanıtıdır (baskı,
 *      matbaa, bastırmak, ofset, selefon) ya da ambalaj malzemesi niteleyicisi
 *      (oluklu, karton, kraft, mukavva).
 *
 *   F2 ÜST ÜRÜN İZİ NİTELEYİCİ OLABİLİR. Kanonik "Çamaşır Makinesi" düğümü
 *      `çamaşır` ALIAS'ını taşır; "Bulaşık Makinesi" `bulaşık` alias'ını.
 *      Bağlaçsız cümlede üst ürün izi cümlenin HER YERİNDE aranıyor, bu yüzden
 *      "Çamaşır deterjanı arıyorum, 10 kg" → appliances %80 EMİN oluyor.
 *      Türkçe ad tamlamasında baş SONDADIR: istenen şey DETERJANDIR, çamaşır
 *      onu niteler. Alias yanlış değil (tek başına "çamaşır" makineyi
 *      adlandırabilir); yanlış olan niteleyici konumda kanıt sayılmasıdır.
 */
import type { TalepoRoot } from "./types";

export type ScopedClaimCase = {
  id: string;
  text: string;
  /** Bu kök EMİN biçimde iddia edilmemeli (asıl ölçüm). */
  mustNotClaim?: TalepoRoot;
  /** Bu kök korunmalı (kontrol satırı — düzeltme fazla şey silmesin). */
  mustClaim?: TalepoRoot;
  klass:
    | "packaging-noun"
    | "packaging-control"
    | "modifier-domain"
    | "modifier-control";
  why: string;
};

export const SET_F: readonly ScopedClaimCase[] = [
  /* ── F1 · ambalaj/sarf sözcüğü matbaa ürünü sanılıyor ──────────────── */
  { id: "f-pk-001", text: "Kedi kumu kutusu arıyorum, kapalı model", mustNotClaim: "printing", klass: "packaging-noun", why: "kutu burada kedi tuvaleti; baskı yok" },
  { id: "f-pk-002", text: "Saklama kutusu arıyorum, plastik 20 litre", mustNotClaim: "printing", klass: "packaging-noun", why: "plastik saklama kabı, matbaa ürünü değil" },
  { id: "f-pk-003", text: "Müzik kutusu arıyorum, bebek odası için", mustNotClaim: "printing", klass: "packaging-noun", why: "oyuncak; kutu sözcüğü tamlama niteleyicisi" },
  { id: "f-pk-004", text: "Takı kutusu arıyorum, kadife kaplı", mustNotClaim: "printing", klass: "packaging-noun", why: "takı saklama kabı" },
  { id: "f-pk-005", text: "Alet kutusu arıyorum, metal 3 katlı", mustNotClaim: "printing", klass: "packaging-noun", why: "takım çantası" },
  { id: "f-pk-006", text: "Buzdolabı için promosyon kodu arıyorum", mustNotClaim: "printing", klass: "packaging-noun", why: "promosyon burada indirim kodu" },
  { id: "f-pk-007", text: "Çöp poşeti arıyorum, 50 litre 20 rulo", mustNotClaim: "printing", klass: "packaging-noun", why: "sarf malzemesi, baskı talebi değil" },
  { id: "f-pk-008", text: "Buzluk poşeti arıyorum, kilitli 100 adet", mustNotClaim: "printing", klass: "packaging-noun", why: "mutfak sarfı" },
  { id: "f-pk-009", text: "Etiket makinesi arıyorum, termal yazıcı", mustNotClaim: "printing", klass: "packaging-noun", why: "etiket niteleyici, istenen şey makine" },
  { id: "f-pk-010", text: "Etiket sökücü sprey arıyorum, 500 ml", mustNotClaim: "printing", klass: "packaging-noun", why: "kimyasal sarf; etiket niteleyici" },
  { id: "f-pk-011", text: "Karton bardak arıyorum, 1000 adet 250 ml", mustNotClaim: "printing", klass: "packaging-noun", why: "tek kullanımlık bardak" },
  { id: "f-pk-012", text: "Kraft defter arıyorum, çizgisiz 80 yaprak", mustNotClaim: "printing", klass: "packaging-noun", why: "kırtasiye ürünü, baskı talebi değil" },
  { id: "f-pk-013", text: "Kumanda kutusu arıyorum, duvara monte", mustNotClaim: "printing", klass: "packaging-noun", why: "elektrik pano kutusu" },
  { id: "f-pk-014", text: "Kedi taşıma kutusu arıyorum, orta boy", mustNotClaim: "printing", klass: "packaging-noun", why: "evcil hayvan ürünü" },
  { id: "f-pk-015", text: "Ilk yardım kutusu arıyorum, araç için", mustNotClaim: "printing", klass: "packaging-noun", why: "araç sarfı; kutu niteleyici" },
  { id: "f-pk-016", text: "Fide kasası ve saksı poşeti arıyorum", mustNotClaim: "printing", klass: "packaging-noun", why: "bahçe sarfı" },
  { id: "f-pk-017", text: "Posta kutusu arıyorum, apartman girişi için", mustNotClaim: "printing", klass: "packaging-noun", why: "metal posta kutusu" },
  { id: "f-pk-018", text: "Etiket makası arıyorum, terzi için", mustNotClaim: "printing", klass: "packaging-noun", why: "el aleti" },

  /* ── F1 kontrol · gerçekten MATBAA olan talep kaybolmasın ──────────── */
  { id: "f-pc-001", text: "1000 adet kartvizit istiyorum, mat selefonlu", mustClaim: "printing", klass: "packaging-control", why: "kartvizit tartışmasız matbaa ürünü" },
  { id: "f-pc-002", text: "Oluklu kutu baskısı istiyorum, 5000 adet", mustClaim: "printing", klass: "packaging-control", why: "baskı + oluklu kutu" },
  { id: "f-pc-003", text: "Karton kutu üretimi istiyorum, 350x250x80 mm 10000 adet", mustClaim: "printing", klass: "packaging-control", why: "karton kutu ambalaj üretimi" },
  { id: "f-pc-004", text: "Kraft poşet bastırmak istiyorum, logolu 3000 adet", mustClaim: "printing", klass: "packaging-control", why: "bastırmak = üretim kanıtı" },
  { id: "f-pc-005", text: "Etiket baskısı yaptırmak istiyorum, rulo etiket", mustClaim: "printing", klass: "packaging-control", why: "etiket baskısı" },
  { id: "f-pc-006", text: "Broşür bastırmak istiyorum, A5 4 sayfa", mustClaim: "printing", klass: "packaging-control", why: "broşür tartışmasız matbaa" },
  { id: "f-pc-007", text: "Promosyon kalem bastırmak istiyorum, 500 adet logolu", mustClaim: "printing", klass: "packaging-control", why: "promosyon + bastırmak" },
  { id: "f-pc-008", text: "Ambalaj poşeti üretimi arıyorum, baskılı 20000 adet", mustClaim: "printing", klass: "packaging-control", why: "baskılı ambalaj üretimi" },
  { id: "f-pc-009", text: "Mukavva kutu arıyorum, hediye paketi için 2000 adet", mustClaim: "printing", klass: "packaging-control", why: "mukavva ambalaj malzemesi" },
  { id: "f-pc-010", text: "Dijital baskı ile etiket yaptırmak istiyorum", mustClaim: "printing", klass: "packaging-control", why: "dijital baskı" },
  { id: "f-pc-011", text: "Matbaa arıyorum, davetiye ve zarf basacak", mustClaim: "printing", klass: "packaging-control", why: "matbaa + davetiye" },
  { id: "f-pc-012", text: "Ofset baskı katalog istiyorum, 32 sayfa 5000 adet", mustClaim: "printing", klass: "packaging-control", why: "ofset + katalog" },

  /* ── F2 · üst ürün izi niteleyici konumda kanıt sayılıyor ──────────── */
  { id: "f-md-001", text: "Çamaşır deterjanı arıyorum, 10 kg toz", mustNotClaim: "appliances", klass: "modifier-domain", why: "istenen şey deterjan; çamaşır niteleyici" },
  { id: "f-md-002", text: "Çamaşır suyu arıyorum, 5 litre", mustNotClaim: "appliances", klass: "modifier-domain", why: "temizlik kimyasalı" },
  { id: "f-md-003", text: "Çamaşır yumuşatıcı arıyorum, 3 litre", mustNotClaim: "appliances", klass: "modifier-domain", why: "temizlik sarfı" },
  { id: "f-md-004", text: "Çamaşır sepeti arıyorum, hasır büyük boy", mustNotClaim: "appliances", klass: "modifier-domain", why: "ev eşyası, beyaz eşya değil" },
  { id: "f-md-005", text: "Çamaşır ipi arıyorum, 20 metre çelik", mustNotClaim: "appliances", klass: "modifier-domain", why: "hırdavat" },
  { id: "f-md-006", text: "Çamaşır mandalı arıyorum, 200 adet", mustNotClaim: "appliances", klass: "modifier-domain", why: "plastik sarf" },
  { id: "f-md-007", text: "Çamaşır kurutma askısı arıyorum, katlanır", mustNotClaim: "appliances", klass: "modifier-domain", why: "ev eşyası" },
  { id: "f-md-008", text: "Bulaşık süngeri arıyorum, 50 adet", mustNotClaim: "appliances", klass: "modifier-domain", why: "temizlik sarfı" },
  { id: "f-md-009", text: "Bulaşık eldiveni arıyorum, lateks orta boy", mustNotClaim: "appliances", klass: "modifier-domain", why: "temizlik sarfı" },
  { id: "f-md-010", text: "Bulaşık teli arıyorum, 100 adet", mustNotClaim: "appliances", klass: "modifier-domain", why: "temizlik sarfı" },
  { id: "f-md-011", text: "Çamaşır tozu toptan arıyorum, 25 kg çuval", mustNotClaim: "appliances", klass: "modifier-domain", why: "kimyasal sarf, toptan" },
  { id: "f-md-012", text: "Çamaşır boyası arıyorum, lacivert", mustNotClaim: "appliances", klass: "modifier-domain", why: "tekstil boyası ürünü" },
  { id: "f-md-013", text: "Bulaşık deterjanı tableti arıyorum, 100 adet", mustNotClaim: "appliances", klass: "modifier-domain", why: "sarf; makine değil" },
  { id: "f-md-014", text: "Çamaşır leke çıkarıcı arıyorum, 1 litre", mustNotClaim: "appliances", klass: "modifier-domain", why: "kimyasal sarf" },

  /* ── F2 kontrol · gerçek üst ürün, parça ve hizmet kaybolmasın ─────── */
  { id: "f-mc-001", text: "Çamaşır makinesi arıyorum, 9 kg A+++", mustClaim: "appliances", klass: "modifier-control", why: "bütün ürün" },
  { id: "f-mc-002", text: "Bulaşık makinesi arıyorum, ankastre 60 cm", mustClaim: "appliances", klass: "modifier-control", why: "bütün ürün" },
  { id: "f-mc-003", text: "Buzdolabı arıyorum, no frost 500 litre", mustClaim: "appliances", klass: "modifier-control", why: "bütün ürün" },
  { id: "f-mc-004", text: "Çamaşır makinesi pompası arıyorum, orijinal", mustClaim: "appliances", klass: "modifier-control", why: "parça talebi, alan korunur" },
  { id: "f-mc-005", text: "Buzdolabı rafı arıyorum, orta cam raf", mustClaim: "appliances", klass: "modifier-control", why: "parça talebi" },
  { id: "f-mc-006", text: "Çamaşır makinesi tamircisi arıyorum, Kadıköy", mustClaim: "appliances", klass: "modifier-control", why: "hizmet, alan korunur" },
  { id: "f-mc-007", text: "Bulaşık makinesi bakımı yaptırmak istiyorum", mustClaim: "appliances", klass: "modifier-control", why: "hizmet" },
  { id: "f-mc-008", text: "Çamaşır makinesi kapak kilidi arıyorum", mustClaim: "appliances", klass: "modifier-control", why: "parça talebi" },
  { id: "f-mc-009", text: "Kurutma makinesi arıyorum, ısı pompalı 8 kg", mustClaim: "appliances", klass: "modifier-control", why: "bütün ürün" },
  { id: "f-mc-010", text: "Çamaşır makinesi için servis arıyorum, su almıyor", mustClaim: "appliances", klass: "modifier-control", why: "bağlaçlı hizmet cümlesi" },
  { id: "f-mc-011", text: "Bulaşık makinesi rezistansı arıyorum, Bosch", mustClaim: "appliances", klass: "modifier-control", why: "parça + marka" },
  { id: "f-mc-012", text: "Televizyon ayağı arıyorum, duvar aparatı 55 inç", mustClaim: "technology", klass: "modifier-control", why: "parça talebi, teknoloji alanı korunur" },
  { id: "f-mc-013", text: "Klima bakımı yaptırmak istiyorum, 2 adet split", mustClaim: "appliances", klass: "modifier-control", why: "hizmet, beyaz eşya alanı" },
  { id: "f-mc-014", text: "Buzdolabı kompresörü arıyorum, inverter", mustClaim: "appliances", klass: "modifier-control", why: "parça talebi" },
  { id: "f-mc-015", text: "Çamaşır makinesi kayışı arıyorum", mustClaim: "appliances", klass: "modifier-control", why: "parça talebi" },
  { id: "f-mc-016", text: "Bulaşık makinesi sepeti arıyorum, üst sepet", mustClaim: "appliances", klass: "modifier-control", why: "parça talebi" },
];
