import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/admin/actions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export default async function AdminPage() {
  try {
    await requireSession();
  } catch {
    redirect("/admin/login");
  }

  const festivals = await prisma.festival.findMany({ orderBy: { startDate: "desc" } });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-4 text-zinc-100">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Admin</h1>
        <form action={logoutAction}>
          <button type="submit" className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm">
            Log out
          </button>
        </form>
      </header>

      <div className="flex flex-col gap-2">
        {festivals.length === 0 ? (
          <p className="text-sm text-zinc-500">No festivals yet.</p>
        ) : (
          festivals.map((festival) => (
            <Link
              key={festival.id}
              href={`/admin/${festival.slug}`}
              className="flex items-center justify-between rounded-md border border-zinc-800 px-4 py-3 text-sm transition-colors hover:border-accent hover:bg-zinc-900"
            >
              <span>{festival.name}</span>
              <span className="text-xs text-zinc-600">{festival.slug}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
