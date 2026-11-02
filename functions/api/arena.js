// GET  /api/arena — 내 아레나 상태와 순위표. 하루가 바뀌었으면 보상 정산도 여기서 한다.
// POST /api/arena — { action, ... }
//   sync    : 방어 함대 등록(defense), 게임 저장에 남은 등급 보상 기록 이관(claimed)
//   preview : 상대 찾기(취소하기 전까지 같은 상대) / cancelPreview : 상대 찾기 취소
//   start   : 대전 시작(입장 횟수 차감, 대전 번호 발급) / cancel : 전투 시작 전 취소(횟수 복구)
//   result  : 결과 보고 { matchId, outcome: true|false|null, forfeited }. 같은 대전을 다시 보내도 한 번만 반영한다.
//   profile : 다른 함장 정보 { id }
import { json, authenticate, allow, tooMany } from '../_lib/util.js';
import { ensurePlayer, touchPlayer, notReady, fail, isMissingTable } from '../_lib/players.js';
import { loadArena, settle, closePending, findOpponent, finishMatch, newMatch, cleanDeck, deckPower, FREE_PER_DAY, MATCHES_PER_DAY } from '../_lib/arena.js';
import { day, DAY, claimedTierIndex } from '../_lib/arena-rules.js';

const LIMIT = 50;

async function view(env, user, player, row) {
  const top = (await env.DB.prepare('SELECT p.public_id, p.name, a.score FROM arena_players a JOIN players p ON p.user_id = a.user_id WHERE a.defense_power > 0 ORDER BY a.score DESC, a.updated_at ASC LIMIT ?1').bind(LIMIT).all()).results || [];
  const above = await env.DB.prepare('SELECT COUNT(*) AS n FROM arena_players WHERE defense_power > 0 AND score > ?1').bind(row.score).first();
  const defenses = (await env.DB.prepare('SELECT m.finished_at, m.outcome, m.delta, p.name FROM arena_matches m JOIN players p ON p.user_id = m.user_id WHERE m.enemy_user_id = ?1 AND m.finished_at IS NOT NULL ORDER BY m.finished_at DESC LIMIT 10').bind(user.id).all()).results || [];
  return {
    me: { id: player.public_id, name: player.name, score: row.score, wins: row.wins, losses: row.losses, draws: row.draws, freeUsed: row.free_used, rank: 1 + Number(above.n), defenseSet: row.defense_power > 0, pendingMatch: row.pending_match },
    top: top.map(item => ({ id: item.public_id, name: item.name, score: item.score })),
    // 방어 기록: 상대가 이기면(outcome 1) 내가 진 것이다. 점수 변화는 상대 점수의 반대다.
    defenses: defenses.map(item => ({ at: item.finished_at, attacker: item.name, win: item.outcome === null ? null : item.outcome === 0, delta: -item.delta })),
    freePerDay: FREE_PER_DAY
  };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `arena:${user.id}`, 600, 3600000))) return tooMany();
  try {
    const player = await ensurePlayer(env, user.id);
    await touchPlayer(env, player);
    const row = await settle(env, await loadArena(env, user.id));
    return json(await view(env, user, player, row));
  } catch (error) {
    if (isMissingTable(error)) return notReady();
    throw error;
  }
}

const previewOut = preview => ({ enemy: preview.enemy ? { id: preview.enemy.publicId, name: preview.enemy.name, score: preview.enemy.score, deck: preview.enemy.deck } : null });

const ACTIONS = {
  async sync({ env, user, body, player }) {
    const row = await loadArena(env, user.id);
    const now = Date.now();
    if (body.defense !== undefined) {
      const deck = cleanDeck(body.defense);
      if (!deck) return fail('방어 함대 정보가 올바르지 않습니다.', 400, 'bad-deck');
      await env.DB.prepare('UPDATE arena_players SET defense = ?1, defense_power = ?2, updated_at = ?3 WHERE user_id = ?4').bind(JSON.stringify(deck), deckPower(deck), now, user.id).run();
    }
    // 서버로 옮기기 전에 받은 등급 축전을 다시 받지 않게 한다. 대전을 시작한 뒤에는 받지 않는다.
    if (Array.isArray(body.claimed) && !(row.wins + row.losses + row.draws)) {
      const best = claimedTierIndex(body.claimed.slice(0, 60));
      if (best > row.best_tier) await env.DB.prepare('UPDATE arena_players SET best_tier = ?1 WHERE user_id = ?2').bind(best, user.id).run();
    }
    const fresh = await settle(env, await loadArena(env, user.id));
    return json(await view(env, user, player, fresh));
  },

  async preview({ env, user }) {
    const row = await loadArena(env, user.id);
    if (!(row.defense_power > 0)) return fail('방어 함대를 먼저 등록해주세요.', 409, 'no-defense');
    if (row.preview) return json(previewOut(JSON.parse(row.preview)));
    const preview = { enemy: await findOpponent(env, row) };
    await env.DB.prepare('UPDATE arena_players SET preview = ?1 WHERE user_id = ?2').bind(JSON.stringify(preview), user.id).run();
    return json(previewOut(preview));
  },

  async cancelPreview({ env, user }) {
    await env.DB.prepare('UPDATE arena_players SET preview = NULL WHERE user_id = ?1').bind(user.id).run();
    return json({ status: 'ok' });
  },

  async start({ env, user, body, player }) {
    let row = await settle(env, await closePending(env, await loadArena(env, user.id)));
    if (!(row.defense_power > 0)) return fail('방어 함대를 먼저 등록해주세요.', 409, 'no-defense');
    const now = Date.now();
    const dayStart = day(now) * DAY - 9 * 3600000;
    const played = await env.DB.prepare('SELECT COUNT(*) AS n FROM arena_matches WHERE user_id = ?1 AND created_at >= ?2').bind(user.id, dayStart).first();
    if (Number(played.n) >= MATCHES_PER_DAY) return fail('오늘 대전 횟수를 모두 사용했습니다.', 429, 'daily-cap');
    const free = row.free_used < FREE_PER_DAY;
    if (!free && body.ticket !== true) return fail('무료 대전을 모두 사용했습니다. 상점에서 아레나 티켓을 구매해주세요.', 409, 'no-entries');
    const preview = row.preview ? JSON.parse(row.preview) : { enemy: await findOpponent(env, row) };
    const match = newMatch(env, row, preview, !free, now);
    await match.statement.run();
    await env.DB.prepare('UPDATE arena_players SET free_used = free_used + ?1, preview = NULL, pending_match = ?2, updated_at = ?3 WHERE user_id = ?4').bind(free ? 1 : 0, match.id, now, user.id).run();
    row = await loadArena(env, user.id);
    return json({ matchId: match.id, ticketUsed: !free, scoreBefore: row.score, enemyScore: preview.enemy ? preview.enemy.score : row.score, state: await view(env, user, player, row) });
  },

  async cancel({ env, user, body, player }) {
    const match = typeof body.matchId === 'string' ? await env.DB.prepare('SELECT * FROM arena_matches WHERE id = ?1 AND user_id = ?2').bind(body.matchId, user.id).first() : null;
    if (match && !match.finished_at) {
      await env.DB.prepare('DELETE FROM arena_matches WHERE id = ?1').bind(match.id).run();
      await env.DB.prepare('UPDATE arena_players SET free_used = MAX(0, free_used - ?1), pending_match = NULL WHERE user_id = ?2').bind(match.ticket_used ? 0 : 1, user.id).run();
    }
    return json({ ticketUsed: !!match?.ticket_used, state: await view(env, user, player, await loadArena(env, user.id)) });
  },

  async result({ env, user, body, player }) {
    const match = typeof body.matchId === 'string' ? await env.DB.prepare('SELECT * FROM arena_matches WHERE id = ?1 AND user_id = ?2').bind(body.matchId, user.id).first() : null;
    if (!match) return fail('대전 기록을 찾을 수 없습니다.', 404, 'no-match');
    const outcome = body.forfeited ? false : body.outcome === true ? true : body.outcome === false ? false : null;
    const done = await finishMatch(env, match, outcome);
    return json({ ...done, state: await view(env, user, player, await loadArena(env, user.id)) });
  },

  async profile({ env, body }) {
    const row = typeof body.id === 'string' ? await env.DB.prepare('SELECT p.name, a.score, a.defense FROM players p JOIN arena_players a ON a.user_id = p.user_id WHERE p.public_id = ?1').bind(body.id).first() : null;
    if (!row) return fail('함장 정보를 찾을 수 없습니다.', 404, 'no-player');
    return json({ name: row.name, score: row.score, deck: row.defense ? JSON.parse(row.defense) : [] });
  }
};

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `arena-act:${user.id}`, 600, 3600000))) return tooMany();
  const text = await request.text();
  if (text.length > 64 * 1024) return json({ error: 'too-large' }, 413);
  let body;
  try { body = JSON.parse(text); } catch (_) { return json({ error: 'bad-json' }, 400); }
  const action = Object.hasOwn(ACTIONS, body?.action) ? ACTIONS[body.action] : null;
  if (!action) return json({ error: 'bad-request' }, 400);
  try {
    const player = await ensurePlayer(env, user.id);
    return await action({ env, user, body, player });
  } catch (error) {
    if (isMissingTable(error)) return notReady();
    throw error;
  }
}
