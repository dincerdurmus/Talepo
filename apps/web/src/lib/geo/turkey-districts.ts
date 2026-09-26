// Static Turkey province / district data (81 il, 973 ilce).
// Source: TurkiyeAPI 2025 dataset — data-only module.
import { resolveWellKnownSemt } from "@/lib/geo/well-known-semt";

export type TurkeyProvince = { il: string; ilceler: string[] };

export const TURKEY_PROVINCES: TurkeyProvince[] = [
  {
    "il": "Adana",
    "ilceler": [
      "Aladağ",
      "Ceyhan",
      "Çukurova",
      "Feke",
      "İmamoğlu",
      "Karaisalı",
      "Karataş",
      "Kozan",
      "Pozantı",
      "Saimbeyli",
      "Sarıçam",
      "Seyhan",
      "Tufanbeyli",
      "Yumurtalık",
      "Yüreğir"
    ]
  },
  {
    "il": "Adıyaman",
    "ilceler": [
      "Besni",
      "Çelikhan",
      "Gerger",
      "Gölbaşı",
      "Kahta",
      "Merkez",
      "Samsat",
      "Sincik",
      "Tut"
    ]
  },
  {
    "il": "Afyonkarahisar",
    "ilceler": [
      "Başmakçı",
      "Bayat",
      "Bolvadin",
      "Çay",
      "Çobanlar",
      "Dazkırı",
      "Dinar",
      "Emirdağ",
      "Evciler",
      "Hocalar",
      "İhsaniye",
      "İscehisar",
      "Kızılören",
      "Merkez",
      "Sandıklı",
      "Sinanpaşa",
      "Sultandağı",
      "Şuhut"
    ]
  },
  {
    "il": "Ağrı",
    "ilceler": [
      "Diyadin",
      "Doğubayazıt",
      "Eleşkirt",
      "Hamur",
      "Merkez",
      "Patnos",
      "Taşlıçay",
      "Tutak"
    ]
  },
  {
    "il": "Aksaray",
    "ilceler": [
      "Ağaçören",
      "Eskil",
      "Gülağaç",
      "Güzelyurt",
      "Merkez",
      "Ortaköy",
      "Sarıyahşi",
      "Sultanhanı"
    ]
  },
  {
    "il": "Amasya",
    "ilceler": [
      "Göynücek",
      "Gümüşhacıköy",
      "Hamamözü",
      "Merkez",
      "Merzifon",
      "Suluova",
      "Taşova"
    ]
  },
  {
    "il": "Ankara",
    "ilceler": [
      "Akyurt",
      "Altındağ",
      "Ayaş",
      "Bala",
      "Beypazarı",
      "Çamlıdere",
      "Çankaya",
      "Çubuk",
      "Elmadağ",
      "Etimesgut",
      "Evren",
      "Gölbaşı",
      "Güdül",
      "Haymana",
      "Kahramankazan",
      "Kalecik",
      "Keçiören",
      "Kızılcahamam",
      "Mamak",
      "Nallıhan",
      "Polatlı",
      "Pursaklar",
      "Sincan",
      "Şereflikoçhisar",
      "Yenimahalle"
    ]
  },
  {
    "il": "Antalya",
    "ilceler": [
      "Akseki",
      "Aksu",
      "Alanya",
      "Demre",
      "Döşemealtı",
      "Elmalı",
      "Finike",
      "Gazipaşa",
      "Gündoğmuş",
      "İbradı",
      "Kaş",
      "Kemer",
      "Kepez",
      "Konyaaltı",
      "Korkuteli",
      "Kumluca",
      "Manavgat",
      "Muratpaşa",
      "Serik"
    ]
  },
  {
    "il": "Ardahan",
    "ilceler": [
      "Çıldır",
      "Damal",
      "Göle",
      "Hanak",
      "Merkez",
      "Posof"
    ]
  },
  {
    "il": "Artvin",
    "ilceler": [
      "Ardanuç",
      "Arhavi",
      "Borçka",
      "Hopa",
      "Kemalpaşa",
      "Merkez",
      "Murgul",
      "Şavşat",
      "Yusufeli"
    ]
  },
  {
    "il": "Aydın",
    "ilceler": [
      "Bozdoğan",
      "Buharkent",
      "Çine",
      "Didim",
      "Efeler",
      "Germencik",
      "İncirliova",
      "Karacasu",
      "Karpuzlu",
      "Koçarlı",
      "Köşk",
      "Kuşadası",
      "Kuyucak",
      "Nazilli",
      "Söke",
      "Sultanhisar",
      "Yenipazar"
    ]
  },
  {
    "il": "Balıkesir",
    "ilceler": [
      "Altıeylül",
      "Ayvalık",
      "Balya",
      "Bandırma",
      "Bigadiç",
      "Burhaniye",
      "Dursunbey",
      "Edremit",
      "Erdek",
      "Gömeç",
      "Gönen",
      "Havran",
      "İvrindi",
      "Karesi",
      "Kepsut",
      "Manyas",
      "Marmara",
      "Savaştepe",
      "Sındırgı",
      "Susurluk"
    ]
  },
  {
    "il": "Bartın",
    "ilceler": [
      "Amasra",
      "Kurucaşile",
      "Merkez",
      "Ulus"
    ]
  },
  {
    "il": "Batman",
    "ilceler": [
      "Beşiri",
      "Gercüş",
      "Hasankeyf",
      "Kozluk",
      "Merkez",
      "Sason"
    ]
  },
  {
    "il": "Bayburt",
    "ilceler": [
      "Aydıntepe",
      "Demirözü",
      "Merkez"
    ]
  },
  {
    "il": "Bilecik",
    "ilceler": [
      "Bozüyük",
      "Gölpazarı",
      "İnhisar",
      "Merkez",
      "Osmaneli",
      "Pazaryeri",
      "Söğüt",
      "Yenipazar"
    ]
  },
  {
    "il": "Bingöl",
    "ilceler": [
      "Adaklı",
      "Genç",
      "Karlıova",
      "Kiğı",
      "Merkez",
      "Solhan",
      "Yayladere",
      "Yedisu"
    ]
  },
  {
    "il": "Bitlis",
    "ilceler": [
      "Adilcevaz",
      "Ahlat",
      "Güroymak",
      "Hizan",
      "Merkez",
      "Mutki",
      "Tatvan"
    ]
  },
  {
    "il": "Bolu",
    "ilceler": [
      "Dörtdivan",
      "Gerede",
      "Göynük",
      "Kıbrıscık",
      "Mengen",
      "Merkez",
      "Mudurnu",
      "Seben",
      "Yeniçağa"
    ]
  },
  {
    "il": "Burdur",
    "ilceler": [
      "Ağlasun",
      "Altınyayla",
      "Bucak",
      "Çavdır",
      "Çeltikçi",
      "Gölhisar",
      "Karamanlı",
      "Kemer",
      "Merkez",
      "Tefenni",
      "Yeşilova"
    ]
  },
  {
    "il": "Bursa",
    "ilceler": [
      "Büyükorhan",
      "Gemlik",
      "Gürsu",
      "Harmancık",
      "İnegöl",
      "İznik",
      "Karacabey",
      "Keles",
      "Kestel",
      "Mudanya",
      "Mustafakemalpaşa",
      "Nilüfer",
      "Orhaneli",
      "Orhangazi",
      "Osmangazi",
      "Yenişehir",
      "Yıldırım"
    ]
  },
  {
    "il": "Çanakkale",
    "ilceler": [
      "Ayvacık",
      "Bayramiç",
      "Biga",
      "Bozcaada",
      "Çan",
      "Eceabat",
      "Ezine",
      "Gelibolu",
      "Gökçeada",
      "Lapseki",
      "Merkez",
      "Yenice"
    ]
  },
  {
    "il": "Çankırı",
    "ilceler": [
      "Atkaracalar",
      "Bayramören",
      "Çerkeş",
      "Eldivan",
      "Ilgaz",
      "Kızılırmak",
      "Korgun",
      "Kurşunlu",
      "Merkez",
      "Orta",
      "Şabanözü",
      "Yapraklı"
    ]
  },
  {
    "il": "Çorum",
    "ilceler": [
      "Alaca",
      "Bayat",
      "Boğazkale",
      "Dodurga",
      "İskilip",
      "Kargı",
      "Laçin",
      "Mecitözü",
      "Merkez",
      "Oğuzlar",
      "Ortaköy",
      "Osmancık",
      "Sungurlu",
      "Uğurludağ"
    ]
  },
  {
    "il": "Denizli",
    "ilceler": [
      "Acıpayam",
      "Babadağ",
      "Baklan",
      "Bekilli",
      "Beyağaç",
      "Bozkurt",
      "Buldan",
      "Çal",
      "Çameli",
      "Çardak",
      "Çivril",
      "Güney",
      "Honaz",
      "Kale",
      "Merkezefendi",
      "Pamukkale",
      "Sarayköy",
      "Serinhisar",
      "Tavas"
    ]
  },
  {
    "il": "Diyarbakır",
    "ilceler": [
      "Bağlar",
      "Bismil",
      "Çermik",
      "Çınar",
      "Çüngüş",
      "Dicle",
      "Eğil",
      "Ergani",
      "Hani",
      "Hazro",
      "Kayapınar",
      "Kocaköy",
      "Kulp",
      "Lice",
      "Silvan",
      "Sur",
      "Yenişehir"
    ]
  },
  {
    "il": "Düzce",
    "ilceler": [
      "Akçakoca",
      "Cumayeri",
      "Çilimli",
      "Gölyaka",
      "Gümüşova",
      "Kaynaşlı",
      "Merkez",
      "Yığılca"
    ]
  },
  {
    "il": "Edirne",
    "ilceler": [
      "Enez",
      "Havsa",
      "İpsala",
      "Keşan",
      "Lalapaşa",
      "Meriç",
      "Merkez",
      "Süloğlu",
      "Uzunköprü"
    ]
  },
  {
    "il": "Elazığ",
    "ilceler": [
      "Ağın",
      "Alacakaya",
      "Arıcak",
      "Baskil",
      "Karakoçan",
      "Keban",
      "Kovancılar",
      "Maden",
      "Merkez",
      "Palu",
      "Sivrice"
    ]
  },
  {
    "il": "Erzincan",
    "ilceler": [
      "Çayırlı",
      "İliç",
      "Kemah",
      "Kemaliye",
      "Merkez",
      "Otlukbeli",
      "Refahiye",
      "Tercan",
      "Üzümlü"
    ]
  },
  {
    "il": "Erzurum",
    "ilceler": [
      "Aşkale",
      "Aziziye",
      "Çat",
      "Hınıs",
      "Horasan",
      "İspir",
      "Karaçoban",
      "Karayazı",
      "Köprüköy",
      "Narman",
      "Oltu",
      "Olur",
      "Palandöken",
      "Pasinler",
      "Pazaryolu",
      "Şenkaya",
      "Tekman",
      "Tortum",
      "Uzundere",
      "Yakutiye"
    ]
  },
  {
    "il": "Eskişehir",
    "ilceler": [
      "Alpu",
      "Beylikova",
      "Çifteler",
      "Günyüzü",
      "Han",
      "İnönü",
      "Mahmudiye",
      "Mihalgazi",
      "Mihalıççık",
      "Odunpazarı",
      "Sarıcakaya",
      "Seyitgazi",
      "Sivrihisar",
      "Tepebaşı"
    ]
  },
  {
    "il": "Gaziantep",
    "ilceler": [
      "Araban",
      "İslahiye",
      "Karkamış",
      "Nizip",
      "Nurdağı",
      "Oğuzeli",
      "Şahinbey",
      "Şehitkamil",
      "Yavuzeli"
    ]
  },
  {
    "il": "Giresun",
    "ilceler": [
      "Alucra",
      "Bulancak",
      "Çamoluk",
      "Çanakçı",
      "Dereli",
      "Doğankent",
      "Espiye",
      "Eynesil",
      "Görele",
      "Güce",
      "Keşap",
      "Merkez",
      "Piraziz",
      "Şebinkarahisar",
      "Tirebolu",
      "Yağlıdere"
    ]
  },
  {
    "il": "Gümüşhane",
    "ilceler": [
      "Kelkit",
      "Köse",
      "Kürtün",
      "Merkez",
      "Şiran",
      "Torul"
    ]
  },
  {
    "il": "Hakkari",
    "ilceler": [
      "Çukurca",
      "Derecik",
      "Merkez",
      "Şemdinli",
      "Yüksekova"
    ]
  },
  {
    "il": "Hatay",
    "ilceler": [
      "Altınözü",
      "Antakya",
      "Arsuz",
      "Belen",
      "Defne",
      "Dörtyol",
      "Erzin",
      "Hassa",
      "İskenderun",
      "Kırıkhan",
      "Kumlu",
      "Payas",
      "Reyhanlı",
      "Samandağ",
      "Yayladağı"
    ]
  },
  {
    "il": "Iğdır",
    "ilceler": [
      "Aralık",
      "Karakoyunlu",
      "Merkez",
      "Tuzluca"
    ]
  },
  {
    "il": "Isparta",
    "ilceler": [
      "Aksu",
      "Atabey",
      "Eğirdir",
      "Gelendost",
      "Gönen",
      "Keçiborlu",
      "Merkez",
      "Senirkent",
      "Sütçüler",
      "Şarkikaraağaç",
      "Uluborlu",
      "Yalvaç",
      "Yenişarbademli"
    ]
  },
  {
    "il": "İstanbul",
    "ilceler": [
      "Adalar",
      "Arnavutköy",
      "Ataşehir",
      "Avcılar",
      "Bağcılar",
      "Bahçelievler",
      "Bakırköy",
      "Başakşehir",
      "Bayrampaşa",
      "Beşiktaş",
      "Beykoz",
      "Beylikdüzü",
      "Beyoğlu",
      "Büyükçekmece",
      "Çatalca",
      "Çekmeköy",
      "Esenler",
      "Esenyurt",
      "Eyüpsultan",
      "Fatih",
      "Gaziosmanpaşa",
      "Güngören",
      "Kadıköy",
      "Kağıthane",
      "Kartal",
      "Küçükçekmece",
      "Maltepe",
      "Pendik",
      "Sancaktepe",
      "Sarıyer",
      "Silivri",
      "Sultanbeyli",
      "Sultangazi",
      "Şile",
      "Şişli",
      "Tuzla",
      "Ümraniye",
      "Üsküdar",
      "Zeytinburnu"
    ]
  },
  {
    "il": "İzmir",
    "ilceler": [
      "Aliağa",
      "Balçova",
      "Bayındır",
      "Bayraklı",
      "Bergama",
      "Beydağ",
      "Bornova",
      "Buca",
      "Çeşme",
      "Çiğli",
      "Dikili",
      "Foça",
      "Gaziemir",
      "Güzelbahçe",
      "Karabağlar",
      "Karaburun",
      "Karşıyaka",
      "Kemalpaşa",
      "Kınık",
      "Kiraz",
      "Konak",
      "Menderes",
      "Menemen",
      "Narlıdere",
      "Ödemiş",
      "Seferihisar",
      "Selçuk",
      "Tire",
      "Torbalı",
      "Urla"
    ]
  },
  {
    "il": "Kahramanmaraş",
    "ilceler": [
      "Afşin",
      "Andırın",
      "Çağlayancerit",
      "Dulkadiroğlu",
      "Ekinözü",
      "Elbistan",
      "Göksun",
      "Nurhak",
      "Onikişubat",
      "Pazarcık",
      "Türkoğlu"
    ]
  },
  {
    "il": "Karabük",
    "ilceler": [
      "Eflani",
      "Eskipazar",
      "Merkez",
      "Ovacık",
      "Safranbolu",
      "Yenice"
    ]
  },
  {
    "il": "Karaman",
    "ilceler": [
      "Ayrancı",
      "Başyayla",
      "Ermenek",
      "Kazımkarabekir",
      "Merkez",
      "Sarıveliler"
    ]
  },
  {
    "il": "Kars",
    "ilceler": [
      "Akyaka",
      "Arpaçay",
      "Digor",
      "Kağızman",
      "Merkez",
      "Sarıkamış",
      "Selim",
      "Susuz"
    ]
  },
  {
    "il": "Kastamonu",
    "ilceler": [
      "Abana",
      "Ağlı",
      "Araç",
      "Azdavay",
      "Bozkurt",
      "Cide",
      "Çatalzeytin",
      "Daday",
      "Devrekani",
      "Doğanyurt",
      "Hanönü",
      "İhsangazi",
      "İnebolu",
      "Küre",
      "Merkez",
      "Pınarbaşı",
      "Seydiler",
      "Şenpazar",
      "Taşköprü",
      "Tosya"
    ]
  },
  {
    "il": "Kayseri",
    "ilceler": [
      "Akkışla",
      "Bünyan",
      "Develi",
      "Felahiye",
      "Hacılar",
      "İncesu",
      "Kocasinan",
      "Melikgazi",
      "Özvatan",
      "Pınarbaşı",
      "Sarıoğlan",
      "Sarız",
      "Talas",
      "Tomarza",
      "Yahyalı",
      "Yeşilhisar"
    ]
  },
  {
    "il": "Kırıkkale",
    "ilceler": [
      "Bahşılı",
      "Balışeyh",
      "Çelebi",
      "Delice",
      "Karakeçili",
      "Keskin",
      "Merkez",
      "Sulakyurt",
      "Yahşihan"
    ]
  },
  {
    "il": "Kırklareli",
    "ilceler": [
      "Babaeski",
      "Demirköy",
      "Kofçaz",
      "Lüleburgaz",
      "Merkez",
      "Pehlivanköy",
      "Pınarhisar",
      "Vize"
    ]
  },
  {
    "il": "Kırşehir",
    "ilceler": [
      "Akçakent",
      "Akpınar",
      "Boztepe",
      "Çiçekdağı",
      "Kaman",
      "Merkez",
      "Mucur"
    ]
  },
  {
    "il": "Kilis",
    "ilceler": [
      "Elbeyli",
      "Merkez",
      "Musabeyli",
      "Polateli"
    ]
  },
  {
    "il": "Kocaeli",
    "ilceler": [
      "Başiskele",
      "Çayırova",
      "Darıca",
      "Derince",
      "Dilovası",
      "Gebze",
      "Gölcük",
      "İzmit",
      "Kandıra",
      "Karamürsel",
      "Kartepe",
      "Körfez"
    ]
  },
  {
    "il": "Konya",
    "ilceler": [
      "Ahırlı",
      "Akören",
      "Akşehir",
      "Altınekin",
      "Beyşehir",
      "Bozkır",
      "Cihanbeyli",
      "Çeltik",
      "Çumra",
      "Derbent",
      "Derebucak",
      "Doğanhisar",
      "Emirgazi",
      "Ereğli",
      "Güneysınır",
      "Hadim",
      "Halkapınar",
      "Hüyük",
      "Ilgın",
      "Kadınhanı",
      "Karapınar",
      "Karatay",
      "Kulu",
      "Meram",
      "Sarayönü",
      "Selçuklu",
      "Seydişehir",
      "Taşkent",
      "Tuzlukçu",
      "Yalıhüyük",
      "Yunak"
    ]
  },
  {
    "il": "Kütahya",
    "ilceler": [
      "Altıntaş",
      "Aslanapa",
      "Çavdarhisar",
      "Domaniç",
      "Dumlupınar",
      "Emet",
      "Gediz",
      "Hisarcık",
      "Merkez",
      "Pazarlar",
      "Simav",
      "Şaphane",
      "Tavşanlı"
    ]
  },
  {
    "il": "Malatya",
    "ilceler": [
      "Akçadağ",
      "Arapgir",
      "Arguvan",
      "Battalgazi",
      "Darende",
      "Doğanşehir",
      "Doğanyol",
      "Hekimhan",
      "Kale",
      "Kuluncak",
      "Pütürge",
      "Yazıhan",
      "Yeşilyurt"
    ]
  },
  {
    "il": "Manisa",
    "ilceler": [
      "Ahmetli",
      "Akhisar",
      "Alaşehir",
      "Demirci",
      "Gölmarmara",
      "Gördes",
      "Kırkağaç",
      "Köprübaşı",
      "Kula",
      "Salihli",
      "Sarıgöl",
      "Saruhanlı",
      "Selendi",
      "Soma",
      "Şehzadeler",
      "Turgutlu",
      "Yunusemre"
    ]
  },
  {
    "il": "Mardin",
    "ilceler": [
      "Artuklu",
      "Dargeçit",
      "Derik",
      "Kızıltepe",
      "Mazıdağı",
      "Midyat",
      "Nusaybin",
      "Ömerli",
      "Savur",
      "Yeşilli"
    ]
  },
  {
    "il": "Mersin",
    "ilceler": [
      "Akdeniz",
      "Anamur",
      "Aydıncık",
      "Bozyazı",
      "Çamlıyayla",
      "Erdemli",
      "Gülnar",
      "Mezitli",
      "Mut",
      "Silifke",
      "Tarsus",
      "Toroslar",
      "Yenişehir"
    ]
  },
  {
    "il": "Muğla",
    "ilceler": [
      "Bodrum",
      "Dalaman",
      "Datça",
      "Fethiye",
      "Kavaklıdere",
      "Köyceğiz",
      "Marmaris",
      "Menteşe",
      "Milas",
      "Ortaca",
      "Seydikemer",
      "Ula",
      "Yatağan"
    ]
  },
  {
    "il": "Muş",
    "ilceler": [
      "Bulanık",
      "Hasköy",
      "Korkut",
      "Malazgirt",
      "Merkez",
      "Varto"
    ]
  },
  {
    "il": "Nevşehir",
    "ilceler": [
      "Acıgöl",
      "Avanos",
      "Derinkuyu",
      "Gülşehir",
      "Hacıbektaş",
      "Kozaklı",
      "Merkez",
      "Ürgüp"
    ]
  },
  {
    "il": "Niğde",
    "ilceler": [
      "Altunhisar",
      "Bor",
      "Çamardı",
      "Çiftlik",
      "Merkez",
      "Ulukışla"
    ]
  },
  {
    "il": "Ordu",
    "ilceler": [
      "Akkuş",
      "Altınordu",
      "Aybastı",
      "Çamaş",
      "Çatalpınar",
      "Çaybaşı",
      "Fatsa",
      "Gölköy",
      "Gülyalı",
      "Gürgentepe",
      "İkizce",
      "Kabadüz",
      "Kabataş",
      "Korgan",
      "Kumru",
      "Mesudiye",
      "Perşembe",
      "Ulubey",
      "Ünye"
    ]
  },
  {
    "il": "Osmaniye",
    "ilceler": [
      "Bahçe",
      "Düziçi",
      "Hasanbeyli",
      "Kadirli",
      "Merkez",
      "Sumbas",
      "Toprakkale"
    ]
  },
  {
    "il": "Rize",
    "ilceler": [
      "Ardeşen",
      "Çamlıhemşin",
      "Çayeli",
      "Derepazarı",
      "Fındıklı",
      "Güneysu",
      "Hemşin",
      "İkizdere",
      "İyidere",
      "Kalkandere",
      "Merkez",
      "Pazar"
    ]
  },
  {
    "il": "Sakarya",
    "ilceler": [
      "Adapazarı",
      "Akyazı",
      "Arifiye",
      "Erenler",
      "Ferizli",
      "Geyve",
      "Hendek",
      "Karapürçek",
      "Karasu",
      "Kaynarca",
      "Kocaali",
      "Pamukova",
      "Sapanca",
      "Serdivan",
      "Söğütlü",
      "Taraklı"
    ]
  },
  {
    "il": "Samsun",
    "ilceler": [
      "19 Mayıs",
      "Alaçam",
      "Asarcık",
      "Atakum",
      "Ayvacık",
      "Bafra",
      "Canik",
      "Çarşamba",
      "Havza",
      "İlkadım",
      "Kavak",
      "Ladik",
      "Salıpazarı",
      "Tekkeköy",
      "Terme",
      "Vezirköprü",
      "Yakakent"
    ]
  },
  {
    "il": "Siirt",
    "ilceler": [
      "Baykan",
      "Eruh",
      "Kurtalan",
      "Merkez",
      "Pervari",
      "Şirvan",
      "Tillo"
    ]
  },
  {
    "il": "Sinop",
    "ilceler": [
      "Ayancık",
      "Boyabat",
      "Dikmen",
      "Durağan",
      "Erfelek",
      "Gerze",
      "Merkez",
      "Saraydüzü",
      "Türkeli"
    ]
  },
  {
    "il": "Sivas",
    "ilceler": [
      "Akıncılar",
      "Altınyayla",
      "Divriği",
      "Doğanşar",
      "Gemerek",
      "Gölova",
      "Gürün",
      "Hafik",
      "İmranlı",
      "Kangal",
      "Koyulhisar",
      "Merkez",
      "Suşehri",
      "Şarkışla",
      "Ulaş",
      "Yıldızeli",
      "Zara"
    ]
  },
  {
    "il": "Şanlıurfa",
    "ilceler": [
      "Akçakale",
      "Birecik",
      "Bozova",
      "Ceylanpınar",
      "Eyyübiye",
      "Halfeti",
      "Haliliye",
      "Harran",
      "Hilvan",
      "Karaköprü",
      "Siverek",
      "Suruç",
      "Viranşehir"
    ]
  },
  {
    "il": "Şırnak",
    "ilceler": [
      "Beytüşşebap",
      "Cizre",
      "Güçlükonak",
      "İdil",
      "Merkez",
      "Silopi",
      "Uludere"
    ]
  },
  {
    "il": "Tekirdağ",
    "ilceler": [
      "Çerkezköy",
      "Çorlu",
      "Ergene",
      "Hayrabolu",
      "Kapaklı",
      "Malkara",
      "Marmaraereğlisi",
      "Muratlı",
      "Saray",
      "Süleymanpaşa",
      "Şarköy"
    ]
  },
  {
    "il": "Tokat",
    "ilceler": [
      "Almus",
      "Artova",
      "Başçiftlik",
      "Erbaa",
      "Merkez",
      "Niksar",
      "Pazar",
      "Reşadiye",
      "Sulusaray",
      "Turhal",
      "Yeşilyurt",
      "Zile"
    ]
  },
  {
    "il": "Trabzon",
    "ilceler": [
      "Akçaabat",
      "Araklı",
      "Arsin",
      "Beşikdüzü",
      "Çarşıbaşı",
      "Çaykara",
      "Dernekpazarı",
      "Düzköy",
      "Hayrat",
      "Köprübaşı",
      "Maçka",
      "Of",
      "Ortahisar",
      "Sürmene",
      "Şalpazarı",
      "Tonya",
      "Vakfıkebir",
      "Yomra"
    ]
  },
  {
    "il": "Tunceli",
    "ilceler": [
      "Çemişgezek",
      "Hozat",
      "Mazgirt",
      "Merkez",
      "Nazımiye",
      "Ovacık",
      "Pertek",
      "Pülümür"
    ]
  },
  {
    "il": "Uşak",
    "ilceler": [
      "Banaz",
      "Eşme",
      "Karahallı",
      "Merkez",
      "Sivaslı",
      "Ulubey"
    ]
  },
  {
    "il": "Van",
    "ilceler": [
      "Bahçesaray",
      "Başkale",
      "Çaldıran",
      "Çatak",
      "Edremit",
      "Erciş",
      "Gevaş",
      "Gürpınar",
      "İpekyolu",
      "Muradiye",
      "Özalp",
      "Saray",
      "Tuşba"
    ]
  },
  {
    "il": "Yalova",
    "ilceler": [
      "Altınova",
      "Armutlu",
      "Çınarcık",
      "Çiftlikköy",
      "Merkez",
      "Termal"
    ]
  },
  {
    "il": "Yozgat",
    "ilceler": [
      "Akdağmadeni",
      "Aydıncık",
      "Boğazlıyan",
      "Çandır",
      "Çayıralan",
      "Çekerek",
      "Kadışehri",
      "Merkez",
      "Saraykent",
      "Sarıkaya",
      "Sorgun",
      "Şefaatli",
      "Yenifakılı",
      "Yerköy"
    ]
  },
  {
    "il": "Zonguldak",
    "ilceler": [
      "Alaplı",
      "Çaycuma",
      "Devrek",
      "Ereğli",
      "Gökçebey",
      "Kilimli",
      "Kozlu",
      "Merkez"
    ]
  }
];

export const TURKEY_IL_NAMES = TURKEY_PROVINCES.map((p) => p.il);

export function getDistrictsForProvince(il: string): string[] {
  const found = TURKEY_PROVINCES.find((p) => p.il === il);
  return found?.ilceler ?? [];
}

/** Map free-text province to canonical registry label (Turkish case-fold). */
export function resolveCanonicalProvince(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  const needle = trimmed.toLocaleLowerCase("tr-TR");
  return (
    TURKEY_IL_NAMES.find(
      (name) => name.toLocaleLowerCase("tr-TR") === needle,
    ) ?? trimmed
  );
}

/** Map free-text district to canonical label for a province (Turkish case-fold). */
export function resolveCanonicalDistrict(
  il: string,
  value: string | null | undefined,
): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || !il) return "";
  const districts = getDistrictsForProvince(il);
  const needle = trimmed.toLocaleLowerCase("tr-TR");
  return (
    districts.find((name) => name.toLocaleLowerCase("tr-TR") === needle) ??
    trimmed
  );
}

export function formatRealEstateCity(il: string, ilce: string): string {
  return `${il} / ${ilce}`;
}

export function parseRealEstateCity(
  city?: string | null,
): { il: string; ilce: string } | null {
  if (!city?.trim()) return null;
  const parts = city.split(" / ").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const il = parts[0];
    const ilce = parts[parts.length - 1];
    if (getDistrictsForProvince(il).includes(ilce)) return { il, ilce };
  }
  const ilOnly = TURKEY_PROVINCES.find((p) => p.il === parts[0]);
  if (ilOnly) return { il: ilOnly.il, ilce: "" };
  for (const prov of TURKEY_PROVINCES) {
    const match = prov.ilceler.find(
      (d) =>
        d.toLocaleLowerCase("tr-TR") === parts[0].toLocaleLowerCase("tr-TR"),
    );
    if (match) return { il: prov.il, ilce: match };
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when `place` appears as its own token (not a substring of a longer
 * word). Allows common Turkish locative/possessive endings: "İstanbul'da",
 * "Of'ta". Prevents "Of" matching inside "ofis".
 */
/** Yer adına eklenebilen bulunma / ayrılma / yönelme ekleri. */
const PLACE_CASE_SUFFIX =
  "(?:['’]?(?:da|de|ta|te|dan|den|tan|ten|ya|ye|nun|nin|un|ün|in|ın))";

/**
 * Bir yer adının HEMEN yanında durunca o adı yer olarak niteleyen sözcükler.
 * Liste idari birim adlarıdır; belirli bir ilçeye ya da ile bağlı değildir.
 */
const PLACE_QUALIFIER_WORDS = [
  "il",
  "ili",
  "ilçe",
  "ilçesi",
  "ilçesinde",
  "ilçesinden",
  "mahalle",
  "mahallesi",
  "mahallesinde",
  "semt",
  "semti",
  "semtinde",
  "köy",
  "köyü",
  "köyünde",
  "belde",
  "beldesi",
  "bölge",
  "bölgesi",
  "bölgesinde",
  "civarı",
  "civarında",
  "yakınında",
] as const;

export function textMentionsPlace(text: string, place: string): boolean {
  return placeMentionEvidence(text, place).mentioned;
}

/* ═══════════════════════════════════════════════════════════════════════
   YAPISAL YER KANITI — ÜÇ BİÇİM, HİÇBİRİ SÖZCÜK LİSTESİ DEĞİL (2026-09-25).

   ÖLÇÜLEN KUSUR. "1000 adet kartvizit, mat selefonlu, Topkapı" cümlesinde
   konum metinde AÇIKÇA yazılıdır ama sistem konumu soruyordu (ölçüldü:
   `matcher=-  city=-`). İki ayrı eksik vardı: (1) çıplak ad yalnız hâl eki ya
   da komşu idari birim sözcüğüyle kanıt sayılıyordu, oysa Türkçede bir adın
   KENDİ BAŞINA BİR VİRGÜL BÖLÜMÜ olması da yer bildirir; (2) semt adları hiç
   bilinmiyordu (aşağıda, `findPlaceEvidenceInText`).

   NEDEN SÖZCÜK LİSTESİ DEĞİL. Mahalle adlarının çoğu gündelik Türkçe
   sözcüktür; ölçüldü: 54 sıradan ürün/nitelik sözcüğünün 11'i tek anlamlı bir
   mahalle adıdır (`kapı`, `uçak`, `parlak`, `ince`, `termal`, `iplik`,
   `mekan`, `oran`, `yurt`, `küp`, `tabur`). "Buzdolabı arıyorum, parlak"
   İzmir'e çözülemez ve "Ödeme kapıda olsun" Adana'ya. Kapı bu yüzden ADA
   değil, adın CÜMLEDEKİ BİÇİMİNE bakar:

     (a) kesme işaretli hâl eki — "Topkapı'da". Ek zaten dilbilgisel kanıttır;
         büyük harf şartı yok, küçük harfli yazım da geçer.
     (b) komşu idari birim sözcüğü — "Topkapı semtinde", "Araç ilçesinde".
     (c) kesmesiz hâl eki ya da kendi başına bir bölüm — bu iki biçimde ekin
         kendisi yeterli kanıt DEĞİLDİR, çünkü "kapıda" da bir ektir. Burada
         ÖZEL AD BİÇİMİ istenir: sözcük büyük harfle başlar, metnin İLK sözcüğü
         değildir (cümle başı büyük harfi özel ad bilgisi taşımaz) ve metin
         tamamı büyük harf değildir (öyleyse büyük harf hiçbir şey ayırt
         etmez). "Ödeme kapıda olsun" → küçük harf, düşer. "Kapıda ödeme
         istiyorum" → ilk sözcük, düşer.

   (c)'nin BEDELİ ÖLÇÜLDÜ VE KABUL EDİLDİ: tamamı büyük harfle yazılmış bir
   metinde çıplak bölüm biçimi kanıt üretmez, yani "…, TOPKAPI" konumu
   çözülmez. Alternatif, büyük harfli metinde "…, PARLAK"ı İzmir saymaktı.
   Sessiz yanlış konum, kaybedilen bir kolaylıktan pahalıdır.
   ═══════════════════════════════════════════════════════════════════════ */

/** Bölüm sınırları: virgül, noktalı virgül, satır sonu, dikey çizgi, tire. */
const SEGMENT_SPLIT = /[,;\n\r|]|\s+[-–—]\s+/u;

function textIsAllUpperCase(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (!letters) return false;
  return letters === letters.toLocaleUpperCase("tr-TR");
}

function firstWordOf(text: string): string {
  return text.trim().split(/[^\p{L}\p{N}]+/u)[0] ?? "";
}

function startsUpperCase(word: string): boolean {
  const first = word.trim().charAt(0);
  if (!first) return false;
  return (
    first === first.toLocaleUpperCase("tr-TR") &&
    first !== first.toLocaleLowerCase("tr-TR")
  );
}

/**
 * Metnin özel ad biçimini taşıyan bölümleri — (c) biçiminin girdisi.
 * İlk bölüm hariçtir: ilk bölüm talebin kendisini taşır ("Kapı arıyorum, …").
 */
export function properNounSegments(text: string): string[] {
  if (textIsAllUpperCase(text)) return [];
  const first = firstWordOf(text);
  const segments = text.split(SEGMENT_SPLIT);
  const out: string[] = [];
  segments.forEach((raw, position) => {
    if (position === 0) return;
    const value = raw.trim().replace(/[.!?]+$/u, "").trim();
    if (!value) return;
    const words = value.split(/\s+/u);
    if (words.length > 3) return;
    if (!words.every((w) => startsUpperCase(w))) return;
    if (words.length === 1 && foldPlaceLower(words[0]) === foldPlaceLower(first)) {
      return;
    }
    out.push(value);
  });
  return out;
}

function foldPlaceLower(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR");
}

/**
 * Metinde özel ad biçiminde ve hâl ekiyle geçen aday yer adları — (a) ve (c).
 * Ekin kendisi kırpılır; kalan gövde çağıranın indeksine sorulur.
 */
export function suffixedPlaceCandidates(text: string): string[] {
  const out: string[] = [];
  const allUpper = textIsAllUpperCase(text);
  const first = foldPlaceLower(firstWordOf(text));

  /* (a) kesme işaretli ek — büyük harf şartı yok. */
  const apostrophe = new RegExp(
    `(?<![\\p{L}\\p{N}])(\\p{L}[\\p{L}]*(?:\\s+\\p{L}[\\p{L}]*)?)['’](?:${"da|de|ta|te|dan|den|tan|ten|ya|ye|nun|nin|un|ün|in|ın"})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  for (const m of text.matchAll(apostrophe)) {
    /**
     * İKİ SÖZCÜKLÜ GÖVDE DE, SON SÖZCÜK DE ADAYDIR (ölçümle eklendi).
     * Öbek yakalayıcı açgözlüdür: "için Levent'te" cümlesinde gövde
     * "için Levent" olarak çıkıyor ve "Levent" hiç sorulmuyordu. İki sözcüklü
     * semt adları ("Çukurambar" gibi tek sözcüklüler kadar yaygın değil ama
     * var) kaybolmasın diye öbek korunur; son sözcük de eklenir.
     */
    out.push(m[1]);
    const words = m[1].trim().split(/\s+/u);
    if (words.length > 1) out.push(words[words.length - 1]);
  }

  /* (c) kesmesiz ek — özel ad biçimi şartı. */
  if (!allUpper) {
    const bare = new RegExp(
      `(?<![\\p{L}\\p{N}])(\\p{L}[\\p{L}]*)(?:${"da|de|ta|te|dan|den|tan|ten"})(?![\\p{L}\\p{N}])`,
      "gu",
    );
    for (const m of text.matchAll(bare)) {
      const stem = m[1];
      if (!startsUpperCase(stem)) continue;
      if (foldPlaceLower(m[0]) === first) continue;
      out.push(stem);
    }
  }
  return out;
}

/**
 * BİR YER ADININ METİNDE GEÇMESİ, KULLANICININ ORAYI KASTETTİĞİ ANLAMINA
 * GELMEZ (2026-08-26).
 *
 * Türkiye'de bazı ilçe adları gündelik Türkçe sözcüklerdir; Kastamonu'nun
 * **Araç** ilçesi en görünür örnektir. "Araç kiralamak istiyorum" cümlesinde
 * o sözcük bir yer değil, talebin konusudur. Eşleşmenin kendisi ile
 * eşleşmenin YER OLDUĞUNA dair kanıt ayrı şeylerdir; bu fonksiyon ikisini
 * ayrı döndürür ve kararı çağırana bırakır.
 *
 * `explicit` iki biçimden biriyle doğar ve ikisi de dilbilgiseldir, veriye
 * özel değildir:
 *   - ad bir hâl eki taşıyor ("Kadıköy'de", "İzmir'den"),
 *   - adın hemen yanında bir idari birim sözcüğü var ("Araç ilçesinde").
 */
export function placeMentionEvidence(
  text: string,
  place: string,
): { mentioned: boolean; explicit: boolean } {
  const needle = place.trim().toLocaleLowerCase("tr-TR");
  if (!needle) return { mentioned: false, explicit: false };
  const haystack = text.toLocaleLowerCase("tr-TR");
  const escaped = escapeRegExp(needle);

  const bare = new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}${PLACE_CASE_SUFFIX}?(?![\\p{L}\\p{N}])`,
    "iu",
  );
  if (!bare.test(haystack)) return { mentioned: false, explicit: false };

  const withSuffix = new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}${PLACE_CASE_SUFFIX}(?![\\p{L}\\p{N}])`,
    "iu",
  );
  const qualifier = PLACE_QUALIFIER_WORDS.map(escapeRegExp).join("|");
  const withQualifier = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:(?:${qualifier})\\s+${escaped}|${escaped}${PLACE_CASE_SUFFIX}?\\s+(?:${qualifier}))(?![\\p{L}\\p{N}])`,
    "iu",
  );

  /**
   * (c) BİÇİMİ — ad kendi başına bir bölüm ve özel ad biçiminde (2026-09-25).
   * "Buzdolabı arıyorum, Kadıköy" artık kanıttır; "…, parlak" değildir.
   * Gerekçe ve ölçüm yukarıdaki blokta.
   */
  const asSegment = properNounSegments(text).some(
    (segment) => foldPlaceLower(segment) === needle,
  );

  return {
    mentioned: true,
    explicit:
      withSuffix.test(haystack) || withQualifier.test(haystack) || asSegment,
  };
}

/**
 * SEMT ADI DA BİR CEVAPTIR (D-0030, 2026-09-25).
 *
 * `findDistrictEvidenceInText` yalnız 81 il ve 973 ilçeyi tanır. Kullanıcı
 * konumu çoğu zaman semt adıyla yazar ("…, Topkapı") ve o cümlede konum
 * sorulmaması gerekir. Semt adları KÜRASYONLU bir listeden okunur ve neden
 * kanonik mahalle kütüğünden türetilemediği ölçümüyle `well-known-semt.ts`
 * başında yazılıdır (kütük kuralı 15 tanınan semtte 3 doğru, 2 SESSİZCE
 * YANLIŞ İL veriyordu). Kanıt biçimi kapısı ilçe adlarıyla BİREBİR AYNIDIR —
 * yeni bir ölçüt icat edilmedi.
 *
 * İDARİ BİRİM YETKİSİ ÖNCE GELİR. Bir ad hem ilçe hem semt olabilir; o durumda
 * kararı ilçe yetkilisi verir ve kürasyonlu liste hiç sorulmaz (satır zaten
 * yüklenirken reddedilir). Semt yalnız ilçe BOŞ kaldığında doldurur: il zaten
 * bulunmuşsa (örn. "İstanbul, Topkapı") semt o ilin içindeyse ilçeyi
 * tamamlar, değilse yok sayılır — kullanıcının yazdığı il asla ezilmez.
 */
export function findPlaceEvidenceInText(
  text: string,
): { il: string; ilce: string; mahalle: string } | null {
  const district = findDistrictEvidenceInText(text);
  if (district?.ilce) return { ...district, mahalle: "" };

  const qualifier = PLACE_QUALIFIER_WORDS.map(escapeRegExp).join("|");
  /* (b) biçimi: "Topkapı semtinde" — komşu idari birim sözcüğü. */
  const qualifierForm = new RegExp(
    `(?<![\\p{L}\\p{N}])(\\p{L}[\\p{L}]*(?:\\s+\\p{L}[\\p{L}]*)?)\\s+(?:${qualifier})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  const candidates = [
    ...suffixedPlaceCandidates(text),
    ...properNounSegments(text),
    ...[...text.matchAll(qualifierForm)].map((m) => m[1]),
  ];

  for (const raw of candidates) {
    const semt = resolveWellKnownSemt(raw);
    if (!semt) continue;
    if (district?.il && semt.il !== district.il) continue;
    return { il: semt.il, ilce: semt.ilce, mahalle: semt.semt };
  }

  return district ? { ...district, mahalle: "" } : null;
}

/**
 * TEK YETKİLİ KONUM OKUYUCUSU (2026-09-25).
 *
 * Depoda sekiz tüketici bu fonksiyonu çağırıyor (beyin, besteci, kategori
 * motoru, emlak konumu, sunucu şeması…). Semt çözümünü yalnız beyne vermek
 * "aynı metni iki tüketici farklı okuyor" sınıfını geri getirirdi: arayüz
 * konumu sormaya devam ederken sunucu doldurur. Bu yüzden semt kanıtı
 * fonksiyonun KENDİSİNE eklendi; ilçe çözümü `findDistrictEvidenceInText`
 * olarak ayrıldı ve idari birim yetkisi hâlâ önce okunuyor.
 */
export function findProvinceAndDistrictInText(
  text: string,
): { il: string; ilce: string } | null {
  const place = findPlaceEvidenceInText(text);
  return place ? { il: place.il, ilce: place.ilce } : null;
}

/** İl ve ilçe adları — kanonik idari birim yetkisi, semt bilmez. */
function findDistrictEvidenceInText(
  text: string,
): { il: string; ilce: string } | null {
  type Hit = { il: string; ilce: string; score: number };
  const hits: Hit[] = [];

  for (const prov of TURKEY_PROVINCES) {
    const ilMentioned = textMentionsPlace(text, prov.il);
    for (const ilce of prov.ilceler) {
      const evidence = placeMentionEvidence(text, ilce);
      if (!evidence.mentioned) continue;
      /**
       * ÇIPLAK İLÇE ADI KANIT DEĞİLDİR (2026-08-26).
       *
       * İl adı geçmiyorsa, ilçe adının yer olarak kullanıldığına dair açık
       * bir işaret aranır: hâl eki ya da komşu idari birim sözcüğü. Aksi
       * hâlde gündelik bir Türkçe sözcük ("araç") kullanıcının hiç yazmadığı
       * bir konuma dönüşür ve talep yanlış şehre yayınlanır.
       */
      if (!ilMentioned && !evidence.explicit) continue;
      hits.push({
        il: prov.il,
        ilce,
        // Longer district names win; bonus if province also appears.
        score: ilce.length * 10 + (ilMentioned ? 5 : 0),
      });
    }
    if (ilMentioned) {
      hits.push({ il: prov.il, ilce: "", score: prov.il.length });
    }
  }

  if (!hits.length) return null;
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      b.ilce.length - a.ilce.length ||
      b.il.length - a.il.length,
  );
  return { il: hits[0].il, ilce: hits[0].ilce };
}

export function isValidRealEstateLocation(il: string, ilce: string): boolean {
  if (!il?.trim() || !ilce?.trim()) return false;
  return getDistrictsForProvince(il).includes(ilce);
}
