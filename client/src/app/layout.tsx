import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import { ServerStatusMonitor } from "@/components/ServerStatusMonitor";
import Shell from "@/components/Shell";
import { InputGuards } from "@/components/InputGuards";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Tijartt | Stock, Sales and Dues Ledger for Traders",
    template: "%s | Tijartt",
  },
  description:
    "Track stock, purchases, sales, customer dues, supplier payments and profit in one simple ledger. Made for steel, cement, wire, paint and tiles traders.",
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <StoreProvider>
            <ServerStatusMonitor />
            <InputGuards />
            <Shell>{children}</Shell>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
