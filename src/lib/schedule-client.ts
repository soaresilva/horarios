import type { PerformanceDTO, ScheduleResponse, StageDTO } from "@/types/schedule";

export type Stage = StageDTO;

export interface Performance extends Omit<PerformanceDTO, "startTime" | "endTime"> {
  startTime: Date;
  endTime: Date;
}

export interface Schedule {
  updatedAt: Date;
  stages: Stage[];
  performances: Performance[];
}

export function parseSchedule(dto: ScheduleResponse): Schedule {
  return {
    updatedAt: new Date(dto.updatedAt),
    stages: dto.stages,
    performances: dto.performances.map((p) => ({
      ...p,
      startTime: new Date(p.startTime),
      endTime: new Date(p.endTime),
    })),
  };
}
