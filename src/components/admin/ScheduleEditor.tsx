"use client";

import { Fragment, useActionState, useTransition } from "react";
import {
  deletePerformanceById,
  saveScheduleAction,
  type SaveScheduleState,
} from "@/app/admin/actions";
import type { Performance, Stage } from "@/lib/schedule-client";
import { performancesForDate, uniqueSortedDates } from "@/lib/grouping";
import { formatDayTabLabel, toLisbonClockValue } from "@/lib/time";

const initialState: SaveScheduleState = {};

const inputClass = "w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100";
const gridCols = "grid-cols-[1.3fr_110px_140px_100px_100px_1fr_44px_auto]";

const pad = (n: number) => String(n).padStart(2, "0");

// "HH:MM" options at 5-minute steps, ordered from midday round through the
// small hours (12:00 … 23:55, 00:00 … 11:55) so a festival evening's slots
// sit near the top and after-midnight slots read in chronological order.
const TIME_OPTIONS: string[] = (() => {
  const hours = [...Array(12).keys()].map((h) => h + 12).concat([...Array(12).keys()]);
  const out: string[] = [];
  for (const h of hours) {
    for (let m = 0; m < 60; m += 5) out.push(`${pad(h)}:${pad(m)}`);
  }
  return out;
})();

// Single-dropdown time picker: one click (or type-ahead) instead of tabbing
// between the hour and minute segments of a native datetime input. If a
// stored time falls off the 5-minute grid it's injected as an extra option so
// the value still round-trips instead of silently blanking.
function TimeSelect({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const dv = defaultValue ?? "";
  const options = dv && !TIME_OPTIONS.includes(dv) ? [dv, ...TIME_OPTIONS] : TIME_OPTIONS;
  return (
    <select name={name} defaultValue={dv} title="Lisbon time" className={inputClass}>
      <option value="">—</option>
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

interface RowProps {
  stages: Stage[];
  keyName: string;
  performance?: Performance;
  defaultDate?: string;
  onDelete?: (id: string, name: string) => void;
}

// One row of grid cells (a Fragment, so the cells land directly in the parent
// grid). `keyName` namespaces its field names — the performance id for an
// existing row, a synthetic "new-*" key for an add row.
function PerformanceRow({ stages, keyName, performance, defaultDate, onDelete }: RowProps) {
  const field = (name: string) => `perf.${keyName}.${name}`;
  return (
    <Fragment>
      <input
        type="text"
        name={field("artistName")}
        defaultValue={performance?.artistName}
        placeholder={performance ? undefined : "Add artist…"}
        className={inputClass}
      />
      <select name={field("stageId")} defaultValue={performance?.stageId ?? stages[0]?.id} className={inputClass}>
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </select>
      <input
        type="date"
        name={field("date")}
        defaultValue={performance?.date ?? defaultDate}
        className={inputClass}
      />
      <TimeSelect name={field("start")} defaultValue={performance ? toLisbonClockValue(performance.startTime) : undefined} />
      <TimeSelect name={field("end")} defaultValue={performance ? toLisbonClockValue(performance.endTime) : undefined} />
      <input type="text" name={field("notes")} defaultValue={performance?.notes ?? ""} placeholder="Notes" className={inputClass} />
      <label className="flex items-center justify-center" title="bolachas recommends">
        <input
          type="checkbox"
          name={field("recommended")}
          value="true"
          defaultChecked={performance?.recommended ?? false}
          className="h-4 w-4 accent-accent"
        />
      </label>
      {performance && onDelete ? (
        <button
          type="button"
          aria-label={`Delete ${performance.artistName}`}
          onClick={() => onDelete(performance.id, performance.artistName)}
          className="rounded-md bg-red-900/60 px-2.5 py-1 text-xs text-red-200"
        >
          Delete
        </button>
      ) : (
        <span />
      )}
    </Fragment>
  );
}

const headerCols = ["Artist", "Stage", "Day", "Start", "End", "Notes", "Rec", ""];

function HeaderRow() {
  return (
    <div className="grid grid-cols-subgrid col-span-8 pb-1 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
      {headerCols.map((label, i) => (
        <span key={i}>{label}</span>
      ))}
    </div>
  );
}

interface ScheduleEditorProps {
  stages: Stage[];
  performances: Performance[];
  // Called with the save result right after it resolves. A save bumps every
  // row's updatedAt, which changes the parent's editorKey and remounts this
  // component — so any confirmation kept in this component's own state can
  // be destroyed before it ever paints. Bubbling the result up to a stable
  // parent (AdminScheduleShell) is what makes the confirmation reliable.
  onSaved?: (state: SaveScheduleState) => void;
}

export function ScheduleEditor({ stages, performances, onSaved }: ScheduleEditorProps) {
  async function saveAndReport(prevState: SaveScheduleState, formData: FormData) {
    const result = await saveScheduleAction(prevState, formData);
    onSaved?.(result);
    return result;
  }

  const [, action, pending] = useActionState(saveAndReport, initialState);
  const [isDeleting, startDelete] = useTransition();

  const days = uniqueSortedDates(performances);
  const existingIds = performances.map((p) => p.id);
  const newKeys = [...days.map((d) => `new-${d}`), "new-blank"];

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete “${name}”? This can’t be undone.`)) return;
    startDelete(async () => {
      await deletePerformanceById(id);
    });
  }

  return (
    <form action={action} className="flex flex-col gap-8">
      <input type="hidden" name="existingIds" value={existingIds.join(",")} />
      <input type="hidden" name="newKeys" value={newKeys.join(",")} />
      <input type="hidden" name="stageIds" value={stages.map((s) => s.id).join(",")} />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-400">Stages</h2>
        <div className="flex flex-col gap-2">
          {stages.map((stage) => (
            <div key={stage.id} className="flex items-center gap-2">
              <input
                type="text"
                name={`stage.${stage.id}.name`}
                defaultValue={stage.name}
                className="w-40 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
              />
              <input
                type="number"
                name={`stage.${stage.id}.order`}
                defaultValue={stage.order}
                title="Display order (lower = shown first / paired as a main stage)"
                className="w-16 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
              />
              <span className="text-xs text-zinc-600">{stage.slug}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6 overflow-x-auto">
        <h2 className="text-sm font-semibold text-zinc-400">Performances</h2>
        {days.map((day) => {
          const { weekday, day: dayNum } = formatDayTabLabel(new Date(`${day}T12:00:00Z`));
          const dayPerformances = performancesForDate(performances, day)
            .slice()
            .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

          return (
            <div key={day} className="min-w-[900px]">
              <h3 className="mb-1 text-sm font-medium text-zinc-300">
                {weekday} {dayNum} <span className="text-zinc-600">({day})</span>
              </h3>
              <div className={`grid ${gridCols} items-center gap-x-2 gap-y-1`}>
                <HeaderRow />
                {dayPerformances.map((performance) => (
                  <PerformanceRow
                    key={performance.id}
                    stages={stages}
                    keyName={performance.id}
                    performance={performance}
                    onDelete={handleDelete}
                  />
                ))}
                <PerformanceRow stages={stages} keyName={`new-${day}`} defaultDate={day} />
              </div>
            </div>
          );
        })}

        <div className="min-w-[900px]">
          <h3 className="mb-1 text-sm font-medium text-zinc-300">Add a new day</h3>
          <div className={`grid ${gridCols} items-center gap-x-2 gap-y-1`}>
            <HeaderRow />
            <PerformanceRow stages={stages} keyName="new-blank" />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 z-30 -mx-4 flex items-center gap-3 border-t border-zinc-800 bg-background/95 px-4 py-3 backdrop-blur">
        <button
          type="submit"
          disabled={pending || isDeleting}
          className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-semibold text-zinc-950 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save all changes"}
        </button>
      </div>
    </form>
  );
}
