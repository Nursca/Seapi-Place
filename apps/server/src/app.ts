import cors from "cors";
import express from "express";
import type { Server } from "node:http";
import { executePaid, runAgent } from "./agent.js";
import { catalogueStats, getApi, getProvider, listApis, listProviders } from "./catalogue.js";
import { supported, settlePayment, verifyPayment } from "./facilitator.js";
import { applyPolicy, handleMcp } from "./mcp.js";
import { isCategory } from "./policy.js";
import { registerResources } from "./resources.js";
import { withLedger } from "./store.js";
import { formatUsdc, STELLAR, subAtomic } from "./stellar.js";
import type { Category, OperationId, PaymentPayload, PaymentRequirements } from "./types.js";

const OPERATIONS: OperationId[] = ["spot", "compare", "current", "holidays", "fees"];

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));
  app.use(
    cors({
      origin: true,
      exposedHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "lyra", x402: 2, network: STELLAR.network });
  });

  app.get("/v1/stats", (_req, res) => {
    res.json(catalogueStats());
  });

  app.get("/v1/catalogue", (req, res) => {
    const category = typeof req.query.category === "string" && isCategory(req.query.category) ? req.query.category : "";
    const access =
      req.query.access === "adapter" || req.query.access === "native" || req.query.access === "indexed"
        ? req.query.access
        : "";
    const result = listApis({
      q: typeof req.query.q === "string" ? req.query.q : "",
      category,
      access,
      limit: Number(req.query.limit ?? 24),
      offset: Number(req.query.offset ?? 0),
    });
    res.json(result);
  });

  app.get("/v1/catalogue/:slug", (req, res) => {
    const api = getApi(req.params.slug);
    if (!api) {
      res.status(404).json({ error: "Not in the catalogue." });
      return;
    }
    const provider = getProvider(api.providerId) ?? null;
    res.json({
      ...api,
      priceUsdc: formatUsdc(api.priceAtomic),
      operations: api.operations.map((operation) => ({ ...operation, priceUsdc: formatUsdc(operation.priceAtomic) })),
      provider,
    });
  });

  app.get("/v1/providers", (_req, res) => {
    res.json({ providers: listProviders() });
  });

  app.get("/v1/wallet", async (_req, res) => {
    const wallet = await withLedger((state) => viewWallet(state));
    res.json(wallet);
  });

  app.get("/v1/policy", async (_req, res) => {
    const wallet = await withLedger((state) => viewWallet(state));
    res.json(wallet);
  });

  app.put("/v1/policy", async (req, res) => {
    try {
      const wallet = await withLedger((state) => {
        applyPolicy(state.policy, req.body ?? {});
        return viewWallet(state);
      });
      res.json(wallet);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid policy." });
    }
  });

  app.get("/v1/receipts", async (_req, res) => {
    const receipts = await withLedger((state) => state.receipts);
    res.json({ receipts });
  });

  app.get("/v1/receipts/:id", async (req, res) => {
    const receipt = await withLedger((state) => state.receipts.find((item) => item.id === req.params.id) ?? null);
    if (!receipt) {
      res.status(404).json({ error: "Receipt not found." });
      return;
    }
    res.json(receipt);
  });

  app.get("/v1/facilitator/supported", (_req, res) => {
    res.json(supported());
  });

  app.post("/v1/facilitator/verify", async (req, res) => {
    const payload = req.body?.paymentPayload as PaymentPayload | undefined;
    const requirements = req.body?.paymentRequirements as PaymentRequirements | undefined;
    if (!payload || !requirements) {
      res.status(400).json({ isValid: false, invalidReason: "invalid_payload", invalidMessage: "paymentPayload and paymentRequirements are required." });
      return;
    }
    res.json(await verifyPayment(payload, requirements));
  });

  app.post("/v1/facilitator/settle", async (req, res) => {
    const payload = req.body?.paymentPayload as PaymentPayload | undefined;
    const requirements = req.body?.paymentRequirements as PaymentRequirements | undefined;
    if (!payload || !requirements) {
      res.status(400).json({ success: false, errorReason: "invalid_payload", transaction: "", network: STELLAR.network });
      return;
    }
    res.json(
      await settlePayment(payload, requirements, {
        resourceUrl: String(req.body?.resourceUrl ?? ""),
        description: String(req.body?.description ?? "external settle"),
      }),
    );
  });

  registerResources(app);

  app.post("/v1/agent/run", async (req, res) => {
    const instruction = String(req.body?.instruction ?? "");
    if (!instruction.trim()) {
      res.status(400).json({ error: "instruction is required" });
      return;
    }
    const origin = String(app.locals.origin ?? `http://127.0.0.1:${process.env.PORT ?? 4020}`);
    const stream = req.header("accept")?.includes("application/x-ndjson");
    if (stream) {
      res.setHeader("content-type", "application/x-ndjson; charset=utf-8");
      res.setHeader("cache-control", "no-cache");
      for await (const event of runAgent(instruction, origin)) {
        res.write(`${JSON.stringify(event)}\n`);
      }
      res.end();
      return;
    }
    const events = [];
    let result = null;
    for await (const event of runAgent(instruction, origin)) {
      events.push(event);
      if (event.type === "done") result = event.result;
    }
    res.json({ events, result });
  });

  app.post("/v1/execute", async (req, res) => {
    const slug = String(req.body?.slug ?? "");
    const operation = String(req.body?.operation ?? "") as OperationId;
    const params = (req.body?.params ?? {}) as Record<string, unknown>;
    const api = getApi(slug);
    if (!api || !OPERATIONS.includes(operation)) {
      res.status(400).json({ error: "Unknown API or operation." });
      return;
    }
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) clean[key] = String(value);
    const keys = await withLedger((state) => ({ secret: state.payerSecret, from: state.payerPublic }));
    const origin = String(app.locals.origin ?? `http://127.0.0.1:${process.env.PORT ?? 4020}`);
    const paid = await executePaid({ origin, api, operation, params: clean, secret: keys.secret, from: keys.from });
    res.status(paid.status === "completed" ? 200 : 402).json(paid);
  });

  app.post("/mcp", async (req, res) => {
    const origin = String(app.locals.origin ?? `http://127.0.0.1:${process.env.PORT ?? 4020}`);
    res.json(await handleMcp(req.body ?? {}, origin));
  });

  return app;
}

function viewWallet(state: {
  payerPublic: string;
  merchantPublic: string;
  balanceAtomic: string;
  spentTodayAtomic: string;
  spentDate: string;
  policy: {
    dailyBudgetAtomic: string;
    maxPerRequestAtomic: string;
    confirmationLineAtomic: string;
    autonomousCategories: Category[];
    paused: boolean;
  };
}) {
  const remaining = subAtomic(state.policy.dailyBudgetAtomic, state.spentTodayAtomic);
  return {
    accountId: state.payerPublic,
    merchantId: state.merchantPublic,
    network: STELLAR.network,
    asset: "USDC",
    assetContract: STELLAR.testnet.contract,
    issuer: STELLAR.testnet.issuer,
    decimals: STELLAR.decimals,
    settlementMode: "local-facilitator",
    balanceAtomic: state.balanceAtomic,
    balanceUsdc: formatUsdc(state.balanceAtomic),
    spentTodayAtomic: state.spentTodayAtomic,
    spentTodayUsdc: formatUsdc(state.spentTodayAtomic),
    spentDate: state.spentDate,
    remainingBudgetAtomic: remaining,
    remainingBudgetUsdc: formatUsdc(remaining),
    policy: {
      dailyBudgetUsdc: formatUsdc(state.policy.dailyBudgetAtomic),
      maxPerRequestUsdc: formatUsdc(state.policy.maxPerRequestAtomic),
      confirmationLineUsdc: formatUsdc(state.policy.confirmationLineAtomic),
      autonomousCategories: state.policy.autonomousCategories,
      paused: state.policy.paused,
    },
  };
}

export function start(port = Number(process.env.PORT ?? 4020)): Promise<Server> {
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const actual = typeof address === "object" && address ? address.port : port;
      app.locals.origin = `http://127.0.0.1:${actual}`;
      resolve(server);
    });
  });
}
