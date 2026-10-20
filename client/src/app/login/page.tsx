"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TijarattBrand } from "@/components/marketing/PublicChrome";
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
    <main className="grid min-h-screen bg-[#FCFCFB] lg:grid-cols-[.82fr_1.18fr]">
      <section className="flex min-h-screen flex-col px-5 py-7 sm:px-10 sm:py-9 lg:px-[clamp(40px,6vw,88px)]">
        <Link
          href="/"
          className="w-fit rounded-xl focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary"
          aria-label="Tijartt home"
        >
          <TijarattBrand />
        </Link>
        <div className="my-auto w-full max-w-[430px] self-center py-12">
          <div className="mb-8">
            <p className="font-mono text-xs font-medium text-primary">
              SECURE SIGN IN
            </p>
            <h1 className="mt-4 text-[40px] font-semibold leading-[1.05] tracking-[-0.037em] text-ink">
              Welcome back.
            </h1>
            <p className="mt-3 text-[14px] leading-[1.6] text-[#171717]/70">
              Use the email and password provided for your business.
            </p>
          </div>

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
              <label className="!mb-2 !text-xs !tracking-[.08em] !text-[#171717]/80" htmlFor="email">
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
              <label className="!mb-2 !text-xs !tracking-[.08em] !text-[#171717]/80" htmlFor="password">
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
              className="mt-1 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-primary bg-primary px-7 text-[14px] font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
        <div className="flex items-center justify-between gap-4 text-xs text-[#171717]/70">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-medium hover:text-primary"
          >
            Back to home
          </Link>
          <span>Secure account access</span>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-primary/10 p-12 lg:flex lg:flex-col lg:justify-center">
        <div className="relative mx-auto w-full max-w-[580px]">
          <p className="font-mono text-xs font-medium tracking-[-0.03em] text-primary">
            YOUR BUSINESS / ONE CLEAR VIEW
          </p>
          <h2 className="mt-5 max-w-[520px] text-[clamp(42px,5vw,64px)] font-semibold leading-[1.03] tracking-[-0.037em] text-ink">
            Pick up exactly where the day left off.
          </h2>
          <div className="mt-10 rounded-[32px] border border-white/80 bg-white/55 p-5 shadow-[0_30px_80px_-45px_rgba(17,17,17,.18)] backdrop-blur-[15px]">
            <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-ink">Today&apos;s records</span>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">LIVE</span>
              </div>
              {[
                ["Stock received", "24 bags", "var(--color-success)"],
                ["Invoice recorded", "Rs 18,500", "var(--color-primary)"],
                ["Payment collected", "Rs 12,000", "var(--color-warning)"],
              ].map(([label, value, color]) => (
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#FCFCFB] px-3 py-3" key={label}>
                  <i className="size-1.5 rounded-full" style={{ background: color }} />
                  <span className="text-xs text-[#171717]/80">{label}</span>
                  <strong className="ml-auto font-mono text-xs font-medium text-ink">{value}</strong>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-7 text-[12px] text-[#171717]/70">
            Access is limited to your authorised business records.
          </p>
        </div>
      </aside>
    </main>
  );
}
