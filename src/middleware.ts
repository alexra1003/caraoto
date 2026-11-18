import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies: Parameters<SetAllCookies>[0]) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  const isLogin = request.nextUrl.pathname === "/login";
  // Let protected pages handle temporary Auth failures and membership checks.
  const sessionMissing = !user && (!error || error.name === "AuthSessionMissingError");
  const destination = isLogin && user ? "/pairing" : !isLogin && sessionMissing ? "/login" : null;
  if (destination) {
    const redirect = NextResponse.redirect(new URL(destination, request.url));
    redirect.headers.set("Cache-Control", "private, no-store");
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/dashboard", "/pairing", "/login"] };
