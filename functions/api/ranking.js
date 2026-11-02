// GET /api/ranking?category=total — 순위표(상위 50명)와 내 순위. 아레나 순위는 /api/arena 가 돌려준다.
import { json, authenticate, allow, tooMany } from '../_lib/util.js';
import { notReady, isMissingTable } from '../_lib/players.js';

const COLUMNS = { total: 'power_total', dreadnought: 'power_dreadnought', battlecruiser: 'power_battlecruiser', destroyer: 'power_destroyer', frigate: 'power_frigate' };
const LIMIT = 50;

async function playerBoard(env, userId, column) {
  const rows = (await env.DB.prepare(`SELECT public_id, name, ${column} AS value FROM players WHERE ${column} > 0 ORDER BY ${column} DESC, updated_at ASC LIMIT ?1`).bind(LIMIT).all()).results || [];
  const mine = await env.DB.prepare(`SELECT public_id, name, ${column} AS value FROM players WHERE user_id = ?1`).bind(userId).first();
  let rank = null;
  if (mine?.value > 0) rank = 1 + Number((await env.DB.prepare(`SELECT COUNT(*) AS n FROM players WHERE ${column} > ?1`).bind(mine.value).first()).n);
  return { leaders: rows.map(row => ({ id: row.public_id, name: row.name, value: row.value })), me: mine ? { id: mine.public_id, name: mine.name, value: mine.value, rank } : null };
}

// 연합 순위: 연합원 총전투력의 합.
async function unionBoard(env, userId) {
  const rows = (await env.DB.prepare(`SELECT u.id, u.name, SUM(p.power_total) AS value FROM unions u JOIN union_members m ON m.union_id = u.id JOIN players p ON p.user_id = m.user_id GROUP BY u.id HAVING value > 0 ORDER BY value DESC, u.created_at ASC LIMIT ?1`).bind(LIMIT).all()).results || [];
  const member = await env.DB.prepare('SELECT union_id FROM union_members WHERE user_id = ?1').bind(userId).first();
  let me = null;
  if (member) {
    const mine = await env.DB.prepare('SELECT u.id, u.name, COALESCE(SUM(p.power_total), 0) AS value FROM unions u JOIN union_members m ON m.union_id = u.id JOIN players p ON p.user_id = m.user_id WHERE u.id = ?1 GROUP BY u.id').bind(member.union_id).first();
    if (mine) {
      const above = await env.DB.prepare('SELECT COUNT(*) AS n FROM (SELECT m.union_id FROM union_members m JOIN players p ON p.user_id = m.user_id GROUP BY m.union_id HAVING SUM(p.power_total) > ?1)').bind(mine.value).first();
      me = { id: mine.id, name: mine.name, value: mine.value, rank: mine.value > 0 ? 1 + Number(above.n) : null };
    }
  }
  return { leaders: rows.map(row => ({ id: row.id, name: row.name, value: row.value })), me };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `ranking:${user.id}`, 300, 3600000))) return tooMany();
  const category = new URL(request.url).searchParams.get('category') || 'total';
  try {
    if (category === 'alliance') return json({ category, ...(await unionBoard(env, user.id)) });
    const column = COLUMNS[category];
    if (!column) return json({ error: 'bad-category' }, 400);
    return json({ category, ...(await playerBoard(env, user.id, column)) });
  } catch (error) {
    if (isMissingTable(error)) return notReady();
    throw error;
  }
}
