import type { Metadata } from "next";
import type { ReactNode } from "react";
import StoreGate from "@/components/StoreGate";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function BusinessLayout({ children }: { children: ReactNode }) {
  return <StoreGate>{children}</StoreGate>;
}
