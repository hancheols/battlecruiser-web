// CREDIT(연합 기여도)과 연합 개발. CREDIT 은 활동마다 서버가 정한 점수만 쌓이고, 활동별 일일 상한을 넘으면 쌓이지 않는다.
// 쌓인 점수는 세 곳에 들어간다: 이번 주·연합 누적 CREDIT(union_members), 연합 경험치(unions.exp), 내가 쓸 수 있는 CREDIT(union_progress).
import { isWednesday, day } from './arena-rules.js';
import { SHIPS } from './ships.js';

// 활동별 점수와 하루 상한(횟수). 함대파견은 지역이 어려울수록 많다.
export const ACTIVITIES = {
  attendance: { label: '일일 출석', points: 5, cap: 1 },
  arena: { label: '아레나 대전', points: 5, cap: 5 },
  bounty: { label: '현상수배 도전', points: 10, cap: 5 },
  bountyWin: { label: '현상수배 격파', points: 20, cap: 2 },
  dispatch: { label: '함대파견 완료', points: 10, cap: 3 },
  mine: { label: '광산 출격', points: 10, cap: 3 }
};
export const DISPATCH_POINTS = { mars: 10, titan: 15, oort1: 20, oort2: 25, oort3: 30, oort4: 35, oort5: 40 };

export const ACTIVE_DAYS_FOR_SCORE = 14;   // 연합 점수에 넣는 연합원: 최근 14일 안에 접속

// 연합 레벨: 필요한 누적 경험치. 레벨마다 정원 +1, 연합 개발 단계 상한 +1.
export const LEVEL_EXP = [0, 5000, 15000, 35000, 70000, 120000, 190000, 280000, 400000, 550000];
export const BASE_CAPACITY = 30;
export const levelForExp = exp => { let level = 1; while (level < LEVEL_EXP.length && exp >= LEVEL_EXP[level]) level += 1; return level; };
export const capacityForLevel = level => BASE_CAPACITY + level - 1;
export function levelProgress(exp, level) {
  if (level >= LEVEL_EXP.length) return { next: null, percent: 100 };
  const from = LEVEL_EXP[level - 1], to = LEVEL_EXP[level];
  return { next: to, percent: Math.min(100, Math.floor((exp - from) * 100 / (to - from))) };
}

// 주는 수요일 0시(KST)에 바뀐다. 그 주가 시작된 수요일의 날짜 번호를 돌려준다.
export function weekOf(today) {
  let value = today;
  while (!isWednesday(value)) value -= 1;
  return value;
}

// 연합 개발: 연합이 함께 소유한다. 연합원이 각자의 CREDIT 을 항목에 기여해 총량을 채우면 한 단계 오른다.
// 1인 하루 기여 상한이 있어서 실제 연합원이 많을수록 빨리 오른다. 함종 개발과 함선 개발의 효과는 서로 더해진다.
// 단계 하나: 내구도·피해 증가 +0.5%, 공격 속도 +0.3%, 피해 감소 +0.2%, 발동 에너지 -0.4%. 10단계 × 2종이다.
export const DEV_MAX_LEVEL = 10;
export const DEV_STATS_BY_TYPE = {
  dreadnought: ['hp', 'reduction', 'energy'],
  battlecruiser: ['damage', 'reduction', 'energy'],
  destroyer: ['damage', 'attackSpeed', 'energy']
};
export const DEV_STEP_EFFECT = { hp: .005, damage: .005, attackSpeed: .003, reduction: .002, energy: .004 };
const DEV_STAT_LABEL = { hp: '내구도', damage: '피해 증가', attackSpeed: '공격 속도', reduction: '피해 감소', energy: '발동 에너지' };
const DEV_TYPE_LABEL = { dreadnought: '중전함', battlecruiser: '전투순양함', destroyer: '구축함' };
export const DEV_DAILY_CAP = 100;      // 1인 하루 기여 상한(CREDIT)
const DEV_CLASS_STEP = 1000;           // 함종 개발 n단계 총량 = 1000 × n
const DEV_SHIP_STEP = { R: 300, SR: 500, SSR: 800, L: 1200 };   // 함선 개발 n단계 총량 = 등급 값 × n
const DEV_TIERS = ['R', 'SR', 'SSR', 'L'];
// 다음 등급을 열려면 바로 아래 등급에서 함선 개발을 합쳐 이만큼 해야 한다. 어느 함선에 쓸지는 연합이 정한다.
export const DEV_TIER_GATE = { SR: 10, SSR: 15, L: 20 };
export const devCost = (parsed, nextLevel) => (parsed.scope === 'class' ? DEV_CLASS_STEP : DEV_SHIP_STEP[parsed.tier]) * nextLevel;

// 항목 이름: class:<함종>:<능력> 또는 ship:<함종>:<함선>:<능력>. 함종에 없는 능력이나 잘못된 이름은 null.
export function parseDevNode(node) {
  const parts = String(node || '').split(':');
  const type = parts[1], stat = parts.at(-1);
  if (!Object.hasOwn(DEV_STATS_BY_TYPE, type || '') || !DEV_STATS_BY_TYPE[type].includes(stat)) return null;
  if (parts[0] === 'class' && parts.length === 3) return { scope: 'class', type, stat, label: `${DEV_TYPE_LABEL[type]} ${DEV_STAT_LABEL[stat]}` };
  if (parts[0] === 'ship' && parts.length === 4 && Object.hasOwn(SHIPS[type], parts[2])) return { scope: 'ship', type, stat, name: parts[2], tier: SHIPS[type][parts[2]], label: `${parts[2]} ${DEV_STAT_LABEL[stat]}` };
  return null;
}
const tierNames = (type, tier) => Object.keys(SHIPS[type]).filter(name => SHIPS[type][name] === tier);
const tierSteps = (levels, type, tier) => tierNames(type, tier).reduce((sum, name) => sum + DEV_STATS_BY_TYPE[type].reduce((n, stat) => n + (Number(levels[`ship:${type}:${name}:${stat}`]) || 0), 0), 0);
export function devTierOpen(levels, type, tier) {
  for (let index = 1; index <= DEV_TIERS.indexOf(tier); index += 1) {
    if (tierSteps(levels, type, DEV_TIERS[index - 1]) < DEV_TIER_GATE[DEV_TIERS[index]]) return false;
  }
  return true;
}

// 활동 점수를 쌓는다. 연합에 없으면 아무것도 하지 않는다. 쌓인 점수를 돌려준다(상한이면 0).
export async function award(env, userId, kind, { points, now = Date.now() } = {}) {
  const activity = Object.hasOwn(ACTIVITIES, kind) ? ACTIVITIES[kind] : null;
  if (!activity) return 0;
  const member = await env.DB.prepare('SELECT union_id FROM union_members WHERE user_id = ?1').bind(userId).first();
  if (!member) return 0;
  const today = day(now);
  const counted = await env.DB.prepare(
    `INSERT INTO contribution_daily (user_id, day, kind, count) VALUES (?1, ?2, ?3, 1)
     ON CONFLICT(user_id, day, kind) DO UPDATE SET count = count + 1 WHERE count < ?4`
  ).bind(userId, today, kind, activity.cap).run();
  if (!counted?.meta?.changes) return 0;
  const gained = Math.max(0, Math.floor(points ?? activity.points));
  if (!gained) return 0;
  const week = weekOf(today);
  await env.DB.prepare(
    `UPDATE union_members SET contribution = contribution + ?1,
       week_points = CASE WHEN week_day = ?2 THEN week_points + ?1 ELSE ?1 END, week_day = ?2 WHERE user_id = ?3`
  ).bind(gained, week, userId).run();
  await env.DB.prepare('INSERT INTO union_progress (user_id, earned, spent) VALUES (?1, ?2, 0) ON CONFLICT(user_id) DO UPDATE SET earned = earned + ?2').bind(userId, gained).run();
  const union = await env.DB.prepare('UPDATE unions SET exp = exp + ?1 WHERE id = ?2 RETURNING exp, level').bind(gained, member.union_id).first();
  const level = levelForExp(union.exp);
  if (level !== union.level) await env.DB.prepare('UPDATE unions SET level = ?1, capacity = ?2 WHERE id = ?3').bind(level, capacityForLevel(level), member.union_id).run();
  await env.DB.prepare('INSERT INTO union_log (union_id, user_id, text, points, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(member.union_id, userId, activity.label, gained, now).run();
  // 활동 기록은 30일만 보관한다. 쓸 때 가끔 정리한다.
  if (Math.random() < .02) await env.DB.prepare('DELETE FROM union_log WHERE created_at < ?1').bind(now - 30 * 86400000).run();
  return gained;
}

const DEV_RULES = {
  maxLevel: DEV_MAX_LEVEL, classStep: DEV_CLASS_STEP, shipStep: DEV_SHIP_STEP, gate: DEV_TIER_GATE, stats: DEV_STATS_BY_TYPE,
  ships: Object.fromEntries(Object.keys(DEV_STATS_BY_TYPE).map(type => [type, Object.fromEntries(DEV_TIERS.map(tier => [tier, tierNames(type, tier)]))]))
};
export async function unionDevLevels(env, unionId) {
  const rows = (await env.DB.prepare('SELECT node, level FROM union_dev WHERE union_id = ?1').bind(unionId).all()).results || [];
  return Object.fromEntries(rows.map(row => [row.node, row.level]));
}
const devGivenToday = async (env, userId, today) => Number((await env.DB.prepare("SELECT count FROM contribution_daily WHERE user_id = ?1 AND day = ?2 AND kind = 'devGive'").bind(userId, today).first())?.count) || 0;

// 내 CREDIT 과 오늘 기여한 양, 소속 연합의 개발 현황. CREDIT 은 개인 것이라 연합을 옮겨도 남고, 개발 단계는 연합에 남는다.
export async function devState(env, userId, unionId = null, now = Date.now()) {
  const progress = await env.DB.prepare('SELECT earned, spent FROM union_progress WHERE user_id = ?1').bind(userId).first();
  const rows = unionId ? (await env.DB.prepare('SELECT node, level, invested FROM union_dev WHERE union_id = ?1').bind(unionId).all()).results || [] : [];
  const focus = unionId ? await env.DB.prepare('SELECT node FROM union_dev_focus WHERE union_id = ?1').bind(unionId).first() : null;
  return {
    credit: Number(progress?.earned || 0) - Number(progress?.spent || 0),
    today: await devGivenToday(env, userId, day(now)), dailyCap: DEV_DAILY_CAP,
    levels: Object.fromEntries(rows.map(row => [row.node, row.level])),
    invested: Object.fromEntries(rows.filter(row => row.invested > 0).map(row => [row.node, row.invested])),
    focus: focus?.node || null,
    rules: DEV_RULES
  };
}

// CREDIT 기여. 내 잔액, 오늘 남은 상한, 이번 단계에 남은 양 중 가장 작은 만큼만 쓴다. 총량을 채우면 한 단계 오른다.
export async function giveDevCredit(env, userId, union, node, amount, now = Date.now()) {
  const parsed = parseDevNode(node);
  if (!parsed) return { error: 'bad-node', message: '개발 항목이 올바르지 않습니다.' };
  const levels = await unionDevLevels(env, union.id);
  const level = Number(levels[node]) || 0, next = level + 1;
  if (next > DEV_MAX_LEVEL) return { error: 'max-level', message: '이미 최고 단계입니다.' };
  if (next > union.level) return { error: 'union-level', message: `연합 레벨 ${next} 이상에서 개발할 수 있습니다.` };
  if (parsed.scope === 'ship' && !devTierOpen(levels, parsed.type, parsed.tier)) return { error: 'tier-locked', message: `${parsed.tier} 등급은 아직 열리지 않았습니다.` };
  const today = day(now), cost = devCost(parsed, next);
  const row = await env.DB.prepare('SELECT invested FROM union_dev WHERE union_id = ?1 AND node = ?2').bind(union.id, node).first();
  const progress = await env.DB.prepare('SELECT earned, spent FROM union_progress WHERE user_id = ?1').bind(userId).first();
  const credit = Number(progress?.earned || 0) - Number(progress?.spent || 0), dailyLeft = DEV_DAILY_CAP - await devGivenToday(env, userId, today);
  if (dailyLeft <= 0) return { error: 'daily-cap', message: `오늘 기여 상한(${DEV_DAILY_CAP} CREDIT)을 모두 썼습니다.` };
  if (credit <= 0) return { error: 'no-credit', message: 'CREDIT이 부족합니다.' };
  const given = Math.min(Math.floor(Number(amount) || 0), credit, dailyLeft, cost - (Number(row?.invested) || 0));
  if (given <= 0) return { error: 'bad-amount', message: '기여할 CREDIT을 정해 주세요.' };
  // 차감이 먼저다. 동시에 눌려 잔액이나 상한을 넘으면 여기서 막히고, 막히면 앞 단계를 되돌린다.
  const counted = await env.DB.prepare(
    `INSERT INTO contribution_daily (user_id, day, kind, count) VALUES (?1, ?2, 'devGive', ?3)
     ON CONFLICT(user_id, day, kind) DO UPDATE SET count = count + ?3 WHERE count + ?3 <= ?4`
  ).bind(userId, today, given, DEV_DAILY_CAP).run();
  if (!counted?.meta?.changes) return { error: 'daily-cap', message: `오늘 기여 상한(${DEV_DAILY_CAP} CREDIT)을 모두 썼습니다.` };
  const paid = await env.DB.prepare('UPDATE union_progress SET spent = spent + ?1 WHERE user_id = ?2 AND earned - spent >= ?1').bind(given, userId).run();
  if (!paid?.meta?.changes) {
    await env.DB.prepare("UPDATE contribution_daily SET count = count - ?1 WHERE user_id = ?2 AND day = ?3 AND kind = 'devGive'").bind(given, userId, today).run();
    return { error: 'no-credit', message: 'CREDIT이 부족합니다.' };
  }
  const saved = await env.DB.prepare('INSERT INTO union_dev (union_id, node, level, invested) VALUES (?1, ?2, 0, ?3) ON CONFLICT(union_id, node) DO UPDATE SET invested = invested + ?3 RETURNING level, invested').bind(union.id, node, given).first();
  // 여럿이 동시에 채우면 넘친 양은 다음 단계로 넘어간다.
  const raised = saved.invested >= cost && saved.level === level
    ? await env.DB.prepare('UPDATE union_dev SET level = level + 1, invested = invested - ?1 WHERE union_id = ?2 AND node = ?3 AND level = ?4 AND invested >= ?1').bind(cost, union.id, node, level).run()
    : null;
  const leveled = Boolean(raised?.meta?.changes);
  await env.DB.prepare('INSERT INTO union_log (union_id, user_id, text, points, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(union.id, userId, leveled ? `${parsed.label} ${next}단계 개발 완료` : `${parsed.label} 개발 기여`, given, now).run();
  return { given, leveled, level: leveled ? next : level };
}

// 연합장·부연합장이 정하는 연구 목표. 연합원에게 보이는 표시이고, 다른 항목에 기여하는 것을 막지는 않는다.
export async function setDevFocus(env, unionId, node) {
  if (node === null) {
    await env.DB.prepare('DELETE FROM union_dev_focus WHERE union_id = ?1').bind(unionId).run();
    return { focus: null };
  }
  if (!parseDevNode(node)) return { error: 'bad-node', message: '개발 항목이 올바르지 않습니다.' };
  await env.DB.prepare('INSERT INTO union_dev_focus (union_id, node) VALUES (?1, ?2) ON CONFLICT(union_id) DO UPDATE SET node = ?2').bind(unionId, node).run();
  return { focus: node };
}
