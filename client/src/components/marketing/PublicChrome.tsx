import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CookieNotice } from "@/components/marketing/CookieNotice";
import { Navbar } from "@/components/marketing/landing/Navbar";
import { CONTACT_EMAIL } from "@/lib/site";

export function TijarattBrand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Image
      src="/images/tijartt-logo.png"
      alt="Tijartt"
      width={800}
      height={328}
      sizes="80px"
      className={`h-8 w-auto ${inverse ? "invert" : ""}`}
    />
  );
}

export function PublicHeader() {
  return <Navbar />;
}

const footerColumns = [
  {
    title: "Product",
    links: [
      { href: "/#product", label: "Product" },
      { href: "/#modules", label: "Modules" },
      { href: "/pricing", label: "Pricing" },
      { href: "/login", label: "Log in" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy-policy", label: "Privacy policy" },
      { href: "/terms-and-conditions", label: "Terms and conditions" },
    ],
  },
] as const;

export function PublicFooter() {
  return (
    <footer id="site-footer" className="border-t border-line bg-white px-4 py-12 sm:px-8">
      <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <TijarattBrand />
          <p className="mt-4 max-w-[280px] text-[13px] leading-[1.6] text-[#171717]/70">
            The simple record for a business that buys, sells, and manages stock.
          </p>
          <a
            className="mt-4 inline-block text-sm font-medium text-[#171717] underline decoration-[#171717]/30 underline-offset-4 transition-colors hover:decoration-[#171717]"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
        </div>
        {footerColumns.map((column) => (
          <div key={column.title}>
            <p className="text-[14px] font-medium text-[#171717]/70">{column.title}</p>
            <div className="mt-3 flex flex-col items-start gap-1">
              {column.links.map((link) => (
                <Link
                  className="inline-flex min-h-8 items-center text-sm text-[#171717] no-underline transition-[color,translate] duration-200 hover:translate-x-0.5 hover:text-primary motion-reduce:transition-none motion-reduce:hover:translate-x-0"
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-10 max-w-[1180px] border-t border-line pt-5 text-[12px] text-[#171717]/70">
        © 2026 Tijartt. All rights reserved.
      </p>
    </footer>
  );
}

export function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas font-sans text-[#171717] [font-feature-settings:'kern','ss01','cv02','cv03','cv04']">
      <a
        className="fixed left-3 top-3 z-[100] min-h-11 -translate-y-[160%] rounded-full bg-ink px-4 py-3 text-white focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-white"
        href="#main-content"
      >
        Skip to content
      </a>
      <PublicHeader />
      {children}
      <PublicFooter />
      <CookieNotice />
    </div>
  );
}
