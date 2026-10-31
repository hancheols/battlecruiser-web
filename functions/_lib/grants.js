// 지급함 도구: 게임 계정에 물품을 보내는 기록을 만든다. 결제 확인(나중에 PG 연결)과 운영자 보상이 함께 쓴다.
import { randomToken } from './util.js';
import { packFor } from './catalog.js';

// 게임 우편함(commander-profile.js mailRewards)이 받을 수 있는 물품만 허용한다.
export const GRANT_ITEMS = ['gold', 'thorium', 'lionToken', 'scoutTron', 'researchStaff', 'ssrShipTicket', 'frameTicket', 'frameCannon', 'frameMissile', 'frameLaser', 'framePiercing', 'frameCarrier', 'frameElectric', 'thoriumBox', 'goldVault', 'journal', 'core', 'precisionScout'];

export function cleanItems(items) {
  if (!items || typeof items !== 'object') return null;
  const clean = {};
  for (const [key, value] of Object.entries(items)) {
    if (!GRANT_ITEMS.includes(key)) return null;
    const amount = Number(value);
    if (!Number.isInteger(amount) || amount <= 0 || amount > 10000000) return null;
    clean[key] = amount;
  }
  return Object.keys(clean).length ? clean : null;
}

// 지급 기록을 만든다. 같은 orderId 로 다시 부르면 새로 만들지 않고 기존 지급 id 를 돌려준다(결제 확인 재시도에 안전).
export async function createGrant(env, { userId, orderId = null, title, body, items }) {
  const clean = cleanItems(items);
  if (!userId || !clean || !title || !body) throw new Error('bad-grant');
  if (orderId) {
    const existing = await env.DB.prepare('SELECT id FROM grants WHERE order_id = ?1').bind(orderId).first();
    if (existing) return { id: existing.id, created: false };
  }
  const id = randomToken(12);
  const result = await env.DB.prepare(
    'INSERT INTO grants (id, user_id, order_id, title, body, items, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(order_id) DO NOTHING'
  ).bind(id, userId, orderId, String(title).slice(0, 80), String(body).slice(0, 2000), JSON.stringify(clean), Date.now()).run();
  if (orderId && !result?.meta?.changes) {
    const existing = await env.DB.prepare('SELECT id FROM grants WHERE order_id = ?1').bind(orderId).first();
    return { id: existing.id, created: false };
  }
  return { id, created: true };
}

// 웹 상점 결제 1건 → 사자증표 지급(구매분 + 웹 보너스). 결제 금액 확인은 부르는 쪽(PG 확인)에서 끝낸 뒤 부른다.
export async function grantLionTokenPack(env, { userId, orderId, amount }) {
  const pack = packFor(amount);
  if (!pack) throw new Error('bad-pack');
  const detail = pack.bonus ? `구매 ${pack.amount}개 + 웹 구매 보너스 ${pack.bonus}개` : `구매 ${pack.amount}개`;
  return createGrant(env, {
    userId, orderId,
    title: `웹 상점 구매 · 사자증표 ${pack.total}개`,
    body: `공식 웹 상점에서 구매하신 사자증표가 도착했습니다.\n주문번호 ${orderId}\n${detail}\n아래 수령 버튼을 눌러 받아 주세요.`,
    items: { lionToken: pack.total }
  });
}
