import { runPressConferenceCheck } from './press-conference-monitor';
import { listCurrent, productionQuery } from './press-conference-store';
import { getSessionWithPermission } from './server-permissions';
import { permissions } from './permissions.config';
import { verifyPressSchedulerRequest } from './press-scheduler-auth';
import { publishDiscord } from './discord-publisher';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const publicJson = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('action') === 'check') {
    if (!verifyPressSchedulerRequest(request)) return json({ error: 'Unauthorized' }, 401);
    // The authenticated hourly scheduler is the early-warning path. It must
    // not wait for the editorial hour windows; source caching and the recent
    // check guard still prevent unnecessary repeat work.
    return json(await runPressConferenceCheck(true));
  }
  if (url.searchParams.get('action') === 'staff') return json({ allowed: Boolean(await getSessionWithPermission(request, permissions.staffAccess)) });
  try {
    return publicJson(await listCurrent(productionQuery));
  } catch (error) { console.error('Press conferences unavailable',error); return json({ items: [], checkedAt: null, unavailable: true }); }
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error:'Forbidden' },403);
  if (!await getSessionWithPermission(request, permissions.staffAccess)) return json({ error:'Forbidden' },403);
  if (new URL(request.url).searchParams.get('action') === 'test-discord') {
    return json(await publishDiscord({
      idempotencyKey:'press-conference:discord-test-button',
      sourceType:'press-conference-discord-test',
      sourceId:'press-conference-discord-test',
      text:'@everyone\n[TEST] Nieuwe persconferentie: Ajax - Test FC\n15 november 2026 om 14:00 uur\nAjax.nl (gesimuleerd): https://www.ajax.nl/',
      allowedMentions:{parse:['everyone']},
      actorDiscordUserId:'staff:press-conference-test',
    }));
  }
  return json(await runPressConferenceCheck(true));
}
