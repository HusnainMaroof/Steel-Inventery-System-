"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { homeFor, useAuth } from "@/lib/auth";

const ease = [0.22, 1, 0.36, 1] as const;

function EyeIcon({ open }: { open: boolean }) {
  return (
    <motion.svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={false}
      animate={{ scale: open ? 1 : 0.92, opacity: 1 }}
      transition={{ duration: 0.2, ease }}
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
    </motion.svg>
  );
}

export default function LoginPage() {
  const { user, login, owners } = useAuth();
  const router = useRouter();
  const demoOwner = owners[0];

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace(homeFor(user));
  }, [user, router]);

  const fillDemo = () => {
    if (!demoOwner) return;
    setUsername(demoOwner.username);
    setPassword(demoOwner.password);
    setError(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(username, password)) {
      setError("Incorrect username or password. Try again.");
      setPassword("");
      setShowPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f8f7] px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease }}
        className="w-full max-w-sm"
      >
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease }}
        >
          <div className="text-xl font-semibold tracking-tight">Tradex</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mt-1.5">
            Business Ledger
          </div>
        </motion.div>

        <motion.div
          className="panel bg-white p-7 sm:p-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease }}
        >
          <h1 className="text-[17px] font-semibold tracking-tight">Sign in</h1>
          <p className="text-xs text-neutral-500 mt-1.5 mb-7">
            Sign in to your business ledger
          </p>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="login-error"
                role="alert"
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.25, ease }}
                className="text-[13px] font-medium text-[#a12b1f] bg-[#faf5f2] border border-[#f0e2de] rounded-md px-3.5 py-2.5 mb-5 overflow-hidden"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                placeholder="your username"
                className="!py-2.5"
              />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="your password"
                  className="!py-2.5 !pr-11"
                />
                <button
                  type="button"
                  id="toggle-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            <motion.button
              type="submit"
              className="btn-primary w-full !py-3 !text-[14px] mt-1"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              Sign in
            </motion.button>
          </form>
        </motion.div>

        {demoOwner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.25, ease }}
            className="mt-6"
          >
            <button
              type="button"
              onClick={fillDemo}
              className="w-full text-center text-xs text-neutral-400 hover:text-neutral-600 transition-colors group"
            >
              <span className="block text-[10px] uppercase tracking-widest text-neutral-400 mb-1.5 group-hover:text-neutral-500">
                Business owner demo
              </span>
              <span className="text-neutral-600 font-medium">{demoOwner.businessName}</span>
              <span className="block mt-1 tabular-nums">
                <span className="text-neutral-500">{demoOwner.username}</span>
                <span className="mx-1.5 text-neutral-300">/</span>
                <span className="text-neutral-500">{demoOwner.password}</span>
              </span>
              <span className="block mt-1.5 text-[10px] text-neutral-400 group-hover:text-neutral-500">
                Tap to fill credentials
              </span>
            </button>
          </motion.div>
        )}

        <motion.div
          className="text-center mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <Link
            href="/"
            className="text-xs font-medium text-neutral-500 hover:text-black transition-colors"
          >
            &larr; Back to homepage
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
