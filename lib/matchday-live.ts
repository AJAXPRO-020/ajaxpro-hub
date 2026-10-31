const partsInAmsterdam = (date: Date) => Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]),
) as Record<string, string>;

export const amsterdamDateKey = (date = new Date()) => {
  const parts = partsInAmsterdam(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const amsterdamLocalToUtc = (year: number, month: number, day: number, hour: number, minute: number) => {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = wallClock;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = partsInAmsterdam(new Date(candidate));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    candidate -= represented - wallClock;
  }
  return new Date(candidate);
};

export const countdownParts = (kickoff: Date | string, now = new Date()) => {
  const remaining = Math.max(0, new Date(kickoff).getTime() - now.getTime());
  const totalMinutes = Math.floor(remaining / 60_000);
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
    totalMilliseconds: remaining,
  };
};

export const normalizeTeamName = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\b(afc|fc|fk|sc|amsterdam)\b/g, "")
  .replace(/[^a-z0-9]/g, "");
