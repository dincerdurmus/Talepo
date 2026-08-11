# Talepo Automotive Generations Expansion V2A.2

Bu paket mevcut V2A'nın yerine geçmez. DELTA/MERGE paketidir.

- Canonical marka master: 107
- Canonical model master: 803
- Yeni generation delta kaydı: 423 (Togg T10X I / T10F I near-dupes removed; folded into base)
- Canonical model bulunamadığı için atlanan kayıt: 0

## Entegrasyon
Mevcut `automotive-generations.json` korunur.
`automotive-generations-v2a2-delta.json` stable ID ile merge/upsert edilir.
Aynı ID varsa yeni duplicate oluşturulmaz.

## Güvenlik
- brandId/modelId yalnız mevcut master ID'lere referans verir.
- Global fuzzy generation yok.
- Yıl tek başına generation authority değildir.
- Bilinmeyen kasa kodu unresolved kalır.
- Bu paket motor/OEM/compatibility verisi içermez.
