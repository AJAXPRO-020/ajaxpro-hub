import { runPressConferenceCheck } from './press-conference-monitor';
import { listCurrent, logCheck, productionQuery } from './press-conference-store';
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
    try {
      const result = await runPressConferenceCheck(false, new Date(), productionQuery, true);
      await logCheck(productionQuery, 'scheduler', 'ok', 'cloudflare-cron', result.count);
      return json(result);
    } catch (error) {
      await logCheck(productionQuery, 'scheduler', 'error', String(error).slice(0, 300));
      throw error;
    }
  }
  if (url.searchParams.get('action') === 'staff') {
    return json({allowed:Boolean(await getSessionWithPermission(request, permissions.staffAccess))});
  }
  try {
    return publicJson(await listCurrent(productionQuery));
  } catch (error) { console.error('Press conferences unavailable',error); return json({ items: [], checkedAt: null, unavailable: true }); }
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error:'Forbidden' },403);
  if (!await getSessionWithPermission(request, permissions.staffAccess)) return json({ error:'Forbidden' },403);
  if (new URL(request.url).searchParams.get('action') === 'test-discord') {
    const publication = await publishDiscord({
      idempotencyKey: 'press-conference-test:2026-11-15:everyone',
      sourceType: 'press-conference-test',
      sourceId: 'ajaxpro-everyone-test-2026-11-15',
      text: '@everyone\n\n[TEST] Persconferentie Ajax gepland\n\nDit is een test van de automatische persconferentiemeldingen van AjaxPro.\n\nWedstrijd: Ajax - Test FC\nDatum: fictieve testdatum\nTijd: 14.00 uur\nTe volgen via: ESPN (test)\n\nDit is geen echte persconferentie. Er vindt geen uitzending plaats.',
      allowedMentions: { parse: ['everyone'] },
      actorDiscordUserId: 'system:press-conference-test',
    });
    return json({ publication });
  }
  return json(await runPressConferenceCheck(true));
}
