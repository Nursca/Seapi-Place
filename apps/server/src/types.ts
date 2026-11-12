export const CATEGORIES = [
  "finance",
  "weather",
  "research",
  "data",
  "maps",
  "commerce",
  "developer",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Access = "adapter" | "native" | "indexed";
export type OperationId = "spot" | "compare" | "current" | "holidays" | "fees";

export type Operation = {
  id: OperationId;
  title: string;
  priceAtomic: string;
  path: string;
};

export type ApiRecord = {
  slug: string;
  name: string;
  category: Category;
  access: Access;
  summary: string;
  description: string;
  tags: string[];
  capabilities: string[];
  providerId: string;
  latencyMs: number;
  availability: string;
  regions: string[];
  rateLimitPerMinute: number;
  /** Lowest operation price, or the listed index price. */
  priceAtomic: string;
  pricingNotes: string;
  upstreamAtomic: string;
  operations: Operation[];
  /** "any" or an explicit set. Only executable APIs are checked. */
  currencies: "any" | string[];
};

export type ProviderRecord = {
  id: string;
  name: string;
  legalName: string;
  status: "authorized" | "indexed";
  model: Access;
  credentialRef: string | null;
  credentialIsolation: string;
  resaleRights: string;
  rateLimitPerMinute: number;
  termsUrl: string | null;
  authorizedAt: string | null;
  scope: string[];
};

export type Policy = {
  dailyBudgetAtomic: string;
  maxPerRequestAtomic: string;
  confirmationLineAtomic: string;
  autonomousCategories: Category[];
  paused: boolean;
};

export type Receipt = {
  id: string;
  createdAt: string;
  network: "stellar:testnet";
  scheme: "exact";
  x402Version: 2;
  asset: "USDC";
  assetContract: string;
  issuer: string;
  amountAtomic: string;
  amountUsdc: string;
  payer: string;
  payTo: string;
  nonce: string;
  resourceUrl: string;
  serviceName: string;
  apiSlug: string;
  operation: OperationId;
  category: Category;
  settlementMode: "local-facilitator";
  transaction: "";
  signature: string;
  description: string;
};

export type LedgerState = {
  payerPublic: string;
  payerSecret: string;
  merchantPublic: string;
  balanceAtomic: string;
  spentTodayAtomic: string;
  spentDate: string;
  policy: Policy;
  nonces: string[];
  receipts: Receipt[];
};

export type PaymentRequirements = {
  scheme: "exact";
  network: "stellar:testnet";
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: {
    name: "USDC";
    decimals: 7;
    assetTransferMethod: "soroban-auth-entry";
    paymentFlow: "authorization";
    category: Category;
    service: string;
    slug: string;
    operation: OperationId;
    facilitator: string;
    issuer: string;
  };
};

export type ResourceInfo = {
  url: string;
  description: string;
  mimeType: "application/json";
  serviceName: string;
  tags: string[];
};

export type PaymentRequired = {
  x402Version: 2;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
  extensions: Record<string, unknown>;
};

export type Authorization = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
  asset: string;
  network: "stellar:testnet";
  function: "transfer";
};

export type PaymentPayload = {
  x402Version: 2;
  resource?: ResourceInfo;
  accepted: PaymentRequirements;
  payload: {
    signature: string;
    signatureScheme: "ed25519-demo";
    authorization: Authorization;
  };
  extensions: Record<string, unknown>;
};

export type VerifyResponse = {
  isValid: boolean;
  invalidReason?: string;
  invalidMessage?: string;
  payer?: string;
};

export type SettleResponse = {
  success: boolean;
  errorReason?: string;
  errorMessage?: string;
  payer?: string;
  transaction: string;
  network: "stellar:testnet";
  amount?: string;
  extensions?: {
    lyra: {
      receiptId: string;
      settlementMode: "local-facilitator";
      note: string;
    };
  };
};

export type StepId =
  | "instruction"
  | "discover"
  | "evaluate"
  | "payment"
  | "execute"
  | "result";

export type CandidateView = {
  slug: string;
  name: string;
  access: Access;
  category: Category;
  priceAtomic: string;
  priceUsdc: string;
  score: number;
  latencyMs: number;
  eligible: boolean;
  selected: boolean;
  reasons: string[];
};

export type AgentEvent =
  | { type: "step"; step: StepId; title: string; detail: Record<string, unknown> }
  | { type: "done"; result: AgentResult }
  | { type: "error"; error: string };

export type AgentResult = {
  status: "completed" | "blocked" | "no_match" | "upstream_error";
  instruction: string;
  answer: string;
  selected: CandidateView | null;
  candidates: CandidateView[];
  data: Record<string, unknown> | null;
  receipt: Receipt | null;
  protocol: {
    paymentRequired: PaymentRequired | null;
    paymentSignature: PaymentPayload | null;
    verify: VerifyResponse | null;
    settle: SettleResponse | null;
  } | null;
};
