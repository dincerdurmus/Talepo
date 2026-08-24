/**
 * Generate data/taxonomy/** JSON for Universal Master Taxonomy V1.
 * Run from apps/web: npx tsx scripts/generate-master-taxonomy-v1.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";
import { subcategorySlug, foldLabel } from "../src/lib/knowledge/slug";
import type {
  TaxonomyNode,
  TaxonomyNodeType,
} from "../src/lib/taxonomy/types";

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, ".."), // apps/web → repo
    path.resolve(cwd), // already at repo
    path.resolve(cwd, "../.."),
  ];
  for (const root of candidates) {
    if (existsSync(path.join(root, "data", "catalogs", "automotive"))) {
      return root;
    }
  }
  return path.resolve(cwd, "..");
}

const REPO_ROOT = resolveRepoRoot();
const OUT = path.join(REPO_ROOT, "data", "taxonomy");
const AUTO_PARTS = path.join(
  REPO_ROOT,
  "data",
  "catalogs",
  "automotive",
  "automotive-part-taxonomy.json",
);

type ChildSpec =
  | string
  | {
      name: string;
      aliases?: string[];
      ambiguousAliases?: string[];
      type?: TaxonomyNodeType;
      schema?: string;
      children?: ChildSpec[];
      searchTerms?: string[];
      catalogSystemId?: string;
      catalogSubsystemId?: string;
    };

function slugPart(name: string): string {
  return subcategorySlug(name);
}

function nodeOf(
  partial: Omit<TaxonomyNode, "aliases" | "searchTerms" | "applicableCapabilities" | "status"> &
    Partial<TaxonomyNode>,
): TaxonomyNode {
  return {
    aliases: [],
    searchTerms: [],
    applicableCapabilities: [],
    status: "active",
    ...partial,
  };
}

function capsFor(categoryId: string, nodeType: TaxonomyNodeType): string[] {
  if (nodeType === "SERVICE_TYPE") return ["SERVICE_SCHEMA"];
  if (nodeType === "COMMODITY_TYPE") return ["COMMODITY_SCHEMA", "ATTRIBUTE_SCHEMA"];
  if (nodeType === "PART_TYPE") return ["ENTITY_COMPATIBILITY", "ATTRIBUTE_SCHEMA"];
  if (categoryId === "automotive") return ["ENTITY_CATALOG", "ATTRIBUTE_SCHEMA"];
  if (categoryId === "machinery") return ["ENTITY_CATALOG", "ATTRIBUTE_SCHEMA"];
  if (categoryId === "appliances" || categoryId === "technology")
    return ["ENTITY_CATALOG", "ENTITY_SPEC", "ATTRIBUTE_SCHEMA"];
  if (categoryId === "services") return ["SERVICE_SCHEMA"];
  if (categoryId === "health") return ["ATTRIBUTE_SCHEMA", "COMMODITY_SCHEMA"];
  return ["ATTRIBUTE_SCHEMA"];
}

/**
 * PARÇA TAŞIYICILIĞI — DÜĞÜM BAZINDA, KANONİK KAYNAKTAN (1D).
 *
 * Kaldırılan model: `PART_BEARING_DOMAINS` bir ALAN listesiydi ve o alandaki
 * BÜTÜN ürün düğümlerini aynı yetenekle işaretliyordu (541 düğüm). Alan
 * üyeliği bir ürünün servis edilebilir olduğunu KANITLAMAZ: "Cam" makine
 * alanındadır ama parça taşımaz.
 *
 * Yeni model: kaynak `data/taxonomy-sources/part-bearing-capability.json`.
 * Her kayıt kanonik bir node id'ye ve bir provenance'a bağlıdır. Üç durum
 * ayrıdır ve bu ayrım tüketiciye kadar taşınır:
 *   PART_BEARING      — bildirilmiş: parça taşır.
 *   NOT_PART_BEARING  — bildirilmiş RET (emlak varlığı, hizmet).
 *   (kayıt yok)       — henüz kürasyon yapılmamış. RET DEĞİLDİR.
 *
 * Türetim denendi ve yetmedi: appliances/technology'de hiç PART_TYPE düğüm
 * yok, automotive/machinery'de ise parça düğümleri ürün düğümlerinin KARDEŞİ
 * (torunu değil). Bu yüzden otomotiv/makine kayıtları "derived:" provenance
 * ile o kanıta atıfla, beyaz eşya/teknoloji kayıtları "curated:"/"verified:"
 * ile kürasyon kararına atıfla girilmiştir.
 */
const PART_BEARING_SOURCE = path.join(
  REPO_ROOT,
  "data",
  "taxonomy-sources",
  "part-bearing-capability.json",
);

type PartBearingEntry = {
  nodeId: string;
  bearing: boolean;
  scope: "node" | "subtree";
  source: string;
  note?: string;
};

function applyPartBearingCapability(
  domains: Array<{ id: string; nodes: TaxonomyNode[] }>,
): void {
  if (!existsSync(PART_BEARING_SOURCE)) {
    throw new Error(`PART_BEARING kaynağı yok: ${PART_BEARING_SOURCE}`);
  }
  const file = JSON.parse(readFileSync(PART_BEARING_SOURCE, "utf8")) as {
    capability: string;
    version: string;
    entries: PartBearingEntry[];
  };
  if (file.capability !== "PART_BEARING") {
    throw new Error(`Beklenmeyen capability: ${file.capability}`);
  }

  const byId = new Map<string, TaxonomyNode>();
  const childrenOf = new Map<string, TaxonomyNode[]>();
  for (const d of domains) {
    for (const n of d.nodes) {
      byId.set(n.id, n);
      const list = childrenOf.get(n.parentId ?? "") ?? [];
      list.push(n);
      childrenOf.set(n.parentId ?? "", list);
    }
  }

  const verdict = new Map<string, { bearing: boolean; entry: PartBearingEntry }>();
  const seen = new Set<string>();
  for (const entry of file.entries) {
    if (seen.has(entry.nodeId)) {
      throw new Error(`PART_BEARING kaynağında yinelenen node id: ${entry.nodeId}`);
    }
    seen.add(entry.nodeId);
    if (!entry.source?.trim()) {
      throw new Error(`PART_BEARING kaydında provenance yok: ${entry.nodeId}`);
    }
    const root = byId.get(entry.nodeId);
    if (!root) {
      throw new Error(`PART_BEARING kaynağındaki node id taksonomide yok: ${entry.nodeId}`);
    }
    // scope=subtree deterministik BFS ile yalnız PRODUCT_TYPE torunlara iner.
    const targets: TaxonomyNode[] = [];
    if (entry.scope === "subtree") {
      const queue = [root];
      const walked = new Set<string>();
      while (queue.length) {
        const cur = queue.shift()!;
        if (walked.has(cur.id)) continue;
        walked.add(cur.id);
        if (cur.nodeType === "PRODUCT_TYPE") targets.push(cur);
        for (const child of childrenOf.get(cur.id) ?? []) queue.push(child);
      }
    } else {
      if (root.nodeType !== "PRODUCT_TYPE") {
        throw new Error(
          `scope=node yalnız PRODUCT_TYPE düğüme verilebilir: ${entry.nodeId} (${root.nodeType})`,
        );
      }
      targets.push(root);
    }
    /**
     * NO-OP KAYIT YOK (1E). Sıfır düğüme uygulanan bir kayıt, kaynağı
     * gerçekte var olmayan bir kararla şişirir ve okuyana kapsamı olduğundan
     * geniş gösterir. Ölçülen örnek: `tax:services` altında hiç PRODUCT_TYPE
     * düğüm yok, kayıt hiçbir şey yapmıyordu.
     */
    if (targets.length === 0) {
      throw new Error(
        `PART_BEARING kaydı hiçbir düğüme uygulanmıyor (no-op): ${entry.nodeId}`,
      );
    }
    /**
     * Doğrulanmamış geniş RET kullanılamaz (1E). Kesin negatif yalnız açık ve
     * doğrulanmış bir ürün kararına dayanabilir ve düğüm bazında verilir.
     */
    if (entry.bearing === false && entry.scope === "subtree") {
      throw new Error(
        `Kesin negatif yalnız scope=node olabilir: ${entry.nodeId}`,
      );
    }
    for (const node of targets) {
      const prev = verdict.get(node.id);
      if (prev && prev.bearing !== entry.bearing) {
        throw new Error(
          `PART_BEARING çelişkisi: ${node.id} hem ${prev.entry.nodeId} hem ${entry.nodeId} kaydından farklı sonuç alıyor`,
        );
      }
      verdict.set(node.id, { bearing: entry.bearing, entry });
    }
  }

  let bearing = 0;
  let excluded = 0;
  for (const [nodeId, v] of verdict) {
    const node = byId.get(nodeId)!;
    const cap = v.bearing ? "PART_BEARING" : "NOT_PART_BEARING";
    if (!node.applicableCapabilities.includes(cap)) {
      node.applicableCapabilities = [...node.applicableCapabilities, cap];
    }
    node.meta = { ...(node.meta ?? {}), partBearingSource: v.entry.source };
    if (v.bearing) bearing += 1;
    else excluded += 1;
  }
  console.log(
    `PART_BEARING: ${bearing} düğüm bildirildi, ${excluded} düğüm açıkça reddedildi (kaynak v${file.version}, ${file.entries.length} kayıt)`,
  );
}

function leafTypeFor(categoryId: string, subSlug: string): TaxonomyNodeType {
  if (categoryId === "services") return "SERVICE_TYPE";
  if (categoryId === "automotive" && subSlug === "arac-bakim") return "SERVICE_TYPE";
  if (categoryId === "technology" && (subSlug === "yazilim-gelistirme" || subSlug === "web-sitesi"))
    return "SERVICE_TYPE";
  if (categoryId === "health" && subSlug === "sarf-malzeme") return "COMMODITY_TYPE";
  if (categoryId === "printing" && subSlug.includes("malzeme")) return "COMMODITY_TYPE";
  if (categoryId === "automotive" && subSlug === "yedek-parca") return "PART_TYPE";
  if (categoryId === "machinery" && subSlug === "yedek-parca") return "PART_TYPE";
  if (categoryId === "real-estate") return "PRODUCT_TYPE";
  return "PRODUCT_TYPE";
}

/**
 * Hasat katmanı (2026-08-22) — perakende envanterlerinden kürasyonla alınan
 * ürün tipleri. Kural: depth 0-1 (kök/alt kategori) motorla aynalıdır,
 * dokunulmaz; overlay yalnız depth-2 GROUP ve depth-3 PRODUCT_TYPE ekler.
 * Aynı isim/alias (fold bazlı) domain içinde zaten varsa atlanır.
 */
type HarvestLeaf = string | { name: string; aliases?: string[] };
type HarvestAdd = { sub: string; group: string; leaves: HarvestLeaf[] };

const HARVEST_OVERLAY: Record<string, { source: string; adds: HarvestAdd[] }> = {
  technology: {
    source: "MediaMarkt",
    adds: [
      { sub: "donanim", group: "Fotoğraf ve Kamera", leaves: [
        "Fotoğraf Makinesi",
        { name: "Aynasız Fotoğraf Makinesi", aliases: ["aynasiz makine"] },
        { name: "DSLR Fotoğraf Makinesi", aliases: ["dslr"] },
        "Kompakt Fotoğraf Makinesi",
        { name: "Aksiyon Kamerası", aliases: ["aksiyon kamera"] },
        "Video Kamera",
        { name: "Drone", aliases: ["dron"] },
        "Gimbal",
        "Objektif",
        "Tripod",
      ] },
      { sub: "donanim", group: "Ses ve Kulaklık", leaves: [
        "Kulaklık",
        { name: "Bluetooth Kulaklık", aliases: ["kablosuz kulaklık", "kablosuz kulaklik"] },
        { name: "Kulak İçi Kulaklık", aliases: ["kulakici kulaklik"] },
        "Bluetooth Hoparlör",
        "Soundbar",
        "Mikrofon",
      ] },
      { sub: "donanim", group: "Oyun ve Eğlence", leaves: [
        "Oyun Konsolu",
        { name: "Gamepad", aliases: ["oyun kolu"] },
        { name: "VR Gözlük", aliases: ["sanal gerçeklik gözlüğü", "vr gozluk"] },
        "Oyuncu Koltuğu",
      ] },
      { sub: "donanim", group: "Giyilebilir Teknoloji", leaves: [
        { name: "Akıllı Saat", aliases: ["smartwatch"] },
        "Akıllı Bileklik",
      ] },
      { sub: "donanim", group: "Ağ ve Modem", leaves: [
        { name: "Modem", aliases: ["router"] },
        { name: "Mesh Wi-Fi Sistemi", aliases: ["mesh wifi"] },
        "Access Point",
        { name: "Ağ Anahtarı (Switch)", aliases: ["network switch"] },
      ] },
      { sub: "donanim", group: "Çevre birimleri", leaves: [
        "Yazıcı", "Tarayıcı", "Monitör", "Klavye", "Mouse", "Webcam",
        { name: "Kesintisiz Güç Kaynağı", aliases: ["ups"] },
      ] },
      { sub: "donanim", group: "TV ve görüntü", leaves: [
        { name: "Projeksiyon Cihazı", aliases: ["projektör", "projektor"] },
        // "Media Player" kaldırıldı: ağaçta zaten "Medya oynatıcı" var,
        // ikisi aynı üründü (kurucu, 2026-08-23).
      ] },
    ],
  },
  appliances: {
    source: "MediaMarkt + Koçtaş",
    adds: [
      { sub: "beyaz-esya", group: "Ankastre ve set", leaves: [
        "Ankastre Fırın",
        "Ankastre Ocak",
        { name: "Ankastre Set", aliases: ["ankastre takım", "ankastre takim"] },
        "Davlumbaz",
        "Set Üstü Ocak",
        "Şarap Dolabı",
        "Mini Buzdolabı",
      ] },
      { sub: "kucuk-ev-aletleri", group: "Temizlik ve kişisel bakım", leaves: [
        "Robot Süpürge",
        "Dikey Süpürge",
        "Islak Kuru Süpürge",
        "Buharlı Temizleyici",
        "Halı Yıkama Makinesi",
        "Ütü İstasyonu",
        "Nem Alma Cihazı",
        { name: "Saç Kurutma Makinesi", aliases: ["fön makinesi", "fon makinesi"] },
        "Saç Düzleştirici",
        "Tıraş Makinesi",
        "Epilasyon Aleti",
        "Dikiş Makinesi",
      ] },
      { sub: "isitma-sogutma-ve-havalandirma", group: "Isıtma çözümleri", leaves: [
        "Isı Pompası",
        "Elektrikli Şömine",
        "Elektrikli Isıtıcı",
        "Yağlı Radyatör",
        "Havlupan",
        "Panel Radyatör",
        { name: "Şofben", aliases: ["ani su ısıtıcı", "ani su isitici"] },
        "Termosifon",
      ] },
    ],
  },
  "home-kitchen": {
    source: "MediaMarkt + Koçtaş",
    adds: [
      { sub: "diger", group: "Pişirme gereçleri", leaves: [
        "Tencere Seti",
        "Tava",
        "Döküm Tencere",
        "Düdüklü Tencere",
        { name: "Bıçak Seti", aliases: ["mutfak bıçağı", "mutfak bicagi"] },
        "Saklama Kabı Seti",
        "Termos",
      ] },
      { sub: "diger", group: "Sofra ve sunum", leaves: [
        "Sunum Tabağı",
        "Servis Takımı",
        "Kesme Tahtası",
      ] },
    ],
  },
  furniture: {
    source: "Koçtaş",
    adds: [
      { sub: "ev-mobilyasi", group: "Oturma Odası & Salon", leaves: [
        { name: "Çekyat", aliases: ["çekyat kanepe"] },
        "Berjer",
        "Puf",
        "TV Ünitesi",
        "Kitaplık",
      ] },
      { sub: "ev-mobilyasi", group: "Yatak Odası", leaves: [
        "Şifonyer",
        "Gardırop",
        "Komodin",
        { name: "Baza", aliases: ["baza yatak"] },
      ] },
      { sub: "ev-mobilyasi", group: "Tamamlayıcı Ürünler", leaves: [
        "Ayakkabılık",
        "Vestiyer",
        "Dresuar",
        "Zigon Sehpa",
      ] },
      { sub: "diger", group: "Bahçe ve Balkon Mobilyası", leaves: [
        "Bahçe Oturma Grubu",
        "Bahçe Masa Sandalye Takımı",
        "Şezlong",
        { name: "Bahçe Salıncağı", aliases: ["salıncak sandalye", "salincak sandalye"] },
        "Kamelya",
        "Balkon Seti",
      ] },
    ],
  },
  machinery: {
    source: "Makinecim + Bauhaus",
    adds: [
      { sub: "diger", group: "İnşaat ve iş makineleri", leaves: [
        { name: "Ekskavatör", aliases: ["kepçe", "kepce"] },
        "Mini Ekskavatör",
        { name: "Yükleyici (Loder)", aliases: ["beko loder", "loader"] },
        "Beton Santrali",
        "Beton Pompası",
        "Kule Vinç",
        "Mobil Vinç",
        "Silindir (Kompaktör)",
      ] },
      { sub: "diger", group: "Enerji ve güç", leaves: [
        "Jeneratör",
        "Dizel Jeneratör",
        "Trafo",
      ] },
      { sub: "diger", group: "Tarım makineleri", leaves: [
        "Traktör",
        "Balya Makinesi",
        "Mibzer",
        "Pulluk",
        "Süt Sağım Makinesi",
        "Yem Karma Makinesi",
      ] },
      { sub: "diger", group: "El aletleri ve hırdavat", leaves: [
        "Matkap",
        "Akülü Vidalama",
        { name: "Avuç Taşlama", aliases: ["spiral taşlama", "spiral taslama"] },
        { name: "Kırıcı-Delici", aliases: ["hilti"] },
        "Dekupaj Testere",
        "Gönye Kesme Makinesi",
        "Basınçlı Yıkama Makinesi",
      ] },
    ],
  },
  printing: {
    source: "Matbaaloji",
    adds: [
      { sub: "promosyon", group: "Promosyon ürünleri", leaves: [
        "Magnet",
        "Ajanda",
        { name: "Takvim", aliases: ["duvar takvimi", "masa takvimi"] },
        "Anahtarlık",
        "Kupa Baskı",
      ] },
      { sub: "diger", group: "Diğer matbaa işleri", leaves: [
        "Afiş",
        "Poster",
        "Branda Baskı",
        { name: "Roll-up Banner", aliases: ["rollup", "roll up"] },
        "Fuar Standı",
        "Davetiye",
        "Sertifika",
        { name: "Kaşe", aliases: ["kase baski"] },
        "Bloknot",
      ] },
    ],
  },
  baby: {
    source: "e-bebek",
    adds: [
      { sub: "bebek-arabasi", group: "Araba tipleri", leaves: [
        "Travel Sistem Bebek Arabası",
        { name: "Baston Bebek Arabası", aliases: ["baston puset"] },
        "İkiz Bebek Arabası",
      ] },
      { sub: "bebek-arabasi", group: "Oto koltuğu ve taşıma", leaves: [
        "Oto Koltuğu",
        "Ana Kucağı",
        { name: "Kanguru", aliases: ["bebek taşıyıcı", "bebek tasiyici"] },
        "Portbebe",
      ] },
      { sub: "beslenme", group: "Beslenme ürünleri", leaves: [
        "Mama Sandalyesi",
        "Biberon",
        "Göğüs Pompası",
        "Sterilizatör",
        "Mama Isıtıcı",
      ] },
      { sub: "uyku-besik", group: "Uyku", leaves: [
        { name: "Park Yatak", aliases: ["oyun parkı", "oyun parki"] },
        "Bebek Yatağı",
        "Uyku Tulumu",
        "Anne Yanı Beşik",
      ] },
      { sub: "bakim", group: "Bakım", leaves: [
        "Bebek Bezi",
        "Islak Mendil",
        "Bebek Küveti",
        "Alt Açma Minderi",
      ] },
      { sub: "diger", group: "Oyun ve gezi", leaves: [
        "Akülü Araba",
        "Yürüteç",
        { name: "Salıncak", aliases: ["bebek salıncağı", "bebek salincagi"] },
        "Oyun Halısı",
        "Üç Teker Bisiklet",
        "Scooter",
      ] },
    ],
  },
};

function applyHarvestOverlay(
  domains: Array<{ id: string; file: string; nodes: TaxonomyNode[] }>,
): void {
  let added = 0;
  let skipped = 0;
  for (const domain of domains) {
    const overlay = HARVEST_OVERLAY[domain.id];
    if (!overlay) continue;
    const nodes = domain.nodes;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const taken = new Set<string>();
    for (const n of nodes) {
      taken.add(foldLabel(n.canonicalName));
      for (const a of n.aliases) taken.add(foldLabel(a));
    }
    for (const add of overlay.adds) {
      const subId = `tax:${domain.id}:${add.sub}`;
      const subParent = byId.get(subId);
      if (!subParent) {
        throw new Error(`Harvest overlay: unknown subcategory ${subId}`);
      }
      let group = nodes.find(
        (n) =>
          n.parentId === subId &&
          n.nodeType === "GROUP" &&
          foldLabel(n.canonicalName) === foldLabel(add.group),
      );
      if (!group) {
        group = nodeOf({
          id: `${subId}:${slugPart(add.group)}`,
          parentId: subId,
          canonicalName: add.group,
          nodeType: "GROUP",
          categoryId: domain.id,
          subcategoryId: add.sub,
          depth: 2,
          applicableCapabilities: capsFor(domain.id, "GROUP"),
          requestSchemaId: subParent.requestSchemaId,
          provenance: { source: "harvest-2026-08-22", note: overlay.source },
        });
        if (byId.has(group.id)) {
          throw new Error(`Harvest overlay: id collision ${group.id}`);
        }
        nodes.push(group);
        byId.set(group.id, group);
      }
      for (const leaf of add.leaves) {
        const spec = typeof leaf === "string" ? { name: leaf } : leaf;
        if (taken.has(foldLabel(spec.name))) {
          skipped += 1;
          continue;
        }
        const id = `${group.id}:${slugPart(spec.name)}`;
        if (byId.has(id)) {
          skipped += 1;
          continue;
        }
        const node = nodeOf({
          id,
          parentId: group.id,
          canonicalName: spec.name,
          aliases: spec.aliases ?? [],
          nodeType: "PRODUCT_TYPE",
          categoryId: domain.id,
          subcategoryId: add.sub,
          depth: group.depth + 1,
          applicableCapabilities: capsFor(domain.id, "PRODUCT_TYPE"),
          requestSchemaId: group.requestSchemaId,
          provenance: { source: "harvest-2026-08-22", note: overlay.source },
        });
        nodes.push(node);
        byId.set(id, node);
        taken.add(foldLabel(spec.name));
        for (const a of spec.aliases ?? []) taken.add(foldLabel(a));
        added += 1;
      }
    }
  }
  console.log(`Harvest overlay: +${added} product types (${skipped} already present, skipped)`);
}

/**
 * Google Product Taxonomy TR katmanı (kurucu kararı, 2026-08-23: tüm dallar
 * "Al"). Kaynak: data/taxonomy-sources/google-tr-overlay.json — o dosya da
 * scratchpad'deki build-google-overlay.mjs ile üretilir, elle düzenlenmez.
 * Yalnız 3. seviye ürün adlarını alır; derin detay kırılımı onay dışıdır.
 */
type GoogleOverlayFile = {
  source: string;
  decision: string;
  categories: Record<
    string,
    Array<{ sub: string; group: string; leaves: string[] }>
  >;
};

function applyGoogleOverlay(
  domains: Array<{ id: string; file: string; nodes: TaxonomyNode[] }>,
): void {
  const overlayPath = path.join(
    REPO_ROOT,
    "data",
    "taxonomy-sources",
    "google-tr-overlay.json",
  );
  if (!existsSync(overlayPath)) {
    console.log("Google overlay: kaynak dosya yok, atlandı");
    return;
  }
  const overlay = JSON.parse(
    readFileSync(overlayPath, "utf8"),
  ) as GoogleOverlayFile;

  let added = 0;
  let skipped = 0;
  let groupsMade = 0;

  for (const domain of domains) {
    const spec = overlay.categories[domain.id];
    if (!spec) continue;
    const nodes = domain.nodes;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const taken = new Set<string>();
    for (const n of nodes) {
      taken.add(foldLabel(n.canonicalName));
      for (const a of n.aliases) taken.add(foldLabel(a));
    }

    for (const entry of spec) {
      const subId = `tax:${domain.id}:${entry.sub}`;
      const subParent = byId.get(subId);
      if (!subParent) {
        throw new Error(`Google overlay: unknown subcategory ${subId}`);
      }
      let group = nodes.find(
        (n) =>
          n.parentId === subId &&
          n.nodeType === "GROUP" &&
          foldLabel(n.canonicalName) === foldLabel(entry.group),
      );
      if (!group) {
        group = nodeOf({
          id: `${subId}:${slugPart(entry.group)}`,
          parentId: subId,
          canonicalName: entry.group,
          nodeType: "GROUP",
          categoryId: domain.id,
          subcategoryId: entry.sub,
          depth: 2,
          applicableCapabilities: capsFor(domain.id, "GROUP"),
          requestSchemaId: subParent.requestSchemaId,
          provenance: {
            source: "google-product-taxonomy-tr",
            note: "kurucu onayı 2026-08-23",
          },
        });
        if (byId.has(group.id)) {
          throw new Error(`Google overlay: id collision ${group.id}`);
        }
        nodes.push(group);
        byId.set(group.id, group);
        groupsMade += 1;
      }

      for (const leaf of entry.leaves) {
        if (taken.has(foldLabel(leaf))) {
          skipped += 1;
          continue;
        }
        const id = `${group.id}:${slugPart(leaf)}`;
        if (byId.has(id)) {
          skipped += 1;
          continue;
        }
        const node = nodeOf({
          id,
          parentId: group.id,
          canonicalName: leaf,
          aliases: [],
          nodeType: leafTypeFor(domain.id, entry.sub),
          categoryId: domain.id,
          subcategoryId: entry.sub,
          depth: group.depth + 1,
          applicableCapabilities: capsFor(
            domain.id,
            leafTypeFor(domain.id, entry.sub),
          ),
          requestSchemaId: group.requestSchemaId,
          provenance: {
            source: "google-product-taxonomy-tr",
            note: "kurucu onayı 2026-08-23",
          },
        });
        nodes.push(node);
        byId.set(id, node);
        taken.add(foldLabel(leaf));
        added += 1;
      }
    }
  }
  console.log(
    `Google TR overlay: +${added} ürün tipi, +${groupsMade} grup (${skipped} zaten vardı)`,
  );
}

function expandTree(
  nodes: TaxonomyNode[],
  parent: TaxonomyNode,
  children: ChildSpec[],
  defaultLeaf: TaxonomyNodeType,
): void {
  for (const child of children) {
    const spec =
      typeof child === "string"
        ? { name: child }
        : child;
    const hasKids = Boolean(spec.children?.length);
    const nodeType: TaxonomyNodeType = spec.type
      ? spec.type
      : hasKids
        ? "GROUP"
        : defaultLeaf;
    const id = `${parent.id}:${slugPart(spec.name)}`;
    const n = nodeOf({
      id,
      parentId: parent.id,
      canonicalName: spec.name,
      aliases: spec.aliases ?? [],
      ambiguousAliases: spec.ambiguousAliases,
      nodeType,
      categoryId: parent.categoryId,
      subcategoryId: parent.subcategoryId ?? (parent.nodeType === "SUBCATEGORY" ? slugPart(parent.canonicalName) : parent.subcategoryId),
      depth: parent.depth + 1,
      searchTerms: spec.searchTerms ?? [],
      applicableCapabilities: capsFor(parent.categoryId, nodeType),
      requestSchemaId:
        spec.schema ??
        (parent.requestSchemaId ||
          (parent.subcategoryId
            ? `${parent.categoryId}/${parent.subcategoryId}`
            : parent.categoryId)),
      catalogSystemId: spec.catalogSystemId,
      catalogSubsystemId: spec.catalogSubsystemId,
      provenance: {
        source: "talepo-master-taxonomy-v1",
        note: "Curated Turkish market terminology",
      },
    });
    // Ensure subcategoryId propagates
    if (!n.subcategoryId && parent.nodeType === "SUBCATEGORY") {
      n.subcategoryId = subcategorySlug(parent.canonicalName);
    }
    if (!n.subcategoryId && parent.subcategoryId) n.subcategoryId = parent.subcategoryId;
    nodes.push(n);
    if (spec.children?.length) {
      expandTree(nodes, n, spec.children, defaultLeaf);
    }
  }
}

/**
 * ÜRETİLMİŞ DOSYA HİJYENİ (1D).
 *
 * Generator her koşuda LF yazıyordu; depo çalışma kopyası ise CRLF. İçerik
 * hiç değişmemiş olsa bile 5 taksonomi dosyası `git status`'ta modified
 * görünüyor, gerçek capability diff'i gürültünün içinde kayboluyordu.
 *
 * İki kural birlikte çözer:
 *   1) Mevcut dosyanın satır sonu biçimi KORUNUR (Windows'ta CRLF, CI'da LF)
 *      — çıktı platforma göre değil, dosyanın kendi biçimine göre yazılır.
 *   2) İçerik aynıysa dosyaya HİÇ dokunulmaz; mtime bile değişmez.
 */
const CRLF = "\r\n";
const LF = "\n";

function writeGenerated(target: string, content: string): boolean {
  const existing = existsSync(target) ? readFileSync(target, "utf8") : null;
  const eol = existing?.includes(CRLF) ? CRLF : LF;
  const next = content.split(CRLF).join(LF).split(LF).join(eol);
  if (existing === next) return false;
  writeFileSync(target, next, "utf8");
  return true;
}

function writeDomain(
  domain: string,
  file: string,
  nodes: TaxonomyNode[],
): boolean {
  const dir = path.join(OUT, domain);
  mkdirSync(dir, { recursive: true });
  const target = path.join(dir, file);
  const changed = writeGenerated(
    target,
    JSON.stringify({ domain, version: "1.0.0", nodes }, null, 2) + "\n",
  );
  console.log(
    `${changed ? "Wrote" : "Unchanged"} ${target} (${nodes.length} nodes)`,
  );
  return changed;
}

function catRoot(categoryId: string, label: string): TaxonomyNode {
  return nodeOf({
    id: `tax:${categoryId}`,
    parentId: null,
    canonicalName: label,
    aliases: [],
    nodeType: "CATEGORY",
    categoryId,
    depth: 0,
    applicableCapabilities: capsFor(categoryId, "CATEGORY"),
    requestSchemaId: categoryId,
    provenance: { source: "REQUEST_CATEGORIES" },
  });
}

function subNode(categoryId: string, label: string): TaxonomyNode {
  const slug = subcategorySlug(label);
  return nodeOf({
    id: `tax:${categoryId}:${slug}`,
    parentId: `tax:${categoryId}`,
    canonicalName: label,
    aliases: [],
    nodeType: "SUBCATEGORY",
    categoryId,
    subcategoryId: slug,
    depth: 1,
    applicableCapabilities: capsFor(categoryId, "SUBCATEGORY"),
    requestSchemaId: `${categoryId}/${slug}`,
    provenance: { source: "REQUEST_CATEGORIES" },
  });
}

// ─── Domain trees ───────────────────────────────────────────────

function printingTree(): TaxonomyNode[] {
  const cat = REQUEST_CATEGORIES.find((c) => c.id === "printing")!;
  const nodes: TaxonomyNode[] = [catRoot(cat.id, cat.label)];
  const trees: Record<string, ChildSpec[]> = {
    "Karton Kutu": [
      {
        name: "Kutu tipleri",
        children: [
          { name: "Mikro oluklu kutu", aliases: ["mikro oluk", "E-flute kutu"] },
          { name: "Tek oluklu kutu", aliases: ["tek oluk", "B-flute"] },
          { name: "Çift oluklu kutu", aliases: ["çift oluk", "BC flute"] },
          { name: "Üç oluklu kutu", aliases: ["triple wall"] },
          { name: "Kilitli taban kutu", aliases: ["auto bottom", "otomatik taban"] },
          { name: "Teleskopik kutu", aliases: ["kapaklı kutu", "telescope box"] },
          { name: "Pizza kutusu", aliases: ["pizza box"] },
          { name: "Şekerleme kutusu", aliases: ["bonbon kutusu"] },
          { name: "Parfüm kutusu", aliases: ["kozmetik kutusu"] },
          { name: "E-ticaret kolisi", aliases: ["mailer box", "kargo kolisi"] },
          { name: "Display / stand kutu", aliases: ["teşhir kutusu"] },
          { name: "Separatörlü kutu", aliases: ["bölmeli kutu"] },
        ],
      },
      {
        name: "Malzeme",
        type: "GROUP",
        children: [
          { name: "Kraft karton", type: "COMMODITY_TYPE", aliases: ["kraft"] },
          { name: "Beyaz kuşe", type: "COMMODITY_TYPE", aliases: ["kuşe karton"] },
          { name: "Duplex karton", type: "COMMODITY_TYPE" },
          { name: "Greyboard", type: "COMMODITY_TYPE", aliases: ["gri mukavva"] },
        ],
      },
      {
        name: "Finishing",
        children: [
          { name: "Mat selefon", type: "TECHNICAL_TYPE" },
          { name: "Parlak selefon", type: "TECHNICAL_TYPE" },
          { name: "Soft touch", type: "TECHNICAL_TYPE" },
          { name: "UV lak", type: "TECHNICAL_TYPE" },
          { name: "Gofre / kabartma", type: "TECHNICAL_TYPE", aliases: ["emboss"] },
          { name: "Yaldız / folyo", type: "TECHNICAL_TYPE", aliases: ["hotfoil"] },
        ],
      },
    ],
    "Etiket Baskı": [
      {
        name: "Etiket tipleri",
        children: [
          { name: "Rulo etiket", aliases: ["roll label"] },
          { name: "Yaprak etiket", aliases: ["sheet label"] },
          { name: "Şeffaf etiket", aliases: ["clear label"] },
          { name: "Barkod etiketi", aliases: ["barcode label"] },
          { name: "Gıda etiketi", aliases: ["food label"] },
          { name: "İlaç etiketi", aliases: ["pharma label"] },
          { name: "Tekstil etiket / care label", aliases: ["yıkama etiketi"] },
          { name: "Güvenlik / hologram etiket", aliases: ["tamper evident"] },
          { name: "Termal etiket", aliases: ["direct thermal"] },
          { name: "Transfer termal etiket", aliases: ["thermal transfer"] },
        ],
      },
      {
        name: "Malzeme",
        children: [
          { name: "PP etiket", type: "COMMODITY_TYPE" },
          { name: "PE etiket", type: "COMMODITY_TYPE" },
          { name: "Kuşe etiket", type: "COMMODITY_TYPE" },
          { name: "Metalize etiket", type: "COMMODITY_TYPE" },
        ],
      },
    ],
    "Broşür ve Katalog": [
      {
        name: "Ürünler",
        children: [
          { name: "Broşür", aliases: ["flyer", "el ilanı"] },
          { name: "Katalog", aliases: ["ürün kataloğu"] },
          { name: "Kitapçık", aliases: ["booklet"] },
          { name: "Dergi", aliases: ["magazine"] },
          { name: "Kartvizit", aliases: ["business card"] },
          { name: "Antetli kağıt", aliases: ["letterhead"] },
          { name: "Davetiye", aliases: ["invitation"] },
          { name: "Poster / afiş", aliases: ["poster"] },
          { name: "Kapak / klasör", aliases: ["folder"] },
        ],
      },
      {
        name: "Cilt / bitiş",
        children: [
          { name: "Tel dikiş", type: "TECHNICAL_TYPE", aliases: ["staple"] },
          { name: "Amerikan cilt", type: "TECHNICAL_TYPE", aliases: ["perfect bind"] },
          { name: "Spiral cilt", type: "TECHNICAL_TYPE" },
          { name: "Selefonlu kapak", type: "TECHNICAL_TYPE" },
        ],
      },
    ],
    Promosyon: [
      {
        name: "Promosyon ürünleri",
        children: [
          { name: "Kalem baskı", aliases: ["promosyon kalem"] },
          { name: "Kupa / mug baskı", aliases: ["bardak baskı"] },
          { name: "Tişört baskı", aliases: ["textile print"] },
          { name: "Çanta baskı", aliases: ["bez çanta"] },
          { name: "USB / powerbank baskı" },
          { name: "Ajanda / defter baskı" },
          { name: "Şapka / tekstil aksesuar" },
          { name: "Magnet / rozet" },
        ],
      },
    ],
    Diğer: [
      {
        name: "Diğer matbaa işleri",
        children: [
          { name: "Poşet / torba baskı", aliases: ["alışveriş poşeti"] },
          { name: "Streç / shrink etiket", aliases: ["sleeve"] },
          { name: "Karton askı / hang tag" },
          { name: "Numune / prototip baskı" },
          { name: "Büyük format baskı", aliases: ["digital wide format"] },
          {
            name: "Ambalaj sarf malzemesi",
            type: "GROUP",
            children: [
              { name: "Koli bandı", type: "COMMODITY_TYPE" },
              { name: "Streç film", type: "COMMODITY_TYPE" },
              { name: "Balonlu naylon", type: "COMMODITY_TYPE", aliases: ["bubble wrap"] },
              { name: "Köşebent / dolgu", type: "COMMODITY_TYPE" },
            ],
          },
        ],
      },
    ],
  };

  for (const label of cat.subcategories) {
    const sub = subNode(cat.id, label);
    nodes.push(sub);
    expandTree(nodes, sub, trees[label] ?? [{ name: "Genel", children: ["Diğer ürün"] }], "PRODUCT_TYPE");
  }
  return nodes;
}

function furnitureTree(): TaxonomyNode[] {
  const cat = REQUEST_CATEGORIES.find((c) => c.id === "furniture")!;
  const nodes: TaxonomyNode[] = [catRoot(cat.id, cat.label)];
  const trees: Record<string, ChildSpec[]> = {
    // Sahibinden-style Ofis Mobilyaları: grup → ürün tipi
    "Ofis Mobilyaları": [
      {
        name: "Aksesuar",
        aliases: ["ofis aksesuar"],
        children: [
          { name: "Askılık" },
          { name: "Ayaklı Küllük", aliases: ["küllük"] },
          { name: "Çöp Kutusu", aliases: ["cop kutusu"] },
          { name: "Dilsiz Uşak", aliases: ["dilsiz usak"] },
          { name: "Paspas" },
          { name: "Diğer Ürünler", aliases: ["diğer", "diger"] },
        ],
      },
      {
        name: "Dolaplar",
        aliases: ["ofis dolabı", "ofis dolabi"],
        children: [
          { name: "Anahtar Dolabı" },
          { name: "Dosya Dolabı", aliases: ["dosya dolabi"] },
          { name: "Ecza Dolabı" },
          { name: "Emanet Dolabı", aliases: ["emanet dolabi", "locker"] },
          { name: "Kartoteks" },
          { name: "Keson", aliases: ["keson dolap"] },
          { name: "Kütüphane", aliases: ["kitaplik", "kitaplık"] },
          { name: "Raf", aliases: ["raf sistemi"] },
          { name: "Soyunma Dolabı", aliases: ["soyunma dolabi"] },
          { name: "Vitrin" },
        ],
      },
      {
        name: "Masalar",
        aliases: ["ofis masası", "ofis masasi"],
        children: [
          { name: "Çalışma Masası", aliases: ["calisma masasi", "desk"] },
          { name: "Çoklu Çalışma Masası", aliases: ["çoklu masa", "bench"] },
          { name: "Toplantı Masası", aliases: ["toplantı masasi"] },
          { name: "Bilgisayar Masası" },
          { name: "Sehpa" },
          { name: "Banko", aliases: ["resepsiyon bankosu"] },
          { name: "Çizim Masası", aliases: ["çizim masasi"] },
        ],
      },
      {
        name: "Oturma Grubu",
        aliases: ["ofis oturma", "ofis koltuk"],
        children: [
          { name: "Bekleme Koltuğu", aliases: ["bekleme koltugu", "waiting chair"] },
          { name: "Kolçaklı Sandalye", aliases: ["kolcakli sandalye"] },
          { name: "Ofis Koltuk Takımı", aliases: ["ofis koltuk takimi"] },
          {
            name: "Personel & Ofis Koltuğu",
            aliases: ["personel koltuğu", "ofis koltuğu", "task chair"],
          },
          { name: "Puf" },
          { name: "Sandalye" },
          { name: "Sedir" },
          { name: "Tabure" },
          {
            name: "Yönetici Koltuğu",
            aliases: ["yonetici koltugu", "makam koltuğu", "executive chair"],
          },
        ],
      },
      {
        name: "Makam Oda Takımı",
        aliases: ["makam takımı", "yönetici oda takımı"],
        children: [
          { name: "Makam Oda Takımı", aliases: ["makam takımı"] },
        ],
      },
    ],
    "Ofis Sandalyesi": [
      {
        name: "Sandalye tipleri",
        children: [
          { name: "Yönetici koltuğu", aliases: ["makam koltuğu", "executive chair"] },
          { name: "Operasyon koltuğu", aliases: ["çalışma koltuğu", "task chair"] },
          { name: "Misafir koltuğu", aliases: ["visitor chair"] },
          { name: "Konferans koltuğu", aliases: ["toplantı sandalyesi"] },
          { name: "24 saat koltuk", aliases: ["heavy duty chair"] },
          { name: "Ergonomik mesh koltuk", aliases: ["fileli koltuk"] },
          { name: "Tabure / drafting chair", aliases: ["yüksek sandalye"] },
        ],
      },
      {
        name: "Mekanizma / özellik",
        children: [
          { name: "Senkron mekanizma", type: "TECHNICAL_TYPE" },
          { name: "Multiblok mekanizma", type: "TECHNICAL_TYPE" },
          { name: "Bel desteği", type: "TECHNICAL_TYPE", aliases: ["lumbar"] },
          { name: "Kolçak tipi", type: "TECHNICAL_TYPE" },
        ],
      },
    ],
    "Çalışma / Ofis Masası": [
      {
        name: "Masa tipleri",
        children: [
          { name: "Çalışma masası", aliases: ["desk"] },
          { name: "L masa", aliases: ["köşe masa"] },
          { name: "Yönetici masası", aliases: ["makam masası"] },
          { name: "Yükseklik ayarlı masa", aliases: ["sit-stand", "elektrikli masa"] },
          { name: "Workstation / bench", aliases: ["ortak çalışma masası"] },
          { name: "Resepsiyon bankosu", aliases: ["karşılama bankosu"] },
        ],
      },
    ],
    "Toplantı Masası": [
      {
        name: "Toplantı ürünleri",
        children: [
          { name: "Dikdörtgen toplantı masası" },
          { name: "Oval toplantı masası" },
          { name: "Yuvarlak toplantı masası" },
          { name: "Modüler toplantı masası" },
          { name: "Eğitim sırası / seminar table" },
          { name: "Toplantı sandalyesi seti" },
        ],
      },
    ],
    // Sahibinden-style Ev Mobilyası: oda → ürün tipi (Ofis Mobilyası ayrı gelecek)
    "Ev Mobilyası": [
      {
        name: "Oturma Odası & Salon",
        aliases: ["oturma odası", "salon", "oturma grubu"],
        children: [
          { name: "Berjer, Tekli Koltuk", aliases: ["berjer", "tekli koltuk"] },
          { name: "Çekyat, Kanepe", aliases: ["çekyat", "kanepe", "kanepe takımı"] },
          { name: "Josefin", aliases: ["josefin", "chaise"] },
          { name: "Koltuk Takımı", aliases: ["koltuk takımı", "kanepe takımı"] },
          { name: "Köşe Koltuk Takımı", aliases: ["köşe koltuk", "L koltuk"] },
          { name: "Salon Takımı", aliases: ["salon takımı"] },
          { name: "TV Koltuğu", aliases: ["tv koltuğu"] },
          { name: "TV Ünitesi", aliases: ["tv ünitesi", "tv unitesi"] },
        ],
      },
      {
        name: "Mutfak",
        aliases: ["mutfak mobilyası"],
        children: [
          { name: "Masa Takımı", aliases: ["mutfak masa takımı"] },
          { name: "Mutfak Masası" },
          { name: "Sandalye", aliases: ["mutfak sandalyesi"] },
          { name: "Tabure" },
          { name: "Mutfak Dolabı" },
          { name: "Hazır Mutfak", aliases: ["hazır mutfak", "mutfak dolabı takımı"] },
          { name: "Erzak Dolabı" },
          { name: "Kiler Dolabı" },
          { name: "Ekmek Dolabı" },
          { name: "Fırın Dolabı" },
          { name: "Kahve Köşesi" },
          { name: "Raf & Terek", aliases: ["raf", "terek"] },
          { name: "Köşe Takımı", aliases: ["mutfak köşe takımı"] },
          { name: "Servis Arabası" },
          { name: "Yer Sofrası" },
        ],
      },
      {
        name: "Yemek Odası",
        aliases: ["yemek odası"],
        children: [
          { name: "Büfe & Vitrin", aliases: ["büfe", "vitrin"] },
          { name: "Gümüşlük" },
          { name: "Konsol" },
          { name: "Masa", aliases: ["yemek masası"] },
          { name: "Sandalye", aliases: ["yemek sandalyesi"] },
          { name: "Şaraplık" },
          { name: "Yemek Odası Takımı", aliases: ["yemek odası takımı"] },
        ],
      },
      {
        name: "Yatak Odası",
        aliases: ["yatak odası"],
        children: [
          { name: "Yatak Odası Takımı", aliases: ["yatak odası takımı"] },
          { name: "Baza" },
          { name: "Yatak", aliases: ["yatak / baza"] },
          { name: "Karyola" },
          { name: "Gardırop", aliases: ["gardrop", "dolap", "gardırop"] },
          { name: "Şifonyer" },
          { name: "Komodin" },
          { name: "Makyaj Masası", aliases: ["makyaj masası", "toiret"] },
          { name: "Etajer" },
        ],
      },
      {
        name: "Çocuk & Genç Odası",
        aliases: ["çocuk odası", "genç odası", "cocuk odasi"],
        children: [
          { name: "Arabalı Yatak" },
          { name: "Bilgisayar Masası" },
          { name: "Çalışma Masası", aliases: ["calisma masasi"] },
          { name: "Dolap" },
          { name: "Karyola & Yatak", aliases: ["karyola", "yatak"] },
          { name: "Kitaplık", aliases: ["kitaplik"] },
          { name: "Koltuk" },
          { name: "Komodin" },
          { name: "Ranza" },
          { name: "Sandalye" },
          { name: "Şifonyer" },
          { name: "Çocuk Odası Takımı", aliases: ["çocuk odası takımı"] },
          { name: "Genç Odası Takımı", aliases: ["genç odası takımı"] },
        ],
      },
      {
        name: "Tamamlayıcı Ürünler",
        aliases: ["tamamlayıcı", "antre"],
        children: [
          { name: "Antre", aliases: ["antre mobilyası", "vestiyer"] },
          { name: "Oturma Odası & Salon", aliases: ["tamamlayıcı oturma"] },
          { name: "Yatak Odası", aliases: ["tamamlayıcı yatak odası"] },
        ],
      },
    ],
    "Kafe ve Restoran": [
      {
        name: "HORECA mobilya",
        children: [
          { name: "Kafe sandalyesi", aliases: ["bistro sandalye"] },
          { name: "Kafe masası" },
          { name: "Bar taburesi" },
          { name: "Lokanta oturma grubu" },
          { name: "Dış mekan mobilyası", aliases: ["teras mobilyası"] },
          { name: "Banka / lounge oturma" },
        ],
      },
    ],
    "Özel Üretim": [
      {
        name: "Özel işler",
        children: [
          { name: "Ölçüye özel masa", aliases: ["custom desk"] },
          { name: "Özel kaplama / lake" },
          { name: "Proje bazlı ofis mobilyası" },
          { name: "Ahşap tornacı / marangoz işi" },
        ],
      },
    ],
    Diğer: [
      {
        name: "Diğer mobilya",
        children: [
          { name: "Dolap / arşiv dolabı", aliases: ["metal dolap"] },
          { name: "Raf sistemi", aliases: ["shelving"] },
          { name: "Bekleme koltuğu", aliases: ["waiting chair"] },
          { name: "Çocuk mobilyası" },
          { name: "Bahçe mobilyası" },
        ],
      },
    ],
  };

  for (const label of cat.subcategories) {
    const sub = subNode(cat.id, label);
    nodes.push(sub);
    expandTree(nodes, sub, trees[label]!, "PRODUCT_TYPE");
  }
  return nodes;
}

function appliancesTree(): TaxonomyNode[] {
  const cat = REQUEST_CATEGORIES.find((c) => c.id === "appliances")!;
  const nodes: TaxonomyNode[] = [catRoot(cat.id, cat.label)];
  // Sahibinden-style: Küçük Ev Aletleri | Beyaz Eşya | Isıtma/Soğutma → ürün (flat)
  const trees: Record<string, ChildSpec[]> = {
    "Küçük Ev Aletleri": [
      { name: "Baskül & Tartı", aliases: ["baskül", "tartı"] },
      { name: "Blender" },
      { name: "Buharlı Pişirici" },
      { name: "Buharlı Temizlik Makinesi" },
      { name: "Buz Makinesi" },
      { name: "Cam Silme Makinesi" },
      { name: "Çay Makinesi" },
      { name: "Dikey & Şarjlı Süpürge", aliases: ["dikey süpürge", "şarjlı süpürge"] },
      { name: "Dikiş Makinesi" },
      { name: "Ekmek Kızartma Makinesi", aliases: ["tost makinesi ekmek", "toaster"] },
      { name: "Ekmek Yapma Makinesi" },
      { name: "Elektrikli Izgara" },
      { name: "Elektrikli Süpürge", aliases: ["süpürge", "supurge", "vacuum"] },
      { name: "Fritöz & Airfryer", aliases: ["airfryer", "fritöz"] },
      { name: "Halı Yıkama Makinesi" },
      { name: "Kahve Makinesi", aliases: ["kahve"] },
      { name: "Katı Meyve Sıkacağı", aliases: ["blender juicer", "juicer"] },
      { name: "Kıyma Makinesi" },
      { name: "Mikser" },
      { name: "Mutfak Robotu" },
      { name: "Robot Süpürge", aliases: ["robot süpürge", "roborock"] },
      { name: "Rondo", aliases: ["doğrayıcı"] },
      { name: "Su Isıtıcı", aliases: ["kettle", "kettle su"] },
      { name: "Tost Makinesi", aliases: ["tost"] },
      { name: "Ütü", aliases: ["utu"] },
      { name: "Ütü Masası" },
      { name: "Waffle Makinesi" },
      { name: "Yoğurt Makinesi" },
      { name: "Yedek Parça & Ekipman", aliases: ["yedek parça"] },
    ],
    "Beyaz Eşya": [
      { name: "Ankastre Set", aliases: ["ankastre"] },
      { name: "Aspiratör & Davlumbaz", aliases: ["davlumbaz", "aspiratör"] },
      { name: "Bulaşık Makinesi", aliases: ["bulaşık", "bulasik makinesi"] },
      { name: "Buzdolabı", aliases: ["buzdolabi", "fridge"] },
      { name: "Çamaşır Makinesi", aliases: ["çamaşır", "camasir makinesi"] },
      {
        name: "Çamaşır Kurutma Makinesi",
        aliases: ["kurutma makinesi", "dryer"],
      },
      { name: "Derin Dondurucu", aliases: ["dondurucu", "freezer"] },
      { name: "Fırın", aliases: ["firin", "ankastre fırın"] },
      { name: "Mikrodalga Fırın", aliases: ["mikrodalga", "microwave"] },
      { name: "Set Üstü Ocak", aliases: ["ocak", "set üstü"] },
      { name: "Su Arıtma Cihazı", aliases: ["su arıtma"] },
      { name: "Su Sebili", aliases: ["sebili"] },
      {
        name: "Şarap Dolabı",
        aliases: ["şarap dolabı", "sarap dolabi", "wine cooler"],
        // "şaraplık" stays furniture Ev Mobilyası leaf
        ambiguousAliases: ["şaraplık"],
      },
      { name: "Yedek Parça & Ekipman" },
      { name: "Toplu Satış" },
    ],
    "Isıtma, Soğutma ve Havalandırma": [
      { name: "Klima", aliases: ["split klima", "air conditioner"] },
      { name: "Kombi" },
      { name: "Kat Kaloriferi" },
      { name: "Şofben & Termosifon", aliases: ["şofben", "termosifon"] },
      { name: "Vantilatör", aliases: ["fan"] },
      { name: "Tavan Pervanesi" },
      { name: "Hava Soğutucu" },
      { name: "Havalandırma Fanı" },
      { name: "Hava Temizleme Cihazı", aliases: ["hava temizleyici"] },
      { name: "Elektrikli Isıtıcı" },
      { name: "Elektrikli Şömine" },
      { name: "Fanlı Isıtıcı" },
      { name: "Yağlı Radyatör" },
      { name: "Doğalgaz Sobası" },
      { name: "Isı Pompası" },
      { name: "Nem Alma Cihazı", aliases: ["nem alma"] },
      { name: "Yedek Parça & Ekipman" },
      { name: "Toplu Satış" },
    ],
    Diğer: [{ name: "Diğer elektrikli ev aleti" }],
  };

  for (const label of cat.subcategories) {
    const sub = subNode(cat.id, label);
    nodes.push(sub);
    expandTree(nodes, sub, trees[label]!, leafTypeFor(cat.id, subcategorySlug(label)));
  }
  return nodes;
}

function technologyTree(): TaxonomyNode[] {
  const cat = REQUEST_CATEGORIES.find((c) => c.id === "technology")!;
  const nodes: TaxonomyNode[] = [catRoot(cat.id, cat.label)];
  const trees: Record<string, ChildSpec[]> = {
    "Yazılım Geliştirme": [
      {
        name: "Yazılım hizmetleri",
        children: [
          { name: "Özel yazılım geliştirme", type: "SERVICE_TYPE", aliases: ["custom software"] },
          { name: "Mobil uygulama", type: "SERVICE_TYPE", aliases: ["iOS", "Android app"] },
          { name: "ERP / CRM uyarlama", type: "SERVICE_TYPE" },
          { name: "API / entegrasyon", type: "SERVICE_TYPE" },
          { name: "Bakım / destek sözleşmesi", type: "SERVICE_TYPE" },
          { name: "Yazılım danışmanlığı", type: "SERVICE_TYPE" },
        ],
      },
    ],
    "Web Sitesi": [
      {
        name: "Web hizmetleri",
        children: [
          { name: "Kurumsal web sitesi", type: "SERVICE_TYPE" },
          { name: "E-ticaret sitesi", type: "SERVICE_TYPE", aliases: ["online mağaza"] },
          { name: "Landing page", type: "SERVICE_TYPE" },
          { name: "CMS / WordPress", type: "SERVICE_TYPE" },
          { name: "SEO / performans iyileştirme", type: "SERVICE_TYPE" },
          { name: "Hosting / domain kurulumu", type: "SERVICE_TYPE" },
        ],
      },
    ],
    Donanım: [
      {
        name: "Cep Telefonu & Aksesuar",
        children: [
          {
            name: "Cep Telefonu",
            aliases: [
              "telefon",
              "cep telefonu",
              "akıllı telefon",
              "akilli telefon",
              "smartphone",
            ],
          },
          { name: "Tablet", aliases: ["ipad"] },
          { name: "Akıllı saat", aliases: ["smartwatch", "giyilebilir"] },
          { name: "Kulaklık / TWS", aliases: ["kulaklık"] },
        ],
      },
      {
        name: "Bilgisayar",
        children: [
          {
            name: "Dizüstü bilgisayar",
            aliases: ["laptop", "notebook", "dizüstü", "dizustu"],
          },
          { name: "Masaüstü bilgisayar", aliases: ["PC", "desktop"] },
          { name: "İş istasyonu", aliases: ["workstation"] },
          { name: "Mini PC", aliases: ["NUC"] },
          { name: "Monitör", aliases: ["ekran"] },
        ],
      },
      {
        name: "TV ve görüntü",
        children: [
          { name: "Televizyon", aliases: ["TV", "smart tv", "televizyon"] },
          { name: "Projeksiyon cihazı", aliases: ["projeksiyon"] },
          { name: "Medya oynatıcı", aliases: ["streaming box"] },
        ],
      },
      {
        name: "Çevre birimleri",
        children: [
          { name: "Yazıcı", aliases: ["printer"] },
          { name: "Tarayıcı", aliases: ["scanner"] },
          { name: "Klavye / mouse seti" },
          { name: "UPS", aliases: ["kesintisiz güç"] },
          { name: "NAS / depolama", aliases: ["network storage"] },
        ],
      },
    ],
    "Sistem ve Altyapı": [
      {
        name: "Altyapı",
        children: [
          { name: "Sunucu", aliases: ["server"] },
          { name: "Switch / network", aliases: ["ağ switch"] },
          { name: "Firewall / güvenlik", aliases: ["güvenlik duvarı"] },
          { name: "Kablolama / rack", aliases: ["structured cabling"] },
          { name: "Wi-Fi access point", aliases: ["kablosuz erişim noktası"] },
          { name: "Kamera / CCTV sistemi", aliases: ["güvenlik kamerası"] },
        ],
      },
    ],
    Diğer: [
      {
        name: "Diğer teknoloji",
        children: [
          { name: "Oyun konsolu", aliases: ["playstation", "xbox"] },
          { name: "Drone" },
          { name: "POS / yazar kasa", aliases: ["ödeme terminali"] },
          { name: "Barkod okuyucu" },
        ],
      },
    ],
  };

  for (const label of cat.subcategories) {
    const sub = subNode(cat.id, label);
    nodes.push(sub);
    expandTree(nodes, sub, trees[label]!, leafTypeFor(cat.id, subcategorySlug(label)));
  }
  return nodes;
}

function machineryTree(): TaxonomyNode[] {
  const cat = REQUEST_CATEGORIES.find((c) => c.id === "machinery")!;
  const nodes: TaxonomyNode[] = [catRoot(cat.id, cat.label)];
  const trees: Record<string, ChildSpec[]> = {
    "Üretim Makinesi": [
      {
        name: "Talaşlı imalat",
        children: [
          { name: "CNC torna", aliases: ["cnc lathe"] },
          { name: "CNC freze", aliases: ["cnc milling", "vmc"] },
          { name: "İşleme merkezi", aliases: ["machining center"] },
          { name: "Universal torna" },
          { name: "Freze tezgahı" },
          { name: "Taşlama tezgahı", aliases: ["grinder"] },
          { name: "EDM / dalma erozyon", aliases: ["elektroerozyon"] },
        ],
      },
      {
        name: "Pres ve şekillendirme",
        children: [
          { name: "Eksantrik pres", aliases: ["mekanik pres"] },
          { name: "Hidrolik pres", aliases: ["hydraulic press"] },
          { name: "Abkant pres", aliases: ["press brake"] },
          { name: "Giyotin makas", aliases: ["shear"] },
          { name: "Rulo açıcı / straightener" },
          { name: "Punç / punch press" },
        ],
      },
      {
        name: "Enjeksiyon / plastik",
        children: [
          { name: "Plastik enjeksiyon makinesi", aliases: ["injection molding"] },
          { name: "Şişirme makinesi", aliases: ["blow molding"] },
          { name: "Ekstruder", aliases: ["extrusion"] },
        ],
      },
      {
        name: "Kaynak ve birleştirme",
        children: [
          { name: "MIG/MAG kaynak makinesi", aliases: ["gazaltı"] },
          { name: "TIG kaynak makinesi" },
          { name: "Robot kaynak hücresi" },
          { name: "Spot kaynak", aliases: ["nokta kaynak"] },
        ],
      },
      {
        name: "Hava ve akışkan",
        children: [
          { name: "Hava kompresörü", aliases: ["compressor"] },
          { name: "Vidalı kompresör", aliases: ["screw compressor"] },
          { name: "Vakum pompası" },
          { name: "Endüstriyel chiller", aliases: ["soğutma grubu"] },
        ],
      },
      {
        name: "Taşıma",
        children: [
          { name: "Forklift", aliases: ["istif makinesi"] },
          { name: "Reach truck" },
          { name: "Transpalet", aliases: ["elektrikli transpalet"] },
          { name: "Vinç / monoray", aliases: ["crane"] },
          { name: "Konveyör hattı", aliases: ["conveyor"] },
        ],
      },
    ],
    "Kesim Makinesi": [
      {
        name: "Kesim teknolojileri",
        children: [
          { name: "Lazer kesim", aliases: ["fiber lazer", "laser cutter"] },
          { name: "Plazma kesim", aliases: ["plasma"] },
          { name: "Oksijen kesim", aliases: ["oxy-fuel"] },
          { name: "Su jeti kesim", aliases: ["waterjet"] },
          { name: "Giyotin kesim" },
          { name: "Şerit testere", aliases: ["band saw"] },
          { name: "Disk testere", aliases: ["circular saw"] },
          { name: "CNC router / ahşap kesim" },
        ],
      },
    ],
    "Paketleme Makinesi": [
      {
        name: "Paketleme",
        children: [
          { name: "Shrink paketleme", aliases: ["shrink tunnel"] },
          { name: "Flowpack", aliases: ["yatay paketleme"] },
          { name: "Dikey form-fill-seal", aliases: ["vffs"] },
          { name: "Karton doldurma", aliases: ["cartoner"] },
          { name: "Palet streç makinesi", aliases: ["pallet wrapper"] },
          { name: "Etiketleme makinesi", aliases: ["labeler"] },
          { name: "Dozaj / dolum makinesi", aliases: ["filler"] },
          { name: "Kapak kapama", aliases: ["capper"] },
        ],
      },
    ],
    "Yedek Parça": [
      {
        name: "Makine yedek parçaları",
        children: [
          { name: "Rulman", type: "PART_TYPE", aliases: ["bearing"] },
          { name: "Kayış / zincir", type: "PART_TYPE" },
          { name: "Redüktör", type: "PART_TYPE", aliases: ["gearbox"] },
          { name: "Servo motor", type: "PART_TYPE" },
          { name: "Sürücü / inverter", type: "PART_TYPE", aliases: ["vfd"] },
          { name: "Hidrolik pompa", type: "PART_TYPE" },
          { name: "Pneumatik valf", type: "PART_TYPE" },
          { name: "Kesici takım / insert", type: "PART_TYPE", aliases: ["carbide insert"] },
          { name: "Conta / conta seti", type: "PART_TYPE" },
          { name: "PLC / IO modülü", type: "PART_TYPE" },
        ],
      },
    ],
    "İkinci El Makine": [
      {
        name: "İkinci el gruplar",
        children: [
          { name: "2. el CNC", aliases: ["used cnc"] },
          { name: "2. el pres" },
          { name: "2. el forklift" },
          { name: "2. el paketleme hattı" },
          { name: "2. el kompresör" },
        ],
      },
    ],
    Diğer: [
      {
        name: "Diğer makineler",
        children: [
          { name: "Tekstil makinesi" },
          { name: "Gıda işleme makinesi" },
          { name: "Tarım makinesi" },
          { name: "İnşaat makinesi", aliases: ["ekskavatör", "loader"] },
          { name: "Jeneratör", aliases: ["generator"] },
        ],
      },
    ],
  };

  for (const label of cat.subcategories) {
    const sub = subNode(cat.id, label);
    nodes.push(sub);
    expandTree(nodes, sub, trees[label]!, leafTypeFor(cat.id, subcategorySlug(label)));
  }
  return nodes;
}

function homeKitchenTree(): TaxonomyNode[] {
  const cat = REQUEST_CATEGORIES.find((c) => c.id === "home-kitchen")!;
  const nodes: TaxonomyNode[] = [catRoot(cat.id, cat.label)];
  const trees: Record<string, ChildSpec[]> = {
    "Yemek Takımı": [
      {
        name: "Yemek takımları",
        children: [
          { name: "Porselen yemek takımı", aliases: ["yemek seti"] },
          { name: "Bone china yemek takımı" },
          { name: "Günlük servis takımı" },
          { name: "Kayık tabak / sunum seti" },
          { name: "Kase / çorba seti" },
        ],
      },
    ],
    "Kahve / Çay Seti": [
      {
        name: "Kahve ve çay",
        children: [
          { name: "Kahve fincan takımı", aliases: ["turkish coffee set"] },
          { name: "Çay seti", aliases: ["çay bardak takımı"] },
          { name: "French press" },
          { name: "Chemex / pour over set" },
          { name: "Espresso fincan seti" },
          { name: "Termos / sürahi seti" },
        ],
      },
    ],
    "Çatal Bıçak": [
      {
        name: "Çatal bıçak",
        children: [
          { name: "Çatal bıçak takımı", aliases: ["cutlery set"] },
          { name: "Servis takımı" },
          { name: "Bıçak seti", aliases: ["mutfak bıçağı"] },
          { name: "Steak knife seti" },
          { name: "Kaşık seti" },
        ],
      },
    ],
    "Cam / Porselen": [
      {
        name: "Cam ve porselen",
        children: [
          { name: "Bardak seti", aliases: ["su bardağı"] },
          { name: "Kadeh seti", aliases: ["şarap kadehi"] },
          { name: "Saklama kabı", aliases: ["cam kap"] },
          { name: "Fırın kabı / borcam", aliases: ["oven dish"] },
          { name: "Dekoratif vazo" },
        ],
      },
    ],
    Diğer: [
      {
        name: "Mutfak gereçleri",
        children: [
          { name: "Tencere seti", aliases: ["cookware"] },
          { name: "Tava", aliases: ["kızartma tavası"] },
          { name: "Mutfak robotu aksesuarı" },
          { name: "Saklama / düzenleyici" },
        ],
      },
      {
        name: "Mutfak ve banyo armatür / lavabo",
        // No dedicated kitchen-bath root in REQUEST_CATEGORIES — mapped here.
        children: [
          {
            name: "Eviye / lavabo",
            aliases: ["eviye", "sink", "mutfak eviyesi", "lavabo"],
          },
          {
            name: "Batarya / musluk",
            aliases: ["batarya", "musluk", "faucet", "armatür"],
          },
          { name: "Duş bataryası", aliases: ["shower mixer"] },
          { name: "Klozet", aliases: ["toilet"] },
          { name: "Lavabo dolabı", aliases: ["banyo dolabı"] },
          { name: "Duşakabin", aliases: ["shower cabin"] },
          { name: "Ankastre eviye seti" },
        ],
      },
    ],
  };

  for (const label of cat.subcategories) {
    const sub = subNode(cat.id, label);
    nodes.push(sub);
    expandTree(nodes, sub, trees[label]!, "PRODUCT_TYPE");
  }
  return nodes;
}

function realEstateTree(): TaxonomyNode[] {
  const cat = REQUEST_CATEGORIES.find((c) => c.id === "real-estate")!;
  const nodes: TaxonomyNode[] = [catRoot(cat.id, cat.label)];
  const trees: Record<string, ChildSpec[]> = {
    "Kiralık Konut": [
      {
        name: "Konut tipleri",
        children: [
          { name: "Daire", aliases: ["apartment", "ev"] },
          { name: "Rezidans" },
          { name: "Müstakil Ev", aliases: ["müstakil"] },
          { name: "Villa" },
          { name: "Çiftlik Evi" },
          { name: "Köşk & Konak", aliases: ["köşk", "konak"] },
          { name: "Yalı" },
          { name: "Yalı Dairesi" },
        ],
      },
    ],
    "Satılık Konut": [
      {
        name: "Konut tipleri",
        children: [
          { name: "Daire", aliases: ["apartment", "ev", "satılık daire"] },
          { name: "Rezidans" },
          { name: "Müstakil Ev", aliases: ["müstakil", "satılık müstakil ev"] },
          { name: "Villa", aliases: ["satılık villa"] },
          { name: "Çiftlik Evi" },
          { name: "Köşk & Konak", aliases: ["köşk", "konak"] },
          { name: "Yalı" },
          { name: "Yalı Dairesi" },
        ],
      },
    ],
    "Ticari Gayrimenkul": [
      {
        name: "Ticari tipler",
        children: [
          { name: "Dükkan / mağaza", aliases: ["retail"] },
          { name: "Ofis", aliases: ["işyeri"] },
          { name: "Plaza ofisi" },
          { name: "Depo / antrepo", aliases: ["warehouse"] },
          { name: "Fabrika / imalathane" },
          { name: "AVM ünitesi" },
          { name: "Otel / apart" },
        ],
      },
    ],
    Arsa: [
      {
        name: "Arsa tipleri",
        children: [
          { name: "İmarlı arsa", aliases: ["zoned plot"] },
          { name: "Tarla", aliases: ["agricultural"] },
          { name: "Ticari arsa" },
          { name: "Konut imarlı arsa" },
          { name: "Sanayi arsası" },
        ],
      },
    ],
    Diğer: [
      {
        name: "Diğer emlak",
        children: [
          { name: "Devren işyeri", aliases: ["transfer business"] },
          { name: "Müştemilat" },
          { name: "Kooperatif hissesi" },
          { name: "Turistik tesis" },
        ],
      },
    ],
  };

  for (const label of cat.subcategories) {
    const sub = subNode(cat.id, label);
    nodes.push(sub);
    expandTree(nodes, sub, trees[label]!, "PRODUCT_TYPE");
  }
  return nodes;
}

function servicesTree(): TaxonomyNode[] {
  const cat = REQUEST_CATEGORIES.find((c) => c.id === "services")!;
  const nodes: TaxonomyNode[] = [catRoot(cat.id, cat.label)];
  const trees: Record<string, ChildSpec[]> = {
    Danışmanlık: [
      {
        name: "Danışmanlık türleri",
        children: [
          { name: "Yönetim danışmanlığı", type: "SERVICE_TYPE" },
          { name: "Mali müşavirlik / muhasebe", type: "SERVICE_TYPE", aliases: ["muhasebe"] },
          { name: "İK danışmanlığı", type: "SERVICE_TYPE", aliases: ["human resources"] },
          { name: "Hukuk danışmanlığı", type: "SERVICE_TYPE" },
          { name: "ISO / kalite danışmanlığı", type: "SERVICE_TYPE" },
          { name: "Pazarlama danışmanlığı", type: "SERVICE_TYPE" },
          { name: "İhracat danışmanlığı", type: "SERVICE_TYPE" },
        ],
      },
    ],
    "Bakım ve Onarım": [
      {
        name: "Bakım hizmetleri",
        children: [
          { name: "Kombi bakım", type: "SERVICE_TYPE" },
          { name: "Klima bakım / gaz dolumu", type: "SERVICE_TYPE" },
          { name: "Beyaz eşya tamiri", type: "SERVICE_TYPE" },
          { name: "Elektrik tesisat", type: "SERVICE_TYPE" },
          { name: "Su tesisat", type: "SERVICE_TYPE", aliases: ["plumbing"] },
          { name: "Asansör bakım", type: "SERVICE_TYPE" },
          { name: "Jeneratör bakım", type: "SERVICE_TYPE" },
          { name: "Endüstriyel makine bakım", type: "SERVICE_TYPE" },
        ],
      },
    ],
    Temizlik: [
      {
        name: "Temizlik hizmetleri",
        children: [
          { name: "Ofis temizliği", type: "SERVICE_TYPE" },
          { name: "İnşaat sonu temizlik", type: "SERVICE_TYPE" },
          { name: "Apartman / site temizliği", type: "SERVICE_TYPE" },
          { name: "Cam temizliği", type: "SERVICE_TYPE" },
          { name: "Dezenfeksiyon", type: "SERVICE_TYPE" },
          { name: "Halı / koltuk yıkama", type: "SERVICE_TYPE" },
        ],
      },
    ],
    Nakliye: [
      {
        name: "Nakliye hizmetleri",
        children: [
          { name: "Evden eve nakliyat", type: "SERVICE_TYPE", aliases: ["asansörlü taşıma"] },
          { name: "Ofis taşıma", type: "SERVICE_TYPE" },
          { name: "Parsiyel yük", type: "SERVICE_TYPE", aliases: ["LTL"] },
          { name: "Komple yük / FTL", type: "SERVICE_TYPE" },
          { name: "Şehirlerarası nakliye", type: "SERVICE_TYPE" },
          { name: "Uluslararası lojistik", type: "SERVICE_TYPE" },
          { name: "Depolama / antrepo hizmeti", type: "SERVICE_TYPE" },
        ],
      },
    ],
    Diğer: [
      {
        name: "Diğer hizmetler",
        children: [
          { name: "Organizasyon / event", type: "SERVICE_TYPE" },
          { name: "Güvenlik hizmeti", type: "SERVICE_TYPE" },
          { name: "Çeviri / tercüme", type: "SERVICE_TYPE" },
          { name: "Eğitim / kurumsal training", type: "SERVICE_TYPE" },
          { name: "Fotoğraf / video prodüksiyon", type: "SERVICE_TYPE" },
          { name: "Montaj / demontaj", type: "SERVICE_TYPE" },
        ],
      },
    ],
  };

  for (const label of cat.subcategories) {
    const sub = subNode(cat.id, label);
    nodes.push(sub);
    expandTree(nodes, sub, trees[label]!, "SERVICE_TYPE");
  }
  return nodes;
}

function healthTree(): TaxonomyNode[] {
  const cat = REQUEST_CATEGORIES.find((c) => c.id === "health")!;
  const nodes: TaxonomyNode[] = [catRoot(cat.id, cat.label)];
  const trees: Record<string, ChildSpec[]> = {
    "Medikal Cihaz": [
      {
        name: "Cihaz grupları",
        children: [
          { name: "Hasta monitörü", aliases: ["vital monitor"] },
          { name: "Ventilatör", aliases: ["solunum cihazı"] },
          { name: "Defibrilatör", aliases: ["AED"] },
          { name: "Ultrason cihazı", aliases: ["USG"] },
          { name: "EKG cihazı" },
          { name: "İnfüzyon pompası" },
          { name: "Oksijen konsantratörü" },
          { name: "Nebulizatör" },
          { name: "Tansiyon aleti", aliases: ["sphygmomanometer"] },
          { name: "Pulse oksimetre" },
        ],
      },
    ],
    "Sarf Malzeme": [
      {
        name: "Sarf grupları",
        children: [
          { name: "Eldiven", type: "COMMODITY_TYPE", aliases: ["muayene eldiveni", "nitrile glove"] },
          { name: "Maske", type: "COMMODITY_TYPE", aliases: ["cerrahi maske", "N95"] },
          { name: "Enjektör / iğne", type: "COMMODITY_TYPE", aliases: ["syringe"] },
          { name: "Serum seti", type: "COMMODITY_TYPE" },
          { name: "Gazlı bez / pamuk", type: "COMMODITY_TYPE" },
          { name: "Plaster / flaster", type: "COMMODITY_TYPE" },
          { name: "İdrar kabı / numune kabı", type: "COMMODITY_TYPE" },
          { name: "Dezenfektan", type: "COMMODITY_TYPE" },
          { name: "Muayene örtüsü", type: "COMMODITY_TYPE" },
          { name: "Kateter", type: "COMMODITY_TYPE" },
        ],
      },
    ],
    "Klinik Donanım": [
      {
        name: "Klinik",
        children: [
          { name: "Muayene masası" },
          { name: "Hasta yatağı", aliases: ["hospital bed"] },
          { name: "Sedye" },
          { name: "Tıbbi dolap / ecza dolabı" },
          { name: "Aydınlatma / muayene lambası" },
          { name: "Sterilizatör / otoklav", aliases: ["autoclave"] },
        ],
      },
    ],
    "Diş / Laboratuvar": [
      {
        name: "Diş",
        children: [
          { name: "Diş üniti", aliases: ["dental unit"] },
          { name: "Apex locator" },
          { name: "Kavitron / scaler" },
          { name: "Diş hekimi sandalyesi" },
        ],
      },
      {
        name: "Laboratuvar",
        children: [
          { name: "Santrifüj" },
          { name: "Mikroskop" },
          { name: "Analizör", aliases: ["lab analyzer"] },
          { name: "Pipet / lab sarf", type: "COMMODITY_TYPE" },
        ],
      },
    ],
    Diğer: [
      {
        name: "Diğer sağlık",
        children: [
          { name: "Ortopedi ürünleri", aliases: ["walker", "koltuk değneği"] },
          { name: "İşitme cihazı" },
          { name: "Evde bakım cihazı" },
          { name: "Medikal mobilya" },
        ],
      },
    ],
  };

  for (const label of cat.subcategories) {
    const sub = subNode(cat.id, label);
    nodes.push(sub);
    expandTree(nodes, sub, trees[label]!, leafTypeFor(cat.id, subcategorySlug(label)));
  }
  return nodes;
}

function babyTree(): TaxonomyNode[] {
  const cat = REQUEST_CATEGORIES.find((c) => c.id === "baby")!;
  const nodes: TaxonomyNode[] = [catRoot(cat.id, cat.label)];
  const trees: Record<string, ChildSpec[]> = {
    "Bebek Arabası": [
      {
        name: "Araba tipleri",
        children: [
          { name: "Travel sistem bebek arabası", aliases: ["travel system"] },
          { name: "Cep tipi / cabin boy", aliases: ["umbrella stroller"] },
          { name: "İkiz bebek arabası", aliases: ["double stroller"] },
          { name: "Jogger bebek arabası" },
          { name: "Ana kucağı", aliases: ["infant carrier", "oto koltuğu ana kucağı"] },
          { name: "Oto koltuğu", aliases: ["car seat"] },
        ],
      },
    ],
    Beslenme: [
      {
        name: "Beslenme ürünleri",
        children: [
          { name: "Biberon", aliases: ["bottle"] },
          { name: "Emzik", aliases: ["pacifier"] },
          { name: "Mama sandalyesi", aliases: ["high chair"] },
          { name: "Sterilizatör" },
          { name: "Mama hazırlama makinesi" },
          { name: "Alıştırma bardağı", aliases: ["sippy cup"] },
          { name: "Göğüs pompası", aliases: ["breast pump"] },
        ],
      },
    ],
    "Uyku / Beşik": [
      {
        name: "Uyku",
        children: [
          { name: "Beşik", aliases: ["crib"] },
          { name: "Park yatak", aliases: ["playard"] },
          { name: "Anne yanı yatak", aliases: ["co-sleeper"] },
          { name: "Uyku tulumu", aliases: ["sleeping bag"] },
          { name: "Yatak koruyucu / nest" },
          { name: "Bebek odası mobilya seti" },
        ],
      },
    ],
    Bakım: [
      {
        name: "Bakım",
        children: [
          { name: "Bebek bezi", type: "COMMODITY_TYPE", aliases: ["diaper"] },
          { name: "Islak mendil", type: "COMMODITY_TYPE" },
          { name: "Bebek şampuanı / losyon", type: "COMMODITY_TYPE" },
          { name: "Alt açma minderi", aliases: ["changing pad"] },
          { name: "Bebek banyo küveti" },
          { name: "Ateş ölçer", aliases: ["thermometer"] },
          { name: "Tırnak makası / bakım seti" },
        ],
      },
    ],
    Diğer: [
      {
        name: "Diğer bebek",
        children: [
          { name: "Kanguru / baby carrier", aliases: ["carrier"] },
          { name: "Oyun parkı / activity gym" },
          { name: "Bebek monitörü", aliases: ["baby monitor"] },
          { name: "Emzirme yastığı" },
          { name: "Bebek tekstili" },
        ],
      },
    ],
  };

  for (const label of cat.subcategories) {
    const sub = subNode(cat.id, label);
    nodes.push(sub);
    expandTree(nodes, sub, trees[label]!, leafTypeFor(cat.id, subcategorySlug(label)));
  }
  return nodes;
}

/** Extra part names to merge into catalog taxonomy (extend, don't replace). */
const AUTO_PART_EXTENSIONS: Record<
  string,
  { name_tr: string; children: Record<string, string[]> }
> = {
  wheel_tire: {
    name_tr: "Jant & Lastik Parçaları",
    children: {
      wheel: [
        "Çelik jant",
        "Alaşım jant",
        "Jant kapağı",
        "Bijon anahtarı",
        "Bijon somunu",
        "Jant centiri",
        "TPMS sensörü",
        "Sibop",
        "Sibop kapağı",
      ],
      tire_related: [
        "Lastik tamir seti",
        "Stepne",
        "Stepne askısı",
        "Kriko",
        "Bijon anahtarı seti",
      ],
    },
  },
  locks_security: {
    name_tr: "Kilit & Güvenlik",
    children: {
      locks: [
        "Kapı kilidi",
        "Kapı kilidi motoru",
        "Merkezi kilit pompası",
        "Kontak kilidi",
        "Bagaj kilidi",
        "Kaput kilidi",
        "Kilit silindiri",
        "Anahtar kılıfı",
      ],
    },
  },
  hoses_lines: {
    name_tr: "Hortum & Hatlar",
    children: {
      hoses: [
        "Yakıt hortumu",
        "Fren hortumu",
        "Radyatör hortumu",
        "Klima hortumu",
        "Vakum hortumu",
        "Servo hortumu",
        "Turbo basınç hortumu",
        "Kalorifer hortumu",
      ],
    },
  },
  consumables_fasteners: {
    name_tr: "Sarf, Conta & Bağlantı",
    children: {
      gaskets: [
        "Silindir kapak contası",
        "Karter contası",
        "Manifold contası",
        "Termostat contası",
        "Yağ filitre contası",
        "Supap kapak contası",
      ],
      fasteners: [
        "Bijon",
        "Bijon saplaması",
        "Motor cıvatası",
        "Egzoz kelepçesi",
        "Hortum kelepçesi",
        "Plastik klips",
        "Panel klipsi",
      ],
      bearings: [
        "Teker rulmanı",
        "Debriyaj rulmanı",
        "Alternatör rulmanı",
        "Gerği rulmanı",
        "Şaft rulmanı",
      ],
      belts: [
        "V kayışı",
        "Triger kayışı",
        "Triger seti",
        "Alternatör kayışı",
        "Klima kayışı",
      ],
    },
  },
  exterior_trim: {
    name_tr: "Dış Trim & Aksesuar",
    children: {
      trim: [
        "Kapı çıtası",
        "Marşpiyel çıtası",
        "Cam çıtası",
        "Tavan çıtası",
        "Bagaj spoiler",
        "Ön lip",
        "Çamurluk genişletme",
        "Anten",
        "Yağmur oluğu",
      ],
    },
  },
  wiper_wash: {
    name_tr: "Silecek & Yıkama",
    children: {
      wiper: [
        "Silecek süpürgesi",
        "Silecek motoru",
        "Silecek mekanizması",
        "Silecek kolu",
        "Cam suyu pompası",
        "Cam suyu deposu",
        "Cam suyu hortumu",
        "Fıskiye memesi",
      ],
    },
  },
};

function deepExtendAutoPartsCatalog() {
  if (!existsSync(AUTO_PARTS)) {
    console.warn("automotive-part-taxonomy.json missing — skip extend");
    return;
  }
  const raw = JSON.parse(readFileSync(AUTO_PARTS, "utf8")) as Record<
    string,
    { name_tr: string; children: Record<string, string[]> }
  >;

  // Enrich existing systems with additional common TR parts (no OEM depth)
  const enrich: Record<string, Record<string, string[]>> = {
    engine: {
      lubrication: ["Yağ soğutucu hortumu", "Yağ basınç valfi"],
      air_induction: ["Hava filtre kutusu", "Blow-off valfi", "Wastegate"],
      mounts: ["Motor üst kulağı", "Şanzıman alt takozu"],
    },
    fuel_ignition: {
      fuel: ["AdBlue deposu", "Yakıt dağıtım borusu"],
      ignition: ["Ateşleme modülü", "Buji bosch tipi adaptör"],
    },
    cooling: {
      cooling: ["Kalorifer musluğu", "Su sıcaklık sensörü", "Radyatör kapağı"],
    },
    brake: {
      friction: ["Fren balata sensörü", "El freni teli"],
      hydraulic: ["Fren hidroliği deposu", "ABS hortumu"],
    },
    body: {
      front: ["Kaput menteşesi", "Kaput amartisörü", "Ön çamurluk davlumbazı"],
      side: ["Kapı kolu dış", "Kapı kolu iç", "Kapı kilidi karşılığı"],
      rear: ["Bagaj amartisörü", "Plaka yuvası"],
    },
    electrical_electronic: {
      sensors: [
        "ABS sensörü",
        "Debriyaj müşürü",
        "Fren müşürü",
        "Geri vites müşürü",
        "Yakıt seviye sensörü",
      ],
      control: ["Immobilizer anteni", "Kumanda anahtar kabı"],
    },
    interior_safety: {
      interior: [
        "Torpido kapağı",
        "El freni kolu",
        "Pedal lastiği",
        "Paspas seti",
        "Güneşlik",
      ],
    },
    filters_service: {
      filters: ["AdBlue filtresi", "Hidrolik yağ filtresi"],
      service: ["Antifriz", "Fren hidroliği", "Direksiyon yağı", "Şanzıman yağı"],
    },
  };

  for (const [sys, subs] of Object.entries(enrich)) {
    if (!raw[sys]) continue;
    for (const [sub, names] of Object.entries(subs)) {
      const list = raw[sys].children[sub] ?? [];
      const folded = new Set(list.map((x) => foldLabel(x)));
      for (const name of names) {
        if (!folded.has(foldLabel(name))) list.push(name);
      }
      raw[sys].children[sub] = list;
    }
  }

  for (const [sys, def] of Object.entries(AUTO_PART_EXTENSIONS)) {
    if (!raw[sys]) {
      raw[sys] = { name_tr: def.name_tr, children: { ...def.children } };
    } else {
      for (const [sub, names] of Object.entries(def.children)) {
        const list = raw[sys].children[sub] ?? [];
        const folded = new Set(list.map((x) => foldLabel(x)));
        for (const name of names) {
          if (!folded.has(foldLabel(name))) list.push(name);
        }
        raw[sys].children[sub] = list;
      }
    }
  }

  writeFileSync(AUTO_PARTS, JSON.stringify(raw, null, 2) + "\n", "utf8");
  console.log(`Extended ${AUTO_PARTS}`);
}

function loadPartAliasesTr(): Map<string, string[]> {
  const file = path.join(
    REPO_ROOT,
    "data",
    "catalogs",
    "automotive",
    "automotive-part-aliases-tr.json",
  );
  const map = new Map<string, string[]>();
  if (!existsSync(file)) return map;
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, string[]>;
  for (const [canon, aliases] of Object.entries(raw)) {
    map.set(foldLabel(canon), aliases);
  }
  return map;
}

function automotiveTree(): TaxonomyNode[] {
  const cat = REQUEST_CATEGORIES.find((c) => c.id === "automotive")!;
  const nodes: TaxonomyNode[] = [catRoot(cat.id, cat.label)];
  const aliasMap = loadPartAliasesTr();

  // Load (possibly extended) part taxonomy
  const partTax = existsSync(AUTO_PARTS)
    ? (JSON.parse(readFileSync(AUTO_PARTS, "utf8")) as Record<
        string,
        { name_tr: string; children: Record<string, string[]> }
      >)
    : {};

  for (const label of cat.subcategories) {
    const sub = subNode(cat.id, label);
    nodes.push(sub);
    const slug = subcategorySlug(label);

    if (label === "Yedek Parça") {
      for (const [systemId, system] of Object.entries(partTax)) {
        const sysNode = nodeOf({
          id: `${sub.id}:${systemId}`,
          parentId: sub.id,
          canonicalName: system.name_tr,
          aliases: [],
          nodeType: "GROUP",
          categoryId: "automotive",
          subcategoryId: slug,
          depth: 2,
          applicableCapabilities: ["ENTITY_COMPATIBILITY", "ATTRIBUTE_SCHEMA"],
          requestSchemaId: "automotive/yedek-parca",
          catalogSystemId: systemId,
          provenance: {
            source: "automotive-part-taxonomy.json",
            note: "Aligned with CatalogRegistry part system ids",
          },
        });
        nodes.push(sysNode);

        for (const [subsystemId, names] of Object.entries(system.children ?? {})) {
          const subSys = nodeOf({
            id: `${sysNode.id}:${subsystemId}`,
            parentId: sysNode.id,
            canonicalName: subsystemId.replace(/_/g, " "),
            aliases: [],
            nodeType: "GROUP",
            categoryId: "automotive",
            subcategoryId: slug,
            depth: 3,
            applicableCapabilities: ["ENTITY_COMPATIBILITY", "ATTRIBUTE_SCHEMA"],
            requestSchemaId: "automotive/yedek-parca",
            catalogSystemId: systemId,
            catalogSubsystemId: subsystemId,
            meta: { labelSource: "subsystemId" },
          });
          // Better Turkish labels for known subsystems
          const subLabelMap: Record<string, string> = {
            complete_engine: "Komple motor",
            cylinder_head: "Silindir kapağı grubu",
            bottom_end: "Alt grup / krank",
            timing: "Triger / zamanlama",
            lubrication: "Yağlama",
            air_induction: "Emme / turbo",
            mounts: "Motor takozları",
            fuel: "Yakıt sistemi",
            ignition: "Ateşleme",
            cooling: "Soğutma parçaları",
            exhaust: "Egzoz",
            emission: "Emisyon",
            manual: "Manuel şanzıman",
            automatic: "Otomatik şanzıman",
            clutch: "Debriyaj",
            axle: "Aks",
            differential: "Diferansiyel",
            suspension: "Süspansiyon",
            hub: "Porya / rulman",
            steering: "Direksiyon",
            friction: "Sürtünme elemanları",
            hydraulic: "Hidrolik fren",
            electronic: "Elektronik fren",
            front: "Ön kaporta",
            side: "Yan kaporta",
            rear: "Arka kaporta",
            structural: "Yapısal",
            external: "Dış aydınlatma",
            modules: "Far modülleri",
            glass: "Cam",
            mechanism: "Cam mekanizması",
            mirror: "Ayna",
            power: "Şarj / güç",
            control: "Kontrol üniteleri",
            sensors: "Sensörler",
            wiring: "Tesisat",
            ac: "Klima",
            hvac: "Kalorifer / HVAC",
            interior: "İç trim",
            safety: "Güvenlik / airbag",
            adas: "ADAS",
            multimedia: "Multimedya",
            high_voltage: "Yüksek voltaj",
            drive: "Elektrik tahrik",
            charging: "Şarj",
            thermal: "Batarya termal",
            filters: "Filtreler",
            service: "Bakım sarf",
            wheel: "Jant",
            tire_related: "Lastik yardımcı",
            locks: "Kilitler",
            hoses: "Hortumlar",
            gaskets: "Contalar",
            fasteners: "Bağlantı elemanları",
            bearings: "Rulmanlar",
            belts: "Kayışlar",
            trim: "Dış trim",
            wiper: "Silecek",
          };
          subSys.canonicalName = subLabelMap[subsystemId] ?? subSys.canonicalName;
          nodes.push(subSys);

          for (const name of names) {
            const fromFile = aliasMap.get(foldLabel(name)) ?? [];
            const partAliases = [...fromFile];
            // Ambiguous short aliases stay flagged, not in primary aliases
            const ambiguousAliases: string[] = [];
            if (foldLabel(name) === foldLabel("Ön far") && !partAliases.includes("far")) {
              ambiguousAliases.push("far");
            }
            nodes.push(
              nodeOf({
                id: `${subSys.id}:${slugPart(name)}`,
                parentId: subSys.id,
                canonicalName: name,
                aliases: partAliases.filter((a) => foldLabel(a) !== "far"),
                ambiguousAliases:
                  ambiguousAliases.length || partAliases.some((a) => foldLabel(a) === "far")
                    ? ["far", ...ambiguousAliases.filter((a) => foldLabel(a) !== "far")]
                    : undefined,
                nodeType: "PART_TYPE",
                categoryId: "automotive",
                subcategoryId: slug,
                depth: 4,
                searchTerms: [name, ...partAliases],
                applicableCapabilities: [
                  "ENTITY_COMPATIBILITY",
                  "ATTRIBUTE_SCHEMA",
                ],
                requestSchemaId: "automotive/yedek-parca",
                catalogSystemId: systemId,
                catalogSubsystemId: subsystemId,
                provenance: {
                  source: "automotive-part-taxonomy.json",
                },
              }),
            );
          }
        }
      }
      continue;
    }

    const trees: Record<string, ChildSpec[]> = {
      "Araç Satın Alma": [
        {
          name: "Araç segmenti",
          children: [
            { name: "Binek otomobil", aliases: ["otomobil", "passenger car"] },
            { name: "SUV / crossover", aliases: ["suv"] },
            { name: "Hatchback" },
            { name: "Sedan" },
            { name: "Station wagon", aliases: ["sw"] },
            { name: "Ticari van", aliases: ["panelvan"] },
            { name: "Pickup" },
            { name: "Minibüs / midibüs" },
            { name: "Elektrikli araç", aliases: ["EV", "BEV"] },
            { name: "Hibrit araç", aliases: ["HEV", "PHEV"] },
          ],
        },
        {
          name: "Durum",
          children: [
            { name: "Sıfır araç", type: "TECHNICAL_TYPE", aliases: ["0 km"] },
            { name: "İkinci el araç", type: "TECHNICAL_TYPE", aliases: ["2. el"] },
            { name: "Hasar kayıtlı", type: "TECHNICAL_TYPE" },
          ],
        },
      ],
      "Araç Bakım": [
        {
          name: "Bakım hizmetleri",
          children: [
            { name: "Periyodik bakım", type: "SERVICE_TYPE", aliases: ["yağ bakım"] },
            { name: "Triger değişimi", type: "SERVICE_TYPE" },
            { name: "Fren bakımı", type: "SERVICE_TYPE" },
            { name: "Klima gaz dolumu", type: "SERVICE_TYPE" },
            { name: "Rot balans", type: "SERVICE_TYPE" },
            { name: "Detaylı ekspertiz", type: "SERVICE_TYPE" },
            { name: "Kaporta / boya", type: "SERVICE_TYPE" },
            { name: "Mekanik onarım", type: "SERVICE_TYPE" },
            { name: "Elektrik arıza", type: "SERVICE_TYPE" },
            { name: "Yazılım / beyin güncelleme", type: "SERVICE_TYPE" },
          ],
        },
      ],
      "Lastik ve Jant": [
        {
          name: "Lastik",
          children: [
            { name: "Yaz lastiği", aliases: ["summer tire"] },
            { name: "Kış lastiği", aliases: ["winter tire"] },
            { name: "Dört mevsim lastik", aliases: ["all season"] },
            { name: "Runflat lastik" },
            { name: "Hafif ticari lastik", aliases: ["C lastik"] },
          ],
        },
        {
          name: "Jant",
          children: [
            { name: "Çelik jant" },
            { name: "Alaşım jant", aliases: ["alloy wheel"] },
            { name: "Forged jant" },
          ],
        },
        {
          name: "Hizmet",
          children: [
            { name: "Lastik değişimi", type: "SERVICE_TYPE" },
            { name: "Rot ayarı", type: "SERVICE_TYPE" },
            { name: "Balans", type: "SERVICE_TYPE" },
            { name: "Lastik otel / saklama", type: "SERVICE_TYPE" },
          ],
        },
      ],
      Diğer: [
        {
          name: "Diğer otomotiv",
          children: [
            { name: "Aksesuar", aliases: ["oto aksesuar"] },
            { name: "Ses sistemi / amplifikatör" },
            { name: "Koruma filmi / kaplama", aliases: ["PPF", "wrapping"] },
            { name: "Çeki demiri" },
            { name: "Roman / bagaj sistemleri" },
          ],
        },
      ],
    };

    expandTree(
      nodes,
      sub,
      trees[label] ?? [{ name: "Genel", children: ["Diğer"] }],
      leafTypeFor("automotive", slug),
    );
  }

  return nodes;
}

function main() {
  mkdirSync(OUT, { recursive: true });
  deepExtendAutoPartsCatalog();

  const domains: Array<{ id: string; file: string; nodes: TaxonomyNode[] }> = [
    { id: "printing", file: "products.json", nodes: printingTree() },
    { id: "furniture", file: "products.json", nodes: furnitureTree() },
    { id: "appliances", file: "products.json", nodes: appliancesTree() },
    { id: "technology", file: "products.json", nodes: technologyTree() },
    { id: "machinery", file: "machines.json", nodes: machineryTree() },
    { id: "home-kitchen", file: "products.json", nodes: homeKitchenTree() },
    { id: "real-estate", file: "property.json", nodes: realEstateTree() },
    { id: "services", file: "services.json", nodes: servicesTree() },
    { id: "health", file: "products.json", nodes: healthTree() },
    { id: "baby", file: "products.json", nodes: babyTree() },
    { id: "automotive", file: "spare-parts.json", nodes: automotiveTree() },
  ];

  let anyDomainChanged = false;
  applyHarvestOverlay(domains);
  applyGoogleOverlay(domains);
  // Yetkinlik EN SON uygulanır: overlay'lerden gelen düğümler de kapsansın.
  applyPartBearingCapability(domains);

  // Enrich aliases for common TR market terms (precision-first)
  for (const d of domains) {
    for (const n of d.nodes) {
      if (n.nodeType === "PART_TYPE" || n.nodeType === "PRODUCT_TYPE") {
        if (!n.searchTerms.includes(n.canonicalName)) {
          n.searchTerms = [...n.searchTerms, n.canonicalName];
        }
      }
    }
    if (writeDomain(d.id, d.file, d.nodes)) anyDomainChanged = true;
  }

  const manifestBody = {
    version: "1.0.0",
    domains: domains.map((d) => ({
      id: d.id,
      files: [`${d.id}/${d.file}`],
    })),
    notes: [
      "Root categories/subcategories mirror REQUEST_CATEGORIES (11 roots / 58 subcategories).",
      "Kitchen/bath fixtures live under home-kitchen/Diğer (no dedicated kitchen-bath root).",
      "Automotive brand/model/generation authority remains CatalogRegistry.",
      "Automotive spare part system ids align with data/catalogs/automotive/automotive-part-taxonomy.json.",
      "Counts are verified by apps/web/scripts/verify-taxonomy-drift-v1.ts — do not hand-edit count claims.",
    ],
  };
  /**
   * `generatedAt` DETERMİNİSTİK OLMALI (1D).
   *
   * Duvar saati damgası her koşuda değişiyordu; hiçbir içerik değişmese bile
   * manifest kirli görünüyordu. Damga artık yalnız İÇERİK değiştiğinde
   * yenilenir — böylece alan gerçekten "bu içerik ne zaman üretildi"yi
   * anlatır ve boş diff üretmez.
   */
  const manifestPath = path.join(OUT, "manifest.json");
  const previous = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
        string,
        unknown
      > & { generatedAt?: string })
    : null;
  const previousBody = previous ? { ...previous } : null;
  if (previousBody) delete previousBody.generatedAt;
  const bodyUnchanged =
    !anyDomainChanged &&
    previousBody != null &&
    JSON.stringify(previousBody) === JSON.stringify(manifestBody);
  const manifest = {
    version: manifestBody.version,
    generatedAt:
      bodyUnchanged && previous?.generatedAt
        ? previous.generatedAt
        : new Date().toISOString(),
    domains: manifestBody.domains,
    notes: manifestBody.notes,
  };
  const manifestChanged = writeGenerated(
    manifestPath,
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(`${manifestChanged ? "Wrote" : "Unchanged"} manifest.json`);
  const total = domains.reduce((a, d) => a + d.nodes.length, 0);
  console.log(`Total nodes: ${total}`);
}

main();
