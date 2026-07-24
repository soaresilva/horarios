"use client";

import { useActionState } from "react";
import {
  deletePerformanceAction,
  upsertPerformanceAction,
  type PerformanceFormState,
} from "@/app/admin/actions";
import type { Performance, Stage } from "@/lib/schedule-client";
import { toLisbonDatetimeLocalValue } from "@/lib/time";

const initialState: PerformanceFormState = {};

interface PerformanceFormProps {
  stages: Stage[];
  performance?: Performance;
  defaultDate?: string;
}

const inputClass = "w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100";

// Rendered as `contents` so its fields land as individual cells in the
// parent's CSS grid (see AdminDashboardPage) instead of each performance
// being its own unaligned row of wrapped inputs.
export function PerformanceForm({ stages, performance, defaultDate }: PerformanceFormProps) {
  const [state, action, pending] = useActionState(upsertPerformanceAction, initialState);
  const isNew = !performance;

  return (
    <form action={action} className="contents">
      {performance && <input type="hidden" name="id" value={performance.id} />}

      <input
        type="text"
        name="artistName"
        placeholder="Artist"
        defaultValue={performance?.artistName}
        required
        className={inputClass}
      />

      <select name="stageId" defaultValue={performance?.stageId ?? stages[0]?.id} className={inputClass}>
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        name="date"
        defaultValue={performance?.date ?? defaultDate}
        required
        className={inputClass}
      />

      <input
        type="datetime-local"
        name="startTime"
        defaultValue={performance ? toLisbonDatetimeLocalValue(performance.startTime) : undefined}
        required
        title="Start (Lisbon time)"
        className={inputClass}
      />

      <input
        type="datetime-local"
        name="endTime"
        defaultValue={performance ? toLisbonDatetimeLocalValue(performance.endTime) : undefined}
        required
        title="End (Lisbon time)"
        className={inputClass}
      />

      <input
        type="text"
        name="notes"
        placeholder="Notes"
        defaultValue={performance?.notes ?? ""}
        className={inputClass}
      />

      <div className="flex gap-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-zinc-950 disabled:opacity-50"
        >
          {isNew ? "Add" : "Save"}
        </button>
        {performance && (
          <button
            type="submit"
            formAction={deletePerformanceAction}
            className="rounded-md bg-red-900/60 px-2.5 py-1 text-xs text-red-200"
          >
            Delete
          </button>
        )}
      </div>

      {state.error && <p className="col-span-full text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
