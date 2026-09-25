import { NextResponse } from "next/server";
import { getTijarattApiBase } from "@/lib/server/tijaratt-api-base";

export async function GET() {
  try {
    const res = await fetch(`${getTijarattApiBase()}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
