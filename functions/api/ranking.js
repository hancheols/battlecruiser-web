// GET /api/ranking?category=total — 순위표(상위 50명), 내 순위, 시즌 정보, 그 분야의 시즌 보상표. 아레나 순위는 /api/arena 가 돌려준다.
// 함종·종합은 함선 등급(희귀도 + 성급) → 무기 개발 레벨 순, 연합은 최근 14일 안에 접속한 연합원의 함선 등급 합으로 정한다.
import { json, authenticate, allow, tooMany } from '../_lib/util.js';
import { notReady, isMissingTable } from '../_lib/players.js';
import { SHIP_CATEGORIES, isLinked } from '../_lib/ranking.js';
import { rollSeason, seasonView, rewardTable, ACTIVE_DAYS } from '../_lib/seasons.js';

const LIMIT = 50;
const CACHE_MS = 300000;
// 전체 인원과 연합 집계는 표 전체를 읽으므로 잠깐 기억해 둔다(서버 인스턴스마다, 값이 조금 늦어도 괜찮은 항목만).
const memo = new Map();
async function remembered(env, key, load) {
  const ttl = env.RANK_CACHE_MS ?? CACHE_MS;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = await load();
  memo.set(key, { at: Date.now(), value });
  return value;
}

async function shipBoard(env, userId, category) {
  const rows = (await env.DB.prepare('SELECT p.public_id, p.name, r.detail FROM rank_entries r JOIN players p ON p.user_id = r.user_id WHERE r.category = ?1 ORDER BY r.rank_key DESC, r.reached_at ASC LIMIT ?2').bind(category, LIMIT).all()).results || [];
  const player = await env.DB.prepare('SELECT public_id, name FROM players WHERE user_id = ?1').bind(userId).first();
  const mine = await env.DB.prepare('SELECT rank_key, reached_at, detail FROM rank_entries WHERE user_id = ?1 AND category = ?2').bind(userId, category).first();
  let rank = null, percent = null;
  if (mine) {
    const above = await env.DB.prepare('SELECT COUNT(*) AS n FROM rank_entries WHERE category = ?1 AND (rank_key > ?2 OR (rank_key = ?2 AND reached_at < ?3))').bind(category, mine.rank_key, mine.reached_at).first();
    rank = 1 + Number(above.n);
    const total = await remembered(env, `count:${category}`, async () => Number((await env.DB.prepare('SELECT COUNT(*) AS n FROM rank_entries WHERE category = ?1').bind(category).first()).n));
    percent = Math.min(100, Math.max(1, Math.ceil(rank / Math.max(total, rank) * 100)));
  }
  return {
    leaders: rows.map(row => ({ id: row.public_id, name: row.name, entry: JSON.parse(row.detail) })),
    me: player ? { id: player.public_id, name: player.name, entry: mine ? JSON.parse(mine.detail) : null, rank, percent } : null
  };
}

async function unionBoard(env, userId) {
  const board = await remembered(env, 'unions', async () => (await env.DB.prepare(
    `SELECT u.id, u.name, SUM(r.grade) AS value, COUNT(*) AS active FROM union_members m
     JOIN unions u ON u.id = m.union_id
     JOIN players p ON p.user_id = m.user_id
     JOIN rank_entries r ON r.user_id = m.user_id AND r.category = 'total'
     WHERE p.last_seen >= ?1 GROUP BY u.id ORDER BY value DESC, u.created_at ASC`
  ).bind(Date.now() - ACTIVE_DAYS * 86400000).all()).results || []);
  const view = (row, index) => ({ id: row.id, name: row.name, entry: { value: row.value, active: row.active }, rank: index + 1 });
  const member = await env.DB.prepare('SELECT m.union_id, u.name FROM union_members m JOIN unions u ON u.id = m.union_id WHERE m.user_id = ?1').bind(userId).first();
  let me = null;
  if (member) {
    const index = board.findIndex(row => row.id === member.union_id);
    me = index >= 0
      ? { ...view(board[index], index), percent: Math.min(100, Math.max(1, Math.ceil((index + 1) / board.length * 100))) }
      : { id: member.union_id, name: member.name, entry: null, rank: null, percent: null };
  }
  return { leaders: board.slice(0, LIMIT).map(view), me };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `ranking:${user.id}`, 300, 3600000))) return tooMany();
  const category = new URL(request.url).searchParams.get('category') || 'total';
  try {
    if (category !== 'alliance' && category !== 'total' && !SHIP_CATEGORIES.includes(category)) return json({ error: 'bad-category' }, 400);
    const season = seasonView(await rollSeason(env));
    const board = category === 'alliance' ? await unionBoard(env, user.id) : await shipBoard(env, user.id, category);
    return json({ category, season, rewards: rewardTable(category), linked: await isLinked(env, user.id), ...board });
  } catch (error) {
    if (isMissingTable(error)) return notReady();
    throw error;
  }
}
