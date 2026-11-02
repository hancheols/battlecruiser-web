// 함선 랭킹 도구: 게임이 보고한 함종별 최고 함선을 검사해 순위 기록으로 저장한다.
import { SHIPS, RARITY_RANK, maxStars } from './ships.js';

export const SHIP_CATEGORIES = ['dreadnought', 'battlecruiser', 'destroyer'];
export const MAX_DEV = 1800;   // 연구 트리 전체 개발 횟수(1,762)를 넘지 않는 상한

// 비교 순서(희귀도 → 성급 → 개발 레벨)를 숫자 하나로 합친다. 종합은 세 척의 합으로 같은 순서를 쓴다.
export const rankKey = (rarity, stars, dev) => rarity * 1e10 + stars * 1e8 + dev;
const gradeOf = (rarity, stars) => rarity * 10 + stars;

// 잘못된 값은 그 함종을 없는 것으로 친다.
function cleanShip(type, ship) {
  if (!ship || typeof ship !== 'object') return null;
  const base = Object.hasOwn(SHIPS[type], ship.name) ? SHIPS[type][ship.name] : null;
  const rarity = Object.hasOwn(RARITY_RANK, ship.rarity) ? RARITY_RANK[ship.rarity] : 0;
  const stars = Number(ship.stars), dev = Number(ship.dev);
  if (!base || rarity < RARITY_RANK[base]) return null;
  if (!Number.isInteger(stars) || stars < 0 || stars > maxStars(base, ship.rarity)) return null;
  if (!Number.isInteger(dev) || dev < 0 || dev > MAX_DEV) return null;
  return { ship: ship.name, rarity: ship.rarity, stars, dev, rank: rarity };
}

export function buildEntries(fleet) {
  const entries = new Map();
  const ships = [];
  for (const type of SHIP_CATEGORIES) {
    const ship = cleanShip(type, fleet?.[type]);
    if (!ship) continue;
    const { rank, ...detail } = ship;
    ships.push({ type, ...ship });
    entries.set(type, { rankKey: rankKey(rank, ship.stars, ship.dev), grade: gradeOf(rank, ship.stars), detail: JSON.stringify(detail) });
  }
  if (ships.length) {
    const sum = pick => ships.reduce((total, ship) => total + pick(ship), 0);
    const dev = sum(ship => ship.dev);
    entries.set('total', {
      rankKey: rankKey(sum(ship => ship.rank), sum(ship => ship.stars), dev),
      grade: sum(ship => gradeOf(ship.rank, ship.stars)),
      detail: JSON.stringify({ ships: ships.map(({ type, ship, rarity, stars, dev: level }) => ({ type, ship, rarity, stars, dev: level })), dev })
    });
  }
  return entries;
}

// 바뀐 칸만 쓴다. 순위 값이 그대로면 달성 시각도 그대로 둔다(먼저 달성한 함장이 위).
export async function saveFleet(env, userId, fleet, now = Date.now()) {
  const entries = buildEntries(fleet);
  const rows = (await env.DB.prepare('SELECT category, rank_key, detail FROM rank_entries WHERE user_id = ?1').bind(userId).all()).results || [];
  const existing = new Map(rows.map(row => [row.category, row]));
  for (const [category, entry] of entries) {
    const row = existing.get(category);
    if (!row) {
      await env.DB.prepare('INSERT INTO rank_entries (user_id, category, rank_key, grade, detail, reached_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(userId, category, entry.rankKey, entry.grade, entry.detail, now).run();
    } else if (row.rank_key !== entry.rankKey) {
      await env.DB.prepare('UPDATE rank_entries SET rank_key = ?1, grade = ?2, detail = ?3, reached_at = ?4 WHERE user_id = ?5 AND category = ?6').bind(entry.rankKey, entry.grade, entry.detail, now, userId, category).run();
    } else if (row.detail !== entry.detail) {
      await env.DB.prepare('UPDATE rank_entries SET detail = ?1 WHERE user_id = ?2 AND category = ?3').bind(entry.detail, userId, category).run();
    }
  }
  for (const category of existing.keys()) {
    if (!entries.has(category)) await env.DB.prepare('DELETE FROM rank_entries WHERE user_id = ?1 AND category = ?2').bind(userId, category).run();
  }
}
