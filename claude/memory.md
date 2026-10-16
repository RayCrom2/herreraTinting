# Project notes

Decisions that are only safe under current assumptions. Revisit before changing anything they mention.

## Auth: "logged in" currently means "staff"

These are safe **only because public sign-ups are disabled** in Supabase (Authentication → Sign In / Providers → "Allow new users to sign up" is off) and every account is created by hand in the dashboard.

- `requireStaff()` in `app/lib/dal.ts` lets in any user with a valid session. It doesn't check a staff list or role.
- The RLS policies on `quote_requests`, `quotes` and `quote_items` are `to authenticated using (true)`. Any logged-in user can read every customer's name, phone and car, and edit quotes.

**Before any of these, add a real staff check first:**

- turning sign-ups back on
- adding customer accounts or a customer login
- adding OAuth / magic-link providers that can create users
- giving anyone other than staff an account
- adding roles (e.g. owner vs staff)

To add the staff check:

1. Create a `staff` table holding the user IDs that count as staff.
2. Replace `using (true)` in each policy with a check that `auth.uid()` is in that table. Do the same for `with check (true)`.
3. Have `requireStaff()` check the same table and redirect anyone not in it.

## Other deliberate choices

- **Secret key is server-only.** `app/lib/supabase/admin.ts` uses `SUPABASE_SECRET_KEY` (role `service_role`, bypasses RLS) and imports `server-only`. Never import it into a client component. Never give it a `NEXT_PUBLIC_` name.
- **Public quote form writes only through `submit_quote_request`.** Execute on that function is revoked from `public`, `anon` and `authenticated`, and granted only to `service_role`. Redo that revoke after any change to its parameters. A changed parameter list creates a new version of the function, which gets the default execute-for-everyone grant.
- **No delete on `quote_requests` for staff.** Deleting a request cascades to all its quotes and items. If deletion is needed, add it deliberately, ideally as a soft delete such as an `archived_at` column.
- **Staff server actions are public endpoints.** Each one must call `requireStaff()` as its first line. Hiding the button doesn't protect the action.
- **`supabase/schema.sql` starts by dropping every table.** Never re-run the whole file against real data. Apply new sections on their own.
