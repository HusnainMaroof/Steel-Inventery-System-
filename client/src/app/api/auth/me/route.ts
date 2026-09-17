import { NextResponse } from "next/server";
import { toPublicUser, tradexFetch, type TradexRole } from "@/lib/server/tradex";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await tradexFetch<{
    id: string;
    email: string;
    name: string;
    role: TradexRole;
    businessId: string;
    business?: { name: string } | null;
    title?: string | null;
    access?: string[];
  }>("/api/v1/auth/me");

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: result.status === 401 ? 401 : result.status },
    );
  }

  return NextResponse.json(toPublicUser(result.data));
}
