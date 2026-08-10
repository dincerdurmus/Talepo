/**
 * Phase 5.1 — Professional draft quality spot checks (no LLM, rule-based composer).
 * Run: npx tsx scripts/verify-professional-draft-qa.ts
 */
import assert from "node:assert/strict";

import { composeProfessionalDescription } from "../src/lib/ai/request-text-composer";
import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = "") {
  console.log(`${label}: ${ok ? "PASS" : "FAIL"}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
}

function cat(id: string) {
  return REQUEST_CATEGORIES.find((c) => c.id === id)!;
}

// RETAIL_PRODUCT — technology hardware
{
  const text = composeProfessionalDescription({
    categoryId: "technology",
    rawText: "Apple iPhone 15 Pro Max 256GB sıfır",
    attributes: { needType: "hardware", solutionType: "iPhone 15 Pro Max", specs: "256 GB" },
    city: "İstanbul",
    budget: 85000,
    fields: cat("technology").fields,
    fieldValues: { needType: "hardware", solutionType: "iPhone 15 Pro Max", specs: "256 GB" },
    commonDraft: { title: "iPhone 15 Pro Max", city: "İstanbul", budget: "85.000 TL", quantity: "", delivery: "" },
  });
  const opening = text.split("\n")[0] ?? text;
  check("RETAIL no fabricated condition in opening", !opening.toLowerCase().includes("ikinci el") && !opening.toLowerCase().includes("sıfır"), opening.slice(0, 80));
  check("RETAIL keeps product name", text.includes("iPhone"), "");
  check("RETAIL no fake budget change", !text.includes("90000") && !text.includes("90.000"), "");
}

// VEHICLE
{
  const text = composeProfessionalDescription({
    categoryId: "automotive",
    rawText: "2022 Toyota Corolla",
    attributes: { needType: "vehicle", brand: "Toyota", model: "Corolla", modelYear: "2022" },
    city: "Ankara",
    fields: cat("automotive").fields,
    fieldValues: { needType: "vehicle", brand: "Toyota", model: "Corolla", modelYear: "2022" },
    commonDraft: { title: "Toyota Corolla 2022", city: "Ankara", budget: "", quantity: "", delivery: "" },
  });
  check("VEHICLE mentions brand/model", text.includes("Toyota") && text.includes("Corolla"), text.slice(0, 100));
  check("VEHICLE no fabricated mileage", !text.includes("50.000 km") && !text.includes("50000"), "");
}

// CUSTOM_MANUFACTURING
{
  const text = composeProfessionalDescription({
    categoryId: "printing",
    rawText: "5000 adet baskılı kutu",
    attributes: { quantity: "5000", dimensions: "20x30 cm", material: "350 gr mat kuşe" },
    fields: cat("printing").fields,
    fieldValues: { quantity: "5000", dimensions: "20x30 cm", material: "350 gr mat kuşe" },
    commonDraft: { title: "Baskılı kutu", city: "", budget: "", quantity: "5000 adet", delivery: "" },
  });
  check("PRINTING mentions quantity", text.includes("5000") || text.includes("5.000"), text.slice(0, 100));
  check("PRINTING no fake lamination", !text.toLowerCase().includes("selefon") || text.includes("kuşe"), "");
}

// SERVICE_SCOPE
{
  const text = composeProfessionalDescription({
    categoryId: "services",
    rawText: "200 m2 boya badana",
    attributes: { serviceType: "boya badana", scope: "200 m²" },
    city: "İstanbul",
    fields: cat("services").fields,
    fieldValues: { serviceType: "boya badana", scope: "200 m²" },
    commonDraft: { title: "Boya badana", city: "İstanbul", budget: "", quantity: "", delivery: "" },
  });
  check("SERVICE mentions scope", text.toLowerCase().includes("boya") || text.includes("200"), text.slice(0, 100));
  check("SERVICE no fabricated warranty", !text.toLowerCase().includes("2 yıl garanti"), "");
}

console.log(`\nProfessional draft QA: ${pass}/${pass + fail} PASS\n`);
if (fail > 0) process.exit(1);
console.log("PROFESSIONAL DRAFT QA: PASS");
