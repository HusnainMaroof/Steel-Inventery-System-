import Link from "next/link";
import { TijarattBrand } from "@/components/marketing/PublicChrome";

export function NotFoundScreen() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#f0f4fe] px-5 py-8 sm:px-6">
      <Link
        href="/"
        className="relative z-10 w-fit rounded-xl focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#0099ff]"
        aria-label="Tijaratt home"
      >
        <TijarattBrand />
      </Link>

      <div className="relative z-10 m-auto w-full max-w-[620px] py-12 text-center">
        <p className="font-mono text-[12px] font-medium tracking-[-0.03em] text-[#145aff]">
          ERROR / 404
        </p>
        <h1 className="mt-4 text-[clamp(46px,8vw,72px)] font-semibold leading-[1.02] tracking-[-0.037em] text-[#020520]">
          This page is not in the records.
        </h1>
        <p className="mx-auto mt-5 max-w-[480px] text-[16px] leading-[1.63] text-[#374151]">
          The address may have changed, or you may not have access to this
          part of Tijaratt.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#145aff] bg-[#fcfcfc] px-7 text-[14px] font-medium text-[#145aff] transition-colors hover:bg-[#145aff] hover:text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#0099ff]"
          >
            Go home
        </Link>
          <Link
            href="/login"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#e2e8f0] bg-white/70 px-7 text-[14px] font-medium text-[#020520] transition-colors hover:border-[#145aff] hover:text-[#145aff] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#0099ff]"
          >
            Log in
          </Link>
        </div>
      </div>

      <p className="relative z-10 text-center font-mono text-[10px] text-[#6b7280]">
        TIJARATT / BUSINESS RECORDS, MADE CLEARER
      </p>
    </main>
  );
}
