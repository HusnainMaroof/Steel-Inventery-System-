import { NextResponse } from "next/server";
import { tradexFetch } from "@/lib/server/tradex";

type RouteContext = { params: Promise<{ path: string[] }> };

async function forward(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const incoming = new URL(request.url);
  const apiPath =
    `/api/v1/${path.map(encodeURIComponent).join("/")}` + incoming.search;
  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD"
    ? undefined
    : await request.text();
  const result = await tradexFetch<unknown>(apiPath, { method, body });
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: result.status });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
