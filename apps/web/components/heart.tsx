"use client";

import { useEffect, useState } from "react";
import { IconHeart } from "./icons";

export function HeartButton({ slug }: { slug: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem("lyra.saved");
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    setSaved(list.includes(slug));
  }, [slug]);

  function toggle() {
    const raw = window.localStorage.getItem("lyra.saved");
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    const next = list.includes(slug) ? list.filter((item) => item !== slug) : [...list, slug];
    window.localStorage.setItem("lyra.saved", JSON.stringify(next));
    setSaved(next.includes(slug));
  }

  return (
    <button className="heart" type="button" aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save"} onClick={toggle}>
      <IconHeart filled={saved} />
    </button>
  );
}
