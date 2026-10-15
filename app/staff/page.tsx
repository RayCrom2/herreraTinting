import { requireStaff } from "../lib/dal";
import { supabase } from "../lib/supabase/admin";

export default async function StaffHome() {
  await requireStaff();
  return (
    <>
      <h1 className="text-2xl font-bold">Open Quotes</h1>
      <p className="mt-2 text-zinc-400">Quote list coming next.</p>
    </>
  );
}
