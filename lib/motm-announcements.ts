import { db } from "./motm-db";
import { normalizeTeamName } from "./matchday-live";
import { synchronizeAllMatches } from "./motm-scheduling";

export type AnnouncementFixture = {
  kickoff_at: Date | string;
  home_team: string;
  away_team: string;
  elapsed: number | null;
  provider_status: string | null;
};

export const announcementDefault = (match: { home_or_away: string; opponent: string }) =>
  `Stem op je MOTM voor ${match.home_or_away === "home" ? `Ajax tegen ${match.opponent}` : `${match.opponent} tegen Ajax`}`;

export const announcementWebhook = () => {
  const value = process.env.DISCORD_MOTM_ANNOUNCEMENT_WEBHOOK?.trim();
  if (!value) throw new Error("DISCORD_MOTM_ANNOUNCEMENT_WEBHOOK ontbreekt");
  return value;
};

export const sendAnnouncement = async (webhook: string, text: string, link: string) => {
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `@everyone\n${text}\n${link}`, allowed_mentions: { parse: ["everyone"] } }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Discord webhook mislukt (${response.status})`);
};

export const shouldTryAutomaticAnnouncement = (fixture: Pick<AnnouncementFixture, "elapsed" | "provider_status">) =>
  fixture.elapsed !== null
  && fixture.elapsed >= 80
  && ["2H", "ET", "P", "LIVE", "INT"].includes(fixture.provider_status ?? "");

const sameTeam = (left: string, right: string) => {
  const a = normalizeTeamName(left), b = normalizeTeamName(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
};

export const sendAutomaticAnnouncement = async (fixture: AnnouncementFixture, requestUrl: string) => {
  if (!shouldTryAutomaticAnnouncement(fixture)) return { status: "not_due" as const };
  await synchronizeAllMatches();
  const kickoff = new Date(fixture.kickoff_at);
  const windowStart = new Date(kickoff.getTime() - 30 * 60_000);
  const windowEnd = new Date(kickoff.getTime() + 30 * 60_000);
  const ajaxHome = normalizeTeamName(fixture.home_team).includes("ajax");
  const opponent = ajaxHome ? fixture.away_team : fixture.home_team;
  const matches = await db()`SELECT * FROM motm_matches
    WHERE deleted_at IS NULL AND status='open'
      AND kickoff_at BETWEEN ${windowStart} AND ${windowEnd}
    ORDER BY kickoff_at LIMIT 4`;
  const candidate = matches.find((match: any) => sameTeam(String(match.opponent), opponent));
  if (!candidate) return { status: "no_open_match" as const };

  const sql = db();
  return sql.begin(async tx => {
    const [locked] = await tx`SELECT * FROM motm_matches WHERE id=${candidate.id} AND deleted_at IS NULL FOR UPDATE`;
    if (!locked || locked.status !== "open") return { status: "no_open_match" as const };
    if (locked.announcement_sent_at) return { status: "already_sent" as const };
    const link = new URL(`/stem/${locked.slug}`, requestUrl).href;
    await sendAnnouncement(announcementWebhook(), announcementDefault(locked as any), link);
    const [updated] = await tx`UPDATE motm_matches SET announcement_sent_at=now(),
      announcement_sent_by_discord_user_id='system:auto-minute-80',revision=revision+1
      WHERE id=${locked.id} AND announcement_sent_at IS NULL RETURNING id`;
    if (!updated) return { status: "already_sent" as const };
    await tx`INSERT INTO motm_audit_log(match_id,actor_discord_user_id,actor_username_snapshot,action,before_data,after_data)
      VALUES(${locked.id},'system:auto-minute-80','Automatische mededeling','announcement_sent',NULL,
      ${tx.json({ summary: "Discord-mededeling automatisch verstuurd", trigger: "minute_80", minute: fixture.elapsed })})`;
    return { status: "sent" as const, matchId: String(locked.id) };
  });
};
