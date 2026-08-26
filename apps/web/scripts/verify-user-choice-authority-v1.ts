/**
 * AÇIK KULLANICI SEÇİMİ OTORİTESİ V1 — D2 eki (2026-08-26).
 *
 * İKİ SÖZLEŞMEYİ ÖLÇER.
 *
 * 1. OTORİTE SIRASI HER YENİDEN ANALİZDE KORUNUR.
 *    USER_CONFIRMED / USER_EXPLICIT > VERIFIED > INFERRED > UNKNOWN.
 *    Kullanıcı `needType` için açıkça PART ya da SERVICE seçtiğinde,
 *    `understand-request` içindeki semantik özne dalları bu değeri yeniden
 *    `INFERRED` seviyesine düşüremez. Düşürdüğünde üç şey birden bozuluyordu:
 *    değer çıkarıma dönüşüyor, soru yeniden açılıyor ve kullanıcı aynı
 *    seçimi ikinci kez yapmak zorunda kalıyordu.
 *
 * 2. SEÇİM YAYIN VERİSİNE ULAŞIR — VE RAWINPUT'A DOKUNMAZ.
 *    Yalnız React state'inde duran bir cevap başarı değildir: kullanıcının
 *    seçtiği değer yayın payload'ına (discoveryProjection) girmelidir. Aynı
 *    anda `rawInput` kullanıcının yazdığı metin olarak BİREBİR kalmalı;
 *    ne makine slug'ı ("vehicle") ne de arayüz etiketi ("Araç") oraya
 *    eklenmemelidir.
 *
 * Bu doğrulayıcı SALT-OKUNURDUR ve HİÇBİR veritabanı yazımı yapmaz; yayın
 * zinciri, gerçek `/api/requests` çağrısının kullandığı ile AYNI kurucu
 * fonksiyonlar üzerinden kurulur.
 */

import {
  syncFromBrowse,
  syncFromText,
} from "../src/lib/request-composer";
import type { CanonicalRequestState } from "../src/lib/request-composer/types";
import {
  classifyAnswerAuthority,
  mayCloseQuestion,
} from "../src/lib/request-composer/answer-authority";
import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import { buildPublishUnderstandingSnapshot } from "../src/lib/request/publish-understanding";
import { attributeAuthorityOf } from "../src/lib/request-understanding/provenance";
import { walkQuestionWaves } from "./lib/question-wave-walk-v1";

type FieldLike = {
  kind?: string;
  value?: unknown;
  provenance?: string;
};

function fieldOf(state: CanonicalRequestState, key: string): FieldLike | null {
  return (state.fields as Record<string, FieldLike>)[key] ?? null;
}

/** Kullanıcının yapısal seçimi — üretimde `structured.fieldValues` kanalı. */
const USER_PICKS: readonly { input: string; needType: string; why: string }[] = [
  {
    input: "yedek parça arıyorum",
    needType: "part",
    why: "PART dalı semantik özneden yeniden yazıyordu",
  },
  {
    input: "servis arıyorum",
    needType: "service",
    why: "SERVICE dalı semantik özneden yeniden yazıyordu",
  },
  {
    input: "Mercedes C180 satın almak istiyorum",
    needType: "vehicle",
    why: "VEHICLE dalı zaten korumalıydı — regresyon nöbeti",
  },
  {
    input: "forklift arıyorum",
    needType: "machine",
    why: "MACHINE dalı — regresyon nöbeti",
  },
];

function main(): void {
  const problems: string[] = [];

  console.log("=== ACIK KULLANICI SECIMI OTORITESI V1 ===");
  console.log(
    "otorite sirasi: USER_CONFIRMED / USER_EXPLICIT > VERIFIED > INFERRED > UNKNOWN\n",
  );

  /* ---- (1) YAPISAL SEÇİM ÇIKARIMA DÜŞMEZ ---- */
  console.log("--- structured.fieldValues.needType ---");
  for (const pick of USER_PICKS) {
    const { state } = syncFromText(null, pick.input, {
      structured: { fieldValues: { needType: pick.needType } },
    });
    const field = fieldOf(state, "needType");
    const authority = classifyAnswerAuthority(field);
    const value = String(field?.value ?? "");
    const attr = (
      state.understanding as unknown as {
        attributes?: Record<string, { value?: unknown }>;
      }
    ).attributes?.needType;
    const attrAuthority = attributeAuthorityOf(attr as never);

    const valueOk = value === pick.needType;
    const authorityOk = mayCloseQuestion(authority);
    const attrOk = attrAuthority === "USER_EXPLICIT";
    const walk = walkQuestionWaves(state);
    const notReAsked = !walk.asked.includes("needType");

    const ok = valueOk && authorityOk && attrOk && notReAsked;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${JSON.stringify(pick.input)} + needType=${pick.needType} → ` +
        `deger='${value}' otorite=${authority} attr=${attrAuthority} ` +
        `tekrarSoruldu=${!notReAsked}`,
    );
    if (!valueOk) {
      problems.push(
        `${pick.input}: seçilen değer korunmadı → '${value}' (${pick.why})`,
      );
    }
    if (!authorityOk) {
      problems.push(
        `${pick.input}: provenance düştü → ${authority} (${pick.why})`,
      );
    }
    if (!attrOk) {
      problems.push(
        `${pick.input}: anlama attribute otoritesi düştü → ${attrAuthority}`,
      );
    }
    if (!notReAsked) {
      problems.push(`${pick.input}: needType yeniden soruldu`);
    }
  }

  /* ---- (2) YENİDEN ANALİZ OTORİTEYİ DÜŞÜRMEZ ---- */
  console.log("\n--- yeniden analiz (metin tekrar okunur) ---");
  for (const pick of USER_PICKS) {
    const first = syncFromText(null, pick.input).state;
    const picked = syncFromBrowse(first, {
      key: "needType",
      value: pick.needType,
    }).state;
    const beforeAuthority = classifyAnswerAuthority(fieldOf(picked, "needType"));
    // Kullanıcı metne dokunmadan başka bir tetik gelirse (force re-sync):
    const reanalyzed = syncFromText(picked, pick.input, { force: true }).state;
    const after = fieldOf(reanalyzed, "needType");
    const afterAuthority = classifyAnswerAuthority(after);
    const valueKept = String(after?.value ?? "") === pick.needType;
    const authorityKept = mayCloseQuestion(afterAuthority);
    const ok = valueKept && authorityKept;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${JSON.stringify(pick.input)} → ` +
        `${beforeAuthority} → ${afterAuthority} deger='${String(after?.value ?? "")}'`,
    );
    if (!valueKept) {
      problems.push(
        `${pick.input}: yeniden analizde değer değişti → '${String(after?.value ?? "")}'`,
      );
    }
    if (!authorityKept) {
      problems.push(
        `${pick.input}: yeniden analizde provenance düştü → ${afterAuthority}`,
      );
    }
  }

  /* ---- (3) YAYIN ZİNCİRİ — DB YAZIMI YOK ---- */
  console.log("\n--- yayin zinciri (UI secim → state → payload) ---");
  {
    const base = "Mercedes C180 satın almak istiyorum";
    const initial = syncFromText(null, base).state;
    const picked = syncFromBrowse(initial, {
      key: "needType",
      value: "vehicle",
    }).state;

    const rawBefore = String(initial.understanding.rawInput ?? "");
    const rawAfter = String(picked.understanding.rawInput ?? "");
    if (rawBefore !== base) {
      problems.push(`rawInput seçim ÖNCESİ değişmiş → '${rawBefore}'`);
    }
    if (rawAfter !== base) {
      problems.push(`rawInput seçim SONRASI değişmiş → '${rawAfter}'`);
    }
    if (/vehicle|Talep türü/i.test(rawAfter)) {
      problems.push(`rawInput'a slug/etiket eklenmiş → '${rawAfter}'`);
    }

    const projection = buildDiscoveryProjectionFromState(picked);
    const attrValue = projection.attributes?.needType ?? null;
    const constraint = projection.constraints?.needType ?? null;
    if (attrValue !== "vehicle") {
      problems.push(
        `yayın payload'ında needType yok → attributes.needType='${String(attrValue)}'`,
      );
    }
    if (constraint?.mode !== "VALUE" || constraint?.value !== "vehicle") {
      problems.push(
        `yayın payload'ında needType kısıtı eksik → ${JSON.stringify(constraint)}`,
      );
    }

    const snapshot = buildPublishUnderstandingSnapshot({
      understanding: picked.understanding,
      userSelected: false,
      confirmedFieldKeys: ["needType"],
      primarySlug: picked.categoryId ?? null,
    });
    const snapshotAttr = snapshot.attributes?.needType?.value ?? null;
    if (snapshotAttr !== "vehicle") {
      problems.push(
        `understanding snapshot'ta needType yok → '${String(snapshotAttr)}'`,
      );
    }
    console.log(
      `rawInput once='${rawBefore}'\nrawInput sonra='${rawAfter}'\n` +
        `projection.attributes.needType='${String(attrValue)}'\n` +
        `projection.constraints.needType=${JSON.stringify(constraint)}\n` +
        `snapshot.attributes.needType='${String(snapshotAttr)}'`,
    );
  }

  console.log("\n===== HUKUM =====");
  if (problems.length) {
    console.error("KIRMIZI — acik kullanici secimi korunmuyor:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    "YESIL — acik secim cikarimla ezilmiyor, yeniden analizde otorite\n" +
      "dusmuyor ve secim rawInput'a dokunmadan yayin verisine ulasiyor.",
  );
  process.exit(0);
}

main();
