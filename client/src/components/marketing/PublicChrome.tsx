import Link from "next/link";
import type { ReactNode } from "react";
import { Navbar } from "@/components/marketing/landing/Navbar";

export function TijarattBrand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="grid size-8 grid-cols-2 gap-[3px]" aria-hidden="true">
        <span className={`rounded-[2px] ${inverse ? "bg-white" : "bg-[#171717]"}`} />
        <span className={`rounded-[2px] ${inverse ? "bg-white/45" : "bg-[#171717]/30"}`} />
        <span className={`rounded-[2px] ${inverse ? "bg-white/45" : "bg-[#171717]/30"}`} />
        <span className={`rounded-[2px] ${inverse ? "bg-white" : "bg-[#171717]"}`} />
      </span>
      <span
        className={`text-[18px] font-semibold tracking-[-0.035em] ${
          inverse ? "text-white" : "text-[#171717]"
        }`}
      >
        tijaratt
      </span>
    </span>
  );
}

export function PublicHeader() {
  return <Navbar />;
}

export function PublicFooter() {
  return (
    <footer id="site-footer" className="border-t border-[#E5E5E5] bg-white px-5 py-12 sm:px-8">
      <div className="mx-auto grid max-w-[1180px] gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <TijarattBrand />
          <p className="mt-4 max-w-[280px] text-[13px] leading-[1.6] text-[#171717]/70">
            The simple record for a business that buys, sells, and manages stock.
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#171717]/70">Product</p>
          <div className="mt-3 flex flex-col gap-2 text-[13px]">
            <Link href="/#product">Product</Link>
            <Link href="/#product">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/#site-footer">Resources</Link>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#171717]/70">Company</p>
          <div className="mt-3 flex flex-col gap-2 text-[13px]">
            <Link href="/#product">About</Link>
            <a href="mailto:contact@tijartt.com">Contact</a>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#171717]/70">Legal</p>
          <div className="mt-3 flex flex-col gap-2 text-[13px]">
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/terms-and-conditions">Terms</Link>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-[1180px] border-t border-[#E5E5E5] pt-5 text-[12px] text-[#171717]/70">
        © 2026 Tijaratt. All rights reserved.
      </p>
    </footer>
  );
}

export function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F8F7] font-sans text-[#171717] [font-feature-settings:'kern','ss01','cv02','cv03','cv04']">
      <a
        className="fixed left-3 top-3 z-[100] min-h-11 -translate-y-[160%] rounded-[6px] bg-[#111111] px-4 py-3 text-white focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-white"
        href="#main-content"
      >
        Skip to content
      </a>
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
