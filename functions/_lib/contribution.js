// 연합 기여도와 연합 개발. 기여도는 활동마다 서버가 정한 점수만 쌓이고, 활동별 일일 상한을 넘으면 쌓이지 않는다.
// 쌓인 점수는 세 곳에 들어간다: 이번 주·연합 누적 기여(union_members), 연합 경험치(unions.exp), 개인 연구 포인트(union_progress).
import { isWednesday, day } from './arena-rules.js';
import { SHIPS } from './ships.js';

// 활동별 점수와 하루 상한(횟수). 함대파견은 지역이 어려울수록 많다.
export const ACTIVITIES = {
  attendance: { label: '일일 출석', points: 5, cap: 1 },
  arena: { label: '아레나 대전', points: 5, cap: 5 },
  bounty: { label: '현상수배 도전', points: 10, cap: 5 },
  bountyWin: { label: '현상수배 격파', points: 20, cap: 2 },
  dispatch: { label: '함대파견 완료', points: 10, cap: 3 }
};
export const DISPATCH_POINTS = { mars: 10, titan: 15, oort1: 20, oort2: 25, oort3: 30, oort4: 35, oort5: 40 };

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

// 연합 개발 항목. 단계마다 효과가 더해지고, 함종 개발과 함선 개발은 서로 더해진다.
// 단계 하나: 내구도 +0.5%, 피해 감소 +0.2%, 핵심기술 발동 에너지 -0.4%. 10단계 × 2종이므로 최대 +10%, 4%, -8% 이다.
export const DEV_MAX_LEVEL = 10;
export const DEV_STATS = ['hp', 'reduction', 'energy'];
const DEV_STEP_COST = { class: 100, ship: 60 };
export const devCost = (scope, nextLevel) => DEV_STEP_COST[scope] * nextLevel;

// 항목 이름: class:<함종>:<능력> 또는 ship:<함종>:<함선>:<능력>. 잘못된 이름은 null.
export function parseDevNode(node) {
  const parts = String(node || '').split(':');
  const stat = parts.at(-1);
  if (!DEV_STATS.includes(stat) || !Object.hasOwn(SHIPS, parts[1] || '')) return null;
  if (parts[0] === 'class' && parts.length === 3) return { scope: 'class', stat };
  if (parts[0] === 'ship' && parts.length === 4 && Object.hasOwn(SHIPS[parts[1]], parts[2])) return { scope: 'ship', stat };
  return null;
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

// 내 연구 포인트와 개발 단계. 연합 레벨이 상한이므로 다른 연합으로 옮기면 효과가 그 연합 레벨까지만 적용된다.
export async function devState(env, userId) {
  const progress = await env.DB.prepare('SELECT earned, spent FROM union_progress WHERE user_id = ?1').bind(userId).first();
  const rows = (await env.DB.prepare('SELECT node, level FROM union_dev WHERE user_id = ?1').bind(userId).all()).results || [];
  return { points: Number(progress?.earned || 0) - Number(progress?.spent || 0), levels: Object.fromEntries(rows.map(row => [row.node, row.level])) };
}

// 개발 한 단계 올리기. 포인트가 모자라면 차감되지 않는다.
export async function upgradeDev(env, userId, node, unionLevel) {
  const parsed = parseDevNode(node);
  if (!parsed) return { error: 'bad-node', message: '개발 항목이 올바르지 않습니다.' };
  const row = await env.DB.prepare('SELECT level FROM union_dev WHERE user_id = ?1 AND node = ?2').bind(userId, node).first();
  const next = Number(row?.level || 0) + 1;
  if (next > DEV_MAX_LEVEL) return { error: 'max-level', message: '이미 최고 단계입니다.' };
  if (next > unionLevel) return { error: 'union-level', message: `연합 레벨 ${next} 이상에서 개발할 수 있습니다.` };
  const cost = devCost(parsed.scope, next);
  const paid = await env.DB.prepare('UPDATE union_progress SET spent = spent + ?1 WHERE user_id = ?2 AND earned - spent >= ?1').bind(cost, userId).run();
  if (!paid?.meta?.changes) return { error: 'no-points', message: `연구 포인트가 부족합니다. (필요 ${cost})` };
  await env.DB.prepare('INSERT INTO union_dev (user_id, node, level) VALUES (?1, ?2, ?3) ON CONFLICT(user_id, node) DO UPDATE SET level = ?3').bind(userId, node, next).run();
  return { level: next, cost };
}
