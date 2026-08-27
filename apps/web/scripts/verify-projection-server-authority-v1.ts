/**
 * SUNUCU GÜVEN SINIRI V1 — D3d (2026-08-27).
 *
 * ÖLÇTÜĞÜ TEK SÖZLEŞME. `discoveryProjection.fieldAuthority` istemciden gelen
 * bir ETİKET değil, sunucunun kendi girdilerinden YENİDEN TÜRETTİĞİ bir
 * kayıttır. İstemcinin payload'ına yazdığı hiçbir seviye doğrudan kabul
 * edilmez; sunucu türetemiyorsa `UNKNOWN` yazılır ve asla yukarı
 * yükseltilmez.
 *
 * NEDEN. Bu sınır olmadan kötü niyetli bir istemci kendi talebine sahte
 * `VERIFIED` damgası vurabiliyordu (ölçüldü, 2026-08-27: metinde hiç geçmeyen
 * bir `condition` için gönderilen `VERIFIED` aynen kaydediliyordu). Maira,
 * admin paneli ve ileride Matching V3 bu alana bakacaksa, gördükleri seviye
 * sunucunun doğruladığı kaynak seviyesi OLMALIDIR.
 *
 * ÜRETİM DAVRANIŞI ÖLÇÜLÜR, KOPYALANMAZ. Bu doğrulayıcı otoriteyi KENDİ
 * hesaplamaz. Üç yazma yolunun GERÇEK karar fonksiyonlarını çağırır
 * (`resolveDiscoveryProjection`, `resolveUpdateDiscoveryProjection`,
 * `resolveCloneProjection`) ve sonucu üretim okuma sınırından
 * (`projectionAuthorityOf`) okur. Edit ekranının cevap kanalı da üretim
 * süzgeciyle (`buildPublishFieldValues`) ölçülür.
 *
 * VERİTABANI YAZIMI YOKTUR. Ölçülen üç fonksiyonun hiçbiri Prisma'ya
 * dokunmaz; bu doğrulayıcının kendisinin de Prisma'ya dokunmadığı aşağıda
 * ayrıca denetlenir. Ağ çağrısı yapılmaz, hiçbir dosya yeniden yazılmaz.
 */

import fs from "node:fs";
import path from "node:path";

import {
  FROZEN_EDIT_ANSWER_CHANNEL,
  FROZEN_EDIT_END_TO_END,
  FROZEN_SERVER_AUTHORITY_IDENTITIES,
  SERVER_AUTHORITY_BASELINE,
} from "./fixtures/projection-server-authority-v1";
import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import { projectionAuthorityOf } from "../src/lib/discovery/validate-filter";
import type {
  ProjectionAuthoritySurface,
  RequestDiscoveryProjection,
} from "../src/lib/discovery/types";
import {
  buildPublishFieldValues,
  createTextOnlyState,
  syncFromText,
} from "../src/lib/request-composer";
import {
  resolveCloneProjection,
  resolveCreateProjection,
  resolveUpdateProjection,
  type ProjectionWriteInput,
} from "../src/lib/discovery/server-authority";
import type { Authority } from "../src/lib/request-understanding/provenance";

const SURFACES: readonly ProjectionAuthoritySurface[] = [
  "attributes",
  "constraints",
];

const TEXT_DESK = "Ikinci el bir masa ariyorum";
const TEXT_FRIDGE = "Buzdolabi ariyorum";
const TEXT_PART = "Mercedes C200 icin sag on far ariyorum";

type FieldInput = { key: string; value: string };

/** Ölçüm sırasında değiştirilebilsin diye derin kopya. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function projectionFromText(text: string): RequestDiscoveryProjection {
  return clone(buildDiscoveryProjectionFromState(createTextOnlyState(text)));
}

function projectionFromStructured(
  text: string,
  fieldValues: Record<string, string>,
): RequestDiscoveryProjection {
  const { state } = syncFromText(null, text, { structured: { fieldValues } });
  return clone(buildDiscoveryProjectionFromState(state));
}

/**
 * İstemci payload'ı taklidi: gelen projection'ın OTORİTE HARİTASI istenen
 * yalanla doldurulur. Değerlere burada dokunulmaz — değer tahrifi ayrıca ve
 * açıkça yapılır.
 */
function forgeAuthority(
  projection: RequestDiscoveryProjection,
  bag: Record<string, { attributes?: string; constraints?: string }>,
): RequestDiscoveryProjection {
  return {
    ...projection,
    fieldAuthority: bag as RequestDiscoveryProjection["fieldAuthority"],
  };
}

/** Bir projection'ın tüm anahtarlarına aynı sahte seviyeyi vurur. */
function forgeAll(
  projection: RequestDiscoveryProjection,
  authority: string,
): RequestDiscoveryProjection {
  const bag: Record<string, { attributes?: string; constraints?: string }> = {};
  for (const key of new Set([
    ...Object.keys(projection.attributes ?? {}),
    ...Object.keys(projection.constraints ?? {}),
  ])) {
    bag[key] = { attributes: authority, constraints: authority };
  }
  return forgeAuthority(projection, bag);
}

/**
 * Yazma yollarının gördüğü payload görünümü. `rawInput` BİLİNÇLİ olarak
 * yalnız verildiğinde konur: update kanaryası payload'da metin OLMADAN
 * sunucunun kendi kaydını okuduğunu ölçer.
 */
function writeInput(over: {
  rawInput?: string;
  description?: string;
  projection?: unknown;
  fields?: FieldInput[];
}): ProjectionWriteInput {
  return {
    title: "Kanarya talebi",
    description: over.description ?? over.rawInput ?? "",
    rawInput: over.rawInput,
    fields: over.fields ?? [],
    discoveryProjection: over.projection,
  };
}

/** Create yolunun projection kararı (yalnız alt sistem günlüğü olmadan). */
function createProjection(
  input: ProjectionWriteInput,
): RequestDiscoveryProjection | null {
  return resolveCreateProjection(input).projection;
}

/**
 * Bir senaryonun kimlik haritası. Kimlik evreni projection'da GERÇEKTEN var
 * olan yüzeylerden kurulur; otorite üretim okuma sınırından okunur.
 */
function identitiesOf(
  scenarioId: string,
  projection: RequestDiscoveryProjection | null | undefined,
): Map<string, Authority> {
  const out = new Map<string, Authority>();
  if (!projection) return out;
  for (const key of Object.keys(projection.attributes ?? {})) {
    out.set(
      `${scenarioId}/${key}/attributes`,
      projectionAuthorityOf(projection, key, "attributes"),
    );
  }
  for (const key of Object.keys(projection.constraints ?? {})) {
    out.set(
      `${scenarioId}/${key}/constraints`,
      projectionAuthorityOf(projection, key, "constraints"),
    );
  }
  return out;
}

function parseFrozenRow(row: string): { id: string; value: string } | null {
  const idx = row.indexOf(" = ");
  if (idx < 0) return null;
  return { id: row.slice(0, idx).trim(), value: row.slice(idx + 3).trim() };
}

/** `fieldAuthority` DIŞINDA hiçbir şey değişmemeli. */
function payloadSignatureOf(projection: RequestDiscoveryProjection): string {
  const copy: Record<string, unknown> = { ...projection };
  delete copy.fieldAuthority;
  return JSON.stringify(copy, Object.keys(copy).sort());
}

/* ------------------------------------------------------------------ *
 * KİMLİK ÜRETEN SENARYOLAR
 * ------------------------------------------------------------------ */

function measureIdentities(problems: string[]): Map<string, Authority> {
  const measured = new Map<string, Authority>();
  const add = (m: Map<string, Authority>) => {
    for (const [id, authority] of m) measured.set(id, authority);
  };

  /* S01 — sahte VERIFIED + değiştirilmiş değer + kirli anahtarlar. */
  {
    const base = projectionFromText(TEXT_DESK);
    base.attributes.condition = "Sıfır";
    if (base.constraints.condition) base.constraints.condition.value = "Sıfır";
    const tampered = forgeAuthority(base, {
      condition: { attributes: "VERIFIED", constraints: "VERIFIED" },
      productType: { attributes: "USER_EXPLICIT", constraints: "USER_EXPLICIT" },
      furnitureType: { attributes: "USER_EXPLICIT", constraints: "USER_EXPLICIT" },
      /* Talepo'nun kendi tahmini kullanıcı beyanı gibi etiketlenmiş. */
      usageArea: { attributes: "USER_EXPLICIT", constraints: "USER_EXPLICIT" },
      /* Projection'da hiçbir yüzeyi olmayan uydurma anahtar. */
      hicBoyleBirAlanYok: { attributes: "USER_EXPLICIT" },
      /* İç kanıt anahtarları generic otoriteye giremez. */
      brandCandidate: { attributes: "USER_EXPLICIT" },
      brandEvidence: { constraints: "VERIFIED" },
    });
    const out = createProjection(
      writeInput({ rawInput: TEXT_DESK, projection: tampered }),
    );
    add(identitiesOf("S01", out));

    const bagKeys = Object.keys(out?.fieldAuthority ?? {});
    for (const dirty of ["hicBoyleBirAlanYok", "brandCandidate", "brandEvidence"]) {
      if (bagKeys.includes(dirty)) {
        problems.push(
          `S01: "${dirty}" otorite haritasında kaldı — projection'da yüzeyi ` +
            `olmayan ya da iç kanıt olan anahtar generic otoriteye giremez`,
        );
      }
      if (projectionAuthorityOf(out, dirty, "attributes") !== "UNKNOWN") {
        problems.push(`S01: "${dirty}" okuma sınırından UNKNOWN dönmedi`);
      }
    }
    if (out?.attributes.condition !== "Sıfır") {
      problems.push(
        "S01: kullanıcının gönderdiği DEĞER değişti — güven sınırı yalnız " +
          "otoriteyi yeniden yazar, değere dokunmaz",
      );
    }
  }

  /* S02 — metinde geçmeyen markaya sahte USER_EXPLICIT, cevap kanalı boş. */
  {
    const base = projectionFromText(TEXT_DESK);
    base.attributes.brand = "Vitra";
    base.constraints.brand = { mode: "VALUE", value: "Vitra" };
    const tampered = forgeAll(base, "USER_EXPLICIT");
    add(
      identitiesOf(
        "S02",
        createProjection(
          writeInput({ rawInput: TEXT_DESK, projection: tampered }),
        ),
      ),
    );
  }

  /* S03 — istemci her şeye UNKNOWN dedi; katalog VERIFIED'i cevap kanalı
   * ezmemeli, yalnız çıkarım olan needType süzülmüş cevapla yükselmeli. */
  {
    const tampered = forgeAll(projectionFromText(TEXT_PART), "UNKNOWN");
    add(
      identitiesOf(
        "S03",
        createProjection(
          writeInput({
            rawInput: TEXT_PART,
            projection: tampered,
            fields: [
              { key: "model", value: "C200" },
              { key: "needType", value: "part" },
            ],
          }),
        ),
      ),
    );
  }

  /* S04 — metinde olmayan ama süzülmüş cevap kanalından gelen değer. */
  {
    const tampered = forgeAll(
      projectionFromStructured(TEXT_FRIDGE, { color: "beyaz" }),
      "UNKNOWN",
    );
    add(
      identitiesOf(
        "S04",
        createProjection(
          writeInput({
            rawInput: TEXT_FRIDGE,
            projection: tampered,
            fields: [{ key: "color", value: "beyaz" }],
          }),
        ),
      ),
    );
  }

  /* S05 — bir yüzeyin değeri değişmiş, ötekisi cevapla uyumlu. */
  {
    const base = projectionFromStructured(TEXT_FRIDGE, { color: "beyaz" });
    base.attributes.color = "kırmızı";
    const tampered = forgeAll(base, "USER_EXPLICIT");
    add(
      identitiesOf(
        "S05",
        createProjection(
          writeInput({
            rawInput: TEXT_FRIDGE,
            projection: tampered,
            fields: [{ key: "color", value: "beyaz" }],
          }),
        ),
      ),
    );
  }

  /* S06 — update, payload'da rawInput yokken sunucunun kendi metnini okur. */
  {
    const tampered = forgeAll(projectionFromText(TEXT_PART), "USER_EXPLICIT");
    const input = writeInput({
      description: "Guncellenmis aciklama",
      projection: tampered,
    });
    add(
      identitiesOf(
        "S06",
        resolveUpdateProjection(input, TEXT_PART),
      ),
    );
    if (input.rawInput !== undefined) {
      problems.push(
        "S06: kanarya kurulumu bozuk — payload rawInput taşımamalıydı",
      );
    }
  }

  /* S08 — clone kaynağın etiketine değil kaynağın metnine bakar. */
  {
    const tampered = forgeAll(projectionFromText(TEXT_PART), "USER_EXPLICIT");
    (tampered.fieldAuthority as Record<string, unknown>).hicBoyleBirAlanYok = {
      attributes: "USER_EXPLICIT",
    };
    const out = resolveCloneProjection({
      discoveryProjection: tampered,
      rawInput: TEXT_PART,
    });
    add(identitiesOf("S08", out));
    if (Object.keys(out?.fieldAuthority ?? {}).includes("hicBoyleBirAlanYok")) {
      problems.push("S08: clone uydurma anahtarı taşıdı");
    }
  }

  /* S09 — clone yeni kullanıcı beyanı üretmez. */
  {
    const tampered = forgeAll(
      projectionFromStructured(TEXT_FRIDGE, { color: "beyaz" }),
      "USER_EXPLICIT",
    );
    add(
      identitiesOf(
        "S09",
        resolveCloneProjection({
          discoveryProjection: tampered,
          rawInput: TEXT_FRIDGE,
        }),
      ),
    );
  }

  return measured;
}

/* ------------------------------------------------------------------ *
 * SÖZLEŞME KONTROLLERİ (kimlik üretmez)
 * ------------------------------------------------------------------ */

function checkContracts(): string[] {
  const problems: string[] = [];

  /* S07 — istemci projection göndermezse eski kayda DOKUNULMAZ. */
  {
    const out = resolveUpdateProjection(
      writeInput({ rawInput: TEXT_PART }),
      TEXT_PART,
    );
    if (out !== undefined) {
      problems.push(
        "S07: projection göndermeyen update eski kaydı ezmeye çalıştı — " +
          "`undefined` dönmeliydi",
      );
    }
  }

  /* S10 — nesne modeli anahtarları. */
  {
    const base = projectionFromText(TEXT_DESK);
    const tampered = JSON.parse(
      JSON.stringify({
        ...base,
        fieldAuthority: {
          __proto__: { attributes: "USER_EXPLICIT" },
          constructor: { attributes: "USER_EXPLICIT" },
          prototype: { attributes: "USER_EXPLICIT" },
        },
      }),
    ) as RequestDiscoveryProjection;
    const out = createProjection(
      writeInput({ rawInput: TEXT_DESK, projection: tampered }),
    );
    const bagKeys = Object.keys(out?.fieldAuthority ?? {});
    for (const key of ["__proto__", "constructor", "prototype"]) {
      if (bagKeys.includes(key)) {
        problems.push(`S10: "${key}" otorite haritasına yazıldı`);
      }
      if (projectionAuthorityOf(out, key, "attributes") !== "UNKNOWN") {
        problems.push(`S10: "${key}" okuma sınırından UNKNOWN dönmedi`);
      }
    }
    const probe = {} as Record<string, unknown>;
    if (probe.attributes !== undefined) {
      problems.push("S10: global prototip kirlendi");
    }
  }

  /* S11 — metadata'sız legacy kayıt okuma sınırında UNKNOWN. */
  {
    const legacy = projectionFromText(TEXT_PART);
    delete legacy.fieldAuthority;
    for (const surface of SURFACES) {
      for (const key of ["model", "brand", "needType"]) {
        if (projectionAuthorityOf(legacy, key, surface) !== "UNKNOWN") {
          problems.push(
            `S11: metadata'sız legacy kayıt ${key}/${surface} için UNKNOWN ` +
              `dönmedi — eksik metadata hiçbir koşulda güvenilir sayılamaz`,
          );
        }
      }
    }
  }

  /* S12 — mutasyonsuzluk, idempotence, payload drift. */
  {
    const base = projectionFromText(TEXT_PART);
    const tampered = forgeAll(base, "USER_EXPLICIT");
    const before = JSON.stringify(tampered);
    const input = writeInput({
      rawInput: TEXT_PART,
      projection: tampered,
      fields: [{ key: "needType", value: "part" }],
    });
    const first = createProjection(input);
    if (JSON.stringify(tampered) !== before) {
      problems.push("S12: güven sınırı girdiyi MUTATE etti");
    }
    const second = createProjection(
      writeInput({
        rawInput: TEXT_PART,
        projection: clone(first),
        fields: [{ key: "needType", value: "part" }],
      }),
    );
    if (
      JSON.stringify(first?.fieldAuthority) !==
      JSON.stringify(second?.fieldAuthority)
    ) {
      problems.push(
        "S12: idempotent değil — kendi çıktısı ikinci geçişte farklı otorite " +
          "üretti",
      );
    }
    if (first && payloadSignatureOf(first) !== payloadSignatureOf(tampered)) {
      problems.push(
        "S12: değer payload'ı değişti — güven sınırı yalnız `fieldAuthority` " +
          "alanını yeniden yazmalıydı",
      );
    }
  }

  return problems;
}

/* ------------------------------------------------------------------ *
 * EDİT EKRANI CEVAP KANALI
 * ------------------------------------------------------------------ */

function measureEditChannel(problems: string[]): {
  channel: Map<string, string>;
  endToEnd: Map<string, Authority>;
} {
  const canonical = createTextOnlyState(TEXT_DESK);
  /* Edit ekranındaki `dynamicValues`ın taklidi: kullanıcının metninden gelen
   * değerler + kullanıcının DOKUNMADIĞI, yalnız çıkarımdan gelen `usageArea`. */
  const values: Record<string, string> = {
    condition: "İkinci el",
    productType: "Masa",
    furnitureType: "Masa",
    usageArea: "Ev",
  };
  const keys = Object.keys(values);

  const cases: Array<{
    id: string;
    values: Record<string, string>;
    touched: string[];
  }> = [
    { id: "E1", values, touched: [] },
    { id: "E2", values, touched: ["usageArea"] },
    { id: "E3", values: { ...values, usageArea: "Ofis" }, touched: [] },
  ];

  const channel = new Map<string, string>();
  for (const c of cases) {
    const out = buildPublishFieldValues({
      canonicalFields: canonical.fields,
      values: c.values,
      userTouchedKeys: c.touched,
    });
    for (const key of keys) {
      channel.set(`${c.id}/${key}`, out[key] ? "+" : "-");
    }
  }

  /* E4 — süzülmüş kanal update güven sınırına verilir. */
  const filtered = buildPublishFieldValues({
    canonicalFields: canonical.fields,
    values,
    userTouchedKeys: [],
  });
  const projection = forgeAll(projectionFromText(TEXT_DESK), "USER_EXPLICIT");
  const out = resolveUpdateProjection(
    writeInput({
      description: "Guncelleme",
      projection,
      fields: Object.entries(filtered).map(([key, value]) => ({ key, value })),
    }),
    TEXT_DESK,
  );
  const endToEnd = new Map<string, Authority>();
  for (const key of keys) {
    endToEnd.set(
      `E4/${key}/attributes`,
      projectionAuthorityOf(out, key, "attributes"),
    );
  }

  /**
   * EDİT EKRANI GERÇEKTEN KANONİK SÜZGECE BAĞLI MI?
   *
   * Yukarıdaki ölçüm süzgecin KENDİSİNİ doğrular; ekranın o süzgeci
   * ÇAĞIRDIĞINI doğrulamaz. React gönderim işleyicisi burada koşturulamadığı
   * için bağ kaynak seviyesinde denetlenir: ekran süzgeci içeri almalı ve
   * `fields[]` değerlerini süzülmüş torbadan okumalıdır.
   */
  const formPath = path.join(
    __dirname,
    "..",
    "src",
    "components",
    "panel",
    "EditRequestForm.tsx",
  );
  const source = fs.readFileSync(formPath, "utf8");
  if (!source.includes("buildPublishFieldValues")) {
    problems.push(
      "EditRequestForm kanonik yayın süzgecini (`buildPublishFieldValues`) " +
        "hiç çağırmıyor — onaysız tahmin cevap kanalına girebilir",
    );
  }
  if (/value:\s*dynamicValues\[field\.key\]/.test(source)) {
    problems.push(
      "EditRequestForm `fields[]` değerlerini hâlâ doğrudan `dynamicValues`tan " +
        "okuyor — süzülmemiş tahmin kullanıcı cevabı olarak kalıcılaşır",
    );
  }

  return { channel, endToEnd };
}

/* ------------------------------------------------------------------ *
 * BÜTÜNLÜK
 * ------------------------------------------------------------------ */

function checkIntegrity(): string[] {
  const problems: string[] = [];
  const fixturePath = path.join(
    __dirname,
    "fixtures",
    "projection-server-authority-v1.ts",
  );
  const fixture = fs.readFileSync(fixturePath, "utf8");
  if (/^\s*import\s/m.test(fixture)) {
    problems.push(
      "fixture: dondurulmuş taban `import` içeriyor — bağımsız veri " +
        "otoritesi olmaktan çıkar ve üretim kodu bozulduğunda birlikte kayar",
    );
  }

  const self = fs.readFileSync(__filename.replace(/\.js$/, ".ts"), "utf8");
  if (/from\s+["'][^"']*prisma/.test(self)) {
    problems.push(
      "doğrulayıcı Prisma'ya bağlandı — bu batarya DB yazmadan koşmalıdır",
    );
  }

  const seen = new Set<string>();
  for (const row of FROZEN_SERVER_AUTHORITY_IDENTITIES) {
    const parsed = parseFrozenRow(row);
    if (!parsed) {
      problems.push(`fixture: okunamayan satır "${row}"`);
      continue;
    }
    if (seen.has(parsed.id)) {
      problems.push(`fixture: yinelenen kimlik "${parsed.id}"`);
    }
    seen.add(parsed.id);
  }
  return problems;
}

/* ------------------------------------------------------------------ */

function main(): void {
  const problems: string[] = [];

  const measured = measureIdentities(problems);
  problems.push(...checkContracts());
  const edit = measureEditChannel(problems);
  problems.push(...checkIntegrity());

  /* İKİ YÖNLÜ KİMLİK KARŞILAŞTIRMASI */
  const frozen = new Map<string, string>();
  for (const row of FROZEN_SERVER_AUTHORITY_IDENTITIES) {
    const parsed = parseFrozenRow(row);
    if (parsed) frozen.set(parsed.id, parsed.value);
  }

  const missing: string[] = [];
  const mismatched: string[] = [];
  for (const [id, expected] of frozen) {
    const actual = measured.get(id);
    if (actual === undefined) {
      missing.push(id);
      continue;
    }
    if (actual !== expected) {
      mismatched.push(`${id}: beklenen ${expected}, ölçülen ${actual}`);
    }
  }
  const unexpected = [...measured.keys()].filter((id) => !frozen.has(id)).sort();

  for (const id of missing) {
    problems.push(
      `taban: ${id} ölçüm evreninden KAYBOLDU — kimlik kaybı "sahte otorite 0" ` +
        `hükmünü sahte yeşile çevirir`,
    );
  }
  for (const row of mismatched) problems.push(`otorite: ${row}`);
  for (const id of unexpected) {
    problems.push(`taban: ${id} dondurulmuş tabanda YOK — açıklanamayan kimlik`);
  }

  /* SEVİYE DAĞILIMI */
  const tally: Record<Authority, number> = {
    UNKNOWN: 0,
    INFERRED: 0,
    VERIFIED: 0,
    USER_EXPLICIT: 0,
  };
  for (const authority of measured.values()) tally[authority] += 1;
  for (const level of Object.keys(tally) as Authority[]) {
    if (tally[level] !== SERVER_AUTHORITY_BASELINE[level]) {
      problems.push(
        `dağılım ${level}: ölçüldü ${tally[level]}, taban ` +
          `${SERVER_AUTHORITY_BASELINE[level]}`,
      );
    }
  }
  if (measured.size !== SERVER_AUTHORITY_BASELINE.identities) {
    problems.push(
      `kimlik sayısı ${measured.size}, taban ` +
        `${SERVER_AUTHORITY_BASELINE.identities}`,
    );
  }

  /* EDİT KANALI */
  let editDrift = 0;
  for (const row of FROZEN_EDIT_ANSWER_CHANNEL) {
    const parsed = parseFrozenRow(row);
    if (!parsed) continue;
    const actual = edit.channel.get(parsed.id);
    if (actual !== parsed.value) {
      editDrift += 1;
      problems.push(
        `edit kanalı: ${parsed.id} beklenen "${parsed.value}", ölçülen ` +
          `"${actual ?? "(ölçülmedi)"}"`,
      );
    }
  }
  let editEndToEndDrift = 0;
  for (const row of FROZEN_EDIT_END_TO_END) {
    const parsed = parseFrozenRow(row);
    if (!parsed) continue;
    const actual = edit.endToEnd.get(parsed.id);
    if (actual !== parsed.value) {
      editEndToEndDrift += 1;
      problems.push(
        `edit uçtan uca: ${parsed.id} beklenen ${parsed.value}, ölçülen ` +
          `${actual ?? "(ölçülmedi)"}`,
      );
    }
  }

  /* ---- MAKİNE ÖZETİ ---- */
  console.log("===== SUNUCU GUVEN SINIRI V1 =====");
  console.log(`FROZEN_IDENTITIES=${frozen.size}`);
  console.log(`MEASURED_IDENTITIES=${measured.size}`);
  console.log(`IDENTITY_MISSING=${missing.length}`);
  console.log(`IDENTITY_UNEXPECTED=${unexpected.length}`);
  console.log(`AUTHORITY_MISMATCH=${mismatched.length}`);
  console.log(
    `LEVELS=UNKNOWN:${tally.UNKNOWN} INFERRED:${tally.INFERRED} ` +
      `VERIFIED:${tally.VERIFIED} USER_EXPLICIT:${tally.USER_EXPLICIT}`,
  );
  console.log(`EDIT_CHANNEL_DRIFT=${editDrift}`);
  console.log(`EDIT_END_TO_END_DRIFT=${editEndToEndDrift}`);

  console.log("\n===== HUKUM =====");
  if (problems.length > 0) {
    console.log(`KIRMIZI — ${problems.length} ihlal:`);
    for (const p of problems.slice(0, 60)) console.log(`  - ${p}`);
    if (problems.length > 60) {
      console.log(`  ... ve ${problems.length - 60} ihlal daha`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(
    "YESIL — istemcinin gönderdiği hiçbir otorite etiketi kabul edilmedi;\n" +
      "her seviye sunucunun kendi metninden ya da süzülmüş cevap kanalından\n" +
      "yeniden türetildi; katalog doğrulaması cevap kanalıyla ezilmedi;\n" +
      "türetilemeyen alanlar UNKNOWN kaldı; uydurma, iç kanıt ve nesne modeli\n" +
      "anahtarları haritadan silindi; clone yeni kullanıcı beyanı üretmedi;\n" +
      "edit ekranının onaysız tahminleri cevap kanalına girmedi; değer\n" +
      "payload'ı değişmedi ve güven sınırı girdiyi mutate etmedi.",
  );
}

main();
