import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function safeReturnPath(
  next: string | null,
  defaultLocale: string,
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return `/${defaultLocale}`;
  }
  const pathOnly = next.split("?")[0] ?? next;
  const localePattern = new RegExp(
    `^\\/(${routing.locales.join("|")})(\\/|$)`,
  );
  if (!localePattern.test(pathOnly)) {
    return `/${defaultLocale}`;
  }
  return pathOnly;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextRaw = requestUrl.searchParams.get("next");
  const nextPath = safeReturnPath(nextRaw, routing.defaultLocale);
  const { origin } = requestUrl;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      if (isLocal) {
        return NextResponse.redirect(`${origin}${nextPath}`);
      }
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${nextPath}`);
      }
      return NextResponse.redirect(`${origin}${nextPath}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/${routing.defaultLocale}?error=oauth`,
  );
}
