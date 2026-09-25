import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Receipt,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

const items = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Purchases", icon: ShoppingBag, active: false },
  { label: "Sales", icon: Receipt, active: false },
  { label: "Inventory", icon: Boxes, active: false },
  { label: "Customers", icon: Users, active: false },
  { label: "Suppliers", icon: Truck, active: false },
  { label: "Payments", icon: Wallet, active: false },
  { label: "Reports", icon: BarChart3, active: false },
  { label: "Settings", icon: Settings, active: false },
] as const;

export function DashboardSidebar() {
  return (
    <aside className="flex h-full flex-col border-r border-[#E5E5E5] bg-white px-3 py-5 max-[640px]:hidden" aria-hidden="true">
      <p className="mx-2 mb-4 text-[16px] font-bold tracking-[-0.03em] text-[#111]">Tijaratt</p>
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        {items.map((item) => (
          <div
            className={`flex h-10 items-center gap-2.5 rounded-[6px] px-2.5 text-[14px] font-medium text-[rgba(23,23,23,0.72)] max-[1024px]:text-[13px] ${
              item.active ? "bg-[rgba(69,212,125,0.16)] font-semibold text-[#111]" : ""
            }`}
            key={item.label}
          >
            <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
