// GET  /api/grants — 이 계정에 아직 전달되지 않은 지급 목록(웹 상점 구매, 운영자 보상).
// POST /api/grants — 전달 확인: { ids: [...] }. 게임이 우편함에 넣고 그 우편이 클라우드 저장에 올라간 뒤에 부른다.
// 확인 전에는 몇 번이고 다시 내려가며, 게임 우편함은 같은 id 를 두 번 넣지 않는다.
import { json, authenticate, allow, tooMany } from '../_lib/util.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `grants:${user.id}`, 200, 3600000))) return tooMany();
  let rows = [];
  try {
    rows = (await env.DB.prepare('SELECT id, order_id, title, body, items, created_at FROM grants WHERE user_id = ?1 AND delivered_at IS NULL AND revoked_at IS NULL ORDER BY created_at LIMIT 50').bind(user.id).all()).results || [];
  } catch (_) { return json({ grants: [] }); }   // 표(마이그레이션 0004)가 아직 없으면 빈 목록
  // 보낸 곳: 결제 주문이면 웹 상점, 아니면 운영팀 보상.
  return json({ grants: rows.map(row => ({ id: row.id, sender: row.order_id ? '공식 웹 상점' : 'TimesWitch 운영팀', title: row.title, body: row.body, items: JSON.parse(row.items), createdAt: row.created_at })) });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `grants-ack:${user.id}`, 60, 3600000))) return tooMany();
  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter(id => typeof id === 'string' && /^[0-9a-f]{24}$/.test(id)).slice(0, 50) : [];
  if (!ids.length) return json({ error: 'bad-request' }, 400);
  let delivered = 0;
  const now = Date.now();
  for (const id of ids) {
    const result = await env.DB.prepare('UPDATE grants SET delivered_at = ?1 WHERE id = ?2 AND user_id = ?3 AND delivered_at IS NULL').bind(now, id, user.id).run();
    delivered += Number(result?.meta?.changes) || 0;
  }
  return json({ status: 'ok', delivered });
}
