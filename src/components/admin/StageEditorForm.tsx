"use client";

import { useActionState } from "react";
import { updateStageAction, type StageFormState } from "@/app/admin/actions";
import type { Stage } from "@/lib/schedule-client";

const initialState: StageFormState = {};

export function StageEditorForm({ stage }: { stage: Stage }) {
  const [state, action, pending] = useActionState(updateStageAction, initialState);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={stage.id} />
      <input
        type="text"
        name="name"
        defaultValue={stage.name}
        className="w-40 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
      />
      <input
        type="number"
        name="order"
        defaultValue={stage.order}
        title="Display order (lower = shown first / paired as a main stage)"
        className="w-16 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-100 disabled:opacity-50"
      >
        Save
      </button>
      {state.error && <span className="text-xs text-red-400">{state.error}</span>}
    </form>
  );
}
