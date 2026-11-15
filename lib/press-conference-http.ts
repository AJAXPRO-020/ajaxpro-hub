import { runPressConferenceCheck } from './press-conference-monitor';
import { listCurrent, loadFixtures, productionQuery, saveCandidates } from './press-conference-store';
import { manualEspnCandidate } from './press-conferences';
import { publishPressConference } from './automatic-discord-publications';
import { getSessionWithPermission } from './server-permissions';
import { permissions } from './permissions.config';
import { verifyPressSchedulerRequest } from './press-scheduler-auth';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const publicJson = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('action') === 'check') {
    if (!verifyPressSchedulerRequest(request)) return json({ error: 'Unauthorized' }, 401);
    return json(await runPressConferenceCheck(false, new Date(), productionQuery, true));
  }
  if (url.searchParams.get('action') === 'staff') {
    if (!await getSessionWithPermission(request, permissions.staffAccess)) return json({ allowed:false });
    const now = new Date();
    const fixtures = (await loadFixtures(productionQuery,now)).filter(row => {
      const kickoff = new Date(row.kickoff_at).getTime();
      return kickoff >= now.getTime()-86400000 && kickoff <= now.getTime()+8*86400000;
    });
    return json({allowed:true,fixtures});
  }
  try {
    return publicJson(await listCurrent(productionQuery));
  } catch (error) { console.error('Press conferences unavailable',error); return json({ items: [], checkedAt: null, unavailable: true }); }
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error:'Forbidden' },403);
  if (!await getSessionWithPermission(request, permissions.staffAccess)) return json({ error:'Forbidden' },403);
  if (new URL(request.url).searchParams.get('action') === 'add') {
    try {
      const raw = await request.text();
      if (raw.length > 2048) return json({error:'De invoer is te lang.'},413);
      const input = JSON.parse(raw) as Record<string,unknown>;
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RangeError('Ongeldige invoer.');
      const now = new Date();
      const fixtures = await loadFixtures(productionQuery,now);
      const candidate = manualEspnCandidate(input,fixtures,now);
      const publishable = await saveCandidates(productionQuery,[candidate],now);
      const fixture = fixtures.find(row => row.fixture_key === candidate.fixtureKey)!;
      const publication = await publishPressConference(candidate,fixture,now);
      return json({status:publishable.length ? 'added' : 'existing',publication});
    } catch(error) {
      if (error instanceof RangeError || error instanceof SyntaxError) return json({error:error.message},400);
      console.error('Manual ESPN press conference failed',error instanceof Error?error.name:'unknown');
      return json({error:'Opslaan of publiceren is mislukt. Controleer de persconferentie en de Discord-status.'},503);
    }
  }
  return json(await runPressConferenceCheck(true));
}
