import LoginForm from "./LoginForm";

// Fully static: proxy.ts sends visitors who are already signed in on to /staff.
export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-20 text-zinc-100">
      <h1 className="mb-6 text-2xl font-bold">Staff Login</h1>
      <LoginForm />
    </main>
  );
}
