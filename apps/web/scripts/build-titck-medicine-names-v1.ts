/**
 * TİTCK SKRS e-reçete listesinden ilaç MARKA ve ETKEN MADDE adlarını üretir.
 *
 * NE ÜRETİR: `data/medicine-names/titck-skrs-v1.json` — kapsam kapısının
 * okuduğu tek ilaç adı kaynağı. Elle yazılmış ikinci bir liste YOKTUR.
 *
 * PROVENANCE ZORUNLUDUR. Çıktının içine kaynak URL, dosyanın SHA-256'sı,
 * indirme tarihi ve satır sayısı yazılır. Bir veri dosyası nereden geldiğini
 * söyleyemiyorsa kazanılmamış bir statü taşır; bu yüzden üretici kaynak
 * dosyayı kendisi İNDİRMEZ — indiren kişi yolunu ve URL'yi verir.
 *
 * XLSX bir ZIP'tir; bu yüzden üçüncü parti bir kütüphaneye gerek yok ve
 * uygulamanın bağımlılıkları değişmez (kilit dosyasına dokunulmaz).
 *
 * Koşum:
 *   npx tsx scripts/build-titck-medicine-names-v1.ts \
 *     --xlsx <indirilen dosya> \
 *     --source-url <listenin indirildiği URL> \
 *     --downloaded-at <YYYY-MM-DD>
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

import { foldTr } from "@/lib/request-understanding/tr-fold";

/** XLSX = ZIP. Merkezî dizini okuyup her girdiyi açar. */
function readZipEntries(buf: Buffer): Record<string, Buffer> {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error("ZIP merkezî dizini bulunamadı");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: Record<string, Buffer> = {};
  for (let i = 0; i < count; i += 1) {
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const method = buf.readUInt16LE(p + 10);
    const localHeader = buf.readUInt32LE(p + 42);
    const compressedSize = buf.readUInt32LE(p + 20);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(localHeader + 26);
    const lExtraLen = buf.readUInt16LE(localHeader + 28);
    const start = localHeader + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compressedSize);
    out[name] = method === 0 ? raw : inflateRawSync(raw);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function unescapeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function readSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    unescapeXml(
      [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""),
    ),
  );
}

/** Aktif ürünler sayfasında A sütunu ilaç adı, D sütunu ATC (etken madde) adıdır. */
function readColumns(xml: string, shared: string[]): { names: string[]; substances: string[] } {
  const names: string[] = [];
  const substances: string[] = [];
  for (const row of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    if (Number(row[1]) < 4) continue; // ilk üç satır başlık/künye
    for (const cell of row[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const value = /<v>([\s\S]*?)<\/v>/.exec(cell[3]);
      if (!value) continue;
      const text = / t="s"/.test(cell[2]) ? (shared[Number(value[1])] ?? "") : value[1];
      if (cell[1] === "A") names.push(text);
      if (cell[1] === "D") substances.push(text);
    }
  }
  return { names, substances };
}

/**
 * GÜNLÜK SÖZCÜK EVRENİ — ÇAKIŞMA ÖLÇÜSÜ.
 *
 * Bir ilaç markası günlük bir sözcükle aynı yazılıyorsa (ör. APTAMIL bebek
 * maması olarak Talepo'nun `baby` kategorisindedir) o ad BLOK üretemez;
 * yalnız netleştirme üretir. Evren uydurulmaz: deponun kendi kanonik
 * kaynaklarından türetilir — taksonomi etiketleri, il/ilçe adları, marka
 * kataloğu ve gerçek talep cümleleri taşıyan korporalar. Evrenin ne olduğu
 * çıktıya yazılır, çünkü "çakışma yok" ancak evreni bilinerek okunabilir.
 */
function buildEverydayWordUniverse(repoRoot: string): { words: Set<string>; sources: string[] } {
  const words = new Set<string>();
  const sources: string[] = [];
  const addWords = (text: string) => {
    for (const w of text.matchAll(/[A-Za-zÇĞİIÖŞÜçğıöşü]{3,}/g)) words.add(foldTr(w[0]));
  };
  const walk = (dir: string, accept: (name: string) => boolean) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      // Üretilmiş Prisma istemcisi ürün metni değildir; taranırsa evren şema
      // gürültüsüyle şişer ve çakışma ölçüsü anlamını kaybeder.
      if (entry.name === "generated" || entry.name === "node_modules") continue;
      // KENDİ KENDİNİ KİRLETME. Kapsam kapısının ve doğrulayıcısının kendi
      // dosyaları ilaç adlarıyla doludur ("aspirin", "parol"); evrene
      // girerlerse gerçek ilaç adları "günlük sözcük" sayılıp engelleyici
      // kovadan düşer. Bu dosyalar günlük Türkçe değil, kapının sözlüğüdür.
      if (/pharmacy|scope-metamorphic|medicine/i.test(entry.name)) continue;
      if (entry.isDirectory()) walk(p, accept);
      else if (accept(entry.name) && statSync(p).size < 8_000_000) {
        const text = readFileSync(p, "utf8");
        if (entry.name.endsWith(".json")) {
          for (const m of text.matchAll(
            /"(?:canonicalName|label|name|title|synonyms?|aliases|searchTerms)"\s*:\s*(\[[^\]]*\]|"[^"]*")/g,
          )) {
            addWords(m[1]);
          }
        } else {
          for (const m of text.matchAll(/"([A-Za-zÇĞİIÖŞÜçğıöşü][A-Za-zÇĞİIÖŞÜçğıöşü\- ]{2,})"/g)) {
            addWords(m[1]);
          }
        }
      }
    }
  };
  const taxonomy = join(repoRoot, "data", "taxonomy");
  walk(taxonomy, (n) => n.endsWith(".json"));
  sources.push("data/taxonomy/**/*.json (kanonik ürün etiketleri)");

  const web = join(repoRoot, "apps", "web");
  addWords(readFileSync(join(web, "src/lib/geo/turkey-districts.ts"), "utf8"));
  sources.push("src/lib/geo/turkey-districts.ts (il/ilçe adları)");

  /**
   * EVREN NEDEN BÜTÜN KAYNAK AĞACIDIR.
   *
   * İlk sürüm yalnız taksonomi, katalog ve fixture'ları tarıyordu ve 6 çakışma
   * buldu. Ölçüm hemen kusuru gösterdi: "DÜŞÜK" bir ilaç markası adıdır ve o
   * dar evrende geçmediği için engelleyici kovaya düştü — "2013 model c180
   * düşük km araç arıyorum" kapsam dışı sayıldı. Türkçe günlük sözcükler
   * Talepo'nun kendi arayüz ve mesaj metinlerinde zaten yaşıyor; evren o
   * yüzden tüm kaynak ağacını okur. Kendi metnimizde geçen bir sözcük,
   * kullanıcının da yazacağı bir sözcüktür.
   */
  for (const rel of ["src", "scripts/fixtures"]) {
    walk(join(web, rel), (n) => /\.(ts|tsx|json)$/.test(n));
    sources.push(`apps/web/${rel} (ürün metinleri, katalog ve talep korporaları)`);
  }
  return { words, sources };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const xlsxPath = arg("xlsx");
  const sourceUrl = arg("source-url");
  const downloadedAt = arg("downloaded-at");
  if (!xlsxPath || !sourceUrl || !downloadedAt) {
    console.error("FAIL — --xlsx, --source-url ve --downloaded-at zorunludur (provenance).");
    process.exit(1);
  }

  const repoRoot = resolve(join(__dirname, "..", "..", ".."));
  const buf = readFileSync(xlsxPath);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const entries = readZipEntries(buf);
  const shared = readSharedStrings(entries["xl/sharedStrings.xml"].toString("utf8"));
  const sheet = entries["xl/worksheets/sheet1.xml"].toString("utf8");
  const { names, substances } = readColumns(sheet, shared);

  // Marka = ilaç adının ilk sözcüğü ("PAROL 500 MG TABLET" → PAROL).
  const firstToken = (s: string) => String(s ?? "").trim().split(/[\s,/()]+/)[0] ?? "";
  const brandSet = new Set<string>();
  for (const n of names) {
    const t = firstToken(n);
    // En az 4 harf: üç harfli kısaltmalar günlük metinde çok fazla yanlış eşleşir.
    if (/^[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü-]{3,}$/.test(t)) brandSet.add(foldTr(t));
  }
  const substanceSet = new Set<string>();
  for (const s of substances) {
    const v = String(s ?? "").trim().toLowerCase();
    // Tek sözcüklü etken maddeler alınır; "combinations of ..." gibi açıklama
    // satırları ad değildir ve metinde hiç geçmez.
    if (/^[a-z][a-z-]{5,}$/.test(v)) substanceSet.add(v);
  }

  const { words, sources } = buildEverydayWordUniverse(repoRoot);
  const brands = [...brandSet].sort();
  const collisions = brands.filter((b) => words.has(b));
  const blocking = brands.filter((b) => !words.has(b));
  const allSubstances = [...substanceSet].sort();

  const outDir = join(repoRoot, "data", "medicine-names");
  mkdirSync(outDir, { recursive: true });
  const payload = {
    _not:
      "ÜRETİLMİŞ DOSYA — elle düzenlenmez. Üretici: apps/web/scripts/build-titck-medicine-names-v1.ts",
    provenance: {
      source: "T.C. Sağlık Bakanlığı TİTCK — SKRS E-Reçete İlaç ve Diğer Farmasötik Ürünler Listesi",
      sourceUrl,
      downloadedAt,
      fileSha256: sha256,
      sheet: "AKTİF ÜRÜNLER LİSTESİ",
      productRows: names.length,
      label: "VERIFIED_SOURCE",
    },
    everydayWordUniverse: {
      size: words.size,
      sources,
      _not:
        "Çakışma listesi ancak bu evrenle birlikte okunabilir; evren dar olduğu için 'çakışma yok' bir kanıt değildir.",
    },
    counts: {
      brands: brands.length,
      blockingBrands: blocking.length,
      collidingBrands: collisions.length,
      substances: allSubstances.length,
    },
    /** Günlük sözcükle çakışmayan markalar — ilaç sinyali sayılır. */
    blockingBrands: blocking,
    /** Günlük sözcükle çakışan markalar — ASLA blok değil, yalnız netleştirme. */
    collidingBrands: collisions,
    substances: allSubstances,
  };
  const outPath = join(outDir, "titck-skrs-v1.json");
  writeFileSync(outPath, `${JSON.stringify(payload, null, 1)}\n`, "utf8");

  console.log(`ÜRÜN SATIRI: ${names.length}`);
  console.log(`MARKA: ${brands.length} (blok ${blocking.length}, çakışan ${collisions.length})`);
  console.log(`ETKEN MADDE: ${allSubstances.length}`);
  console.log(`GÜNLÜK SÖZCÜK EVRENİ: ${words.size}`);
  console.log(`ÇAKIŞAN: ${collisions.join(", ") || "yok"}`);
  console.log(`SHA256: ${sha256}`);
  console.log(`YAZILDI: ${outPath}`);
}

main();
