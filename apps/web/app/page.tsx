import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { StillLife } from "@/components/still-life";
import { IconBox, IconLock, IconSeal, IconTruck } from "@/components/icons";
import { apiGet } from "@/lib/api";
import type { ApiSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

const featured = ["meridian-fx", "open-meteo", "frankfurter-ecb", "nager-holidays"];

export default async function HomePage() {
  const apis = (
    await Promise.all(featured.map((slug) => apiGet<ApiSummary>(`/v1/catalogue/${slug}`)))
  ).filter((api): api is ApiSummary => Boolean(api));
  const stats = await apiGet<{ total: number; executable: number; indexed: number }>("/v1/stats");

  return (
    <main>
      <section className="hero">
        <h1 className="wordmark">LYRA</h1>
        <div className="hero-stage">
          <StillLife kind="plinth" />
        </div>
        <div className="hero-foot">
          <div>
            <h2>
              ACCESS
              <br />
              THAT SETTLES
            </h2>
            <Link className="btn" href="/agent">
              Run agent
            </Link>
          </div>
          <div className="meta-block">
            <p>
              CATALOGUE
              <br />
              NO. 1
            </p>
            <p className="est">EST. 2026</p>
          </div>
        </div>
      </section>

      <section className="band">
        <Link href="/discover?category=finance">
          <div className="thumb">
            <StillLife kind="sole" />
          </div>
          <div>
            <h3>FINANCE</h3>
            <p>Rates, with a price on the request.</p>
            <span>OPEN FINANCE →</span>
          </div>
        </Link>
        <Link href="/discover?category=weather">
          <div className="thumb">
            <StillLife kind="shaft" />
          </div>
          <div>
            <h3>WEATHER</h3>
            <p>Conditions, paid per call.</p>
            <span>OPEN WEATHER →</span>
          </div>
        </Link>
        <Link href="/discover?category=research">
          <div className="thumb">
            <StillLife kind="lace" />
          </div>
          <div>
            <h3>RESEARCH</h3>
            <p>Sources, indexed until authorized.</p>
            <span>OPEN RESEARCH →</span>
          </div>
        </Link>
      </section>

      <section className="editorial">
        <div className="editorial-copy">
          <p className="kicker">Agent runtime —</p>
          <h2>
            Pay per
            <br />
            request
          </h2>
          <p className="lede">
            Give an instruction. The agent searches the catalogue, refuses anything without provider authorization, accepts a USDC price, and returns the figure with a receipt.
          </p>
          <Link className="btn" href="/discover">
            Explore catalogue
          </Link>
        </div>
        <StillLife kind="bench" />
      </section>

      <section className="assurance">
        <article>
          <IconTruck />
          <div>
            <h3>FAST SETTLEMENT</h3>
            <p>x402 on Stellar, about five seconds when broadcast.</p>
          </div>
        </article>
        <article>
          <IconBox />
          <div>
            <h3>SPENDING LIMITS</h3>
            <p>A daily budget and a per-request cap.</p>
          </div>
        </article>
        <article>
          <IconSeal />
          <div>
            <h3>PROVIDER TERMS</h3>
            <p>Adapters run only after authorization.</p>
          </div>
        </article>
        <article>
          <IconLock />
          <div>
            <h3>VERIFIABLE RECEIPTS</h3>
            <p>Amount, asset, payer, and nonce on every call.</p>
          </div>
        </article>
      </section>

      <section className="shelf">
        <div className="shelf-head">
          <h2>BEST OF LYRA</h2>
          <Link href="/discover">VIEW ALL</Link>
        </div>
        <div className="grid-4">
          {apis.map((api, index) => (
            <ProductCard key={api.slug} api={api} index={index} />
          ))}
        </div>
        {stats && (
          <p className="quiet" style={{ marginTop: "1.4rem" }}>
            {stats.executable} executable · {stats.indexed} indexed · {stats.total} in this deployment
          </p>
        )}
      </section>
    </main>
  );
}
