/**
 * KAPI: JEV ROTA BAGLANTISI — YOL KURULDU, ANAHTAR CEVRILMEDI (2026-09-21).
 *
 * NE KANITLAR. `fetchJevDecisions` yazilmisti ama istek yolundan HIC
 * cagrilmiyordu; bu kapi o bagin kuruldugunu ve DOGRU SEKILDE kuruldugunu
 * olcer. Uc ayri sey iddia edilir ve ucu de kirmiziya baglanir:
 *
 *   1) URETIM GECISI HALA KAPALI. `USE_JEV_IN_PRODUCTION` bir davranis
 *      degisikligidir ve ayri, acik onay ister (S-16). Bu satir yanlislikla
 *      acilirsa kapi kirmizi verir — bayragin sessizce acilmasi mumkun degil.
 *   2) GECIS KAPALIYKEN AG CAGRISI YAPILMAZ. Anahtar ortamda olsa bile demet
 *      cozucusu `null` doner: kapali bir sagilayicinin parasini ve gecikmesini
 *      odemek kabul edilemez. Cozucu bu kosuda SAHTE bir anahtarla cagrilir;
 *      ag'a ciksaydi bu kapi CI'da ya asilir ya kirmizi verirdi.
 *   3) SERBEST METNI BEYNE VEREN HER SUNUCU YOLU DEMETI TASIR. Tek ornek
 *      duzeltmek yetmez: asagidaki liste SINIFTIR. Yeni bir sunucu yolu
 *      kullanicinin metnini beyne verip demeti tasimazsa, gecis acildigi gun
 *      o yol sessizce yerlesik motorda kalirdi — yani iki farkli beyin ayni
 *      talep hakkinda karar verirdi. Kapi bunu simdiden kirmiziya baglar.
 *
 * AG GEREKTIRMEZ. Deterministiktir, CI'da kosar. Jev'in KARAR KALITESI bu
 * kapinin konusu degildir; onu `verify-jev-decision-provider-v1` olcer (ag ister).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  getRequestDecisionProvider,
  getRequestDecisionProviderForRequest,
  shouldFetchJevBundle,
} from "@/lib/request-decisions/get-provider";
import { resolveJevBundle } from "@/server/request-decisions/resolve-jev-bundle";

const satir: string[] = [];
let kirmizi = 0;

function kontrol(ok: boolean, ad: string, detay = ""): void {
  if (!ok) kirmizi += 1;
  satir.push(`${ok ? "  yesil" : "  KIRMIZI"}  ${ad}${detay ? `   [${detay}]` : ""}`);
}

async function main(): Promise<void> {
  satir.push("\n--- URETIM GECISI KAPALI MI ---");
  kontrol(
    shouldFetchJevBundle() === false,
    "USE_JEV_IN_PRODUCTION kapali (demet cekim kapisi da kapali)",
    "acilmasi ayri ve acik onay ister (S-16)",
  );
  kontrol(
    getRequestDecisionProvider().name === getRequestDecisionProviderForRequest(null).name,
    "demet yokken istek-basina saglayici yerlesik motorun ta kendisi",
  );

  satir.push("\n--- GECIS KAPALIYKEN AG CAGRISI YOK ---");
  {
    const onceki = process.env.TYPESAFE_API_KEY;
    /* Sahte anahtar: gercek bir sir hicbir kosuda kullanilmaz, hicbir ciktiya yazilmaz. */
    process.env.TYPESAFE_API_KEY = "test-anahtari-degil-gercek";
    const bundle = await resolveJevBundle("Ağrı kesici arıyorum");
    if (onceki === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = onceki;
    kontrol(bundle === null, "anahtar varken bile demet cekilmedi (gecis kapali)");
  }
  kontrol((await resolveJevBundle("")) === null, "bos metin demet cekmez");

  satir.push("\n--- SERBEST METNI BEYNE VEREN SUNUCU YOLLARI DEMETI TASIR ---");
  {
    /**
     * Istemci tarafi BILEREK disarida: API anahtari tarayiciya inmez, bu yuzden
     * tarama yalnizca sunucuda kosan yollari kapsar.
     */
    const YOLLAR = [
      "src/app/api/requests/route.ts",
      "src/app/api/requests/[id]/route.ts",
      "src/app/api/matching/estimate/route.ts",
      "src/app/api/price-intelligence/preview/route.ts",
      "src/server/price-intelligence/run-price-intelligence-preview.ts",
      "src/server/request/request-schema.ts",
    ];
    for (const yol of YOLLAR) {
      const metin = readFileSync(join(process.cwd(), yol), "utf8");
      const cozucuVar = /resolveJevBundle\s*\(/.test(metin);
      const demetTasiyor = /decisionBundle/.test(metin);
      kontrol(
        cozucuVar || demetTasiyor,
        `demet tasiniyor: ${yol}`,
        cozucuVar ? "cozucu cagriliyor" : "demet parametre olarak geciyor",
      );
    }

    /* Cozucu TEK yerde yasamali: her rotanin kendi cagrisi ayri bir sozlesme olurdu. */
    const cozucu = readFileSync(
      join(process.cwd(), "src/server/request-decisions/resolve-jev-bundle.ts"),
      "utf8",
    );
    kontrol(
      /fetchJevDecisions\s*\(/.test(cozucu),
      "ag cagrisi tek cozucude toplanmis",
    );
    kontrol(
      /TYPESAFE_API_KEY/.test(cozucu),
      "anahtar yalniz ortam degiskeninden okunuyor",
    );
  }

  console.log("=== verify-jev-route-wiring-v1 ===");
  console.log(satir.join("\n"));
  const yesilSayisi = satir.filter((l) => l.startsWith("  yesil")).length;
  console.log(
    `\n${yesilSayisi}/${yesilSayisi + kirmizi} yesil` +
      (kirmizi ? `  · ${kirmizi} KIRMIZI` : "  ·  yol kurulu, anahtar cevrilmemis"),
  );
  process.exit(kirmizi ? 1 : 0);
}

void main();
