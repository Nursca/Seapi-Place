/** Stellar testnet USDC and x402 defaults from the SDF docs. */
export const STELLAR = {
  network: "stellar:testnet" as const,
  assetCode: "USDC" as const,
  decimals: 7,
  scale: 10_000_000n,
  scheme: "exact" as const,
  x402Version: 2 as const,
  testnet: {
    issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    contract: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  },
  mainnet: {
    issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    contract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
  },
  facilitatorUrl: "https://channels.openzeppelin.com/x402/testnet",
  maxTimeoutSeconds: 60,
};

export function formatUsdc(atomic: string | bigint): string {
  const value = typeof atomic === "bigint" ? atomic : BigInt(atomic);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / STELLAR.scale;
  const frac = (abs % STELLAR.scale).toString().padStart(STELLAR.decimals, "0");
  const trimmed = frac.replace(/0+$/, "");
  const shown = (trimmed || "0").padEnd(3, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${shown}`;
}

export function cmpAtomic(a: string, b: string): number {
  const delta = BigInt(a) - BigInt(b);
  if (delta < 0n) return -1;
  if (delta > 0n) return 1;
  return 0;
}

export function addAtomic(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}

export function subAtomic(a: string, b: string): string {
  return (BigInt(a) - BigInt(b)).toString();
}

export function parseUsdc(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const padded = frac.padEnd(STELLAR.decimals, "0");
  try {
    return (BigInt(whole) * STELLAR.scale + BigInt(padded)).toString();
  } catch {
    return null;
  }
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatRate(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export function shortAccount(id: string): string {
  if (id.length < 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function previousIsoDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
