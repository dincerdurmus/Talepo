/**
 * DAMITMA İÇİN SENTETİK TABAN CÜMLELER.
 *
 * NEDEN VARLAR. Öğrenme eğrisi (out/diagnose.json) 55 tohumda hâlâ dik
 * yükseliyor: modelin tavanı yeteneğinde değil, gördüğü FARKLI CÜMLE
 * sayısında. Korpusun 1077 satırı yalnız 78 taban cümledir; gerisi aynı
 * cümlenin büyük harfli, diyakritiksiz, typo'lu türevleridir ve modele yeni
 * bir şey öğretmez.
 *
 * KURAL: buradaki hiçbir cümle korpus tabanlarıyla aynı ürünü/hizmeti
 * kullanmaz. Aynı ürünü tekrar yazmak tohum sayısını artırmaz, yalnız
 * mevcut tohumu kalınlaştırır — ölçüm buna zaten sahip.
 *
 * ETİKET BURADA YOK. Zemin gerçeği Jev'den gelir (damıtma); elle etiket
 * yazmak deneyi anlamsız kılardı — ölçülmek istenen tam olarak "Jev'in
 * etiketleriyle eğitilen küçük model ne kadar yaklaşır".
 *
 * `kind` yalnız raporlamada kullanılır (kaç cümle hangi amaçla yazıldı);
 * eğitim etiketi DEĞİLDİR.
 */
export const SYNTHETIC_BASES = [
  // --- APPLIANCES ---
  { id: "s-appl-01", kind: "category", text: "Ankastre bulaşık makinesi arıyorum, 45 cm dar tip olsun" },
  { id: "s-appl-02", kind: "category", text: "Çamaşır kurutma makinesi bakıyorum, ısı pompalı olsun" },
  { id: "s-appl-03", kind: "category", text: "Su arıtma cihazı almak istiyorum, tezgah altı" },
  { id: "s-appl-04", kind: "category", text: "Mini fırın lazım, tek kişilik mutfak için" },
  { id: "s-appl-05", kind: "category", text: "Robot süpürge arıyorum, halı için güçlü olsun" },
  { id: "s-appl-06", kind: "category", text: "Şofben yerine termosifon almak istiyorum" },
  { id: "s-appl-07", kind: "category", text: "Derin dondurucu arıyorum, sandık tip" },
  { id: "s-appl-08", kind: "category", text: "Ütü masası ve buharlı ütü seti bakıyorum" },
  { id: "s-appl-09", kind: "category", text: "Davlumbaz arıyorum, adalı mutfak için" },
  { id: "s-appl-10", kind: "category", text: "Nem alma cihazı lazım bodrum katı için" },
  { id: "s-appl-11", kind: "category", text: "Elektrikli ısıtıcı arıyorum, konvektör tip" },
  { id: "s-appl-12", kind: "category", text: "Setüstü ocak almak istiyorum, doğalgazlı dört gözlü" },
  { id: "s-appl-13", kind: "category", text: "Su sebili kiralamak istiyorum ofis için" },
  { id: "s-appl-14", kind: "category", text: "Beyaz eşya için garanti dışı servis arıyorum" },
  { id: "s-appl-15", kind: "category", text: "Kombi değişimi yaptırmak istiyorum" },
  { id: "s-appl-16", kind: "category", text: "Çamaşır makinesi için tahliye pompası arıyorum" },

  // --- AUTOMOTIVE ---
  { id: "s-auto-01", kind: "category", text: "Hyundai i20 arıyorum, düşük kilometreli" },
  { id: "s-auto-02", kind: "category", text: "Kamyonet almak istiyorum, çift kabin" },
  { id: "s-auto-03", kind: "category", text: "Akü arıyorum 72 amper" },
  { id: "s-auto-04", kind: "category", text: "Araç kaplama yaptırmak istiyorum, mat siyah" },
  { id: "s-auto-05", kind: "category", text: "Traktör bakıyorum, ikinci el olabilir" },
  { id: "s-auto-06", kind: "category", text: "Elektrikli scooter arıyorum, şehir içi için" },
  { id: "s-auto-07", kind: "category", text: "Debriyaj balatası lazım Ford Focus için" },
  { id: "s-auto-08", kind: "category", text: "Oto cam filmi taktırmak istiyorum" },
  { id: "s-auto-09", kind: "category", text: "Karavan kiralamak istiyorum yaz tatili için" },
  { id: "s-auto-10", kind: "category", text: "Minibüs koltuk döşemesi yenilettirmek istiyorum" },
  { id: "s-auto-11", kind: "category", text: "Yedek anahtar kopyalatmak istiyorum, immobilizerli" },
  { id: "s-auto-12", kind: "category", text: "Çekici hizmeti arıyorum, aracım yolda kaldı" },
  { id: "s-auto-13", kind: "category", text: "Jant arıyorum 17 inç, beş bijonlu" },
  { id: "s-auto-14", kind: "category", text: "Motosiklet için zincir seti lazım" },
  { id: "s-auto-15", kind: "category", text: "Ticari araç filo kiralaması arıyorum" },
  { id: "s-auto-16", kind: "category", text: "Egzoz tamiri yaptırmak istiyorum" },

  // --- BABY ---
  { id: "s-baby-01", kind: "category", text: "Beşik arıyorum, anne yanı olsun" },
  { id: "s-baby-02", kind: "category", text: "Oto koltuğu bakıyorum, 9-36 kg grubu" },
  { id: "s-baby-03", kind: "category", text: "Bebek küveti almak istiyorum" },
  { id: "s-baby-04", kind: "category", text: "Göğüs pompası arıyorum, elektrikli" },
  { id: "s-baby-05", kind: "category", text: "Bebek telsizi lazım, kameralı" },
  { id: "s-baby-06", kind: "category", text: "Park yatak arıyorum, katlanabilir" },
  { id: "s-baby-07", kind: "category", text: "Biberon sterilizatörü almak istiyorum" },
  { id: "s-baby-08", kind: "category", text: "Bebek taşıma kangurusu bakıyorum" },
  { id: "s-baby-09", kind: "category", text: "Çocuk bisikleti arıyorum, 4 yaş için" },
  { id: "s-baby-10", kind: "category", text: "Emzirme koltuğu lazım, sallanır tip" },
  { id: "s-baby-11", kind: "category", text: "Bebek odası dolabı arıyorum" },
  { id: "s-baby-12", kind: "category", text: "Oyun halısı almak istiyorum, kaydırmaz" },
  { id: "s-baby-13", kind: "category", text: "Mama hazırlama robotu bakıyorum" },
  { id: "s-baby-14", kind: "category", text: "Çocuk güvenlik kilidi seti arıyorum" },
  { id: "s-baby-15", kind: "category", text: "Bebek arabası için yağmurluk lazım" },
  { id: "s-baby-16", kind: "category", text: "Alt açma masası arıyorum, küvetli" },

  // --- FURNITURE ---
  { id: "s-furn-01", kind: "category", text: "Çekyat arıyorum, günlük kullanıma uygun" },
  { id: "s-furn-02", kind: "category", text: "Kitaplık yaptırmak istiyorum, duvara sabit" },
  { id: "s-furn-03", kind: "category", text: "Portmanto bakıyorum, ayna dahil olsun" },
  { id: "s-furn-04", kind: "category", text: "Bahçe için salıncak koltuk arıyorum" },
  { id: "s-furn-05", kind: "category", text: "Yatak odası takımı almak istiyorum" },
  { id: "s-furn-06", kind: "category", text: "Puf arıyorum, saklama bölmeli" },
  { id: "s-furn-07", kind: "category", text: "Çalışma masası lazım, yükseklik ayarlı" },
  { id: "s-furn-08", kind: "category", text: "Vestiyer dolabı bakıyorum, ofis girişi için" },
  { id: "s-furn-09", kind: "category", text: "Baza arıyorum, çift kişilik hidrolik" },
  { id: "s-furn-10", kind: "category", text: "TV ünitesi yaptırmak istiyorum, ölçüye göre" },
  { id: "s-furn-11", kind: "category", text: "Sehpa takımı arıyorum, cam tablalı" },
  { id: "s-furn-12", kind: "category", text: "Bar taburesi lazım, altı adet" },
  { id: "s-furn-13", kind: "category", text: "Mutfak dolabı kapaklarını değiştirmek istiyorum" },
  { id: "s-furn-14", kind: "category", text: "Berjer koltuk bakıyorum, kumaş olsun" },
  { id: "s-furn-15", kind: "category", text: "Katlanır kamp masası arıyorum" },
  { id: "s-furn-16", kind: "category", text: "Raf sistemi arıyorum, depo için metal" },

  // --- HEALTH ---
  { id: "s-hlth-01", kind: "category", text: "Nebulizatör cihazı arıyorum, çocuk maskeli" },
  { id: "s-hlth-02", kind: "category", text: "Oksijen konsantratörü kiralamak istiyorum" },
  { id: "s-hlth-03", kind: "category", text: "Şeker ölçüm cihazı bakıyorum" },
  { id: "s-hlth-04", kind: "category", text: "Havalı yatak arıyorum, yara önleyici" },
  { id: "s-hlth-05", kind: "category", text: "Diş ünitesi arıyorum, klinik için" },
  { id: "s-hlth-06", kind: "category", text: "Koltuk değneği lazım, ayarlanabilir" },
  { id: "s-hlth-07", kind: "category", text: "Pulse oksimetre almak istiyorum" },
  { id: "s-hlth-08", kind: "category", text: "Hasta transfer lifti arıyorum" },
  { id: "s-hlth-09", kind: "category", text: "Fizik tedavi için TENS cihazı bakıyorum" },
  { id: "s-hlth-10", kind: "category", text: "Ortopedik korse arıyorum, bel için" },
  { id: "s-hlth-11", kind: "category", text: "Ultrason cihazı arıyorum, muayenehane için" },
  { id: "s-hlth-12", kind: "category", text: "Aspiratör cihazı kiralamak istiyorum" },
  { id: "s-hlth-13", kind: "category", text: "Diş laboratuvarı için fırın arıyorum" },
  { id: "s-hlth-14", kind: "category", text: "Walker yürüteç lazım, tekerlekli" },
  { id: "s-hlth-15", kind: "category", text: "Steteskop arıyorum, çift taraflı" },
  { id: "s-hlth-16", kind: "category", text: "Otoklav cihazı bakıyorum, sterilizasyon için" },

  // --- HOME-KITCHEN ---
  { id: "s-home-01", kind: "category", text: "Nevresim takımı arıyorum, çift kişilik pamuk" },
  { id: "s-home-02", kind: "category", text: "Perde yaptırmak istiyorum, fon ve tül" },
  { id: "s-home-03", kind: "category", text: "Halı arıyorum, 160x230 yıkanabilir" },
  { id: "s-home-04", kind: "category", text: "Çelik bıçak seti bakıyorum" },
  { id: "s-home-05", kind: "category", text: "Banyo dolabı arıyorum, lavabolu" },
  { id: "s-home-06", kind: "category", text: "Ekmek kutusu ve baharatlık seti lazım" },
  { id: "s-home-07", kind: "category", text: "Yorgan arıyorum, kaz tüyü" },
  { id: "s-home-08", kind: "category", text: "Duş perdesi ve aparatı almak istiyorum" },
  { id: "s-home-09", kind: "category", text: "Servis tabağı arıyorum, porselen 12 parça" },
  { id: "s-home-10", kind: "category", text: "Çamaşır sepeti bakıyorum, bambu" },
  { id: "s-home-11", kind: "category", text: "Masa örtüsü lazım, leke tutmaz" },
  { id: "s-home-12", kind: "category", text: "Bardak seti arıyorum, ısıya dayanıklı" },
  { id: "s-home-13", kind: "category", text: "Duvar saati almak istiyorum, sessiz mekanizma" },
  { id: "s-home-14", kind: "category", text: "Kilim arıyorum, el dokuma" },
  { id: "s-home-15", kind: "category", text: "Banyo havlusu seti bakıyorum" },
  { id: "s-home-16", kind: "category", text: "Kahve demleme ekipmanı arıyorum, french press" },

  // --- MACHINERY ---
  { id: "s-mach-01", kind: "category", text: "Jeneratör arıyorum, 30 kVA dizel" },
  { id: "s-mach-02", kind: "category", text: "Hidrolik pres bakıyorum, atölye için" },
  { id: "s-mach-03", kind: "category", text: "Vinç kiralamak istiyorum, 20 ton" },
  { id: "s-mach-04", kind: "category", text: "Kaynak makinesi arıyorum, inverter" },
  { id: "s-mach-05", kind: "category", text: "Dolum makinesi arıyorum, sıvı ürün için" },
  { id: "s-mach-06", kind: "category", text: "Konveyör bant yaptırmak istiyorum" },
  { id: "s-mach-07", kind: "category", text: "Lazer kesim tezgahı bakıyorum" },
  { id: "s-mach-08", kind: "category", text: "Beton mikseri kiralamak istiyorum" },
  { id: "s-mach-09", kind: "category", text: "Transpalet arıyorum, akülü" },
  { id: "s-mach-10", kind: "category", text: "Soğutma kulesi arıyorum, fabrika için" },
  { id: "s-mach-11", kind: "category", text: "Enjeksiyon makinesi bakıyorum, plastik üretimi" },
  { id: "s-mach-12", kind: "category", text: "Redüktör arıyorum, 1/40 oranlı" },
  { id: "s-mach-13", kind: "category", text: "Sanayi tipi bulaşık makinesi arıyorum" },
  { id: "s-mach-14", kind: "category", text: "Mermer kesme makinesi kiralamak istiyorum" },
  { id: "s-mach-15", kind: "category", text: "Un değirmeni arıyorum, küçük kapasiteli" },
  { id: "s-mach-16", kind: "category", text: "Basınçlı hava tankı arıyorum" },

  // --- PRINTING ---
  { id: "s-prnt-01", kind: "category", text: "Katalog bastırmak istiyorum, 32 sayfa" },
  { id: "s-prnt-02", kind: "category", text: "Etiket bastırmak istiyorum, kendinden yapışkanlı" },
  { id: "s-prnt-03", kind: "category", text: "Tabela yaptırmak istiyorum, ışıklı" },
  { id: "s-prnt-04", kind: "category", text: "Tişört baskısı yaptırmak istiyorum, 50 adet" },
  { id: "s-prnt-05", kind: "category", text: "Ambalaj poşeti ürettirmek istiyorum" },
  { id: "s-prnt-06", kind: "category", text: "Takvim bastırmak istiyorum, masa tipi" },
  { id: "s-prnt-07", kind: "category", text: "Kaşe yaptırmak istiyorum, otomatik" },
  { id: "s-prnt-08", kind: "category", text: "Vinil afiş bastırmak istiyorum, açık hava için" },
  { id: "s-prnt-09", kind: "category", text: "Dosya ve antetli kağıt bastırmak istiyorum" },
  { id: "s-prnt-10", kind: "category", text: "Promosyon kalem bastırmak istiyorum, logolu" },
  { id: "s-prnt-11", kind: "category", text: "Menü bastırmak istiyorum, laminasyonlu" },
  { id: "s-prnt-12", kind: "category", text: "Araç giydirme baskısı yaptırmak istiyorum" },
  { id: "s-prnt-13", kind: "category", text: "Kitap basımı yaptırmak istiyorum, 500 adet" },
  { id: "s-prnt-14", kind: "category", text: "Bez çanta baskısı ürettirmek istiyorum" },
  { id: "s-prnt-15", kind: "category", text: "Sticker kestirmek istiyorum, şeffaf zemin" },
  { id: "s-prnt-16", kind: "category", text: "Kartonpiyer değil, karton kutu baskısı yaptırmak istiyorum" },

  // --- REAL-ESTATE ---
  { id: "s-re-01", kind: "category", text: "Depo kiralamak istiyorum, 500 metrekare" },
  { id: "s-re-02", kind: "category", text: "Villa arıyorum, havuzlu satılık" },
  { id: "s-re-03", kind: "category", text: "Dükkan arıyorum, cadde üstü kiralık" },
  { id: "s-re-04", kind: "category", text: "Yazlık daire bakıyorum, denize yakın" },
  { id: "s-re-05", kind: "category", text: "Tarla arıyorum, sulu arazi" },
  { id: "s-re-06", kind: "category", text: "Öğrenci için stüdyo daire arıyorum" },
  { id: "s-re-07", kind: "category", text: "Fabrika binası kiralamak istiyorum, organize sanayide" },
  { id: "s-re-08", kind: "category", text: "Residence dairesi bakıyorum, 1+1" },
  { id: "s-re-09", kind: "category", text: "Bağ evi arıyorum, müstakil" },
  { id: "s-re-10", kind: "category", text: "Otopark yeri kiralamak istiyorum, kapalı" },
  { id: "s-re-11", kind: "category", text: "Devremülk arıyorum, satılık" },
  { id: "s-re-12", kind: "category", text: "Çiftlik arıyorum, hayvancılık için uygun" },
  { id: "s-re-13", kind: "category", text: "Ofis katı kiralamak istiyorum, 200 metrekare" },
  { id: "s-re-14", kind: "category", text: "Kooperatif hissesi arıyorum" },
  { id: "s-re-15", kind: "category", text: "Bahçeli müstakil ev bakıyorum, kiralık" },
  { id: "s-re-16", kind: "category", text: "Zeytinlik arıyorum, satılık arazi" },

  // --- SERVICES ---
  { id: "s-svc-01", kind: "category", text: "Cam balkon montajı yaptırmak istiyorum" },
  { id: "s-svc-02", kind: "category", text: "Halı yıkama hizmeti arıyorum" },
  { id: "s-svc-03", kind: "category", text: "Bahçe peyzaj düzenlemesi yaptırmak istiyorum" },
  { id: "s-svc-04", kind: "category", text: "Tercüman arıyorum, noter onaylı çeviri için" },
  { id: "s-svc-05", kind: "category", text: "Catering hizmeti arıyorum, 200 kişilik" },
  { id: "s-svc-06", kind: "category", text: "Güvenlik personeli arıyorum, site için" },
  { id: "s-svc-07", kind: "category", text: "Çatı yalıtımı yaptırmak istiyorum" },
  { id: "s-svc-08", kind: "category", text: "Piyano dersi arıyorum, başlangıç seviyesi" },
  { id: "s-svc-09", kind: "category", text: "Şirket kuruluşu için mali müşavir arıyorum" },
  { id: "s-svc-10", kind: "category", text: "Böcek ilaçlama hizmeti arıyorum, restoran için" },
  { id: "s-svc-11", kind: "category", text: "Dijital reklam ajansı arıyorum" },
  { id: "s-svc-12", kind: "category", text: "Asansör bakım sözleşmesi yaptırmak istiyorum" },
  { id: "s-svc-13", kind: "category", text: "Kurumsal İngilizce eğitimi arıyorum" },
  { id: "s-svc-14", kind: "category", text: "Su kaçağı tespiti yaptırmak istiyorum" },
  { id: "s-svc-15", kind: "category", text: "Doğum günü organizasyonu yaptırmak istiyorum" },
  { id: "s-svc-16", kind: "category", text: "Avukat arıyorum, iş hukuku konusunda" },

  // --- TECHNOLOGY ---
  { id: "s-tech-01", kind: "category", text: "Güvenlik kamerası sistemi arıyorum, 8 kanal" },
  { id: "s-tech-02", kind: "category", text: "Sunucu kabini arıyorum, 42U" },
  { id: "s-tech-03", kind: "category", text: "Tablet almak istiyorum, çizim için kalemli" },
  { id: "s-tech-04", kind: "category", text: "Barkod okuyucu arıyorum, kablosuz" },
  { id: "s-tech-05", kind: "category", text: "Mobil uygulama yaptırmak istiyorum, iOS ve Android" },
  { id: "s-tech-06", kind: "category", text: "Kesintisiz güç kaynağı bakıyorum, 3 kVA" },
  { id: "s-tech-07", kind: "category", text: "Monitör arıyorum, 27 inç 144 Hz" },
  { id: "s-tech-08", kind: "category", text: "Ağ switch'i lazım, 24 portlu yönetilebilir" },
  { id: "s-tech-09", kind: "category", text: "CRM yazılımı arıyorum, satış ekibi için" },
  { id: "s-tech-10", kind: "category", text: "Drone almak istiyorum, haritalama için" },
  { id: "s-tech-11", kind: "category", text: "3D yazıcı bakıyorum, reçineli" },
  { id: "s-tech-12", kind: "category", text: "Yazarkasa POS cihazı arıyorum" },
  { id: "s-tech-13", kind: "category", text: "Veri kurtarma hizmeti arıyorum, harddisk bozuldu" },
  { id: "s-tech-14", kind: "category", text: "Akıllı ev otomasyonu kurdurmak istiyorum" },
  { id: "s-tech-15", kind: "category", text: "Projeksiyon cihazı kiralamak istiyorum, sunum için" },
  { id: "s-tech-16", kind: "category", text: "Depolama ünitesi arıyorum, NAS dört yuvalı" },

  // --- 11 KÖKÜN DIŞINDA AMA MEŞRU TALEP ---
  { id: "s-oot-01", kind: "out-of-taxonomy", text: "Köpek maması arıyorum, tahılsız 15 kg" },
  { id: "s-oot-02", kind: "out-of-taxonomy", text: "Akvaryum ve filtre seti almak istiyorum" },
  { id: "s-oot-03", kind: "out-of-taxonomy", text: "Gitar arıyorum, akustik başlangıç seti" },
  { id: "s-oot-04", kind: "out-of-taxonomy", text: "Zeytinyağı almak istiyorum, 5 litre soğuk sıkım" },
  { id: "s-oot-05", kind: "out-of-taxonomy", text: "Kuru kayısı arıyorum, toptan 100 kg" },
  { id: "s-oot-06", kind: "out-of-taxonomy", text: "Bisiklet kaskı bakıyorum, dağ bisikleti için" },
  { id: "s-oot-07", kind: "out-of-taxonomy", text: "Fide arıyorum, domates ve biber" },
  { id: "s-oot-08", kind: "out-of-taxonomy", text: "Kedi kumu almak istiyorum, topaklanan" },
  { id: "s-oot-09", kind: "out-of-taxonomy", text: "Tenis raketi arıyorum, orta seviye" },
  { id: "s-oot-10", kind: "out-of-taxonomy", text: "Deri ceket bakıyorum, erkek L beden" },
  { id: "s-oot-11", kind: "out-of-taxonomy", text: "Koşu ayakkabısı arıyorum, 43 numara" },
  { id: "s-oot-12", kind: "out-of-taxonomy", text: "Satranç takımı almak istiyorum, ahşap" },
  { id: "s-oot-13", kind: "out-of-taxonomy", text: "Bal arıyorum, çam balı 2 kg" },
  { id: "s-oot-14", kind: "out-of-taxonomy", text: "Kamp çadırı bakıyorum, dört kişilik" },
  { id: "s-oot-15", kind: "out-of-taxonomy", text: "Yağlı boya ve tuval seti arıyorum" },
  { id: "s-oot-16", kind: "out-of-taxonomy", text: "Gözlük çerçevesi arıyorum, titanyum" },
  { id: "s-oot-17", kind: "out-of-taxonomy", text: "Kuş yemi almak istiyorum, muhabbet kuşu için" },
  { id: "s-oot-18", kind: "out-of-taxonomy", text: "Şarap arıyorum, hediyelik kırmızı" },
  { id: "s-oot-19", kind: "out-of-taxonomy", text: "Halı saha forması bastırmak değil, hazır forma arıyorum" },
  { id: "s-oot-20", kind: "out-of-taxonomy", text: "Balık tutma kamışı bakıyorum, olta seti" },

  // --- KAPSAM DIŞI: ARZ İLANI ---
  { id: "s-sup-01", kind: "out-of-scope", text: "Dükkanımı devretmek istiyorum, müşteri portföyü hazır" },
  { id: "s-sup-02", kind: "out-of-scope", text: "İkinci el telefonumu satmak istiyorum, kutusu var" },
  { id: "s-sup-03", kind: "out-of-scope", text: "Yazlığımı sezonluk kiraya vermek istiyorum" },
  { id: "s-sup-04", kind: "out-of-scope", text: "Traktörümü satıyorum, 2015 model" },
  { id: "s-sup-05", kind: "out-of-scope", text: "Ofisimdeki mobilyaları elden çıkarmak istiyorum" },
  { id: "s-sup-06", kind: "out-of-scope", text: "Arsamı satışa çıkarmak istiyorum" },
  { id: "s-sup-07", kind: "out-of-scope", text: "Depomu aylık kiraya vermek istiyorum" },
  { id: "s-sup-08", kind: "out-of-scope", text: "Buzdolabımı satıyorum, az kullanılmış" },
  { id: "s-sup-09", kind: "out-of-scope", text: "Motorumu takas etmek istiyorum" },
  { id: "s-sup-10", kind: "out-of-scope", text: "Dairemi kiracıya vermek istiyorum, eşyalı" },

  // --- KAPSAM DIŞI: İLAÇ / ECZANE ---
  { id: "s-phr-01", kind: "out-of-scope", text: "Antibiyotik arıyorum, reçetesiz olan var mı" },
  { id: "s-phr-02", kind: "out-of-scope", text: "D vitamini damla almak istiyorum" },
  { id: "s-phr-03", kind: "out-of-scope", text: "Öksürük şurubu arıyorum, çocuk için" },
  { id: "s-phr-04", kind: "out-of-scope", text: "Yara merhemi lazım, yanık için" },
  { id: "s-phr-05", kind: "out-of-scope", text: "Tansiyon hapı arıyorum, eczaneden" },

  // --- KAPSAM DIŞI: TIBBİ TAVSİYE ---
  { id: "s-med-01", kind: "out-of-scope", text: "Sırtımdaki ağrı ne olabilir, hangi doktora gitmeliyim" },
  { id: "s-med-02", kind: "out-of-scope", text: "Bu dozu günde kaç kere almalıyım" },
  { id: "s-med-03", kind: "out-of-scope", text: "Çocuğumun ateşi düşmüyor, ne yapmalıyım" },
  { id: "s-med-04", kind: "out-of-scope", text: "Bu belirtiler hangi hastalığın işareti" },
  { id: "s-med-05", kind: "out-of-scope", text: "Kan değerlerim yüksek çıktı, ne anlama geliyor" },
];

/** Korpusla AYNI deterministik dönüşümler — üslup ekseni burada da olsun diye. */
export function stripDiacritics(s) {
  return s
    .replace(/ç/g, "c").replace(/Ç/g, "C")
    .replace(/ğ/g, "g").replace(/Ğ/g, "G")
    .replace(/ı/g, "i").replace(/İ/g, "I")
    .replace(/ö/g, "o").replace(/Ö/g, "O")
    .replace(/ş/g, "s").replace(/Ş/g, "S")
    .replace(/ü/g, "u").replace(/Ü/g, "U");
}

function dropLetter(s) {
  const words = s.split(/\s+/);
  let bestIdx = -1;
  let bestLen = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i] ?? "";
    if (/\d/.test(w)) continue;
    if (w.length > bestLen && w.length >= 7) {
      bestLen = w.length;
      bestIdx = i;
    }
  }
  if (bestIdx < 0) return null;
  const w = words[bestIdx];
  const cut = 2 + (w.length % (w.length - 4 > 1 ? w.length - 4 : 1));
  words[bestIdx] = w.slice(0, cut) + w.slice(cut + 1);
  return words.join(" ");
}

function swapVerb(s) {
  if (/arıyorum/.test(s)) return s.replace(/arıyorum/, "arıyom");
  if (/istiyorum/.test(s)) return s.replace(/istiyorum/, "istiyom");
  if (/bakıyorum/.test(s)) return s.replace(/bakıyorum/, "bakıyom");
  return null;
}

/**
 * Bir taban cümleden üslup türevleri. Dönüşümler ANLAM KORUYUCU seçildi —
 * damıtma etiketi tabana bir kez sorulup türevlere taşınıyor, bu yüzden
 * anlamı değiştiren bir dönüşüm etiketi de yanlışlar.
 */
export function expandBase(base) {
  const out = [{ variant: "orijinal", text: base.text }];
  out.push({ variant: "ascii", text: stripDiacritics(base.text).toLowerCase() });
  const typo = dropLetter(base.text);
  if (typo) out.push({ variant: "typo", text: typo });
  const konusma = swapVerb(base.text);
  if (konusma) out.push({ variant: "konusma", text: konusma });
  out.push({ variant: "acil", text: `${base.text} acil` });
  return out;
}
