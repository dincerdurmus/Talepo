/**
 * Paid-plan explore/alert filter contract — unit checks (no DB).
 * Run: npx tsx scripts/verify-explore-paid-filters-v1.ts
 */
import {
  buildExploreFilterWhere,
  getExploreFilterDefs,
  parseExploreFilters,
  type ExploreFilterFieldDef,
  type ParsedExploreFilters,
} from "../src/lib/explore/category-filters";
import { getCategoryById } from "../src/lib/request-category-engine";
import { withCategoryFieldDefaults } from "../src/lib/request-category-engine";

let pass = 0;
let fail = 0;
const errors: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    const msg = detail ? `${name}: ${detail}` : name;
    errors.push(msg);
    console.log(`FAIL — ${msg}`);
  }
}

function emptyFilters(
  partial: Partial<ParsedExploreFilters> & {
    fields: ParsedExploreFilters["fields"];
  },
): ParsedExploreFilters {
  return {
    q: "",
    focus: "",
    city: "",
    district: "",
    advanced: {
      urgentOnly: false,
      budgetMin: null,
      budgetMax: null,
      sinceDays: null,
    },
    ...partial,
  };
}

function def(
  partial: Pick<ExploreFilterFieldDef, "param" | "fieldKey" | "input"> &
    Partial<ExploreFilterFieldDef>,
): ExploreFilterFieldDef {
  return {
    label: partial.param,
    ...partial,
  };
}

// 1 Appliances engine publishes brand (not only brandPreference)
{
  const cat = getCategoryById("appliances");
  const keys = cat.fields.map((f) => f.key);
  check("1 appliances has brand field", keys.includes("brand"), keys.join(","));
  check(
    "1 appliances applianceType is text",
    cat.fields.find((f) => f.key === "applianceType")?.type === "text",
  );
}

// 2 Technology engine publishes brand + condition for hardware
{
  const cat = getCategoryById("technology");
  const keys = cat.fields.map((f) => f.key);
  check("2 technology has brand", keys.includes("brand"));
  check("2 technology has condition", keys.includes("condition"));
  const brand = cat.fields.find((f) => f.key === "brand");
  check(
    "2 brand gated to hardware",
    Boolean(brand?.when?.in?.includes("hardware")),
    JSON.stringify(brand?.when),
  );
}

// 3 Hardware defaults → explore defs hide platform
{
  const values = withCategoryFieldDefaults("technology", {
    productType: "televizyon",
    brand: "Samsung",
  });
  check("3 needType hardware", values.needType === "hardware", values.needType);
  const defs = getExploreFilterDefs("technology", values);
  const keys = defs.map((d) => d.fieldKey);
  check("3 explore has brand", keys.includes("brand"));
  check("3 explore has condition", keys.includes("condition"));
  check("3 explore no platform", !keys.includes("platform"), keys.join(","));
}

// 4 Brand filter Prisma clause dual-reads brandPreference
{
  const where = buildExploreFilterWhere(
    emptyFilters({
      focus: "appliances",
      fields: [
        {
          def: def({
            param: "brand",
            fieldKey: "brand",
            input: "text",
            alsoMatchTitle: true,
          }),
          value: "Bosch",
        },
      ],
    }),
  );
  const raw = JSON.stringify(where);
  check(
    "4 brand where includes brandPreference alias",
    raw.includes("brandPreference") && raw.includes('"brand"'),
    raw.slice(0, 280),
  );
  check("4 brand where is case-insensitive contains", raw.includes("insensitive"));
}

// 5 Rezidans select matches Residans alias
{
  const where = buildExploreFilterWhere(
    emptyFilters({
      focus: "real-estate",
      fields: [
        {
          def: def({
            param: "propertyType",
            fieldKey: "propertyType",
            input: "select",
          }),
          value: "Rezidans",
        },
      ],
    }),
  );
  const raw = JSON.stringify(where);
  check(
    "5 propertyType aliases Residans",
    raw.includes("Residans") && raw.includes("Rezidans"),
    raw.slice(0, 280),
  );
}

// 6 applianceType text filter + title match
{
  const defs = getExploreFilterDefs("appliances", {
    applianceType: "Buzdolabı",
  });
  const typeDef = defs.find((d) => d.fieldKey === "applianceType");
  check("6 applianceType input text", typeDef?.input === "text");
  check("6 applianceType alsoMatchTitle", typeDef?.alsoMatchTitle === true);

  const where = buildExploreFilterWhere(
    emptyFilters({
      focus: "appliances",
      fields: [
        {
          def: typeDef!,
          value: "Buzdolabı",
        },
      ],
    }),
  );
  const raw = JSON.stringify(where);
  check(
    "6 applianceType matches title OR field",
    raw.includes("title") && raw.includes("applianceType"),
    raw.slice(0, 280),
  );
}

// 7 Vacuum explore hides energyClass
{
  const defs = getExploreFilterDefs("appliances", {
    applianceType: "Elektrikli Süpürge",
  });
  check(
    "7 vacuum no energyClass filter",
    !defs.some((d) => d.fieldKey === "energyClass"),
    defs.map((d) => d.fieldKey).join(","),
  );
}

// 8 parseExploreFilters keeps brand param for appliances
{
  const parsed = parseExploreFilters(
    {
      focus: "appliances",
      brand: "Arçelik",
      applianceType: "Buzdolabı",
    },
    ["appliances"],
  );
  check(
    "8 parsed brand field",
    parsed.fields.some((f) => f.def.fieldKey === "brand" && f.value === "Arçelik"),
    JSON.stringify(parsed.fields),
  );
  check(
    "8 parsed applianceType",
    parsed.fields.some(
      (f) => f.def.fieldKey === "applianceType" && f.value === "Buzdolabı",
    ),
  );
}

console.log("\n========================================");
console.log(`verify-explore-paid-filters-v1: ${pass} passed, ${fail} failed`);
if (errors.length) {
  for (const e of errors) console.log(` - ${e}`);
}
process.exit(fail > 0 ? 1 : 0);
