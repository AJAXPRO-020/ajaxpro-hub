import { runPressConferenceCheck } from './press-conference-monitor';
import { listCurrent, productionQuery } from './press-conference-store';
import { getSessionWithPermission } from './server-permissions';
import { permissions } from './permissions.config';
import { verifyPressSchedulerRequest } from './press-scheduler-auth';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const publicJson = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('action') === 'check') {
    if (!verifyPressSchedulerRequest(request)) return json({ error: 'Unauthorized' }, 401);
    return json(await runPressConferenceCheck());
  }
  if (url.searchParams.get('action') === 'staff') return json({ allowed: Boolean(await getSessionWithPermission(request, permissions.staffAccess)) });
  try {
    return publicJson(await listCurrent(productionQuery));
  } catch (error) { console.error('Press conferences unavailable',error); return json({ items: [], checkedAt: null, unavailable: true }); }
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error:'Forbidden' },403);
  if (!await getSessionWithPermission(request, permissions.staffAccess)) return json({ error:'Forbidden' },403);
  return json(await runPressConferenceCheck(true));
}
