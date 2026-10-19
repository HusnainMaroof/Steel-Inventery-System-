import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import { ServerStatusMonitor } from "@/components/ServerStatusMonitor";
import Shell from "@/components/Shell";
import { InputGuards } from "@/components/InputGuards";

export const metadata: Metadata = {
  title: "Tijaratt | Know what you have, owe, and earn",
  description:
    "Tijaratt helps stock-based businesses see what they have, what they owe, and what they earn — stock, purchases, sales, payments, and profit in one record.",
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
