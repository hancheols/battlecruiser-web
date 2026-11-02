// GET  /api/player — 서버 기능 준비 여부와 내 공개 프로필. 503 not-ready 면 게임은 기기 저장 모드로 동작한다.
// POST /api/player — 함장 이름과 함종별 최고 함선 보고: { name, fleet: { dreadnought, battlecruiser, destroyer } }
//   함선 하나는 { name, rarity, stars, dev } 이다(dev 는 그 함선 무기의 개발 레벨). 잘못된 함선은 없는 것으로 친다.
import { json, authenticate, allow, tooMany } from '../_lib/util.js';
import { ensurePlayer, touchPlayer, notReady, isMissingTable } from '../_lib/players.js';
import { saveFleet } from '../_lib/ranking.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  try {
    // rank_entries 까지 확인해 마이그레이션 0005·0006 이 모두 적용됐을 때만 서버 모드로 넘어간다.
    await env.DB.prepare('SELECT 1 FROM rank_entries LIMIT 1').bind().first();
    const row = await env.DB.prepare('SELECT public_id, name FROM players WHERE user_id = ?1').bind(user.id).first();
    return json({ ready: true, player: row ? { publicId: row.public_id, name: row.name } : null });
  } catch (error) {
    if (isMissingTable(error)) return notReady();
    throw error;
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `player:${user.id}`, 60, 3600000))) return tooMany();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'bad-json' }, 400);
  try {
    const player = await ensurePlayer(env, user.id, body.name);
    await touchPlayer(env, player);
    if (body.fleet && typeof body.fleet === 'object') await saveFleet(env, user.id, body.fleet);
    return json({ status: 'ok', player: { publicId: player.public_id, name: player.name } });
  } catch (error) {
    if (isMissingTable(error)) return notReady();
    throw error;
  }
}
