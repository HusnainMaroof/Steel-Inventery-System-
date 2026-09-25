import { Boxes, Receipt, TrendingUp } from "lucide-react";

const iconClass = "size-12 min-[1440px]:size-14 max-[1024px]:size-10 max-[640px]:size-8";

export function HaveIcon() {
  return <Boxes className={iconClass} strokeWidth={1.75} aria-hidden="true" />;
}

export function OweIcon() {
  return <Receipt className={iconClass} strokeWidth={1.75} aria-hidden="true" />;
}

export function EarnIcon() {
  return <TrendingUp className={iconClass} strokeWidth={1.75} aria-hidden="true" />;
}
