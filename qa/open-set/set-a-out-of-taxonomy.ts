/**
 * A KÜMESİ — KATEGORİ DIŞI AMA MEŞRU TALEPLER (2026-09-25).
 *
 * NE ÖLÇER. Kişi gerçekten bir şey satın almak / kiralamak / bir hizmet
 * yaptırmak istiyor (yani talep tarafındadır, arz ilanı değildir, ilaç değildir,
 * tavsiye sorusu değildir) AMA istediği şeyin Talepo'nun 11 kökünde karşılığı
 * yoktur. Doğru davranış "kategori yok"tur; 11 kökten birini EMİN biçimde
 * iddia etmek kurucunun en tehlikeli dediği hata sınıfıdır.
 *
 * NASIL DOĞRULANDI. Her cümle `data/taxonomy/` altındaki kanonik ağaca
 * (2.098 düğüm, 11 kök) ve `request-category-engine.ts` kategori listesine
 * karşı TEK TEK okundu. Kökler ve alt başlıkları:
 *   printing      Karton Kutu · Etiket Baskı · Broşür ve Katalog · Promosyon
 *   furniture     Ev Mobilyası · Ofis Mobilyaları · Ofis Sandalyesi ·
 *                 Çalışma/Ofis Masası · Toplantı Masası · Kafe ve Restoran
 *   appliances    Küçük Ev Aletleri · Beyaz Eşya · Isıtma, Soğutma, Havalandırma
 *   technology    Yazılım Geliştirme · Web Sitesi · Donanım · Sistem ve Altyapı
 *   machinery     Üretim · Kesim · Paketleme Makinesi · Yedek Parça · İkinci El
 *   home-kitchen  Yemek Takımı · Kahve/Çay Seti · Çatal Bıçak · Cam/Porselen
 *   real-estate   Kiralık Konut · Satılık Konut · Ticari Gayrimenkul · Arsa
 *   services      Temizlik · Ev Tadilat · Teknik Servis · Nakliye · Eğitim ·
 *                 Grafik ve Tasarım · Evde Bakım ve Destek
 *   health        Medikal Cihaz · Klinik Donanım · Diş/Laboratuvar
 *   baby          Bebek Arabası · Beslenme · Uyku/Beşik · Bakım
 *   automotive    Araç Satın Alma · Yedek Parça · Araç Bakım · Lastik ve Jant
 *
 * ÇEKİMSER KALINAN ALANLAR (bilerek kümede YOK).
 *   - Eğitim / kurs: `services` kökünde "Eğitim" ALT BAŞLIĞI vardır (yaprak
 *     olarak yalnız "Direksiyon dersi"). "İngilizce kursu" alt başlık düzeyinde
 *     karşılık bulur, yaprak düzeyinde bulmaz — iki okuma da savunulabilir.
 *     Kurucunun kuralı: emin olunmayan cümle kümeye alınmaz.
 *   - Bebek maması / bebek bezi: `baby › Beslenme` ve `baby › Bakım` bunları
 *     kapsar; gıda gibi görünseler de İÇERİDEDİR.
 *   - Tıbbi cihaz benzeri her şey (`health › Medikal Cihaz`) dışarıda bırakıldı.
 *   - OYUNCAK: `baby › Oyuncaklar` GROUP düğümü kanonik ağaçta VARDIR
 *     ("bebek oyuncağı" alias'ı çözülüyor). Lego, oyuncak araba, oyuncak bebek
 *     gibi cümleler bu grubun içine girebilir; ölçüldü ve emin olunamadı, o
 *     yüzden kümede yok. "Masa oyunu" ayrı tutuldu: yetişkin kutu oyunudur ve
 *     hiçbir kökte karşılığı yoktur.
 *   - "Bulaşık deterjanı": kanonik ağaçta yok AMA kürasyonlu kategori
 *     sözlüğünde `home-kitchen` anahtarı olarak VARDIR
 *     (`ai/parser/category.ts` → "bulaşık deterjanı"). Kurucunun dayanak
 *     tanımı "katalog/sözlük/alt kategori listesi" olduğu için sözlük de bir
 *     karşılıktır; cümle A'dan çıkarıldı ve B kümesine `home-kitchen` olarak
 *     kondu.
 *   - DOĞRULAMADA DÜŞEN BEŞ CÜMLE (2026-09-25, kanonik ağaç sorgusuyla):
 *     "Uyku tulumu" → `baby:Uyku tulumu`, "Ajanda" → `printing:Ajanda`,
 *     "Kereste" → `machinery:Kereste`, "İnverter" ve "Akü" →
 *     `automotive:PART_TYPE`. Beşi de kanonik ağaçta YAPRAK olarak vardır,
 *     yani 11 kökün İÇİNDEDİR; kümeden çıkarıldı ve yerlerine karşılığı
 *     ölçülerek YOK çıkan beş cümle kondu. Kurucunun kuralı: emin olmadığın
 *     cümleyi kümeye alma.
 *   - BANYO: "klozet", "lavabo", "batarya/musluk" `home-kitchen` kökünde
 *     PRODUCT_TYPE olarak VARDIR. Bu yüzden banyo ürünleri kümeye alınmadı;
 *     yalnız kanonik karşılığı ölçülerek YOK çıkanlar (perde, halı, havlu)
 *     alındı.
 *
 * TUZAKLAR BİLEREK VAR. "zeytinyağı ↔ home-kitchen", "kuş yemi ↔ ev",
 * "gitar ↔ technology", "kask ↔ automotive", "tohum ↔ machinery",
 * "yağlı boya ↔ services(boya badana)", "fayans ↔ services(fayans döşeme)"
 * gibi yakın komşular kümenin asıl değeridir: kolay vakalar hiçbir şey ölçmez.
 */
import type { OutOfTaxonomyCase, TalepoRoot } from "./types";

type Row = [text: string, why: string, nearRoot?: TalepoRoot];

function build(domain: string, prefix: string, rows: Row[]): OutOfTaxonomyCase[] {
  return rows.map(([text, why, nearRoot], i) => ({
    id: `a-${prefix}-${String(i + 1).padStart(2, "0")}`,
    domain,
    text,
    why,
    ...(nearRoot ? { nearRoot } : {}),
  }));
}

/* ── GIDA VE İÇECEK ───────────────────────────────────────────────────── */
const FOOD = build("gıda ve içecek", "gida", [
  ["Zeytinyağı almak istiyorum, 5 litre soğuk sıkım", "gıda ürünü; home-kitchen yalnız SOFRA TAKIMI taşır", "home-kitchen"],
  ["Kuru kayısı arıyorum, toptan 100 kg", "gıda ürünü, hiçbir kökte yok"],
  ["Bal arıyorum, çam balı 2 kg", "gıda ürünü, hiçbir kökte yok"],
  ["Şarap arıyorum, hediyelik kırmızı", "içecek; appliances'taki 'şarap dolabı' ürünün kendisi değil", "appliances"],
  ["Kahve çekirdeği arıyorum, 1 kg Guatemala", "gıda; home-kitchen 'Kahve/Çay Seti' takımdır, çekirdek değil", "home-kitchen"],
  ["Zeytin almak istiyorum, 10 kg yeşil kırma", "gıda ürünü"],
  ["Pirinç arıyorum, 50 kg baldo", "gıda ürünü"],
  ["Tam buğday unu arıyorum, 25 kg çuval", "gıda ürünü"],
  ["Peynir arıyorum, tam yağlı beyaz 5 kg", "gıda ürünü"],
  ["Kaşar peyniri almak istiyorum toptan", "gıda ürünü"],
  ["Dana kıyma arıyorum, 20 kg", "gıda ürünü"],
  ["Tavuk göğsü arıyorum, restoran için haftalık", "gıda ürünü"],
  ["Somon fileto arıyorum, taze 10 kg", "gıda ürünü"],
  ["Baharat seti arıyorum, 12 çeşit", "gıda ürünü"],
  ["Domates salçası arıyorum, 5 kg teneke", "gıda ürünü"],
  ["Makarna arıyorum, toptan 100 paket", "gıda ürünü"],
  ["Kuruyemiş arıyorum, çiğ badem 5 kg", "gıda ürünü"],
  ["Maden suyu arıyorum, 24'lü koli", "içecek"],
  ["Portakal suyu arıyorum, doğal sıkım 12 litre", "içecek"],
  ["Bitki çayı arıyorum, ıhlamur ve adaçayı", "gıda ürünü"],
  ["Çikolata arıyorum, hediyelik kutu 50 adet", "gıda ürünü; printing 'Karton Kutu' ambalajdır, içindeki değil", "printing"],
  ["Dondurma arıyorum, toptan 20 litre", "gıda ürünü"],
  ["Glutensiz ekmek arıyorum, günlük 30 adet", "gıda ürünü"],
  ["Yumurta arıyorum, günlük 300 adet organik", "gıda ürünü"],
]);

/* ── EVCİL HAYVAN ─────────────────────────────────────────────────────── */
const PET = build("evcil hayvan", "pet", [
  ["Köpek maması arıyorum, tahılsız 15 kg", "evcil hayvan gıdası, hiçbir kökte yok"],
  ["Kedi kumu almak istiyorum, topaklanan", "evcil hayvan ürünü"],
  ["Kuş yemi almak istiyorum, muhabbet kuşu için", "evcil hayvan ürünü; 'ev' sözcüğü home/emlak çekebilir", "home-kitchen"],
  ["Akvaryum ve filtre seti almak istiyorum", "evcil hayvan ürünü; 'filtre' otomotiv/makine çekebilir", "machinery"],
  ["Kedi taşıma kafesi arıyorum, uçak onaylı", "evcil hayvan ürünü"],
  ["Köpek tasması ve gezdirme kayışı arıyorum", "evcil hayvan ürünü"],
  ["Kuş kafesi arıyorum, büyük boy ayaklı", "evcil hayvan ürünü"],
  ["Köpek kulübesi arıyorum, bahçe için ahşap", "evcil hayvan ürünü"],
  ["Kedi tırmalama tahtası arıyorum", "evcil hayvan ürünü"],
  ["Akvaryum balığı yemi arıyorum, pul yem 500 gr", "evcil hayvan ürünü"],
  ["Köpek için tüy bakım fırçası arıyorum", "evcil hayvan ürünü; baby 'Bakım' insan bebeğidir", "baby"],
  ["Hamster kafesi ve talaş arıyorum", "evcil hayvan ürünü"],
]);

/* ── BAHÇE VE TARIM ───────────────────────────────────────────────────── */
const GARDEN = build("bahçe ve tarım", "bahce", [
  ["Fide arıyorum, domates ve biber", "tarım girdisi, hiçbir kökte yok"],
  ["Sebze tohumu arıyorum, 20 çeşit paket", "tarım girdisi; 'tohum' makine kataloğunda yok", "machinery"],
  ["Organik gübre arıyorum, 500 kg", "tarım girdisi"],
  ["Çim tohumu arıyorum, 100 metrekare için", "tarım girdisi; 'metrekare' emlak çekebilir", "real-estate"],
  ["Saksı arıyorum, 40 adet plastik", "bahçe ürünü"],
  ["Damla sulama hortumu arıyorum, 500 metre", "tarım girdisi"],
  ["Sera naylonu arıyorum, 200 metrekare", "tarım girdisi; 'metrekare' emlak çekebilir", "real-estate"],
  ["Meyve fidanı arıyorum, ceviz ve badem", "tarım girdisi"],
  ["Arı kovanı arıyorum, 20 adet", "hayvancılık girdisi"],
  ["Saman ve yonca arıyorum, 5 ton", "hayvancılık girdisi"],
  ["Budama makası arıyorum, profesyonel", "el aleti; machinery 'Kesim Makinesi' endüstriyel makinedir", "machinery"],
  ["Bahçe çiti arıyorum, 50 metre tel örgü", "bahçe ürünü"],
  ["Torf ve perlit arıyorum, 200 litre", "tarım girdisi"],
]);

/* ── HOBİ VE MÜZİK ────────────────────────────────────────────────────── */
const HOBBY = build("hobi ve müzik", "hobi", [
  ["Gitar arıyorum, akustik başlangıç seti", "müzik aleti; technology 'Donanım' bilişim donanımıdır", "technology"],
  ["Elektro gitar arıyorum, amfi ile birlikte", "müzik aleti; 'elektro' technology çekebilir", "technology"],
  ["Piyano arıyorum, ikinci el akustik", "müzik aleti; 'ikinci el' makine çekebilir", "machinery"],
  ["Keman arıyorum, 4/4 boy öğrenci modeli", "müzik aleti"],
  ["Bağlama arıyorum, kısa sap", "müzik aleti"],
  ["Davul seti arıyorum, akustik 5 parça", "müzik aleti"],
  ["Ukulele arıyorum, soprano", "müzik aleti"],
  ["Satranç takımı almak istiyorum, ahşap", "hobi ürünü; 'takım' home-kitchen çekebilir", "home-kitchen"],
  ["Yağlı boya ve tuval seti arıyorum", "sanat malzemesi; services 'Boya badana' HİZMETİ değil", "services"],
  ["Akrilik boya seti arıyorum, 24 renk", "sanat malzemesi; 'boya' services çekebilir", "services"],
  ["Resim fırçası seti arıyorum, sentetik", "sanat malzemesi"],
  ["Puzzle arıyorum, 2000 parça", "hobi ürünü; 'parça' otomotiv/makine çekebilir", "automotive"],
  ["Maket uçak kiti arıyorum, 1/72 ölçek", "hobi ürünü; 'kit' health çekebilir", "health"],
  ["Örgü şişi ve yün arıyorum", "hobi ürünü"],
  ["Dijital piyano arıyorum, 88 tuş", "müzik aleti; 'dijital' printing/technology çekebilir", "printing"],
  ["Mikrofon standı arıyorum, müzik provası için", "müzik ekipmanı; technology donanım listesinde yok", "technology"],
  ["Masa oyunu arıyorum, 10 adet kafe için", "hobi ürünü; 'masa' furniture çekebilir", "furniture"],
  ["Vinil plak arıyorum, 70'ler Türkçe", "hobi ürünü"],
  ["Gitar teli arıyorum, 10 takım", "müzik ekipmanı; 'tel' makine çekebilir", "machinery"],
]);

/* ── SPOR VE AÇIK HAVA ────────────────────────────────────────────────── */
const SPORT = build("spor ve açık hava", "spor", [
  ["Tenis raketi arıyorum, orta seviye", "spor ürünü"],
  ["Bisiklet kaskı bakıyorum, dağ bisikleti için", "spor ürünü; 'kask' otomotiv aksesuarı çekebilir", "automotive"],
  ["Bisiklet arıyorum, 29 jant dağ bisikleti", "spor ürünü; 'jant' otomotiv routing kanıtıdır", "automotive"],
  ["Futbol topu arıyorum, 20 adet okul için", "spor ürünü"],
  ["Basketbol potası arıyorum, ayaklı", "spor ürünü"],
  ["Yoga matı arıyorum, 10 adet stüdyo için", "spor ürünü; 'stüdyo' emlak çekebilir", "real-estate"],
  ["Dambıl seti arıyorum, 2 ile 20 kg arası", "spor ürünü"],
  ["Kamp çadırı bakıyorum, dört kişilik", "açık hava ürünü"],
  ["Boks eldiveni arıyorum, 10 çift", "spor ürünü"],
  ["Balık tutma kamışı bakıyorum, olta seti", "açık hava ürünü"],
  ["Kayak takımı arıyorum, 170 cm", "spor ürünü"],
  ["Dalış maskesi ve şnorkel arıyorum", "spor ürünü"],
  ["Halter seti arıyorum, olimpik bar dahil", "spor ürünü"],
  ["Trekking botu arıyorum, 43 numara", "spor ürünü"],
  ["Sırt çantası arıyorum, 60 litre trekking", "açık hava ürünü"],
  ["Koşu bandı arıyorum, ev kullanımı katlanabilir", "spor aleti; appliances/machinery kataloğunda yok", "machinery"],
  ["Trambolin arıyorum, 3 metre çaplı bahçe için", "spor ürünü"],
  ["Kaykay arıyorum, başlangıç seviyesi", "spor ürünü"],
  ["Uçurtma arıyorum, 50 adet etkinlik için", "açık hava ürünü"],
]);

/* ── GİYİM VE AYAKKABI ───────────────────────────────────────────────── */
const APPAREL = build("giyim ve ayakkabı", "giyim", [
  ["Deri ceket bakıyorum, erkek L beden", "giyim ürünü"],
  ["Koşu ayakkabısı arıyorum, 43 numara", "giyim ürünü"],
  ["Gömlek arıyorum, 50 adet kurumsal beyaz", "giyim ürünü; kurumsal sipariş matbaa çekebilir", "printing"],
  ["Kot pantolon arıyorum, 32 beden", "giyim ürünü"],
  ["Mont arıyorum, su geçirmez kışlık", "giyim ürünü"],
  ["Abiye elbise arıyorum, 38 beden", "giyim ürünü"],
  ["Çorap arıyorum, 200 çift toptan", "giyim ürünü"],
  ["Kravat arıyorum, 30 adet ipek", "giyim ürünü"],
  ["Eşarp arıyorum, toptan 100 adet", "giyim ürünü"],
  ["İş güvenliği ayakkabısı arıyorum, 20 çift çelik burun", "giyim ürünü; iş güvenliği makine çekebilir", "machinery"],
  ["Tulum iş kıyafeti arıyorum, 15 adet", "giyim ürünü"],
  ["Spor tayt arıyorum, kadın M beden", "giyim ürünü"],
  ["Bere ve atkı arıyorum, toptan 50 takım", "giyim ürünü"],
]);

/* ── KOZMETİK VE KİŞİSEL BAKIM ───────────────────────────────────────── */
const COSMETIC = build("kozmetik ve kişisel bakım", "kozmetik", [
  ["Ruj arıyorum, mat bitişli 5 ton", "kozmetik ürünü"],
  ["Parfüm arıyorum, 100 ml erkek", "kozmetik ürünü"],
  ["Şampuan arıyorum, 24'lü koli toptan", "kozmetik ürünü"],
  ["Yüz kremi arıyorum, nemlendirici", "kozmetik ürünü; ilaç DEĞİLDİR, DEMAND kalmalı", "health"],
  ["Oje seti arıyorum, 12 renk", "kozmetik ürünü"],
  ["Maskara arıyorum, hacim veren", "kozmetik ürünü"],
  ["Saç boyası arıyorum, kuaför için toptan", "kozmetik ürünü; 'boya' services çekebilir", "services"],
  ["Güneş kremi arıyorum, 50 faktör", "kozmetik ürünü"],
  ["Tıraş köpüğü ve jilet arıyorum", "kozmetik ürünü"],
  ["El kremi arıyorum, 200 adet promosyon için", "kozmetik ürünü; 'promosyon' printing çekebilir", "printing"],
]);

/* ── KİTAP VE KIRTASİYE ──────────────────────────────────────────────── */
const BOOKS = build("kitap ve kırtasiye", "kitap", [
  ["Roman arıyorum, ikinci el klasikler", "kitap; 'ikinci el' makine çekebilir", "machinery"],
  ["Ders kitabı arıyorum, 9. sınıf matematik", "kitap"],
  ["Defter arıyorum, 500 adet çizgili", "kırtasiye; printing baskı hizmetidir, hazır defter değil", "printing"],
  ["Tükenmez kalem arıyorum, 1000 adet", "kırtasiye"],
  ["Silgi ve kalemtıraş arıyorum, toptan", "kırtasiye"],
  ["Coğrafya atlası arıyorum, 50 adet okul için", "kitap"],
  ["Kuru boya kalemi arıyorum, 36 renk", "kırtasiye; 'boya' services çekebilir", "services"],
  ["Duvar haritası arıyorum, Türkiye fiziki", "kırtasiye; 'duvar' services dekorasyon çekebilir", "services"],
  ["İngilizce sözlük arıyorum, basılı", "kitap; 'basılı' printing çekebilir", "printing"],
  ["Sulu boya kâğıdı arıyorum, A3 200 gram", "kırtasiye; kâğıt gramajı printing çekebilir", "printing"],
]);

/* ── TAKI VE AKSESUAR ────────────────────────────────────────────────── */
const JEWELRY = build("takı ve aksesuar", "taki", [
  ["Altın yüzük arıyorum, 18 ayar", "takı"],
  ["Kolye arıyorum, gümüş 925", "takı"],
  ["Bileklik arıyorum, çelik erkek", "takı"],
  ["Küpe arıyorum, inci", "takı"],
  ["Kol saati arıyorum, mekanik otomatik", "aksesuar; technology 'akıllı saat' değil", "technology"],
  ["Gümüş takı seti arıyorum, toptan 50 adet", "takı"],
  ["Pırlanta tektaş arıyorum, 0.30 karat", "takı"],
  ["Gözlük çerçevesi arıyorum, titanyum", "aksesuar; medikal cihaz değildir", "health"],
  ["Güneş gözlüğü arıyorum, polarize", "aksesuar"],
]);

/* ── BİLET VE HEDİYELİK ──────────────────────────────────────────────── */
const TRAVEL = build("bilet ve hediyelik", "seyahat", [
  ["Uçak bileti arıyorum, İstanbul Berlin gidiş dönüş", "bilet; hiçbir kökte ürün karşılığı yok"],
  ["Konser bileti arıyorum, 4 adet", "bilet"],
  ["Nikah şekeri arıyorum, 300 adet", "organizasyon ürünü; printing 'Promosyon' baskıdır", "printing"],
  ["Reçel arıyorum, 200 kavanoz hediyelik", "gıda ürünü"],
  ["Tahin ve pekmez arıyorum, 100 kavanoz", "gıda ürünü"],
  ["Sirke arıyorum, 50 litre elma sirkesi", "gıda ürünü"],
  ["Bulgur arıyorum, 100 kg toptan", "gıda ürünü"],
  ["Mercimek arıyorum, 200 kg kırmızı", "gıda ürünü"],
  ["Nohut arıyorum, 150 kg", "gıda ürünü"],
  ["Zeytinyağı sabunu arıyorum, 500 adet", "sarf ürünü"],
]);

/* ── HAYVANCILIK ─────────────────────────────────────────────────────── */
const LIVESTOCK = build("hayvancılık", "hayvancilik", [
  ["Süt ineği arıyorum, 10 baş simental", "canlı hayvan; hiçbir kökte yok"],
  ["Koyun arıyorum, 50 baş kurbanlık", "canlı hayvan"],
  ["Yumurta tavuğu arıyorum, 500 adet civciv", "canlı hayvan"],
  ["Besi danası arıyorum, 20 baş", "canlı hayvan"],
  ["Büyükbaş yem arıyorum, 3 ton karma", "hayvancılık girdisi"],
  ["Ana arı arıyorum, 30 adet", "canlı hayvan"],
]);

/* ── İNŞAAT MALZEMESİ ────────────────────────────────────────────────── */
const CONSTRUCTION = build("inşaat malzemesi", "insaat", [
  ["Çimento arıyorum, 500 torba", "inşaat malzemesi; hiçbir kökte yok"],
  ["Tuğla arıyorum, 10 bin adet delikli", "inşaat malzemesi"],
  ["İnşaat demiri arıyorum, 12'lik 5 ton", "inşaat malzemesi"],
  ["Sıva alçısı arıyorum, 300 torba", "inşaat malzemesi"],
  ["Alçıpan arıyorum, 200 adet plaka", "inşaat malzemesi"],
  ["Fayans arıyorum, 300 metrekare", "malzeme; services 'Fayans döşeme' HİZMETİDİR", "services"],
  ["İç cephe boyası arıyorum, 20 kova", "malzeme; services 'Boya badana' HİZMETİDİR", "services"],
  ["Isı yalıtım malzemesi arıyorum, 400 metrekare", "inşaat malzemesi; 'metrekare' emlak çekebilir", "real-estate"],
  ["Kum ve çakıl arıyorum, 30 ton", "inşaat malzemesi"],
  ["Laminat parke arıyorum, 120 metrekare", "malzeme; services tadilat HİZMETİDİR", "services"],
  ["Hazır beton arıyorum, 50 metreküp", "inşaat malzemesi"],
  ["Cam yünü arıyorum, 150 metrekare", "inşaat malzemesi"],
]);

/* ── ENERJİ ──────────────────────────────────────────────────────────── */
const ENERGY = build("enerji", "enerji", [
  ["Güneş paneli arıyorum, 10 kW çatı sistemi", "enerji ürünü; hiçbir kökte yok"],
  ["Solar şarj regülatörü arıyorum, 60 amper", "enerji ürünü; otomotiv 'Regülatör' parçası DEĞİL", "automotive"],
  ["Pelet yakıt arıyorum, 10 ton", "enerji ürünü"],
  ["Rüzgâr türbini arıyorum, 3 kW", "enerji ürünü"],
  ["Elektrikli araç şarj istasyonu arıyorum, 22 kW", "enerji ürünü; 'araç' otomotiv çekebilir", "automotive"],
  ["Güneş enerjisi montaj konstrüksiyonu arıyorum", "enerji ürünü; 'montaj' services çekebilir", "services"],
]);

/**
 * HİZMET TALEPLERİ BU KÜMEDE YOKTUR — VE BU BİR ÖLÇÜM SONUCUDUR.
 *
 * İlk sürümde "Avukat arıyorum", "Kuaför arıyorum", "Düğün organizatörü
 * arıyorum", "Catering hizmeti", "Vize danışmanlığı", "Drone ile haritalama
 * hizmeti" gibi 18 cümle burada kategori DIŞI sayılmıştı; gerekçe
 * `data/taxonomy/services/services.json` dosyasının yalnız 20 hizmet yaprağı
 * taşımasıydı. Ölçüm bu gerekçeyi ÇÜRÜTTÜ: 1077 vakalık adversarial korpus
 * "Düğün fotoğrafçısı arıyorum" ve "Matematik özel ders arıyorum" için
 * `services` BEKLİYOR ve o korpus kurucunun kararlarını taşıyan mevcut
 * yetkidir. Yani `services` kökü taksonomi dosyasıyla sınırlı değil,
 * Talepo'nun GENEL HİZMET PAZARIDIR.
 *
 * On sekiz cümle bu yüzden B kümesine `services` kökü ile taşındı. Bu kümenin
 * amacı ürün/hizmet ayrımını sınamak değil, 11 kökün hiçbirinde karşılığı
 * OLMAYAN ürünleri ölçmektir.
 */
const PRO_SERVICE = build("ek ürün ekseni", "hizmet", [
  ["Boks torbası arıyorum, ayaklı", "spor ürünü"],
  ["Pilates topu arıyorum, 20 adet", "spor ürünü"],
  ["Tırmanma ipi arıyorum, 60 metre", "spor ürünü"],
  ["Takım elbise arıyorum, 50 adet kurumsal", "giyim ürünü"],
  ["Kemer arıyorum, 200 adet deri", "giyim ürünü"],
  ["Yapıştırıcı arıyorum, 500 adet stick", "kırtasiye sarfı"],
  ["Makas arıyorum, 300 adet okul için", "kırtasiye sarfı"],
  ["Sıhhi tesisat borusu arıyorum, 500 metre", "inşaat malzemesi"],
  ["Elektrik kablosu arıyorum, 2000 metre", "inşaat malzemesi"],
  ["Menteşe arıyorum, 1000 adet", "yapı sarfı"],
  ["Kedi maması arıyorum, 20 kg tavuklu", "evcil hayvan gıdası"],
  ["Yastık arıyorum, 300 adet otel için", "ev tekstili; 'otel' emlak çekebilir", "real-estate"],
]);

/* ── EV TEKSTİLİ VE DEKORASYON ───────────────────────────────────────── */
const TEXTILE = build("ev tekstili ve dekorasyon", "tekstil", [
  ["Perde arıyorum, salon için fon perde", "ev tekstili; furniture kataloğunda yok", "furniture"],
  ["Halı arıyorum, 200x300 salon halısı", "ev tekstili; services 'Halı yıkama' HİZMETİDİR", "services"],
  ["Nevresim takımı arıyorum, çift kişilik 20 set", "ev tekstili; 'takım' home-kitchen çekebilir", "home-kitchen"],
  ["Yorgan arıyorum, otel için 100 adet", "ev tekstili; 'otel' emlak çekebilir", "real-estate"],
  ["Havlu arıyorum, 300 adet otel standardı", "ev tekstili"],
  ["Yatak örtüsü arıyorum, tek kişilik 50 adet", "ev tekstili"],
  ["Battaniye arıyorum, polar 200 adet", "ev tekstili"],
  ["Tablo arıyorum, kanvas baskı 5 adet", "dekorasyon ürünü; 'baskı' printing çekebilir", "printing"],
  ["Dekoratif mum arıyorum, 100 adet", "dekorasyon ürünü"],
  ["Resim çerçevesi arıyorum, 50x70 ahşap", "dekorasyon ürünü"],
  ["Duvar saati arıyorum, ofis için sessiz mekanizma", "dekorasyon ürünü; 'ofis' emlak/mobilya çekebilir", "real-estate"],
]);

/* ── TEMİZLİK VE KÂĞIT ÜRÜNLERİ ──────────────────────────────────────── */
const CLEANING = build("temizlik ve kâğıt ürünleri", "temizlik", [
  ["Çamaşır deterjanı arıyorum, 20 litre toptan", "sarf ürünü; services 'Temizlik' HİZMETİDİR", "services"],
  ["Çamaşır suyu arıyorum, 50 adet 5 litre", "sarf ürünü"],
  ["Yumuşatıcı arıyorum, 40 adet 5 litre", "sarf ürünü"],
  ["Cam temizleyici arıyorum, 40 adet sprey", "sarf ürünü"],
  ["El sabunu arıyorum, 500 adet ofis için", "sarf ürünü"],
  ["Kâğıt havlu arıyorum, 60 rulo koli", "sarf ürünü"],
  ["Tuvalet kâğıdı arıyorum, 200 rulo", "sarf ürünü"],
  ["Çöp poşeti arıyorum, 1000 adet endüstriyel", "sarf ürünü; printing 'poşet' AMBALAJ BASKISIDIR", "printing"],
]);

/* ── GÜVENLİK, SARF VE DİĞER ─────────────────────────────────────────── */
const MISC = build("güvenlik, sarf ve diğer", "diger", [
  ["Yangın tüpü arıyorum, 20 adet 6 kg", "güvenlik ürünü; hiçbir kökte yok"],
  ["Duman dedektörü arıyorum, 30 adet", "güvenlik ürünü"],
  ["Çelik kapı arıyorum, 4 daire için", "yapı ürünü; 'daire' emlak çekebilir", "real-estate"],
  ["Para kasası arıyorum, elektronik şifreli", "güvenlik ürünü"],
  ["Zımba teli arıyorum, 100 kutu", "kırtasiye sarfı; 'kutu' printing çekebilir", "printing"],
  ["Dosya klasörü arıyorum, 300 adet", "kırtasiye sarfı; printing 'cepli dosya' BASKIDIR", "printing"],
  ["Okul çantası arıyorum, 200 adet bağış için", "kırtasiye ürünü"],
  ["Ayakkabı boyası arıyorum, 50 adet", "bakım ürünü; services 'Boya badana' HİZMETİDİR", "services"],
]);

export const SET_A: OutOfTaxonomyCase[] = [
  ...FOOD,
  ...PET,
  ...GARDEN,
  ...HOBBY,
  ...SPORT,
  ...APPAREL,
  ...COSMETIC,
  ...BOOKS,
  ...JEWELRY,
  ...TRAVEL,
  ...LIVESTOCK,
  ...CONSTRUCTION,
  ...ENERGY,
  ...PRO_SERVICE,
  ...TEXTILE,
  ...CLEANING,
  ...MISC,
];
