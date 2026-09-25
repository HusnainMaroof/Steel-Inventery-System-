function RevenueIcon() {
  return (
    <svg viewBox="0 0 32 32" className="size-9 max-[768px]:size-7" fill="none" aria-hidden="true">
      <path d="M6 22.5 12.2 15l4.2 3.4L25 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 8.5H25V14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 32 32" className="size-9 max-[768px]:size-7" fill="none" aria-hidden="true">
      <rect x="6" y="9" width="20" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 13.5h20" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="21.5" cy="18.2" r="1.3" fill="currentColor" />
    </svg>
  );
}

function ProfitIcon() {
  return (
    <svg viewBox="0 0 32 32" className="size-9 max-[768px]:size-7" fill="none" aria-hidden="true">
      <path d="M16 6.5a9.5 9.5 0 1 1-8.2 4.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 16 16 6.5 22.2 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const visuals = {
  revenue: RevenueIcon,
  wallet: WalletIcon,
  profit: ProfitIcon,
} as const;

const shells = {
  left: "pointer-events-none absolute top-[46px] left-[18px] z-[2] size-[122px] min-[1440px]:size-[136px] max-[768px]:hidden",
  right:
    "pointer-events-none absolute top-0 right-7 z-[2] size-[122px] min-[1440px]:size-[136px] max-[768px]:top-2 max-[768px]:right-2 max-[768px]:size-[88px]",
  "right-bottom":
    "pointer-events-none absolute top-[196px] right-2 z-[2] size-[122px] min-[1440px]:size-[136px] max-[768px]:top-[132px] max-[768px]:right-1 max-[768px]:size-[88px]",
} as const;

const cards = {
  left: "rotate-[-8deg] bg-[rgba(90,140,255,0.2)] text-[#3156C9] motion-safe:animate-float-left",
  right: "rotate-[8deg] bg-[rgba(60,220,130,0.2)] text-[#1C8F52] motion-safe:animate-float-right",
  "right-bottom":
    "rotate-[-10deg] bg-[rgba(150,100,255,0.18)] text-[#6D46D6] motion-safe:animate-float-profit",
} as const;

export function FloatingVisual({
  position,
  type,
}: {
  position: "left" | "right" | "right-bottom";
  type: "revenue" | "wallet" | "profit";
}) {
  const Icon = visuals[type];
  const popDelay =
    position === "left"
      ? "motion-safe:delay-[1300ms]"
      : position === "right"
        ? "motion-safe:delay-[1420ms]"
        : "motion-safe:delay-[1560ms]";

  return (
    <div className={shells[position]} aria-hidden="true">
      <div className={`size-full motion-safe:animate-pop ${popDelay}`}>
        <div className={`grid size-full place-items-center rounded-[30px] shadow-[0_16px_36px_rgba(23,23,23,0.06)] backdrop-blur-[6px] ${cards[position]}`}>
          <Icon />
        </div>
      </div>
    </div>
  );
}
