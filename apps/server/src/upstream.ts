import { formatDay, formatRate, previousIsoDate } from "./stellar.js";

export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new UpstreamError(`${response.status} from ${new URL(url).host}`);
    return await response.json();
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError(error instanceof Error ? error.message : "upstream request failed");
  } finally {
    clearTimeout(timer);
  }
}

type CurrencyPayload = { date?: string; [code: string]: unknown };

async function currencyRate(base: string, quote: string, date: "latest" | string): Promise<{ date: string; rate: number }> {
  const code = base.toLowerCase();
  const urls =
    date === "latest"
      ? [
          `https://latest.currency-api.pages.dev/v1/currencies/${code}.min.json`,
          `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${code}.min.json`,
        ]
      : [
          `https://${date}.currency-api.pages.dev/v1/currencies/${code}.min.json`,
          `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${code}.min.json`,
        ];
  let last = "no response";
  for (const url of urls) {
    try {
      const body = (await fetchJson(url)) as CurrencyPayload;
      const table = body[code];
      if (!table || typeof table !== "object") throw new UpstreamError("Rate table missing.");
      const rate = (table as Record<string, unknown>)[quote.toLowerCase()];
      if (typeof rate !== "number") throw new UpstreamError(`${quote} is not in the dataset.`);
      return { date: typeof body.date === "string" ? body.date : date, rate };
    } catch (error) {
      last = error instanceof Error ? error.message : "failed";
    }
  }
  throw new UpstreamError(last);
}

export async function meridianSpot(base: string, quote: string) {
  const latest = await currencyRate(base, quote, "latest");
  return {
    source: "currency-api",
    license: "MIT",
    base,
    quote,
    date: latest.date,
    rate: latest.rate,
    text: `1 ${base} buys ${formatRate(latest.rate)} ${quote} on ${formatDay(latest.date)}.`,
  };
}

export async function meridianCompare(base: string, quote: string) {
  const latest = await currencyRate(base, quote, "latest");
  let cursor = previousIsoDate(latest.date);
  let previous: { date: string; rate: number } | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      previous = await currencyRate(base, quote, cursor);
      break;
    } catch {
      cursor = previousIsoDate(cursor);
    }
  }
  if (!previous) throw new UpstreamError("No previous date was available for this pair.");
  const delta = latest.rate - previous.rate;
  const deltaPct = previous.rate === 0 ? 0 : (delta / previous.rate) * 100;
  const direction =
    delta === 0
      ? "unchanged"
      : delta < 0
        ? `the dollar buys ${formatRate(Math.abs(delta))} fewer ${quote}`
        : `the dollar buys ${formatRate(delta)} more ${quote}`;
  return {
    source: "currency-api",
    license: "MIT",
    base,
    quote,
    today: { date: latest.date, rate: latest.rate },
    yesterday: { date: previous.date, rate: previous.rate },
    delta,
    deltaPct,
    text: `1 ${base} buys ${formatRate(latest.rate)} ${quote} on ${formatDay(latest.date)}, compared with ${formatRate(previous.rate)} ${quote} on ${formatDay(previous.date)}. The change is ${formatRate(delta)} ${quote} (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(3)}%), so ${direction}.`,
  };
}

type Frankfurter = { amount: number; base: string; date: string; rates: Record<string, number> };

async function frankfurterOn(date: "latest" | string, base: string, quote: string): Promise<Frankfurter> {
  const path = date === "latest" ? "latest" : date;
  const body = (await fetchJson(
    `https://api.frankfurter.app/${path}?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`,
  )) as Frankfurter;
  if (typeof body.rates?.[quote] !== "number") throw new UpstreamError(`${quote} was not returned by Frankfurter.`);
  return body;
}

export async function ecbSpot(base: string, quote: string) {
  const latest = await frankfurterOn("latest", base, quote);
  return {
    source: "frankfurter / ECB",
    base,
    quote,
    date: latest.date,
    rate: latest.rates[quote],
    text: `The ECB reference is 1 ${base} = ${formatRate(latest.rates[quote])} ${quote} on ${formatDay(latest.date)}.`,
  };
}

export async function ecbCompare(base: string, quote: string) {
  const latest = await frankfurterOn("latest", base, quote);
  let cursor = previousIsoDate(latest.date);
  let previous: Frankfurter | null = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      previous = await frankfurterOn(cursor, base, quote);
      if (previous.date !== latest.date) break;
    } catch {
      /* weekends and holidays fall through */
    }
    cursor = previousIsoDate(cursor);
    previous = null;
  }
  if (!previous) throw new UpstreamError("No previous ECB date was available.");
  const todayRate = latest.rates[quote];
  const prevRate = previous.rates[quote];
  const delta = todayRate - prevRate;
  const deltaPct = prevRate === 0 ? 0 : (delta / prevRate) * 100;
  return {
    source: "frankfurter / ECB",
    base,
    quote,
    today: { date: latest.date, rate: todayRate },
    yesterday: { date: previous.date, rate: prevRate },
    delta,
    deltaPct,
    text: `1 ${base} is ${formatRate(todayRate)} ${quote} on ${formatDay(latest.date)}, against ${formatRate(prevRate)} ${quote} on ${formatDay(previous.date)}. Change ${formatRate(delta)} (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(3)}%).`,
  };
}

const WEATHER: Array<[number, string]> = [
  [0, "Clear"],
  [3, "Cloudy"],
  [48, "Fog"],
  [57, "Drizzle"],
  [67, "Rain"],
  [77, "Snow"],
  [82, "Showers"],
  [86, "Snow showers"],
  [99, "Thunderstorm"],
];

function weatherLabel(code: number): string {
  for (const [max, label] of WEATHER) {
    if (code <= max) return label;
  }
  return "Unknown";
}

export async function currentWeather(place: string) {
  const geo = (await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`,
  )) as { results?: Array<{ name: string; country?: string; latitude: number; longitude: number }> };
  const hit = geo.results?.[0];
  if (!hit) throw new UpstreamError(`No place matched “${place}”.`);
  const forecast = (await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,weather_code`,
  )) as {
    current?: { temperature_2m?: number; weather_code?: number; time?: string };
    current_units?: { temperature_2m?: string };
  };
  const temp = forecast.current?.temperature_2m;
  const code = forecast.current?.weather_code;
  if (typeof temp !== "number" || typeof code !== "number") throw new UpstreamError("Weather payload was incomplete.");
  const unit = forecast.current_units?.temperature_2m ?? "°C";
  const label = weatherLabel(code);
  const where = hit.country ? `${hit.name}, ${hit.country}` : hit.name;
  return {
    source: "open-meteo",
    place: where,
    latitude: hit.latitude,
    longitude: hit.longitude,
    temperature: temp,
    unit,
    weatherCode: code,
    conditions: label,
    observedAt: forecast.current?.time ?? null,
    text: `${where} is ${temp}${unit} and ${label.toLowerCase()}.`,
  };
}

const COUNTRIES: Record<string, string> = {
  nigeria: "NG",
  ng: "NG",
  "united states": "US",
  usa: "US",
  us: "US",
  "united kingdom": "GB",
  uk: "GB",
  britain: "GB",
  germany: "DE",
  france: "FR",
  kenya: "KE",
  ghana: "GH",
  "south africa": "ZA",
  india: "IN",
  japan: "JP",
  canada: "CA",
  brazil: "BR",
  mexico: "MX",
  egypt: "EG",
  australia: "AU",
};

export function countryCode(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (COUNTRIES[trimmed]) return COUNTRIES[trimmed];
  if (/^[a-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

export async function nextHolidays(country: string) {
  const code = countryCode(country);
  if (!code) throw new UpstreamError(`No country code for “${country}”.`);
  const body = (await fetchJson(`https://date.nager.at/api/v3/NextPublicHolidays/${code}`)) as Array<{
    date: string;
    localName: string;
    name: string;
  }>;
  if (!Array.isArray(body) || body.length === 0) throw new UpstreamError("No upcoming holidays were returned.");
  const next = body.slice(0, 5).map((item) => ({
    date: item.date,
    localName: item.localName,
    name: item.name,
  }));
  const first = next[0];
  return {
    source: "nager.date",
    country: code,
    holidays: next,
    text: `The next public holiday in ${code} is ${first.localName} on ${formatDay(first.date)}.`,
  };
}

export async function feeSnapshot() {
  const body = (await fetchJson("https://horizon-testnet.stellar.org/fee_stats")) as {
    last_ledger?: number | string;
    last_ledger_base_fee?: number | string;
    ledger_capacity_usage?: number | string;
    fee_charged?: { p50?: number | string };
  };
  const baseFee = Number(body.last_ledger_base_fee);
  if (!Number.isFinite(baseFee)) throw new UpstreamError("Horizon fee stats were incomplete.");
  const median = body.fee_charged?.p50 == null ? null : Number(body.fee_charged.p50);
  return {
    source: "horizon-testnet",
    network: "stellar:testnet",
    lastLedger: body.last_ledger == null ? null : Number(body.last_ledger),
    baseFeeStroops: baseFee,
    capacity: body.ledger_capacity_usage == null ? null : Number(body.ledger_capacity_usage),
    medianFeeStroops: median,
    text: `Stellar testnet base fee is ${baseFee} stroops at ledger ${body.last_ledger ?? "unknown"}.`,
  };
}
