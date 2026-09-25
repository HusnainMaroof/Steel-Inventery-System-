import { Hero } from "@/components/marketing/landing/Hero";
import { FeatureSection } from "./FeatureSection";

export function LandingPage() {
  return (
    <div className="relative overflow-clip bg-[#F8F8F7] px-0 pb-[88px] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#171717] [font-feature-settings:'cv11','ss01'] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[radial-gradient(rgba(23,23,23,0.55)_0.55px,transparent_0.55px)] before:bg-[length:14px_14px] before:opacity-[0.32] before:[mask-image:linear-gradient(#000_0%,#000_36%,transparent_70%)]">
      <Hero />
      <FeatureSection />
    </div>
  );
}
