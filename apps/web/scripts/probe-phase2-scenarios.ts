import { syncFromText } from "../src/lib/request-composer/sync";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import { scheduleComposerQuestions } from "../src/lib/request-composer/v2/focused-questions";
import { buildUnderstoodFacts } from "../src/lib/request-composer/ui-helpers";

function dump(label: string, text: string, values: Record<string, string> = {}) {
  const { state } = syncFromText(null, text);
  const hybrid = resolveHybridQuestions(state);
  const qty =
    state.fields.quantity?.kind === "VALUE"
      ? String(state.fields.quantity.value ?? "")
      : "";
  const fieldStates = Object.fromEntries(
    Object.entries(state.fields).map(([key, field]) => [
      key,
      {
        kind: field?.kind,
        value:
          field?.kind === "VALUE"
            ? String(field.value ?? "")
            : field?.kind === "ANY"
              ? "no_preference"
              : null,
      },
    ]),
  );
  const schedule = scheduleComposerQuestions({
    categoryId: state.categoryId ?? "technology",
    needType:
      state.fields.needType?.kind === "VALUE"
        ? String(state.fields.needType.value ?? "")
        : null,
    candidates: hybrid.candidates,
    values: {
      quantity: values.quantity ?? qty,
      city:
        values.city ??
        state.understanding.location?.city?.value ??
        undefined,
      budget: values.budget,
      ...values,
    },
    fieldStates,
    realEstateLocationComplete:
      state.categoryId === "real-estate"
        ? Boolean(
            state.understanding.location?.city?.value &&
              state.understanding.location?.district?.value,
          )
        : undefined,
  });
  process.stdout.write(
    [
      `==== ${label}`,
      `cat=${state.categoryId} qtyField=${qty || "-"} subject=${state.understanding.requestSubject.kind.value}`,
      `facts=${buildUnderstoodFacts(state)
        .map((f) => `${f.key}:${f.displayValue}`)
        .join(" | ")}`,
      `visible=${schedule.visible
        .map((q) => `${q.fieldKey}:${q.importance}`)
        .join(", ")}`,
      `remainCrit=${schedule.remainingCriticalCount} canReview=${schedule.canEnterReview} block=${schedule.blockingFieldKeys.join(",")}`,
      "",
    ].join("\n"),
  );
}

dump("TV", "Arçelik 55 inç televizyon arıyorum");
dump("brosur", "Matbaa için 5000 broşür baskısı istiyorum");
dump("heidelberg", "Heidelberg SM 74 için nemlendirme pompası arıyorum");
dump("re-loc", "Ankara Çankaya’da kiralık 3+1 daire arıyorum");
dump("re-noloc", "Kiralık 3+1 daire arıyorum");
dump("clio", "2019 Renault Clio 1.5 dCi otomatik arıyorum");
dump("bosch", "Bosch Serie 6 çamaşır makinesi arıyorum");
dump("logo", "Logo tasarımı yaptırmak istiyorum");
