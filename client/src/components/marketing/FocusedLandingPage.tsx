import { LandingPage } from "@/components/marketing/landing/LandingPage";
import { PublicPageShell } from "@/components/marketing/PublicChrome";

export function FocusedLandingPage() {
  return (
    <PublicPageShell>
      <main id="main-content">
        <LandingPage />
      </main>
    </PublicPageShell>
  );
}
