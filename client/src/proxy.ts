
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isKnownAppPath, isPublicPath } from "@/lib/app-routes";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isKnownAppPath(pathname)) {
    const notFound = new URL("/404", request.url);
    notFound.searchParams.set("from", pathname);
    return NextResponse.redirect(notFound);
  }

  const session = request.cookies.get("session")?.value;
  const isPublic = isPublicPath(pathname);

  if (!session && !isPublic) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|images|favicon.ico|robots.txt|sitemap.xml|.*\\.png$|.*\\.txt$).*)",
  ],
};
