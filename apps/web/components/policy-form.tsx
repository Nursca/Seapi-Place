"use client";

import { useState } from "react";
import type { Wallet } from "@/lib/types";

const CATEGORIES = ["finance", "weather", "research", "data", "maps", "commerce", "developer"];

export function PolicyForm({ initial }: { initial: Wallet }) {
  const [wallet, setWallet] = useState(initial);
  const [daily, setDaily] = useState(initial.policy.dailyBudgetUsdc);
  const [cap, setCap] = useState(initial.policy.maxPerRequestUsdc);
  const [line, setLine] = useState(initial.policy.confirmationLineUsdc);
  const [categories, setCategories] = useState(initial.policy.autonomousCategories);
  const [paused, setPaused] = useState(initial.policy.paused);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(category: string) {
    setCategories((current) => (current.includes(category) ? current.filter((item) => item !== category) : [...current, category]));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/v1/policy", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dailyBudgetUsdc: daily,
        maxPerRequestUsdc: cap,
        confirmationLineUsdc: line,
        autonomousCategories: categories,
        paused,
      }),
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(body.error ?? "Could not save.");
      return;
    }
    setWallet(body);
    setMessage("Saved. The agent will use this on the next run.");
  }

  return (
    <div className="policy-grid">
      <p className="quiet">
        {wallet.balanceUsdc} USDC available · {wallet.spentTodayUsdc} spent today · {wallet.remainingBudgetUsdc} left in the daily budget
      </p>
      <form
        className="policy-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label>
          Daily budget, USDC
          <input value={daily} onChange={(event) => setDaily(event.target.value)} inputMode="decimal" />
        </label>
        <label>
          Per-request cap, USDC
          <input value={cap} onChange={(event) => setCap(event.target.value)} inputMode="decimal" />
        </label>
        <label>
          Autonomous confirmation line, USDC
          <input value={line} onChange={(event) => setLine(event.target.value)} inputMode="decimal" />
        </label>
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend className="quiet">Autonomous categories</legend>
          <div className="chips" style={{ marginTop: "0.6rem" }}>
            {CATEGORIES.map((category) => (
              <label key={category} className="check">
                <input type="checkbox" checked={categories.includes(category)} onChange={() => toggle(category)} />
                {category}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="check">
          <input type="checkbox" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
          Pause the agent
        </label>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving" : "Save policy"}
        </button>
        {message && <p className="note">{message}</p>}
      </form>
      <div className="facts">
        <div>
          <dt>Smart account</dt>
          <dd style={{ wordBreak: "break-all" }}>{wallet.accountId}</dd>
        </div>
        <div>
          <dt>Merchant</dt>
          <dd style={{ wordBreak: "break-all" }}>{wallet.merchantId}</dd>
        </div>
        <div>
          <dt>Asset</dt>
          <dd>
            USDC · {wallet.assetContract}
          </dd>
        </div>
        <div>
          <dt>Settlement</dt>
          <dd>{wallet.settlementMode}</dd>
        </div>
      </div>
    </div>
  );
}
