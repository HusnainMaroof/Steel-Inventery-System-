"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Mask positions that light up the left, centre and right tile of the image. */
const FOCUS_POSITIONS = ["0% 50%", "50% 50%", "100% 50%"] as const;

type Props = {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  priority?: boolean;
  /** Index of the tile to light up (0 left, 1 centre, 2 right). Omit to show the whole image. */
  focus?: number | null;
  className?: string;
};

/**
 * An image that rises, flattens and grows while it scrolls into view, with a
 * green light behind it. With `focus`, one part of the image stays lit and
 * the rest dims. Reduced motion: the image is shown in its final state.
 */
export function ScrollFocusImage({
  src,
  alt,
  width,
  height,
  sizes = "(max-width: 900px) 90vw, 560px",
  priority = false,
  focus = null,
  className = "",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const scrollTrigger = { trigger: root, start: "top bottom", end: "center 62%", scrub: 0.6 };
      gsap.fromTo(
        root.querySelector("[data-shot]"),
        { scale: 0.78, yPercent: 14, rotationX: 22, transformPerspective: 1200, transformOrigin: "50% 100%" },
        { scale: 1, yPercent: 0, rotationX: 0, ease: "none", scrollTrigger },
      );
      gsap.fromTo(
        root.querySelector("[data-glow]"),
        { autoAlpha: 0, scale: 0.6 },
        { autoAlpha: 1, scale: 1, ease: "none", scrollTrigger },
      );
    });
    return () => mm.revert();
  }, []);

  const lit = focus === null ? null : FOCUS_POSITIONS[focus % FOCUS_POSITIONS.length];

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div
        data-glow
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[18%] inset-y-[12%] rounded-full bg-glow opacity-40 blur-[70px]"
      />
      <div data-shot className="relative">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          priority={priority}
          className={`h-auto w-full transition-opacity duration-700 motion-reduce:transition-none ${lit ? "opacity-30 grayscale-[70%]" : ""}`}
        />
        {lit ? (
          <Image
            src={src}
            alt=""
            aria-hidden="true"
            width={width}
            height={height}
            sizes={sizes}
            className="absolute inset-0 h-auto w-full transition-[mask-position,-webkit-mask-position] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              maskImage: "radial-gradient(closest-side, #000 72%, transparent)",
              WebkitMaskImage: "radial-gradient(closest-side, #000 72%, transparent)",
              maskSize: "46% 120%",
              WebkitMaskSize: "46% 120%",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: lit,
              WebkitMaskPosition: lit,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
