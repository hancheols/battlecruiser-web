// 아레나 서버 처리: 점수·전적·입장 횟수·상대 찾기·보상 정산.
// 전투 자체는 게임 화면에서 돌아가므로 승패는 게임이 보고한 값을 받는다. 대신 대전 번호 발급, 1회 처리, 점수 계산, 입장 횟수는 서버가 맡는다.
import { randomToken } from './util.js';
import { createGrant } from './grants.js';
import { ensurePlayer } from './players.js';
import { TIERS, day, isWednesday, tierIndex, delta, rewards, deckPower, tierMail } from './arena-rules.js';
import { currentSeason, seasonOfWeek } from './seasons.js';
import { award } from './contribution.js';

export const FREE_PER_DAY = 5;
export const MATCHES_PER_DAY = 200;   // 티켓은 게임 저장에 있어 서버가 셀 수 없으므로 하루 총 대전 수에 상한을 둔다
export const FAST_WIN_MS = 8000;      // 대전 시작부터 이보다 빨리 온 승리 보고는 표시만 해 둔다
const POWER_MARGIN = .2;              // 전투력 차이가 이 안쪽인 실제 이용자와 붙인다. 없으면 유령함대
const NAME = /^[\p{L}\p{N} '·-]{1,24}$/u;
const SHIP_TYPES = ['dreadnought', 'battlecruiser', 'destroyer', 'frigate'];
const RARITIES = ['R', 'SR', 'SSR', 'L'];
// 함선 한 척 능력치 상한. 최고 희귀도·5성 기준 체력 84,000·공격력 6,480 에 돌파·연구 보너스를 더해도 넘지 않게 잡은 값이다.
export const MAX_SHIP_HP = 400000;
export const MAX_SHIP_DPS = 80000;

const clampNumber = (value, max) => { const number = Number(value); return Number.isFinite(number) && number >= 0 && number <= max ? number : null; };
function cleanDev(dev) {
  const source = dev && typeof dev === 'object' ? dev : {};
  const out = {};
  for (const key of ['damage', 'speed', 'hull', 'carrierHull', 'shield', 'shieldDuration', 'reduction']) out[key] = clampNumber(source[key], 20) ?? 0;
  out.carrierFighters = clampNumber(source.carrierFighters, 10) ?? 0;
  out.levels = clampNumber(source.levels, 100000) ?? 0;
  out.frigate = {};
  if (source.frigate && typeof source.frigate === 'object') {
    for (const [key, value] of Object.entries(source.frigate).slice(0, 80)) {
      if (/^[A-Za-z0-9]{1,40}$/.test(key) && clampNumber(value, 1000) !== null) out.frigate[key] = Number(value);
    }
  }
  return out;
}
function cleanShip(ship, slot) {
  if (!ship || typeof ship !== 'object') return null;
  const hp = clampNumber(ship.hp, MAX_SHIP_HP), dps = clampNumber(ship.dps, MAX_SHIP_DPS);
  const isFrigate = ship.type === 'frigate';
  if (!SHIP_TYPES.includes(ship.type) || isFrigate !== (slot === 3) || !RARITIES.includes(ship.rarity) || !NAME.test(String(ship.name || '')) || hp === null || !hp || dps === null) return null;
  return { name: ship.name, type: ship.type, rarity: ship.rarity, enhancementStars: Math.min(10, Math.max(0, Math.floor(Number(ship.enhancementStars) || 0))), hp, dps, skillStars: Math.min(10, Math.max(0, Math.floor(Number(ship.skillStars) || 0))), factor: clampNumber(ship.factor, 1000) ?? 1, dev: cleanDev(ship.dev) };
}
// 다른 이용자 화면에 들어가는 값이므로 정해진 칸만 남긴다. 이미지·설명은 받는 쪽 게임이 자기 함선 목록에서 다시 채운다.
export function cleanDeck(deck) {
  if (!Array.isArray(deck) || deck.length !== 4) return null;
  const main = [0, 1, 2].map(slot => cleanShip(deck[slot], slot));
  if (main.some(ship => !ship) || new Set(main.map(ship => ship.name)).size !== 3) return null;
  const frigate = deck[3] ? cleanShip(deck[3], 3) : null;
  if (deck[3] && !frigate) return null;
  return [...main, frigate];
}

export async function loadArena(env, userId) {
  const existing = await env.DB.prepare('SELECT * FROM arena_players WHERE user_id = ?1').bind(userId).first();
  if (existing) return existing;
  const now = Date.now(), today = day(now);
  await env.DB.prepare('INSERT INTO arena_players (user_id, free_day, settled_day, updated_at) VALUES (?1, ?2, ?2, ?3) ON CONFLICT(user_id) DO NOTHING').bind(userId, today, now).run();
  return env.DB.prepare('SELECT * FROM arena_players WHERE user_id = ?1').bind(userId).first();
}

// 이번 주 상위 7명을 한 번만 찍어 둔다. 예약 작업이 없어서 주가 바뀐 뒤 처음 정산하는 요청이 대신한다.
async function snapshotWeek(env, weekDay) {
  const marked = await env.DB.prepare('INSERT INTO arena_weeks (week_day, user_id, rank) VALUES (?1, ?2, 0) ON CONFLICT DO NOTHING').bind(weekDay, '').run();
  if (!marked?.meta?.changes) return;
  const top = (await env.DB.prepare('SELECT user_id FROM arena_players WHERE defense_power > 0 ORDER BY score DESC, updated_at ASC LIMIT 7').bind().all()).results || [];
  for (const [index, row] of top.entries()) await env.DB.prepare('INSERT INTO arena_weeks (week_day, user_id, rank) VALUES (?1, ?2, ?3) ON CONFLICT DO NOTHING').bind(weekDay, row.user_id, index + 1).run();
}

// 하루가 바뀌면 입장 횟수를 되돌리고, 끝난 날의 일일·주간 보상을 지급함으로 보낸다. 우편 id 로 중복을 막아 재시도해도 안전하다.
export async function settle(env, row, now = Date.now()) {
  const today = day(now);
  const next = { ...row };
  if (today > next.free_day) { next.free_day = today; next.free_used = 0; }
  if (today > next.settled_day) {
    const battleDays = new Set(JSON.parse(next.battle_days || '[]'));
    const season = await currentSeason(env, now);
    const missed = new Set(JSON.parse(next.missed_seasons || '[]'));
    const index = tierIndex(next.score), label = TIERS[index].label;
    const daily = rewards(index), weekly = rewards(index, true);
    let dailyCount = 0;
    for (let d = next.settled_day; d < today; d += 1) {
      if (battleDays.has(d)) { dailyCount += 1; next.week_days += 1; }
      if (isWednesday(d + 1)) {
        if (next.week_days >= 5) {
          await snapshotWeek(env, d + 1);
          const top = await env.DB.prepare('SELECT rank FROM arena_weeks WHERE week_day = ?1 AND user_id = ?2').bind(d + 1, row.user_id).first();
          await createGrant(env, {
            userId: row.user_id, orderId: `arena-weekly-${row.user_id}-${d + 1}`, title: '아레나 주간 보상 도착 · 축하합니다!',
            body: `${label} 등급으로 한 주를 함께 달려 주셨습니다. 일일 보상을 5회 이상 받으신 꾸준함에 대한 주간 보상입니다.${top ? ' 주간 상위 7위 안에 드신 것을 진심으로 축하드리며, SSR 함선 선택 교환권 1장을 추가로 드립니다.' : ''} 지휘관님의 노고에 감사드립니다.`,
            items: { ...weekly, ...(top ? { ssrShipTicket: 1 } : {}) }
          });
        } else {
          const weekSeason = seasonOfWeek(season, d + 1);
          if (weekSeason > 0) missed.add(weekSeason);
        }
        next.week_days = 0;
      }
    }
    if (dailyCount) {
      await createGrant(env, {
        userId: row.user_id, orderId: `arena-daily-${row.user_id}-${next.settled_day}-${today}`, title: '아레나 일일 보상 도착',
        body: `축하합니다! ${label} 등급으로 ${dailyCount}일 동안 아레나 대전에 나서 주셨습니다. 매일 전선에 서 주신 지휘관님께 감사드립니다. 보상을 전달합니다.`,
        items: { gold: daily.gold * dailyCount, thorium: daily.thorium * dailyCount }
      });
    }
    next.settled_day = today;
    next.missed_seasons = JSON.stringify([...missed].slice(-6));
    next.battle_days = JSON.stringify([...battleDays].filter(d => d >= today - 40));
  }
  if (next.free_day !== row.free_day || next.settled_day !== row.settled_day) {
    await env.DB.prepare('UPDATE arena_players SET free_day = ?1, free_used = ?2, settled_day = ?3, battle_days = ?4, week_days = ?5, missed_seasons = ?6 WHERE user_id = ?7')
      .bind(next.free_day, next.free_used, next.settled_day, next.battle_days, next.week_days, next.missed_seasons, row.user_id).run();
  }
  return next;
}

// 처음 도달한 등급마다 축전을 보낸다(중간 등급을 건너뛰어도 모두). 점수가 떨어졌다 올라도 다시 받지 않는다.
async function grantTierMail(env, row, score) {
  const index = tierIndex(score);
  if (index <= row.best_tier) return row.best_tier;
  for (const tier of TIERS.slice(row.best_tier + 1, index + 1)) {
    const mail = tierMail(tier);
    if (mail) await createGrant(env, { userId: row.user_id, orderId: `arena-tier-${row.user_id}-${mail.id}`, title: mail.title, body: mail.body, items: mail.items });
  }
  await env.DB.prepare('UPDATE arena_players SET best_tier = ?1 WHERE user_id = ?2').bind(index, row.user_id).run();
  return index;
}

// 대전 결과를 반영한다. outcome: true 승리, false 패배, null 무승부. 이미 처리한 대전은 그대로 돌려준다.
export async function finishMatch(env, match, outcome, now = Date.now()) {
  if (match.finished_at) return { delta: match.delta, outcome: match.outcome === 1 ? true : match.outcome === 0 ? false : null };
  const change = delta(match.score_before, match.enemy_score, outcome);
  const flagged = outcome === true && now - match.created_at < FAST_WIN_MS ? 1 : 0;
  const claimed = await env.DB.prepare('UPDATE arena_matches SET finished_at = ?1, outcome = ?2, delta = ?3, flagged = ?4 WHERE id = ?5 AND finished_at IS NULL')
    .bind(now, outcome === null ? null : outcome ? 1 : 0, change, flagged, match.id).run();
  if (!claimed?.meta?.changes) {   // 다른 요청이 먼저 처리했다
    const done = await env.DB.prepare('SELECT delta, outcome FROM arena_matches WHERE id = ?1').bind(match.id).first();
    return { delta: done.delta, outcome: done.outcome === 1 ? true : done.outcome === 0 ? false : null };
  }
  const today = day(now);
  const column = outcome === null ? 'draws' : outcome ? 'wins' : 'losses';
  const row = await env.DB.prepare('SELECT * FROM arena_players WHERE user_id = ?1').bind(match.user_id).first();
  const battleDays = [...new Set([...JSON.parse(row.battle_days || '[]'), today])].slice(-40);
  await env.DB.prepare(`UPDATE arena_players SET score = MAX(0, score + ?1), ${column} = ${column} + 1, battle_days = ?2, pending_match = CASE WHEN pending_match = ?3 THEN NULL ELSE pending_match END, updated_at = ?4 WHERE user_id = ?5`)
    .bind(change, JSON.stringify(battleDays), match.id, now, match.user_id).run();
  if (match.enemy_user_id && change) await env.DB.prepare('UPDATE arena_players SET score = MAX(0, score - ?1) WHERE user_id = ?2').bind(change, match.enemy_user_id).run();
  await grantTierMail(env, row, Math.max(0, row.score + change));
  await award(env, match.user_id, 'arena', { now });
  return { delta: change, outcome };
}

// 끝나지 않은 대전(앱 종료 등)은 패배로 처리한다.
export async function closePending(env, row) {
  if (!row.pending_match) return row;
  const match = await env.DB.prepare('SELECT * FROM arena_matches WHERE id = ?1').bind(row.pending_match).first();
  if (match && !match.finished_at) await finishMatch(env, match, false);
  else await env.DB.prepare('UPDATE arena_players SET pending_match = NULL WHERE user_id = ?1').bind(row.user_id).run();
  return env.DB.prepare('SELECT * FROM arena_players WHERE user_id = ?1').bind(row.user_id).first();
}

// 상대 찾기: 점수가 가까운 이용자 중 전투력 차이가 ±20% 이내인 사람을 무작위로 고른다. 없으면 null(게임이 유령함대를 만든다).
export async function findOpponent(env, row, rng = Math.random) {
  if (!(row.defense_power > 0)) return null;
  const recent = (await env.DB.prepare('SELECT enemy_user_id FROM arena_matches WHERE user_id = ?1 AND enemy_user_id IS NOT NULL ORDER BY created_at DESC LIMIT 3').bind(row.user_id).all()).results || [];
  const skip = new Set(recent.map(item => item.enemy_user_id));
  const nearby = (await env.DB.prepare('SELECT user_id, score, defense, defense_power FROM arena_players WHERE user_id != ?1 AND defense_power > 0 AND score BETWEEN ?2 AND ?3 ORDER BY ABS(score - ?4) LIMIT 40').bind(row.user_id, row.score - 600, row.score + 600, row.score).all()).results || [];
  const fits = nearby.filter(item => Math.abs(item.defense_power / row.defense_power - 1) <= POWER_MARGIN);
  const pool = fits.filter(item => !skip.has(item.user_id));
  const candidates = pool.length ? pool : fits;
  if (!candidates.length) return null;
  const pick = candidates[Math.floor(rng() * candidates.length)];
  const player = await ensurePlayer(env, pick.user_id);
  return { userId: pick.user_id, publicId: player.public_id, name: player.name, score: pick.score, deck: JSON.parse(pick.defense) };
}

export function newMatch(env, row, preview, ticketUsed, now = Date.now()) {
  const id = randomToken(12);
  const enemy = preview.enemy;
  return { id, statement: env.DB.prepare('INSERT INTO arena_matches (id, user_id, enemy_user_id, enemy_name, enemy_score, score_before, ticket_used, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)').bind(id, row.user_id, enemy?.userId || null, enemy?.name || '유령함대', enemy ? enemy.score : row.score, row.score, ticketUsed ? 1 : 0, now) };
}

export { deckPower };
