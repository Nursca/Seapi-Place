import { runAgent } from "./agent.js";
import { getApi, searchApis } from "./catalogue.js";
import { withLedger } from "./store.js";
import { formatUsdc, parseUsdc } from "./stellar.js";
import { isCategory } from "./policy.js";
import type { Category } from "./types.js";

type Rpc = { jsonrpc?: string; id?: number | string | null; method?: string; params?: Record<string, unknown> };

const tools = [
  {
    name: "search_apis",
    description: "Search the LYRA catalogue by natural language. Indexed APIs are discovery-only.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number" } },
      required: ["query"],
    },
  },
  {
    name: "run_task",
    description: "Discover, price, pay with x402 USDC on the demo smart account, and execute an authorized API.",
    inputSchema: {
      type: "object",
      properties: { instruction: { type: "string" } },
      required: ["instruction"],
    },
  },
  {
    name: "get_spending_policy",
    description: "Read the demo smart account balance and spending policy.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "set_spending_policy",
    description: "Update budgets, the per-request cap, autonomous categories, or pause spending.",
    inputSchema: {
      type: "object",
      properties: {
        dailyBudgetUsdc: { type: "string" },
        maxPerRequestUsdc: { type: "string" },
        confirmationLineUsdc: { type: "string" },
        autonomousCategories: { type: "array", items: { type: "string" } },
        paused: { type: "boolean" },
      },
    },
  },
  {
    name: "list_receipts",
    description: "List x402 receipts recorded by the local facilitator.",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } },
  },
];

export async function handleMcp(message: Rpc, origin: string) {
  const id = message.id ?? null;
  if (message.method === "initialize") {
    return result(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "lyra", version: "0.1.0" },
    });
  }
  if (message.method === "ping") return result(id, {});
  if (message.method === "tools/list") return result(id, { tools });
  if (message.method === "tools/call") {
    const name = String(message.params?.name ?? "");
    const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
    try {
      const content = await callTool(name, args, origin);
      return result(id, { content: [{ type: "text", text: JSON.stringify(content, null, 2) }], isError: false });
    } catch (error) {
      return result(id, {
        content: [{ type: "text", text: error instanceof Error ? error.message : "tool failed" }],
        isError: true,
      });
    }
  }
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method ${message.method ?? ""}` } };
}

async function callTool(name: string, args: Record<string, unknown>, origin: string) {
  if (name === "search_apis") {
    const query = String(args.query ?? "");
    const limit = Number(args.limit ?? 8);
    return searchApis(query, limit).map((api) => ({
      slug: api.slug,
      name: api.name,
      access: api.access,
      category: api.category,
      summary: api.summary,
      priceUsdc: formatUsdc(api.priceAtomic),
      score: api.score,
    }));
  }
  if (name === "run_task") {
    const instruction = String(args.instruction ?? "");
    let done = null;
    for await (const event of runAgent(instruction, origin)) {
      if (event.type === "done") done = event.result;
      if (event.type === "error") throw new Error(event.error);
    }
    return done;
  }
  if (name === "get_spending_policy") {
    return withLedger((state) => ({
      accountId: state.payerPublic,
      balanceUsdc: formatUsdc(state.balanceAtomic),
      spentTodayUsdc: formatUsdc(state.spentTodayAtomic),
      policy: {
        dailyBudgetUsdc: formatUsdc(state.policy.dailyBudgetAtomic),
        maxPerRequestUsdc: formatUsdc(state.policy.maxPerRequestAtomic),
        confirmationLineUsdc: formatUsdc(state.policy.confirmationLineAtomic),
        autonomousCategories: state.policy.autonomousCategories,
        paused: state.policy.paused,
      },
    }));
  }
  if (name === "set_spending_policy") {
    return withLedger((state) => {
      applyPolicy(state.policy, args);
      return { ok: true };
    });
  }
  if (name === "list_receipts") {
    const limit = Number(args.limit ?? 10);
    return withLedger((state) => state.receipts.slice(0, limit));
  }
  const api = name === "get_api" ? getApi(String(args.slug ?? "")) : undefined;
  if (api) return api;
  throw new Error(`Unknown tool ${name}`);
}

export function applyPolicy(
  policy: { dailyBudgetAtomic: string; maxPerRequestAtomic: string; confirmationLineAtomic: string; autonomousCategories: Category[]; paused: boolean },
  args: Record<string, unknown>,
) {
  const next = {
    dailyBudgetAtomic: policy.dailyBudgetAtomic,
    maxPerRequestAtomic: policy.maxPerRequestAtomic,
    confirmationLineAtomic: policy.confirmationLineAtomic,
    autonomousCategories: policy.autonomousCategories,
    paused: policy.paused,
  };
  if (typeof args.dailyBudgetUsdc === "string") {
    const parsed = parseUsdc(args.dailyBudgetUsdc);
    if (parsed === null) throw new Error("dailyBudgetUsdc is not a USDC amount.");
    next.dailyBudgetAtomic = parsed;
  }
  if (typeof args.maxPerRequestUsdc === "string") {
    const parsed = parseUsdc(args.maxPerRequestUsdc);
    if (parsed === null) throw new Error("maxPerRequestUsdc is not a USDC amount.");
    next.maxPerRequestAtomic = parsed;
  }
  if (typeof args.confirmationLineUsdc === "string") {
    const parsed = parseUsdc(args.confirmationLineUsdc);
    if (parsed === null) throw new Error("confirmationLineUsdc is not a USDC amount.");
    next.confirmationLineAtomic = parsed;
  }
  if (Array.isArray(args.autonomousCategories)) {
    next.autonomousCategories = args.autonomousCategories.filter(
      (item): item is Category => typeof item === "string" && isCategory(item),
    );
  }
  if (typeof args.paused === "boolean") next.paused = args.paused;
  if (BigInt(next.confirmationLineAtomic) > BigInt(next.maxPerRequestAtomic)) {
    throw new Error("The confirmation line cannot sit above the per-request cap.");
  }
  policy.dailyBudgetAtomic = next.dailyBudgetAtomic;
  policy.maxPerRequestAtomic = next.maxPerRequestAtomic;
  policy.confirmationLineAtomic = next.confirmationLineAtomic;
  policy.autonomousCategories = next.autonomousCategories;
  policy.paused = next.paused;
}

function result(id: number | string | null, value: unknown) {
  return { jsonrpc: "2.0", id, result: value };
}
