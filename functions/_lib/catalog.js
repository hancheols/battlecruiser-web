// 웹 상점 상품표(서버 기준). 주문을 만들 때 가격·보너스는 화면이 보낸 값이 아니라 이 표로 계산한다.
// 홈페이지 store.js 의 PACKS·UNIT_PRICE·bonusOf 와 같은 값이어야 한다.
export const UNIT_PRICE = 1500;                      // 사자증표 1개, 원(부가세 포함)
export const PACKS = [1, 5, 10, 20, 50, 100, 200];
export const bonusOf = amount => (amount >= 5 ? Math.floor(amount * 0.2) : 0);   // 웹 구매 보너스: 5개 이상 20%(버림)

// 묶음 수량 → { amount, bonus, total, price }. 판매하지 않는 수량이면 null.
export function packFor(amount) {
  const value = Number(amount);
  if (!PACKS.includes(value)) return null;
  const bonus = bonusOf(value);
  return { amount: value, bonus, total: value + bonus, price: value * UNIT_PRICE };
}
