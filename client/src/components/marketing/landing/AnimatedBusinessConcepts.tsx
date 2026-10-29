"use client";

import { useEffect, useState } from "react";

const words = ["have", "owe", "earn"] as const;

/** The rolling word in the hero headline: have, owe, earn, each dropping into a mint block. */
export function AnimatedBusinessConcepts() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    const id = window.setInterval(() => setIndex((prev) => (prev + 1) % words.length), 2600);
    return () => window.clearInterval(id);
  }, []);

  const word = words[index];

  return (
    <span className="relative inline-grid overflow-hidden rounded-[0.18em] bg-mint px-[0.22em] pb-[0.06em] align-baseline text-ink">
      <span className="sr-only">have, owe and earn</span>
      {words.map((item) => (
        <span key={item} aria-hidden="true" data-word={item} className="invisible [grid-area:1/1] before:content-[attr(data-word)]" />
      ))}
      <span key={word} aria-hidden="true" data-word={word} className="[grid-area:1/1] text-center motion-safe:animate-headline-in before:content-[attr(data-word)]" />
    </span>
  );
}
