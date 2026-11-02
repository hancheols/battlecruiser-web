// 아레나 규칙(서버용). outputs/arena-core.js 와 같은 값이어야 한다. server/test/arena.test.mjs 가 두 파일을 비교한다.
export const DAY = 86400000;
const OFFSET = 9 * 3600000;
const GROUPS = [['Iron', 3], ['Bronze', 3], ['Silver', 3], ['Gold', 5], ['Diamond', 5], ['Platinum', 5], ['HERO', 5], ['LEGEND', 1]];
const GROUP_POINTS = { Iron: 50, Bronze: 50, Silver: 100, Gold: 150, Diamond: 200, Platinum: 250 };
const HERO_MIN = 3600, LEGEND_MIN = 4600;

const TIER_STARTS = [];
{ let accumulated = 0; GROUPS.forEach(([group, count]) => { if (!GROUP_POINTS[group]) return; for (let division = count; division > 0; division -= 1) { TIER_STARTS.push(accumulated); accumulated += GROUP_POINTS[group]; } }); }

export const TIERS = [];
GROUPS.forEach(([group, count]) => { for (let division = count; division > 0; division -= 1) TIERS.push({ group, division, label: group === 'LEGEND' ? group : `${group} ${division}`, index: TIERS.length }); });

export const day = now => Math.floor((now + OFFSET) / DAY);
export const isWednesday = value => new Date(value * DAY).getUTCDay() === 3;

export function tierIndex(score) {
  const value = Math.max(0, Number(score) || 0);
  if (value >= LEGEND_MIN) return 29;
  if (value >= HERO_MIN) return Math.min(28, 24 + Math.floor((value - HERO_MIN) / 200));
  let index = 0;
  while (index < TIER_STARTS.length - 1 && value >= TIER_STARTS[index + 1]) index += 1;
  return index;
}

export function delta(score, enemy, win) {
  if (win === null) return 0;
  const expected = 1 / (1 + 10 ** ((enemy - score) / 400));
  return win ? Math.max(15, Math.min(45, Math.round(60 * (1 - expected)))) : -Math.max(10, Math.min(30, Math.round(40 * expected)));
}

const DAILY_REWARDS = [[0, 2, 10000, 200], [3, 5, 15000, 220], [6, 8, 20000, 250], [9, 13, 25000, 280], [14, 18, 30000, 300], [19, 23, 35000, 350], [24, 25, 40000, 400], [26, 28, 50000, 500], [29, 29, 70000, 800]];
export function rewards(index, weekly = false) {
  const row = DAILY_REWARDS.find(([from, to]) => index >= from && index <= to) || DAILY_REWARDS[0];
  const multiplier = weekly ? 2 : 1;
  return { gold: row[2] * multiplier, thorium: row[3] * multiplier };
}

export const deckPower = deck => deck.slice(0, 3).reduce((sum, ship) => sum + (Number(ship?.hp) || 0) * (Number(ship?.dps) || 0), 0) || 1;

// 등급 상승 축전. arena.js 의 TIER_THORIUM·TIER_CONGRATS 와 같은 값이다.
const TIER_THORIUM = { Bronze: 100, Silver: 200, Gold: 300, Diamond: 400, Platinum: 500, 'HERO 5': 1000, 'HERO 4': 1000, 'HERO 3': 1000, 'HERO 2': 1000, 'HERO 1': 1500, LEGEND: 2000 };
const TIER_CONGRATS = {
  Bronze: '아이언의 굴레를 벗어났다!!! 이제 우리는 브론즈다! 첫 등급 상승을 진심으로 축하한다!',
  Silver: '실버 등급 달성!!! 더 높은 전장의 문이 열렸다. 지금까지의 노력이 빛을 발하고 있다!!',
  Gold: '골드!!! 이 자리까지 오르는 건 쉽지 않았을 텐데 정말 대단하다! 함대의 기세가 무섭다!!',
  Diamond: '다이아몬드 등급 달성!!! 별처럼 빛나는 지휘관이다. 연합 전체가 함께 환호하고 있다!!!',
  Platinum: '플래티넘!!! 최상위권의 실력이다. 전장을 호령하는 지휘관, 진심으로 축하한다!!!',
  'HERO 5': '히어로 등급 진입!!! 영웅의 이름을 얻었다. 오늘 밤은 축배를 들어도 좋다!!!',
  'HERO 4': '히어로 4 달성!!! 한 계단씩 영웅에 가까워지고 있다. 질주는 멈추지 않는다!!!',
  'HERO 3': '히어로 3 달성!!! 전설의 문턱이 눈앞이다. 정말 놀라운 기세다!!!',
  'HERO 2': '히어로 2 달성!!! 정점이 가까워졌다. 모두가 지휘관의 이름을 기억할 것이다!!!',
  'HERO 1': '히어로 1!!! 최고의 영웅 바로 앞이다. 사령부 전원이 기립 박수를 보낸다!!!!',
  LEGEND: '레전드 달성!!!!! 전설이 되었다. 이 순간을 영원히 기억하겠다. 진심으로, 정말로 축하한다!!!!!'
};
const STEP_RATE = .1;

// 등급 하나를 처음 넘었을 때 보낼 우편. 보상이 없는 등급(아이언)은 null.
export function tierMail(tier) {
  const key = tier.group === 'HERO' ? `HERO ${tier.division}` : tier.group;
  if (!(key in TIER_THORIUM)) return null;
  const first = TIERS.find(item => item.group === tier.group).index === tier.index;
  if (tier.group === 'HERO' || tier.group === 'LEGEND' || first) {
    return { id: key.replace(/\s+/g, ''), title: `등급 상승 축하 · ${key} 달성`, body: TIER_CONGRATS[key], items: { thorium: TIER_THORIUM[key] } };
  }
  return { id: tier.label.replace(/\s+/g, ''), title: `등급 단계 상승 · ${tier.label} 달성`, body: `${tier.group} 등급 안에서 한 단계 더 올랐습니다. 꾸준한 승리를 축하하며 ${tier.group} 등급 축하 토륨의 10%를 보냅니다.`, items: { thorium: Math.round(TIER_THORIUM[tier.group] * STEP_RATE) } };
}
// 게임 저장에 남은 "받은 보상" 이름(Bronze, Bronze 2, HERO 5 등)을 등급 번호로 바꾼다.
export function claimedTierIndex(labels) {
  let best = 0;
  for (const label of Array.isArray(labels) ? labels : []) {
    const tier = TIERS.find(item => item.label === label || item.group === label);
    if (tier) best = Math.max(best, tier.index);
  }
  return best;
}
