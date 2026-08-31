# Pazar ve Talep Zekâsı Programı — kalıcı kayıt

Durum: **FOUNDATION_ONLY — hiçbir altyapı provision edilmedi.**
Sahip: kurucu kararı bekleyen ana program (Completion Ledger `DW-*` kalemleri).
Tarih: 2026-08-31. Bu belge sözleşmeleri sabitler; kod, migration, sağlayıcı
ve credential içermez.

## Neden ayrı altyapı

Operasyonel PostgreSQL (Supabase) tekil taleplerin/ tekliflerin kayıt yeridir;
analitik sorgular (aylık trend, huni, bölge dağılımı) orada koşarsa hem ürün
yavaşlar hem şema analitik ihtiyaçla kirlenir. Kural: **admin paneli veri
SAKLAMAZ**; yalnız warehouse/provider okuma modelinden gösterir.

## Ölçüm sözlüğü (kanonik tanımlar)

Dört aşama birbirine KARIŞTIRILMADAN sayılır; her metriğin paydası yanında
tanımlıdır (bkz. `measurement-honesty`: ölçülmeyen sıfır değildir).

| Metrik | Tanım | Kaynak olay | Payda |
|---|---|---|---|
| `requests_created` | Yayına ulaşan talep (DRAFT hariç) | `request_published` | dönem |
| `offers_submitted` | Gönderilen teklif | `offer_submitted` | dönem / talep |
| `offers_accepted` | Kabul edilen teklif (anlaşma dönüşümü) | `offer_accepted` | `offers_submitted` |
| `deals_completed` | Tamamlanan satış (DealOutcome COMPLETED) | `deal_completed` | `offers_accepted` |
| Huni | created → submitted → accepted → completed | üstteki dördü | bir üst adım |
| Kategori/ay trendi | kategori × ay kırılımı | aynı olaylar | kategori toplamı |
| Bölge dağılımı | il (allowlist `TR-NN`) × kategori | aynı olaylar | il toplamı |

Konum telemetrisi mevcut Karar C sınırına uyar: yalnız `locationScope` +
allowlist `provinceCode`; ilçe ve ham metin ASLA taşınmaz.

## Olay sözleşmesi

Olaylar mevcut `observability/logger` hattından üretilir (yeni sistem yok).
Zorunlu alanlar: `event`, `occurredAt`, `categoryId`, `provinceCode?`,
`requestId-hash` (ham id değil; geri çözülemez). Kullanıcı kimliği, e-posta,
serbest metin **taşınmaz** — anonimleştirme üretim tarafında yapılır, warehouse
tarafında değil. Bilinen açık önkoşul: **log sink hâlâ doğrulanmadı**
(KNOWN-RISKS #23); sink kapatılmadan hiçbir sayı gerçek sayılmaz.

## Sağlayıcı sınırı

Admin read-model'i tek bir arabirimin arkasından okur:
`getMarketIntelligence(period, filters) → {metrics, funnel, trends}`.
Arabirimin arkasında hangi sağlayıcı olduğu admin kodunu İLGİLENDİRMEZ.
Dış pazar verisi önce gelir; Talepo iç verisi sink + anonimleştirme
kanıtlandıktan sonra AYNI arabirime ikinci kaynak olarak eklenir ve iki
kaynak ekranda **etiketlenerek** ayrışır (dış veri / Talepo verisi).

## Önerilen mimari (tek öneri)

**ClickHouse (self-host ya da Cloud) + günlük batch yükleme.**
Gerekçe: salt-append olay akışı + kategori/zaman kesitli agregasyon ClickHouse'un
ana deseni; Postgres'ten mantıksal olarak tamamen ayrık; maliyet küçük hacimde
sıfıra yakın; SQL bilgisi ekipte mevcut. BigQuery ikinci seçenek olurdu ama
GCP hesabı ve faturalama bağımlılığı ekler. **Bu bir öneridir — sağlayıcı
kararı, provision ve credential kurucu onayı olmadan yapılmaz.**

## Yapılmayacaklar (bu programda kilitli)

- Operasyonel DB'yi warehouse gibi kullanmak
- Admin panelinde veri saklamak
- Sahte pazar rakamı / tamamlanmış görünen boş dashboard
- Prisma migration
- Sessiz sağlayıcı seçimi, provision, credential

## Kod temeli (2026-08-31, FOUNDATION uygulandı)

Sözleşmenin kod karşılığı `apps/web/src/lib/market-intelligence/` altındadır
ve `verify-market-intelligence-foundation-v1` kapısıyla korunur (mutasyon
kontrollü):

- `contract.ts` — v1 olay şeması: 4 ayrık olay, deterministik idempotent
  `eventId`, geri çözülemez `requestRef`/`workspaceRef`, allowlist'ten
  geçmeyen konumun TAŞINMAMASI. Üretici bağlanmadı (DW-2 ayrı dilim).
- `sink.ts` — `WarehouseTransport` arayüzü + non-blocking batch sink.
  Transport yokken durum **DW_PROVISION_REQUIRED**'dır ve düşen olay
  sayılır; sahte in-memory dayanıklılık TAKLİT EDİLMEZ. Gerçek dayanıklı
  teslim (outbox tablosu / ClickHouse) DW-3 provision'ına bağlıdır.
- `provider.ts` — `getMarketIntelligence(period, filters)` read-model
  sözleşmesi + veri yokken `NOT_MEASURED` dönen varsayılan sağlayıcı.

**Ölçek geçiş sınırı:** başlangıç ClickHouse + günlük batch'tir. Günlük
olay hacmi batch penceresini anlamlı biçimde aşarsa (ör. gün-içi karar
ihtiyacı doğarsa) async/continuous ingestion'a geçiş AYRI bir kurucu
kararıdır; `WarehouseTransport` arayüzü bu geçişte değişmez, yalnız
arkasındaki teslim uygulaması değişir.

## Sıradaki adımlar (Ledger'da DW-1..DW-4)

1. **DW-1** Log sink doğrulama kapısı (KNOWN-RISKS #23) — iç veri önkoşulu.
2. **DW-2** Olay üreticilerini sözlükteki 4 kanonik olaya bağlayan dilim.
3. **DW-3** Kurucu kararı: sağlayıcı + provision (DECISION_REQUIRED).
4. **DW-4** Admin "Pazar ve Talep Zekâsı" yüzeyi — yalnız read-model, önce
   dış veri, gerçek veri gelene kadar yüzey "veri yok" der, asla doldurmaz.
