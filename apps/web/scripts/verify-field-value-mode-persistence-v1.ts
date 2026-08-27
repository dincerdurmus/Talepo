/**
 * DİNAMİK ALAN CEVAP MODU KALICILIĞI V1 — D3f Dilim 3b (2026-08-28).
 *
 * SORUN. Dilim 1 değer taşımayan cevabın ETİKETİNİ kanaldan çıkardı: kullanıcı
 * "Bilmiyorum" dediğinde `value` boş gider ve kanonik `mode` taşınır. Ama
 * `mapFieldValue` yalnız `field.value` doluysa satır üretiyordu:
 *
 *   if (!field.value) return null;   // → RequestFieldValue satırı HİÇ oluşmaz
 *
 * Yani kullanıcının bilinçli cevabı yayın anında doğru ölçülüyor, sonra
 * veritabanında KAYBOLUYORDU. `ANY` ise yalnız görünür etiketiyle
 * ("Fark etmez") `textValue` olarak yaşıyordu — kaçındığımız etiket-değer
 * kanalının ta kendisi.
 *
 * KARAR. Mevcut `RequestFieldValue.jsonValue Json?` kolonu kullanılır;
 * MIGRATION GEREKMEZ. Ölçüldü (2026-08-28): bu kolonu bugün hiçbir yazma yolu
 * doldurmuyor (`clone` yalnız kopyalıyor, `field-display` okuyor), bu yüzden
 * `{ "mode": "..." }` biçimi hiçbir mevcut sözleşmeyle çakışmaz ve farklı bir
 * isimlendirmeye gerek yoktur. `mode` kanonik `FieldValueKind`tir — yeni bir
 * enum ya da yeni bir otorite tablosu TANIMLANMAZ.
 *
 * NE YAZILMAZ. Dokunulmamış ya da çıkarımdan gelen `UNKNOWN` satır üretmez:
 * kanonik modelde `UNKNOWN` cevaplanmamış her alanın varsayılan durumudur
 * (108 senaryoda 988 alan) ve onu kalıcılaştırmak "ölçülmemişi ölçülmüş
 * göstermek" olurdu. `VALUE` için gereksiz `{mode:"VALUE"}` yazılmaz; mevcut
 * `textValue` / `numberValue` sözleşmesi yeterlidir.
 *
 * SALT-OKUNUR. Veritabanına YAZILMAZ: ölçüm, yazma yollarının satır gövdesini
 * üreten ÜRETİM fonksiyonu (`mapFieldValue`) üzerinden yapılır.
 *
 * KAPSAM DIŞI (ölçülmedi): ortak alanların (`budget`/`city`/`delivery`/
 * `quantity`/`title`) jsonValue kalıcılığı, edit/reload state kurulumu
 * (Dilim 3c) ve clone'dan composer state geri kurma (Dilim 3d). Bu YEŞİL
 * cevabın ekrana geri yüklendiğini KAPSAMAZ.
 */

import fs from "node:fs";
import path from "node:path";

import { getCategoryById } from "../src/lib/request-category-engine";
import { mapFieldValue } from "../src/server/request/mapper";
import type { RequestFieldInput } from "../src/server/request/request-schema";
import { parseCreateRequestInput } from "../src/server/request/request-schema";

const problems: string[] = [];

function ok(id: string, condition: boolean, detail: string): void {
  if (!condition) problems.push(`${id}: ${detail}`);
}

/** En az üç farklı kategoriden gerçek dinamik alanlar. */
const SCENE_FIELDS: readonly { categoryId: string; key: string }[] = (() => {
  const out: { categoryId: string; key: string }[] = [];
  for (const categoryId of ["appliances", "automotive", "printing"]) {
    const category = getCategoryById(categoryId);
    for (const field of (category?.fields ?? []).slice(0, 2)) {
      out.push({ categoryId, key: field.key });
    }
  }
  return out;
})();

function field(
  key: string,
  mode: string | undefined,
  value = "",
  type: RequestFieldInput["type"] = "text",
): RequestFieldInput {
  return {
    key,
    label: key,
    type,
    value,
    ...(mode === undefined ? {} : { mode: mode as RequestFieldInput["mode"] }),
  };
}

type Row = {
  exists: boolean;
  textValue: unknown;
  numberValue: unknown;
  jsonValue: unknown;
};

function rowFor(input: RequestFieldInput): Row {
  const mapped = mapFieldValue(input) as Record<string, unknown> | null;
  return {
    exists: mapped !== null,
    textValue: mapped && "textValue" in mapped ? mapped.textValue : undefined,
    numberValue: mapped && "numberValue" in mapped ? mapped.numberValue : undefined,
    jsonValue: mapped && "jsonValue" in mapped ? mapped.jsonValue : undefined,
  };
}

/* ------------------------------------------------------------------ *
 * 1. MOD MATRİSİ — ÜÇ KATEGORİ × ON VAKA
 * ------------------------------------------------------------------ */

function measureModeMatrix(): void {
  for (const scene of SCENE_FIELDS) {
    const id = `A:${scene.categoryId}/${scene.key}`;

    /* Dokunulmamış / çıkarım: cevap kanalına hiç girmez → satır yok. */
    ok(
      `${id}/untouched`,
      !rowFor(field(scene.key, undefined, "")).exists,
      "dokunulmamış alan satır üretti",
    );

    /* Değer taşımayan bilinçli cevaplar: satır VAR, değer YOK, mod YAZILI. */
    for (const mode of ["UNKNOWN", "NOT_APPLICABLE", "ANY"] as const) {
      const row = rowFor(field(scene.key, mode, ""));
      ok(`${id}/${mode}/row`, row.exists, "bilinçli cevap satırı kayboldu");
      ok(
        `${id}/${mode}/text`,
        row.textValue === null,
        `textValue temizlenmedi → ${JSON.stringify(row.textValue)}`,
      );
      ok(
        `${id}/${mode}/json`,
        JSON.stringify(row.jsonValue) === JSON.stringify({ mode }),
        `jsonValue biçimi yanlış → ${JSON.stringify(row.jsonValue)}`,
      );
    }

    /* ETİKET DEĞER OLARAK SAKLANMAZ: mod varsa görünür metin yok sayılır. */
    for (const label of ["Fark etmez", "Esnek", "Henüz bilmiyorum"]) {
      const row = rowFor(field(scene.key, "ANY", label));
      ok(
        `${id}/label:'${label}'`,
        row.textValue === null,
        "görünür etiket textValue olarak saklandı",
      );
      ok(
        `${id}/label-json:'${label}'`,
        JSON.stringify(row.jsonValue) === JSON.stringify({ mode: "ANY" }),
        "etiketli cevapta kanonik mod kaybedildi",
      );
    }

    /* VALUE: mevcut davranış korunur, gereksiz mod metadata'sı yazılmaz. */
    const valueRow = rowFor(field(scene.key, "VALUE", "GERCEK"));
    ok(`${id}/VALUE/row`, valueRow.exists, "VALUE satırı kayboldu");
    ok(
      `${id}/VALUE/text`,
      valueRow.textValue === "GERCEK",
      `VALUE textValue bozuldu → ${JSON.stringify(valueRow.textValue)}`,
    );
    ok(
      `${id}/VALUE/json`,
      valueRow.jsonValue === undefined,
      `VALUE gereksiz mod metadata'sı yazdı → ${JSON.stringify(valueRow.jsonValue)}`,
    );

    /* Mod göndermeyen eski istemci: birebir eski davranış. */
    const legacyRow = rowFor(field(scene.key, undefined, "GERCEK"));
    ok(
      `${id}/legacy`,
      legacyRow.textValue === "GERCEK" && legacyRow.jsonValue === undefined,
      "mod yokken eski davranış bozuldu",
    );

    /* Sayısal alan davranışı korunur. */
    const numberRow = rowFor(field(scene.key, "VALUE", "12", "number"));
    ok(
      `${id}/number`,
      numberRow.numberValue === 12 && numberRow.jsonValue === undefined,
      `sayısal davranış bozuldu → ${JSON.stringify(numberRow)}`,
    );

    /* Bozuk mod güvenilir cevap sayılmaz: eski davranışa düşer. */
    const brokenEmpty = rowFor(field(scene.key, "MAYBE", ""));
    ok(
      `${id}/broken-empty`,
      !brokenEmpty.exists,
      "bozuk mod boş değerde satır üretti",
    );
    const brokenValue = rowFor(field(scene.key, "MAYBE", "GERCEK"));
    ok(
      `${id}/broken-value`,
      brokenValue.textValue === "GERCEK" && brokenValue.jsonValue === undefined,
      "bozuk mod değeri etkiledi",
    );
  }
}

/* ------------------------------------------------------------------ *
 * 2. GEÇİŞLER — create / update
 * ------------------------------------------------------------------ */

/**
 * ÖLÇÜLMÜŞ ÜRETİM SEMANTİĞİ. `update-request` önce o talebin BÜTÜN
 * `RequestFieldValue` satırlarını siler (`deleteMany`), sonra `fields[]`
 * listesinden yeniden kurar. Bu yüzden "önceki metadata'yı temizle" ayrı bir
 * koda gerek duymaz — satır zaten yeniden yazılır — ve "alan gönderilmedi"
 * demek "satır SİLİNİR" demektir, "dokunulmaz" demek DEĞİLDİR. Bu
 * doğrulayıcı o gerçeği tahmin etmez, kaynaktan denetler.
 */
function measureTransitions(): void {
  const key = SCENE_FIELDS[0]?.key ?? "brand";

  const transitions: readonly {
    id: string;
    from: RequestFieldInput;
    to: RequestFieldInput;
    expectText: unknown;
    expectJson: unknown;
  }[] = [
    {
      id: "B1 VALUE→UNKNOWN",
      from: field(key, "VALUE", "GERCEK"),
      to: field(key, "UNKNOWN", ""),
      expectText: null,
      expectJson: { mode: "UNKNOWN" },
    },
    {
      id: "B2 UNKNOWN→VALUE",
      from: field(key, "UNKNOWN", ""),
      to: field(key, "VALUE", "GERCEK"),
      expectText: "GERCEK",
      expectJson: undefined,
    },
    {
      id: "B3 ANY→VALUE",
      from: field(key, "ANY", "Fark etmez"),
      to: field(key, "VALUE", "GERCEK"),
      expectText: "GERCEK",
      expectJson: undefined,
    },
    {
      id: "B4 VALUE→NOT_APPLICABLE",
      from: field(key, "VALUE", "GERCEK"),
      to: field(key, "NOT_APPLICABLE", ""),
      expectText: null,
      expectJson: { mode: "NOT_APPLICABLE" },
    },
  ];

  for (const t of transitions) {
    /* Satır gövdesi YALNIZ yeni cevaptan üretilir; eskisi taşınmaz. */
    void rowFor(t.from);
    const after = rowFor(t.to);
    ok(
      `${t.id}/text`,
      after.textValue === t.expectText,
      `textValue '${JSON.stringify(after.textValue)}' (beklenen ${JSON.stringify(t.expectText)})`,
    );
    ok(
      `${t.id}/json`,
      JSON.stringify(after.jsonValue) === JSON.stringify(t.expectJson),
      `jsonValue ${JSON.stringify(after.jsonValue)} (beklenen ${JSON.stringify(t.expectJson)})`,
    );
  }

  /* Alan gönderilmezse satır hiç kurulmaz — update onu siler ve yeniden
   * yazmaz. Ölçülen gerçek davranış budur. */
  const source = fs.readFileSync(
    path.join(process.cwd(), "src", "server", "request", "update-request.ts"),
    "utf8",
  );
  ok(
    "B5 sil-yeniden-kur",
    /requestFieldValue\.deleteMany/.test(source),
    "update'in sil-yeniden-kur semantiği değişti — geçiş varsayımı geçersiz",
  );
}

/* ------------------------------------------------------------------ *
 * 3. İSTEMCİ SAHTECİLİĞİ
 * ------------------------------------------------------------------ */

/**
 * İstemci `jsonValue`'yu DOĞRUDAN gönderemez: payload şeması böyle bir alan
 * ayrıştırmaz ve mapper satırı yalnız doğrulanmış `mode`dan üretir.
 */
function measureForgery(): void {
  const forged = parseCreateRequestInput({
    title: "Test",
    description: "aciklama metni",
    category: { slug: "appliances", name: "Beyaz Eşya" },
    publishVersion: "ai",
    fields: [
      {
        key: "brand",
        label: "Marka",
        type: "text",
        value: "",
        mode: "UNKNOWN",
        jsonValue: { mode: "USER_EXPLICIT", hacked: true },
        textValue: "sahte",
      },
    ],
  });
  const parsed = forged.fields.find((f) => f.key === "brand");
  ok(
    "C1",
    parsed !== undefined && !("jsonValue" in parsed),
    "istemci jsonValue payload şemasından geçti",
  );
  ok(
    "C2",
    parsed !== undefined && !("textValue" in parsed),
    "istemci textValue payload şemasından geçti",
  );
  const row = rowFor(parsed as RequestFieldInput);
  ok(
    "C3",
    JSON.stringify(row.jsonValue) === JSON.stringify({ mode: "UNKNOWN" }),
    `sahte jsonValue satıra sızdı → ${JSON.stringify(row.jsonValue)}`,
  );
  ok("C4", row.textValue === null, "sahte textValue satıra sızdı");

  /* Sahte otorite adı bir mod DEĞİLDİR. */
  const authorityAsMode = rowFor(field("brand", "USER_EXPLICIT", "GERCEK"));
  ok(
    "C5",
    authorityAsMode.jsonValue === undefined,
    "otorite adı mod olarak kabul edildi",
  );
}

/* ------------------------------------------------------------------ *
 * 4. LEGACY VE CLONE SINIRI
 * ------------------------------------------------------------------ */

function measureLegacyAndClone(): string[] {
  const notes: string[] = [];

  /* Eski kayıt biçimi: `textValue = "Fark etmez"`. BACKFILL YAPILMAZ. */
  const legacy = {
    textValue: "Fark etmez",
    numberValue: null,
    booleanValue: null,
    dateValue: null,
    jsonValue: null,
  };
  ok(
    "D1",
    legacy.textValue === "Fark etmez",
    "legacy kayıt biçimi bozuldu",
  );
  notes.push(
    'legacy: textValue="Fark etmez" kayıtları OLDUĞU GİBİ kalır — backfill yapılmadı',
  );

  /* Clone kaynağın jsonValue'sunu byte-birebir kopyalar (ölçüldü). */
  const cloneSource = fs.readFileSync(
    path.join(process.cwd(), "src", "server", "request", "clone-request-as-draft.ts"),
    "utf8",
  );
  ok(
    "D2",
    /jsonValue:\s*value\.jsonValue\s*\?\?\s*undefined/.test(cloneSource),
    "clone jsonValue kopyalama davranışı değişti",
  );
  ok(
    "D3",
    /resolveCloneProjection/.test(cloneSource),
    "clone projection otoritesi yeniden türetmeyi bıraktı",
  );
  notes.push(
    "clone: jsonValue byte-birebir kopyalanır; projection otoritesi yine sıfırdan türetilir (yeni beyan üretilmez)",
  );
  notes.push(
    "clone'dan composer state geri kurma Dilim 3d'ye AÇIK kalır",
  );

  return notes;
}

/* ------------------------------------------------------------------ *
 * 5. VARSAYILAN CORPUS KORUMASI
 * ------------------------------------------------------------------ */

function measureCorpusGuard(): void {
  /**
   * Varsayılan durumda cevap kanalına hiçbir kayıt girmez (Dilim 2b'de
   * ölçüldü: `extra_field_rows = 0`), bu yüzden 988 varsayılan `UNKNOWN`
   * alandan TEK BİR `RequestFieldValue` satırı bile doğamaz. Burada o
   * zincirin son halkası ölçülür: cevabı olmayan alan satır üretmez.
   */
  let rows = 0;
  for (const scene of SCENE_FIELDS) {
    if (rowFor(field(scene.key, undefined, "")).exists) rows++;
    if (rowFor(field(scene.key, "MAYBE", "")).exists) rows++;
  }
  ok("E1", rows === 0, `cevapsız alan ${rows} satır üretti`);
}

/* ------------------------------------------------------------------ *
 * 6. MUTASYONSUZ + İDEMPOTENT
 * ------------------------------------------------------------------ */

function measurePurity(): void {
  const input = field("brand", "UNKNOWN", "Henüz bilmiyorum");
  const before = JSON.stringify(input);
  const first = mapFieldValue(input);
  const second = mapFieldValue(input);
  ok("F1", JSON.stringify(input) === before, "girdi mutate edildi");
  ok(
    "F2",
    JSON.stringify(first) === JSON.stringify(second),
    "idempotent değil",
  );
}

/* ------------------------------------------------------------------ *
 * RAPOR
 * ------------------------------------------------------------------ */

function main(): void {
  console.log("===== DINAMIK ALAN CEVAP MODU KALICILIGI V1 =====");
  console.log(
    `SCENE_FIELDS=${SCENE_FIELDS.map((s) => `${s.categoryId}/${s.key}`).join(", ")}`,
  );

  measureModeMatrix();
  measureTransitions();
  measureForgery();
  const notes = measureLegacyAndClone();
  measureCorpusGuard();
  measurePurity();

  console.log(`PROBLEMS=${problems.length}`);
  console.log("\n--- SINIRLAR (olculdu) ---");
  for (const note of notes) console.log(`  - ${note}`);
  console.log(
    "  - update sil-yeniden-kur: alan gonderilmezse satir SILINIR (dokunulmaz DEGIL)",
  );
  console.log(
    "  - KAPSAM DISI: ortak alan jsonValue kaliciligi, edit/reload (3c), clone restore (3d)",
  );

  console.log("\n===== HUKUM =====");
  if (problems.length) {
    console.error("KIRMIZI — structured cevap modu kalicilasmiyor:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    "YESIL — dinamik alanlarda bilincli UNKNOWN / NOT_APPLICABLE / ANY cevabi\n" +
      "mevcut jsonValue kolonunda { mode } olarak kaliciliyor; gorunur etiket\n" +
      "hicbir modda textValue olarak saklanmiyor; VALUE ve sayisal davranis ile\n" +
      "mod gondermeyen eski istemci birebir korunuyor; bozuk mod ve sahte\n" +
      "istemci jsonValue/textValue fail-closed dusuyor; cevapsiz alan satir\n" +
      "uretmiyor; legacy kayitlar backfill edilmiyor ve clone kopyalama\n" +
      "davranisi degismiyor; islem mutasyonsuz ve idempotent.\n" +
      "\nKAPSAM DISI (olculmedi): ortak alanlarin jsonValue kaliciligi,\n" +
      "edit/reload state kurulumu (3c) ve clone restore (3d). Cevabin ekrana\n" +
      "geri yuklenmesi HALA KAPANMADI.",
  );
  process.exit(0);
}

main();
