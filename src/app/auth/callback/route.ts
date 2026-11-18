import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const redirect = (path: string) => new NextResponse(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "private, no-store" },
  });
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirect("/pairing");
  }
  return redirect("/login?confirmacion=error");
}
