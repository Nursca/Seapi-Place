const SCALE = BigInt(10000000);
const ZERO = BigInt(0);

export function formatUsdc(atomic: string): string {
  const value = BigInt(atomic);
  const negative = value < ZERO;
  const abs = negative ? -value : value;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(7, "0");
  const trimmed = frac.replace(/0+$/, "");
  const shown = (trimmed || "0").padEnd(3, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${shown}`;
}

export function formatRate(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
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

export function shortAccount(id: string): string {
  if (!id || id.length < 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}
