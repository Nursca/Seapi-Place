"use client";

import Link from "next/link";
import { useState } from "react";
import type { Operation } from "@/lib/types";

export function CallPanel({ slug, operations }: { slug: string; operations: Operation[] }) {
  const [operation, setOperation] = useState(operations[0]?.id ?? "");
  const [base, setBase] = useState("USD");
  const [quote, setQuote] = useState(slug === "frankfurter-ecb" ? "EUR" : "NGN");
  const [place, setPlace] = useState("Lagos");
  const [country, setCountry] = useState("Nigeria");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const selected = operations.find((item) => item.id === operation) ?? operations[0];
  const needsPair = selected?.id === "spot" || selected?.id === "compare";
  const needsPlace = selected?.id === "current";
  const needsCountry = selected?.id === "holidays";

  async function call() {
    setPending(true);
    setMessage(null);
    setReceiptId(null);
    const params: Record<string, string> = {};
    if (needsPair) {
      params.base = base;
      params.quote = quote;
    }
    if (needsPlace) params.place = place;
    if (needsCountry) params.country = country;
    const response = await fetch("/api/v1/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, operation, params }),
    });
    const body = await response.json();
    setPending(false);
    if (body.status === "completed") {
      setMessage(String(body.data?.text ?? "Paid and returned."));
      setReceiptId(body.receipt?.id ?? null);
      return;
    }
    setMessage(body.message ?? body.error ?? "The call did not settle.");
  }

  return (
    <div className="call">
      <p className="kicker">Pay and call</p>
      {operations.length > 1 && (
        <div className="chips">
          {operations.map((item) => (
            <button key={item.id} className="chip" type="button" data-active={item.id === operation} onClick={() => setOperation(item.id)}>
              {item.title} · {item.priceUsdc}
            </button>
          ))}
        </div>
      )}
      {needsPair && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <label>
            Base
            <input value={base} onChange={(event) => setBase(event.target.value.toUpperCase())} maxLength={3} />
          </label>
          <label>
            Quote
            <input value={quote} onChange={(event) => setQuote(event.target.value.toUpperCase())} maxLength={3} />
          </label>
        </div>
      )}
      {needsPlace && (
        <label>
          City
          <input value={place} onChange={(event) => setPlace(event.target.value)} />
        </label>
      )}
      {needsCountry && (
        <label>
          Country
          <input value={country} onChange={(event) => setCountry(event.target.value)} />
        </label>
      )}
      <button className="btn" type="button" onClick={call} disabled={pending}>
        {pending ? "Settling" : `Pay ${selected?.priceUsdc ?? ""} USDC`}
      </button>
      {message && <p className="note">{message}</p>}
      {receiptId && (
        <p>
          <Link href={`/receipts/${receiptId}`}>Open receipt {receiptId}</Link>
        </p>
      )}
    </div>
  );
}
