import { NextResponse } from "next/server";
import { tijarattFetch } from "@/lib/server/tijaratt";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await tijarattFetch<{ registrationOpen: boolean }>(
    "/api/v1/auth/status",
  );
  if (!result.ok) {
    return NextResponse.json(
      { registrationOpen: false, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
