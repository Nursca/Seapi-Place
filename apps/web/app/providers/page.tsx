import { apiGet } from "@/lib/api";
import type { Provider } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const body = await apiGet<{ providers: Provider[] }>("/v1/providers");
  const providers = body?.providers ?? [];
  return (
    <main className="page">
      <p className="kicker">Authorization</p>
      <h1>Breadth, with permission.</h1>
      <p className="lede">
        A wide index is useful only if execution waits for a yes. LYRA separates discovery from the right to call.
      </p>
      <div className="columns-3">
        <article>
          <h2>Breadth</h2>
          <p>The index can grow without turning the marketplace into an open proxy. Indexed rows carry a price and a description. They have no resource route.</p>
        </article>
        <article>
          <h2>Adapters</h2>
          <p>An existing REST service gets an x402 gate here: HTTP 402, a USDC requirement, then the original call. The provider does not have to rebuild billing.</p>
        </article>
        <article>
          <h2>Autonomy</h2>
          <p>Inside a daily budget, a per-request cap, and a category list, the agent can discover, pay, and execute without a person approving each call.</p>
        </article>
      </div>
      <div style={{ marginTop: "2.5rem" }}>
        {providers.map((provider) => (
          <article key={provider.id} className="receipt" style={{ gridTemplateColumns: "1.2fr 0.5fr 1.4fr" }}>
            <div>
              <strong>{provider.legalName}</strong>
              <p className="quiet">{provider.status === "authorized" ? `Authorized ${provider.authorizedAt ?? ""}` : "No authorization on file"}</p>
            </div>
            <div className="quiet">{provider.model}</div>
            <p className="note" style={{ margin: 0 }}>
              {provider.resaleRights}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}
