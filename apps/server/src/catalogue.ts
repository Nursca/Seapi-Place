import { apis, providers } from "./catalogue.data.js";
import type { Access, ApiRecord, Category, ProviderRecord } from "./types.js";
import { formatUsdc } from "./stellar.js";

const STOP = new Set([
  "the", "a", "an", "and", "or", "to", "of", "for", "with", "between",
  "from", "into", "over", "what", "whats", "what's", "find", "please",
  "me", "my", "current", "latest", "today", "yesterday", "compare",
  "compared", "comparison", "versus", "vs", "against", "than", "is",
  "are", "was", "were", "be", "in", "on", "at", "by", "it", "its",
  "this", "that", "give", "get", "show", "right", "now",
]);

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP.has(token));
}

export function searchApis(query: string, limit = 12): Array<ApiRecord & { score: number }> {
  const tokens = tokenize(query);
  const scored = apis.map((api) => {
    if (tokens.length === 0) {
      const bias = api.access === "indexed" ? 0 : 2;
      return { ...api, score: bias };
    }
    let score = 0;
    const name = api.name.toLowerCase();
    const summary = `${api.summary} ${api.description}`.toLowerCase();
    const tags = new Set(api.tags.map((tag) => tag.toLowerCase()));
    const capabilities = new Set(api.capabilities.map((item) => item.toLowerCase()));
    for (const token of tokens) {
      if (name.includes(token)) score += 8;
      if (tags.has(token) || [...tags].some((tag) => tag.includes(token))) score += 6;
      if (capabilities.has(token) || [...capabilities].some((item) => item.includes(token))) score += 5;
      if (api.category.includes(token)) score += 4;
      if (summary.includes(token)) score += 2;
    }
    if (api.access !== "indexed") score += 3;
    if (api.access === "native") score += 1;
    return { ...api, score };
  });
  return scored
    .filter((api) => (tokens.length === 0 ? true : api.score > 0))
    .sort((a, b) => b.score - a.score || cmpPrice(a.priceAtomic, b.priceAtomic) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function cmpPrice(a: string, b: string): number {
  const delta = BigInt(a) - BigInt(b);
  if (delta < 0n) return -1;
  if (delta > 0n) return 1;
  return 0;
}

export function getApi(slug: string): ApiRecord | undefined {
  return apis.find((api) => api.slug === slug);
}

export function getProvider(id: string): ProviderRecord | undefined {
  return providers.find((provider) => provider.id === id);
}

export function listProviders(): ProviderRecord[] {
  return providers;
}

export function listApis(filters: {
  q?: string;
  category?: Category | "";
  access?: Access | "";
  limit?: number;
  offset?: number;
}): { total: number; items: Array<ApiRecord & { score: number; priceUsdc: string }> } {
  const limit = Math.min(Math.max(filters.limit ?? 24, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);
  let items = filters.q ? searchApis(filters.q, 500) : apis.map((api) => ({ ...api, score: api.access === "indexed" ? 0 : 1 }));
  if (filters.category) items = items.filter((api) => api.category === filters.category);
  if (filters.access) items = items.filter((api) => api.access === filters.access);
  const total = items.length;
  return {
    total,
    items: items.slice(offset, offset + limit).map((api) => ({ ...api, priceUsdc: formatUsdc(api.priceAtomic) })),
  };
}

export function catalogueStats() {
  return {
    total: apis.length,
    executable: apis.filter((api) => api.access !== "indexed").length,
    adapters: apis.filter((api) => api.access === "adapter").length,
    native: apis.filter((api) => api.access === "native").length,
    indexed: apis.filter((api) => api.access === "indexed").length,
    categories: [...new Set(apis.map((api) => api.category))],
  };
}

export function executableInCategory(category: Category): ApiRecord[] {
  return apis.filter((api) => api.category === category && api.access !== "indexed");
}
