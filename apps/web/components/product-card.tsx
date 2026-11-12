import Link from "next/link";
import type { ApiSummary } from "@/lib/types";
import { HeartButton } from "./heart";
import { StillLife } from "./still-life";

const kinds = ["disc", "vessel", "fold", "bar"] as const;

export function ProductCard({ api, index = 0 }: { api: ApiSummary; index?: number }) {
  const kind = kinds[index % kinds.length];
  return (
    <article className="product">
      <div className="product-visual">
        <HeartButton slug={api.slug} />
        <Link href={`/apis/${api.slug}`} aria-label={api.name}>
          <StillLife kind={kind} />
        </Link>
      </div>
      <Link href={`/apis/${api.slug}`}>
        <h3>{api.name}</h3>
        <p className="meta">
          {api.category} · {api.priceUsdc} USDC
          {api.access === "indexed" ? " · indexed" : ""}
        </p>
      </Link>
    </article>
  );
}
