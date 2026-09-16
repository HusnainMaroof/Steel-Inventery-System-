import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Tradex — Business Ledger",
  description:
    "Tradex keeps stock, sales, invoices, payments and profit in one ledger for shops, depots and factories. Each business owner runs their own books behind their own login.",
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
            <Shell>{children}</Shell>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
