// 랭킹에 쓰는 함선 목록: 함종 → 함선 이름 → 기본 희귀도. outputs/command-deck.js 와 같아야 한다(server/test/online.test.mjs 가 비교한다).
// 게임이 보고한 값을 걸러 내는 데 쓴다. 돌파로 희귀도가 오를 수는 있어도 내려갈 수는 없다.
export const RARITY_RANK = { R: 1, SR: 2, SSR: 3, L: 4 };
// 함선 등급의 희귀도 점수. 함선 등급 = 이 값 + 성급. 화면에는 보이지 않고 순위 비교에만 쓴다(값을 바꾸면 다음 보고 때부터 반영된다).
export const SHIP_GRADE = { R: 10, SR: 20, SSR: 30, L: 40 };
export const SHIPS = {
  dreadnought: { '아틀라스': 'R', '궁니르': 'L', '우주항모': 'L', '니미츠': 'L', '앙헬라': 'L', '탱크': 'SSR', '거북선': 'SSR', '콜로서스': 'SSR', '배스천': 'SR', '도저': 'SR', '네메시스': 'SR', '해머': 'R', '아이기스': 'R' },
  battlecruiser: { '야마토': 'L', '퓨리': 'SR', '브라운베스': 'SSR', '돌격 거북선': 'L', '거북선': 'SSR', '마젤란': 'SR', '스타 크루저': 'SR', '아포칼립스': 'R', '아이오와': 'R', '헬리오스': 'R', '아이언피스트': 'SSR', '히페리온': 'L', '라이온하트': 'L' },
  destroyer: { '바랴그': 'L', '행성파괴자': 'L', '수 판옥선': 'L', '스피어': 'R', '우라노스': 'R', '블레이드': 'R', '데이모스': 'SR', '오메가': 'SR', '페가수스': 'SSR', '판도라': 'SSR', 'KDDX': 'SSR', '가루다': 'SR' }
};
// command-deck.js maxStarsFor 와 같은 규칙.
export function maxStars(baseRarity, rarity) {
  if (rarity === 'R') return 3;
  if (baseRarity === 'R' && rarity === 'SR') return 1;
  return 5;
}
