import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Shared building blocks for the public pages. The look comes from the dark
 * landing panel (Stock / Payments / Sales): a near-black panel with a green
 * light, mint accents and mint pill buttons, and the "rise" entrance.
 * Light sections are plain type on the canvas with 1px lines: no cards, no icons.
 */

const press =
  "transition-[background-color,border-color,color,translate,scale] duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2";

/** The section green (mint, ink text): the main action on every public page, light or dark. */
const green = `group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-mint px-6 text-[15px] font-medium text-ink no-underline hover:bg-mint-hover ${press} ${focusRing}`;

/** Main action on a light surface. */
export const btnPrimary = `${green} focus-visible:outline-ink`;

/** Quiet action on a light surface. */
export const btnSecondary = `group inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-white px-6 text-[15px] font-medium text-[#171717] no-underline hover:border-[#171717] ${press} ${focusRing} focus-visible:outline-[#171717]`;

/** Main action on the dark panel. */
export const btnOnPanel = `${green} focus-visible:outline-mint`;

/** Second action on the dark panel. */
export const btnGhostOnPanel = `group inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/30 px-6 text-[15px] font-medium text-white no-underline hover:border-white ${press} ${focusRing} focus-visible:outline-white`;

/** Put on an arrow inside a `group` element so it nudges on hover. */
export const arrowNudge =
  "transition-transform duration-200 ease-out group-hover:translate-x-[3px] motion-reduce:transition-none motion-reduce:group-hover:translate-x-0";

export const eyebrow = "text-[14px] font-medium text-[#171717]/70";

export const panelEyebrow = "text-[14px] font-medium text-mint";

/** Fades and rises an element as it scrolls into view (see `.reveal` in globals.css). */
export const reveal = "reveal";

/** The one arrow used on public pages: a small ink disc inside the main pill. */
function ArrowDisc() {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-mint transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 group-hover:-rotate-45 motion-reduce:transition-none motion-reduce:group-hover:transform-none"
    >
      <svg viewBox="0 0 16 16" className="size-4" fill="none">
        <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** The main call to action: a mint pill with the arrow disc. Internal links only. */
export function CtaLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`${green} focus-visible:outline-ink py-1.5 pr-1.5 pl-6 ${className}`}>
      <span>{children}</span>
      <ArrowDisc />
    </Link>
  );
}

/** A quiet text link with a sliding underline. */
export function TextLink({
  href,
  children,
  onPanel = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  onPanel?: boolean;
  className?: string;
}) {
  const tone = onPanel ? "text-white after:bg-white" : "text-[#171717] after:bg-[#171717]";
  const cls = `relative inline-flex min-h-11 items-center text-[15px] font-medium no-underline after:absolute after:inset-x-0 after:bottom-2.5 after:h-px after:origin-right after:scale-x-0 after:transition-transform after:duration-300 hover:after:origin-left hover:after:scale-x-100 motion-reduce:after:transition-none ${focusRing} ${tone} ${className}`;
  return href.startsWith("/") ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {children}
    </a>
  );
}

/** Page width wrapper used by every public section. */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1180px] px-4 sm:px-6 lg:px-10 ${className}`}>{children}</div>;
}

/** The dark landing panel with its green light. */
export function Panel({
  children,
  className = "",
  glow = true,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={`relative isolate overflow-hidden rounded-[24px] bg-panel text-white max-[640px]:rounded-[18px] ${className}`}>
      {glow ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-[12%] -z-10 size-[420px] -translate-y-1/2 rounded-full bg-glow opacity-25 blur-[110px] max-[900px]:top-auto max-[900px]:right-0 max-[900px]:bottom-0 max-[900px]:size-[260px] max-[900px]:translate-y-0"
        />
      ) : null}
      {children}
    </div>
  );
}

/** Top of an inner public page: the dark panel with a title, one short line, actions and an optional visual. */
export function PanelHero({
  eyebrow: label,
  title,
  intro,
  actions,
  aside,
}: {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="pt-4 sm:pt-6">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
        <Panel
          className={`grid items-center gap-10 px-6 py-12 sm:px-10 sm:py-14 lg:px-14 lg:py-16 ${aside ? "lg:grid-cols-[1.1fr_0.9fr]" : ""}`}
        >
          <div className="max-w-[680px]">
            <p className={`${panelEyebrow} motion-safe:animate-rise`}>{label}</p>
            <h1 className="mt-4 text-balance text-[clamp(32px,4.4vw,56px)] leading-[1.04] font-medium tracking-[-0.03em] text-white motion-safe:animate-rise motion-safe:[animation-delay:120ms]">
              {title}
            </h1>
            {intro ? (
              <p className="mt-4 max-w-[34rem] text-[16px] leading-[1.55] text-white motion-safe:animate-rise motion-safe:[animation-delay:240ms]">
                {intro}
              </p>
            ) : null}
            {actions ? (
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 motion-safe:animate-rise motion-safe:[animation-delay:360ms]">
                {actions}
              </div>
            ) : null}
          </div>
          {aside ? <div className="relative">{aside}</div> : null}
        </Panel>
      </div>
    </section>
  );
}

/** Small heading for a light section. No subtext: the content under it does the talking. */
export function SectionHeader({
  id,
  label,
  title,
  center = false,
}: {
  id?: string;
  label?: string;
  title: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`${reveal} ${center ? "mx-auto text-center" : ""} max-w-[640px]`}>
      {label ? <p className={eyebrow}>{label}</p> : null}
      <h2
        id={id}
        className={`${label ? "mt-2" : ""} text-[17px] leading-[1.3] font-semibold tracking-[-0.01em] text-[#171717]`}
      >
        {title}
      </h2>
    </div>
  );
}

export type Row = {
  title: string;
  text?: string;
  /** Optional link for the whole row, with its label shown on the right. */
  href?: string;
  action?: string;
};

/**
 * A list of plain rows split by 1px lines. Used instead of cards. On hover a
 * mint bar draws in at the left and the title slides over.
 */
export function RowList({ rows, numbered = false }: { rows: Row[]; numbered?: boolean }) {
  return (
    <ul className="border-t border-line">
      {rows.map((row, index) => {
        const inner = (
          <>
            <span
              aria-hidden="true"
              className="absolute top-0 bottom-0 left-0 w-0.5 origin-top scale-y-0 bg-mint transition-transform duration-300 ease-out group-hover:scale-y-100 motion-reduce:transition-none"
            />
            <span className="flex items-baseline gap-4 transition-transform duration-300 ease-out group-hover:translate-x-3 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
              {numbered ? (
                <span className="w-7 shrink-0 text-[13px] tabular-nums text-[#171717]/70">{String(index + 1).padStart(2, "0")}</span>
              ) : null}
              <span className="text-[clamp(22px,2.4vw,32px)] leading-[1.15] font-semibold tracking-[-0.03em] text-[#171717]">{row.title}</span>
            </span>
            {row.text ? <span className="text-[15px] leading-[1.5] text-[#171717]/70 sm:text-right">{row.text}</span> : null}
            {row.href ? (
              <span className="text-[14px] font-medium text-[#171717] underline decoration-[#171717]/30 underline-offset-4 transition-colors group-hover:decoration-[#171717] sm:justify-self-end">
                {row.action ?? "Open"}
              </span>
            ) : null}
          </>
        );
        const cls = `${reveal} group relative grid gap-1 border-b border-line py-6 pl-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-baseline sm:gap-8 sm:py-7`;
        return (
          <li key={row.title}>
            {row.href ? (
              <a href={row.href} className={`${cls} no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]`}>
                {inner}
              </a>
            ) : (
              <div className={cls}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A real sequence: numbered steps joined by a line that draws in as it scrolls into view. */
export function Steps({ steps }: { steps: { title: string; text: string }[] }) {
  return (
    <ol className="relative grid gap-8 sm:grid-cols-3 sm:gap-6">
      <span aria-hidden="true" className="steps-line absolute top-[7px] right-0 left-0 hidden h-px bg-[#171717]/15 sm:block" />
      {steps.map((step, index) => (
        <li key={step.title} className={`${reveal} relative`}>
          <span aria-hidden="true" className="relative z-[1] block size-[15px] rounded-full border-[3px] border-canvas bg-mint ring-1 ring-[#171717]/20" />
          <p className="mt-5 text-[13px] tabular-nums text-[#171717]/70">Step {index + 1}</p>
          <h3 className="mt-1.5 text-[22px] leading-[1.2] font-semibold tracking-[-0.025em] text-[#171717]">{step.title}</h3>
          <p className="mt-1.5 max-w-[32ch] text-[15px] leading-[1.6] text-[#171717]/70">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

/** A slow, endless strip of words. Pauses on hover; stands still under reduced motion. */
export function Marquee({ items, label }: { items: string[]; label: string }) {
  const run = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-10 pr-10">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-10 text-[clamp(20px,2.2vw,28px)] font-medium tracking-[-0.02em] whitespace-nowrap text-[#171717]/35 transition-colors duration-300 hover:text-[#171717]">
          {item}
          <span aria-hidden="true" className="size-1 rounded-full bg-[#171717]/30" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="group flex items-center gap-6">
      <p className="hidden shrink-0 text-[13px] font-medium text-[#171717] sm:block">{label}</p>
      <div className="relative flex min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
        <div className="flex motion-safe:animate-marquee group-hover:[animation-play-state:paused]">
          {run(false)}
          {run(true)}
          {run(true)}
        </div>
      </div>
    </div>
  );
}

/** Closing call to action: a dark panel band. */
export function PanelCta({ title, actions }: { title: ReactNode; actions: ReactNode }) {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
        <Panel className={`${reveal} px-6 py-12 sm:px-10 sm:py-16 lg:px-14`}>
          <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="max-w-[620px] text-balance text-[clamp(28px,3.4vw,44px)] leading-[1.06] font-medium tracking-[-0.03em] text-white">
              {title}
            </h2>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">{actions}</div>
          </div>
        </Panel>
      </div>
    </section>
  );
}
