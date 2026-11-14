import { db } from "./motm-db";
import { statusAt, type SchedulableMatch } from "./motm-rules";
import { resultsFor } from "./motm-db";
import { publishMotmWinner } from "./automatic-discord-publications";

export const publishClosedMotmMatch = async (match: any) => {
  const [winner] = (await resultsFor(match.id)).filter(row => row.rank === 1);
  if (!winner) return { status: 'skipped' as const };
  const [player] = await db()`SELECT shirt_number_snapshot FROM motm_match_players WHERE match_id=${match.id} AND player_id=${winner.player_id}`;
  return publishMotmWinner(match, winner, player);
};

export const synchronizeMatch = async <T extends SchedulableMatch & { id: string }>(match: T, now = new Date()): Promise<T> => {
  if ((match as T & { deleted_at?: Date | string | null }).deleted_at) return match;
  const status = statusAt(match, now);
  if (status === match.status) return match;
  const sql=db();
  const updated=await sql.begin(async tx=>{
    const [row]=await tx`UPDATE motm_matches SET status=${status},revision=revision+1,
      opened_at=CASE WHEN ${status}='open' THEN COALESCE(opened_at,${now}) WHEN ${status}='closed' THEN COALESCE(opened_at,scheduled_open_at,${now}) ELSE opened_at END,
      closed_at=CASE WHEN ${status}='closed' THEN COALESCE(closed_at,${now}) ELSE closed_at END
      WHERE id=${match.id} AND status=${match.status} AND deleted_at IS NULL RETURNING *`;
    if(row)await tx`INSERT INTO motm_audit_log(match_id,actor_discord_user_id,actor_username_snapshot,action,before_data,after_data) VALUES(${match.id},'system','Automatische planning','status_synchronized',${tx.json({status:match.status})},${tx.json({status,summary:status==='closed'?'Automatisch gesloten':'Automatisch geopend'})})`;
    return row;
  });
  const result=(updated ?? { ...match, status }) as T;
  if (updated && status === 'closed') {
    try {
      await publishClosedMotmMatch(result);
    } catch (error) { console.error('MOTM-winnaar publiceren mislukt', { matchId: match.id, error }); }
  }
  return result;
};

export const synchronizeAllMatches = async (now = new Date()) => {
  const matches = await db()`SELECT * FROM motm_matches WHERE deleted_at IS NULL AND status <> 'closed' AND
    ((status='draft' AND scheduled_open_at IS NOT NULL AND scheduled_open_at<=${now}) OR
     (scheduled_close_at IS NOT NULL AND scheduled_close_at<=${now}))`;
  for (const match of matches) await synchronizeMatch(match as any, now);
};
