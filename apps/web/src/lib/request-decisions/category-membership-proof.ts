/**
 * DAYANAK KATMANI — "EN YAKIN KATEGORİ" BİR CEVAP DEĞİLDİR (2026-09-25).
 *
 * HANGİ HATA SINIFI. Tek bir bug değil, bir sınıf: **kapalı küme kararı açık
 * dünyada veriliyor.** "11 kategoriden hangisi?" diye sorulunca en yakını
 * seçilir ve sonuç EMİN görünür. Ölçüldü (2026-09-25, `qa/open-set`):
 * kategori dışı 202 meşru talebin türevlerinde 145 karar (dev yarısı) EMİN
 * biçimde bir kök iddia ediyordu — "Pirinç arıyorum, 50 kg baldo" →
 * `technology` 1.00, "Akrilik boya seti arıyorum" → `services` 1.00.
 *
 * KURUCUNUN KÖK İLKESİ. "Hiçbir kapalı küme kararı POZİTİF KANIT olmadan
 * kesinleşmez. Kategoriye aitlik bir DAYANAKLA kanıtlanır: talepteki ürün ya
 * da hizmetin, o kategorinin katalog/sözlük/alt kategori listesinde karşılığı
 * olmalı. Dayanak yoksa sonuç HİÇBİRİ ya da BELİRSİZ olur."
 *
 * NEDEN "BAŞ ADA BAĞLI" OLMAK ZORUNDA. Ölçülen kaçakların TAMAMINDA kanıt
 * cümlede vardı ama ARANAN ŞEYDE yoktu: "çam balı"nda `çam` (machinery
 * yaprağı), "salon için fon perde"de `salon` (furniture), "hediyelik kutu"da
 * `kutu` (printing), "200 adet promosyon için"de `promosyon` (printing).
 * Hepsi niteleyici ya da bağlam sözcüğü. Türkçe talep cümlesinde aranan şeyin
 * adı ÇEKİRDEĞİN SONUNDADIR ("... fırçası arıyorum"); dayanak o baş adı
 * içermeli, cümlenin herhangi bir yerini değil.
 *
 * NE YAPMAZ — VE BU SINIR ÖLÇÜMLE ÇİZİLDİ.
 *   - Yeni bir ürün sözlüğü KURMAZ. Kanonik ağaç (`taxonomy/registry`) ve
 *     kürasyonlu kategori sözlüğü (`ai/parser/category`) tek yetkililerdir;
 *     bu modül yalnız onlara SORAR.
 *   - Karar VERMEZ ve KARARI DEĞİŞTİRMEZ. Tek tüketicisi
 *     `understand-request`in sonundaki İŞARETLEME bloğudur: kategorisi ZATEN
 *     boş kalmış bir kararı "ölçtüm, yok" olarak etiketler.
 *   - DOLU bir kategori kararını DENETLEMEZ. Denendi ve ölçümle reddedildi
 *     (2026-09-25): dolu kararlara dayanak şartı koymak 1077 vakalık
 *     adversarial korpusun kategori doğruluğunu %100'den %85,5'e düşürdü —
 *     "Logo muhasebe programı" (technology), "Matematik özel ders" (services),
 *     "Düğün fotoğrafçısı" (services) gibi 32 taban cümle kategorisiz
 *     kalıyordu. Korpus bu deponun mevcut YETKİSİDİR; `services` kökü de
 *     hizmet taksonomi dosyasının 20 yaprağıyla sınırlı değil, Talepo'nun
 *     GENEL HİZMET PAZARIDIR. Bir ölçüt mevcut yetkiyle çelişiyorsa yeni bir
 *     kural değil, bir regresyondur.
 */
import {
  CLAIM_TAIL,
  getRootTaxonomyNodes,
  listTaxonomyAliasCandidates,
} from "@/lib/taxonomy";
import { detectCategoryResult } from "@/lib/ai/parser/category";

/**
 * 11 KÖK, KANONİK KAYNAKTAN TÜRETİLİR.
 *
 * Elle yazılmış bir kök listesi burada BULUNMAZ: kanonik ağacın `CATEGORY`
 * düğümleri tek yetkilidir. Taksonomiye bir kök eklendiği gün bu katman onu
 * kendiliğinden sorar; iki liste arasında sessiz sapma doğamaz.
 */
export function talepoRootIds(): string[] {
  return getRootTaxonomyNodes().map((n) => n.categoryId);
}

export type MembershipProof = {
  /** Kanonik ağaçta düğüm mü, kürasyonlu sözlükte anahtar mı. */
  kind: "CANONICAL_NODE" | "CURATED_LEXICON";
  categoryId: string;
  /** Dayanağı taşıyan ifade — kanıt etiketine aynen yazılır. */
  phrase: string;
  nodeId?: string;
};

/**
 * TALEBİN ÇEKİRDEĞİ VE BAŞ ADI.
 *
 * Kuyruk sözcükleri (`arıyorum`, `istiyorum`, `için`…) tek yetkili listeden
 * okunur (`taxonomy/phrase-classification` → `CLAIM_TAIL`); burada ikinci bir
 * liste tutulmaz. Noktalama çekirdeği BÖLER: "Bal arıyorum, çam balı 2 kg"
 * cümlesinde çekirdek "Bal"dır — virgülden sonrası niteleyici kuyruktur ve
 * aranan şeyi adlandırmaz.
 */
export function readRequestCore(rawInput: string): {
  core: string[];
  head: string | null;
} {
  const firstClause = String(rawInput ?? "")
    .split(/[.,;:!?\n]/)[0]
    ?.trim();
  if (!firstClause) return { core: [], head: null };
  const words = firstClause.split(/\s+/).filter(Boolean);
  let end = words.length;
  while (end > 0 && CLAIM_TAIL.has(fold(words[end - 1] ?? ""))) end -= 1;
  const core = words.slice(0, end);
  return { core, head: core.length ? (core[core.length - 1] ?? null) : null };
}

/** Kuyruk karşılaştırması için sade katlama — `CLAIM_TAIL` yazımıyla uyumlu. */
function fold(word: string): string {
  return word
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * BAŞ ADI TAŞIYAN İFADELER — en uzun önce.
 *
 * Baş ad tek başına yetmez ("fan motoru" içindeki "motoru"), bu yüzden baş adla
 * BİTEN bütün son-ekler denenir: "tüy bakım fırçası", "bakım fırçası",
 * "fırçası". Hepsi baş adı içerir, hiçbiri bağlam sözcüğünü tek başına
 * kanıt saymaz.
 */
function headBearingSpans(core: string[]): string[] {
  if (!core.length) return [];
  const spans: string[] = [];
  for (let start = 0; start < core.length; start += 1) {
    spans.push(core.slice(start).join(" "));
  }
  return spans;
}

/**
 * Bu kategori için baş ada bağlı bir dayanak var mı?
 *
 * Sıra kanıt gücüne göredir: kanonik düğüm kürasyonlu sözlükten güçlüdür,
 * çünkü kataloğun kendisidir.
 */
export function proveCategoryMembership(
  rawInput: string,
  categoryId: string,
): MembershipProof | null {
  const { core, head } = readRequestCore(rawInput);
  if (!head) return null;
  const spans = headBearingSpans(core);

  for (const span of spans) {
    const { nodes } = listTaxonomyAliasCandidates(span);
    const hit = nodes.find((n) => n.categoryId === categoryId);
    if (hit) {
      return {
        kind: "CANONICAL_NODE",
        categoryId,
        phrase: span,
        nodeId: hit.id,
      };
    }
  }

  /**
   * KÜRASYONLU SÖZLÜK DE BİR DAYANAKTIR (kurucu: "katalog/sözlük/alt kategori
   * listesi"). Ölçüldü: kanonik ağaç B kümesinin yalnız %79,2'sini kapsıyor —
   * "puset", "SSD", "PoE switch", "steteskop" meşru taleplerdir ve ağaçta
   * yaprakları yoktur. Yalnız kanonik dayanak istemek o %20,8'i HİÇBİRİ'ne
   * düşürürdü; yanlış alarm, kaçak kadar ciddi bir kusurdur.
   *
   * SÖZLÜK BAŞ ADI TAŞIYAN İFADEDE OKUNUR — CÜMLENİN TAMAMINDA DEĞİL.
   *
   * Ölçüldü (2026-09-25): sözlüğü YALNIZ baş sözcükte aramak kümenin yanlış
   * alarmını %7,6'dan %18,3'e çıkardı, yani meşru taleplerin altıda birini
   * kesiyordu — "Konveyör bant", "Yazar kasa POS cihazı", "Bebek taşıma
   * kangurusu" gibi Türkçe ad tamlamalarında anlamı taşıyan sözcük baş ad
   * DEĞİLDİR. Bu yüzden ölçüt "baş adı İÇEREN ifade"dir: bağlam sözcüğü tek
   * başına ("salon için", "hediyelik kutu", "200 adet promosyon") kanıt
   * üretemez, ama aranan şeyin adının bir parçası olan niteleyici üretir.
   *
   * Sözlük TEK YETKİLİDEN sorulur (`detectCategoryResult`); burada ikinci bir
   * anahtar kelime listesi yoktur.
   */
  for (const span of spans) {
    const detected = detectCategoryResult(span);
    const hit =
      (detected.score > 0 && detected.categoryId === categoryId) ||
      (detected.runnerUpScore > 0 && detected.runnerUpId === categoryId);
    if (hit && lexiconProofAllowed(categoryId, detected)) {
      return { kind: "CURATED_LEXICON", categoryId, phrase: span };
    }
  }
  return null;
}

/**
 * "HİZMET" BİR HİZMET ADI DEĞİLDİR — KÖKÜN KENDİ ADIDIR.
 *
 * `services` on bir kök arasında tek asimetriyi taşır: adı aynı zamanda günlük
 * bir sözcüktür. "Catering hizmeti", "Drone ile haritalama hizmeti", "Vize
 * danışmanlığı" cümlelerinde baş ad `hizmeti`dir ve sözlükte karşılık bulur —
 * ama hangi hizmet olduğunu söylemez. Ölçüldü (2026-09-25): bu tek sözcük
 * Talepo kataloğunda hiç bulunmayan hizmetleri `services` köküne EMİN biçimde
 * bağlıyordu.
 *
 * Ölçüt uydurulmadı, sözlüğün KENDİ hükmünden okunuyor: `detectCategoryResult`
 * zaten "yalın 'hizmet' zayıftır" diyor ve o kelimeye emin bayrağı vermiyor
 * (`hizmeti` → services/2/false). Dayanak için o bayrak istenir. Ürün
 * köklerinde aynı şart KOŞULMAZ: ölçüldü, "puset" (baby/1) ve "NVMe SSD"
 * (technology/1) emin bayrağı taşımıyor ama meşru dayanaklardır.
 */
function lexiconProofAllowed(
  categoryId: string,
  detected: ReturnType<typeof detectCategoryResult>,
): boolean {
  if (categoryId !== "services") return true;
  return detected.confident;
}

/**
 * HİÇBİR KÖKTE DAYANAK YOK MU?
 *
 * "Ölçemedim" ile "ölçtüm, yok" farklı şeylerdir (bkz. `out-of-taxonomy.ts`).
 * Bu fonksiyon ikincisini ölçer: talebin baş adı okunabiliyor ve 11 kökün
 * HİÇBİRİNDE o baş ada bağlı bir karşılık yok. Baş ad okunamıyorsa cevap
 * `false`tur — o zaman elimizde bir bulgu değil, ölçülemeyen bir cümle var.
 */
export function hasNoCategoryMembership(rawInput: string): boolean {
  const { head } = readRequestCore(rawInput);
  if (!head) return false;
  return talepoRootIds().every(
    (root) => proveCategoryMembership(rawInput, root) === null,
  );
}
