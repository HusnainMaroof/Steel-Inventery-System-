"use client";

import { DayPicker, type DayPickerProps } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProps = DayPickerProps;

/**
 * shadcn/ui Calendar built on react-day-picker, styled with the app's
 * neutral palette (white surface, thin `--line` borders, dark selection).
 * Spread `mode`, `selected`, `onSelect`, `numberOfMonths`, `defaultMonth`
 * etc. straight through — see https://daypicker.dev for the full API.
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 select-none", className)}
      classNames={{
        months: "relative flex flex-col sm:flex-row gap-4 sm:gap-6",
        month: "flex flex-col",
        nav: "absolute inset-x-0 -top-0.5 flex items-center justify-between",
        button_previous:
          "inline-flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors",
        button_next:
          "inline-flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-sm font-semibold text-neutral-900",
        month_grid: "mt-2",
        weekdays: "flex",
        weekday:
          "flex-1 w-9 text-[10px] font-semibold uppercase tracking-wider text-neutral-400",
        week: "flex w-full mt-0.5",
        day: "relative flex-1 p-0 text-center text-sm",
        day_button:
          "h-9 w-full rounded-md font-medium text-neutral-900 transition-colors hover:bg-neutral-100",
        /* rdp v10 puts modifier data-attributes on the day CELL, so modifier
           styles target the button inside it */
        today: "[&>button]:font-bold [&>button]:underline [&>button]:underline-offset-2",
        outside: "[&>button]:text-neutral-300",
        disabled: "[&>button]:text-neutral-300 [&>button]:pointer-events-none",
        selected:
          "[&>button]:bg-[#171717] [&>button]:text-white [&>button]:font-semibold [&>button]:hover:bg-black [&>button]:shadow-sm",
        range_start: "[&>button]:rounded-r-none",
        range_end: "[&>button]:rounded-l-none",
        range_middle:
          "[&>button]:bg-neutral-100 [&>button]:rounded-none [&>button]:text-neutral-900 [&>button]:hover:bg-neutral-200",
        footer: "px-3 pt-1 pb-2 text-xs text-neutral-400",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
      }}
      {...props}
    />
  );
}
