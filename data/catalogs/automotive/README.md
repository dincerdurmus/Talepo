# Talepo Automotive Master Catalog V2B — Engines

Bu paket V2A generation katmanının üstüne engine/propulsion enrichment eklemek için hazırlanmıştır.

Engine record count: 31

Bu paket geniş kapsamın ilk doğrulanmış seed setidir; tam global motor kataloğu değildir.
Amaç motor matcher contract'ını production-safe biçimde devreye almak ve ardından kaynak doğrulamalı batch'lerle büyütmektir.

## Kritik kurallar
- Engine code bilinmiyorsa null.
- Motor yalnız marka+model+generation scope içinde çözülür.
- Aynı marketing name'in farklı güç varyantları olabilir.
- Yıl consistency signal'dır; tek başına seçim yapmaz.
- Yanlış motor eşleşmesi yerine unresolved tercih edilir.
- BEV motorlarında displacementCc null olabilir.

## Sonraki faz
V2B.2+ ile aynı schema kullanılarak daha fazla marka/model motor ailesi eklenir.
V2C transmission ayrı domain olarak tutulur.
