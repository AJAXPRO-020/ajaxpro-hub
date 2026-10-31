import { db } from "./motm-db";
import { synchronizeAllMatches } from "./motm-scheduling";

export const announcementDefault = (match: { home_or_away: string; opponent: string }) =>
  `Stem op je MOTM voor ${match.home_or_away === "home" ? `Ajax tegen ${match.opponent}` : `${match.opponent} tegen Ajax`}`;

export const announcementWebhook = () => {
  const value = process.env.DISCORD_MOTM_ANNOUNCEMENT_WEBHOOK?.trim();
  if (!value) throw new Error("DISCORD_MOTM_ANNOUNCEMENT_WEBHOOK ontbreekt");
  return value;
};

export type AnnouncementDeliveryStatus = "not_sent" | "sending" | "sent" | "failed" | "unknown";
export type AnnouncementResult =
  | { status: "sent" }
  | { status: "failed"; error: string }
  | { status: "unknown"; error: string };

export const sendAnnouncement = async (webhook: string, text: string, link: string) => {
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `@everyone\n${text}\n${link}`, allowed_mentions: { parse: ["everyone"] } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return { status: "sent" } as const;
    const error = `Discord webhook mislukt (${response.status})`;
    return response.status >= 500 ? { status: "unknown", error } : { status: "failed", error };
  } catch (error) {
    return { status: "unknown", error: error instanceof Error ? error.message : "Onbekende Discord-fout" } as const;
  }
};

export const sendAutomaticAnnouncement = async (requestUrl: string, now = new Date()) => {
  await synchronizeAllMatches(now);
  const [candidate] = await db()`SELECT * FROM motm_matches
    WHERE deleted_at IS NULL AND status='open'
      AND scheduled_open_at IS NOT NULL AND scheduled_open_at<=${now}
      AND scheduled_close_at IS NOT NULL AND scheduled_close_at>${now}
      AND announcement_sent_at IS NULL
    ORDER BY scheduled_open_at LIMIT 1`;
  if (!candidate) return { status: "no_open_match" as const };

  return deliverAnnouncement(candidate.id, announcementDefault(candidate as any), requestUrl, "system:auto-schedule", "Automatische mededeling", {
    trigger: "scheduled_open", scheduledOpenAt: candidate.scheduled_open_at,
  });
};

const staleSendingMs = 15 * 60_000;

export const deliverAnnouncement = async (
  matchId: string,
  text: string,
  requestUrl: string,
  actorId: string,
  actorName: string,
  auditData: Record<string, unknown> = {},
) => {
  const sql = db();
  const [match] = await sql`SELECT * FROM motm_matches WHERE id=${matchId} AND deleted_at IS NULL`;
  if (!match || match.status !== "open") return { status: "no_open_match" as const };
  const currentStatus: AnnouncementDeliveryStatus = match.announcement_status ?? (match.announcement_sent_at ? "sent" : "not_sent");
  if (currentStatus === "sent" || match.announcement_sent_at) return { status: "already_sent" as const };
  if (currentStatus === "unknown") return { status: "unknown" as const };
  if (currentStatus === "sending") {
    const attemptedAt = match.announcement_attempted_at ? new Date(match.announcement_attempted_at).getTime() : 0;
    if (Date.now() - attemptedAt < staleSendingMs) return { status: "in_progress" as const };
    await sql`UPDATE motm_matches SET announcement_status='unknown', announcement_error='Verzendpoging bleef hangen; controleer Discord handmatig.', revision=revision+1 WHERE id=${match.id} AND announcement_status='sending'`;
    return { status: "unknown" as const };
  }

  const [claimed] = await sql`UPDATE motm_matches SET announcement_status='sending', announcement_attempted_at=now(), announcement_error=NULL, revision=revision+1
    WHERE id=${match.id} AND deleted_at IS NULL AND status='open' AND announcement_sent_at IS NULL AND announcement_status IN ('not_sent','failed') RETURNING *`;
  if (!claimed) return { status: "in_progress" as const };

  const link = new URL(`/stem/${claimed.slug}`, requestUrl).href;
  const result = await sendAnnouncement(announcementWebhook(), text, link);
  if (result.status === "sent") {
    await sql.begin(async tx => {
      const [updated] = await tx`UPDATE motm_matches SET announcement_status='sent', announcement_sent_at=now(),
        announcement_sent_by_discord_user_id=${actorId}, announcement_error=NULL, revision=revision+1
        WHERE id=${claimed.id} AND announcement_status='sending' RETURNING id`;
      if (!updated) return;
      await tx`INSERT INTO motm_audit_log(match_id,actor_discord_user_id,actor_username_snapshot,action,before_data,after_data)
        VALUES(${claimed.id},${actorId},${actorName},'announcement_sent',NULL,${tx.json({ summary: "Discord-mededeling verstuurd", ...auditData })})`;
    });
    return { status: "sent" as const, matchId: String(claimed.id) };
  }

  const deliveryError = ("error" in result && result.error) || "Onbekende Discord-fout";
  await sql`UPDATE motm_matches SET announcement_status=${result.status}, announcement_error=${deliveryError}, revision=revision+1 WHERE id=${claimed.id} AND announcement_status='sending'`;
  return { status: result.status as "failed" | "unknown", error: deliveryError, matchId: String(claimed.id) };
};

export const markAnnouncementSent = async (matchId: string, actorId: string, actorName: string) => {
  const sql = db();
  return sql.begin(async tx => {
    const [updated] = await tx`UPDATE motm_matches SET announcement_status='sent', announcement_sent_at=COALESCE(announcement_sent_at,now()),
      announcement_sent_by_discord_user_id=${actorId}, announcement_error=NULL, revision=revision+1
      WHERE id=${matchId} AND deleted_at IS NULL AND announcement_status='unknown' RETURNING id`;
    if (!updated) return false;
    await tx`INSERT INTO motm_audit_log(match_id,actor_discord_user_id,actor_username_snapshot,action,before_data,after_data)
      VALUES(${matchId},${actorId},${actorName},'announcement_sent',NULL,${tx.json({ summary: "Onbekende Discord-status handmatig als verzonden gemarkeerd" })})`;
    return true;
  });
};

export const markAnnouncementRetryable = async (matchId: string, actorId: string, actorName: string) => {
  const sql = db();
  return sql.begin(async tx => {
    const [updated] = await tx`UPDATE motm_matches SET announcement_status='failed', announcement_error='Staff heeft gecontroleerd dat Discord de mededeling niet heeft geplaatst.', revision=revision+1
      WHERE id=${matchId} AND deleted_at IS NULL AND announcement_status='unknown' RETURNING id`;
    if (!updated) return false;
    await tx`INSERT INTO motm_audit_log(match_id,actor_discord_user_id,actor_username_snapshot,action,before_data,after_data)
      VALUES(${matchId},${actorId},${actorName},'announcement_retryable',NULL,${tx.json({ summary: "Onbekende Discord-status handmatig als niet verzonden bevestigd" })})`;
    return true;
  });
};
