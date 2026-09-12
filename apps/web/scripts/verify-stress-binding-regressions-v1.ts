import { syncFromText, syncFromBrowse } from "../src/lib/request-composer/sync";
import { toResolverFieldBag } from "../src/lib/request-composer/build-state";
import { listProfilesForCategory } from "../src/lib/request-composer/v2/question-profiles";

const failures: string[] = [];
let checks = 0;
function check(name: string, passed: boolean, actual?: unknown) {
  checks++;
  if (!passed) failures.push(`${name}: ${JSON.stringify(actual)}`);
}
const fold = (v: unknown) => String(v ?? "").toLocaleLowerCase("tr-TR").replace(/ı/g, "i");
const cases: [string, Record<string, string>][] = [
  ["DAİRE DEĞİL ARSA ARIYORUM", { propertyType: "Arsa" }],
  ["Broşür değil kartvizit bastırmak istiyorum", { productType: "Kartvizit" }],
  ["2+1 değil 3+1 kiralık daire arıyorum", { roomCount: "3+1" }],
  ["Satılık değil kiralık daire arıyorum", { listingType: "Kiralık" }],
  ["55 inç değil 65 inç televizyon arıyorum", { screenSize: "65" }],
  ["Ofis için kiralık depo arıyorum", { propertyType: "Depo / antrepo" }],
  ["PlayStation 5 değil PlayStation 4 arıyorum", { model: "PlayStation 4" }],
  ["PLAYSTATION 4 ARIYORUM", { model: "PlayStation 4" }],
  ["Toyota Corolla 2018 için çıkma motor arıyorum", { partVehicleYear: "2018" }],
  ["32 sayfa A5 katalog bastırmak istiyorum", { publicationPageCount: "32", publicationFormat: "A5" }],
  ["5 x 8 cm rulo etiket bastırmak istiyorum", { labelDimensions: "5x8 cm" }],
  ["190 x 70 cm muayene masası arıyorum", { clinicalDimensions: "190x70 cm" }],
  ["240 ml cam biberon arıyorum", { feedingBottleCapacity: "240 ml" }],
  ["Uzaktan logo tasarımı hizmeti arıyorum", { city: "Uzaktan", locationMode: "remote" }],
];
for (const [text, expected] of cases) {
  const s = syncFromText(null, text).state;
  for (const [key, value] of Object.entries(expected)) check(`${text} → ${key}`, fold(s.fields[key]?.value) === fold(value), s.fields[key]);
  if (/PlayStation 5 değil/.test(text)) check("Model reddi Sony markasını dışlamaz", !(s.fields.brand?.excludedValues ?? []).includes("Sony"), s.fields.brand);
}
for (const [text, key, forbidden] of [
  ["Gardırop arıyorum, sürgülü olmasın", "wardrobeType", "Sürgülü"],
  ["Biberon arıyorum, cam olmasın", "feedingBottleMaterial", "Cam"],
  ["Buzdolabı arıyorum, No-Frost olmasın", "fridgeCoolingSystem", "No-Frost"],
]) {
  const s = syncFromText(null, text).state;
  check(`Reddedilen özellik olumlu cevap olmaz: ${text}`, fold(s.fields[key]?.value) !== fold(forbidden), s.fields[key]);
}
let part = syncFromText(null, "Toyota Corolla için motor arıyorum").state;
for (const [key, value] of [["brand", "Toyota"], ["model", "Corolla"], ["partVehicleYear", "2018"]]) part = syncFromBrowse(part, { key, value }).state;
part = syncFromText(part, "Honda Civic 2022 için fren balatası arıyorum").state;
for (const [key, value] of [["brand", "Honda"], ["model", "Civic"], ["partVehicleYear", "2022"]]) check(`Yeni uyumluluk ${key}`, part.fields[key]?.value === value, part.fields[key]);

for (const target of ["Ankara’da yerinde kombi servisi arıyorum", "Kombi servisi arıyorum"]) {
  let s = syncFromText(null, "Logo tasarımı hizmeti arıyorum").state;
  for (const [key, value] of [["city", "Uzaktan"], ["locationMode", "remote"], ["budget", "25000"]]) s = syncFromBrowse(s, { key, value }).state;
  s = syncFromText(s, target).state;
  check(`Fiziksel hizmet eski uzaktan konumunu almaz: ${target}`, s.fields.city?.value !== "Uzaktan" && s.fields.locationMode?.value !== "remote", s.fields);
  if (target.startsWith("Ankara")) check("Açık Ankara/yerinde beyanı kazanır", s.fields.city?.value === "Ankara" && s.fields.locationMode?.value === "onsite", s.fields);
  check("Hizmet geçişinde bütçe korunur", s.fields.budget?.value === "25000", s.fields.budget);
}
for (const text of ["Çocuğumun ateşi var, hangi ilacı vereyim?", "cocuguma hangi ilaci vermeliyim?"]) {
  const s = syncFromText(null, text).state;
  check("Üçüncü kişiye ilaç seçimi kapsam dışında", s.understanding.requestScope.value === "UNSUPPORTED_MEDICAL_ADVICE", s.understanding.requestScope);
}
const medicine = syncFromText(null, "Ağrı kesici arıyorum").state;
check("İlaç kelimesi tek başına talebi kapsam dışına çıkarmaz", medicine.understanding.requestScope.value === "DEMAND", medicine.understanding.requestScope);
for (const text of ["Tansiyon ölçüm cihazı arıyorum", "Tek kişilik karyola arıyorum"]) {
  const s = syncFromText(null, text).state;
  check(`Bilinen ürün kategorisi: ${text}`, s.categoryId === (text.startsWith("Tansiyon") ? "health" : "furniture"), s.categoryId);
}
const typed = syncFromText(null, "32 sayfa A5 katalog bastırmak istiyorum").state;
const bag = toResolverFieldBag(typed);
check("Test yalnız mevcut katalog sorularını kullanır", listProfilesForCategory({ categoryId: "printing", needType: bag.needType, productType: bag.productType }).some(p => p.fieldKey === "publicationPageCount"));
console.log(JSON.stringify({ checks, passed: checks - failures.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
