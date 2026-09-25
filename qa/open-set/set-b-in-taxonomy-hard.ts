/**
 * B KÜMESİ — GERÇEKTEN İÇERİDE OLAN ZOR TALEPLER (2026-09-25).
 *
 * NE ÖLÇER. Kök düzeltmesinin YANLIŞ ALARM maliyetini. A kümesi "hiçbiri
 * diyebiliyor mu" sorusunu ölçer; tek başına ölçülürse en güvenli sistem
 * "her şeye hiçbiri de" olurdu. B o bedeli ölçer: sınırda duran ama gerçekten
 * 11 kökün içinde olan talepler kuyruğa ya da HİÇBİRİ'ne düşüyor mu.
 *
 * ZORLUK EKSENLERİ (her satırda `hardness` ile işaretli):
 *   jargon        — sektör dili ("abkant pres", "PoE switch", "NVMe")
 *   brand-product — marka + ürün ("Siemens iQ700 bulaşık makinesi")
 *   unusual-name  — olağandışı / uzun kanonik ad ("ana kucağı", "vestiyer")
 *   abbreviation  — kısaltma ("CNC", "UPS", "SSD", "3+1")
 *
 * ETİKET NASIL VERİLDİ. `root` her satır için ELLE verildi ve `data/taxonomy`
 * ağacına karşı okundu. Etiketin doğruluğu bir DAYANAK ölçümüyle karıştırılmaz:
 * `verify-open-set-v1` her satır için kanonik dayanağın bulunup bulunmadığını
 * AYRICA raporlar. Etiket var ama dayanak yoksa bu bir katalog boşluğudur ve
 * ölçülmesi gereken şeydir — kümeden silinmesi gereken bir hata değildir.
 */
import type { InTaxonomyCase, TalepoRoot } from "./types";

type Row = [text: string, hardness: InTaxonomyCase["hardness"], why: string];

function build(root: TalepoRoot, prefix: string, rows: Row[]): InTaxonomyCase[] {
  return rows.map(([text, hardness, why], i) => ({
    id: `b-${prefix}-${String(i + 1).padStart(2, "0")}`,
    root,
    text,
    hardness,
    why,
  }));
}

/* ── BEYAZ EŞYA ──────────────────────────────────────────────────────── */
const APPLIANCES = build("appliances", "app", [
  ["Ankastre ocak arıyorum, 4 gözlü cam yüzeyli", "unusual-name", "ankastre kanonik ad"],
  ["No-frost derin dondurucu arıyorum, 300 litre", "jargon", "no-frost sektör dili"],
  ["Siemens iQ700 bulaşık makinesi arıyorum", "brand-product", "marka + model + ürün"],
  ["Beko çamaşır makinesi arıyorum, 10 kg 1400 devir", "brand-product", "marka + ürün"],
  ["Arçelik derin dondurucu arıyorum, 7 çekmeceli", "brand-product", "marka + ürün"],
  ["Davlumbaz arıyorum, ada tipi 90 cm", "unusual-name", "ada tipi davlumbaz"],
  ["Şofben arıyorum, hermetik 24 kW", "jargon", "hermetik şofben"],
  ["Termosifon arıyorum, 80 litre emaye", "unusual-name", "termosifon kanonik ad"],
  ["Airfryer arıyorum, 5,5 litre dijital", "abbreviation", "yabancı ürün adı"],
  ["Robot süpürge arıyorum, lazer haritalamalı", "jargon", "lazer haritalama"],
  ["Kurutma makinesi arıyorum, ısı pompalı 9 kg", "jargon", "ısı pompalı kurutucu"],
  ["Split klima arıyorum, 18 bin BTU inverter", "abbreviation", "BTU kısaltması"],
  ["Kombi arıyorum, yoğuşmalı 24 kW", "jargon", "yoğuşmalı kombi"],
  ["Ankastre mikrodalga arıyorum, çerçeveli", "unusual-name", "ankastre mikrodalga"],
  ["Aspiratör arıyorum, sanayi tipi çatı fanı", "jargon", "sanayi aspiratör"],
  ["Su sebili arıyorum, damacanalı sıcak soğuk", "unusual-name", "su sebili"],
  ["Hava temizleyici arıyorum, HEPA filtreli", "abbreviation", "HEPA kısaltması"],
  ["Bosch marka ankastre fırın arıyorum, pirolitik", "brand-product", "marka + pirolitik jargon"],
  ["Su arıtma cihazı arıyorum, 5 aşamalı membranlı", "jargon", "membran filtre dili"],
  ["Blender arıyorum, 1500 watt cam sürahili", "unusual-name", "blender kanonik ad"],
  ["Buharlı kazanlı ütü arıyorum, 6 bar", "jargon", "kazanlı ütü"],
  ["Doğalgaz sobası arıyorum, 3 adet bacalı", "unusual-name", "doğalgaz sobası"],
  ["Epilasyon aleti arıyorum, IPL teknolojili", "abbreviation", "IPL kısaltması"],
]);

/* ── TEKNOLOJİ ───────────────────────────────────────────────────────── */
const TECHNOLOGY = build("technology", "tech", [
  ["NVMe SSD arıyorum, 2 TB PCIe 4.0", "abbreviation", "NVMe / PCIe kısaltmaları"],
  ["PoE switch arıyorum, 24 port yönetilebilir", "abbreviation", "PoE kısaltması"],
  ["Rack kabinet arıyorum, 42U 800 derinlik", "jargon", "rack ünitesi"],
  ["UPS arıyorum, 3 kVA online çift dönüşüm", "abbreviation", "UPS / kVA"],
  ["ERP yazılımı arıyorum, üretim modülü dahil", "abbreviation", "ERP kısaltması"],
  ["Zebra barkod yazıcı arıyorum, termal transfer", "brand-product", "marka + ürün + jargon"],
  ["Ubiquiti access point arıyorum, 6 adet", "brand-product", "marka + yabancı ürün adı"],
  ["Grafik kartı arıyorum, 16 GB VRAM", "abbreviation", "VRAM kısaltması"],
  ["Sunucu arıyorum, 2U çift işlemcili", "jargon", "2U form faktörü"],
  ["Yazar kasa POS cihazı arıyorum, GİB onaylı", "abbreviation", "GİB kısaltması"],
  ["Dizüstü bilgisayar arıyorum, 32 GB RAM mühendislik için", "abbreviation", "RAM kısaltması"],
  ["Monitör arıyorum, 27 inç 4K IPS panel", "abbreviation", "4K / IPS"],
  ["Kurumsal web sitesi yaptırmak istiyorum, çok dilli", "unusual-name", "hizmet niyeti + web sitesi"],
  ["Mobil uygulama geliştirme arıyorum, iOS ve Android", "brand-product", "platform adları"],
  ["Tablet arıyorum, kalem destekli 12 inç", "unusual-name", "kalem destekli tablet"],
  ["Ağ kablolama altyapısı arıyorum, Cat6 500 metre", "jargon", "Cat6 kablolama"],
  ["Akıllı telefon arıyorum, 256 GB hafızalı", "unusual-name", "akıllı telefon kanonik ad"],
  ["Güvenlik kamerası sistemi arıyorum, 8 kanal NVR", "abbreviation", "NVR kısaltması"],
  ["Barkod okuyucu arıyorum, 2D kablosuz 10 adet", "abbreviation", "2D barkod"],
  ["Projeksiyon cihazı arıyorum, 4000 ansi lümen", "jargon", "ansi lümen"],
  ["Harici disk arıyorum, 4 TB USB-C", "abbreviation", "USB-C"],
  ["Güvenlik duvarı arıyorum, 200 kullanıcılı lisans", "jargon", "firewall/lisans"],
  ["Kablosuz klavye ve mouse seti arıyorum, 20 takım", "unusual-name", "çevre birimi"],
]);

/* ── OTOMOTİV ────────────────────────────────────────────────────────── */
const AUTOMOTIVE = build("automotive", "auto", [
  ["Bosch marş motoru arıyorum, Transit için", "brand-product", "marka + parça + araç"],
  ["Triger seti arıyorum, devirdaim dahil", "jargon", "triger seti / devirdaim"],
  ["Debriyaj balatası arıyorum, orijinal", "jargon", "debriyaj balatası"],
  ["Turbo hortumu arıyorum, 2.0 dizel", "jargon", "turbo hortumu"],
  ["Michelin Primacy 4 arıyorum, 205/55 R16", "brand-product", "marka + model + ebat"],
  ["Clio için ön amortisör arıyorum", "brand-product", "model + parça"],
  ["Rot başı ve rotil arıyorum, takım hâlinde", "jargon", "rot başı / rotil"],
  ["Enjektör temizliği yaptırmak istiyorum", "jargon", "enjektör servisi"],
  ["Kampanalı fren balatası arıyorum, kamyonet", "jargon", "kampanalı fren"],
  ["Çıkma kaput arıyorum, hasarsız", "jargon", "çıkma parça dili"],
  ["Sedan araç arıyorum, 2019 model otomatik", "unusual-name", "araç satın alma"],
  ["Jant kapağı arıyorum, 16 inç 4 adet", "unusual-name", "jant kapağı"],
  ["Aracımın periyodik bakımını yaptırmak istiyorum", "unusual-name", "iyelikli araç + bakım"],
  ["Kış lastiği arıyorum, 225/45 R17 4 adet", "abbreviation", "lastik ebadı"],
  ["Şanzıman yağı değişimi yaptırmak istiyorum", "jargon", "şanzıman servisi"],
  ["Motosiklet için zincir dişli seti arıyorum", "jargon", "zincir dişli"],
  ["Akü arıyorum, 72 amper start stop uyumlu", "jargon", "start stop akü"],
  ["Silecek lastiği arıyorum, 60 cm 4 adet", "unusual-name", "silecek lastiği"],
  ["Yağ filtresi arıyorum, 20 adet toptan", "unusual-name", "yağ filtresi"],
  ["Ford Transit için debriyaj seti arıyorum", "brand-product", "marka + model + parça"],
  ["Oto cam filmi yaptırmak istiyorum, ön cam hariç", "jargon", "cam filmi hizmeti"],
]);

/* ── MAKİNE ──────────────────────────────────────────────────────────── */
const MACHINERY = build("machinery", "mach", [
  ["CNC dik işleme merkezi arıyorum, 3 eksen", "abbreviation", "CNC kısaltması"],
  ["Hidrolik abkant pres arıyorum, 3 metre 100 ton", "jargon", "abkant pres"],
  ["Shrink paketleme makinesi arıyorum, tünel tipi", "jargon", "shrink tünel"],
  ["Fiber lazer kesim makinesi arıyorum, 2 kW", "jargon", "fiber lazer"],
  ["Vidalı kompresör arıyorum, 10 bar 30 kW", "jargon", "vidalı kompresör"],
  ["Torna tezgahı arıyorum, üniversal 1500 mm", "jargon", "üniversal torna"],
  ["Ekskavatör kiralamak istiyorum, 20 ton paletli", "unusual-name", "makine kiralama"],
  ["Forklift arıyorum, 3 ton dizel triplex", "jargon", "triplex asansör"],
  ["Enjeksiyon makinesi arıyorum, 250 ton", "jargon", "plastik enjeksiyon"],
  ["Konveyör bant arıyorum, 12 metre modüler", "jargon", "modüler konveyör"],
  ["İkinci el dolum makinesi arıyorum, sıvı için", "unusual-name", "ikinci el makine"],
  ["Plazma kesim makinesi arıyorum, CNC masalı", "abbreviation", "plazma + CNC"],
  ["Vinç arıyorum, 5 ton tavan vinci", "unusual-name", "tavan vinci"],
  ["Traktör arıyorum, 90 hp dört çeker", "abbreviation", "hp kısaltması"],
  ["Freze makinesi için yedek parça arıyorum", "jargon", "makine yedek parçası"],
  ["Süt sağma makinesi arıyorum, çift başlıklı", "unusual-name", "hayvancılık makinesi"],
  ["Jeneratör arıyorum, 100 kVA dizel kabinli", "abbreviation", "kVA kısaltması"],
  ["Kaynak makinesi arıyorum, inverter 250 amper", "jargon", "inverter kaynak"],
  ["Bant testere arıyorum, metal kesim için", "jargon", "bant testere"],
  ["Etiketleme makinesi arıyorum, otomatik besleyicili", "jargon", "etiketleme makinesi"],
  ["Hidrolik güç ünitesi arıyorum, 30 litre tank", "jargon", "hidrolik güç ünitesi"],
]);

/* ── MOBİLYA ─────────────────────────────────────────────────────────── */
const FURNITURE = build("furniture", "furn", [
  ["Berjer arıyorum, 4 adet otel lobisi için", "unusual-name", "berjer kanonik ad"],
  ["Ergonomik ofis sandalyesi arıyorum, file sırtlı", "jargon", "ergonomik file sırt"],
  ["Makam takımı arıyorum, ceviz kaplama", "unusual-name", "makam takımı"],
  ["Vestiyer arıyorum, giriş holü için", "unusual-name", "vestiyer kanonik ad"],
  ["Sürgülü gardırop arıyorum, 3 metre aynalı", "unusual-name", "sürgülü gardırop"],
  ["Toplantı masası arıyorum, 12 kişilik kablo kanallı", "unusual-name", "toplantı masası"],
  ["Kafe sandalyesi arıyorum, 40 adet ahşap", "unusual-name", "kafe mobilyası"],
  ["Kitaplık arıyorum, duvara monte 5 raflı", "unusual-name", "kitaplık"],
  ["Sehpa takımı arıyorum, zigon 3'lü", "jargon", "zigon sehpa"],
  ["Dosya dolabı arıyorum, 10 adet kilitli çelik", "unusual-name", "dosya dolabı"],
  ["Kanepe arıyorum, yataklı üç kişilik", "unusual-name", "yataklı kanepe"],
  ["Karyola arıyorum, baza başlık dahil çift kişilik", "jargon", "baza + başlık"],
  ["Özel üretim tezgah arıyorum, mutfak için 4 metre", "unusual-name", "özel üretim mobilya"],
  ["Bellona yemek masası arıyorum, 6 sandalyeli", "brand-product", "marka + ürün"],
  ["Puf arıyorum, 20 adet bekleme alanı için", "unusual-name", "puf kanonik ad"],
  ["Ofis masası arıyorum, L tipi 180 cm keson dahil", "jargon", "keson"],
  ["Bar taburesi arıyorum, 12 adet yükseklik ayarlı", "unusual-name", "bar taburesi"],
  ["TV ünitesi arıyorum, 240 cm askılı", "abbreviation", "TV kısaltması"],
  ["Restoran masası arıyorum, 25 adet kompakt laminat", "jargon", "kompakt laminat"],
]);

/* ── EV VE MUTFAK ────────────────────────────────────────────────────── */
const HOME_KITCHEN = build("home-kitchen", "home", [
  ["Porselen yemek takımı arıyorum, 12 kişilik 85 parça", "unusual-name", "yemek takımı"],
  ["Çatal bıçak seti arıyorum, 18/10 çelik 72 parça", "jargon", "18/10 çelik"],
  ["Cam demlik arıyorum, 24 adet kafe için", "unusual-name", "cam demlik"],
  ["Kahve seti arıyorum, 6 kişilik fincan takımı", "unusual-name", "kahve/çay seti"],
  ["Borosilikat cam saklama kabı arıyorum, 12 parça", "jargon", "borosilikat cam"],
  ["Paşabahçe su bardağı arıyorum, 200 adet", "brand-product", "marka + ürün"],
  ["Klozet arıyorum, asma tip rezervuarlı", "unusual-name", "asma klozet"],
  ["Eviye arıyorum, granit tek gözlü damlalıklı", "unusual-name", "eviye/lavabo"],
  ["Mutfak bataryası arıyorum, spiralli", "jargon", "batarya/musluk"],
  ["Servis tabağı arıyorum, 100 adet restoran için", "unusual-name", "servis tabağı"],
  ["Vazo arıyorum, 30 adet düğün masası için", "unusual-name", "vazo kanonik ad"],
  ["Kilim arıyorum, 2 metreye 3 metre el dokuma", "unusual-name", "kilim kanonik ad"],
  ["Tencere seti arıyorum, granit 7 parça", "unusual-name", "tencere seti"],
  ["Kesme tahtası arıyorum, 30 adet bambu", "unusual-name", "kesme tahtası"],
  ["Çay bardağı arıyorum, 500 adet ince belli", "unusual-name", "bardak kanonik adı yok, kök doğru"],
  ["Sürahi arıyorum, 50 adet cam", "unusual-name", "sürahi"],
  ["Porselen kupa arıyorum, 300 adet düz beyaz", "unusual-name", "porselen kupa"],
  /**
   * A kümesinden TAŞINDI (2026-09-25): "bulaşık deterjanı" kürasyonlu
   * `home-kitchen` sözlüğünde açık bir anahtardır, yani kök İÇİDİR.
   */
  ["Bulaşık deterjanı arıyorum, 30 adet", "unusual-name", "kürasyonlu sözlükte home-kitchen anahtarı"],
]);

/* ── MATBAA ──────────────────────────────────────────────────────────── */
const PRINTING = build("printing", "print", [
  ["Kuşe kartvizit bastırmak istiyorum, 1000 adet selefonlu", "jargon", "kuşe + selefon"],
  ["Oluklu mukavva kutu arıyorum, 5000 adet baskılı", "jargon", "oluklu mukavva"],
  ["Roll-up standı bastırmak istiyorum, 85x200", "abbreviation", "roll-up"],
  ["Termal etiket arıyorum, 50 rulo 100x150", "jargon", "termal etiket"],
  ["Davetiye bastırmak istiyorum, 300 adet kraft", "unusual-name", "davetiye baskısı"],
  ["Antetli kâğıt bastırmak istiyorum, 2000 adet", "unusual-name", "antetli kâğıt"],
  ["Ofset broşür bastırmak istiyorum, 16 sayfa A4", "jargon", "ofset baskı"],
  ["Cepli dosya bastırmak istiyorum, 1000 adet", "unusual-name", "cepli dosya"],
  ["UV baskılı promosyon kalem arıyorum, 500 adet", "abbreviation", "UV baskı"],
  ["Flekso baskılı poşet arıyorum, 10 bin adet", "jargon", "flekso baskı"],
  ["Kraft çanta bastırmak istiyorum, 2000 adet logolu", "unusual-name", "kraft çanta baskısı"],
  ["Magnet bastırmak istiyorum, 1000 adet buzdolabı magneti", "unusual-name", "magnet baskısı"],
  ["Şeffaf etiket bastırmak istiyorum, 20 bin adet", "unusual-name", "şeffaf etiket"],
  ["Katalog bastırmak istiyorum, 32 sayfa tel dikiş", "jargon", "tel dikiş ciltleme"],
  ["Afiş bastırmak istiyorum, 50 adet A1 boyutunda", "abbreviation", "A1 boyutu"],
  ["Bloknot bastırmak istiyorum, 500 adet tutkallı", "jargon", "tutkallı bloknot"],
  ["Işıklı tabela yaptırmak istiyorum, 3 metre", "unusual-name", "tabela üretimi"],
]);

/* ── EMLAK ───────────────────────────────────────────────────────────── */
const REAL_ESTATE = build("real-estate", "re", [
  ["3+1 kiralık daire arıyorum, Kadıköy asansörlü", "abbreviation", "oda deseni"],
  ["İmarlı arsa arıyorum, 500 metrekare konut imarlı", "jargon", "imar durumu"],
  ["Devren işyeri arıyorum, cadde üzeri 80 metrekare", "jargon", "devren"],
  ["Plaza ofisi kiralamak istiyorum, 200 metrekare", "unusual-name", "plaza ofisi"],
  ["Satılık dubleks arıyorum, bahçe katı", "unusual-name", "dubleks"],
  ["Depo kiralamak istiyorum, 1000 metrekare yüksek tavan", "unusual-name", "depo"],
  ["Müstakil ev arıyorum, tapulu 2 dönüm arazili", "jargon", "müstakil + tapu"],
  ["Devre mülk arıyorum, temmuz dönemi", "jargon", "devre mülk"],
  ["Sanayi arsası arıyorum, 3 dönüm yola cepheli", "jargon", "sanayi arsası"],
  ["Rezidans dairesi kiralamak istiyorum, eşyalı 2+1", "abbreviation", "rezidans + oda deseni"],
  ["Kiralık dükkan arıyorum, 60 metrekare cadde üzeri", "unusual-name", "ticari gayrimenkul"],
  ["Satılık villa arıyorum, havuzlu bahçeli", "unusual-name", "satılık konut"],
  ["Fabrika binası kiralamak istiyorum, 2000 metrekare", "unusual-name", "ticari gayrimenkul"],
  ["Apart daire arıyorum, öğrenci için eşyalı", "unusual-name", "apart"],
  ["Tarla arıyorum, 10 dönüm sulu arazi", "unusual-name", "tarla"],
]);

/* ── SAĞLIK ──────────────────────────────────────────────────────────── */
const HEALTH = build("health", "health", [
  ["Nebulizatör arıyorum, kompresörlü", "unusual-name", "nebulizatör"],
  ["Tansiyon ölçer arıyorum, koldan dijital 20 adet", "unusual-name", "tansiyon aleti"],
  ["Hasta karyolası arıyorum, 3 motorlu", "unusual-name", "klinik donanım"],
  ["Dental ünit arıyorum, koltuk dahil", "jargon", "dental ünit"],
  ["Tekerlekli sandalye arıyorum, akülü", "unusual-name", "tekerlekli sandalye"],
  ["Otoklav arıyorum, 23 litre B sınıfı", "jargon", "otoklav sterilizatör"],
  ["Pulse oksimetre arıyorum, 50 adet", "abbreviation", "oksimetre"],
  ["Muayene masası arıyorum, paslanmaz", "unusual-name", "klinik donanım"],
  ["Ortopedik korse arıyorum, lumbosakral", "jargon", "lumbosakral korse"],
  ["Laboratuvar santrifüjü arıyorum, 24 tüplü", "jargon", "laboratuvar cihazı"],
  ["Steteskop arıyorum, 10 adet çift taraflı", "unusual-name", "steteskop"],
  ["Oksijen konsantratörü arıyorum, 5 litre evde kullanım", "jargon", "oksijen konsantratörü"],
  ["Sargı bezi arıyorum, 500 adet steril", "unusual-name", "sargı"],
  ["Diş ünitesi kompresörü arıyorum, yağsız", "jargon", "yağsız kompresör"],
  ["Ultrason jeli arıyorum, 20 litre", "jargon", "medikal sarf"],
]);

/* ── ANNE VE ÇOCUK ───────────────────────────────────────────────────── */
const BABY = build("baby", "baby", [
  ["Puset arıyorum, kabin boy katlanabilir", "unusual-name", "puset"],
  ["Mama sandalyesi arıyorum, yüksekliği ayarlanabilir", "unusual-name", "mama sandalyesi"],
  ["Park yatak arıyorum, oyun parkı olarak da kullanılan", "unusual-name", "park yatak"],
  ["Ana kucağı arıyorum, elektrikli sallanan", "unusual-name", "ana kucağı"],
  ["Chicco bebek arabası arıyorum, travel sistem", "brand-product", "marka + ürün"],
  ["Biberon ve sterilizatör arıyorum, 6 adet", "unusual-name", "beslenme ürünü"],
  ["Beşik arıyorum, yan açılır anne yanı", "unusual-name", "anne yanı beşik"],
  ["Bebek bezi arıyorum, 4 numara 200 adet", "unusual-name", "bakım ürünü"],
  ["Oto koltuğu arıyorum, 9-36 kg isofix", "jargon", "isofix"],
  ["Bebek küveti arıyorum, ayaklı", "unusual-name", "bakım ürünü"],
  ["Emzik arıyorum, 200 adet silikon", "unusual-name", "emzik"],
  ["Oyun halısı arıyorum, 2 metre kare puzzle tip", "unusual-name", "oyun halısı"],
  ["Mama robotu arıyorum, buharda pişiren", "unusual-name", "beslenme ürünü"],
  ["Bebek taşıma kangurusu arıyorum, ergonomik", "unusual-name", "taşıma ürünü"],
  ["Alt açma çantası arıyorum, 50 adet", "unusual-name", "bakım ürünü"],
]);

/* ── HİZMETLER ───────────────────────────────────────────────────────── */
const SERVICES = build("services", "svc", [
  ["Boya badana ustası arıyorum, 120 metrekare daire", "unusual-name", "boya badana hizmeti"],
  ["Halı yıkama hizmeti arıyorum, 6 adet salon halısı", "unusual-name", "halı yıkama"],
  ["Evden eve nakliyat arıyorum, 3+1 asansörlü taşıma", "abbreviation", "nakliyat + oda deseni"],
  ["Kombi servisi arıyorum, yıllık bakım", "unusual-name", "kombi servisi"],
  ["İç mimar arıyorum, 200 metrekare ofis projesi", "unusual-name", "iç mimar"],
  ["Evde bakım desteği arıyorum, yatalak hasta refakati", "unusual-name", "evde bakım"],
  ["Logo tasarımı yaptırmak istiyorum, kurumsal kimlik dahil", "unusual-name", "grafik tasarım"],
  ["Direksiyon dersi arıyorum, 20 saat pratik", "unusual-name", "eğitim hizmeti"],
  ["Boş ev temizliği arıyorum, taşınma sonrası", "unusual-name", "boş ev temizliği"],
  ["Fayans döşeme ustası arıyorum, 40 metrekare banyo", "unusual-name", "fayans döşeme"],
  ["Cam balkon yaptırmak istiyorum, 12 metre", "unusual-name", "cam balkon"],
  ["Elektrikçi arıyorum, tesisat yenileme", "unusual-name", "elektrikçi"],
  ["Klima servisi arıyorum, gaz dolumu", "unusual-name", "klima servisi"],
  ["Ev yardımcısı arıyorum, haftada iki gün", "unusual-name", "ev yardımcısı"],
  ["Koltuk yıkama arıyorum, 5 koltuk yerinde", "unusual-name", "koltuk yıkama"],
  ["Parça eşya taşıma arıyorum, tek buzdolabı", "unusual-name", "parça eşya taşıma"],
  ["Ev dekorasyon danışmanlığı arıyorum, salon yenileme", "unusual-name", "ev dekorasyon"],
  ["Duvar dekorasyon yaptırmak istiyorum, 3 duvar", "unusual-name", "duvar dekorasyon"],
  ["Teknik servis arıyorum, buzdolabı soğutmuyor", "unusual-name", "teknik servis"],
  ["Grafik tasarım desteği arıyorum, sosyal medya görselleri", "unusual-name", "grafik tasarım"],
  ["Ev temizliği arıyorum, haftalık 4 saat", "unusual-name", "ev temizliği"],
  /**
   * A KÜMESİNDEN TAŞINAN 18 HİZMET TALEBİ (2026-09-25).
   *
   * Gerekçe ölçüldü: 1077 vakalık adversarial korpus "Düğün fotoğrafçısı
   * arıyorum" ve "Matematik özel ders arıyorum" için `services` bekliyor.
   * Demek ki `services` kökü hizmet taksonomi dosyasının 20 yaprağıyla
   * sınırlı değil, Talepo'nun GENEL HİZMET PAZARIDIR. Bu satırlar o pazarın
   * kapsamını ölçer; kanonik yaprak karşılıkları YOKTUR ve olmaması bir
   * katalog boşluğudur, kapsam dışılık değil.
   */
  ["Avukat arıyorum, ticaret hukuku", "unusual-name", "genel hizmet pazarı, kanonik yaprak yok"],
  ["Mali müşavir arıyorum, küçük işletme", "unusual-name", "genel hizmet pazarı"],
  ["Güvenlik görevlisi arıyorum, gece vardiyası", "unusual-name", "genel hizmet pazarı"],
  ["Tercüman arıyorum, Almanca ardıl çeviri", "unusual-name", "genel hizmet pazarı"],
  ["Sosyal medya reklam yönetimi arıyorum", "jargon", "genel hizmet pazarı"],
  ["Kuaför arıyorum, gelin saçı", "unusual-name", "genel hizmet pazarı"],
  ["Diyetisyen arıyorum, online takip", "unusual-name", "genel hizmet pazarı"],
  ["Personal trainer arıyorum, haftada iki gün", "jargon", "genel hizmet pazarı"],
  ["Drone ile arazi haritalama hizmeti arıyorum", "jargon", "genel hizmet pazarı"],
  ["Haşere ilaçlama hizmeti arıyorum, 200 metrekare", "unusual-name", "genel hizmet pazarı"],
  ["Vize danışmanlığı arıyorum, Schengen", "unusual-name", "genel hizmet pazarı"],
  ["Havalimanı transfer hizmeti arıyorum, 8 kişi", "unusual-name", "genel hizmet pazarı"],
  ["Düğün organizatörü arıyorum, 200 kişilik", "unusual-name", "genel hizmet pazarı"],
  ["Düğün fotoğrafçısı arıyorum, tam gün çekim", "unusual-name", "korpus bu kökü bekliyor (svc-c)"],
  ["Orkestra arıyorum, düğün için canlı müzik", "unusual-name", "genel hizmet pazarı"],
  ["Catering hizmeti arıyorum, 150 kişilik açık büfe", "unusual-name", "genel hizmet pazarı"],
  ["Balon süsleme arıyorum, doğum günü için", "unusual-name", "genel hizmet pazarı"],
  ["Tur paketi arıyorum, Kapadokya iki gece", "unusual-name", "genel hizmet pazarı"],
]);

export const SET_B: InTaxonomyCase[] = [
  ...APPLIANCES,
  ...TECHNOLOGY,
  ...AUTOMOTIVE,
  ...MACHINERY,
  ...FURNITURE,
  ...HOME_KITCHEN,
  ...PRINTING,
  ...REAL_ESTATE,
  ...HEALTH,
  ...BABY,
  ...SERVICES,
];
