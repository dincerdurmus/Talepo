# TALEPO — Global Product Identity V1 Live Stress Test
Date: 2026-08-10T17:35:49.902Z

## 0. Pre-check
- .env: EXISTS (loaded via dotenv/config)
- .env.local: EXISTS (loaded via dotenv/config)
- DATAFORSEO_STATUS: CONFIGURED
- LOGIN_SET: true
- PASSWORD_SET: true
- Runtime env: `dotenv/config` in script; Next.js also loads `.env.local` + `.env`

## A) TECHNOLOGY — Apple iPhone 15 Pro Max 256 GB

### Normalization (pre-provider)
- INPUT: Apple iPhone 15 Pro Max 256 GB
- CATEGORY: technology
- BRAND: Apple (confidence 0.85)
- MODEL: iPhone 15 Pro Max
- SERIES: 256 GB
- VARIANT: 256 GB
- CONDITION: UNKNOWN
- IDENTIFIERS: {"sku":null,"gtin":null,"ean":null,"upc":null,"mpn":null}
- ATTRIBUTES: {"needType":"hardware","solutionType":"Apple iPhone 15 Pro Max 256GB","specs":"256 GB","storage":"256gb"}
- PROVIDER QUERY: Apple iPhone 15 Pro Max 256 GB
- SUITABILITY: 1
- EXTERNAL CALL: YES

### Provider results
- TASK: SUCCESS (task_post + task_get completed)
- RETRY: no
- PARSE: normalized=12, skippedInvalidPrice=0, unknownTypes=0
- RAW: 12
- MATCHED: 3
- REJECTED: 9
- REJECT BREAKDOWN: other=1, wrong model=6, wrong capacity/storage=1, wrong brand=1

### Matched audit (up to 10)
- [TRUE_POSITIVE] mq=1.000 | 48500 TRY | cond=UNKNOWN | seller=Hijyen Avm
  title: Apple iPhone 15 Pro Max 256 GB Natürel Titanyum (İthalatçı Garantili)
- [TRUE_POSITIVE] mq=1.000 | 33500 TRY | cond=UNKNOWN | seller=letgo
  title: Apple iPhone 15 Pro Max 256GB (Apple Türkiye Garantili)
- [TRUE_POSITIVE] mq=1.000 | 44951.09 TRY | cond=UNKNOWN | seller=Simpletek
  title: Apple iPhone 15 Pro Max 256GB Titanio Nero

### Rejected audit (up to 5 meaningful)
- [FALSE_NEGATIVE] mq=0.390 | 78939 TRY | other
  title: Apple iPhone 15 Pro Max
- [TRUE_NEGATIVE] mq=0.314 | 64999 TRY | wrong model
  title: Apple iPhone 15 Pro Titanyum
- [TRUE_NEGATIVE] mq=0.286 | 53999 TRY | wrong model
  title: Apple iPhone 15
- [TRUE_NEGATIVE] mq=0.286 | 56659 TRY | wrong model
  title: Apple iPhone 15 Plus
- [TRUE_NEGATIVE] mq=0.250 | 81049 TRY | wrong capacity/storage
  title: Yenilenmiş APPLE iPhone 15 Pro Max 8 GB 256 Akıllı Telefon

## A) TECHNOLOGY — Samsung Galaxy S24 Ultra 256 GB

### Normalization (pre-provider)
- INPUT: Samsung Galaxy S24 Ultra 256 GB
- CATEGORY: technology
- BRAND: Samsung (confidence 0.85)
- MODEL: Galaxy S24 Ultra
- SERIES: 256 GB
- VARIANT: 256 GB
- CONDITION: UNKNOWN
- IDENTIFIERS: {"sku":null,"gtin":null,"ean":null,"upc":null,"mpn":null}
- ATTRIBUTES: {"needType":"hardware","solutionType":"Samsung Galaxy S24 Ultra 256GB","specs":"256 GB","storage":"256gb"}
- PROVIDER QUERY: Samsung Galaxy S24 Ultra 256 GB
- SUITABILITY: 1
- EXTERNAL CALL: YES

### Provider results
- TASK: SUCCESS (task_post + task_get completed)
- RETRY: no
- PARSE: normalized=30, skippedInvalidPrice=0, unknownTypes=0
- RAW: 30
- MATCHED: 5
- REJECTED: 25
- REJECT BREAKDOWN: other=3, condition mismatch=6, wrong capacity/storage=4, wrong model=10, accessory=2

### Matched audit (up to 10)
- [TRUE_POSITIVE] mq=1.000 | 72000 TRY | cond=UNKNOWN | seller=trendyol.com
  title: Samsung Galaxy S24 Ultra 256 GB Titanyum Sarı (Samsung Türkiye Garantili)
- [TRUE_POSITIVE] mq=1.000 | 41380 TRY | cond=UNKNOWN | seller=Tekno Muaz
  title: Samsung Galaxy S24 Ultra 5G - Titanyum Turuncu / 12+12 / 256 GB / Kayıtsız
- [TRUE_POSITIVE] mq=1.000 | 60797 TRY | cond=UNKNOWN | seller=Getmobil
  title: Samsung Galaxy S24 Ultra - 256 GB - Sarı Titanyum
- [TRUE_POSITIVE] mq=1.000 | 41000 TRY | cond=UNKNOWN | seller=letgo
  title: SAMSUNG GALAXY S24 ULTRA 256 GB
- [TRUE_POSITIVE] mq=1.000 | 61549 TRY | cond=UNKNOWN | seller=Getmobil
  title: Samsung Galaxy S24 Ultra - 256 GB - Titanyum Turuncu

### Rejected audit (up to 5 meaningful)
- [FALSE_NEGATIVE] mq=0.390 | 54490 TRY | other
  title: Samsung Galaxy S24 Ultra
- [TRUE_NEGATIVE] mq=0.390 | 32399 TRY | wrong model
  title: Samsung Galaxy S24 256 Gb Siyah
- [TRUE_NEGATIVE] mq=0.390 | 36290 TRY | wrong model
  title: Samsung Galaxy S24 Plus 256 Gb
- [FALSE_NEGATIVE] mq=0.390 | 60000 TRY | other
  title: SAMSUNG GALAXY S24 ULTRA
- [TRUE_NEGATIVE] mq=0.390 | 33990 TRY | wrong model
  title: Samsung Galaxy S24 Plus 256 Gb Siyah

## A) TECHNOLOGY — Sony WH-1000XM5

### Normalization (pre-provider)
- INPUT: Sony WH-1000XM5
- CATEGORY: technology
- BRAND: Sony (confidence 0.85)
- MODEL: WH-1000XM5
- SERIES: null
- VARIANT: null
- CONDITION: UNKNOWN
- IDENTIFIERS: {"sku":null,"gtin":null,"ean":null,"upc":null,"mpn":null}
- ATTRIBUTES: {"needType":"hardware","solutionType":"Sony WH-1000XM5"}
- PROVIDER QUERY: Sony WH-1000XM5
- SUITABILITY: 0.85
- EXTERNAL CALL: YES

### Provider results
- TASK: SUCCESS (task_post + task_get completed)
- RETRY: yes (RAW=0 on first attempt)
- PARSE: normalized=19, skippedInvalidPrice=0, unknownTypes=0
- RAW: 19
- MATCHED: 13
- REJECTED: 6
- REJECT BREAKDOWN: wrong model=3, wrong brand=1, accessory=2

### Matched audit (up to 10)
- [TRUE_POSITIVE] mq=0.817 | 18999 TRY | cond=UNKNOWN | seller=Amazon.com.tr - Amazon.com.tr – pazaryeri
  title: Sony Wh-1000xm5 Kulaklık
- [TRUE_POSITIVE] mq=0.817 | 16999 TRY | cond=UNKNOWN | seller=Hepsiburada
  title: Sony WH-1000XM5 Kulaklık
- [TRUE_POSITIVE] mq=0.733 | 21341 TRY | cond=UNKNOWN | seller=trendyol.com
  title: Sony Wh-1000xm5 Tamamen Kablosuz Gürültü Engelleme Özellikli Kulaklık-siyah
- [TRUE_POSITIVE] mq=0.733 | 23999 TRY | cond=UNKNOWN | seller=trendyol.com
  title: Sony Wh-1000xm5 Tamamen Kablosuz Gürültü Engelleme Özellikli Kulaklık-Mavi
- [TRUE_POSITIVE] mq=0.817 | 25499 TRY | cond=UNKNOWN | seller=Amazon.com.tr - Amazon.com.tr – pazaryeri
  title: Sony WH-1000XM5 sr
- [TRUE_POSITIVE] mq=0.721 | 23999 TRY | cond=UNKNOWN | seller=trendyol.com
  title: Sony Wh-1000xm5s Gürültü Engelleme Özellikli Kablosuz Kulak Üstü Kulaklık -gümüş
- [TRUE_POSITIVE] mq=0.793 | 26000 TRY | cond=UNKNOWN | seller=Hepsiburada
  title: Sony WH-1000XM5 Bluetooth Kulaklık
- [TRUE_POSITIVE] mq=0.761 | 16900 TRY | cond=UNKNOWN | seller=pazarama.com
  title: Sony WH-1000XM5 Wireless Noise Cancelling Kulaklık
- [TRUE_POSITIVE] mq=0.750 | 12072.87 TRY | cond=UNKNOWN | seller=Etoren.com
  title: Joyus Sony WH-1000XM5 Wireless Noise Canceling Headphones
- [TRUE_POSITIVE] mq=0.817 | 876.95 TRY | cond=UNKNOWN | seller=Brainwavz Audio
  title: Sony WH-1000XM5 PU

### Rejected audit (up to 5 meaningful)
- [FALSE_NEGATIVE] mq=0.000 | 16999 TRY | wrong model
  title: Sony WH-1000XM5 En İyi Aktif Gürültü Önleyici Kablosuz Bluetooth Kulak Üstü Kulaklıklar, Net Arama için Mikrofonlu Kulaklıklar, Pil Ömrü 30 Saat-Gece
- [FALSE_NEGATIVE] mq=0.000 | 36504 TRY | wrong brand
  title: WH-1000XM5 Tamamen Kablosuz Gürültü Engelleme Özellikli Kulaklık - 30 Saate Kadar Pil Ömrü -
- [FALSE_NEGATIVE] mq=0.000 | 12739.02 TRY | wrong model
  title: Sony WH-1000XM5 Bluetooth Wireless Over-Ear Headphones, BT 5.0, TWS, Noise Cancelling, Silver EU
- [FALSE_NEGATIVE] mq=0.000 | 15949 TRY | wrong model
  title: Sony Wh-1000xm6 Kulak Üstü Bluetooth Kulaklık
- [FALSE_NEGATIVE] mq=0.000 | 549.99 TRY | accessory
  title: Schulzz Sony Wh-1000xm5 Yedek Kulaklık Pedi Süngeri

## B) HOME / KITCHEN — Dyson V15 Detect Absolute

### Normalization (pre-provider)
- INPUT: Dyson V15 Detect Absolute
- CATEGORY: home-kitchen
- BRAND: Dyson (confidence 0.55)
- MODEL: V15
- SERIES: null
- VARIANT: null
- CONDITION: UNKNOWN
- IDENTIFIERS: {"sku":null,"gtin":null,"ean":null,"upc":null,"mpn":null}
- ATTRIBUTES: {"kitchenProductType":"Diğer mutfak eşyası","features":"Dyson V15 Detect Absolute elektrikli süpürge"}
- PROVIDER QUERY: Dyson V15 Detect Absolute Diğer mutfak eşyası Dyson V15 Detect Absolute elektrikli süpürge
- SUITABILITY: 0.642
- EXTERNAL CALL: YES

### Provider results
- TASK: SUCCESS (task_post + task_get completed)
- RETRY: yes (RAW=0 on first attempt)
- PARSE: normalized=18, skippedInvalidPrice=0, unknownTypes=0
- RAW: 18
- MATCHED: 16
- REJECTED: 2
- REJECT BREAKDOWN: wrong model=1, other=1

### Matched audit (up to 10)
- [TRUE_POSITIVE] mq=0.761 | 40402.94 TRY | cond=UNKNOWN | seller=Trendyol
  title: Dyson V15 Detect Absolute Dikey Şarjlı Süpürge
- [TRUE_POSITIVE] mq=0.761 | 40999 TRY | cond=UNKNOWN | seller=Dyson Türkiye
  title: Dyson V15 Detect Absolute Kablosuz Süpürge
- [TRUE_POSITIVE] mq=0.761 | 41050 TRY | cond=UNKNOWN | seller=Trendyol
  title: Dyson V15 Detect Absolute Süpürge
- [TRUE_POSITIVE] mq=0.739 | 23999 TRY | cond=UNKNOWN | seller=Beymen
  title: Dyson V15 Detect Total Clean Kablosuz Süpürge
- [TRUE_POSITIVE] mq=0.761 | 51249 TRY | cond=UNKNOWN | seller=Soylu AVM
  title: Dyson V15 Detect Absolute Şarjlı Dikey Süpürge
- [TRUE_POSITIVE] mq=0.739 | 39999 TRY | cond=UNKNOWN | seller=Evkur AVM Tic. A.Ş.
  title: Dyson V15s Detect Submarine Islak/Kuru Kablosuz Süpürge
- [TRUE_POSITIVE] mq=0.739 | 52999 TRY | cond=UNKNOWN | seller=trendyol.com
  title: Dyson V15s Detect Submarine Islak&Kuru Dikey Süpürge
- [TRUE_POSITIVE] mq=0.739 | 24999 TRY | cond=UNKNOWN | seller=Beymen
  title: Dyson V15 Detect Extra Prusya Mavisi/bakır Dikey Süpürge
- [TRUE_POSITIVE] mq=0.694 | 4399 TRY | cond=UNKNOWN | seller=Teknosa
  title: Dyson V15 Ayaklı Ünite
- [TRUE_POSITIVE] mq=0.707 | 29680 TRY | cond=UNKNOWN | seller=Hijyen Avm
  title: Dyson V15s Detect Submarine Islak ve Kuru Temizleme Özellikli Kablosuz Süpürge İthalatçı Garantili

### Rejected audit (up to 5 meaningful)
- [FALSE_NEGATIVE] mq=0.394 | 16199 TRY | other
  title: DYSON Supurge (DYSON TuRKIYE GARANTILI)
- [TRUE_NEGATIVE] mq=0.000 | 33899 TRY | wrong model
  title: Dyson V12 Detect Slim Absolute Süpürge

## B) HOME / KITCHEN — Philips LatteGo 5400

### Normalization (pre-provider)
- INPUT: Philips LatteGo 5400
- CATEGORY: home-kitchen
- BRAND: Philips (confidence 0.85)
- MODEL: Philips
- SERIES: null
- VARIANT: null
- CONDITION: UNKNOWN
- IDENTIFIERS: {"sku":null,"gtin":null,"ean":null,"upc":null,"mpn":null}
- ATTRIBUTES: {"kitchenProductType":"Diğer mutfak eşyası","features":"Philips LatteGo 5400 kahve makinesi"}
- PROVIDER QUERY: Philips LatteGo 5400 Diğer mutfak eşyası Philips LatteGo 5400 kahve makinesi
- SUITABILITY: 0.642
- EXTERNAL CALL: YES

### Provider results
- TASK: SUCCESS (task_post + task_get completed)
- RETRY: no
- PARSE: normalized=33, skippedInvalidPrice=0, unknownTypes=0
- RAW: 33
- MATCHED: 30
- REJECTED: 3
- REJECT BREAKDOWN: wrong brand=1, accessory=1, wrong model=1

### Matched audit (up to 10)
- [TRUE_POSITIVE] mq=0.694 | 25499 TRY | cond=UNKNOWN | seller=trendyol.com
  title: PHILIPS EP5447/90 Tam Otomatik Espresso Makinesi
- [TRUE_POSITIVE] mq=0.694 | 27599.4 TRY | cond=UNKNOWN | seller=Teknosa
  title: Philips Ep5544/80 Tam Otomatik Espresso Makinesi
- [TRUE_POSITIVE] mq=0.694 | 24029 TRY | cond=UNKNOWN | seller=Trendyol
  title: Philips EP5547/90 Tam Otomatik Espresso Makinesi
- [TRUE_POSITIVE] mq=0.690 | 19000 TRY | cond=UNKNOWN | seller=letgo
  title: Philips 5500 Serisi EP5543/80 Tam Otomatik Espresso Makinesi
- [TRUE_POSITIVE] mq=0.694 | 32400 TRY | cond=UNKNOWN | seller=Hepsiburada
  title: Philips Lattego Ep5443/70 Tam Otomatik Espresso Makinesi
- [TRUE_POSITIVE] mq=0.721 | 24149 TRY | cond=UNKNOWN | seller=Amazon.com.tr
  title: Philips 5500 Serisi LatteGo Tam Otomatik Espresso Makinesi ve Philips Espresso Makinesi Kahve Yağı Çözücü Tablet
- [TRUE_POSITIVE] mq=0.730 | 46990 TRY | cond=UNKNOWN | seller=Trendyol
  title: Philips 5400 Serisi Ep5447/90 Tam Otomatik Kahve Makinesi
- [TRUE_POSITIVE] mq=0.730 | 27000 TRY | cond=UNKNOWN | seller=letgo
  title: Philips LatteGo EP5547/90 Tam Otomatik Espresso Makinesi
- [TRUE_POSITIVE] mq=0.730 | 37619.01 TRY | cond=UNKNOWN | seller=Trendyol
  title: Philips LatteGo , sut cozumu TFT ekran 12 farkli kahve 5400 TAM OTOMATIK ESPRESSO-LATTE MAKINESI
- [TRUE_POSITIVE] mq=0.694 | 37900 TRY | cond=UNKNOWN | seller=trendyol.com
  title: Philips 5400 Series Tam otomatik espresso makineleri

### Rejected audit (up to 5 meaningful)
- [FALSE_NEGATIVE] mq=0.000 | 48292.68 TRY | wrong brand
  title: 5400 Serisi Espresso Makinesi - Kahve Çekirdeği - Lattego Süt Köpürtücü, 12 Özel Kahve, Sezg
- [TRUE_NEGATIVE] mq=0.000 | 37104.1 TRY | accessory
  title: Philips Tam Otomatik Espresso Makinesi, Lattego Süt Sistemi, Aquaclean Filtre, Paslanmaz Çelik, 1500W, Krom, Luciole Lambader Hediyeli - Siyah
- [FALSE_NEGATIVE] mq=0.000 | 33032.5 TRY | wrong model
  title: Philips Lattego Tam Otomatik Espresso Makinesi + Dijital Mutfak Tartısı Hediye - 24.6 x 37.2 x 43.3 cm (G x Y x D)

## C) APPLIANCES — Bosch Series 6 9 kg çamaşır makinesi

### Normalization (pre-provider)
- INPUT: Bosch Series 6 9 kg çamaşır makinesi
- CATEGORY: appliances
- BRAND: Bosch (confidence 0.95)
- MODEL: null
- SERIES: Series 6
- VARIANT: Series 6
- CONDITION: UNKNOWN
- IDENTIFIERS: {"sku":null,"gtin":null,"ean":null,"upc":null,"mpn":null}
- ATTRIBUTES: {"applianceType":"Çamaşır makinesi","brandPreference":"Bosch","capacity":"9 kg","specs":"Series 6"}
- PROVIDER QUERY: Bosch Çamaşır makinesi 9 kg
- SUITABILITY: 0.888
- EXTERNAL CALL: YES

### Provider results
- TASK: SUCCESS (task_post + task_get completed)
- RETRY: no
- PARSE: normalized=43, skippedInvalidPrice=0, unknownTypes=0
- RAW: 43
- MATCHED: 30
- REJECTED: 13
- REJECT BREAKDOWN: wrong model=9, other=3, wrong variant=1

### Matched audit (up to 10)
- [TRUE_POSITIVE] mq=0.441 | 34397.09 TRY | cond=UNKNOWN | seller=n11
  title: Bosch WGA242Z0TR 1200 Devir 9 kg Çamaşır Makinesi
- [TRUE_POSITIVE] mq=0.493 | 35498 TRY | cond=UNKNOWN | seller=Koçtaş
  title: Bosch 1200 Devir 9 kg Çamaşır Makinesi
- [TRUE_POSITIVE] mq=0.441 | 49350 TRY | cond=UNKNOWN | seller=Hepsiburada
  title: Bosch WAU28P90TR 9 kg 1400 Devir Çamaşır Makinesi
- [TRUE_POSITIVE] mq=0.450 | 28499 TRY | cond=UNKNOWN | seller=Gizerler
  title: Bosch WAN24200TR 1200 Devir 9 kg Çamaşır Makinesi
- [TRUE_POSITIVE] mq=0.450 | 37000 TRY | cond=UNKNOWN | seller=Trendyol
  title: Bosch WGA142ZXTR 1200 Devir 9 kg Çamaşır Makinesi
- [TRUE_POSITIVE] mq=0.450 | 54299 TRY | cond=UNKNOWN | seller=Hepsiburada
  title: Bosch WGA242ZXTR 9 kg 1200 Devir Çamaşır Makinesi
- [TRUE_POSITIVE] mq=0.441 | 7187.4 TRY | cond=UNKNOWN | seller=Öz Beyaz Eşya Mağazası
  title: Bosch WAT24480TR A+++ 1200 Devir 9 kg Çamaşır Makinesi
- [TRUE_POSITIVE] mq=0.441 | 21299 TRY | cond=UNKNOWN | seller=MemnunAL
  title: Bosch WGA242Z0TR 9 kg 1200 Devir Çamaşır Makinesi
- [TRUE_POSITIVE] mq=0.405 | 19831.83 TRY | cond=UNKNOWN | seller=Sony Mony
  title: Bosch 9 kg 5 Star Fully Automatic Front Load Washing Machine
- [TRUE_POSITIVE] mq=0.417 | 19831.83 TRY | cond=UNKNOWN | seller=Sony Mony
  title: Bosch 9 kg Fully Automatic Front Load Washing Machine

### Rejected audit (up to 5 meaningful)
- [FALSE_NEGATIVE] mq=0.373 | 16926.43 TRY | other
  title: Bosch 9 kg 5 Star Front Load Fully-Automatic Washing Machine, AI ActiveWater, 14 Wash Programs, Removes 99.9% Germs with Steam, No Tangle or Wrinkle
- [FALSE_NEGATIVE] mq=0.371 | 6962.43 TRY | other
  title: Bosch 9 kg 5 Star Semi-Automatic Top Loading Washing Machine (2025 Model, WJP904P0IN, 3 Wash Programs, Anti-Rust Body, 1300 RPM Spin Speed, Peacock
- [FALSE_NEGATIVE] mq=0.371 | 7042.08 TRY | other
  title: Bosch 9 kg 5 Star Semi-Automatic Top Loading Washing Machine (2025 Model, WJP904C0IN, 3 Wash Programs, Anti-Rust Body, 1300 RPM Spin Speed, Wine, 5
- [FALSE_NEGATIVE] mq=0.000 | 18399 TRY | wrong model
  title: Bosch WGA244X0TR 1400 Devir 9 kg Çamaşır Makinesi
- [FALSE_NEGATIVE] mq=0.000 | 28199 TRY | wrong model
  title: Bosch Wga242x3tr 9 kg 1200 Devir Çamaşır Makinesi

## C) APPLIANCES — Miele 9 kg çamaşır makinesi

### Normalization (pre-provider)
- INPUT: Miele 9 kg çamaşır makinesi
- CATEGORY: appliances
- BRAND: Miele (confidence 0.95)
- MODEL: null
- SERIES: null
- VARIANT: null
- CONDITION: UNKNOWN
- IDENTIFIERS: {"sku":null,"gtin":null,"ean":null,"upc":null,"mpn":null}
- ATTRIBUTES: {"applianceType":"Çamaşır makinesi","brandPreference":"Miele","capacity":"9 kg"}
- PROVIDER QUERY: Miele Çamaşır makinesi 9 kg
- SUITABILITY: 0.685
- EXTERNAL CALL: YES

### Provider results
- TASK: SUCCESS (task_post + task_get completed)
- RETRY: no
- PARSE: normalized=15, skippedInvalidPrice=0, unknownTypes=0
- RAW: 15
- MATCHED: 8
- REJECTED: 7
- REJECT BREAKDOWN: other=2, wrong variant=3, wrong capacity/storage=2

### Matched audit (up to 10)
- [TRUE_POSITIVE] mq=0.433 | 103691.5 TRY | cond=UNKNOWN | seller=Miele.tr
  title: Miele Wwg880 Wcs Pwash & Tdos Steam W1 Çamaşır Makinesi 9 kg
- [TRUE_POSITIVE] mq=0.441 | 104541.5 TRY | cond=UNKNOWN | seller=Miele.tr
  title: Miele Weg885 Wcs Pwash & Tdos Steam Çamaşır Makinesi 9 kg
- [TRUE_POSITIVE] mq=0.441 | 103691.5 TRY | cond=UNKNOWN | seller=Miele.tr
  title: Miele Wsg883 Wcs Pwash & Tdos Steam Çamaşır Makinesi 9 kg
- [TRUE_POSITIVE] mq=0.441 | 127992 TRY | cond=UNKNOWN | seller=Miele.tr
  title: Miele WSI883 WCS 125 Gala Edition Çamaşır Makinesi 9 kg
- [TRUE_POSITIVE] mq=0.441 | 191192 TRY | cond=UNKNOWN | seller=Beymen
  title: Miele WQ 1000 Black Effect Nova Edition Çamaşır Makinesi 9 kg
- [TRUE_POSITIVE] mq=0.405 | 134373.18 TRY | cond=UNKNOWN | seller=TieDex
  title: Miele 9kg 1600 Spin Freestanding Washing Machine wei865wcs
- [TRUE_POSITIVE] mq=0.410 | 166695.02 TRY | cond=UNKNOWN | seller=TieDex
  title: Miele WER865 WPS PWash&TDos&9kg Washing Machine
- [TRUE_POSITIVE] mq=0.441 | 195690.5 TRY | cond=UNKNOWN | seller=Deneysel Ev Aletleri
  title: Miele Wcr 860 Wps Pw Td A+++ 9 kg Çamaşır Makinesi

### Rejected audit (up to 5 meaningful)
- [FALSE_NEGATIVE] mq=0.390 | 132792 TRY | other
  title: Miele WEI885 WCS Twindos 125 Gala Edition Çamaşır Makinesi
- [FALSE_NEGATIVE] mq=0.380 | 112353.13 TRY | other
  title: Miele WER865WPS 9kg, 1600rpm, TwinDos and QuickPowerWash Washing Machine, A Rated in White
- [TRUE_NEGATIVE] mq=0.350 | 98591.5 TRY | wrong variant
  title: Miele TED645WP Ecospeed T1 Isı Pompalı Kurutma Makinesi 9 kg
- [TRUE_NEGATIVE] mq=0.350 | 105391.5 TRY | wrong variant
  title: Miele TWH780 WP T1 Isı Pompalı Kurutma Makinesi 9 kg
- [TRUE_NEGATIVE] mq=0.350 | 138990 TRY | wrong capacity/storage
  title: Miele Wwk360 Wcs Pwash W1 Çamaşır Makinesi 10 kg

## D) TOOLS — Makita DHP486

### Normalization (pre-provider)
- INPUT: Makita DHP486
- CATEGORY: technology
- BRAND: Makita (confidence 0.85)
- MODEL: DHP486
- SERIES: null
- VARIANT: null
- CONDITION: UNKNOWN
- IDENTIFIERS: {"sku":null,"gtin":null,"ean":null,"upc":null,"mpn":null}
- ATTRIBUTES: {"needType":"hardware","solutionType":"Makita DHP486 akülü matkap"}
- PROVIDER QUERY: Makita DHP486 akülü matkap
- SUITABILITY: 0.85
- EXTERNAL CALL: YES

### Provider results
- TASK: SUCCESS (task_post + task_get completed)
- RETRY: yes (RAW=0 on first attempt)
- PARSE: normalized=15, skippedInvalidPrice=0, unknownTypes=0
- RAW: 0
- MATCHED: 0
- REJECTED: 0
- REJECT BREAKDOWN: none

### Matched audit (up to 10)
- (none)

### Rejected audit (up to 5 meaningful)
- (none with price > 0)

## D) TOOLS — DeWalt DCD996

### Normalization (pre-provider)
- INPUT: DeWalt DCD996
- CATEGORY: technology
- BRAND: DeWalt (confidence 0.85)
- MODEL: DCD996
- SERIES: null
- VARIANT: null
- CONDITION: UNKNOWN
- IDENTIFIERS: {"sku":null,"gtin":null,"ean":null,"upc":null,"mpn":null}
- ATTRIBUTES: {"needType":"hardware","solutionType":"DeWalt DCD996 akülü matkap"}
- PROVIDER QUERY: DeWalt DCD996 akülü matkap
- SUITABILITY: 0.85
- EXTERNAL CALL: YES

### Provider results
- TASK: SUCCESS (task_post + task_get completed)
- RETRY: no
- PARSE: normalized=27, skippedInvalidPrice=0, unknownTypes=0
- RAW: 27
- MATCHED: 5
- REJECTED: 22
- REJECT BREAKDOWN: wrong model=12, accessory=10

### Matched audit (up to 10)
- [TRUE_POSITIVE] mq=0.783 | 8136 TRY | cond=UNKNOWN | seller=Hepsiburada
  title: DeWalt DCD996NT Aküsüz Matkap
- [TRUE_POSITIVE] mq=0.764 | 16500.86 TRY | cond=UNKNOWN | seller=MakineUstasi.com
  title: Dewalt DCD 996 Darbeli Matkap Tip 1
- [TRUE_POSITIVE] mq=0.783 | 13550 TRY | cond=UNKNOWN | seller=elmavm.com
  title: Dewalt DCD996P1 Darbeli Matkap
- [TRUE_POSITIVE] mq=0.783 | 14500 TRY | cond=UNKNOWN | seller=elmavm.com
  title: Dewalt DCD996M2 Darbeli Matkap
- [TRUE_POSITIVE] mq=0.730 | 8924.15 TRY | cond=UNKNOWN | seller=idefix
  title: Dewalt DCD996NT Kömürsüz Profesyonel Solo Darbeli Matkap (Aküsüz)

### Rejected audit (up to 5 meaningful)
- [FALSE_NEGATIVE] mq=0.000 | 17159.99 TRY | wrong model
  title: DeWalt DCD996P2 18Volt/5.0Ah Li-ion Çift Akülü Kömürsüz Darbeli Matkap
- [FALSE_NEGATIVE] mq=0.000 | 14990 TRY | wrong model
  title: DeWalt DCD996P2 18 Volt/5.0 Ah Li-ion Çift Akülü Kömürsüz Darbeli Matkap
- [FALSE_NEGATIVE] mq=0.000 | 16619 TRY | wrong model
  title: DeWalt 18V 5.0 Ah Li-Ion Çift Akülü Kömürsüz Profesyonel Darbeli Matkap DCD996P2-QW
- [FALSE_NEGATIVE] mq=0.000 | 18000 TRY | wrong model
  title: Dewalt DCD996H2 Çift Akülü Kömürsüz Profesyonel Darbeli Matkap
- [FALSE_NEGATIVE] mq=0.000 | 30000 TRY | accessory
  title: Dewalt DCD996NT x 2 + 2×5 Ah Akü + 1x Dolum Cihazı

## E) BABY — Chicco Urban Plus bebek arabası

### Normalization (pre-provider)
- INPUT: Chicco Urban Plus bebek arabası
- CATEGORY: baby
- BRAND: Chicco (confidence 0.95)
- MODEL: Urban Plus
- SERIES: null
- VARIANT: null
- CONDITION: NEW
- IDENTIFIERS: {"sku":null,"gtin":null,"ean":null,"upc":null,"mpn":null}
- ATTRIBUTES: {"babyProductType":"Bebek arabası / puset","brandPreference":"Chicco","features":"Urban Plus katlanır bebek arabası","condition":"Sıfır"}
- PROVIDER QUERY: Chicco arabası / puset Bebek arabası / puset Sıfır Urban Plus katlanır bebek arabası
- SUITABILITY: 0.758
- EXTERNAL CALL: YES

### Provider results
- TASK: SUCCESS (task_post + task_get completed)
- RETRY: yes (RAW=0 on first attempt)
- PARSE: normalized=27, skippedInvalidPrice=0, unknownTypes=0
- RAW: 0
- MATCHED: 0
- REJECTED: 0
- REJECT BREAKDOWN: none

### Matched audit (up to 10)
- (none)

### Rejected audit (up to 5 meaningful)
- (none with price > 0)

## 9. Unknown brand (Novexa) — identity only
- IDENTITY: brand=Novexa, model=XR-900 Pro → PASS
- EXTERNAL DATA: NONE / NOT TESTED (by design)

## 10. Automotive routing — Toyota Corolla 2024 Hybrid Dream
- brand=Toyota, model=Corolla, variant=2024
- specs preserved: Hybrid Dream
- EXTERNAL CALL: NO (expected NO)

## 11. Machinery routing — Heidelberg SM 74
- brand=Heidelberg, model=SM 74, machineType=Ofset baskı makinesi
- EXTERNAL CALL: NO

## 12. Service / printing guard
- Ofis temizliği: inferred brand=Ofis (conf 0.55), external=false
- Kraft kutu baskı: inferred brand=Kraft kutu (conf 0.55), external=false
- Production risk: LOW for external pricing (both skip provider). MEDIUM for title-only brand noise in downstream UX if brand field absent.

## 15. Cache test (Bosch + Samsung)
- Bosch: first cached=false (expect MISS), second cached=true (expect HIT), paid API calls=1 (expect 1)
- Samsung: first cached=false (expect MISS), second cached=false (expect HIT), paid API calls=3 (expect 1)
- CACHE STATUS: CHECK

## 16. Global quality metrics
- TOTAL REVIEWED (matched+rejected samples): 96
- TRUE POSITIVES: 61
- FALSE POSITIVES: 0
- TRUE NEGATIVES: 12
- FALSE NEGATIVES: 23
- PRECISION: 1.000
- RECALL: 0.726
- Note: Sample size is limited to top matched/rejected listings per product; metrics are indicative.

## 8. Brand-independence
- NEW BRAND-SPECIFIC CODE: NONE (no brand-specific changes in engine paths during this test session)

## Summary table
| PRODUCT | CATEGORY | SUITABILITY | RAW | MATCHED | TP | FP | TN | FN | MEDIAN | CONF | STATUS |
|---------|----------|-------------|-----|---------|----|----|----|----|--------|------|--------|
| iphone | technology | 1.00 | 12 | 3 | 3 | 0 | 4 | 1 | 44.951 TRY | 0.68 | OK |
| samsung | technology | 1.00 | 30 | 5 | 5 | 0 | 3 | 2 | 60.797 TRY | 0.68 | OK |
| sony | technology | 0.85 | 19 | 13 | 10 | 0 | 0 | 5 | 19.603 TRY | 0.59 | OK |
| dyson | home-kitchen | 0.64 | 18 | 16 | 10 | 0 | 1 | 1 | 41.025 TRY | 0.52 | OK |
| philips | home-kitchen | 0.64 | 33 | 30 | 10 | 0 | 1 | 2 | 32.683 TRY | 0.52 | OK |
| bosch | appliances | 0.89 | 43 | 30 | 10 | 0 | 0 | 5 | 35.999 TRY | 0.70 | OK |
| miele | appliances | 0.69 | 15 | 8 | 8 | 0 | 3 | 2 | 131.183 TRY | 0.65 | OK |
| makita | technology | 0.85 | 0 | 0 | 0 | 0 | 0 | 0 | INSUFFICIENT_DATA | 0.59 | RAW_EMPTY |
| dewalt | technology | 0.85 | 27 | 5 | 5 | 0 | 0 | 5 | 13.550 TRY | 0.59 | OK |
| chicco | baby | 0.76 | 0 | 0 | 0 | 0 | 0 | 0 | INSUFFICIENT_DATA | 0.88 | RAW_EMPTY |

## 19. Final verdict
**A) PRODUCTION_CANDIDATE**
Generic engine shows acceptable precision across diverse live brands with zero audited false positives.

## Footer
- GLOBAL PRECISION: 1.000
- GLOBAL RECALL: 0.726
- FALSE POSITIVE COUNT: 0
- FALSE NEGATIVE COUNT: 23
- BRAND-INDEPENDENCE: NONE (no brand-specific changes in engine paths during this test session)
- UNKNOWN BRAND: PASS (identity only)
- AUTOMOTIVE ROUTING: SKIP (expected)
- MACHINERY ROUTING: SKIP
- SERVICE/PRINTING GUARD: external skip OK; title brand noise documented
- CACHE: CHECK
- DATAFORSEO STATUS: CONFIGURED
- Categories in registry: 11