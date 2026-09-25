import { Bell, Search, Settings } from "lucide-react";

export function DashboardHeader() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-10 max-w-[280px] flex-1 items-center gap-2 rounded-[6px] bg-[#F7F7F7] px-3 text-[14px] text-[rgba(23,23,23,0.45)]">
        <Search className="size-4" strokeWidth={1.75} />
        Search
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="grid size-10 place-items-center rounded-[6px] border border-[#E5E5E5] bg-white text-[#171717]">
          <Bell className="size-4" strokeWidth={1.75} />
        </span>
        <span className="grid size-10 place-items-center rounded-[6px] border border-[#E5E5E5] bg-white text-[#171717]">
          <Settings className="size-4" strokeWidth={1.75} />
        </span>
        <span className="grid size-10 place-items-center rounded-full bg-[#111] text-[13px] font-semibold text-white">AK</span>
      </div>
    </div>
  );
}
