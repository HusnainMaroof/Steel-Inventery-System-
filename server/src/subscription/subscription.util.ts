import type { BillingCycle, SubscriptionStatus } from "@prisma/client";

export type PlanWindowInput = {
  billingCycle: BillingCycle;
  durationDays?: number | null;
};

export function subscriptionWindowForPlan(
  plan: PlanWindowInput,
  startsAt = new Date(),
): { startsAt: Date; endsAt: Date | null } {
  const starts = new Date(startsAt);
  if (plan.billingCycle === "LIFETIME") {
    return { startsAt: starts, endsAt: null };
  }
  const ends = new Date(starts);
  if (plan.billingCycle === "MONTHLY") {
    ends.setMonth(ends.getMonth() + 1);
  } else if (plan.billingCycle === "YEARLY") {
    ends.setFullYear(ends.getFullYear() + 1);
  } else if (plan.billingCycle === "CUSTOM_DAYS" && plan.durationDays) {
    ends.setDate(ends.getDate() + plan.durationDays);
  } else {
    ends.setMonth(ends.getMonth() + 1);
  }
  return { startsAt: starts, endsAt: ends };
}

export function isSubscriptionActive(input: {
  billingCycle: BillingCycle | null | undefined;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionEndsAt: Date | null;
}): boolean {
  if (!input.billingCycle) return true;
  if (
    input.subscriptionStatus === "CANCELLED" ||
    input.subscriptionStatus === "EXPIRED"
  ) {
    return false;
  }
  if (input.billingCycle === "LIFETIME") {
    return input.subscriptionStatus === "ACTIVE";
  }
  if (!input.subscriptionEndsAt) {
    return input.subscriptionStatus === "ACTIVE";
  }
  return input.subscriptionStatus === "ACTIVE" && input.subscriptionEndsAt >= new Date();
}

export function billingCycleLabel(cycle: BillingCycle | null | undefined): string {
  switch (cycle) {
    case "MONTHLY":
      return "Monthly";
    case "YEARLY":
      return "Yearly";
    case "LIFETIME":
      return "Lifetime";
    case "CUSTOM_DAYS":
      return "Custom duration";
    default:
      return "—";
  }
}
