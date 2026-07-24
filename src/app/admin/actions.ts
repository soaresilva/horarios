"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession, requireSession } from "@/lib/session";
import { fromLisbonDatetimeLocalValue } from "@/lib/time";

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

const PerformanceInput = z.object({
  id: z.string().optional(),
  artistName: z.string().trim().min(1, "Artist name is required"),
  stageId: z.string().min(1, "Stage is required"),
  date: z.string().min(1, "Festival day is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  notes: z.string().optional(),
});

export interface PerformanceFormState {
  error?: string;
}

export async function upsertPerformanceAction(
  _prevState: PerformanceFormState,
  formData: FormData,
): Promise<PerformanceFormState> {
  await requireSession();

  const parsed = PerformanceInput.safeParse({
    id: formData.get("id") || undefined,
    artistName: formData.get("artistName"),
    stageId: formData.get("stageId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id, artistName, stageId, date, notes } = parsed.data;
  const startTime = fromLisbonDatetimeLocalValue(parsed.data.startTime);
  const endTime = fromLisbonDatetimeLocalValue(parsed.data.endTime);

  if (endTime.getTime() <= startTime.getTime()) {
    return { error: "End time must be after start time." };
  }

  const data = {
    artistName,
    stageId,
    date: new Date(`${date}T00:00:00Z`),
    startTime,
    endTime,
    notes: notes || null,
  };

  if (id) {
    await prisma.performance.update({ where: { id }, data });
  } else {
    await prisma.performance.create({ data });
  }

  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

export async function deletePerformanceAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.performance.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/");
}

const StageInput = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Stage name is required"),
  order: z.coerce.number().int(),
});

export interface StageFormState {
  error?: string;
}

export async function updateStageAction(_prevState: StageFormState, formData: FormData): Promise<StageFormState> {
  await requireSession();

  const parsed = StageInput.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    order: formData.get("order"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.stage.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name, order: parsed.data.order },
  });

  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}
