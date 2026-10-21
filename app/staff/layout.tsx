import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "../lib/dal";
import { logout } from "../actions/auth";

// Reads the session, so it streams in at request time inside <Suspense>.
async function StaffEmail() {
  const { email } = await requireStaff();
  return <span className="text-zinc-400">{email}</span>;
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Herrera Tinting · Staff</span>
          <nav className="flex gap-4 text-sm text-zinc-400">
            <Link href="/staff" className="hover:text-zinc-100">
              Open quotes
            </Link>
            <Link href="/staff/sent" className="hover:text-zinc-100">
              Sent quotes
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Suspense fallback={null}>
            <StaffEmail />
          </Suspense>
          <form action={logout}>
            <button type="submit" className="text-red-400 hover:underline">
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Suspense fallback={<p className="text-zinc-400">Loading...</p>}>{children}</Suspense>
      </main>
    </div>
  );
}
