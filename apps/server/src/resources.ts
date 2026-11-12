import type { Express, Request, Response } from "express";
import { getApi } from "./catalogue.js";
import { settlePayment, verifyPayment } from "./facilitator.js";
import { takeRate } from "./rates.js";
import { withLedger } from "./store.js";
import type { OperationId, PaymentPayload, PaymentRequired } from "./types.js";
import { ecbCompare, ecbSpot, feeSnapshot, meridianCompare, meridianSpot, nextHolidays, currentWeather, UpstreamError } from "./upstream.js";
import { buildPaymentRequired, buildRequirements, decodeHeader, encodeHeader } from "./x402.js";

type Spec = {
  slug: string;
  operation: OperationId;
  path: string;
  run: (req: Request) => Promise<object>;
};

const specs: Spec[] = [
  { slug: "meridian-fx", operation: "spot", path: "/v1/resources/fx/spot", run: (req) => meridianSpot(code(req, "base"), code(req, "quote")) },
  { slug: "meridian-fx", operation: "compare", path: "/v1/resources/fx/compare", run: (req) => meridianCompare(code(req, "base"), code(req, "quote")) },
  { slug: "frankfurter-ecb", operation: "spot", path: "/v1/resources/ecb/spot", run: (req) => ecbSpot(code(req, "base"), code(req, "quote")) },
  { slug: "frankfurter-ecb", operation: "compare", path: "/v1/resources/ecb/compare", run: (req) => ecbCompare(code(req, "base"), code(req, "quote")) },
  { slug: "open-meteo", operation: "current", path: "/v1/resources/weather/current", run: (req) => currentWeather(text(req, "place")) },
  { slug: "nager-holidays", operation: "holidays", path: "/v1/resources/holidays", run: (req) => nextHolidays(text(req, "country")) },
  { slug: "lyra-fee-oracle", operation: "fees", path: "/v1/resources/fees", run: async () => feeSnapshot() },
];

function code(req: Request, key: string): string {
  const value = String(req.query[key] ?? "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(value)) throw new UpstreamError(`${key} must be a 3-letter currency code.`);
  return value;
}

function text(req: Request, key: string): string {
  const value = String(req.query[key] ?? "").trim();
  if (!value) throw new UpstreamError(`${key} is required.`);
  return value.slice(0, 80);
}

export function registerResources(app: Express) {
  for (const spec of specs) {
    app.get(spec.path, (req, res) => gate(app, req, res, spec));
  }
}

async function gate(app: Express, req: Request, res: Response, spec: Spec) {
  const api = getApi(spec.slug);
  const operation = api?.operations.find((item) => item.id === spec.operation);
  if (!api || api.access === "indexed" || !operation) {
    res.status(404).json({ error: "This API is not executable." });
    return;
  }

  const ledger = await withLedger((state) => ({
    payTo: state.merchantPublic,
  }));
  const origin = String(app.locals.origin ?? `http://127.0.0.1:${process.env.PORT ?? 4020}`);
  const resourceUrl = `${origin}${req.originalUrl}`;
  const requirements = buildRequirements({
    amount: operation.priceAtomic,
    payTo: ledger.payTo,
    category: api.category,
    service: api.name,
    slug: api.slug,
    operation: operation.id,
  });
  const paymentRequired: PaymentRequired = buildPaymentRequired({
    resource: {
      url: resourceUrl,
      description: operation.title,
      mimeType: "application/json",
      serviceName: api.name.slice(0, 32),
      tags: api.tags.slice(0, 5).map((tag) => tag.slice(0, 32)),
    },
    requirements,
    error: "PAYMENT-SIGNATURE header is required",
  });

  const presented = req.header("payment-signature");
  if (!presented) {
    res.set("PAYMENT-REQUIRED", encodeHeader(paymentRequired));
    res.status(402).json(paymentRequired);
    return;
  }

  let payload: PaymentPayload;
  try {
    payload = decodeHeader<PaymentPayload>(presented);
  } catch {
    res.status(400).json({ error: "PAYMENT-SIGNATURE is not valid base64 JSON." });
    return;
  }

  const verified = await verifyPayment(payload, requirements);
  if (!verified.isValid) {
    const refused = buildPaymentRequired({
      resource: paymentRequired.resource,
      requirements,
      error: verified.invalidMessage,
    });
    res.set("PAYMENT-REQUIRED", encodeHeader(refused));
    res.status(402).json({ ...refused, verify: verified });
    return;
  }

  const rate = takeRate(api.slug);
  res.set("X-RateLimit-Limit", String(rate.limit));
  res.set("X-RateLimit-Remaining", String(rate.remaining));
  if (!rate.ok) {
    res.status(429).json({ error: "rate_limited", message: "Provider rate limit reached. Nothing was settled." });
    return;
  }

  let data: Record<string, unknown>;
  try {
    data = (await spec.run(req)) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "upstream failed";
    res.status(502).json({ error: "upstream_error", message });
    return;
  }

  const settlement = await settlePayment(payload, requirements, {
    resourceUrl,
    description: `${api.name} · ${operation.title}`,
  });
  if (!settlement.success) {
    res.status(402).json(settlement);
    return;
  }
  res.set("PAYMENT-RESPONSE", encodeHeader(settlement));
  res.json({ data, settlement });
}
