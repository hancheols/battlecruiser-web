// GET  /api/mine — 토륨광산 화면 정보: 이번 주 단계, 광산 현황, 내 방어 함대, 토륨 분배.
// POST /api/mine — { action, ... }
//   fleet     : 광산 전용 방어 함대 등록(일~화 쟁탈 기간에는 잠긴다)
//   challenge : 다른 연합이 점령한 광산에 도전 신청(연합장·부연합장, 수~토)
//   raid      : 해적 토벌 출격(하루 3회) / war : 쟁탈 출격(일~화, 상대 함장 지정)
//   finish    : 출격 결과 보고 { battleId, win, damage }. 같은 출격은 한 번만 반영한다.
import { json, authenticate, allow, tooMany } from '../_lib/util.js';
import { ensurePlayer, touchPlayer, notReady, fail, isMissingTable } from '../_lib/players.js';
import { isLinked } from '../_lib/ranking.js';
import { cleanDeck } from '../_lib/arena.js';
import { award } from '../_lib/contribution.js';
import { MINES, MINE_SIZES, MAX_MINES_PER_UNION, mineById, phaseOf, rollMines, deliverPayouts, useSortie, sortiesUsed, deckWithDev, newBattle, recordRaid, warStanding, warPoints, holdBonus, isFastReport, SORTIES_PER_DAY, MIN_FLEETS, PAYOUT_CAP } from '../_lib/mines.js';

const unionName = async (env, id) => (await env.DB.prepare('SELECT name FROM unions WHERE id = ?1').bind(id).first())?.name || '';
const membership = (env, userId) => env.DB.prepare('SELECT m.union_id, m.role, m.week_points, m.week_day, u.level, u.name FROM union_members m JOIN unions u ON u.id = m.union_id WHERE m.user_id = ?1').bind(userId).first();
const fleetCount = async (env, unionId) => Number((await env.DB.prepare('SELECT COUNT(*) AS n FROM mine_fleets f JOIN union_members m ON m.user_id = f.user_id WHERE m.union_id = ?1').bind(unionId).first()).n);
const heldCount = async (env, unionId) => Number((await env.DB.prepare('SELECT COUNT(*) AS n FROM mine_state WHERE union_id = ?1').bind(unionId).first()).n);
const CAP_MESSAGE = `광산은 연합당 ${MAX_MINES_PER_UNION}곳만 점령할 수 있습니다.`;

async function view(env, user, member, phase) {
  const unionId = member?.union_id || null;
  const states = (await env.DB.prepare('SELECT s.mine_id, s.union_id, s.defended, u.name AS holder FROM mine_state s LEFT JOIN unions u ON u.id = s.union_id').bind().all()).results || [];
  const stateOf = new Map(states.map(row => [row.mine_id, row]));
  const raids = (await env.DB.prepare('SELECT r.mine_id, r.union_id, SUM(r.best) AS total, u.name FROM mine_raids r JOIN union_members m ON m.user_id = r.user_id AND m.union_id = r.union_id JOIN unions u ON u.id = r.union_id GROUP BY r.mine_id, r.union_id ORDER BY total DESC').bind().all()).results || [];
  const records = unionId ? (await env.DB.prepare('SELECT r.mine_id, r.user_id, r.best, p.name FROM mine_raids r JOIN union_members m ON m.user_id = r.user_id AND m.union_id = r.union_id JOIN players p ON p.user_id = r.user_id WHERE r.union_id = ?1 ORDER BY r.best DESC').bind(unionId).all()).results || [] : [];
  const wars = (await env.DB.prepare('SELECT * FROM mine_wars WHERE week = ?1').bind(phase.week).all()).results || [];
  const applied = unionId ? ((await env.DB.prepare('SELECT mine_id FROM mine_challenges WHERE week = ?1 AND union_id = ?2').bind(phase.week, unionId).all()).results || []).map(row => row.mine_id) : [];
  const counts = (await env.DB.prepare('SELECT mine_id, COUNT(*) AS n FROM mine_challenges WHERE week = ?1 GROUP BY mine_id').bind(phase.week).all()).results || [];
  const mines = [];
  for (const mine of MINES) {
    const size = MINE_SIZES[mine.size], state = stateOf.get(mine.id), war = wars.find(item => item.mine_id === mine.id);
    const held = state && state.holder ? state : null;
    const racers = raids.filter(row => row.mine_id === mine.id);
    const info = {
      id: mine.id, name: mine.name, size: mine.size, sizeLabel: size.label, production: size.production, minLevel: size.minLevel,
      pirate: { name: size.pirate.name, hp: size.pirate.hp, limit: size.pirate.limit },
      holder: held ? { name: held.holder, mine: held.union_id === unionId, bonus: holdBonus(held.defended) } : null,
      myTotal: Number(racers.find(row => row.union_id === unionId)?.total) || 0,
      myBest: records.find(row => row.mine_id === mine.id && row.user_id === user.id)?.best || 0,
      racers: racers.slice(0, 3).map(row => ({ name: row.name, total: Number(row.total), mine: row.union_id === unionId })),
      records: records.filter(row => row.mine_id === mine.id).slice(0, 5).map(row => ({ name: row.name, best: row.best, me: row.user_id === user.id })),
      applied: applied.includes(mine.id),
      applicants: Number(counts.find(row => row.mine_id === mine.id)?.n) || 0,
      war: null
    };
    if (war) {
      const standing = await warStanding(env, war);
      const mySide = war.holder_id === unionId ? 'holder' : war.challenger_id === unionId ? 'challenger' : null;
      info.war = { holder: await unionName(env, war.holder_id), challenger: await unionName(env, war.challenger_id), holderScore: standing.holder, challengerScore: standing.challenger, holderBonus: war.holder_bonus, mySide };
    }
    mines.push(info);
  }
  const fleetRow = await env.DB.prepare('SELECT deck FROM mine_fleets WHERE user_id = ?1').bind(user.id).first();
  const out = {
    phase: { week: phase.week, war: phase.war, daysLeft: phase.daysLeft },
    linked: await isLinked(env, user.id),
    mines,
    fleet: fleetRow ? JSON.parse(fleetRow.deck) : null,
    sorties: { used: await sortiesUsed(env, user.id, phase.today), max: SORTIES_PER_DAY },
    rules: { minFleets: MIN_FLEETS, payoutCap: PAYOUT_CAP, maxMines: MAX_MINES_PER_UNION },
    union: null
  };
  if (member) {
    const treasury = await env.DB.prepare('SELECT thorium FROM union_treasury WHERE union_id = ?1').bind(unionId).first();
    const members = (await env.DB.prepare('SELECT m.user_id, m.week_points, m.week_day, p.name, p.public_id, (SELECT 1 FROM identities i WHERE i.user_id = m.user_id LIMIT 1) AS linked FROM union_members m JOIN players p ON p.user_id = m.user_id WHERE m.union_id = ?1').bind(unionId).all()).results || [];
    const weekOf = row => row.week_day === phase.week ? row.week_points : 0;
    const totalPoints = members.reduce((sum, row) => sum + weekOf(row), 0);
    const owned = mines.filter(mine => mine.holder?.mine);
    const production = owned.reduce((sum, mine) => sum + mine.production, 0);
    const pool = (Number(treasury?.thorium) || 0) + production;
    const shareOf = points => totalPoints ? Math.min(PAYOUT_CAP, Math.floor(pool * points / totalPoints)) : 0;
    const history = (await env.DB.prepare('SELECT week, amount, points, total_points FROM mine_payouts WHERE user_id = ?1 ORDER BY week DESC LIMIT 6').bind(user.id).all()).results || [];
    out.union = {
      name: member.name, level: member.level, role: member.role, canChallenge: ['leader', 'officer'].includes(member.role),
      fleets: await fleetCount(env, unionId),
      heldMine: owned[0]?.name || '',
      appliedMine: mines.find(mine => mine.applied)?.name || '',
      challenging: wars.some(war => war.challenger_id === unionId),
      treasury: Number(treasury?.thorium) || 0,
      production, pool,
      myPoints: weekOf(members.find(row => row.user_id === user.id) || { week_day: 0 }),
      totalPoints,
      shares: members.map(row => ({ name: row.name, me: row.user_id === user.id, points: weekOf(row), linked: Boolean(row.linked), expected: row.linked ? shareOf(weekOf(row)) : 0 })).sort((a, b) => b.points - a.points),
      history: history.map(row => ({ week: row.week, amount: row.amount, points: row.points, total: row.total_points }))
    };
  }
  return out;
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `mine:${user.id}`, 600, 3600000))) return tooMany();
  try {
    const player = await ensurePlayer(env, user.id);
    await touchPlayer(env, player);
    const phase = await rollMines(env);
    await deliverPayouts(env, user.id);
    return json(await view(env, user, await membership(env, user.id), phase));
  } catch (error) {
    if (isMissingTable(error)) return notReady();
    throw error;
  }
}

const ACTIONS = {
  async fleet({ env, user, body, phase, member }) {
    if (phase.war) return fail('쟁탈 기간(일~화)에는 방어 함대를 바꿀 수 없습니다.', 409, 'locked');
    const deck = cleanDeck(body.deck);
    if (!deck) return fail('주력 3척을 서로 다른 함선으로 편성해 주세요.', 400, 'bad-deck');
    await env.DB.prepare('INSERT INTO mine_fleets (user_id, deck, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id) DO UPDATE SET deck = ?2, updated_at = ?3').bind(user.id, JSON.stringify(deck), Date.now()).run();
    return json(await view(env, user, member, phase));
  },

  async challenge({ env, user, body, phase, member }) {
    if (!member) return fail('연합에 가입해야 합니다.', 409, 'no-union');
    if (!['leader', 'officer'].includes(member.role)) return fail('도전 신청은 연합장과 부연합장만 할 수 있습니다.', 403, 'forbidden');
    if (phase.war) return fail('도전 신청은 수~토에 할 수 있습니다.', 409, 'closed');
    const mine = mineById(body.mine);
    const state = mine && await env.DB.prepare('SELECT union_id FROM mine_state WHERE mine_id = ?1').bind(mine.id).first();
    if (!state) return fail('해적이 점거한 광산은 토벌로 점령합니다.', 409, 'not-held');
    if (state.union_id === member.union_id) return fail('이미 우리 연합이 점령한 광산입니다.', 409, 'own-mine');
    if (await heldCount(env, member.union_id) >= MAX_MINES_PER_UNION) return fail(CAP_MESSAGE, 409, 'cap');
    const other = await env.DB.prepare('SELECT mine_id FROM mine_challenges WHERE week = ?1 AND union_id = ?2 AND mine_id != ?3').bind(phase.week, member.union_id, mine.id).first();
    if (other) return fail('도전 신청은 한 주에 한 광산만 할 수 있습니다.', 409, 'applied');
    if (member.level < MINE_SIZES[mine.size].minLevel) return fail(`연합 레벨 ${MINE_SIZES[mine.size].minLevel} 이상이 필요합니다.`, 409, 'level');
    if (await fleetCount(env, member.union_id) < MIN_FLEETS) return fail(`방어 함대를 등록한 연합원이 ${MIN_FLEETS}명 이상이어야 합니다.`, 409, 'fleets');
    await env.DB.prepare('INSERT OR IGNORE INTO mine_challenges (week, mine_id, union_id, created_at) VALUES (?1, ?2, ?3, ?4)').bind(phase.week, mine.id, member.union_id, Date.now()).run();
    return json(await view(env, user, member, phase));
  },

  async raid({ env, user, body, phase, member }) {
    if (!member) return fail('연합에 가입해야 합니다.', 409, 'no-union');
    const mine = mineById(body.mine);
    if (!mine) return fail('광산을 찾을 수 없습니다.', 404, 'no-mine');
    if (await env.DB.prepare('SELECT 1 AS held FROM mine_state WHERE mine_id = ?1').bind(mine.id).first()) return fail('이미 점령된 광산입니다.', 409, 'held');
    const size = MINE_SIZES[mine.size];
    if (member.level < size.minLevel) return fail(`연합 레벨 ${size.minLevel} 이상이 필요합니다.`, 409, 'level');
    if (await heldCount(env, member.union_id) >= MAX_MINES_PER_UNION) return fail(CAP_MESSAGE, 409, 'cap');
    if (await env.DB.prepare('SELECT 1 AS ok FROM mine_wars WHERE week = ?1 AND challenger_id = ?2').bind(phase.week, member.union_id).first()) return fail('쟁탈전에 도전 중인 연합은 토벌할 수 없습니다.', 409, 'challenging');
    if (!(await useSortie(env, user.id, phase.today))) return fail(`오늘 출격 ${SORTIES_PER_DAY}회를 모두 사용했습니다.`, 409, 'no-sortie');
    const battle = newBattle(env, { userId: user.id, unionId: member.union_id, mineId: mine.id, kind: 'raid', week: phase.week, now: Date.now() });
    await battle.statement.run();
    return json({ battleId: battle.id, pirate: size.pirate, mine: { id: mine.id, name: mine.name } });
  },

  async targets({ env, user, body, phase, member }) {
    const mine = mineById(body.mine);
    const war = mine && member && await env.DB.prepare('SELECT * FROM mine_wars WHERE week = ?1 AND mine_id = ?2').bind(phase.week, mine.id).first();
    if (!war || (war.holder_id !== member.union_id && war.challenger_id !== member.union_id)) return fail('참가 중인 쟁탈전이 아닙니다.', 409, 'no-war');
    const enemy = war.holder_id === member.union_id ? war.challenger_id : war.holder_id;
    const rows = (await env.DB.prepare('SELECT f.user_id, f.deck, p.public_id, p.name FROM mine_fleets f JOIN union_members m ON m.user_id = f.user_id JOIN players p ON p.user_id = f.user_id WHERE m.union_id = ?1').bind(enemy).all()).results || [];
    const hit = ((await env.DB.prepare("SELECT target_id FROM mine_battles WHERE user_id = ?1 AND mine_id = ?2 AND kind = 'war' AND created_at >= ?3").bind(user.id, mine.id, phase.today * 86400000 - 9 * 3600000).all()).results || []).map(row => row.target_id);
    const scores = new Map(((await env.DB.prepare('SELECT user_id, points FROM mine_scores WHERE week = ?1 AND mine_id = ?2').bind(phase.week, mine.id).all()).results || []).map(row => [row.user_id, row.points]));
    return json({ targets: rows.map(row => ({ id: row.public_id, name: row.name, ships: JSON.parse(row.deck).slice(0, 3).map(ship => ({ name: ship.name, rarity: ship.rarity, stars: ship.enhancementStars })), attacked: hit.includes(row.user_id), points: scores.get(row.user_id) || 0 })) });
  },

  async war({ env, user, body, phase, member }) {
    const mine = mineById(body.mine);
    const war = mine && member && await env.DB.prepare('SELECT * FROM mine_wars WHERE week = ?1 AND mine_id = ?2').bind(phase.week, mine.id).first();
    if (!war || !phase.war || (war.holder_id !== member.union_id && war.challenger_id !== member.union_id)) return fail('참가 중인 쟁탈전이 아닙니다.', 409, 'no-war');
    if (!(await env.DB.prepare('SELECT 1 AS ok FROM mine_fleets WHERE user_id = ?1').bind(user.id).first())) return fail('방어 함대를 먼저 등록해 주세요.', 409, 'no-fleet');
    const enemy = war.holder_id === member.union_id ? war.challenger_id : war.holder_id;
    const target = await env.DB.prepare('SELECT f.user_id, f.deck, p.name, u.level FROM players p JOIN mine_fleets f ON f.user_id = p.user_id JOIN union_members m ON m.user_id = p.user_id JOIN unions u ON u.id = m.union_id WHERE p.public_id = ?1 AND m.union_id = ?2').bind(String(body.target), enemy).first();
    if (!target) return fail('상대 함장을 찾을 수 없습니다.', 404, 'no-target');
    const dayStart = phase.today * 86400000 - 9 * 3600000;
    if (await env.DB.prepare("SELECT 1 AS done FROM mine_battles WHERE user_id = ?1 AND target_id = ?2 AND kind = 'war' AND created_at >= ?3").bind(user.id, target.user_id, dayStart).first()) return fail('오늘 이미 공격한 함장입니다.', 409, 'attacked');
    if (!(await useSortie(env, user.id, phase.today))) return fail(`오늘 출격 ${SORTIES_PER_DAY}회를 모두 사용했습니다.`, 409, 'no-sortie');
    const battle = newBattle(env, { userId: user.id, unionId: member.union_id, mineId: mine.id, kind: 'war', targetId: target.user_id, week: phase.week, now: Date.now() });
    await battle.statement.run();
    return json({ battleId: battle.id, enemy: { name: target.name, deck: await deckWithDev(env, target.user_id, JSON.parse(target.deck), target.level) }, mine: { id: mine.id, name: mine.name } });
  },

  async finish({ env, user, body, phase, member }) {
    const battle = typeof body.battleId === 'string' ? await env.DB.prepare('SELECT * FROM mine_battles WHERE id = ?1 AND user_id = ?2').bind(body.battleId, user.id).first() : null;
    if (!battle) return fail('출격 기록을 찾을 수 없습니다.', 404, 'no-battle');
    if (battle.finished_at) return json({ win: battle.win === 1, points: battle.points, captured: false, already: true });
    const now = Date.now(), win = body.win === true;
    const claimed = await env.DB.prepare('UPDATE mine_battles SET finished_at = ?1, win = ?2, flagged = ?3 WHERE id = ?4 AND finished_at IS NULL').bind(now, win ? 1 : 0, (win || Number(body.damage) > 0) && isFastReport(battle, now) ? 1 : 0, battle.id).run();
    if (!claimed?.meta?.changes) return json({ win, points: 0, captured: false, already: true });
    await award(env, user.id, 'mine');
    const mine = mineById(battle.mine_id);
    let points = 0, captured = false, raid = null;
    if (battle.week === phase.week && mine) {
      if (battle.kind === 'raid') {
        if (!(await env.DB.prepare('SELECT 1 AS held FROM mine_state WHERE mine_id = ?1').bind(mine.id).first())) {
          raid = await recordRaid(env, mine, battle.union_id, user.id, body.damage, phase.week);
          captured = raid.captured;
          await env.DB.prepare('UPDATE mine_battles SET points = ?1 WHERE id = ?2').bind(raid.damage, battle.id).run();
        }
      } else {
        const grade = async id => Number((await env.DB.prepare("SELECT grade FROM rank_entries WHERE user_id = ?1 AND category = 'total'").bind(id).first())?.grade) || 0;
        points = warPoints(win, await grade(user.id), await grade(battle.target_id));
        await env.DB.prepare('INSERT INTO mine_scores (week, mine_id, union_id, user_id, points) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(week, mine_id, user_id) DO UPDATE SET points = points + ?5').bind(phase.week, mine.id, battle.union_id, user.id, points).run();
        await env.DB.prepare('UPDATE mine_battles SET points = ?1 WHERE id = ?2').bind(points, battle.id).run();
      }
    }
    return json({ win, points, captured, raid: raid && { ...raid, need: MINE_SIZES[mine.size].pirate.hp }, state: await view(env, user, member, phase) });
  }
};

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `mine-act:${user.id}`, 300, 3600000))) return tooMany();
  const text = await request.text();
  if (text.length > 64 * 1024) return json({ error: 'too-large' }, 413);
  let body;
  try { body = JSON.parse(text); } catch (_) { return json({ error: 'bad-json' }, 400); }
  const action = Object.hasOwn(ACTIONS, body?.action) ? ACTIONS[body.action] : null;
  if (!action) return json({ error: 'bad-request' }, 400);
  try {
    await ensurePlayer(env, user.id);
    if (!(await isLinked(env, user.id))) return fail('토륨광산은 구글 계정을 연동한 함장만 참여할 수 있습니다.', 403, 'not-linked');
    const phase = await rollMines(env);
    return await action({ env, user, body, phase, member: await membership(env, user.id) });
  } catch (error) {
    if (isMissingTable(error)) return notReady();
    throw error;
  }
}
