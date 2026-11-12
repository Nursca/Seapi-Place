"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ApiSummary } from "@/lib/types";
import { IconBag, IconHeart, IconSearch, IconUser } from "./icons";

const links = [
  { href: "/discover?category=finance", label: "Finance", key: "finance" },
  { href: "/discover?category=weather", label: "Weather", key: "weather" },
  { href: "/discover?category=research", label: "Research", key: "research" },
  { href: "/providers", label: "Adapters", key: "adapters" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiSummary[]>([]);
  const [balance, setBalance] = useState<string | null>(null);
  const [receipts, setReceipts] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/v1/wallet").then((r) => r.json()), fetch("/api/v1/receipts").then((r) => r.json())])
      .then(([wallet, receiptBody]) => {
        if (cancelled) return;
        setBalance(wallet.balanceUsdc ?? null);
        setReceipts(Array.isArray(receiptBody.receipts) ? receiptBody.receipts.length : 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!searchOpen) return;
    const handle = window.setTimeout(() => {
      const q = query.trim();
      fetch(`/api/v1/catalogue?limit=6${q ? `&q=${encodeURIComponent(q)}` : ""}`)
        .then((response) => response.json())
        .then((body) => setResults(body.items ?? []))
        .catch(() => setResults([]));
    }, 160);
    return () => window.clearTimeout(handle);
  }, [query, searchOpen]);

  return (
    <>
      <div className="topbar">
        <div className="left">Agent settlement</div>
        <div className="center">USDC micropayments on Stellar</div>
        <div className="right">
          <Link href="/receipts">Receipts</Link>
          <span className="sep">|</span>
          <Link href="/help">Help</Link>
        </div>
      </div>
      <header className="nav">
        <nav className="nav-links" aria-label="Catalogue">
          {links.map((link) => (
            <Link key={link.key} href={link.href} data-active={pathname.startsWith(link.href.split("?")[0]) && link.key === "adapters" ? "true" : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
        <button className="icon-btn menu-toggle" type="button" aria-label="Menu" onClick={() => setOpen((value) => !value)}>
          <span style={{ letterSpacing: "0.14em", fontSize: 12 }}>MENU</span>
        </button>
        <Link href="/" className="logo" aria-label="LYRA home">
          LYRA
        </Link>
        <div className="nav-tools">
          {balance && (
            <Link href="/policy" className="balance-chip">
              {balance} USDC
            </Link>
          )}
          <button className="icon-btn" type="button" aria-label="Search the catalogue" onClick={() => setSearchOpen(true)}>
            <IconSearch />
          </button>
          <Link className="icon-btn" href="/policy" aria-label="Spending policy">
            <IconUser />
          </Link>
          <Link className="icon-btn" href="/discover" aria-label="Saved and catalogue">
            <IconHeart />
          </Link>
          <Link className="icon-btn" href="/receipts" aria-label={`Receipts, ${receipts}`}>
            <IconBag />
          </Link>
        </div>
      </header>
      <div className="drawer" data-open={open ? "true" : "false"}>
        {links.map((link) => (
          <Link key={link.key} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
        <Link href="/agent" onClick={() => setOpen(false)}>
          Agent
        </Link>
      </div>
      {searchOpen && (
        <div className="overlay" role="dialog" aria-label="Search">
          <header>
            <span className="kicker">Search</span>
            <button className="btn" type="button" onClick={() => setSearchOpen(false)}>
              Close
            </button>
          </header>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearchOpen(false);
              router.push(`/discover?q=${encodeURIComponent(query)}`);
            }}
          >
            <input
              autoFocus
              value={query}
              placeholder="Exchange rates, weather, holidays"
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search APIs"
            />
          </form>
          <ul>
            {results.map((api) => (
              <li key={api.slug}>
                <Link href={`/apis/${api.slug}`} onClick={() => setSearchOpen(false)}>
                  <span>
                    {api.name}
                    <small className="quiet" style={{ display: "block", marginTop: 4 }}>
                      {api.access} · {api.summary}
                    </small>
                  </span>
                  <span>{api.priceUsdc} USDC</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
