import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "@stellar/stellar-base";
import type { Category, LedgerState, Policy, Receipt } from "./types.js";
import { addAtomic, subAtomic, todayUtc } from "./stellar.js";

function ledgerFile(): string {
  const dataDir =
    process.env.LYRA_DATA_DIR ??
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
  return path.join(dataDir, "ledger.json");
}

const defaultCategories: Category[] = ["finance", "weather", "research", "data", "developer"];

export function defaultPolicy(): Policy {
  return {
    dailyBudgetAtomic: "50000000",
    maxPerRequestAtomic: "500000",
    confirmationLineAtomic: "200000",
    autonomousCategories: defaultCategories,
    paused: false,
  };
}

function freshState(): LedgerState {
  const payer = Keypair.random();
  const merchant = Keypair.random();
  return {
    payerPublic: payer.publicKey(),
    payerSecret: payer.secret(),
    merchantPublic: merchant.publicKey(),
    balanceAtomic: "250000000",
    spentTodayAtomic: "0",
    spentDate: todayUtc(),
    policy: defaultPolicy(),
    nonces: [],
    receipts: [],
  };
}

let memory: LedgerState | null = null;
let chain: Promise<unknown> = Promise.resolve();

function load(): LedgerState {
  if (memory) return memory;
  try {
    const parsed = JSON.parse(readFileSync(ledgerFile(), "utf8")) as LedgerState;
    memory = parsed;
    return parsed;
  } catch {
    memory = freshState();
    persist(memory);
    return memory;
  }
}

function persist(state: LedgerState) {
  const file = ledgerFile();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(state, null, 2));
}

export function withLedger<T>(fn: (state: LedgerState) => T): Promise<T> {
  const run = chain.then(() => {
    const state = load();
    rollDay(state);
    const result = fn(state);
    persist(state);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function rollDay(state: LedgerState) {
  const today = todayUtc();
  if (state.spentDate !== today) {
    state.spentDate = today;
    state.spentTodayAtomic = "0";
  }
}

export function publicLedger(state: LedgerState) {
  const { payerSecret: _secret, ...rest } = state;
  return rest;
}

export function debit(state: LedgerState, amountAtomic: string) {
  state.balanceAtomic = subAtomic(state.balanceAtomic, amountAtomic);
  state.spentTodayAtomic = addAtomic(state.spentTodayAtomic, amountAtomic);
}

export function rememberNonce(state: LedgerState, nonce: string) {
  state.nonces.push(nonce);
  if (state.nonces.length > 5000) state.nonces.splice(0, state.nonces.length - 5000);
}

export function addReceipt(state: LedgerState, receipt: Receipt) {
  state.receipts.unshift(receipt);
  if (state.receipts.length > 200) state.receipts.length = 200;
}
