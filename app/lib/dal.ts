import "server-only"; //data access layer
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "./supabase/server";

// Every staff page and staff server action calls this before touching data.
// cache() makes repeat calls within one request reuse the first result.
export const requireStaff = cache(async () => {
  // Session checks are per request (getClaims uses Date.now() for expiry), so never prerender them.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  return {
    supabase,
    userId: data.claims.sub,
    email: data.claims.email as string | undefined,
  };
});
