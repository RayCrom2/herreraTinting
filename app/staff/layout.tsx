import { requireStaff } from "../lib/dal";
import { logout } from "../actions/auth";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireStaff();

  return (
    <div className="min-h-screen text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <span className="font-semibold">Herrera Tinting · Staff</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-400">{email}</span>
          <form action={logout}>
            <button type="submit" className="text-red-400 hover:underline">
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
