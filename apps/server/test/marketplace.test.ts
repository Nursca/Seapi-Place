import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import type { PaymentRequired } from "../src/types";

process.env.LYRA_DATA_DIR = mkdtempSync(path.join(tmpdir(), "lyra-"));

let base = "";
let server: Server;

before(async () => {
  const { start } = await import("../src/app");
  server = await start(0);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("catalogue search ranks the naira adapter and keeps indexed FX visible", async () => {
  const response = await fetch(`${base}/v1/catalogue?q=${encodeURIComponent("usd ngn naira exchange rate historical")}`);
  const body = (await response.json()) as { items: Array<{ slug: string; access: string }> };
  const slugs = body.items.map((item) => item.slug);
  assert.ok(slugs.includes("meridian-fx"));
  assert.ok(slugs.includes("northline-fx"));
  const indexed = await fetch(`${base}/v1/catalogue/northline-fx`);
  const northline = (await indexed.json()) as { access: string; operations: unknown[] };
  assert.equal(northline.access, "indexed");
  assert.equal(northline.operations.length, 0);
});

test("an unprotected resource answers 402 with a Stellar USDC requirement", async () => {
  const response = await fetch(`${base}/v1/resources/fx/compare?base=USD&quote=NGN`);
  assert.equal(response.status, 402);
  const header = response.headers.get("payment-required");
  assert.ok(header);
  const required = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as {
    x402Version: number;
    accepts: Array<{ scheme: string; network: string; asset: string; amount: string; extra: { name: string } }>;
  };
  assert.equal(required.x402Version, 2);
  assert.equal(required.accepts[0].scheme, "exact");
  assert.equal(required.accepts[0].network, "stellar:testnet");
  assert.equal(required.accepts[0].asset, "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA");
  assert.equal(required.accepts[0].amount, "30000");
  assert.equal(required.accepts[0].extra.name, "USDC");
});

test("the agent compares USD and NGN with yesterday and settles one receipt", async () => {
  const beforeWallet = await (await fetch(`${base}/v1/wallet`)).json() as { balanceAtomic: string };
  const response = await fetch(`${base}/v1/agent/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      instruction: "Find the current exchange rate between USD and NGN and compare it with yesterday's rate.",
    }),
  });
  const body = (await response.json()) as {
    result: {
      status: string;
      answer: string;
      selected: { slug: string; priceAtomic: string } | null;
      data: { today: { rate: number; date: string }; yesterday: { rate: number; date: string } } | null;
      receipt: { amountAtomic: string; transaction: string; settlementMode: string; assetContract: string; network: string } | null;
      candidates: Array<{ slug: string; eligible: boolean; selected: boolean }>;
      protocol: { settle: { success: boolean; transaction: string } | null } | null;
    };
  };
  assert.equal(body.result.status, "completed");
  assert.equal(body.result.selected?.slug, "meridian-fx");
  assert.equal(body.result.selected?.priceAtomic, "30000");
  assert.equal(body.result.candidates.find((item) => item.slug === "frankfurter-ecb")?.eligible, false);
  assert.equal(body.result.candidates.find((item) => item.slug === "northline-fx")?.eligible, false);
  assert.ok(body.result.data);
  assert.equal(typeof body.result.data?.today.rate, "number");
  assert.notEqual(body.result.data?.today.date, body.result.data?.yesterday.date);
  assert.match(body.result.answer, /NGN/);
  assert.equal(body.result.receipt?.amountAtomic, "30000");
  assert.equal(body.result.receipt?.transaction, "");
  assert.equal(body.result.receipt?.settlementMode, "local-facilitator");
  assert.equal(body.result.receipt?.network, "stellar:testnet");
  assert.equal(body.result.protocol?.settle?.success, true);
  const afterWallet = await (await fetch(`${base}/v1/wallet`)).json() as { balanceAtomic: string };
  assert.equal(BigInt(beforeWallet.balanceAtomic) - BigInt(afterWallet.balanceAtomic), 30000n);
});

test("a cheaper ECB adapter wins for USD/EUR", async () => {
  const response = await fetch(`${base}/v1/agent/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ instruction: "Compare the USD to EUR exchange rate with yesterday." }),
  });
  const body = (await response.json()) as { result: { status: string; selected: { slug: string } | null } };
  assert.equal(body.result.status, "completed");
  assert.equal(body.result.selected?.slug, "frankfurter-ecb");
});

test("replayed payment signatures are rejected and not charged twice", async () => {
  const { buildPayload, encodeHeader, decodeHeader } = await import("../src/x402");
  const { withLedger } = await import("../src/store");
  const open = await fetch(`${base}/v1/resources/fees`);
  assert.equal(open.status, 402);
  const required = decodeHeader<PaymentRequired>(open.headers.get("payment-required") ?? "");
  const keys = await withLedger((state) => ({ secret: state.payerSecret, from: state.payerPublic }));
  const payload = buildPayload({
    secret: keys.secret,
    from: keys.from,
    requirements: required.accepts[0],
    resource: required.resource,
  });
  const header = encodeHeader(payload);
  const paid = await fetch(`${base}/v1/resources/fees`, { headers: { "PAYMENT-SIGNATURE": header } });
  assert.equal(paid.status, 200);
  const again = await fetch(`${base}/v1/resources/fees`, { headers: { "PAYMENT-SIGNATURE": header } });
  assert.equal(again.status, 402);
  const rejection = (await again.json()) as { verify?: { invalidReason?: string } };
  assert.equal(rejection.verify?.invalidReason, "replay");
});

test("spending policy blocks a call without a receipt", async () => {
  const before = await (await fetch(`${base}/v1/receipts`)).json() as { receipts: unknown[] };
  const updated = await fetch(`${base}/v1/policy`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ maxPerRequestUsdc: "0.0001", confirmationLineUsdc: "0.0001" }),
  });
  assert.equal(updated.status, 200);
  const response = await fetch(`${base}/v1/agent/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ instruction: "What is the weather in Lagos right now?" }),
  });
  const body = (await response.json()) as { result: { status: string; receipt: unknown; answer: string } };
  assert.equal(body.result.status, "blocked");
  assert.equal(body.result.receipt, null);
  assert.match(body.result.answer, /cap|confirmation|policy|Above/i);
  const after = await (await fetch(`${base}/v1/receipts`)).json() as { receipts: unknown[] };
  assert.equal(after.receipts.length, before.receipts.length);
  const restored = await fetch(`${base}/v1/policy`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ maxPerRequestUsdc: "0.05", confirmationLineUsdc: "0.02" }),
  });
  assert.equal(restored.status, 200);
});

test("MCP lists tools and can search", async () => {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  const body = (await response.json()) as { result: { tools: Array<{ name: string }> } };
  const names = body.result.tools.map((tool) => tool.name);
  assert.ok(names.includes("run_task"));
  assert.ok(names.includes("search_apis"));
  const search = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "search_apis", arguments: { query: "public holidays nigeria", limit: 5 } },
    }),
  });
  const searched = (await search.json()) as { result: { content: Array<{ text: string }> } };
  assert.match(searched.result.content[0].text, /nager-holidays/);
});
