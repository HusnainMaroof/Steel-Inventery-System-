import Link from "next/link";
import { TijarattBrand } from "@/components/marketing/PublicChrome";
import { Panel, btnOnPanel, btnGhostOnPanel, panelEyebrow } from "@/components/marketing/PublicKit";

export function NotFoundScreen() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-canvas px-5 py-8 sm:px-6">
      <Link
        href="/"
        className="relative z-10 w-fit rounded-xl focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary"
        aria-label="Tijartt home"
      >
        <TijarattBrand />
      </Link>

      <div className="relative z-10 m-auto w-full max-w-[640px] py-10 text-center">
        <Panel className="motion-safe:animate-rise">
          <div className="px-6 py-12 sm:px-12 sm:py-16">
            <p className={`${panelEyebrow} motion-safe:animate-rise motion-safe:[animation-delay:120ms]`}>
              Error / 404
            </p>
            <h1 className="mt-4 text-[clamp(36px,6vw,60px)] font-medium leading-[1.04] tracking-[-0.03em] text-white motion-safe:animate-rise motion-safe:[animation-delay:240ms]">
              This page is not in the records.
            </h1>
            <p className="mt-5 max-w-[480px] mx-auto text-[16px] leading-[1.63] text-white motion-safe:animate-rise motion-safe:[animation-delay:360ms]">
              The address may have changed, or you may not have access to this
              part of Tijartt.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row motion-safe:animate-rise motion-safe:[animation-delay:480ms]">
              <Link
                href="/"
                className={`${btnOnPanel} w-full sm:w-auto`}
              >
                Go home
              </Link>
              <Link
                href="/login"
                className={`${btnGhostOnPanel} w-full sm:w-auto`}
              >
                Log in
              </Link>
            </div>
          </div>
        </Panel>
      </div>

      <p className="relative z-10 text-center mt-8 text-[13px] text-[#171717]/70">
        Tijartt / business records, made clearer
      </p>
    </main>
  );
}
