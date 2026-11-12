import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { apiGet } from "@/lib/api";
import type { Access, ApiSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

const categories = ["", "finance", "weather", "research", "data", "maps", "commerce", "developer"];
const accesses = ["", "adapter", "native", "indexed"];

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; access?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const category = params.category ?? "";
  const access = params.access ?? "";
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (category) query.set("category", category);
  if (access) query.set("access", access);
  query.set("limit", "48");
  const body = await apiGet<{ total: number; items: ApiSummary[] }>(`/v1/catalogue?${query.toString()}`);
  const items = body?.items ?? [];

  return (
    <main className="page">
      <p className="kicker">Catalogue no. 1</p>
      <h1>The index.</h1>
      <p className="lede">
        Executable services have an authorization on file. Everything else can be discovered and cannot be called.
        {body ? ` ${body.total} shown for this filter.` : ""}
      </p>
      <form className="filters" action="/discover">
        <div className="search-form">
          <input name="q" defaultValue={q} placeholder="Search by capability, pair, or city" aria-label="Search" />
          {category && <input type="hidden" name="category" value={category} />}
          {access && <input type="hidden" name="access" value={access} />}
          <button type="submit">Search</button>
        </div>
      </form>
      <div className="chips" style={{ marginBottom: "0.8rem" }}>
        {categories.map((item) => (
          <Link key={item || "all"} href={href({ q, category: item, access })} data-active={item === category}>
            {item || "All"}
          </Link>
        ))}
      </div>
      <div className="chips" style={{ marginBottom: "1.4rem" }}>
        {accesses.map((item) => (
          <Link key={item || "any"} href={href({ q, category, access: item })} data-active={item === access}>
            {item || "Any access"}
          </Link>
        ))}
      </div>
      <div className="grid-catalog">
        {items.map((api, index) => (
          <ProductCard key={api.slug} api={api} index={index} />
        ))}
      </div>
      {items.length === 0 && <p className="note">Nothing matched. Try a broader word, or clear the filter.</p>}
    </main>
  );
}

function href(input: { q: string; category: string; access: string }) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.category) params.set("category", input.category);
  if (input.access) params.set("access", input.access as Access);
  const text = params.toString();
  return text ? `/discover?${text}` : "/discover";
}
