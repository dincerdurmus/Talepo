/**
 * Cross-category slang → product/category → corporate AI Core smoke.
 * Run: npx tsx scripts/smoke-phone-parse.mjs
 */
import assert from "node:assert/strict";
import { parseRequest } from "../src/lib/ai/parser/parser.ts";
import {
  composeRequestTitle,
  composeProfessionalDescription,
} from "../src/lib/ai/request-text-composer.ts";
import { runTalepoAiCore } from "../src/lib/ai/orchestrator.ts";

/** True slang echoes only — avoid false hits like "İlan" containing "lan". */
function hasSlangEcho(text) {
  return [
    /biliyo/i,
    /biliyosun/i,
    /(?:^|[^A-Za-zÇĞİÖŞÜçğıöşü])(baba|abi|kral|lan|valla|yani|şey|sey)(?:[^A-Za-zÇĞİÖŞÜçğıöşü]|$)/i,
    /ucuz olsun/i,
    /arıyom/i,
    /ben ne/i,
  ].some((re) => re.test(text));
}

const samples = [
  {
    text: "Ben ne arıyorum biliyo musun 16 pro max arıyorum temiz olsun ucuz olsun baba",
    categoryId: "technology",
    titleIncludes: "iPhone 16 Pro Max",
    solutionType: "iPhone 16 Pro Max",
  },
  {
    text: "kral s24 ultra lazım temiz olsun abi",
    categoryId: "technology",
    titleIncludes: "Samsung Galaxy S24 Ultra",
    solutionType: "Samsung Galaxy S24 Ultra",
  },
  {
    text: "ya samsung 24 arıyom valla",
    categoryId: "technology",
    titleIncludes: "Samsung Galaxy S24",
    solutionType: "Samsung Galaxy S24",
  },
  {
    text: "airpods pro istiyom ucuz olsun lan",
    categoryId: "technology",
    titleIncludes: "AirPods Pro",
    solutionType: "AirPods Pro",
  },
  {
    text: "macbook air lazım ofis için biliyosun",
    categoryId: "technology",
    titleIncludes: "MacBook Air",
    solutionType: "MacBook Air",
  },
  {
    text: "redmi note 13 pro arıyom abi",
    categoryId: "technology",
    titleIncludes: "Redmi Note 13 Pro",
    solutionType: "Redmi Note 13 Pro",
  },
  {
    text: "ya bağcılar da 2+1 kiralık daire arıyom abi",
    categoryId: "real-estate",
    titleIncludes: "kiralık",
    listingType: "Kiralık",
  },
  {
    text: "bosch buzdolabı no frost lazım kral ucuz olsun",
    categoryId: "appliances",
    titleIncludes: "Buzdolabı",
    applianceType: "Buzdolabı",
  },
  {
    text: "ofis sandalyesi lazım abi ergonomik olsun yani",
    categoryId: "furniture",
    titleIncludes: "sandalye",
    furnitureType: "Ofis sandalyesi",
  },
  {
    text: "2015 bmw 3.20 arıyom hatasız olsun baba",
    categoryId: "automotive",
    titleIncludes: "BMW",
    brand: "BMW",
  },
  {
    text: "ipad pro istiyom şey temiz olsun",
    categoryId: "technology",
    titleIncludes: "iPad Pro",
    solutionType: "iPad Pro",
  },
  {
    text: "valla toyota corolla 2018 arıyorum ikinci el",
    categoryId: "automotive",
    titleIncludes: "Toyota",
    brand: "Toyota",
  },
  {
    text: "500 adet kartvizit lazım mat selefon olsun abi",
    categoryId: "printing",
    titleIncludes: "kartvizit",
  },
  {
    text: "kraft kutu baskı istiyom 35x25x8",
    categoryId: "printing",
    titleIncludes: "kutu",
  },
  {
    text: "flyer baskı lazım 1000 adet",
    categoryId: "printing",
    titleIncludes: "flyer",
  },
  {
    text: "katalog baskısı yaptırmak istiyorum",
    categoryId: "printing",
    titleIncludes: "katalog",
  },
  {
    text: "tekerlekli sandalye lazım hastane için",
    categoryId: "health",
    titleIncludes: "sandalye",
  },
  {
    text: "chicco bebek arabası arıyom",
    categoryId: "baby",
    titleIncludes: "bebek",
  },
  {
    text: "12 kişilik yemek takımı lazım",
    categoryId: "home-kitchen",
    titleIncludes: "yemek",
  },
  {
    text: "cnc kesim makinesi arıyorum",
    categoryId: "machinery",
    titleIncludes: "CNC",
  },
  {
    text: "temizlik hizmeti lazım ofis için",
    categoryId: "services",
    titleIncludes: "temizlik",
  },
];

const results = [];

for (const sample of samples) {
  const parsed = parseRequest(sample.text);
  const title = composeRequestTitle({
    categoryId: parsed.categoryId,
    rawText: sample.text,
    attributes: parsed.attributes,
    city: parsed.city,
  });
  const professional = composeProfessionalDescription({
    categoryId: parsed.categoryId,
    rawText: sample.text,
    attributes: parsed.attributes,
    city: parsed.city,
    fields: Object.keys(parsed.attributes).map((key) => ({
      key,
      label: key,
      type: "text",
    })),
    fieldValues: Object.fromEntries(
      Object.entries(parsed.attributes).map(([key, value]) => [
        key,
        String(value),
      ]),
    ),
  });
  const core = runTalepoAiCore(sample.text);

  assert.equal(
    parsed.categoryId,
    sample.categoryId,
    `category for "${sample.text}": got ${parsed.categoryId}`,
  );
  assert.ok(
    title.toLocaleLowerCase("tr-TR").includes(
      sample.titleIncludes.toLocaleLowerCase("tr-TR"),
    ),
    `title for "${sample.text}": got "${title}", expected to include "${sample.titleIncludes}"`,
  );
  assert.ok(!hasSlangEcho(title), `title still has slang: "${title}"`);
  assert.ok(
    !hasSlangEcho(professional),
    `professional still has slang for "${sample.text}": ${professional}`,
  );
  assert.ok(
    !hasSlangEcho(core.professionalText),
    `AI Core still has slang for "${sample.text}": ${core.professionalText}`,
  );

  if (sample.solutionType) {
    assert.equal(
      parsed.attributes.solutionType,
      sample.solutionType,
      `solutionType for "${sample.text}"`,
    );
  }
  if (sample.listingType) {
    assert.equal(parsed.attributes.listingType, sample.listingType);
  }
  if (sample.applianceType) {
    assert.equal(parsed.attributes.applianceType, sample.applianceType);
  }
  if (sample.furnitureType) {
    assert.equal(parsed.attributes.furnitureType, sample.furnitureType);
  }
  if (sample.brand) {
    assert.equal(parsed.attributes.brand, sample.brand);
  }

  results.push({
    text: sample.text,
    categoryId: parsed.categoryId,
    title,
    professional: professional.split("\n\n")[0],
  });
}

console.log(JSON.stringify(results, null, 2));
console.log(`\nAll ${samples.length} cross-category smoke samples passed.`);
