// GET /api/account — 이 계정에 연결된 외부 계정 목록.
// POST /api/account — 구글 연동: { credential, action }
//   action 'link'   : 지금 게스트 계정에 구글 계정을 연결한다(이미 다른 계정에 연결돼 있으면 409 exists 와 그 계정 정보).
//   action 'switch' : 그 구글 계정에 연결된 기존 계정으로 전환한다(새 기기 로그인·계정 전환). 새 세션 비밀값을 돌려준다.
import { json, authenticate, allow, tooMany, clientKey, randomToken, sha256Hex } from '../_lib/util.js';
import { verifyGoogleIdToken, maskEmail } from '../_lib/google.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  let rows = [];
  try { rows = (await env.DB.prepare('SELECT provider, email_masked FROM identities WHERE user_id = ?1').bind(user.id).all()).results || []; } catch (_) {}
  return json({ identities: rows.map(row => ({ provider: row.provider, email: row.email_masked || '' })) });
}

// DELETE /api/account — 계정 삭제: 이 계정의 저장·연결된 외부 계정·세션·계정 자체를 지운다. 본문 { confirm: 'delete' } 가 있어야 한다.
// 같은 이용자의 다른 기기 세션도 함께 사라진다. 지운 뒤에는 되돌릴 수 없다.
export async function onRequestDelete({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `delete:${user.id}`, 5, 3600000))) return tooMany();
  const body = await request.json().catch(() => null);
  if (body?.confirm !== 'delete') return json({ error: 'confirm-required' }, 400);
  // 자식 표부터 지우고 계정 행을 마지막에 지운다(중간에 실패하면 다시 시도할 수 있다).
  for (const sql of [
    'DELETE FROM saves WHERE user_id = ?1',
    'DELETE FROM grants WHERE user_id = ?1',
    'DELETE FROM identities WHERE user_id = ?1',
    'DELETE FROM sessions WHERE user_id = ?1'
  ]) {
    try { await env.DB.prepare(sql).bind(user.id).run(); } catch (_) { /* 표가 아직 없으면 건너뛴다 */ }
  }
  try { await env.DB.prepare('DELETE FROM rate_limits WHERE bucket IN (?1, ?2, ?3)').bind(`load:${user.id}`, `save:${user.id}`, `delete:${user.id}`).run(); } catch (_) {}
  await env.DB.prepare('DELETE FROM users WHERE id = ?1').bind(user.id).run();
  return json({ status: 'deleted' });
}

export async function onRequestPost({ request, env, verifyOptions }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  if (!env.GOOGLE_CLIENT_ID) return json({ error: 'google-not-configured' }, 503);
  if (!(await allow(env, `account:${await clientKey(request, env)}`, 30, 3600000))) return tooMany();
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'bad-json' }, 400); }
  const action = body?.action;
  if (!['link', 'switch'].includes(action)) return json({ error: 'bad-request' }, 400);
  const google = await verifyGoogleIdToken(body.credential, { clientId: env.GOOGLE_CLIENT_ID, ...(verifyOptions || {}) });
  if (!google || !google.emailVerified) return json({ error: 'invalid-token' }, 401);
  const email = maskEmail(google.email);
  const existing = await env.DB.prepare('SELECT user_id FROM identities WHERE provider = ?1 AND subject = ?2').bind('google', google.subject).first();

  if (action === 'link') {
    const user = await authenticate(request, env);
    if (!user) return json({ error: 'unauthorized' }, 401);
    if (existing && existing.user_id === user.id) return json({ status: 'already', email });
    if (existing) {
      const save = await env.DB.prepare('SELECT revision, updated_at FROM saves WHERE user_id = ?1').bind(existing.user_id).first();
      return json({ status: 'exists', email, hasSave: !!save, updatedAt: save?.updated_at || null }, 409);
    }
    // 한 계정에는 구글 계정 하나만 연결한다.
    const already = await env.DB.prepare('SELECT subject FROM identities WHERE provider = ?1 AND user_id = ?2').bind('google', user.id).first();
    if (already) return json({ error: 'already-linked-other' }, 409);
    await env.DB.prepare('INSERT INTO identities (provider, subject, user_id, email_masked, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind('google', google.subject, user.id, email, Date.now()).run();
    return json({ status: 'linked', email });
  }

  // switch: 연결된 기존 계정이 있어야 한다.
  if (!existing) return json({ error: 'no-account' }, 404);
  const secret = randomToken(32);
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?1, ?2, ?3)').bind(await sha256Hex(secret), existing.user_id, Date.now()).run();
  return json({ status: 'switched', id: existing.user_id, secret, email });
}
