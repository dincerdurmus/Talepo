/**
 * Conservative structured data extraction: JSON-LD Product, embedded JSON, sitemap URLs.
 * Never invents model/spec fields that are not present in source.
 */

export type JsonLdProduct = {
  name?: string;
  brand?: string;
  model?: string;
  sku?: string;
  mpn?: string;
  category?: string;
  description?: string;
  url?: string;
  additionalProperty?: Array<{ name?: string; value?: string | number }>;
  raw: Record<string, unknown>;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function brandName(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw;
  const obj = asRecord(raw);
  if (!obj) return undefined;
  if (typeof obj.name === "string") return obj.name;
  return undefined;
}

function flattenGraph(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) {
    return json.flatMap((x) => flattenGraph(x));
  }
  const obj = asRecord(json);
  if (!obj) return [];
  if (Array.isArray(obj["@graph"])) {
    return obj["@graph"].flatMap((x) => flattenGraph(x));
  }
  return [obj];
}

function isProductType(type: unknown): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some(
    (t) =>
      typeof t === "string" &&
      (t === "Product" ||
        t.endsWith("/Product") ||
        t === "http://schema.org/Product" ||
        t === "https://schema.org/Product"),
  );
}

export function parseJsonLdProducts(htmlOrJson: string): JsonLdProduct[] {
  const products: JsonLdProduct[] = [];
  const trimmed = htmlOrJson.trim();

  const tryParse = (text: string) => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  };

  const blocks: unknown[] = [];

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = tryParse(trimmed);
    if (parsed) blocks.push(parsed);
  }

  const scriptRe =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(htmlOrJson))) {
    const parsed = tryParse(m[1]!.trim());
    if (parsed) blocks.push(parsed);
  }

  for (const block of blocks) {
    for (const node of flattenGraph(block)) {
      if (!isProductType(node["@type"]) && !node.name) continue;
      if (!isProductType(node["@type"]) && !node.brand) continue;
      if (!isProductType(node["@type"])) continue;

      const props: Array<{ name?: string; value?: string | number }> = [];
      const addProps = node.additionalProperty;
      if (Array.isArray(addProps)) {
        for (const p of addProps) {
          const pr = asRecord(p);
          if (!pr) continue;
          const name = typeof pr.name === "string" ? pr.name : undefined;
          const value =
            typeof pr.value === "string" || typeof pr.value === "number"
              ? pr.value
              : undefined;
          if (name && value != null) props.push({ name, value });
        }
      }

      products.push({
        name: typeof node.name === "string" ? node.name : undefined,
        brand: brandName(node.brand),
        model:
          typeof node.model === "string"
            ? node.model
            : typeof node.mpn === "string"
              ? node.mpn
              : undefined,
        sku: typeof node.sku === "string" ? node.sku : undefined,
        mpn: typeof node.mpn === "string" ? node.mpn : undefined,
        category: typeof node.category === "string" ? node.category : undefined,
        description:
          typeof node.description === "string" ? node.description : undefined,
        url: typeof node.url === "string" ? node.url : undefined,
        additionalProperty: props.length ? props : undefined,
        raw: node,
      });
    }
  }

  return products;
}

export function extractSitemapLocs(xml: string, limit = 50): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && locs.length < limit) {
    const url = m[1]!.trim();
    if (url.startsWith("http")) locs.push(url);
  }
  return locs;
}

/** Conservative key/value pairs from simple HTML definition / spec tables. */
export function extractSpecTablePairs(
  html: string,
  limit = 20,
): Array<{ name: string; value: string }> {
  const pairs: Array<{ name: string; value: string }> = [];
  // <tr><th>Name</th><td>Value</td></tr>
  const rowRe =
    /<tr[^>]*>\s*<t[hd][^>]*>([\s\S]*?)<\/t[hd]>\s*<t[hd][^>]*>([\s\S]*?)<\/t[hd]>\s*<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) && pairs.length < limit) {
    const name = m[1]!.replace(/<[^>]+>/g, "").trim();
    const value = m[2]!.replace(/<[^>]+>/g, "").trim();
    if (name && value && name.length < 80 && value.length < 200) {
      pairs.push({ name, value });
    }
  }
  return pairs;
}

/** Find embedded application/json script blobs that look like product indexes. */
export function extractEmbeddedJsonBlobs(html: string, limit = 5): unknown[] {
  const out: unknown[] = [];
  const re =
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) {
    try {
      out.push(JSON.parse(m[1]!.trim()));
    } catch {
      // skip
    }
  }
  return out;
}

export function specsFromJsonLdProduct(
  product: JsonLdProduct,
): Record<string, string | number> {
  const specs: Record<string, string | number> = {};
  if (product.additionalProperty) {
    for (const p of product.additionalProperty) {
      if (p.name && p.value != null) specs[p.name] = p.value;
    }
  }
  return specs;
}
