import Link from "next/link";
import { notFound } from "next/navigation";
import { CallPanel } from "@/components/call-panel";
import { StillLife } from "@/components/still-life";
import { apiGet } from "@/lib/api";
import { formatUsdc } from "@/lib/money";
import type { ApiDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

const visuals = {
  finance: "disc",
  weather: "vessel",
  research: "fold",
  data: "bar",
  maps: "disc",
  commerce: "fold",
  developer: "bar",
} as const;

export default async function ApiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const api = await apiGet<ApiDetail>(`/v1/catalogue/${slug}`);
  if (!api) notFound();
  const visual = visuals[api.category as keyof typeof visuals] ?? "disc";

  return (
    <main className="page">
      <p className="kicker">
        <Link href="/discover">Catalogue</Link> / {api.category}
      </p>
      <div className="detail">
        <div className="detail-visual">
          <StillLife kind={visual} />
        </div>
        <div>
          <h1 style={{ fontSize: "clamp(3rem, 6vw, 5rem)" }}>{api.name}</h1>
          <p className="price-xl">{api.access === "indexed" ? api.priceUsdc : `from ${api.priceUsdc}`} USDC</p>
          <p className="lede">{api.description}</p>
          <dl className="facts">
            <div>
              <dt>Access</dt>
              <dd>{api.access === "indexed" ? "Indexed. Execution is off." : api.access === "native" ? "Native x402 resource." : "Authorized adapter."}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>{api.provider?.legalName ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt>Price note</dt>
              <dd>{api.pricingNotes}</dd>
            </div>
            <div>
              <dt>Upstream</dt>
              <dd>{formatUsdc(api.upstreamAtomic)} USDC passed through. The rest is the access fee.</dd>
            </div>
            <div>
              <dt>Rate limit</dt>
              <dd>{api.rateLimitPerMinute ? `${api.rateLimitPerMinute} requests / minute` : "Not connected"}</dd>
            </div>
            <div>
              <dt>Rights</dt>
              <dd>{api.provider?.resaleRights}</dd>
            </div>
            <div>
              <dt>Credentials</dt>
              <dd>
                {api.provider?.credentialRef
                  ? `Isolated environment reference ${api.provider.credentialRef}. The value is never returned.`
                  : api.provider?.credentialIsolation}
              </dd>
            </div>
          </dl>
          {api.provider?.termsUrl && (
            <p>
              <a href={api.provider.termsUrl}>Provider terms</a>
            </p>
          )}
          {api.operations.length > 0 ? (
            <CallPanel slug={api.slug} operations={api.operations} />
          ) : (
            <p className="note">This listing stays in the index until the provider authorizes an adapter or a native x402 endpoint. There is no pay button.</p>
          )}
        </div>
      </div>
    </main>
  );
}
