import type { Category, LedgerState, PaymentRequirements, VerifyResponse } from "./types.js";
import { cmpAtomic, formatUsdc, subAtomic } from "./stellar.js";

export function policyDenial(state: LedgerState, requirements: PaymentRequirements): VerifyResponse | null {
  const amount = requirements.amount;
  const category = requirements.extra.category;
  const policy = state.policy;

  if (policy.paused) {
    return deny("spending_policy", "Agent spending is paused.");
  }
  if (!policy.autonomousCategories.includes(category)) {
    return deny("spending_policy", `The ${category} category is outside the autonomous budget.`);
  }
  if (cmpAtomic(amount, policy.maxPerRequestAtomic) > 0) {
    return deny(
      "spending_policy",
      `Price ${formatUsdc(amount)} USDC is above the per-request cap of ${formatUsdc(policy.maxPerRequestAtomic)} USDC.`,
    );
  }
  if (cmpAtomic(amount, policy.confirmationLineAtomic) > 0) {
    return deny(
      "spending_policy",
      `Price ${formatUsdc(amount)} USDC is above the autonomous confirmation line of ${formatUsdc(policy.confirmationLineAtomic)} USDC.`,
    );
  }
  const remaining = subAtomic(policy.dailyBudgetAtomic, state.spentTodayAtomic);
  if (cmpAtomic(amount, remaining) > 0) {
    return deny(
      "spending_policy",
      `Daily budget remaining is ${formatUsdc(remaining)} USDC.`,
    );
  }
  if (cmpAtomic(amount, state.balanceAtomic) > 0) {
    return deny("insufficient_funds", `Demo balance is ${formatUsdc(state.balanceAtomic)} USDC.`);
  }
  return null;
}

function deny(invalidReason: string, invalidMessage: string): VerifyResponse {
  return { isValid: false, invalidReason, invalidMessage };
}

export function isCategory(value: string): value is Category {
  return ["finance", "weather", "research", "data", "maps", "commerce", "developer"].includes(value);
}
