/**
 * Smoke checks for automotive / cross-category brand parsing.
 * Run from apps/web: npx tsx scripts/verify-brand-parser.mjs
 */

import assert from "node:assert/strict";
import { parseRequest } from "../src/lib/ai/parser/parser.ts";
import { detectCategoryId } from "../src/lib/ai/parser/category.ts";
import {
  AUTOMOTIVE_BRANDS,
  findAutomotiveModel,
  findBrand,
} from "../src/lib/ai/parser/brand-catalog.ts";

assert.equal(findBrand("vw passat", AUTOMOTIVE_BRANDS), "Volkswagen");
assert.equal(findBrand("pejo 301", AUTOMOTIVE_BRANDS), "Peugeot");
assert.equal(findAutomotiveModel("2015 BMW 3.20", "BMW"), "3.20");
assert.equal(findAutomotiveModel("Toyota Corolla arıyorum", "Toyota"), "Corolla");

const samples = [
  {
    text: "2015 BMW 3.20 arıyorum",
    categoryId: "automotive",
    brand: "BMW",
    model: "3.20",
    modelYear: 2015,
  },
  {
    text: "Toyota Corolla arıyorum",
    categoryId: "automotive",
    brand: "Toyota",
    model: "Corolla",
  },
  {
    text: "VW Golf hatasız olsun",
    categoryId: "automotive",
    brand: "Volkswagen",
    model: "Golf",
  },
  {
    text: "Togg T10X ikinci el",
    categoryId: "automotive",
    brand: "Togg",
    model: "T10X",
  },
  {
    text: "Renault Clio 2018 İstanbul",
    categoryId: "automotive",
    brand: "Renault",
    model: "Clio",
    modelYear: 2018,
  },
  {
    text: "2013 model Mercedes C kasa arıyorum",
    categoryId: "automotive",
    brand: "Mercedes",
    model: "C kasa",
    modelYear: 2013,
  },
  {
    text: "Dacia Duster arıyorum",
    categoryId: "automotive",
    brand: "Dacia",
    model: "Duster",
  },
  {
    text: "Bosch buzdolabı no-frost",
    categoryId: "appliances",
    brandPreference: "Bosch",
  },
  {
    text: "iPhone 14 arıyorum",
    categoryId: "technology",
    solutionType: "iPhone 14",
    needType: "hardware",
  },
  {
    text: "Ben ne arıyorum biliyo musun 16 pro max arıyorum temiz olsun ucuz olsun baba",
    categoryId: "technology",
    solutionType: "iPhone 16 Pro Max",
    needType: "hardware",
  },
  {
    text: "15 pro arıyorum",
    categoryId: "technology",
    solutionType: "iPhone 15 Pro",
    needType: "hardware",
  },
  {
    text: "s24 ultra lazım",
    categoryId: "technology",
    solutionType: "Samsung Galaxy S24 Ultra",
    needType: "hardware",
  },
  {
    text: "airpods pro istiyorum",
    categoryId: "technology",
    solutionType: "AirPods Pro",
    needType: "hardware",
  },
  {
    text: "Chicco bebek arabası",
    categoryId: "baby",
    brandPreference: "Chicco",
  },
  {
    text: "kartvizit",
    categoryId: "printing",
  },
  {
    text: "500 adet kartvizit mat selefon",
    categoryId: "printing",
  },
  {
    text: "flyer baskı 1000 adet",
    categoryId: "printing",
  },
  {
    text: "kraft kutu ambalaj",
    categoryId: "printing",
  },
  {
    text: "afiş baskı lazım",
    categoryId: "printing",
  },
  {
    text: "etiket baskı istiyorum",
    categoryId: "printing",
  },
  {
    text: "12 kişilik yemek takımı",
    categoryId: "home-kitchen",
  },
  {
    text: "tekerlekli sandalye",
    categoryId: "health",
  },
  {
    text: "cnc kesim makinesi",
    categoryId: "machinery",
  },
  {
    text: "temizlik hizmeti ofis",
    categoryId: "services",
  },
];

for (const sample of samples) {
  const categoryId = detectCategoryId(sample.text);
  assert.equal(
    categoryId,
    sample.categoryId,
    `category for "${sample.text}": expected ${sample.categoryId}, got ${categoryId}`,
  );

  const parsed = parseRequest(sample.text);
  assert.equal(parsed.categoryId, sample.categoryId, sample.text);

  if (sample.brand) {
    assert.equal(
      parsed.attributes.brand,
      sample.brand,
      `brand for "${sample.text}"`,
    );
  }
  if (sample.model) {
    assert.equal(
      parsed.attributes.model,
      sample.model,
      `model for "${sample.text}"`,
    );
  }
  if (sample.modelYear) {
    assert.equal(
      parsed.attributes.modelYear,
      sample.modelYear,
      `year for "${sample.text}"`,
    );
  }
  if (sample.brandPreference) {
    assert.equal(
      parsed.attributes.brandPreference,
      sample.brandPreference,
      `brandPreference for "${sample.text}"`,
    );
  }
  if (sample.solutionType) {
    assert.equal(
      parsed.attributes.solutionType,
      sample.solutionType,
      `solutionType for "${sample.text}"`,
    );
  }
  if (sample.needType) {
    assert.equal(
      parsed.attributes.needType,
      sample.needType,
      `needType for "${sample.text}"`,
    );
  }

  console.log("ok:", sample.text, "→", {
    categoryId: parsed.categoryId,
    brand: parsed.attributes.brand,
    model: parsed.attributes.model,
    modelYear: parsed.attributes.modelYear,
    brandPreference: parsed.attributes.brandPreference,
    needType: parsed.attributes.needType,
    solutionType: parsed.attributes.solutionType,
  });
}

console.log(`\nAll ${samples.length} smoke samples passed.`);
