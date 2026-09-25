import { AnimatedBusinessConcepts } from "@/components/marketing/landing/AnimatedBusinessConcepts";
import { DashboardPreview } from "@/components/marketing/landing/DashboardPreview";
import { FloatingVisual } from "@/components/marketing/landing/FloatingVisual";
import { TrustBadge } from "@/components/marketing/landing/TrustBadge";

const users = [
  {
    img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=96&h=96&q=80",
    bg: "bg-red-400",
  },
  {
    img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=96&h=96&q=80",
    bg: "bg-green-400",
  },
  {
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=96&h=96&q=80",
    bg: "bg-red-400",
  },
];

export function Hero() {
  return (
    <section
      className="relative z-[1]"
      id="hero"
      aria-labelledby="hero-heading"
    >
      <div className="mx-auto w-[75%] px-10">
        <h1
          className="mt-32 flex items-center justify-center gap-4 max-[640px]:mt-24 max-[640px]:flex-col"
          id="hero-heading"
        >
          <span className="m-0 shrink-0 text-[68px] leading-[0.98] font-semibold tracking-[-0.045em] whitespace-nowrap text-[#111] motion-safe:animate-rise motion-safe:delay-500 min-[1440px]:text-[88px] max-[1024px]:text-[56px] max-[640px]:w-full max-[640px]:text-center max-[640px]:text-[40px] max-[420px]:text-[34px]">
            Know what you
          </span>
          <AnimatedBusinessConcepts />
        </h1>
        <p className="mx-auto mt-16 max-w-[1080px] text-center text-[clamp(16px,1.7vw,26px)] leading-[1.35] font-semibold text-[#111] motion-safe:animate-rise motion-safe:delay-[900ms] max-[768px]:mt-12">
          <span className="block whitespace-nowrap">
            Manage purchases, inventory, sales, customer{" "}
            <span
              className="inline-flex translate-y-[0.12em] items-center align-middle "
              aria-hidden="true"
            >
              {users.map((user, index) => (
                <span
                  className={`inline-flex items-center justify-center rounded-full p-0.5 ${user.bg} ${index === 0 ? "" : "-ml-2"}`}
                  key={user.img}
                >
                  <img
                    src={user.img}
                    alt=""
                    className="size-8 rounded-full border-0 outline-0 object-cover min-[1440px]:size-10"
                  />
                </span>
              ))}
            </span>{" "}
            dues,
          </span>
          <span className="block whitespace-nowrap">
            supplier payments and profit all from one simple workspace.
          </span>
        </p>
        <TrustBadge users={users} />
        <div className="relative left-1/2 z-[1] mt-40 min-h-[280px] w-[118%] -translate-x-1/2 max-[640px]:left-0 max-[640px]:w-full max-[640px]:translate-x-0">
          <div
            className="pointer-events-none absolute top-[70px] left-[18%] z-[1] h-[180px] w-[260px] bg-[#5A8CFF] opacity-20 blur-[50px]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute top-6 right-[16%] z-[1] h-[180px] w-[260px] bg-[#3CDC82] opacity-20 blur-[50px]"
            aria-hidden="true"
          />
          <FloatingVisual position="left" type="revenue" />
          <FloatingVisual position="right" type="wallet" />
          <FloatingVisual position="right-bottom" type="profit" />
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
