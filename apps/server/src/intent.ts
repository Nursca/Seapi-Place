import type { Category, OperationId } from "./types.js";

export type Intent =
  | { kind: "fx"; base: string; quote: string; compare: boolean; category: "finance"; operation: "spot" | "compare" }
  | { kind: "weather"; place: string; category: "weather"; operation: "current" }
  | { kind: "holidays"; country: string; category: "data"; operation: "holidays" }
  | { kind: "fees"; category: "developer"; operation: "fees" }
  | { kind: "unknown"; category: null; operation: null };

const NAMES: Record<string, string> = {
  usd: "USD",
  dollar: "USD",
  dollars: "USD",
  usdollar: "USD",
  ngn: "NGN",
  naira: "NGN",
  eur: "EUR",
  euro: "EUR",
  euros: "EUR",
  gbp: "GBP",
  pound: "GBP",
  pounds: "GBP",
  sterling: "GBP",
  jpy: "JPY",
  yen: "JPY",
  cad: "CAD",
  aud: "AUD",
  chf: "CHF",
  cny: "CNY",
  yuan: "CNY",
  inr: "INR",
  rupee: "INR",
  rupees: "INR",
  ghs: "GHS",
  cedi: "GHS",
  cedis: "GHS",
  kes: "KES",
  zar: "ZAR",
  rand: "ZAR",
  brl: "BRL",
  mxn: "MXN",
};

const SKIP_CODES = new Set(["AND", "THE", "FOR", "PER", "NOT", "USD", "NGN", "EUR", "GBP", "JPY"]);

export function interpret(instruction: string): Intent {
  const text = instruction.toLowerCase();

  if (/\b(fee|fees|base fee|stroop)\b/.test(text) && /\b(stellar|testnet|horizon|network)\b/.test(text)) {
    return { kind: "fees", category: "developer", operation: "fees" };
  }

  if (/\b(holiday|holidays)\b/.test(text)) {
    const match = text.match(/\b(?:in|for)\s+([a-z][a-z\s]{1,40}?)(?:\?|$)/);
    return {
      kind: "holidays",
      country: (match?.[1] ?? "nigeria").trim(),
      category: "data",
      operation: "holidays",
    };
  }

  if (/\b(weather|temperature|forecast)\b/.test(text)) {
    const match = text.match(/\b(?:in|for|at)\s+([a-z][a-z\s\-']{1,40}?)(?:\?|$|,)/);
    return {
      kind: "weather",
      place: titleCase((match?.[1] ?? "").trim()) || "Lagos",
      category: "weather",
      operation: "current",
    };
  }

  const codes = extractCurrencies(instruction);
  if (codes.length >= 2 && /\b(exchange|fx|rate|currency|convert)\b/i.test(instruction)) {
    const compare = /\b(yesterday|previous|prior|day before|compare|compared|comparison|versus|vs)\b/i.test(instruction);
    return {
      kind: "fx",
      base: codes[0],
      quote: codes[1],
      compare,
      category: "finance",
      operation: compare ? "compare" : "spot",
    };
  }

  return { kind: "unknown", category: null, operation: null };
}

function extractCurrencies(instruction: string): string[] {
  const found: string[] = [];
  const pattern = /\b([A-Za-z]{3,8})\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(instruction))) {
    const raw = match[1].toLowerCase();
    const code = NAMES[raw];
    if (code && !found.includes(code)) found.push(code);
    const upper = match[1].toUpperCase();
    if (!code && /^[A-Z]{3}$/.test(upper) && !SKIP_CODES.has(upper) && !found.includes(upper)) {
      found.push(upper);
    }
  }
  return found;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function searchQuery(intent: Intent): string {
  if (intent.kind === "fx") {
    return `exchange rate ${intent.base} ${intent.quote} currency ${intent.compare ? "historical" : "spot"}`;
  }
  if (intent.kind === "weather") return `weather current temperature ${intent.place}`;
  if (intent.kind === "holidays") return `public holidays calendar ${intent.country}`;
  if (intent.kind === "fees") return "stellar testnet fee horizon";
  return "";
}

export function operationOf(intent: Intent): OperationId | null {
  return intent.operation;
}

export function categoryOf(intent: Intent): Category | null {
  return intent.category;
}
