import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

export function subscriptionWindow(
  plan: SubscriptionPlan,
  startsAt = new Date(),
): { startsAt: Date; endsAt: Date | null } {
  const starts = new Date(startsAt);
  if (plan === "LIFETIME") {
    return { startsAt: starts, endsAt: null };
  }
  const ends = new Date(starts);
  if (plan === "MONTHLY") {
    ends.setMonth(ends.getMonth() + 1);
  } else {
    ends.setFullYear(ends.getFullYear() + 1);
  }
  return { startsAt: starts, endsAt: ends };
}

export function isSubscriptionActive(input: {
  subscriptionPlan: SubscriptionPlan | null;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionEndsAt: Date | null;
}): boolean {
  if (!input.subscriptionPlan) return true;
  if (
    input.subscriptionStatus === "CANCELLED" ||
    input.subscriptionStatus === "EXPIRED"
  ) {
    return false;
  }
  if (input.subscriptionPlan === "LIFETIME") {
    return input.subscriptionStatus === "ACTIVE";
  }
  if (!input.subscriptionEndsAt) {
    return input.subscriptionStatus === "ACTIVE";
  }
  return input.subscriptionStatus === "ACTIVE" && input.subscriptionEndsAt >= new Date();
}

export function planLabel(plan: SubscriptionPlan | null): string {
  switch (plan) {
    case "MONTHLY":
      return "Monthly";
    case "YEARLY":
      return "Yearly";
    case "LIFETIME":
      return "Lifetime";
    default:
      return "—";
  }
}
