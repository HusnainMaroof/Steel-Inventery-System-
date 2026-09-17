import { NextResponse } from "next/server";

function apiBase(): string {
  return (process.env.TRADEX_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
}

export async function GET() {
  try {
    const res = await fetch(`${apiBase()}/health`, {
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
