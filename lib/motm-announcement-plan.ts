import { amsterdamDateKey, FINISHED_STATUSES } from "./matchday-live";

type PlannedFixture = {
  kickoff_at: Date | string;
  provider_status: string | null;
  finished_at: Date | string | null;
};

// Keep late matches eligible across midnight, with a bound if provider data stalls.
export const announcementPlan = (fixture: PlannedFixture | undefined, now = new Date()) => {
  if (!fixture || fixture.finished_at || FINISHED_STATUSES.has(fixture.provider_status ?? "")
    || ["PST", "SUSP"].includes(fixture.provider_status ?? "")) {
    return { status: "no_match" as const, active: false, due: false };
  }
  const kickoff = new Date(fixture.kickoff_at);
  const elapsedMs = now.getTime() - kickoff.getTime();
  const active = Number.isFinite(elapsedMs) && elapsedMs < 6 * 60 * 60_000
    && (amsterdamDateKey(kickoff) === amsterdamDateKey(now) || elapsedMs >= 0);
  return {
    status: active ? "match_day" as const : "no_match" as const,
    active,
    due: active && elapsedMs >= 70 * 60_000,
  };
};
