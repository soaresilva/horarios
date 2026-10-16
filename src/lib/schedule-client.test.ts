import { describe, expect, it } from "vitest";
import { parseSchedule } from "./schedule-client";
import type { PerformanceDTO, ScheduleResponse } from "@/types/schedule";

function response(performance: Partial<PerformanceDTO> & Record<string, unknown>): ScheduleResponse {
  return {
    updatedAt: "2026-10-16T10:00:00.000Z",
    zones: [],
    zoneWalks: [],
    stages: [],
    artists: [],
    performances: [
      {
        id: "p1",
        artistName: "Act",
        date: "2026-10-23",
        startTime: "2026-10-23T10:00:00.000Z",
        endTime: "2026-10-23T10:30:00.000Z",
        notes: null,
        recommended: false,
        stageId: "s1",
        artistId: null,
        ...performance,
      } as PerformanceDTO,
    ],
  };
}

describe("parseSchedule series/host", () => {
  it("passes a side-programme set's series and host through", () => {
    const [p] = parseSchedule(response({ series: "The Official Unofficial", host: "Duct Tape" })).performances;
    expect(p.series).toBe("The Official Unofficial");
    expect(p.host).toBe("Duct Tape");
  });

  it("reads a response cached before the fields existed as main programme (null, not undefined)", () => {
    const [p] = parseSchedule(response({})).performances;
    expect(p.series).toBeNull();
    expect(p.host).toBeNull();
  });
});
