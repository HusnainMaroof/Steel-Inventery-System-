"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BarChart3, Boxes, FileText, type LucideIcon } from "lucide-react";

const features = [
  {
    id: "stock",
    number: "01",
    label: "Stock",
    description: "See what inventory you have on hand, what it cost and what is still in stock.",
    Icon: Boxes,
  },
  {
    id: "payments",
    number: "02",
    label: "Payments",
    description: "Keep track of supplier payments, outstanding dues and what needs your attention.",
    Icon: FileText,
  },
  {
    id: "sales",
    number: "03",
    label: "Sales",
    description: "Follow every sale, what left the shelf and what the business earned.",
    Icon: BarChart3,
  },
] as const;

export function FeatureSection() {
  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const manualScroll = useRef<number | null>(null);
  const current = features[active];
  const left = features[(active + features.length - 1) % features.length];
  const right = features[(active + 1) % features.length];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const update = () => {
      if (manualScroll.current !== null && Math.abs(window.scrollY - manualScroll.current) < 48) return;
      manualScroll.current = null;

      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const traveled = Math.min(Math.max(-rect.top, 0), scrollable);
      const progress = traveled / scrollable;
      const index = Math.min(features.length - 1, Math.floor(progress * features.length));
      setActive((previous) => (previous === index ? previous : index));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function show(index: number) {
    manualScroll.current = window.scrollY;
    setActive(index);
  }

  return (
    <section ref={sectionRef} className="relative z-[1] mt-20 h-[480vh] max-[900px]:h-auto" aria-label="Stock, payments and sales">
      <div className="sticky top-16 mx-auto w-[75%] px-10 max-[900px]:static max-[900px]:w-full max-[900px]:px-4 max-[640px]:px-4">
        <div className="relative left-1/2 w-[118%] -translate-x-1/2 max-[900px]:left-0 max-[900px]:w-full max-[900px]:translate-x-0">
          <div className="relative grid h-[80vh] min-h-[560px] grid-cols-[1.1fr_0.9fr] items-center gap-8 overflow-hidden rounded-[24px] bg-[#0B0F0C] px-14 max-[1100px]:px-10 max-[900px]:h-auto max-[900px]:min-h-0 max-[900px]:grid-cols-1 max-[900px]:gap-10 max-[900px]:px-6 max-[900px]:py-10 max-[640px]:rounded-[18px] max-[640px]:px-5 max-[640px]:py-8">
            <div
              className="pointer-events-none absolute top-1/2 right-[18%] size-[420px] -translate-y-1/2 rounded-full bg-[#1FAE5C] opacity-25 blur-[110px] max-[900px]:top-auto max-[900px]:right-0 max-[900px]:bottom-24 max-[900px]:size-[260px]"
              aria-hidden="true"
            />

            <div className="relative z-[1] flex h-full flex-col justify-around max-[900px]:h-auto">
              <div className="flex flex-col gap-">
                {features.map((feature, index) => {
                  const isActive = index === active;
                  return (
                    <button
                      key={feature.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => show(index)}
                      className={`flex cursor-pointer items-baseline gap-2\ border-0 bg-transparent p-0 text-left transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isActive ? "translate-x-0.5 text-white" : "text-white/25"
                      }`}
                    >
                      <span className="text-[clamp(36px,5vw,96px)] leading-none font-medium tracking-[-0.02em]">
                        {feature.label}
                      </span>
                      <span className={`text-[13px] font-medium max-[640px]:text-[11px] ${isActive ? "text-[#3CDC82]" : "text-white/15"}`}>
                        {feature.number}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p
                key={current.id}
                className="mt-10 max-w-[34rem] text-[clamp(16px,1.6vw,28px)] leading-[1.45] text-white motion-safe:animate-rise max-[900px]:mt-8 max-[900px]:pr-16 max-[640px]:text-[16px]"
              >
                {current.description}
              </p>
            </div>

            <div className="relative z-[1] flex h-[220px] items-center justify-center max-[900px]:h-[180px] max-[640px]:h-[150px]">
             <img src="/images/Feature section.png" alt="" />
            </div>

            <button
              type="button"
              aria-label="Next"
              onClick={() => show((active + 1) % features.length)}
              className="absolute right-10 bottom-10 grid cursor-pointer place-items-center rounded-full border-0 bg-white p-4 text-[#111] transition-transform duration-200 hover:translate-x-0.5 max-[900px]:right-6 max-[900px]:bottom-6 max-[640px]:p-3"
            >
              <ArrowRight className="size-10 max-[640px]:size-7" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Tile({
  feature,
  variant,
  className,
  iconSize,
}: {
  feature: (typeof features)[number];
  variant: "flat" | "active";
  className: string;
  iconSize: number;
}) {
  const Icon: LucideIcon = feature.Icon;
  return (
    <div
      key={feature.id}
      className={`absolute grid size-[72px] place-items-center rounded-[20px] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] min-[900px]:size-[92px] max-[640px]:size-[64px] ${className}`}
      style={{
        zIndex: variant === "active" ? 2 : 0,
        background: variant === "active" ? "linear-gradient(155deg, #2C6B44 0%, #0F2417 100%)" : "linear-gradient(155deg, #2A2E2B 0%, #161816 100%)",
        boxShadow: variant === "active" ? "0 0 40px rgba(60,220,130,0.35), 0 20px 34px rgba(0,0,0,0.5)" : "0 14px 24px rgba(0,0,0,0.4)",
      }}
    >
      <Icon size={iconSize} strokeWidth={1.6} className={variant === "active" ? "text-white" : "text-white/40"} />
    </div>
  );
}
