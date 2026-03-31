import { NextResponse, type NextRequest } from "next/server"

function hasSupabaseSessionCookie(request: NextRequest) {
  const cookies = request.cookies.getAll()
  return cookies.some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that do not require auth.
  const publicPaths = ["/login", "/auth/callback"]
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p))

  const hasSession = hasSupabaseSessionCookie(request)

  if (!hasSession && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (hasSession && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
