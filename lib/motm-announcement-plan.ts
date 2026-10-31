import { amsterdamDateKey } from "./matchday-live";

type PlannedMatch = {
  status: string;
  scheduled_open_at: Date | string | null;
  scheduled_close_at: Date | string | null;
};

export const announcementPlan = (match: PlannedMatch | undefined, now = new Date()) => {
  if (!match || !match.scheduled_open_at || !match.scheduled_close_at || match.status === "closed") {
    return { status: "no_match" as const, active: false, due: false };
  }
  const openAt = new Date(match.scheduled_open_at);
  const closeAt = new Date(match.scheduled_close_at);
  const active = Number.isFinite(openAt.getTime()) && Number.isFinite(closeAt.getTime())
    && now.getTime() < closeAt.getTime()
    && (amsterdamDateKey(openAt) === amsterdamDateKey(now) || now.getTime() >= openAt.getTime());
  return {
    status: active ? "poll_day" as const : "no_match" as const,
    active,
    due: active && match.status === "open" && now.getTime() >= openAt.getTime(),
  };
};
