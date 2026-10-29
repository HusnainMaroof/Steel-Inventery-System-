import { AnimatedBusinessConcepts } from "@/components/marketing/landing/AnimatedBusinessConcepts";
import { DashboardPreview } from "@/components/marketing/landing/DashboardPreview";
import { ScrollTilt } from "@/components/motion/ScrollTilt";
import { CtaLink, Marquee, TextLink } from "@/components/marketing/PublicKit";

const trades = ["Steel", "Cement", "Wire", "Paint", "Tiles"];

export function Hero() {
  return (
    <section className="relative z-[1] overflow-x-clip pt-16 pb-6 sm:pt-24" id="hero" aria-labelledby="hero-heading">
      <div className="mx-auto max-w-[1180px] px-4 text-center sm:px-6">
        <h1
          id="hero-heading"
          className="mx-auto text-[clamp(38px,5.4vw,72px)] leading-[1.04] font-semibold tracking-[-0.045em] text-balance text-ink motion-safe:animate-rise"
        >
          Know what you <AnimatedBusinessConcepts />
          <br />
          in one plain record.
        </h1>
        <p className="mx-auto mt-5 max-w-[52ch] text-[17px] leading-[1.55] text-[#171717]/70 motion-safe:animate-rise motion-safe:[animation-delay:150ms]">
          Tijartt is inventory, billing and khata software for traders. Keep stock, sales bills, customer dues and profit in one place.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 motion-safe:animate-rise motion-safe:[animation-delay:300ms]">
          <CtaLink href="/contact">Get started</CtaLink>
          <TextLink href="/pricing">See plans</TextLink>
        </div>
        <div className="mx-auto mt-14 max-w-[760px] motion-safe:animate-fade motion-safe:[animation-delay:450ms]">
          <Marquee label="Made for" items={trades} />
        </div>
      </div>
      <div className="mx-auto mt-14 max-w-[1180px] px-4 sm:px-6">
        <ScrollTilt>
          <DashboardPreview />
        </ScrollTilt>
      </div>
    </section>
  );
}
