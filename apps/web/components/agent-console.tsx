"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDay, formatRate, shortAccount } from "@/lib/money";
import type { AgentResult, Candidate, Receipt } from "@/lib/types";

const STEPS = [
  ["instruction", "Instruction"],
  ["discover", "Discovery"],
  ["evaluate", "Pricing"],
  ["payment", "Payment"],
  ["execute", "Execution"],
  ["result", "Result"],
] as const;

const PROMPTS = [
  { label: "USD / NGN", text: "Find the current exchange rate between USD and NGN and compare it with yesterday's rate." },
  { label: "Lagos weather", text: "What's the weather in Lagos right now?" },
  { label: "Nigeria holidays", text: "Next public holidays in Nigeria" },
  { label: "USD / EUR", text: "Compare the USD to EUR exchange rate with yesterday." },
];

type StepId = (typeof STEPS)[number][0];

export function AgentConsole() {
  const [instruction, setInstruction] = useState(PROMPTS[0].text);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Set<StepId>>(new Set());
  const [details, setDetails] = useState<Record<string, Record<string, unknown>>>({});
  const [result, setResult] = useState<AgentResult | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    setDone(new Set());
    setDetails({});
    try {
      const response = await fetch("/api/v1/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/x-ndjson" },
        body: JSON.stringify({ instruction }),
      });
      if (!response.ok || !response.body) {
        setError("The agent could not start.");
        setRunning(false);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: string;
            step?: StepId;
            detail?: Record<string, unknown>;
            result?: AgentResult;
            error?: string;
          };
          if (event.type === "step" && event.step) {
            setDone((current) => new Set(current).add(event.step as StepId));
            setDetails((current) => ({ ...current, [event.step as string]: event.detail ?? {} }));
          }
          if (event.type === "done" && event.result) setResult(event.result);
          if (event.type === "error") setError(event.error ?? "The agent failed.");
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The agent failed.");
    } finally {
      setRunning(false);
    }
  }

  const candidates = (details.evaluate?.candidates as Candidate[] | undefined) ?? result?.candidates ?? [];

  return (
    <div className="agent-layout">
      <div>
        <label className="quiet" htmlFor="instruction">
          Instruction
        </label>
        <textarea id="instruction" className="prompt" value={instruction} onChange={(event) => setInstruction(event.target.value)} />
        <div className="chips" style={{ marginTop: "0.9rem" }}>
          {PROMPTS.map((prompt) => (
            <button key={prompt.label} className="chip" type="button" data-active={prompt.text === instruction} onClick={() => setInstruction(prompt.text)}>
              {prompt.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: "1.1rem" }}>
          <button className="btn" type="button" onClick={run} disabled={running || !instruction.trim()}>
            {running ? "Working" : "Run agent"}
          </button>
        </div>
        {error && <p className="note">{error}</p>}
        <ol className="steps">
          {STEPS.map(([id, title], index) => (
            <li key={id} data-state={done.has(id) ? "done" : "wait"}>
              <span className="num">0{index + 1}</span>
              <div>
                <h3>{title}</h3>
                <StepCopy id={id} detail={details[id]} />
              </div>
            </li>
          ))}
        </ol>
        {candidates.length > 0 && (
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="eval">
              <thead>
                <tr>
                  <th>API</th>
                  <th>Access</th>
                  <th>Price</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {candidates.slice(0, 5).map((candidate) => (
                  <tr key={candidate.slug} data-selected={candidate.selected}>
                    <td>{candidate.name}</td>
                    <td>{candidate.access}</td>
                    <td>{candidate.priceUsdc}</td>
                    <td>{candidate.reasons[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ResultPanel result={result} running={running} />
    </div>
  );
}

function StepCopy({ id, detail }: { id: StepId; detail?: Record<string, unknown> }) {
  if (!detail) {
    const waiting: Record<StepId, string> = {
      instruction: "The instruction is read as a task, not a search box.",
      discover: "The catalogue is searched by capability.",
      evaluate: "Authorized APIs are compared on coverage and price.",
      payment: "A 402 returns the USDC amount, asset, and payee.",
      execute: "The adapter runs only after the payment verifies.",
      result: "You get the figure, the API, and a receipt.",
    };
    return <p>{waiting[id]}</p>;
  }
  if (id === "discover") return <p>Searched for {String(detail.query ?? "")}.</p>;
  if (id === "payment") {
    if (detail.status === "settled") return <p>HTTP 402, then {String(detail.amountUsdc)} USDC recorded. Receipt {String(detail.receiptId)}.</p>;
    if (detail.status === "refused" || detail.status === "rejected" || detail.status === "skipped") {
      return <p>{String(detail.reason ?? "No payment was made.")}</p>;
    }
    return <p>Payment step finished.</p>;
  }
  if (id === "result") return <p>{String(detail.answer ?? "")}</p>;
  if (id === "instruction") {
    const intent = detail.intent as { kind?: string; base?: string; quote?: string; operation?: string } | undefined;
    if (intent?.kind === "fx") return <p>Pair {intent.base}/{intent.quote}, operation {intent.operation}.</p>;
    return <p>Read as {intent?.kind ?? "a task"}.</p>;
  }
  if (id === "evaluate") return <p>{detail.selected ? `Selected ${String(detail.selected)}.` : "No executable API fit the policy."}</p>;
  if (id === "execute") return <p>{detail.status === "skipped" ? "Nothing was called." : `Called ${String(detail.slug ?? detail.source ?? "the adapter")}.`}</p>;
  return null;
}

function ResultPanel({ result, running }: { result: AgentResult | null; running: boolean }) {
  if (!result) {
    return (
      <aside className="result-card">
        <p className="kicker">{running ? "In progress" : "Awaiting an instruction"}</p>
        <p className="lede">The answer lands here with the API that was paid and the receipt that proves it.</p>
      </aside>
    );
  }
  const today = ratePoint(result.data, "today");
  const yesterday = ratePoint(result.data, "yesterday");
  return (
    <aside className="result-card">
      <p className="kicker">{result.status}</p>
      {today && yesterday ? (
        <>
          <p className="quiet">
            {String(result.data?.base)} / {String(result.data?.quote)}
          </p>
          <p className="figure">{formatRate(today.rate)}</p>
          <table className="compare">
            <thead>
              <tr>
                <th>Date</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{formatDay(today.date)}</td>
                <td>{formatRate(today.rate)}</td>
              </tr>
              <tr>
                <td>{formatDay(yesterday.date)}</td>
                <td>{formatRate(yesterday.rate)}</td>
              </tr>
            </tbody>
          </table>
        </>
      ) : (
        <p className="lede">{result.answer}</p>
      )}
      {today && <p>{result.answer}</p>}
      {result.selected && (
        <p className="quiet">
          {result.selected.name} · {result.selected.priceUsdc} USDC · {result.selected.access}
        </p>
      )}
      {result.receipt && <ReceiptLines receipt={result.receipt} />}
      {result.protocol && (
        <details className="protocol">
          <summary>Protocol</summary>
          <pre>{JSON.stringify(result.protocol, null, 2)}</pre>
        </details>
      )}
    </aside>
  );
}

function ReceiptLines({ receipt }: { receipt: Receipt }) {
  return (
    <div className="facts">
      <div>
        <dt>Receipt</dt>
        <dd>
          <Link href={`/receipts/${receipt.id}`}>{receipt.id}</Link>
        </dd>
      </div>
      <div>
        <dt>Paid</dt>
        <dd>{receipt.amountUsdc} USDC</dd>
      </div>
      <div>
        <dt>Network</dt>
        <dd>{receipt.network}</dd>
      </div>
      <div>
        <dt>Payer</dt>
        <dd>{shortAccount(receipt.payer)}</dd>
      </div>
      <div>
        <dt>Settlement</dt>
        <dd>{receipt.settlementMode}. Transaction field is empty because nothing was broadcast.</dd>
      </div>
    </div>
  );
}

function ratePoint(data: Record<string, unknown> | null, key: string): { date: string; rate: number } | null {
  const value = data?.[key] as { date?: string; rate?: number } | undefined;
  if (!value || typeof value.rate !== "number" || typeof value.date !== "string") return null;
  return { date: value.date, rate: value.rate };
}
