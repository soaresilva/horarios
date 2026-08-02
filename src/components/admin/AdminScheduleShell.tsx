"use client";

import { useEffect, useState } from "react";
import { ScheduleEditor } from "@/components/admin/ScheduleEditor";
import type { SaveScheduleState } from "@/app/admin/actions";
import type { Performance, Stage } from "@/lib/schedule-client";

const BANNER_TIMEOUT_MS = 4000;

interface AdminScheduleShellProps {
  stages: Stage[];
  performances: Performance[];
  editorKey: string;
}

// A save bumps every row's `updatedAt` (see page.tsx), which changes
// `editorKey` and remounts `ScheduleEditor` so its uncontrolled inputs pick
// up the fresh DB state. That remount used to also wipe out the "Saved."/
// error message, because that feedback lived in the remounted component's
// own `useActionState` — it could be destroyed before ever painting, so a
// save that genuinely succeeded (e.g. two "recommended" checkboxes ticked in
// one submit) showed no confirmation at all. This shell holds the banner
// state instead: it never remounts, so the message set by `onSaved` always
// renders, independent of the editor's lifecycle.
export function AdminScheduleShell({ stages, performances, editorKey }: AdminScheduleShellProps) {
  const [banner, setBanner] = useState<SaveScheduleState | null>(null);

  useEffect(() => {
    if (!banner?.saved) return;
    const timeout = setTimeout(() => setBanner(null), BANNER_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [banner]);

  return (
    <div className="flex flex-col gap-3">
      {banner?.error && <p className="text-xs text-red-400">{banner.error}</p>}
      {banner?.saved && !banner.error && <p className="text-xs text-emerald-400">Saved.</p>}
      <ScheduleEditor key={editorKey} stages={stages} performances={performances} onSaved={setBanner} />
    </div>
  );
}
