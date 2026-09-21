import fs from "node:fs";
import path from "node:path";
import { syncFromText, syncFromBrowse } from "../src/lib/request-composer/sync";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import { toResolverFieldBag } from "../src/lib/request-composer/build-state";
import { listProfilesForCategory } from "../src/lib/request-composer/v2/question-profiles";
import { scheduleComposerQuestions } from "../src/lib/request-composer/v2/focused-questions";
import type { CanonicalRequestState } from "../src/lib/request-composer/types";

type TargetCase = {
  id: string; text: string; category?: string; notCategory?: string;
  kind?: string[]; need?: string; notNeed?: string; tireFamily?: string; scope?: string;
  fields?: Record<string, string>; clear?: string[];
  summary?: RegExp; summaryNot?: RegExp; forbidden?: string[]; allowed?: string[];
};
const cases: TargetCase[] = [
  { id:'whole-car', text:'İkinci el araba almak istiyorum', category:'automotive', kind:['VEHICLE'], summary:/araç|araba|otomobil/iu },
  { id:'whole-suv', text:'0 km SUV arıyorum bütçem 2 milyon TL', category:'automotive', kind:['VEHICLE'], summary:/SUV/iu },
  { id:'truck-tire', text:'Kamyon lastiği arıyorum', category:'automotive', need:'tire', summary:/lastik|lastiği/iu },
  { id:'office-rubber-stamp', text:'Ofis Lastik Damgaları almak istiyorum', category:'furniture' },
  { id:'lathe-part', text:'Torna tezgahı için yedek parça arıyorum', category:'machinery', kind:['PART'], summary:/torna.*parça/iu },
  { id:'logo-service', text:'Logo tasarımı arıyorum', category:'services', kind:['SERVICE'], summary:/logo/iu, summaryNot:/logo.*logo/iu },
  { id:'roof-rack-context', text:'Araba için tavan bagajı arıyorum', category:'automotive', kind:['PRODUCT','PART','ACCESSORY'], forbidden:['fuel','transmission','mileage','modelYear'] },
  { id:'roof-rack-suv', text:'SUV tavan bagajı arıyorum', category:'automotive', kind:['PRODUCT','PART','ACCESSORY'], summary:/bagaj/iu },
  { id:'towbar-truck', text:'Kamyon için çeki demiri arıyorum', category:'automotive', kind:['PRODUCT','PART','ACCESSORY'], forbidden:['fuel','transmission','mileage','modelYear'] },
  { id:'roof-rack-synonym', text:'Araba için portbagaj arıyorum', category:'automotive', kind:['PRODUCT','PART','ACCESSORY'], forbidden:['fuel','transmission','mileage','modelYear'] },
  { id:'negative-tire-car', text:'Lastik değil araba arıyorum', category:'automotive', need:'vehicle', summary:/araç|araba/iu, forbidden:['tireSize','tireSeason'] },
  { id:'negative-wheel-tire', text:'Jant değil lastik arıyorum', category:'automotive', tireFamily:'Lastik', summaryNot:/jant/iu },
  { id:'negative-tire-wheel', text:'Lastik değil jant arıyorum', category:'automotive', tireFamily:'Jant', forbidden:['tireSeason'] },
  { id:'tire-storage-property', text:'Lastik deposu kiralamak istiyorum', category:'real-estate', summary:/depo/iu, forbidden:['tireSize','tireSeason'] },
  { id:'rubber-glove', text:'Lastik eldiven arıyorum', category:'machinery', summary:/eldiven/iu, allowed:['quantity','city','delivery','budget'] },
  { id:'protective-glove', text:'Koruyucu eldiven arıyorum', category:'machinery', summary:/eldiven/iu, allowed:['quantity','city','delivery','budget'] },
  { id:'console-5-summary', text:'PlayStation 5 arıyorum', category:'technology', summary:/PlayStation\s+5/iu },
  { id:'console-4-summary', text:'PlayStation 4 arıyorum', category:'technology', summary:/PlayStation\s+4/iu },
  { id:'medical-scope-typo', text:'Hangi tansiyon ilacını kullanalıyım', scope:'UNSUPPORTED_MEDICAL_ADVICE' },
  { id:'medical-scope-typo-ascii', text:'hangi tansiyon ilacini kullanaliyim', scope:'UNSUPPORTED_MEDICAL_ADVICE' },
  { id:'console-typo', text:'PlaySttion 5 arıyorum', category:'technology', fields:{model:'PlayStation 5'}, summary:/PlayStation\s+5/iu },
  { id:'console-typo-ascii', text:'playsttion 5 ariyorum', category:'technology', fields:{model:'PlayStation 5'}, summary:/PlayStation\s+5/iu },
  { id:'negative-wheel-car', text:'Jant değil araba arıyorum', category:'automotive', need:'vehicle', summary:/araç|araba/iu, forbidden:['tireSize','tireSeason'] },
  { id:'negative-wheel-and-tire-car', text:'Golf arıyorum, lastik ve jant istemiyorum', category:'automotive', need:'vehicle', summary:/Golf/iu, forbidden:['tireSize','tireSeason'] },
  { id:'negative-tire-wheel-diameter', text:'205/55 R16 lastik değil 17 inç jant arıyorum', category:'automotive', tireFamily:'Jant', fields:{tireSize:'17'}, forbidden:['tireSeason'] },
  // Kurucu kararı D-0028 (2026-09-21) bu vakayı tersine çevirdi: ilacın
  // kendisi kapsam dışıdır. Beklenti I52f ve korpus hlth-e ile aynı sınırı
  // ölçer; vaka silinmez, KENDİ adıyla yeni beklentisini taşır. Kategori
  // iddiası kalktı: kapsam dışı metin kategoriye bağlanmaz.
  { id:'medicine-product', text:'Ağrı kesici arıyorum', scope:'UNSUPPORTED_PHARMACY' },
  { id:'ppf-restrictions', text:'SUV için PPF kaplama yaptırmak istiyorum', category:'automotive', kind:['SERVICE'], allowed:['needType','brand','model','city','color','budget'] },
  { id:'part-restrictions', text:'Toyota Corolla 2018 için çıkma motor arıyorum', category:'automotive', allowed:['needType','brand','model','part','city','partPreference','partVehicleYear','budget'] },
  { id:'maintenance-restrictions', text:'Periyodik bakım yaptırmak istiyorum', category:'automotive', allowed:['needType','brand','model','city','mileage','budget'] },
  { id:'wheel-restrictions', text:'17 inç jant arıyorum', category:'automotive', allowed:['needType','tireSize','tireQuantity','city','condition','budget'] },
  { id:'tire-service-restrictions', text:'Lastik değişimi yaptırmak istiyorum', category:'automotive', allowed:['needType','city','tireQuantity','serviceDate','budget'] },
];
for (const test of cases) {
  if (/^(roof-rack|towbar)/u.test(test.id)) { test.notNeed = 'vehicle'; test.need = 'part'; }
  if (test.id === 'console-5-summary') test.fields = {model:'PlayStation 5'};
  if (test.id === 'console-4-summary') test.fields = {model:'PlayStation 4'};
}
function inspect(test: TargetCase, previous: CanonicalRequestState | null = null) {
  const state = syncFromText(previous, test.text).state;
  const bag = toResolverFieldBag(state);
  const u = state.understanding;
  const profiles = listProfilesForCategory({categoryId:state.categoryId??'',needType:bag.needType,productType:bag.productType??bag.machineType??bag.kitchenProductType??bag.serviceType??bag.propertyType}).map(p=>p.fieldKey);
  const visible = scheduleComposerQuestions({categoryId:state.categoryId??'',needType:bag.needType,values:bag,candidates:resolveHybridQuestions(state).candidates,fieldStates:state.fields}).visible.map(q=>({key:q.fieldKey}));
  const summary = state.lastComposedText ?? '';
  const errors=[];
  if(test.category && state.categoryId !== test.category) errors.push(`category expected ${test.category}, got ${state.categoryId}`);
  if(test.notCategory && state.categoryId === test.notCategory) errors.push(`unexpected category ${state.categoryId}`);
  if(test.kind && !test.kind.includes(u.requestSubject?.kind?.value ?? '')) errors.push(`kind expected ${test.kind.join('/')}, got ${u.requestSubject?.kind?.value}`);
  if(test.need && bag.needType !== test.need) errors.push(`need expected ${test.need}, got ${bag.needType}`);
  if(test.notNeed && bag.needType === test.notNeed) errors.push(`unexpected need ${bag.needType}`);
  for(const [key,value] of Object.entries(test.fields??{})) if(state.fields[key]?.value !== value) errors.push(`canonical ${key} expected ${value}, got ${state.fields[key]?.value}`);
  for(const key of test.clear??[]) if(state.fields[key]?.kind === 'VALUE') errors.push(`stale ${key}: ${state.fields[key]?.value}`);
  if(test.tireFamily && bag.tireItemType !== test.tireFamily) errors.push(`tire family expected ${test.tireFamily}, got ${bag.tireItemType}`);
  if(test.summary && !test.summary.test(summary)) errors.push(`missing summary subject ${test.summary}`);
  if(test.summaryNot?.test(summary)) errors.push(`wrong/repeated summary subject ${test.summaryNot}`);
  if(test.scope && u.requestScope?.value !== test.scope) errors.push(`scope expected ${test.scope}, got ${u.requestScope?.value}`);
  for(const key of test.forbidden??[]) if(profiles.includes(key)) errors.push(`unexpected question ${key}`);
  for(const key of profiles) if(test.allowed && !test.allowed.includes(key)) errors.push(`question outside agreed limit ${key}`);
  return {id:test.id,input:test.text,passed:errors.length===0,errors,category:state.categoryId,kind:u.requestSubject?.kind?.value,need:bag.needType,tireFamily:bag.tireItemType,summary,profiles,visible};
}
const results=cases.map(test=>inspect(test));
for (const test of cases.filter((test) => /^(roof-rack|towbar|tire-storage|rubber-glove)/u.test(test.id))) {
  results.push(inspect({...test, id:`${test.id}-with-details`, text:`${test.text}. Ayrıca fotoğraf paylaşılmasını istiyorum.`}));
}
let prior=syncFromText(null,'17 inç jant arıyorum').state;
prior=syncFromBrowse(prior,{key:'city',value:'İstanbul'}).state;
prior=syncFromBrowse(prior,{key:'budget',value:'20000'}).state;
results.push(inspect({id:'edit-wheel-to-tire-by-negation',text:'Jant değil lastik arıyorum',category:'automotive',tireFamily:'Lastik',summaryNot:/jant/iu,clear:['tireSize'],fields:{city:'İstanbul',budget:'20000'}},prior));
const report={scenarios:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
const outputDir = path.resolve(process.env.CATEGORY_AUDIT_OUTPUT || '../../reports/qa-fixes-2026-09-06');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir,'focused-checks.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:results.filter(r=>!r.passed)},null,2));
if(report.failed) process.exitCode=1;
