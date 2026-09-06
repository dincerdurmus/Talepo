import { isNegatedMention } from "@/lib/ai/parser/negation";
import { classifyTaxonomyPhrase } from "@/lib/taxonomy/phrase-classification";
import { classifyRequestedTargetRole } from "./requested-item-role";
import { readRequestedTarget } from "./part-relation";

const TIRE_NOUN = /(?<![\p{L}\p{N}])(?:lastik|lastiği|lastigi|jant(?:ı|i)?|stepne)(?![\p{L}\p{N}])/giu;
const TIRE_SERVICE = /lastik\s+değişimi|lastik\s+degisimi|rot\s+ayarı|rot\s+ayari|\bbalans\b|lastik\s+otel|lastik\s+saklama/iu;

/** Only the rejected product mentions are masked; raw user text stays intact. */
export function withoutRejectedTireMentions(text: string): string {
  const mentions = [...text.matchAll(TIRE_NOUN)];
  const rejected = mentions.map((match) => isNegatedMention(text, match.index, match[0].length));
  for (let i = mentions.length - 2; i >= 0; i--) {
    const gap = text.slice(mentions[i].index + mentions[i][0].length, mentions[i + 1].index);
    if (rejected[i + 1] && /^\s*(?:,\s*)?(?:(?:ve|veya|ile)\s*)?$/iu.test(gap)) rejected[i] = true;
  }
  const excludedOffsets = new Set(mentions.filter((_, i) => rejected[i]).map((match) => match.index));
  return text.replace(TIRE_NOUN, (mention, index: number) =>
    excludedOffsets.has(index) ? " ".repeat(mention.length) : mention,
  );
}

export function readTireRequestContext(text: string) {
  const affirmedText = withoutRejectedTireMentions(text);
  const mentions = [...affirmedText.matchAll(TIRE_NOUN)];
  const service = TIRE_SERVICE.test(affirmedText);
  if (!mentions.length && !service) return null;
  const fullRole = classifyRequestedTargetRole(affirmedText);
  const role = fullRole.role === "UNKNOWN"
    ? classifyRequestedTargetRole(readRequestedTarget(affirmedText).value ?? affirmedText) : fullRole;
  const head = classifyTaxonomyPhrase(role.head ?? role.evidence[0] ?? "");
  // In "lastik deposu" / "lastik eldiven", the head names the requested
  // product. A material or storage-use modifier cannot start a tire flow.
  const competingCategory = head && head.categoryId !== "automotive" ? head.categoryId : null;
  return {
    competingCategory,
    head,
    family: competingCategory || !mentions.length ? null :
      mentions.some((match) => /^jant/iu.test(match[0])) ? "Jant" as const : "Lastik" as const,
    isTireRequest: !competingCategory && Boolean(mentions.length || service),
  };
}
