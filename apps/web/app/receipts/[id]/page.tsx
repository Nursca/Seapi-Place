import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { Receipt } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const receipt = await apiGet<Receipt>(`/v1/receipts/${id}`);
  if (!receipt) notFound();
  const rows: Array<[string, string]> = [
    ["Receipt", receipt.id],
    ["When", receipt.createdAt],
    ["Service", receipt.serviceName],
    ["Operation", receipt.operation],
    ["Amount", `${receipt.amountUsdc} USDC (${receipt.amountAtomic} atomic)`],
    ["Asset contract", receipt.assetContract],
    ["Issuer", receipt.issuer],
    ["Network", receipt.network],
    ["Scheme", receipt.scheme],
    ["x402", String(receipt.x402Version)],
    ["Payer", receipt.payer],
    ["Payee", receipt.payTo],
    ["Nonce", receipt.nonce],
    ["Resource", receipt.resourceUrl],
    ["Settlement", receipt.settlementMode],
    ["Transaction", receipt.transaction === "" ? "Empty. No transaction was broadcast." : receipt.transaction],
  ];
  return (
    <main className="page">
      <p className="kicker">
        <Link href="/receipts">Receipts</Link>
      </p>
      <h1 style={{ fontSize: "clamp(3rem, 6vw, 5rem)" }}>{receipt.amountUsdc}</h1>
      <p className="lede">{receipt.description}</p>
      <dl className="facts" style={{ maxWidth: 760 }}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd style={{ wordBreak: "break-all" }}>{value}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
