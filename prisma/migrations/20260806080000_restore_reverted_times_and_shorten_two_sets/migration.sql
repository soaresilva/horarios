-- Data migration (no schema change), two unrelated fixes bundled together
-- since both were found and fixed in the same session:
--
-- 1. Restore Ryan Davis and Patrick Watson, which the prior migration
--    (20260804130000_fix_ryan_davis_patrick_watson_times) already fixed
--    once (finished_at 2026-08-04 18:01 UTC, confirmed via
--    _prisma_migrations), but which got silently reverted back to their
--    pre-reveal guessed times by a bulk admin save on 2026-08-05 09:21 UTC.
--    Root cause: ScheduleEditor.tsx's inputs are uncontrolled
--    (defaultValue), so a browser tab left open from before that fix
--    landed still held the old values; saving any edit through that stale
--    tab resubmitted the whole form, including those two untouched-looking
--    fields, silently overwriting the migration's correction. Same target
--    ids and values as before:
--      - cmrz4dvv3001g4m5nr1tfm9nw (Ryan Davis and the Roadhouse Band)
--      - cmrz4dwgq001o4m5n5ek9lwom (Patrick Watson)
--    This is a recurring hazard, not just a one-off — any stale /admin tab
--    can revert future data migrations the same way. Only a real fix (e.g.
--    switching those inputs to controlled state, or a "data changed under
--    you" refetch-on-focus check before save) closes it for good; noting it
--    here rather than solving it in this migration.
--
-- 2. Shorten Dame Area and Maruja's estimated end times per Diogo (real
--    known set lengths, not the "guessed as next act's start" heuristic
--    used for the mass Aug 4 lineup reveal): Dame Area 75min -> 60min,
--    Maruja 85min -> 60min. Both leave a gap before the next act on their
--    stage now (Dame Area -> Marie Davidson DJ Set, Maruja -> Joy Orbison)
--    instead of running back-to-back, which is fine since all these times
--    are already labeled "estimated" on the public page.
--      - cmrz4dx4i001w4m5nar20mwcq (Dame Area)
--      - cmrz4dw0g001i4m5nl8on0t7c (Maruja, startTime unchanged)
--
-- Times carry an explicit +01:00 offset (mainland Portugal is WEST/UTC+1
-- all August) so they store as the correct UTC instant regardless of the
-- migration connection's session timezone.

UPDATE "Performance"
SET "startTime" = TIMESTAMPTZ '2026-08-14 19:55:00+01',
    "endTime" = TIMESTAMPTZ '2026-08-14 20:40:00+01',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'cmrz4dvv3001g4m5nr1tfm9nw';

UPDATE "Performance"
SET "startTime" = TIMESTAMPTZ '2026-08-15 17:10:00+01',
    "endTime" = TIMESTAMPTZ '2026-08-15 18:10:00+01',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'cmrz4dwgq001o4m5n5ek9lwom';

UPDATE "Performance"
SET "endTime" = TIMESTAMPTZ '2026-08-16 02:35:00+01',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'cmrz4dx4i001w4m5nar20mwcq';

UPDATE "Performance"
SET "endTime" = TIMESTAMPTZ '2026-08-15 03:00:00+01',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'cmrz4dw0g001i4m5nl8on0t7c';
