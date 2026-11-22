export type MatchStatus = "draft" | "open" | "closed";

export type SchedulableMatch = {
  status: MatchStatus;
  scheduled_open_at: string | Date | null;
  scheduled_close_at: string | Date | null;
};

export const statusAt = (match: SchedulableMatch, now = new Date()): MatchStatus => {
  if (match.status === "closed") return "closed";
  const openAt = match.scheduled_open_at ? new Date(match.scheduled_open_at) : null;
  const closeAt = match.scheduled_close_at ? new Date(match.scheduled_close_at) : null;
  if (closeAt && now >= closeAt && (match.status === "open" || (openAt && now >= openAt))) return "closed";
  if (match.status === "draft" && openAt && now >= openAt) return "open";
  return match.status;
};

export const canVoteAt = (match: SchedulableMatch, now = new Date()) => {
  const closeAt = match.scheduled_close_at ? new Date(match.scheduled_close_at) : null;
  return statusAt(match, now) === "open" && (!closeAt || now < closeAt);
};

export type VoteResult = { player_id: string; name_snapshot: string; image_url_snapshot: string; votes: number };
export type RankedResult = VoteResult & { rank: number; percentage: number; total: number };

export const rankResults = (rows: VoteResult[], previousWins: ReadonlyMap<string, number> = new Map()): RankedResult[] => {
  const positive = rows.filter(row => row.votes > 0);
  const total = positive.reduce((sum, row) => sum + row.votes, 0);
  return positive
    .sort((a,b)=>b.votes-a.votes||(previousWins.get(a.player_id)??0)-(previousWins.get(b.player_id)??0)||a.name_snapshot.localeCompare(b.name_snapshot,"nl")||a.player_id.localeCompare(b.player_id))
    .slice(0,3)
    .map((row,index) => ({ ...row, rank:index+1, total, percentage:total?Math.round(row.votes*100/total):0 }));
};

export const voteLabel = (count: number) => `${count} ${count === 1 ? "stem" : "stemmen"}`;
export const winnerLabel = (count: number) => count === 1 ? "1 winnaar" : "gedeelde winnaars";
export const statusLabel = (status: MatchStatus) => ({ draft: "Concept", open: "Open", closed: "Gesloten" })[status];

const amsterdamParts = (date: Date) => Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]),
);

export const amsterdamInputToUtc = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const wanted = Date.UTC(+year, +month - 1, +day, +hour, +minute);
  let candidate = new Date(wanted);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = amsterdamParts(candidate);
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    candidate = new Date(candidate.getTime() + wanted - represented);
  }
  const parts = amsterdamParts(candidate);
  return parts.year === year && parts.month === month && parts.day === day && parts.hour === hour && parts.minute === minute ? candidate : null;
};

export const toAmsterdamInput = (value: string | Date) => {
  const parts = amsterdamParts(new Date(value));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

export const toAmsterdamFields = (value: string | Date | null | undefined) => {
  if (!value) return { date: "", time: "" };
  const [date, time] = toAmsterdamInput(value).split("T");
  return { date, time };
};

export const amsterdamFieldsToUtc = (date: string, time: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  return amsterdamInputToUtc(`${date}T${time}`);
};

export const defaultSchedule = (kickoffAt: Date) => {
  const openAt = new Date(kickoffAt.getTime());
  return { openAt, closeAt: new Date(kickoffAt.getTime() + 150 * 60 * 1000) };
};
