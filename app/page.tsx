import QuoteForm from "./components/QuoteForm";

export default function Home() {
  return (
    <main className="flex flex-1 justify-center bg-zinc-950 px-4 py-12 sm:py-20">
      <section className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/50 sm:p-10">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-500">
            Free Quote
          </p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-100 sm:text-4xl">
            Get Your Windows Tinted
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            Tell us about your vehicle and we&apos;ll text you a quote.
          </p>
        </header>
        <QuoteForm />
      </section>
    </main>
  );
}
