const endpoint = 'https://ajaxpro.fans/api/press-conferences?action=check';
const signedTarget = 'GET\n/api/press-conferences?action=check';

export default {
  async scheduled(_controller, env) {
    if (!env.PRESS_SCHEDULER_SECRET || env.PRESS_SCHEDULER_SECRET.length < 32) throw new Error('Scheduler secret is missing');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.PRESS_SCHEDULER_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}\n${signedTarget}`)));
    const signature = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const response = await fetch(endpoint, { headers: { 'x-ajaxpro-timestamp': timestamp, 'x-ajaxpro-signature': signature }, signal: AbortSignal.timeout(90_000) });
    if (!response.ok) throw new Error(`AjaxPro monitor HTTP ${response.status}`);
    const result = await response.json();
    if (result.status === 'error') throw new Error('AjaxPro monitor reported a storage error');
  },
  fetch() { return new Response('Not found', { status: 404 }); },
};
