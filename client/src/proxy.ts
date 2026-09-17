import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isKnownAppPath } from "@/lib/app-routes";

const PUBLIC_PATHS = new Set(["/", "/login", "/offline", "/404"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isKnownAppPath(pathname)) {
    const notFound = new URL("/404", request.url);
    notFound.searchParams.set("from", pathname);
    return NextResponse.redirect(notFound);
  }

  const session = request.cookies.get("session")?.value;
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!session && !isPublic) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|images|favicon.ico|.*\\.png$).*)",
  ],
};
