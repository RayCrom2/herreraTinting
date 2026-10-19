"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../actions/auth";

const initialState: LoginState = { error: null, email: "" };

const inputClass =
  "w-full rounded-xl border border-zinc-800 bg-black px-4 py-3.5 text-zinc-100 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input
        name="email"
        type="email"
        autoComplete="username"
        placeholder="Email"
        defaultValue={state.email}
        className={inputClass}
      />
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Password"
        className={inputClass}
      />
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-red-600 px-6 py-3 font-bold text-white hover:bg-red-500 disabled:opacity-60"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
