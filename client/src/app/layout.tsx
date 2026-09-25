import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import { ServerStatusMonitor } from "@/components/ServerStatusMonitor";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Tijaratt | Business records, made clearer",
  description:
    "Keep stock, purchases, sales, invoices, and payments together with Tijaratt, a straightforward business management tool for shops and trading businesses.",
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
            <Shell>{children}</Shell>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
