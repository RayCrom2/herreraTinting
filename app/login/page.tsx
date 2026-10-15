import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/staff");

  return (
    <main className="mx-auto max-w-sm px-4 py-20 text-zinc-100">
      <h1 className="mb-6 text-2xl font-bold">Staff Login</h1>
      <LoginForm />
    </main>
  );
}
