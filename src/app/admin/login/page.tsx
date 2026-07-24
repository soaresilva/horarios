"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/admin/actions";

const initialState: LoginState = {};

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
      <form action={action} className="flex w-full max-w-xs flex-col gap-3">
        <h1 className="text-center text-sm font-semibold text-zinc-300">PdC 2026 admin</h1>
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          required
          className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
        />
        {state.error && <p className="text-xs text-red-400">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
