// 토륨광산: 해적을 토벌해 첫 점령을 하고, 이후에는 주간 도전전으로 소유가 바뀐다. 토륨은 광산에서만 생산되고 CREDIT 비율로 나눠 지급한다.
// 한 주는 수요일 0시(KST)에 시작한다. 수~토는 도전 신청·방어 함대 등록, 일~화는 쟁탈전이다. 수치는 이 파일에 모아 둔다.
import { randomToken } from './util.js';
import { createGrant } from './grants.js';
import { day } from './arena-rules.js';
import { weekOf, ACTIVE_DAYS_FOR_SCORE, unionDevLevels, DEV_STEP_EFFECT } from './contribution.js';

// 광산을 늘릴 때는 이 목록에 한 줄만 더하면 된다. id 는 기록에 쓰이므로 한 번 정하면 바꾸지 않는다. 표를 고칠 필요는 없다.
export const MINES = [
  { id: 'oort', name: '오르트 대광맥', size: 'large' },
  { id: 'ganymede', name: '가니메데 광맥', size: 'medium' },
  { id: 'titan', name: '타이탄 광맥', size: 'medium' },
  { id: 'callisto', name: '칼리스토 광맥', size: 'medium' },
  { id: 'phobos', name: '포보스 광맥', size: 'small' },
  { id: 'deimos', name: '데이모스 광맥', size: 'small' },
  { id: 'ceres', name: '세레스 광맥', size: 'small' },
  { id: 'vesta', name: '베스타 광맥', size: 'small' },
  { id: 'pallas', name: '팔라스 광맥', size: 'small' },
  { id: 'europa', name: '유로파 광맥', size: 'small' }
];
// 규모별 설정: 주간 토륨, 참가 연합 레벨, 해적 함대. 연합원 각자의 최고 피해 합이 해적 체력에 이르면 점령한다.
// 측정값: L등급 3척 함대가 60초에 약 30만 피해. 같은 함대 기준 소형 4명, 중형 17명, 대형은 Lv.4 정원 33명이 평균 45만을 내야 한다.
export const MINE_SIZES = {
  small: { label: '소형', production: 1000, minLevel: 1, pirate: { pirate: 'black', image: 'blackbeard.webp', name: '우주해적 정찰 함대', hp: 1000000, limit: 60 } },
  medium: { label: '중형', production: 2000, minLevel: 2, pirate: { pirate: 'black', image: 'blackbeard.webp', name: '검은수염 주력 함대', hp: 5000000, limit: 60 } },
  large: { label: '대형', production: 4000, minLevel: 4, pirate: { pirate: 'red', image: 'redbeard-top.webp', name: '붉은수염 정예 함대', hp: 15000000, limit: 60 } }
};
export const MAX_MINES_PER_UNION = 1;  // 연합당 점령 상한. 도전 신청도 주 1곳
export const RECORD_CAP_RATE = .3;     // 1인 기록은 해적 체력의 30%까지만 합계에 반영한다
export const MINE_RANK = { small: 1, medium: 2, large: 3 };
export const SORTIES_PER_DAY = 3;
export const MIN_FLEETS = 5;           // 도전 신청과 수비 보너스에 필요한 등록 방어 함대 수
export const PAYOUT_CAP = 1000;        // 1인 주간 분배 상한. 넘은 몫은 저장고에 남는다
export const JOIN_WAIT_MS = 24 * 3600000;   // 가입 후 24시간 안에 정산되면 분배에서 제외
export const WAR_START_OFFSET = 4;     // 수요일로부터 4일째(일요일 0시)부터 쟁탈전
export const SCORE_TOP = 20;           // 연합 점수는 점수 상위 20명의 합
export const WIN_POINTS = 100, LOSS_POINTS = 20, MAX_GRADE_BONUS = 50, GRADE_BONUS_RATE = 2;
export const HOLD_BONUS = .1, HOLD_BONUS_DECAY = .02;
const INACTIVE_MS = 14 * 86400000;     // 점령 연합이 이 기간 아무도 접속하지 않으면 광산은 해적에게 돌아간다
const FAST_WIN_MS = 8000;

export const mineById = id => MINES.find(mine => mine.id === id) || null;
export const recordCap = mine => Math.floor(MINE_SIZES[mine.size].pirate.hp * RECORD_CAP_RATE);
// 광산이 없거나 지금보다 큰 광산만 얻을 수 있다. 얻으면 옛 광산은 해적에게 돌아간다.
export const canTakeMine = (held, mine) => !held || MINE_RANK[mine.size] > MINE_RANK[held.size];
export async function heldMineOf(env, unionId) {
  const row = await env.DB.prepare('SELECT mine_id FROM mine_state WHERE union_id = ?1').bind(unionId).first();
  return row ? mineById(row.mine_id) : null;
}
export const holdBonus = defended => Math.max(0, HOLD_BONUS - HOLD_BONUS_DECAY * defended);
export const warPoints = (win, myGrade, targetGrade) => win ? WIN_POINTS + Math.min(MAX_GRADE_BONUS, Math.max(0, (targetGrade - myGrade) * GRADE_BONUS_RATE)) : LOSS_POINTS;

export function phaseOf(now = Date.now()) {
  const today = day(now), week = weekOf(today), offset = today - week;
  const war = offset >= WAR_START_OFFSET;
  return { today, week, war, daysLeft: war ? 7 - offset : WAR_START_OFFSET - offset };
}

// 연합 점수: 상위 20명의 쟁탈 점수 합. 점령 연합은 수비 보너스를 곱한다.
async function warScore(env, week, mineId, unionId) {
  const row = await env.DB.prepare('SELECT COALESCE(SUM(points), 0) AS total FROM (SELECT points FROM mine_scores WHERE week = ?1 AND mine_id = ?2 AND union_id = ?3 ORDER BY points DESC LIMIT ?4)').bind(week, mineId, unionId, SCORE_TOP).first();
  return Number(row?.total) || 0;
}
export async function warStanding(env, war) {
  const holder = await warScore(env, war.week, war.mine_id, war.holder_id);
  const challenger = await warScore(env, war.week, war.mine_id, war.challenger_id);
  return { holder: Math.round(holder * (1 + war.holder_bonus)), challenger };
}

const fleetCount = async (env, unionId) => Number((await env.DB.prepare('SELECT COUNT(*) AS n FROM mine_fleets f JOIN union_members m ON m.user_id = f.user_id WHERE m.union_id = ?1').bind(unionId).first()).n);
const unionGrade = async (env, unionId, now) => Number((await env.DB.prepare(`SELECT COALESCE(SUM(r.grade), 0) AS total FROM union_members m JOIN players p ON p.user_id = m.user_id JOIN rank_entries r ON r.user_id = m.user_id AND r.category = 'total' WHERE m.union_id = ?1 AND p.last_seen >= ?2`).bind(unionId, now - ACTIVE_DAYS_FOR_SCORE * 86400000).first()).total);

// 지난주 정산: 전쟁 승패, 생산, 분배, 소유 변경. 문장마다 "아직 지난주인지"를 확인해 요청이 겹쳐도 한 번만 반영한다.
async function settleWeek(env, oldWeek, nextWeek, now) {
  const open = 'EXISTS (SELECT 1 FROM mine_week_state WHERE id = 1 AND week = ?1)';
  const statements = [];
  const held = (await env.DB.prepare('SELECT s.mine_id, s.union_id, s.defended FROM mine_state s').bind().all()).results || [];
  const production = new Map(), taken = new Map();
  for (const row of held) {
    const mine = mineById(row.mine_id);
    if (!mine) continue;
    const union = await env.DB.prepare('SELECT id FROM unions WHERE id = ?1').bind(row.union_id).first();
    const active = union && await env.DB.prepare('SELECT 1 AS ok FROM union_members m JOIN players p ON p.user_id = m.user_id WHERE m.union_id = ?1 AND p.last_seen >= ?2 LIMIT 1').bind(row.union_id, now - INACTIVE_MS).first();
    if (!active) {   // 해체했거나 2주 넘게 활동이 없는 연합: 해적에게 돌아간다
      statements.push(env.DB.prepare(`DELETE FROM mine_state WHERE mine_id = ?2 AND ${open}`).bind(oldWeek, row.mine_id));
      continue;
    }
    production.set(row.union_id, (production.get(row.union_id) || 0) + MINE_SIZES[mine.size].production);
    const war = await env.DB.prepare('SELECT * FROM mine_wars WHERE week = ?1 AND mine_id = ?2').bind(oldWeek, row.mine_id).first();
    if (!war) continue;
    const standing = await warStanding(env, war);
    const challengerHeld = held.find(other => other.union_id === war.challenger_id);
    const challengerWins = canTakeMine(challengerHeld && mineById(challengerHeld.mine_id), mine) && standing.challenger > standing.holder;   // 동점이면 점령 연합 유지
    if (challengerWins) taken.set(row.mine_id, war.challenger_id);
    statements.push(env.DB.prepare(`UPDATE mine_wars SET winner_id = ?3 WHERE week = ?1 AND mine_id = ?2 AND ${open.replace('?1', '?1')}`).bind(oldWeek, row.mine_id, challengerWins ? war.challenger_id : war.holder_id));
    statements.push(env.DB.prepare(`UPDATE mine_state SET union_id = ?3, defended = ?4, since_week = ?5 WHERE mine_id = ?2 AND ${open}`).bind(oldWeek, row.mine_id, challengerWins ? war.challenger_id : war.holder_id, challengerWins ? 0 : row.defended + 1, challengerWins ? nextWeek : war.week));
  }
  // 더 큰 광산을 얻은 연합의 옛 광산은 해적에게 돌아간다. 옛 광산도 쟁탈전에서 빼앗겼다면 새 주인이 갖는다.
  for (const unionId of taken.values()) {
    const old = held.find(other => other.union_id === unionId);
    if (old && !taken.has(old.mine_id)) statements.push(env.DB.prepare(`DELETE FROM mine_state WHERE mine_id = ?2 AND ${open}`).bind(oldWeek, old.mine_id));
  }
  // 저장고에 이번 주 생산을 더하고, 이번 주 CREDIT 비율로 나눈다. 1인 상한을 넘거나 나누고 남은 몫은 저장고에 남긴다.
  for (const [unionId, amount] of production) {
    const saved = await env.DB.prepare('SELECT thorium FROM union_treasury WHERE union_id = ?1').bind(unionId).first();
    const pool = (Number(saved?.thorium) || 0) + amount;
    const members = (await env.DB.prepare('SELECT m.user_id, m.week_points FROM union_members m JOIN identities i ON i.user_id = m.user_id WHERE m.union_id = ?1 AND m.week_day = ?2 AND m.week_points > 0 AND m.joined_at <= ?3').bind(unionId, oldWeek, now - JOIN_WAIT_MS).all()).results || [];
    const total = members.reduce((sum, member) => sum + member.week_points, 0);
    let paid = 0;
    for (const member of members) {
      const share = Math.min(PAYOUT_CAP, Math.floor(pool * member.week_points / total));
      if (share <= 0) continue;
      paid += share;
      statements.push(env.DB.prepare(`INSERT OR IGNORE INTO mine_payouts (week, user_id, union_id, amount, points, total_points) SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE ${open}`).bind(oldWeek, member.user_id, unionId, share, member.week_points, total));
    }
    statements.push(env.DB.prepare(`INSERT INTO union_treasury (union_id, thorium) SELECT ?2, ?3 WHERE ${open} ON CONFLICT(union_id) DO UPDATE SET thorium = ?3`).bind(oldWeek, unionId, pool - paid));
  }
  statements.push(env.DB.prepare(`DELETE FROM mine_battles WHERE week < ?2 AND ${open}`).bind(oldWeek, oldWeek - 56));
  statements.push(env.DB.prepare(`DELETE FROM mine_scores WHERE week < ?2 AND ${open}`).bind(oldWeek, oldWeek - 56));
  statements.push(env.DB.prepare('UPDATE mine_week_state SET week = ?2, wars_week = 0 WHERE id = 1 AND week = ?1').bind(oldWeek, nextWeek));
  await env.DB.batch(statements);
}

// 일요일 0시: 광산마다 도전 연합을 정한다. 신청 연합 중 연합 점수가 점령 연합과 가장 비슷한 연합이 뽑힌다.
async function startWars(env, week, now) {
  const open = 'EXISTS (SELECT 1 FROM mine_week_state WHERE id = 1 AND week = ?1 AND wars_week = 0)';
  const statements = [];
  const held = (await env.DB.prepare('SELECT mine_id, union_id, defended FROM mine_state').bind().all()).results || [];
  for (const row of held) {
    const applicants = (await env.DB.prepare('SELECT union_id FROM mine_challenges WHERE week = ?1 AND mine_id = ?2').bind(week, row.mine_id).all()).results || [];
    const candidates = [];
    for (const applicant of applicants) {
      const applicantHeld = held.find(other => other.union_id === applicant.union_id);
      if (!canTakeMine(applicantHeld && mineById(applicantHeld.mine_id), mineById(row.mine_id))) continue;   // 신청 뒤 토벌로 같거나 큰 광산을 얻은 연합은 뺀다
      if (await env.DB.prepare('SELECT id FROM unions WHERE id = ?1').bind(applicant.union_id).first() && await fleetCount(env, applicant.union_id) >= MIN_FLEETS) candidates.push(applicant.union_id);
    }
    if (!candidates.length) continue;
    const holderGrade = await unionGrade(env, row.union_id, now);
    let best = null, gap = Infinity;
    for (const unionId of candidates.sort()) {
      const distance = Math.abs(await unionGrade(env, unionId, now) - holderGrade);
      if (distance < gap) { gap = distance; best = unionId; }
    }
    const bonus = await fleetCount(env, row.union_id) >= MIN_FLEETS ? holdBonus(row.defended) : 0;
    statements.push(env.DB.prepare(`INSERT OR IGNORE INTO mine_wars (week, mine_id, holder_id, challenger_id, holder_bonus) SELECT ?1, ?2, ?3, ?4, ?5 WHERE ${open}`).bind(week, row.mine_id, row.union_id, best, bonus));
  }
  statements.push(env.DB.prepare('UPDATE mine_week_state SET wars_week = ?1 WHERE id = 1 AND week = ?1 AND wars_week = 0').bind(week));
  await env.DB.batch(statements);
}

// 예약 작업이 없어서 요청이 올 때 한 주 정산과 쟁탈 시작을 처리한다.
export async function rollMines(env, now = Date.now()) {
  const phase = phaseOf(now);
  await env.DB.prepare('INSERT INTO mine_week_state (id, week, wars_week) VALUES (1, ?1, 0) ON CONFLICT(id) DO NOTHING').bind(phase.week).run();
  let state = await env.DB.prepare('SELECT week, wars_week FROM mine_week_state WHERE id = 1').bind().first();
  if (phase.week > state.week) {
    await settleWeek(env, state.week, phase.week, now);
    state = await env.DB.prepare('SELECT week, wars_week FROM mine_week_state WHERE id = 1').bind().first();
  }
  if (phase.war && state.wars_week !== phase.week) await startWars(env, phase.week, now);
  return phase;
}

// 받을 분배 토륨을 지급함으로 보낸다. 우편 번호로 중복을 막는다.
export async function deliverPayouts(env, userId, now = Date.now()) {
  const rows = (await env.DB.prepare('SELECT week, union_id, amount, points, total_points FROM mine_payouts WHERE user_id = ?1 AND delivered_at IS NULL').bind(userId).all()).results || [];
  for (const row of rows) {
    const percent = row.total_points ? Math.round(row.points * 100 / row.total_points) : 0;
    await createGrant(env, {
      userId, orderId: `mine-${userId}-${row.week}-${row.union_id}`, title: '토륨 분배 도착',
      body: `토륨광산 점령에서 이번 주 토륨 분배 몫을 보냅니다.\n이번 주 CREDIT ${row.points} (연합 내 ${percent}%)\n함께 광산을 지켜 주신 노고에 감사드립니다.`,
      items: { thorium: row.amount }
    });
    await env.DB.prepare('UPDATE mine_payouts SET delivered_at = ?1 WHERE week = ?2 AND user_id = ?3 AND union_id = ?4').bind(now, row.week, userId, row.union_id).run();
  }
}

// 하루 출격 횟수를 하나 쓴다. 상한이면 false.
export async function useSortie(env, userId, today) {
  const counted = await env.DB.prepare(
    `INSERT INTO contribution_daily (user_id, day, kind, count) VALUES (?1, ?2, 'mineSortie', 1)
     ON CONFLICT(user_id, day, kind) DO UPDATE SET count = count + 1 WHERE count < ?3`
  ).bind(userId, today, SORTIES_PER_DAY).run();
  return Boolean(counted?.meta?.changes);
}
export async function sortiesUsed(env, userId, today) {
  const row = await env.DB.prepare("SELECT count FROM contribution_daily WHERE user_id = ?1 AND day = ?2 AND kind = 'mineSortie'").bind(userId, today).first();
  return Number(row?.count) || 0;
}

// 다른 이용자의 방어 함대를 내려줄 때 그 연합의 개발 효과를 서버 기록으로 얹는다(게임이 보낸 값을 믿지 않는다).
// 피해 증가와 공격 속도는 초당 피해에 함께 곱한다.
export async function deckWithDev(env, unionId, deck) {
  const levels = await unionDevLevels(env, unionId);
  const level = node => Number(levels[node]) || 0;
  return deck.map(ship => {
    if (!ship) return null;
    const stat = name => (level(`class:${ship.type}:${name}`) + level(`ship:${ship.type}:${ship.name}:${name}`)) * DEV_STEP_EFFECT[name];
    return { ...ship, hp: ship.hp * (1 + stat('hp')), dps: (Number(ship.dps) || 0) * (1 + stat('damage')) * (1 + stat('attackSpeed')), unionReduction: stat('reduction'), unionEnergy: stat('energy') };
  });
}

export function newBattle(env, { userId, unionId, mineId, kind, targetId = null, week, now }) {
  const id = randomToken(12);
  return { id, statement: env.DB.prepare('INSERT INTO mine_battles (id, user_id, union_id, mine_id, kind, target_id, week, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)').bind(id, userId, unionId, mineId, kind, targetId, week, now) };
}

// 지금 그 연합에 있는 연합원의 최고 피해만 더한다. 탈퇴한 연합원의 기록은 빠진다.
export async function raidTotal(env, mineId, unionId) {
  const row = await env.DB.prepare('SELECT COALESCE(SUM(r.best), 0) AS total FROM mine_raids r JOIN union_members m ON m.user_id = r.user_id AND m.union_id = r.union_id WHERE r.mine_id = ?1 AND r.union_id = ?2').bind(mineId, unionId).first();
  return Number(row?.total) || 0;
}
// 토벌 기록: 개인 최고 기록만 남기고 1인 상한까지만 반영한다. 연합 합계가 해적 체력에 이르면 점령하고, 옛 광산은 해적에게 돌아간다.
export async function recordRaid(env, mine, unionId, userId, damage, week) {
  const hp = MINE_SIZES[mine.size].pirate.hp;
  const reported = Math.min(hp, Math.max(0, Math.floor(Number(damage) || 0)));
  const counted = Math.min(recordCap(mine), reported);
  const best = await env.DB.prepare('INSERT INTO mine_raids (mine_id, union_id, user_id, best) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(mine_id, union_id, user_id) DO UPDATE SET best = MAX(best, ?4) RETURNING best').bind(mine.id, unionId, userId, counted).first();
  const total = await raidTotal(env, mine.id, unionId);
  const result = { damage: reported, best: Number(best.best), total, captured: false };
  if (total < hp || !canTakeMine(await heldMineOf(env, unionId), mine)) return result;
  if (await env.DB.prepare('SELECT 1 AS ok FROM mine_wars WHERE week = ?1 AND (holder_id = ?2 OR challenger_id = ?2)').bind(week, unionId).first()) return result;
  const [taken] = await env.DB.batch([
    env.DB.prepare('INSERT INTO mine_state (mine_id, union_id, defended, since_week) VALUES (?1, ?2, 0, ?3) ON CONFLICT(mine_id) DO NOTHING').bind(mine.id, unionId, week),
    env.DB.prepare('DELETE FROM mine_state WHERE union_id = ?2 AND mine_id != ?1 AND EXISTS (SELECT 1 FROM mine_state WHERE mine_id = ?1 AND union_id = ?2)').bind(mine.id, unionId)
  ]);
  if (!taken?.meta?.changes) return result;
  await env.DB.prepare('DELETE FROM mine_raids WHERE mine_id = ?1').bind(mine.id).run();
  return { ...result, captured: true };
}
export const isFastReport = (battle, now) => now - battle.created_at < FAST_WIN_MS;
