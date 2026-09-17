import Link from "next/link";

export function NotFoundScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f8f7] px-5 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <div className="text-xl font-semibold tracking-tight">Tradex</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#171717]/70 mt-1.5">
            Business Ledger
          </div>
        </div>

        <div className="panel bg-white p-7 sm:p-9">
          <p className="text-[56px] font-bold tracking-tighter text-[#171717]/10 leading-none">404</p>
          <h1 className="text-[20px] font-semibold tracking-tight mt-2">Page not found</h1>
          <p className="text-[13px] leading-relaxed text-[#171717]/70 mt-3 mb-7">
            This page does not exist or you do not have access to it.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login" className="btn-primary w-full sm:w-auto !py-3 text-center">
              Go to login
            </Link>
            <Link href="/" className="btn-ghost w-full sm:w-auto !py-3 text-center">
              Homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
