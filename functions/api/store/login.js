// POST /api/store/login — 홈페이지 상점(timeswitch.co.kr/store.html)의 구글 로그인 확인: { credential }
// 구글 ID 토큰을 검증하고, 그 구글 계정이 게임 계정에 연결돼 있으면 상품을 받을 계정을 알려 준다.
// 게임 계정에 연결되지 않은 구글 계정이면 404 not-linked(게임 설정 > 계정 연동에서 먼저 연결해야 한다).
// 세션은 만들지 않는다. 결제(주문 생성)도 같은 구글 토큰을 다시 검증해 계정을 확인한다.
import { json, allow, tooMany, clientKey, withHomeCors as withCors } from '../../_lib/util.js';
import { verifyGoogleIdToken, maskEmail } from '../../_lib/google.js';

export function onRequestOptions({ request }) {
  const response = new Response(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Access-Control-Max-Age', '86400');
  return withCors(response, request);
}

export async function onRequestPost({ request, env, verifyOptions }) {
  const reply = (body, status) => withCors(json(body, status), request);
  if (!env.DB) return reply({ error: 'db-unavailable' }, 503);
  if (!env.GOOGLE_CLIENT_ID) return reply({ error: 'google-not-configured' }, 503);
  if (!(await allow(env, `store:${await clientKey(request, env)}`, 30, 3600000))) return withCors(tooMany(), request);
  let body;
  try { body = await request.json(); } catch (_) { return reply({ error: 'bad-json' }, 400); }
  const google = await verifyGoogleIdToken(body?.credential, { clientId: env.GOOGLE_CLIENT_ID, ...(verifyOptions || {}) });
  if (!google || !google.emailVerified) return reply({ error: 'invalid-token' }, 401);
  const email = maskEmail(google.email);
  const linked = await env.DB.prepare('SELECT user_id FROM identities WHERE provider = ?1 AND subject = ?2').bind('google', google.subject).first();
  if (!linked) return reply({ error: 'not-linked', email }, 404);
  // 계정 번호 전체는 화면에 띄우지 않고 끝 4자리만 보여 준다(게임 설정 > 정보의 번호와 맞춰 볼 수 있게).
  return reply({ status: 'ok', email, account: String(linked.user_id).slice(-4) });
}
