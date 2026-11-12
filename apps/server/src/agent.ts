import { executableInCategory, getApi, searchApis } from "./catalogue.js";
import { categoryOf, interpret, operationOf, searchQuery, type Intent } from "./intent.js";
import { policyDenial } from "./policy.js";
import { withLedger } from "./store.js";
import { cmpAtomic, formatUsdc } from "./stellar.js";
import type {
  AgentEvent,
  AgentResult,
  ApiRecord,
  CandidateView,
  OperationId,
  PaymentPayload,
  PaymentRequired,
  SettleResponse,
} from "./types.js";
import { buildPayload, decodeHeader, encodeHeader } from "./x402.js";

const STEP_TITLES = {
  instruction: "Instruction",
  discover: "Discovery",
  evaluate: "Pricing",
  payment: "Payment",
  execute: "Execution",
  result: "Result",
} as const;

export async function* runAgent(instruction: string, origin: string): AsyncGenerator<AgentEvent> {
  const trimmed = instruction.trim();
  const intent = interpret(trimmed);
  yield {
    type: "step",
    step: "instruction",
    title: STEP_TITLES.instruction,
    detail: { instruction: trimmed, intent },
  };

  if (intent.kind === "unknown") {
    const found = searchApis(trimmed, 6).map((api) => toCandidate(api, api.score, false, ["Shown from search. The instruction did not match an executable operation."]));
    const result: AgentResult = {
      status: "no_match",
      instruction: trimmed,
      answer: "No executable operation matched that instruction. The index below is discovery only.",
      selected: null,
      candidates: found,
      data: null,
      receipt: null,
      protocol: null,
    };
    yield { type: "step", step: "discover", title: STEP_TITLES.discover, detail: { query: trimmed, count: found.length } };
    yield { type: "step", step: "result", title: STEP_TITLES.result, detail: { status: "no_match", answer: result.answer } };
    yield { type: "done", result };
    return;
  }

  const query = searchQuery(intent);
  const ranked = searchApis(query, 80);
  const scores = new Map(ranked.map((api) => [api.slug, api.score]));
  const category = categoryOf(intent);
  const pool = new Map<string, ApiRecord & { score: number }>();
  for (const api of category ? executableInCategory(category) : []) {
    pool.set(api.slug, { ...api, score: scores.get(api.slug) ?? 0 });
  }
  for (const api of ranked.slice(0, 6)) pool.set(api.slug, api);

  yield {
    type: "step",
    step: "discover",
    title: STEP_TITLES.discover,
    detail: {
      query,
      count: pool.size,
      names: [...pool.values()].map((api) => api.name),
    },
  };

  const ledger = await withLedger((state) => ({
    policy: state.policy,
    balanceAtomic: state.balanceAtomic,
    spentTodayAtomic: state.spentTodayAtomic,
    secret: state.payerSecret,
    from: state.payerPublic,
  }));

  const operation = operationOf(intent) as OperationId;
  let candidates = [...pool.values()].map((api) =>
    annotate(api, intent, operation, api.score, ledger.policy, ledger.balanceAtomic, ledger.spentTodayAtomic),
  );
  const eligible = candidates.filter((candidate) => candidate.eligible);
  eligible.sort((a, b) => cmpAtomic(a.priceAtomic, b.priceAtomic) || b.score - a.score);
  const winner = eligible[0] ?? null;
  candidates = candidates
    .map((candidate) => ({ ...candidate, selected: winner?.slug === candidate.slug }))
    .sort(
      (a, b) =>
        Number(b.selected) - Number(a.selected) ||
        Number(b.eligible) - Number(a.eligible) ||
        Number(a.access === "indexed") - Number(b.access === "indexed") ||
        b.score - a.score,
    );

  yield {
    type: "step",
    step: "evaluate",
    title: STEP_TITLES.evaluate,
    detail: { candidates, selected: winner?.slug ?? null },
  };

  if (!winner) {
    const lead = candidates.find((candidate) => candidate.access !== "indexed") ?? candidates[0];
    const answer = lead
      ? `No API could be called. ${lead.name}: ${lead.reasons[0]}`
      : "Nothing in the catalogue matched.";
    const result: AgentResult = {
      status: candidates.some((candidate) => candidate.access !== "indexed") ? "blocked" : "no_match",
      instruction: trimmed,
      answer,
      selected: null,
      candidates,
      data: null,
      receipt: null,
      protocol: null,
    };
    yield { type: "step", step: "payment", title: STEP_TITLES.payment, detail: { status: "skipped", reason: answer } };
    yield { type: "step", step: "result", title: STEP_TITLES.result, detail: { status: result.status, answer } };
    yield { type: "done", result };
    return;
  }

  const api = getApi(winner.slug);
  const op = api?.operations.find((item) => item.id === operation);
  if (!api || !op) {
    yield { type: "error", error: "Selected API disappeared from the catalogue." };
    return;
  }

  const paid = await executePaid({
    origin,
    api,
    operation,
    params: paramsFor(intent),
    secret: ledger.secret,
    from: ledger.from,
  });

  yield { type: "step", step: "payment", title: STEP_TITLES.payment, detail: paid.paymentDetail };

  if (paid.status !== "completed") {
    const result: AgentResult = {
      status: paid.status,
      instruction: trimmed,
      answer: paid.message,
      selected: winner,
      candidates,
      data: null,
      receipt: null,
      protocol: paid.protocol,
    };
    yield { type: "step", step: "execute", title: STEP_TITLES.execute, detail: { status: "skipped" } };
    yield { type: "step", step: "result", title: STEP_TITLES.result, detail: { status: paid.status, answer: paid.message } };
    yield { type: "done", result };
    return;
  }

  yield {
    type: "step",
    step: "execute",
    title: STEP_TITLES.execute,
    detail: { source: (paid.data?.source as string) ?? api.name, slug: api.slug },
  };

  const answer = typeof paid.data?.text === "string" ? paid.data.text : "The call completed.";
  const result: AgentResult = {
    status: "completed",
    instruction: trimmed,
    answer,
    selected: winner,
    candidates,
    data: paid.data,
    receipt: paid.receipt,
    protocol: paid.protocol,
  };
  yield {
    type: "step",
    step: "result",
    title: STEP_TITLES.result,
    detail: { status: "completed", answer, receiptId: paid.receipt?.id ?? null },
  };
  yield { type: "done", result };
}

function paramsFor(intent: Intent): Record<string, string> {
  if (intent.kind === "fx") return { base: intent.base, quote: intent.quote };
  if (intent.kind === "weather") return { place: intent.place };
  if (intent.kind === "holidays") return { country: intent.country };
  return {};
}

function annotate(
  api: ApiRecord & { score: number },
  intent: Intent,
  operation: OperationId,
  score: number,
  policy: { paused: boolean; autonomousCategories: string[]; maxPerRequestAtomic: string; confirmationLineAtomic: string; dailyBudgetAtomic: string },
  balanceAtomic: string,
  spentTodayAtomic: string,
): CandidateView {
  const reasons: string[] = [];
  let eligible = true;
  const op = api.operations.find((item) => item.id === operation);
  const priceAtomic = op?.priceAtomic ?? api.priceAtomic;

  if (api.access === "indexed") {
    eligible = false;
    reasons.push("No provider authorization. Execution is disabled.");
  } else if (!op) {
    eligible = false;
    reasons.push("Does not offer this operation.");
  }

  if (eligible && intent.kind === "fx") {
    const covers =
      api.currencies === "any" ||
      (api.currencies.includes(intent.base) && api.currencies.includes(intent.quote));
    if (!covers) {
      eligible = false;
      reasons.push(`Does not cover ${intent.base}/${intent.quote}.`);
    }
  }

  if (eligible && policy.paused) {
    eligible = false;
    reasons.push("Spending is paused.");
  }
  if (eligible && !policy.autonomousCategories.includes(api.category)) {
    eligible = false;
    reasons.push("Category is outside the autonomous budget.");
  }
  if (eligible && cmpAtomic(priceAtomic, policy.maxPerRequestAtomic) > 0) {
    eligible = false;
    reasons.push(`Above the per-request cap of ${formatUsdc(policy.maxPerRequestAtomic)} USDC.`);
  }
  if (eligible && cmpAtomic(priceAtomic, policy.confirmationLineAtomic) > 0) {
    eligible = false;
    reasons.push(`Above the confirmation line of ${formatUsdc(policy.confirmationLineAtomic)} USDC.`);
  }
  const remaining = (BigInt(policy.dailyBudgetAtomic) - BigInt(spentTodayAtomic)).toString();
  if (eligible && cmpAtomic(priceAtomic, remaining) > 0) {
    eligible = false;
    reasons.push("Daily budget would be exceeded.");
  }
  if (eligible && cmpAtomic(priceAtomic, balanceAtomic) > 0) {
    eligible = false;
    reasons.push("Demo balance is too low.");
  }
  if (eligible) {
    reasons.push(
      `${api.access === "native" ? "Native x402" : "Authorized adapter"} at ${formatUsdc(priceAtomic)} USDC.`,
    );
  }

  return {
    slug: api.slug,
    name: api.name,
    access: api.access,
    category: api.category,
    priceAtomic,
    priceUsdc: formatUsdc(priceAtomic),
    score,
    latencyMs: api.latencyMs,
    eligible,
    selected: false,
    reasons,
  };
}

function toCandidate(api: ApiRecord, score: number, eligible: boolean, reasons: string[]): CandidateView {
  return {
    slug: api.slug,
    name: api.name,
    access: api.access,
    category: api.category,
    priceAtomic: api.priceAtomic,
    priceUsdc: formatUsdc(api.priceAtomic),
    score,
    latencyMs: api.latencyMs,
    eligible,
    selected: false,
    reasons,
  };
}

type Paid = {
  status: "completed" | "blocked" | "upstream_error";
  message: string;
  data: Record<string, unknown> | null;
  receipt: AgentResult["receipt"];
  protocol: AgentResult["protocol"];
  paymentDetail: Record<string, unknown>;
};

export async function executePaid(input: {
  origin: string;
  api: ApiRecord;
  operation: OperationId;
  params: Record<string, string>;
  secret: string;
  from: string;
}): Promise<Paid> {
  const op = input.api.operations.find((item) => item.id === input.operation);
  if (!op) {
    return {
      status: "blocked",
      message: "That operation is not executable.",
      data: null,
      receipt: null,
      protocol: null,
      paymentDetail: { status: "skipped" },
    };
  }
  const url = new URL(op.path, input.origin);
  for (const [key, value] of Object.entries(input.params)) url.searchParams.set(key, value);
  const first = await fetch(url);
  const requiredHeader = first.headers.get("payment-required");
  const requiredBody = (await first.json()) as PaymentRequired;
  if (first.status !== 402 || !requiredHeader) {
    return {
      status: "blocked",
      message: "The resource did not return HTTP 402.",
      data: null,
      receipt: null,
      protocol: { paymentRequired: requiredBody, paymentSignature: null, verify: null, settle: null },
      paymentDetail: { status: "unexpected", http: first.status },
    };
  }
  const paymentRequired = decodeHeader<PaymentRequired>(requiredHeader);
  const requirements = paymentRequired.accepts[0];
  const paymentSignature: PaymentPayload = buildPayload({
    secret: input.secret,
    from: input.from,
    requirements,
    resource: paymentRequired.resource,
  });

  const precheck = await withLedger((state) => policyDenial(state, requirements));
  if (precheck) {
    return {
      status: "blocked",
      message: precheck.invalidMessage ?? "Spending policy refused the payment.",
      data: null,
      receipt: null,
      protocol: { paymentRequired, paymentSignature: null, verify: precheck, settle: null },
      paymentDetail: {
        status: "refused",
        http: 402,
        amountUsdc: formatUsdc(requirements.amount),
        reason: precheck.invalidMessage,
        paymentRequired,
      },
    };
  }

  const second = await fetch(url, {
    headers: { "PAYMENT-SIGNATURE": encodeHeader(paymentSignature) },
  });
  const responseHeader = second.headers.get("payment-response");
  const body = (await second.json()) as {
    data?: Record<string, unknown>;
    settlement?: SettleResponse;
    error?: string;
    message?: string;
    verify?: { isValid: boolean; invalidMessage?: string };
  };

  if (second.status === 502) {
    return {
      status: "upstream_error",
      message: body.message ?? "The upstream API failed. Nothing was settled.",
      data: null,
      receipt: null,
      protocol: { paymentRequired, paymentSignature, verify: { isValid: true }, settle: null },
      paymentDetail: {
        status: "verified_not_settled",
        http: 402,
        amountUsdc: formatUsdc(requirements.amount),
        paymentRequired,
      },
    };
  }

  if (!second.ok || !responseHeader || !body.settlement?.success) {
    const reason = body.verify?.invalidMessage ?? body.message ?? body.error ?? "Payment was not accepted.";
    return {
      status: "blocked",
      message: reason,
      data: null,
      receipt: null,
      protocol: {
        paymentRequired,
        paymentSignature,
        verify: body.verify ?? null,
        settle: body.settlement ?? null,
      },
      paymentDetail: { status: "rejected", http: second.status, reason, paymentRequired },
    };
  }

  const settle = decodeHeader<SettleResponse>(responseHeader);
  const receiptId = settle.extensions?.lyra.receiptId ?? null;
  const receipt = receiptId
    ? await withLedger((state) => state.receipts.find((item) => item.id === receiptId) ?? null)
    : null;

  return {
    status: "completed",
    message: "Settled.",
    data: body.data ?? null,
    receipt,
    protocol: {
      paymentRequired,
      paymentSignature,
      verify: { isValid: true, payer: settle.payer },
      settle,
    },
    paymentDetail: {
      status: "settled",
      challenge: 402,
      settledHttp: 200,
      amountUsdc: formatUsdc(requirements.amount),
      network: requirements.network,
      asset: requirements.asset,
      payTo: requirements.payTo,
      receiptId,
      settlementMode: "local-facilitator",
      paymentRequired,
    },
  };
}
