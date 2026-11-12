import Link from "next/link";
import { apiGet } from "@/lib/api";
import { shortAccount } from "@/lib/money";
import type { Receipt } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  const body = await apiGet<{ receipts: Receipt[] }>("/v1/receipts");
  const receipts = body?.receipts ?? [];
  return (
    <main className="page">
      <p className="kicker">Track</p>
      <h1>Receipts.</h1>
      <p className="lede">
        Each settled call keeps the x402 amount, the testnet USDC contract, the payer, and the payee. The transaction field is empty: this facilitator records the debit locally and does not broadcast.
      </p>
      {receipts.length === 0 && <p className="note">No receipts yet. Run the agent to write the first one.</p>}
      <div>
        {receipts.map((receipt) => (
          <Link key={receipt.id} href={`/receipts/${receipt.id}`} className="receipt">
            <div>
              <strong>{receipt.serviceName}</strong>
              <p className="quiet">{receipt.description}</p>
            </div>
            <div>{receipt.amountUsdc} USDC</div>
            <div className="quiet">
              {new Date(receipt.createdAt).toLocaleString("en-GB", { hour12: false })}
              <br />
              {shortAccount(receipt.payer)}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
