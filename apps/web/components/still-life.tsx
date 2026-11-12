import { useId } from "react";

type Kind = "plinth" | "bench" | "sole" | "shaft" | "lace" | "disc" | "vessel" | "fold" | "bar";

export function StillLife({ kind }: { kind: Kind }) {
  const raw = useId().replace(/:/g, "");
  if (kind === "plinth") return <Plinth id={raw} />;
  if (kind === "bench") return <Bench id={raw} />;
  if (kind === "sole") return <Crop id={raw} tone="sole" />;
  if (kind === "shaft") return <Crop id={raw} tone="shaft" />;
  if (kind === "lace") return <Crop id={raw} tone="lace" />;
  return <CardStill id={raw} kind={kind} />;
}

function Grain({ id }: { id: string }) {
  return (
    <defs>
      <filter id={`${id}-grain`} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="table" tableValues="0 0.22" />
        </feComponentTransfer>
      </filter>
      <linearGradient id={`${id}-slab`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d7d1c6" />
        <stop offset="1" stopColor="#b7b1a6" />
      </linearGradient>
      <linearGradient id={`${id}-rock`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#c4beb4" />
        <stop offset="0.55" stopColor="#a39c92" />
        <stop offset="1" stopColor="#8d867c" />
      </linearGradient>
      <linearGradient id={`${id}-clay`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#e4d8c8" />
        <stop offset="0.45" stopColor="#c9b7a3" />
        <stop offset="1" stopColor="#b09a84" />
      </linearGradient>
      <linearGradient id={`${id}-ink`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3a3835" />
        <stop offset="1" stopColor="#161514" />
      </linearGradient>
    </defs>
  );
}

function Plinth({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 640 560" className="h-[460px] w-auto max-w-full" role="img" aria-label="A clay disc on a concrete plinth">
      <Grain id={id} />
      <ellipse cx="320" cy="500" rx="180" ry="22" fill="#000" opacity="0.14" />
      <path d="M150 430 C170 360 210 340 250 348 C280 300 360 292 410 330 C470 300 530 340 520 410 C500 470 180 480 150 430Z" fill={`url(#${id}-rock)`} />
      <path d="M188 392 C230 360 300 358 340 378 C390 352 470 370 478 410 C430 430 230 438 188 392Z" fill="#b7b1a6" opacity="0.55" />
      <rect x="176" y="250" width="288" height="132" fill={`url(#${id}-slab)`} />
      <rect x="176" y="250" width="288" height="16" fill="#ece6dc" />
      <rect x="176" y="366" width="288" height="16" fill="#9c968c" />
      <ellipse cx="320" cy="248" rx="118" ry="28" fill={`url(#${id}-clay)`} />
      <ellipse cx="320" cy="236" rx="118" ry="28" fill="#ddcfc0" />
      <ellipse cx="286" cy="228" rx="46" ry="10" fill="#fff" opacity="0.28" />
      <rect width="640" height="560" filter={`url(#${id}-grain)`} opacity="0.35" />
    </svg>
  );
}

function Bench({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 800 640" className="h-full w-full" role="img" aria-label="A ceramic vessel on a concrete bench">
      <Grain id={id} />
      <rect width="800" height="640" fill="#d5cfc4" />
      <rect x="0" y="210" width="800" height="250" fill="#cfc8bc" />
      <rect x="40" y="286" width="720" height="86" fill={`url(#${id}-slab)`} />
      <rect x="40" y="286" width="720" height="12" fill="#ece6dc" />
      <rect x="110" y="372" width="34" height="160" fill="#b7b1a6" />
      <rect x="640" y="372" width="34" height="160" fill="#a8a297" />
      <path d="M470 78 C530 78 590 140 598 210 C606 270 560 292 512 298 L430 298 C378 290 352 246 362 196 C374 130 410 78 470 78Z" fill={`url(#${id}-clay)`} />
      <ellipse cx="492" cy="96" rx="58" ry="16" fill="#efe4d6" />
      <path d="M430 150 C456 128 530 126 568 156" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="8" />
      <rect width="800" height="640" filter={`url(#${id}-grain)`} opacity="0.28" />
    </svg>
  );
}

function Crop({ id, tone }: { id: string; tone: "sole" | "shaft" | "lace" }) {
  const fills = {
    sole: ["#1c1b19", "#3a342c", "#cbbba6"],
    shaft: ["#c9b7a3", "#e6d9c9", "#8d867c"],
    lace: ["#f3efe6", "#d9d3c8", "#141311"],
  }[tone];
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden="true">
      <Grain id={id} />
      <rect width="160" height="160" fill={fills[0]} />
      {tone === "sole" && (
        <>
          <path d="M20 110 C40 40 120 30 140 90 C150 120 30 140 20 110Z" fill={fills[2]} />
          <path d="M36 96 C70 70 120 78 132 100" fill="none" stroke={fills[1]} strokeWidth="6" />
        </>
      )}
      {tone === "shaft" && (
        <>
          <rect width="160" height="160" fill="#2a2724" />
          <path d="M58 18 H108 V148 H58Z" fill="#cbbba6" />
          <path d="M58 18 H108 V42 C88 62 72 36 58 48Z" fill="#efe4d6" />
          <rect x="74" y="70" width="16" height="46" fill="#2a2724" opacity="0.25" />
        </>
      )}
      {tone === "lace" && (
        <>
          <path d="M30 30 C80 20 90 70 40 80 C10 88 20 40 30 30Z" fill="none" stroke={fills[2]} strokeWidth="3" />
          <path d="M70 50 C120 36 140 90 90 108" fill="none" stroke={fills[2]} strokeWidth="3" />
          <path d="M40 100 C90 90 120 130 70 142" fill="none" stroke={fills[2]} strokeWidth="3" />
          <circle cx="78" cy="78" r="4" fill={fills[2]} />
        </>
      )}
      <rect width="160" height="160" filter={`url(#${id}-grain)`} opacity="0.35" />
    </svg>
  );
}

function CardStill({ id, kind }: { id: string; kind: "disc" | "vessel" | "fold" | "bar" }) {
  return (
    <svg viewBox="0 0 400 420" className="h-full w-full" aria-hidden="true">
      <Grain id={id} />
      <rect width="400" height="420" fill="#efeadd" />
      <ellipse cx="200" cy="330" rx="110" ry="16" fill="#000" opacity="0.08" />
      {kind === "disc" && (
        <>
          <rect x="92" y="214" width="216" height="78" fill={`url(#${id}-slab)`} />
          <ellipse cx="200" cy="200" rx="86" ry="22" fill={`url(#${id}-clay)`} />
          <ellipse cx="200" cy="190" rx="86" ry="22" fill="#e6d8c8" />
        </>
      )}
      {kind === "vessel" && (
        <>
          <rect x="70" y="250" width="260" height="36" fill={`url(#${id}-slab)`} />
          <path d="M150 90 H250 L236 250 H164Z" fill={`url(#${id}-ink)`} />
          <rect x="168" y="78" width="64" height="16" fill="#d9cfc2" />
        </>
      )}
      {kind === "fold" && (
        <>
          <path d="M90 250 L200 120 L310 250 Z" fill="#d5cfc4" />
          <path d="M200 120 L310 250 L200 230 Z" fill="#b7b1a6" />
          <path d="M120 250 H280 V290 H120Z" fill={`url(#${id}-clay)`} />
        </>
      )}
      {kind === "bar" && (
        <>
          <rect x="78" y="168" width="244" height="92" rx="46" fill={`url(#${id}-clay)`} />
          <rect x="78" y="214" width="244" height="18" fill="#efe6da" opacity="0.7" />
          <rect x="110" y="268" width="180" height="28" fill={`url(#${id}-slab)`} />
        </>
      )}
      <rect width="400" height="420" filter={`url(#${id}-grain)`} opacity="0.28" />
    </svg>
  );
}
