import { Keypair } from "@stellar/stellar-base";
import type {
  Authorization,
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
  ResourceInfo,
} from "./types.js";
import { STELLAR } from "./stellar.js";

export function encodeHeader(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

export function decodeHeader<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T;
}

export function canonicalAuthorization(authorization: Authorization): string {
  return JSON.stringify({
    asset: authorization.asset,
    from: authorization.from,
    function: authorization.function,
    network: authorization.network,
    nonce: authorization.nonce,
    to: authorization.to,
    validAfter: authorization.validAfter,
    validBefore: authorization.validBefore,
    value: authorization.value,
  });
}

export function signAuthorization(secret: string, authorization: Authorization): string {
  const keypair = Keypair.fromSecret(secret);
  return keypair.sign(Buffer.from(canonicalAuthorization(authorization), "utf8")).toString("hex");
}

export function verifyAuthorization(publicKey: string, authorization: Authorization, signature: string): boolean {
  try {
    const keypair = Keypair.fromPublicKey(publicKey);
    return keypair.verify(
      Buffer.from(canonicalAuthorization(authorization), "utf8"),
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}

export function buildRequirements(input: {
  amount: string;
  payTo: string;
  category: PaymentRequirements["extra"]["category"];
  service: string;
  slug: string;
  operation: PaymentRequirements["extra"]["operation"];
}): PaymentRequirements {
  return {
    scheme: "exact",
    network: STELLAR.network,
    amount: input.amount,
    asset: STELLAR.testnet.contract,
    payTo: input.payTo,
    maxTimeoutSeconds: STELLAR.maxTimeoutSeconds,
    extra: {
      name: "USDC",
      decimals: 7,
      assetTransferMethod: "soroban-auth-entry",
      paymentFlow: "authorization",
      category: input.category,
      service: input.service,
      slug: input.slug,
      operation: input.operation,
      facilitator: "local",
      issuer: STELLAR.testnet.issuer,
    },
  };
}

export function buildPaymentRequired(input: {
  resource: ResourceInfo;
  requirements: PaymentRequirements;
  error?: string;
}): PaymentRequired {
  return {
    x402Version: 2,
    error: input.error,
    resource: input.resource,
    accepts: [input.requirements],
    extensions: {},
  };
}

export function buildPayload(input: {
  secret: string;
  from: string;
  requirements: PaymentRequirements;
  resource: ResourceInfo;
}): PaymentPayload {
  const now = Math.floor(Date.now() / 1000);
  const authorization: Authorization = {
    from: input.from,
    to: input.requirements.payTo,
    value: input.requirements.amount,
    validAfter: String(now - 5),
    validBefore: String(now + input.requirements.maxTimeoutSeconds),
    nonce: randomNonce(),
    asset: input.requirements.asset,
    network: "stellar:testnet",
    function: "transfer",
  };
  return {
    x402Version: 2,
    resource: input.resource,
    accepted: input.requirements,
    payload: {
      signature: signAuthorization(input.secret, authorization),
      signatureScheme: "ed25519-demo",
      authorization,
    },
    extensions: {},
  };
}

function randomNonce(): string {
  return `0x${Buffer.from(Keypair.random().rawPublicKey()).toString("hex")}`;
}

export function requirementsMatch(accepted: PaymentRequirements, expected: PaymentRequirements): string | null {
  if (accepted.scheme !== expected.scheme) return "scheme mismatch";
  if (accepted.network !== expected.network) return "network mismatch";
  if (accepted.amount !== expected.amount) return "amount mismatch";
  if (accepted.asset !== expected.asset) return "asset mismatch";
  if (accepted.payTo !== expected.payTo) return "payTo mismatch";
  return null;
}
