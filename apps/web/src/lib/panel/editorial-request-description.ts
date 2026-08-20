/**
 * Split free-text request description into lead, supporting body,
 * structured lines, and trailing “teklifte beklenenler” copy.
 * Presentation only — does not invent product data.
 */
export type EditorialRequestParts = {
  lead: string;
  body: string;
  textCriteria: string[];
  expectations: string | null;
};

const EXPECTATION_RE =
  /^(teklifte|teklifinizde|teklifte beklenen|lütfen teklifte|teklif metninde)/i;

export function splitEditorialRequestDescription(
  text: string,
): EditorialRequestParts {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const textCriteria: string[] = [];
  const paragraphs: string[] = [];

  for (const line of lines) {
    if (/^([•\-–*]|\d+[.)])\s+/.test(line)) {
      textCriteria.push(line.replace(/^([•\-–*]|\d+[.)])\s+/, ""));
      continue;
    }
    paragraphs.push(line);
  }

  if (paragraphs.length === 0) {
    return {
      lead: text.trim(),
      body: "",
      textCriteria,
      expectations: null,
    };
  }

  let expectations: string | null = null;
  const remaining = [...paragraphs];
  const last = remaining[remaining.length - 1];
  if (remaining.length > 1 && last && EXPECTATION_RE.test(last)) {
    expectations = remaining.pop() ?? null;
  }

  const lead = remaining[0] ?? "";
  const body = remaining.slice(1).join("\n\n");

  return { lead, body, textCriteria, expectations };
}
