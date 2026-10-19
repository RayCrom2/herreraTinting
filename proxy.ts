import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Update the request so the page rendering after this sees the new tokens...
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          // ...and the response so the browser stores them.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // No-cache headers so a CDN never serves one user's session cookies to another.
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Validates the session and refreshes expired tokens (which triggers setAll above).
  const { data } = await supabase.auth.getClaims();

  // Optimistic checks, so pages don't have to read the session just to bounce visitors.
  // The real check is requireStaff() in each staff page and action.
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  if (!signedIn && path.startsWith("/staff")) return redirectTo("/login", request, response);
  if (signedIn && path === "/login") return redirectTo("/staff", request, response);

  return response;
}

function redirectTo(pathname: string, request: NextRequest, response: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  // Keep any cookie changes (e.g. a refreshed or cleared session) on the redirect.
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: ["/staff/:path*", "/login"],
};
