"use client";

import { useEffect, useState } from "react";
import { EarnIcon, HaveIcon, OweIcon } from "./ConceptRow";

const concepts = [
  { id: "have", label: "Have", Icon: HaveIcon },
  { id: "owe", label: "Owe", Icon: OweIcon },
  { id: "earn", label: "Earn", Icon: EarnIcon },
] as const;

export function AnimatedBusinessConcepts() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % concepts.length);
    }, 3400);

    return () => window.clearInterval(id);
  }, []);

  const active = concepts[index];
  const label =
    "text-[68px] leading-[0.98] font-semibold tracking-[-0.045em] whitespace-nowrap text-[#111] min-[1440px]:text-[88px] max-[1024px]:text-[56px] max-[640px]:text-[40px] max-[420px]:text-[34px]";

  return (
    <span className="inline-flex shrink-0 items-center gap-4">
      <span className="sr-only">Have, Owe, and Earn</span>
      <span className="inline-flex shrink-0 overflow-hidden">
        <span
          key={active.id}
          className="grid shrink-0 place-items-center rounded-[10px] bg-[#3CB866] px-10 py-5 text-[#111] motion-safe:animate-headline-in min-[1440px]:px-12 max-[1024px]:px-8 max-[640px]:px-6"
        >
          <active.Icon />
        </span>
      </span>
      <span className="inline-grid items-center overflow-hidden">
        {concepts.map((concept) => (
          <span key={concept.id} className={`${label} invisible col-start-1 row-start-1`} aria-hidden="true">
            {concept.label}
          </span>
        ))}
        <span key={active.id} className={`${label} col-start-1 row-start-1 motion-safe:animate-headline-in`}>
          {active.label}
        </span>
      </span>
    </span>
  );
}
