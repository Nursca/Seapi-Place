import { randomBytes } from "node:crypto";
import type { PaymentPayload, PaymentRequirements, Receipt, SettleResponse, VerifyResponse } from "./types.js";
import { STELLAR, formatUsdc } from "./stellar.js";
import { addReceipt, debit, rememberNonce, withLedger } from "./store.js";
import { policyDenial } from "./policy.js";
import { requirementsMatch, verifyAuthorization } from "./x402.js";

/**
 * Local x402 facilitator.
 *
 * Verify is read-only. Settle records a USDC debit on the demo ledger.
 * The signature is ed25519 over the authorization payload. It is not a
 * Soroban auth entry, and nothing is broadcast. `transaction` stays empty,
 * which is what the x402 spec requires when no transaction was submitted.
 */
export async function verifyPayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<VerifyResponse> {
  return withLedger((state) => {
    const structural = inspect(state.payerPublic, paymentPayload, paymentRequirements, state.nonces);
    if (structural) return structural;
    const policy = policyDenial(state, paymentRequirements);
    if (policy) return { ...policy, payer: paymentPayload.payload.authorization.from };
    return { isValid: true, payer: paymentPayload.payload.authorization.from };
  });
}

export async function settlePayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  meta: { resourceUrl: string; description: string },
): Promise<SettleResponse> {
  return withLedger((state) => {
    const structural = inspect(state.payerPublic, paymentPayload, paymentRequirements, state.nonces);
    if (structural) {
      return {
        success: false,
        errorReason: structural.invalidReason,
        errorMessage: structural.invalidMessage,
        payer: paymentPayload.payload.authorization.from,
        transaction: "",
        network: "stellar:testnet",
      };
    }
    const policy = policyDenial(state, paymentRequirements);
    if (policy) {
      return {
        success: false,
        errorReason: policy.invalidReason,
        errorMessage: policy.invalidMessage,
        payer: paymentPayload.payload.authorization.from,
        transaction: "",
        network: "stellar:testnet",
      };
    }

    const amount = paymentRequirements.amount;
    debit(state, amount);
    rememberNonce(state, paymentPayload.payload.authorization.nonce);
    const receipt: Receipt = {
      id: `rec_${randomBytes(8).toString("hex")}`,
      createdAt: new Date().toISOString(),
      network: "stellar:testnet",
      scheme: "exact",
      x402Version: 2,
      asset: "USDC",
      assetContract: STELLAR.testnet.contract,
      issuer: STELLAR.testnet.issuer,
      amountAtomic: amount,
      amountUsdc: formatUsdc(amount),
      payer: paymentPayload.payload.authorization.from,
      payTo: paymentRequirements.payTo,
      nonce: paymentPayload.payload.authorization.nonce,
      resourceUrl: meta.resourceUrl,
      serviceName: paymentRequirements.extra.service,
      apiSlug: paymentRequirements.extra.slug,
      operation: paymentRequirements.extra.operation,
      category: paymentRequirements.extra.category,
      settlementMode: "local-facilitator",
      transaction: "",
      signature: paymentPayload.payload.signature,
      description: meta.description,
    };
    addReceipt(state, receipt);
    return {
      success: true,
      payer: receipt.payer,
      transaction: "",
      network: "stellar:testnet",
      amount,
      extensions: {
        lyra: {
          receiptId: receipt.id,
          settlementMode: "local-facilitator",
          note: "Recorded by the local facilitator. No Stellar transaction was broadcast. A production payer would replace this ed25519 demo signature with a Soroban authorization entry and settle through a Stellar facilitator.",
        },
      },
    };
  });
}

function inspect(
  payerPublic: string,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  nonces: string[],
): VerifyResponse | null {
  if (paymentPayload.x402Version !== 2) {
    return { isValid: false, invalidReason: "invalid_payload", invalidMessage: "x402Version must be 2." };
  }
  const mismatch = requirementsMatch(paymentPayload.accepted, paymentRequirements);
  if (mismatch) {
    return { isValid: false, invalidReason: "invalid_payload", invalidMessage: mismatch };
  }
  const authorization = paymentPayload.payload.authorization;
  if (authorization.from !== payerPublic) {
    return { isValid: false, invalidReason: "invalid_payload", invalidMessage: "Payer is not the demo smart account." };
  }
  if (authorization.to !== paymentRequirements.payTo || authorization.value !== paymentRequirements.amount) {
    return { isValid: false, invalidReason: "invalid_payload", invalidMessage: "Authorization does not match the price." };
  }
  if (authorization.asset !== paymentRequirements.asset || authorization.network !== "stellar:testnet") {
    return { isValid: false, invalidReason: "invalid_payload", invalidMessage: "Asset or network is not testnet USDC." };
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(authorization.validBefore) < now || Number(authorization.validAfter) > now) {
    return { isValid: false, invalidReason: "expired", invalidMessage: "Authorization is outside its validity window." };
  }
  if (nonces.includes(authorization.nonce)) {
    return { isValid: false, invalidReason: "replay", invalidMessage: "This nonce was already settled." };
  }
  const valid = verifyAuthorization(payerPublic, authorization, paymentPayload.payload.signature);
  if (!valid) {
    return { isValid: false, invalidReason: "invalid_signature", invalidMessage: "Signature did not verify." };
  }
  return null;
}

export function supported() {
  return {
    kinds: [
      {
        x402Version: 2,
        scheme: "exact",
        network: "stellar:testnet",
        extra: {
          name: "USDC",
          decimals: 7,
          asset: STELLAR.testnet.contract,
          issuer: STELLAR.testnet.issuer,
          assetTransferMethod: "soroban-auth-entry",
          settlementMode: "local-facilitator",
          fee: "sponsored-in-production",
        },
      },
    ],
    extensions: [],
    signers: {},
  };
}
