import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction, setFeaturedFestivalAction, setFestivalPublishedAction } from "@/app/admin/actions";
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

      {festivals.length > 0 && (
        <form action={setFeaturedFestivalAction} className="flex flex-col gap-2 rounded-md border border-zinc-800 p-4 text-sm">
          <h2 className="font-medium">Homepage</h2>
          <p className="text-xs text-zinc-500">
            <code>/</code> redirects to this festival. With none selected it shows the archive list (also at{" "}
            <code>/archive</code>).
          </p>
          <label className="flex items-center gap-2">
            <input type="radio" name="slug" value="" defaultChecked={!festivals.some((f) => f.featured)} />
            None (archive list)
          </label>
          {festivals.map((festival) => (
            <label key={festival.id} className="flex items-center gap-2">
              <input
                type="radio"
                name="slug"
                value={festival.slug}
                defaultChecked={festival.featured}
                disabled={!festival.published}
              />
              {festival.name}
            </label>
          ))}
          <button type="submit" className="self-start rounded-md bg-zinc-800 px-3 py-1.5">
            Save
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {festivals.length === 0 ? (
          <p className="text-sm text-zinc-500">No festivals yet.</p>
        ) : (
          festivals.map((festival) => (
            <div key={festival.id} className="flex items-center gap-2">
              <Link
                href={`/admin/${festival.slug}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-zinc-800 px-4 py-3 text-sm transition-colors hover:border-accent hover:bg-zinc-900"
              >
                <span className="truncate">{festival.name}</span>
                {!festival.published && (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">Unpublished</span>
                )}
                <span className="text-xs text-zinc-600">{festival.slug}</span>
              </Link>
              {!festival.published && (
                <Link href={`/${festival.slug}`} className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm">
                  View
                </Link>
              )}
              <form action={setFestivalPublishedAction}>
                <input type="hidden" name="slug" value={festival.slug} />
                <input type="hidden" name="published" value={String(!festival.published)} />
                <button type="submit" className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm">
                  {festival.published ? "Unpublish" : "Publish"}
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
