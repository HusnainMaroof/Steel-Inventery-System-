import type { ReactNode } from "react";
import StoreGate from "@/components/StoreGate";

export default function BusinessLayout({ children }: { children: ReactNode }) {
  return <StoreGate>{children}</StoreGate>;
}
