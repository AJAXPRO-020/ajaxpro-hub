import { createHmac, timingSafeEqual } from 'node:crypto';

const signedTarget = 'GET\n/api/press-conferences?action=check';
const maxAgeSeconds = 300;

export const verifyPressSchedulerRequest = (
  request: Request,
  nowSeconds = Math.floor(Date.now() / 1000),
  secret = process.env.PRESS_SCHEDULER_SECRET,
) => {
  if (!secret || secret.length < 32) return false;
  const timestamp = request.headers.get('x-ajaxpro-timestamp') ?? '';
  const signature = request.headers.get('x-ajaxpro-signature') ?? '';
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > maxAgeSeconds) return false;
  const url = new URL(request.url);
  const direct = url.pathname === '/api/press-conferences' && url.search === '?action=check';
  const rewritten = url.pathname === '/api/club-tools' && url.searchParams.get('view') === 'press-conferences'
    && url.searchParams.get('action') === 'check' && [...url.searchParams.keys()].length === 2;
  if (request.method !== 'GET' || (!direct && !rewritten)) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}\n${signedTarget}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
};
