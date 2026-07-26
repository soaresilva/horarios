"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession, requireSession } from "@/lib/session";
import { fromFestivalDayTime } from "@/lib/time";

export interface LoginState {
  error?: string;
}

function constantTimeEquals(a: string, b: string): boolean {
  // SHA-256 first so both buffers are fixed-length (timingSafeEqual throws
  // on a length mismatch, which would itself leak the password's length).
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || !password || !constantTimeEquals(password, expected)) {
    return { error: "Incorrect password." };
  }

  await createSession();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect("/admin/login");
}

// One "HH:MM" time picker per start/end plus a festival-day label, resolved
// into instants server-side (see fromFestivalDayTime). Notes and the
// recommended checkbox are optional; an unchecked box submits nothing.
const RowInput = z.object({
  artistName: z.string().trim().min(1, "artist name is required"),
  stageId: z.string().min(1, "a stage is required"),
  date: z.string().min(1, "a festival day is required"),
  start: z.string().min(1, "a start time is required"),
  end: z.string().min(1, "an end time is required"),
  notes: z.string().optional(),
  recommended: z.boolean(),
});

const StageRowInput = z.object({
  name: z.string().trim().min(1, "Stage name is required"),
  order: z.coerce.number().int("Stage order must be a whole number"),
});

export interface SaveScheduleState {
  error?: string;
  saved?: boolean;
}

// Reads one performance row's fields out of the flat FormData. Fields are
// namespaced `perf.<key>.<field>`, where <key> is the performance id for an
// existing row or a synthetic "new-*" key for an add row.
function readRow(formData: FormData, key: string) {
  const get = (field: string) => formData.get(`perf.${key}.${field}`);
  return {
    artistName: String(get("artistName") ?? ""),
    stageId: String(get("stageId") ?? ""),
    date: String(get("date") ?? ""),
    start: String(get("start") ?? ""),
    end: String(get("end") ?? ""),
    notes: String(get("notes") ?? "") || undefined,
    recommended: get("recommended") === "true",
  };
}

// Validate one row into a Prisma create/update `data` object, or return an
// error string tagged with the artist name so the admin knows which row.
function buildPerformanceData(
  raw: ReturnType<typeof readRow>,
): { data: Parameters<typeof prisma.performance.create>[0]["data"] } | { error: string } {
  const parsed = RowInput.safeParse(raw);
  const label = raw.artistName.trim() || "New performance";
  if (!parsed.success) {
    return { error: `${label}: ${parsed.error.issues[0]?.message ?? "invalid input"}` };
  }

  const { artistName, stageId, date, start, end, notes, recommended } = parsed.data;
  const startTime = fromFestivalDayTime(date, start);
  const endTime = fromFestivalDayTime(date, end);
  if (endTime.getTime() <= startTime.getTime()) {
    return { error: `${label}: end time must be after start time.` };
  }

  return {
    data: {
      artistName,
      stageId,
      date: new Date(`${date}T00:00:00Z`),
      startTime,
      endTime,
      notes: notes || null,
      recommended,
    },
  };
}

// Saves the whole admin panel in one shot: every existing performance and
// stage row is updated, every add row with an artist name is created, all in
// a single transaction so a validation error anywhere saves nothing.
export async function saveScheduleAction(
  _prevState: SaveScheduleState,
  formData: FormData,
): Promise<SaveScheduleState> {
  await requireSession();

  const existingIds = String(formData.get("existingIds") ?? "").split(",").filter(Boolean);
  const newKeys = String(formData.get("newKeys") ?? "").split(",").filter(Boolean);
  const stageIds = String(formData.get("stageIds") ?? "").split(",").filter(Boolean);

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  for (const id of stageIds) {
    const parsed = StageRowInput.safeParse({
      name: formData.get(`stage.${id}.name`),
      order: formData.get(`stage.${id}.order`),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid stage" };
    }
    ops.push(prisma.stage.update({ where: { id }, data: parsed.data }));
  }

  for (const id of existingIds) {
    const built = buildPerformanceData(readRow(formData, id));
    if ("error" in built) return { error: built.error };
    ops.push(prisma.performance.update({ where: { id }, data: built.data }));
  }

  for (const key of newKeys) {
    const raw = readRow(formData, key);
    // An untouched add row (no artist typed) is ignored, not an error.
    if (!raw.artistName.trim()) continue;
    const built = buildPerformanceData(raw);
    if ("error" in built) return { error: built.error };
    ops.push(prisma.performance.create({ data: built.data }));
  }

  await prisma.$transaction(ops);

  revalidatePath("/admin");
  revalidatePath("/");
  return { saved: true };
}

// Immediate single-row delete, called from a client onClick after a
// window.confirm() — kept off the bulk form so it can't submit half-edited
// rows. Re-checks the session since it's a directly-invoked server action.
export async function deletePerformanceById(id: string): Promise<void> {
  await requireSession();
  if (!id) return;
  await prisma.performance.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/");
}
