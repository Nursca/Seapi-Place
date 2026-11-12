import { getApi } from "./catalogue.js";

const buckets = new Map<string, { tokens: number; updated: number }>();

export function takeRate(slug: string): { ok: boolean; limit: number; remaining: number } {
  const api = getApi(slug);
  const limit = api?.rateLimitPerMinute ?? 0;
  if (limit <= 0) return { ok: false, limit, remaining: 0 };
  const now = Date.now();
  const bucket = buckets.get(slug) ?? { tokens: limit, updated: now };
  const elapsed = (now - bucket.updated) / 60_000;
  bucket.tokens = Math.min(limit, bucket.tokens + elapsed * limit);
  bucket.updated = now;
  if (bucket.tokens < 1) {
    buckets.set(slug, bucket);
    return { ok: false, limit, remaining: 0 };
  }
  bucket.tokens -= 1;
  buckets.set(slug, bucket);
  return { ok: true, limit, remaining: Math.floor(bucket.tokens) };
}

/** Reads a provider credential from the environment and never returns it to clients. */
export function readCredential(ref: string | null): string | null {
  if (!ref) return null;
  const value = process.env[ref];
  if (!value) return null;
  return value;
}
