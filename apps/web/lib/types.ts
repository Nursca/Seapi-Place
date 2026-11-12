export type Access = "adapter" | "native" | "indexed";

export type ApiSummary = {
  slug: string;
  name: string;
  category: string;
  access: Access;
  summary: string;
  priceUsdc: string;
  priceAtomic: string;
  latencyMs: number;
  availability: string;
  tags: string[];
};

export type Operation = {
  id: string;
  title: string;
  priceAtomic: string;
  priceUsdc: string;
  path: string;
};

export type Provider = {
  id: string;
  name: string;
  legalName: string;
  status: string;
  model: string;
  credentialRef: string | null;
  credentialIsolation: string;
  resaleRights: string;
  rateLimitPerMinute: number;
  termsUrl: string | null;
  authorizedAt: string | null;
  scope: string[];
};

export type ApiDetail = ApiSummary & {
  description: string;
  capabilities: string[];
  pricingNotes: string;
  upstreamAtomic: string;
  rateLimitPerMinute: number;
  regions: string[];
  operations: Operation[];
  provider: Provider | null;
};

export type Wallet = {
  accountId: string;
  merchantId: string;
  network: string;
  asset: string;
  assetContract: string;
  issuer: string;
  settlementMode: string;
  balanceUsdc: string;
  spentTodayUsdc: string;
  remainingBudgetUsdc: string;
  policy: {
    dailyBudgetUsdc: string;
    maxPerRequestUsdc: string;
    confirmationLineUsdc: string;
    autonomousCategories: string[];
    paused: boolean;
  };
};

export type Receipt = {
  id: string;
  createdAt: string;
  network: string;
  scheme: string;
  x402Version: number;
  asset: string;
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
  operation: string;
  category: string;
  settlementMode: string;
  transaction: string;
  description: string;
};

export type Candidate = {
  slug: string;
  name: string;
  access: Access;
  category: string;
  priceUsdc: string;
  latencyMs: number;
  eligible: boolean;
  selected: boolean;
  reasons: string[];
};

export type AgentResult = {
  status: "completed" | "blocked" | "no_match" | "upstream_error";
  instruction: string;
  answer: string;
  selected: Candidate | null;
  candidates: Candidate[];
  data: Record<string, unknown> | null;
  receipt: Receipt | null;
  protocol: Record<string, unknown> | null;
};
