"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CookieNotice } from "@/components/marketing/CookieNotice";
import { TijarattBrand } from "@/components/marketing/PublicChrome";
import { Panel, TextLink, btnPrimary } from "@/components/marketing/PublicKit";
import { ScrollFocusImage } from "@/components/motion/ScrollFocusImage";
import { homeFor, useAuth } from "@/lib/auth";
import { isServerUnavailableMessage, redirectToOfflinePage } from "@/lib/server-offline";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {open ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M1 1l22 22" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        </>
      )}
    </svg>
  );
}

export default function LoginPage() {
  const { user, ready, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace(homeFor(user));
  }, [ready, user, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const err = await login(email, password);
      if (err) {
        if (isServerUnavailableMessage(err)) {
          redirectToOfflinePage("/login");
          return;
        }
        setError(err);
        setPassword("");
        setShowPassword(false);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex min-h-screen flex-col px-5 py-5 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="w-fit rounded-xl focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary"
            aria-label="Tijartt home"
          >
            <TijarattBrand />
          </Link>
          <TextLink href="/">Back to home</TextLink>
        </header>

        <div className="my-auto w-full max-w-[400px] self-center py-14">
          <h1 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.035em] text-ink motion-safe:animate-rise">
            Sign in
          </h1>
          <p className="mt-2 mb-8 text-[15px] leading-[1.55] text-[#171717]/70 motion-safe:animate-rise motion-safe:[animation-delay:100ms]">
            With the login your business was given.
          </p>

          {error ? (
            <div
              role="alert"
              className="mb-5 overflow-hidden rounded-xl border border-destructive/25 bg-destructive/[.06] px-4 py-3 text-[13px] font-medium text-destructive"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div>
              <label className="!mb-2 !text-[13px] !font-medium !normal-case !tracking-normal !text-[#171717]/80" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="you@business.com"
                className="!min-h-12 !rounded-xl !border-[#E5E5E5] !px-4 !py-3 !text-[14px] !font-normal focus:!border-primary focus:!shadow-[0_0_0_3px_rgba(46,107,46,.14)]"
              />
            </div>
            <div>
              <label className="!mb-2 !text-[13px] !font-medium !normal-case !tracking-normal !text-[#171717]/80" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Your password"
                  className="!min-h-12 !rounded-xl !border-[#E5E5E5] !px-4 !py-3 !pr-12 !text-[14px] !font-normal focus:!border-primary focus:!shadow-[0_0_0_3px_rgba(46,107,46,.14)]"
                />
                <button
                  type="button"
                  id="toggle-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[#171717]/70 hover:bg-[#F1F1EF] hover:text-primary"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={pending}
              className={`${btnPrimary} mt-1 w-full disabled:cursor-wait disabled:opacity-60`}
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-[14px] text-[#171717]/70">
            No account yet? <TextLink href="/contact" className="text-[14px]">Ask the Tijartt team</TextLink>
          </p>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[13px] text-[#171717]/70">
          <span>© 2026 Tijartt</span>
          <span className="flex gap-5">
            <Link href="/privacy-policy" className="inline-flex min-h-11 items-center hover:text-[#171717]">
              Privacy
            </Link>
            <Link href="/terms-and-conditions" className="inline-flex min-h-11 items-center hover:text-[#171717]">
              Terms
            </Link>
          </span>
        </footer>
      </section>

      <aside className="hidden p-4 lg:block">
        <Panel className="flex h-full flex-col justify-center gap-12 px-10 py-10 xl:px-16">
          <ScrollFocusImage
            src="/images/feature-dashboard.png"
            alt="Three Tijartt tiles for stock, bills and sales"
            width={1774}
            height={887}
            sizes="560px"
            priority
            className="mx-auto w-full max-w-[560px] motion-safe:animate-rise"
          />
          <h2 className="text-center text-[clamp(28px,2.6vw,40px)] leading-[1.1] font-semibold tracking-[-0.035em] text-white motion-safe:animate-rise motion-safe:[animation-delay:150ms]">
            Stock. Dues. Profit.
          </h2>
        </Panel>
      </aside>
      <CookieNotice />
    </main>
  );
}
