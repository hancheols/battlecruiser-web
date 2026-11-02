// 시즌: 28일 단위, 수요일 0시(KST)에 바뀐다. 첫 시즌은 서버를 켠 뒤 처음 오는 수요일에 시작한다.
// 예약 작업이 없어서, 시즌이 끝난 뒤 처음 온 요청이 순위를 찍고 아레나 점수를 조정한다. 보상은 각자 다음 접속 때 우편으로 받는다.
import { createGrant } from './grants.js';
import { day, isWednesday, seasonRewards, tierIndex, tierMinScore, TIERS } from './arena-rules.js';

export const SEASON_DAYS = 28;
export const ACTIVE_DAYS = 14;        // 연합 순위에 넣는 연합원: 최근 14일 안에 접속
const ARENA_RESET_RATE = .3;          // 시즌이 바뀌면 아레나 점수를 30% 로
const ARENA_REWARD_MIN_TIER = 14;     // 다이아몬드 5 이상만 시즌 보상

// 순위 보상. 게임 화면도 이 표를 받아 그린다.
export const RANK_REWARDS = {
  total: [
    { max: 1, label: '1위', gold: 300000, thorium: 3000 },
    { max: 10, label: '2–10위', gold: 200000, thorium: 2000 },
    { max: 100, label: '11–100위', gold: 100000, thorium: 1000 },
    { max: 500, label: '101–500위', gold: 50000, thorium: 400 }
  ],
  ship: [{ max: 1, label: '1위', gold: 100000, thorium: 1000 }],
  alliance: [{ max: 1, label: '1위 연합 전원', gold: 0, thorium: 500 }]
};
const TOTAL_LIMIT = RANK_REWARDS.total.at(-1).max;
const SHIP_LABELS = { dreadnought: '중전함', battlecruiser: '배틀크루저', destroyer: '구축함' };
export const rewardTable = category => category === 'alliance' ? RANK_REWARDS.alliance : category === 'total' ? RANK_REWARDS.total : Object.hasOwn(SHIP_LABELS, category) ? RANK_REWARDS.ship : [];

function firstWednesday(today) {
  let value = today;
  while (!isWednesday(value)) value += 1;
  return value;
}

export async function currentSeason(env, now = Date.now()) {
  const row = await env.DB.prepare('SELECT number, start_day, end_day FROM season_state WHERE id = 1').bind().first();
  if (row) return row;
  const start = firstWednesday(day(now));
  await env.DB.prepare('INSERT INTO season_state (id, number, start_day, end_day) VALUES (1, 1, ?1, ?2) ON CONFLICT(id) DO NOTHING').bind(start, start + SEASON_DAYS).run();
  return env.DB.prepare('SELECT number, start_day, end_day FROM season_state WHERE id = 1').bind().first();
}

export function seasonView(season, now = Date.now()) {
  const today = day(now), started = today >= season.start_day;
  return { number: season.number, started, daysLeft: Math.max(0, (started ? season.end_day : season.start_day) - today) };
}

// 어떤 주(그 주가 끝나는 수요일 날짜)가 속한 시즌 번호. 시즌이 끝나는 수요일은 끝나는 시즌에 속한다. 첫 시즌 전이면 0.
export function seasonOfWeek(season, weekEndDay) {
  if (weekEndDay > season.start_day) return season.number;
  return Math.max(0, season.number - Math.ceil((season.start_day - weekEndDay + 1) / SEASON_DAYS));
}

// 시즌이 끝났으면 한 번에(트랜잭션으로) 처리한다: 보상 자격 기록 → 아레나 점수·전적 조정 → 다음 시즌.
// 문장마다 "아직 이 시즌이 끝나지 않았는지"를 확인하므로, 요청이 겹쳐도 한 번만 반영된다.
export async function rollSeason(env, now = Date.now()) {
  const season = await currentSeason(env, now);
  const today = day(now);
  if (today < season.end_day) return season;
  const open = 'EXISTS (SELECT 1 FROM season_state WHERE id = 1 AND number = ?1)';
  const board = (category, limit) => env.DB.prepare(
    `INSERT OR IGNORE INTO season_rewards (season, user_id, category, rank)
     SELECT ?1, user_id, ?2, rn FROM (SELECT user_id, ROW_NUMBER() OVER (ORDER BY rank_key DESC, reached_at ASC) AS rn FROM rank_entries WHERE category = ?2 ORDER BY rn LIMIT ?3)
     WHERE ${open}`
  ).bind(season.number, category, limit);
  const activeSince = now - ACTIVE_DAYS * 86400000;
  await env.DB.batch([
    board('total', TOTAL_LIMIT),
    ...Object.keys(SHIP_LABELS).map(category => board(category, 1)),
    env.DB.prepare(
      `INSERT OR IGNORE INTO season_rewards (season, user_id, category, rank)
       SELECT ?1, m.user_id, 'alliance', 1 FROM union_members m
       WHERE m.union_id = (SELECT a.union_id FROM union_members a JOIN players p ON p.user_id = a.user_id JOIN rank_entries r ON r.user_id = a.user_id AND r.category = 'total' JOIN unions u ON u.id = a.union_id WHERE p.last_seen >= ?2 GROUP BY a.union_id ORDER BY SUM(r.grade) DESC, u.created_at ASC LIMIT 1)
       AND ${open}`
    ).bind(season.number, activeSince),
    env.DB.prepare(`INSERT OR IGNORE INTO season_rewards (season, user_id, category, rank, value) SELECT ?1, user_id, 'arena', 0, score FROM arena_players WHERE defense_power > 0 AND score >= ?2 AND ${open}`).bind(season.number, tierMinScore(ARENA_REWARD_MIN_TIER)),
    env.DB.prepare(`UPDATE arena_players SET score = CAST(score * ?2 AS INTEGER), wins = 0, losses = 0, draws = 0 WHERE ${open}`).bind(season.number, ARENA_RESET_RATE),
    env.DB.prepare('UPDATE season_state SET number = number + 1, start_day = end_day, end_day = end_day + ?2 WHERE id = 1 AND number = ?1').bind(season.number, SEASON_DAYS)
  ]);
  return currentSeason(env, now);
}

function mailFor(row, arena) {
  const n = row.season;
  const thanks = '시즌 내내 함대를 이끌어 주신 지휘관님의 노고에 감사드립니다. 보상을 전달합니다.';
  if (row.category === 'arena') {
    const index = tierIndex(row.value);
    const reward = seasonRewards(index, { seasonWeekMissed: JSON.parse(arena?.missed_seasons || '[]').includes(n) });
    if (!reward) return null;
    const items = Object.fromEntries(Object.entries(reward).filter(([, amount]) => amount > 0));
    return { orderId: `arena-season-${row.user_id}-${n}`, title: `아레나 시즌 ${n} 보상 · ${TIERS[index].label}`, body: `축하합니다! 시즌 ${n}을 ${TIERS[index].label} 등급으로 마치셨습니다. 한 주도 빠짐없이 전선을 지켜 주신 지휘관님의 노고에 진심으로 감사드립니다.`, items };
  }
  if (row.category === 'alliance') return { orderId: `season-${row.user_id}-${n}-alliance`, title: `시즌 ${n} 연합 1위 보상`, body: `축하합니다! 소속 연합이 시즌 ${n} 연합 순위 1위에 올랐습니다. 함께 싸워 주신 모든 연합원의 노고에 감사드립니다.`, items: { thorium: RANK_REWARDS.alliance[0].thorium } };
  const tier = rewardTable(row.category).find(item => row.rank <= item.max);
  if (!tier) return null;
  const place = row.category === 'total' ? `종합 ${row.rank}위` : `${SHIP_LABELS[row.category]} ${row.rank}위`;
  return { orderId: `season-${row.user_id}-${n}-${row.category}`, title: `시즌 ${n} 랭킹 보상 · ${place}`, body: `축하합니다! 시즌 ${n} 랭킹 ${place}에 오르셨습니다. ${thanks}`, items: { gold: tier.gold, thorium: tier.thorium } };
}

// 받을 시즌 보상을 지급함으로 보낸다. 우편 번호로 중복을 막으므로 다시 불러도 안전하다.
// 아레나 보상은 주간 정산이 끝나야 자격을 알 수 있어, 정산 뒤(/api/arena)에서만 보낸다(includeArena).
export async function deliverSeasonRewards(env, userId, { includeArena = false } = {}, now = Date.now()) {
  const rows = (await env.DB.prepare('SELECT season, user_id, category, rank, value FROM season_rewards WHERE user_id = ?1 AND delivered_at IS NULL').bind(userId).all()).results || [];
  const pending = rows.filter(row => includeArena || row.category !== 'arena');
  if (!pending.length) return 0;
  const arena = includeArena ? await env.DB.prepare('SELECT missed_seasons FROM arena_players WHERE user_id = ?1').bind(userId).first() : null;
  let sent = 0;
  for (const row of pending) {
    const mail = mailFor(row, arena);
    if (mail) { await createGrant(env, { userId, ...mail }); sent += 1; }
    await env.DB.prepare('UPDATE season_rewards SET delivered_at = ?1 WHERE season = ?2 AND user_id = ?3 AND category = ?4').bind(now, row.season, userId, row.category).run();
  }
  return sent;
}
