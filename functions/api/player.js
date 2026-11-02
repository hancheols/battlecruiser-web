// GET  /api/player — 서버 기능 준비 여부와 내 공개 프로필. 503 not-ready 면 게임은 기기 저장 모드로 동작한다.
// POST /api/player — 함장 이름과 전투력 보고: { name, powers: { total, dreadnought, battlecruiser, destroyer, frigate } }
import { json, authenticate, allow, tooMany } from '../_lib/util.js';
import { ensurePlayer, notReady, isMissingTable } from '../_lib/players.js';

// 전투력 상한: 보고값이 이보다 크면 조작으로 보고 상한까지만 받는다. 함선 최고 능력치를 기준으로 넉넉하게 잡은 값이다.
export const MAX_POWER = { total: 1200000, dreadnought: 300000, battlecruiser: 300000, destroyer: 300000, frigate: 300000 };
const cleanPower = (value, max) => { const number = Math.floor(Number(value)); return Number.isFinite(number) && number > 0 ? Math.min(number, max) : 0; };

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  try {
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
    if (body.powers && typeof body.powers === 'object') {
      const powers = Object.fromEntries(Object.entries(MAX_POWER).map(([key, max]) => [key, cleanPower(body.powers[key], max)]));
      await env.DB.prepare('UPDATE players SET power_total = ?1, power_dreadnought = ?2, power_battlecruiser = ?3, power_destroyer = ?4, power_frigate = ?5, updated_at = ?6 WHERE user_id = ?7')
        .bind(powers.total, powers.dreadnought, powers.battlecruiser, powers.destroyer, powers.frigate, Date.now(), user.id).run();
    }
    return json({ status: 'ok', player: { publicId: player.public_id, name: player.name } });
  } catch (error) {
    if (isMissingTable(error)) return notReady();
    throw error;
  }
}
