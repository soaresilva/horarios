"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession, requireSession } from "@/lib/session";
import { buildPerformanceData, isStaleSnapshot, rowUnchanged } from "@/lib/admin-performance";

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

  const [existingRows, stageRows] = await Promise.all([
    prisma.performance.findMany({ where: { id: { in: existingIds } } }),
    prisma.stage.findMany({ where: { id: { in: stageIds } } }),
  ]);
  const existingById = new Map(existingRows.map((p) => [p.id, p]));
  const stageById = new Map(stageRows.map((s) => [s.id, s]));

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  for (const id of stageIds) {
    const parsed = StageRowInput.safeParse({
      name: formData.get(`stage.${id}.name`),
      order: formData.get(`stage.${id}.order`),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid stage" };
    }
    const current = stageById.get(id);
    // Fully untouched row: skip it (also sidesteps the staleness check
    // below — nothing to overwrite if nothing would change).
    if (current && parsed.data.name === current.name && parsed.data.order === current.order) continue;
    if (current) {
      const snapshotUpdatedAt = String(formData.get(`stage.${id}.updatedAt`) ?? "");
      if (isStaleSnapshot(snapshotUpdatedAt, current)) {
        return {
          error: `${current.name}: this stage was changed elsewhere since you loaded this page — refresh and try again.`,
        };
      }
    }
    ops.push(prisma.stage.update({ where: { id }, data: parsed.data }));
  }

  for (const id of existingIds) {
    const raw = readRow(formData, id);
    const current = existingById.get(id);
    // Fully untouched row (common — the form resubmits every loaded row on
    // every save): skip it entirely rather than round-tripping it through
    // validation, so an unrelated edit elsewhere can never be blocked by a
    // row the admin didn't touch.
    if (current && rowUnchanged(raw, current)) continue;
    if (current) {
      const snapshotUpdatedAt = String(formData.get(`perf.${id}.updatedAt`) ?? "");
      if (isStaleSnapshot(snapshotUpdatedAt, current)) {
        return {
          error: `${current.artistName}: this row was changed elsewhere since you loaded this page — refresh and try again.`,
        };
      }
    }
    const built = buildPerformanceData(raw, current);
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
