import { PolicyForm } from "@/components/policy-form";
import { apiGet } from "@/lib/api";
import type { Wallet } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  const wallet = await apiGet<Wallet>("/v1/wallet");
  return (
    <main className="page">
      <p className="kicker">Smart account</p>
      <h1>Spending, bounded.</h1>
      <p className="lede">
        The demo account stands in for a Stellar smart account. Its policy is checked before a signature is settled. Raise a cap and the agent can spend. Lower it beneath a price and the call stops with the balance untouched.
      </p>
      {wallet ? <PolicyForm initial={wallet} /> : <p className="note">The wallet service is not reachable.</p>}
    </main>
  );
}
