import { Hero } from "@/components/marketing/landing/Hero";
import { FeatureSection } from "./FeatureSection";
import { FeatureHighlights } from "./FeatureHighlights";
import { CtaLink, PanelCta, TextLink } from "@/components/marketing/PublicKit";

export function LandingPage() {
  return (
    <div className="relative bg-canvas font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#171717] [font-feature-settings:'cv11','ss01']">
      <Hero />
      <FeatureSection />
      <FeatureHighlights />
      <PanelCta
        title="One clear record."
        actions={
          <>
            <CtaLink href="/contact">Get started</CtaLink>
            <TextLink href="/pricing" onPanel>
              See plans
            </TextLink>
          </>
        }
      />
    </div>
  );
}
