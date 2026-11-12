// 함장 훈련: 주인공 계급(진급·계급장)과 함장 카드(획득·훈련·함선 배치).
// 아스만 사령부 1관문을 처음 클리어하면 연구실 '함장 훈련' 탭이 열린다.
// 계급 버프(공격력·내구도)와 함장 효과는 캠페인 전투에만 적용하고, 아레나·광산 쟁탈전에는 적용하지 않는다.
(() => {
  'use strict';
  const STORE = 'starfleet-captain-training-v1';
  const RESOURCE_KEY = 'starfleet-game-resources-v1';
  const PROFILE_KEY = 'starfleet-commander-profile-v1';
  const FORMATION_KEY = 'starfleet-fleet-formation-v1';
  const MEMBERSHIP_KEY = 'starfleet-membership-unlocked-v1';
  const MAX_LEVEL = 30;
  // 비전문 함선에 탑승하면 함선의 공격력·공격 속도·내구도가 이만큼 낮아진다(함장 효과·특수기술은 그대로 적용).
  const OFF_SPEC_PENALTY = .15;
  const OFF_SPEC_TEXT = `공격·공속·내구 -${Math.round(OFF_SPEC_PENALTY * 100)}%`;
  const ROLE_NAMES = ['선봉', '좌익', '우익'];
  const TYPE_NAMES = { dreadnought: '중전함', battlecruiser: '전투순양함', destroyer: '구축함', frigate: '프리깃' };
  const TYPE_EN = { dreadnought: 'DREADNOUGHT', battlecruiser: 'BATTLECRUISER', destroyer: 'DESTROYER' };
  const GRADE = { standard: { label: 'STANDARD', passive: [.02, .10], costScale: 1 }, elite: { label: 'ELITE', passive: [.03, .15], costScale: 1.5 } };

  // 계급: 챕터 1~5 클리어마다 한 단계, Commodore 부터는 함대 수준과 Membership 이 필요하다.
  const RANKS = [
    { name: 'Lieutenant', abbr: 'Lt.', bonus: 0, need: '시작 계급' },
    { name: 'Flotilla Lieutenant', abbr: 'Flot. Lt.', bonus: .01, need: 'CHAPTER 1 클리어' },
    { name: 'Squadron Lieutenant', abbr: 'Sqn. Lt.', bonus: .02, need: 'CHAPTER 2 클리어' },
    { name: 'Captain', abbr: 'Capt.', bonus: .03, need: 'CHAPTER 3 클리어' },
    { name: 'Flotilla Captain', abbr: 'Flot. Capt.', bonus: .04, need: 'CHAPTER 4 클리어' },
    { name: 'Squadron Captain', abbr: 'Sqn. Capt.', bonus: .06, need: 'CHAPTER 5 클리어' },
    { name: 'Commodore', abbr: 'Cdre.', bonus: .08, need: '일정 함대 수준 이상 및 Membership 필요', detail: '주력 3척 모두 L급 ★3 이상', stars: 3 },
    { name: 'Rear Admiral', abbr: 'RAdm.', bonus: .10, need: '일정 함대 수준 이상 및 Membership 필요', detail: '주력 3척 모두 L급 ★5', stars: 5 }
  ];

  // 함장 목록. 특수기술 수치는 훈련 Lv.1 → Lv.30 사이에서 고르게 오른다.
  const CAPTAINS = [
    { id: 'hero', grade: 'standard', type: 'battlecruiser', hero: true, look: 'cap', accent: '#7fe3ff',
      bio: 'United Star Fleet 기함을 지휘하는 함장. 함대의 첫 일격을 설계한다.',
      skill: { id: 'opening', name: '선제 지휘', en: 'FIRST COMMAND', range: [.10, .25], seconds: 20, text: v => `전투 시작 후 20초 동안 주는 피해 +${pct(v)}` },
      acquire: '기본 함장' },
    { id: 'malik', name: '말릭 오코로', en: 'Malik Okoro', grade: 'standard', type: 'dreadnought', portrait: 'captain-malik-okoro-bust.png?v=20261011-3', heroLevel: 5,
      bio: '중전함 포격 지휘의 베테랑. 위기일수록 침착해진다.',
      skill: { id: 'lowHpGuard', name: '철벽 지휘', en: 'IRON WALL', range: [.10, .25], threshold: .5, text: v => `내구도 50% 이하일 때 받는 피해 -${pct(v)}` } },
    { id: 'amara', name: '아마라 오코예', en: 'Amara Okoye', grade: 'standard', type: 'destroyer', portrait: 'okoye-scenario-bust.webp', heroLevel: 10,
      bio: '구축함 전대 출신. 상처 입은 적은 끝까지 쫓는다.',
      skill: { id: 'execute', name: '추격 사격', en: 'PURSUIT FIRE', range: [.15, .35], threshold: .3, text: v => `내구도 30% 이하인 적에게 주는 피해 +${pct(v)}` } },
    { id: 'luca', name: '루카 레예스', en: 'Luca Reyes', grade: 'standard', type: 'battlecruiser', portrait: 'luca-reyes-bust.png?v=20261013-1', heroLevel: 15,
      bio: '전투순양함 기관 전문가. 출항 전에 주포를 미리 달궈 둔다.',
      skill: { id: 'energyStart', name: '과충전 출격', en: 'OVERCHARGE START', range: [.20, .50], text: v => `전투 시작 시 스킬 에너지 ${pct(v)} 충전` } },
    { id: 'moreau', name: '이자벨 모로', en: 'Isabelle Moreau', grade: 'elite', type: 'battlecruiser', look: 'long', accent: '#ff9ec4', rank: 4, fee: 40000,
      bio: '궤도 방위대 포술 교관 출신. 정확한 박자로 일제사격을 지휘한다.',
      skill: { id: 'surge', name: '섬광 일제사격', en: 'FLASH VOLLEY', range: [.20, .40], every: 20, seconds: 6, text: v => `20초마다 6초 동안 주는 피해 +${pct(v)}` } },
    { id: 'holm', name: '라그나 홀름', en: 'Ragnar Holm', grade: 'elite', type: 'battlecruiser', look: 'beard', accent: '#9fc4ff', rank: 5, fee: 80000,
      bio: '외곽 항로 호위 함대 출신. 거대한 표적을 노리는 데 이골이 났다.',
      skill: { id: 'boss', name: '거함 사냥', en: 'GIANT HUNTER', range: [.15, .35], text: v => `보스에게 주는 피해 +${pct(v)}` } },
    { id: 'weiss', name: '콘라트 바이스', en: 'Konrad Weiss', grade: 'elite', type: 'dreadnought', look: 'short', accent: '#ffc27a', rank: 4, fee: 40000,
      bio: '조선소 감독관 출신. 포화 속에서도 선체를 고쳐 낸다.',
      skill: { id: 'regen', name: '요새 정비', en: 'FORTRESS REPAIR', range: [.04, .09], every: 25, text: v => `25초마다 최대 내구도의 ${pct(v)} 회복` } },
    { id: 'hassan', name: '타리크 알하산', en: 'Tariq Al-Hassan', grade: 'elite', type: 'dreadnought', look: 'cap', accent: '#ffd76a', rank: 5, fee: 80000,
      bio: '사막 행성 방어전의 생존자. 마지막 순간에 더 단단해진다.',
      skill: { id: 'lastStand', name: '최후의 방벽', en: 'LAST BULWARK', range: [.20, .40], threshold: .35, text: v => `내구도 35% 이하로 처음 떨어지면 최대 내구도의 ${pct(v)} 즉시 회복` } },
    { id: 'chen', name: '미라 첸', en: 'Mira Chen', grade: 'elite', type: 'destroyer', look: 'bob', accent: '#8dffc0', rank: 4, fee: 40000,
      bio: '고속 구축함 경주 우승자. 포탑 회전까지 박자를 맞춘다.',
      skill: { id: 'speed', name: '속사 지휘', en: 'RAPID FIRE', range: [.08, .20], text: v => `공격 속도 +${pct(v)}` } },
    { id: 'lima', name: '소피아 리마', en: 'Sofia Lima', grade: 'elite', type: 'destroyer', look: 'long', accent: '#c6a2ff', rank: 5, fee: 80000,
      bio: '소행성대 정찰 함장 출신. 적의 조준선을 읽고 비켜 난다.',
      skill: { id: 'evasion', name: '회피 기동', en: 'EVASIVE MANEUVER', range: [.06, .15], text: v => `받는 피해 -${pct(v)}` } }
  ];
  const byId = Object.fromEntries(CAPTAINS.map(c => [c.id, c]));

  function pct(v) { const n = Math.round(v * 1000) / 10; return `${Number.isInteger(n) ? n : n.toFixed(1)}%`; }
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const count = v => Math.max(0, Math.floor(Number(v) || 0));
  const fmt = v => count(v).toLocaleString('ko-KR');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  let state = read(STORE);
  if (!state || typeof state !== 'object') state = {};
  state = { unlocked: false, rank: 0, seenRank: 0, unlockSeen: false, captains: {}, assign: {}, ...state };
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {} };

  const owned = id => Boolean(state.captains[id]);
  const levelOf = id => Math.min(MAX_LEVEL, Math.max(1, count(state.captains[id]?.level) || 1));
  const lerp = ([a, b], level) => a + (b - a) * (Math.min(MAX_LEVEL, level) - 1) / (MAX_LEVEL - 1);
  const passiveOf = (c, level) => lerp(GRADE[c.grade].passive, level);
  const skillValue = (c, level) => lerp(c.skill.range, level);
  const trainCost = (c, level) => Math.round((400 + 150 * level + 6 * level * level) * GRADE[c.grade].costScale / 100) * 100;

  const profile = () => read(PROFILE_KEY) || {};
  const heroName = () => { const p = profile(); return [p.character || 'Jake', p.lastName].filter(Boolean).join(' '); };
  const heroPortrait = () => profile().character === 'Donna' ? 'captain-donna-scenario-bust.png' : 'captain-jake-scenario-bust.png';
  const nameOf = c => c.hero ? heroName() : c.name;
  const enOf = c => c.hero ? `${RANKS[state.rank].name} · Flagship` : c.en;

  // ── 자원 ──────────────────────────────────────────────────────────────
  function balances() {
    let b = window.gameResources;
    if (!b || typeof b !== 'object') b = window.gameResources = { gold: 0, thorium: 0 };
    if (!window.__inventoryBalancesHydrated) { Object.assign(b, read(RESOURCE_KEY) || {}); window.__inventoryBalancesHydrated = true; }
    return b;
  }
  function spendGold(cost) {
    const b = balances(), gold = count(b.gold);
    if (gold < cost) return false;
    b.gold = gold - cost;
    try { localStorage.setItem(RESOURCE_KEY, JSON.stringify(b)); } catch {}
    window.updateGameResourceHud?.();
    window.dispatchEvent(new Event('game-resources-updated'));
    return true;
  }

  // ── 함대 ──────────────────────────────────────────────────────────────
  const shipKey = ship => ship ? `${ship.type}:${ship.name}` : '';
  function fleetMain() {
    const saved = read(FORMATION_KEY);
    return [0, 1, 2].map(i => Array.isArray(saved) && saved[i] && saved[i].name ? saved[i] : null);
  }
  function currentStars(ship) {
    const variants = window.getOwnedFleetVariants?.() || [];
    const same = variants.filter(v => v.name === ship.name && v.type === ship.type && v.rarity === ship.rarity);
    const best = same.reduce((max, v) => Math.max(max, count(v.stars ?? v.enhancementStars)), -1);
    return best >= 0 ? best : count(ship.enhancementStars);
  }
  const fleetLevelMet = stars => { const main = fleetMain(); return main.every(ship => ship && ship.rarity === 'L' && currentStars(ship) >= stars); };
  const membership = () => { try { return localStorage.getItem(MEMBERSHIP_KEY) === '1'; } catch { return false; } };

  function hqCleared() {
    const status = window.campaignChapterStatus?.();
    if (status && Number(status.hqGate) >= 1) return true;
    const saved = read('neptune-campaign-v1');
    return Number(saved?.['asman-hq']) >= 1;
  }
  function eligibleRank() {
    const status = window.campaignChapterStatus?.() || {};
    let rank = 0;
    for (let chapter = 1; chapter <= 5 && status[chapter]; chapter++) rank = chapter;
    if (rank === 5 && membership() && fleetLevelMet(RANKS[6].stars)) rank = 6;
    if (rank === 6 && membership() && fleetLevelMet(RANKS[7].stars)) rank = 7;
    return rank;
  }

  // 배치: 함선(함종:이름)마다 함장 한 명. 같은 함종 함장만 탈 수 있다.
  function captainOnShip(ship) {
    const id = state.assign[shipKey(ship)];
    const c = byId[id];
    return c && owned(id) ? c : null;
  }
  function assignCaptain(ship, id) {
    for (const key of Object.keys(state.assign)) if (state.assign[key] === id) delete state.assign[key];
    if (id) state.assign[shipKey(ship)] = id; else delete state.assign[shipKey(ship)];
  }
  function autoAssign() {
    let changed = false;
    const main = fleetMain();
    const busy = new Set(main.map(ship => ship && captainOnShip(ship)?.id).filter(Boolean));
    for (const ship of main) {
      if (!ship || captainOnShip(ship)) continue;
      const pick = CAPTAINS.find(c => owned(c.id) && c.type === ship.type && !busy.has(c.id));
      if (pick) { assignCaptain(ship, pick.id); busy.add(pick.id); changed = true; }
    }
    return changed;
  }

  // ── 상태 갱신 ─────────────────────────────────────────────────────────
  const joined = [];
  function grant(id, silent = false) {
    if (owned(id)) return;
    state.captains[id] = { level: 1 };
    if (!silent) joined.push(id);
  }
  function sync() {
    let changed = false, gained = false;
    if (!state.unlocked && hqCleared()) { state.unlocked = true; changed = true; }
    if (!state.unlocked) { paintTab(); return; }
    if (!owned('hero')) { grant('hero', true); changed = gained = true; }
    const rank = Math.max(state.rank, eligibleRank());
    if (rank !== state.rank) { state.rank = rank; changed = true; }
    const heroLevel = levelOf('hero');
    for (const c of CAPTAINS) if (c.heroLevel && heroLevel >= c.heroLevel && !owned(c.id)) { grant(c.id); changed = gained = true; }
    // 새 함장이 오면 빈 함선에 태운다. 처음 개방 때 편성이 비어 있었다면 편성이 생길 때까지 한 번 더 시도한다.
    if (gained || !state.assignedOnce) { if (autoAssign()) changed = true; if (Object.keys(state.assign).length) { if (!state.assignedOnce) changed = true; state.assignedOnce = true; } }
    if (changed) { save(); window.dispatchEvent(new Event('captain-training-updated')); }
    paintTab();
    if (changed && isCaptainTabOpen()) render();
    queueCeremony();
  }

  // ── 전투 연결 ─────────────────────────────────────────────────────────
  // 전투 엔진이 아군 함선을 만들 때 부른다. 아레나·광산 쟁탈전은 엔진에서 부르지 않는다.
  function battleEffects(ship) {
    if (!state.unlocked || !ship) return null;
    const rankBonus = RANKS[state.rank]?.bonus || 0;
    const c = captainOnShip(ship);
    const passive = c ? passiveOf(c, levelOf(c.id)) : 0;
    const offSpec = Boolean(c && c.type !== ship.type);
    const factor = (1 + rankBonus) * (1 + passive) * (offSpec ? 1 - OFF_SPEC_PENALTY : 1) - 1;
    const skill = c ? { ...c.skill, value: skillValue(c, levelOf(c.id)), captain: nameOf(c) } : null;
    if (skill) delete skill.text;
    return { hp: factor, damage: factor, skill, offSpec, speedPenalty: offSpec ? OFF_SPEC_PENALTY : 0 };
  }

  // ── 계급장 ────────────────────────────────────────────────────────────
  // 훈장형 계급장 3계열(100×100 좌표).
  // 위관: 은빛 방패·푸른 법랑·섬광 보석 / 영관: 금빛 날개 문장·사파이어·깎은 별 / 장성: 햇살 광배·백금 메달·궤도 고리·루비·왕관.
  // shine 옵션을 주면(계급 패널·진급 연출) 빛줄기가 주기적으로 계급장을 훑고 지나간다.
  let uid = 0;
  const f2 = n => Math.round(n * 100) / 100;
  const polar = (cx, cy, r, deg) => [f2(cx + r * Math.cos(deg * Math.PI / 180)), f2(cy + r * Math.sin(deg * Math.PI / 180))];
  const METAL = { silver: ['#ffffff', '#dde7f1', '#8ea2b6', '#3f4f60'], gold: ['#fffbe3', '#ffdf86', '#cf9425', '#5f3c06'], plat: ['#ffffff', '#edf0ff', '#a6afd4', '#474f7c'] };
  const ENAMEL = [['#5fb4ff', '#1b4f97', '#081a38'], ['#4a7cf0', '#15337f', '#061334'], ['#e0406c', '#741036', '#22041a']];
  const HALO = ['#7fe3ff', '#ffd76a', '#ff6b8a'];
  const GEM = { cyan: ['#effeff', '#93f1ff', '#27a7d6', '#0b5a82'], sapphire: ['#e8f0ff', '#86b5ff', '#2b5fd8', '#0e2a7c'], ruby: ['#ffe6ec', '#ff7f9b', '#cf1848', '#650220'] };
  // 면이 깎인 5각 별: 꼭짓점마다 밝은 면과 어두운 면을 번갈아 칠한다.
  function facetStar(cx, cy, R, light, dark, edge) {
    const ri = R * .42;
    let s = '';
    for (let i = 0; i < 5; i++) {
      const a = -90 + i * 72, o = polar(cx, cy, R, a), l = polar(cx, cy, ri, a - 36), r = polar(cx, cy, ri, a + 36);
      s += `<path d="M${cx} ${cy}L${l}L${o}Z" fill="${dark}"/><path d="M${cx} ${cy}L${o}L${r}Z" fill="${light}"/>`;
    }
    const outline = Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? ri : R, -90 + i * 36)).join(' ');
    return `${s}<polygon points="${outline}" fill="none" stroke="${edge}" stroke-width=".7" stroke-linejoin="round"/>`;
  }
  // 마름모 보석: 네 면 명암과 반사광.
  function gem(cx, cy, w, h, c) {
    const T = `${cx} ${f2(cy - h)}`, R = `${f2(cx + w)} ${cy}`, B = `${cx} ${f2(cy + h)}`, L = `${f2(cx - w)} ${cy}`, C = `${cx} ${cy}`;
    const hx = f2(cx - w * .3), hy = f2(cy - h * .42);
    return `<path d="M${T}L${L}L${C}Z" fill="${c[0]}"/><path d="M${T}L${R}L${C}Z" fill="${c[1]}"/><path d="M${B}L${L}L${C}Z" fill="${c[2]}"/><path d="M${B}L${R}L${C}Z" fill="${c[3]}"/><path d="M${T}L${R}L${B}L${L}Z" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".6"/><ellipse cx="${hx}" cy="${hy}" rx="${f2(w * .24)}" ry="${f2(h * .09)}" transform="rotate(-38 ${hx} ${hy})" fill="#fff" opacity=".9"/>`;
  }
  // 네 갈래 섬광
  const sparkle = (cx, cy, r, k = .17) => `M${cx} ${f2(cy - r)}Q${f2(cx + r * k)} ${f2(cy - r * k)} ${f2(cx + r)} ${cy}Q${f2(cx + r * k)} ${f2(cy + r * k)} ${cx} ${f2(cy + r)}Q${f2(cx - r * k)} ${f2(cy + r * k)} ${f2(cx - r)} ${cy}Q${f2(cx - r * k)} ${f2(cy - r * k)} ${cx} ${f2(cy - r)}Z`;
  // 월계 가지: 원호를 따라 잎을 바깥·안쪽으로 비스듬히 붙이고 좌우 반전한다.
  function laurel(cx, cy, R, from, to, n, rx, ry, fill, stroke) {
    const p0 = polar(cx, cy, R, from), p1 = polar(cx, cy, R, to);
    let s = `<path d="M${p0}A${R} ${R} 0 0 1 ${p1}" fill="none" stroke="${stroke}" stroke-width="1.1" stroke-linecap="round"/>`;
    const leaf = (x, y, a) => { const [lx, ly] = polar(x, y, rx * .85, a); return `<ellipse cx="${lx}" cy="${ly}" rx="${rx}" ry="${ry}" transform="rotate(${f2(a)} ${lx} ${ly})" fill="${fill}" stroke="${stroke}" stroke-width=".35"/>`; };
    for (let i = 0; i < n; i++) {
      const deg = from + (to - from) * i / (n - 1), [x, y] = polar(cx, cy, R, deg);
      s += leaf(x, y, deg + 48);
      if (i) s += leaf(x, y, deg + 132);
    }
    s += leaf(p1[0], p1[1], to + 90);
    return `<g>${s}</g><g transform="matrix(-1 0 0 1 ${cx * 2} 0)">${s}</g>`;
  }
  const mirror = inner => `<g>${inner}</g><g transform="matrix(-1 0 0 1 100 0)">${inner}</g>`;

  function insignia(rank, cls = '', opts = {}) {
    const id = `cti${++uid}`, tier = rank < 3 ? 0 : rank < 6 ? 1 : 2;
    const m = [METAL.silver, METAL.gold, METAL.plat][tier], g = METAL.gold, en = ENAMEL[tier], deep = m[3];
    const grad = (key, c, x1, y1, x2, y2) => `<linearGradient id="${id}${key}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${c[0]}"/><stop offset=".32" stop-color="${c[1]}"/><stop offset=".68" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[3]}"/></linearGradient>`;
    let defs = grad('a', m, 0, 0, .6, 1) + grad('b', m, .6, 1, 0, 0) + grad('g', g, 0, 0, .6, 1) + grad('k', g, .6, 1, 0, 0)
      + `<radialGradient id="${id}e" cx=".42" cy=".3" r=".85"><stop offset="0" stop-color="${en[0]}"/><stop offset=".55" stop-color="${en[1]}"/><stop offset="1" stop-color="${en[2]}"/></radialGradient>`
      + `<radialGradient id="${id}h" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${HALO[tier]}" stop-opacity=".5"/><stop offset=".6" stop-color="${HALO[tier]}" stop-opacity=".12"/><stop offset="1" stop-color="${HALO[tier]}" stop-opacity="0"/></radialGradient>`
      + `<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
      + `<pattern id="${id}p" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V3.2" stroke="#fff" stroke-opacity=".07" stroke-width=".8"/></pattern>`
      + `<filter id="${id}f" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.4" stdDeviation="1.3" flood-color="#000" flood-opacity=".6"/></filter>`;
    const A = `url(#${id}a)`, Bv = `url(#${id}b)`, G = `url(#${id}g)`, K = `url(#${id}k)`, E = `url(#${id}e)`, P = `url(#${id}p)`;
    const hi = (d, w = .8, o = .85) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    let halo = `<circle cx="50" cy="50" r="49" fill="url(#${id}h)"/>`, body = '', clip = '';
    if (tier === 0) {
      const outer = 'M50 5L81 15.5V47C81 70 67 84.5 50 95C33 84.5 19 70 19 47V15.5Z';
      const bevel = 'M50 10.5L76 19.5V47C76 67 64 79.5 50 89C36 79.5 24 67 24 47V19.5Z';
      const field = 'M50 14L72.5 22V47C72.5 64.5 62 75.8 50 84.5C38 75.8 27.5 64.5 27.5 47V22Z';
      clip = `<path d="${outer}"/>`;
      if (rank === 2) body += mirror(`<path d="M21 24Q11 17 2 18Q10 24 21 31Z" fill="${A}" stroke="${deep}" stroke-width=".6"/><path d="M21 32Q12 28 5 31Q12 34 21 38Z" fill="${A}" stroke="${deep}" stroke-width=".6"/>${hi('M21 24Q11 17 2 18', .6, .7)}`);
      body += `<path d="${outer}" fill="${A}" stroke="${deep}" stroke-width=".8"/><path d="${bevel}" fill="${Bv}"/><path d="${field}" fill="${E}"/><path d="${field}" fill="${P}"/>`;
      body += hi('M21 16.6L50 6.3L79 16.6', .9) + `<path d="M50 14V84" stroke="#fff" stroke-opacity=".06" stroke-width="5"/>`;
      body += `<circle cx="27" cy="23.5" r="1.5" fill="${A}"/><circle cx="73" cy="23.5" r="1.5" fill="${A}"/>`;
      const chev = y => `<path d="M30 ${y + 11}L50 ${y}L70 ${y + 11}V${y + 19}L50 ${y + 8}L30 ${y + 19}Z" fill="${A}" stroke="${deep}" stroke-width=".7"/>${hi(`M30.6 ${y + 11}L50 ${y + .7}L69.4 ${y + 11}`, .9)}<path d="M30.6 ${y + 18.4}L50 ${y + 8.6}L69.4 ${y + 18.4}" fill="none" stroke="#06152c" stroke-opacity=".55" stroke-width=".8"/>`;
      if (rank === 0) body += chev(48) + gem(50, 29, 4.5, 7, GEM.cyan);
      if (rank === 1) body += chev(54) + `<path d="${sparkle(50, 34, 13)}" fill="#bff6ff"/><path d="${sparkle(50, 34, 8.5, .22)}" fill="#ffffff"/><circle cx="50" cy="34" r="2.2" fill="#fff"/>`;
      if (rank === 2) body += chev(46) + chev(59) + `<path d="${sparkle(50, 29.5, 11)}" fill="#bff6ff"/><path d="${sparkle(50, 29.5, 7, .22)}" fill="#fff"/><circle cx="50" cy="29.5" r="1.9" fill="#fff"/>`;
    } else if (tier === 1) {
      const feathers = ['M40 38Q22 22 2 23Q18 34 40 46Z', 'M40 45Q24 36 5 41Q22 48 40 53Z', 'M40 52Q27 49 10 57Q26 59 40 59Z'];
      if (rank === 5) feathers.unshift('M40 32Q25 13 7 10Q19 25 40 40Z');
      const wing = feathers.map(d => `<path d="${d}" fill="${A}" stroke="${deep}" stroke-width=".6"/>${hi(d.split('Q').slice(0, 2).join('Q'), .7, .75)}`).join('');
      const crestO = 'M50 22L66 31V55L50 74L34 55V31Z', crestB = 'M50 26.5L62 33.5V53.5L50 68L38 53.5V33.5Z', crestF = 'M50 29L59.5 34.8V52.5L50 64.5L40.5 52.5V34.8Z';
      clip = `<path d="${crestO}"/>${feathers.map(d => `<path d="${d}"/><path d="${d}" transform="matrix(-1 0 0 1 100 0)"/>`).join('')}`;
      body += mirror(wing);
      body += laurel(50, 57, 21, 100, 138, 3, 3.4, 1.4, G, g[3]);
      body += `<path d="${crestO}" fill="${A}" stroke="${deep}" stroke-width=".8"/><path d="${crestB}" fill="${Bv}"/><path d="${crestF}" fill="${E}"/><path d="${crestF}" fill="${P}"/>` + hi('M34.8 31.2L50 22.9L65.2 31.2', .9);
      body += gem(50, 47, 7.2, 12.5, GEM.sapphire);
      if (rank === 3) body += `<circle cx="50" cy="18.5" r="3.4" fill="${A}" stroke="${deep}" stroke-width=".6"/><circle cx="49" cy="17.4" r="1" fill="#fff"/>`;
      if (rank === 4) body += facetStar(50, 13, 10, m[0], m[2], deep);
      if (rank === 5) body += facetStar(39.5, 14.5, 8.6, m[0], m[2], deep) + facetStar(60.5, 14.5, 8.6, m[0], m[2], deep);
    } else {
      const n = rank === 7 ? 24 : 16, Rl = rank === 7 ? 49 : 46, Rs = rank === 7 ? 41 : 38;
      const rays = Array.from({ length: n }, (_, i) => {
        const a = -90 + i * 360 / n, tip = polar(50, 50, i % 2 ? Rs : Rl, a), b1 = polar(50, 50, 26, a - 180 / n * .8), b2 = polar(50, 50, 26, a + 180 / n * .8);
        return `<path d="M${b1}L${tip}L${b2}Z" fill="${i % 2 ? K : G}"/>`;
      }).join('');
      const back = 'M9.43 62.87A42 11 -15 0 1 90.57 41.13', front = 'M90.57 41.13A42 11 -15 0 1 9.43 62.87';
      clip = '<circle cx="50" cy="50" r="30"/>';
      body += rays + `<path d="${back}" fill="none" stroke="${A}" stroke-width="3.4" stroke-opacity=".9"/>`;
      body += `<circle cx="50" cy="50" r="30" fill="${A}" stroke="${deep}" stroke-width=".8"/><circle cx="50" cy="50" r="26.6" fill="${Bv}"/><circle cx="50" cy="50" r="24.2" fill="${E}"/><circle cx="50" cy="50" r="24.2" fill="${P}"/><circle cx="50" cy="50" r="21.8" fill="none" stroke="${G}" stroke-width=".9" stroke-opacity=".85"/>`;
      body += hi('M28.5 37A25 25 0 0 1 61 26', 1, .7);
      body += laurel(50, 50, 19.5, 102, 162, 5, 3.3, 1.35, G, g[3]);
      if (rank === 6) body += facetStar(50, 47, 16.5, m[0], m[2], deep) + gem(50, 47, 3.2, 4.2, GEM.ruby) + gem(50, 19.5, 3.2, 4.6, GEM.ruby);
      else body += facetStar(39.5, 48, 11.8, m[0], m[2], deep) + facetStar(60.5, 48, 11.8, m[0], m[2], deep) + gem(39.5, 48, 2.4, 3.1, GEM.ruby) + gem(60.5, 48, 2.4, 3.1, GEM.ruby);
      body += `<path d="${front}" fill="none" stroke="${A}" stroke-width="3.4"/>` + hi('M84 47A42 11 -15 0 1 40 62', .7, .7);
      body += `<circle cx="72.8" cy="55.8" r="3.3" fill="${GEM.ruby[2]}" stroke="${GEM.ruby[3]}" stroke-width=".6"/><circle cx="71.8" cy="54.7" r="1.1" fill="#fff"/>`;
      if (rank === 7) body += `<path d="M36 23L32.5 9.5L42 15.5L50 4L58 15.5L67.5 9.5L64 23Z" fill="${G}" stroke="${g[3]}" stroke-width=".7" stroke-linejoin="round"/><path d="M35.5 22.5H64.5V26.5H35.5Z" fill="${K}" stroke="${g[3]}" stroke-width=".6"/>${hi('M33.3 10.6L42 15.5L50 5.2L58 15.5L66.7 10.6', .6, .8)}${gem(50, 4.6, 2.2, 2.8, GEM.ruby)}${gem(32.6, 9.6, 1.8, 2.3, GEM.sapphire)}${gem(67.4, 9.6, 1.8, 2.3, GEM.sapphire)}`;
    }
    defs += `<clipPath id="${id}c">${clip}</clipPath>`;
    const sheen = opts.shine ? `<g clip-path="url(#${id}c)"><rect x="-70" y="-10" width="30" height="120" fill="url(#${id}s)" transform="skewX(-20)"><animate attributeName="x" values="-70;-70;150" keyTimes="0;.6;1" dur="4.5s" repeatCount="indefinite"/></rect></g>` : '';
    return `<svg class="ct-insignia ${cls}" data-tier="${tier}" viewBox="0 0 100 100" role="img" aria-label="${RANKS[rank].name} 계급장"><defs>${defs}</defs>${halo}<g filter="url(#${id}f)">${body}</g>${sheen}</svg>`;
  }

  // 초상화: 이미지가 없는 고급 함장은 통신 실루엣으로 그린다(나중에 이미지 파일을 넣으면 portrait 만 채우면 된다).
  function silhouette(c) {
    const id = `ctp${++uid}`, a = c.accent || '#7fe3ff';
    const hair = { long: `<path d="M73 70c-4-34 14-50 27-50s31 16 27 50c4 22 8 36 14 48l-22 4-19-12-19 12-22-4c6-12 10-26 14-48Z" fill="#071019" stroke="${a}" stroke-opacity=".55" stroke-width="2"/>`,
      bob: `<path d="M70 82c-5-38 14-58 30-58s35 20 30 58l-8 6-4-22-36 0-4 22Z" fill="#071019" stroke="${a}" stroke-opacity=".55" stroke-width="2"/>`,
      cap: `<path d="M64 52c4-16 18-24 36-24s32 8 36 24l-6 6H70Z" fill="#071019" stroke="${a}" stroke-width="2.4"/><path d="M60 58h80l-8 8H68Z" fill="${a}" fill-opacity=".85"/><circle cx="100" cy="44" r="5" fill="${a}"/>`,
      beard: `<path d="M78 92c4 18 12 26 22 26s18-8 22-26l-4 2c-4 8-10 12-18 12s-14-4-18-12Z" fill="#071019" stroke="${a}" stroke-opacity=".55" stroke-width="2"/>`,
      short: '' }[c.look || 'short'];
    const initials = c.en.split(' ').map(w => w[0]).join('').slice(0, 2);
    return `<svg class="ct-silhouette" viewBox="0 0 200 240" preserveAspectRatio="xMidYMin slice" aria-hidden="true"><defs><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d2236"/><stop offset="1" stop-color="#050b14"/></linearGradient><pattern id="${id}h" width="14" height="24" patternUnits="userSpaceOnUse"><path d="M7 0 14 4v8L7 16 0 12V4Z" fill="none" stroke="${a}" stroke-opacity=".12"/></pattern></defs><rect width="200" height="240" fill="url(#${id}b)"/><rect width="200" height="240" fill="url(#${id}h)"/><circle cx="100" cy="84" r="70" fill="${a}" fill-opacity=".09"/>
      <path d="M30 240c4-40 30-62 54-68l-6-14c-8-8-12-22-12-40 0-34 16-56 34-56s34 22 34 56c0 18-4 32-12 40l-6 14c24 6 50 28 54 68Z" fill="#081420" stroke="${a}" stroke-width="2.6"/>
      ${hair}<path d="M52 206l22-20 26 18 26-18 22 20" fill="none" stroke="${a}" stroke-opacity=".7" stroke-width="3"/><path d="M40 222h34M126 222h34" stroke="${a}" stroke-width="5" stroke-linecap="round"/>
      <g fill="${a}" fill-opacity=".14">${Array.from({ length: 12 }, (_, i) => `<rect x="0" y="${i * 20 + 6}" width="200" height="2"/>`).join('')}</g>
      <text x="14" y="30" fill="${a}" font-size="15" font-family="var(--font-num)" letter-spacing="2">${initials} · SIGNAL</text></svg>`;
  }
  const portraitOf = c => c.hero ? `<img src="${heroPortrait()}" alt="${esc(nameOf(c))} 초상화"/>` : c.portrait ? `<img src="${c.portrait}" alt="${esc(c.name)} 초상화"/>` : silhouette(c);

  // ── 화면 ──────────────────────────────────────────────────────────────
  let pool = null, tab = null;
  const isCaptainTabOpen = () => pool && !pool.classList.contains('hidden') && document.getElementById('summon')?.classList.contains('active');
  function paintTab() {
    if (!tab) return;
    tab.disabled = !state.unlocked;
    tab.setAttribute('aria-label', state.unlocked ? '함장 훈련' : '함장 훈련, 아스만 사령부 1관문 클리어 후 개방');
    tab.classList.toggle('ct-tab-new', state.unlocked && !state.unlockSeen);
    if (!state.unlocked && pool) pool.innerHTML = `<div class="ct-locked"><div class="ct-locked-badge">${insignia(0)}</div><small>COMMANDER TRAINING</small><b>함장 훈련</b><p>아스만 사령부 1관문을 클리어하면 개방됩니다.</p></div>`;
  }

  function rankPanel() {
    const rank = state.rank, cur = RANKS[rank], next = RANKS[rank + 1];
    const nextMarkup = next ? `<div class="ct-next"><small>NEXT RANK · ${next.name}</small><span>${next.need}</span>${next.detail ? `<em>${next.detail} · Membership ${membership() ? '보유' : '미보유'}</em>` : ''}</div>` : '<div class="ct-next ct-next-max"><small>HIGHEST RANK</small><span>최고 계급에 도달했습니다</span></div>';
    const ladder = RANKS.map((r, i) => `<li class="${i < rank ? 'done' : i === rank ? 'current' : 'locked'}" title="${r.name}">${insignia(i)}<span>${r.abbr}</span></li>`).join('');
    return `<section class="ct-rank"><div class="ct-rank-main"><div class="ct-rank-badge">${insignia(rank, '', { shine: true })}</div><div class="ct-rank-copy"><small>COMMANDER RANK</small><b>${cur.name}</b><span>${cur.bonus ? `함대 공격력 +${pct(cur.bonus)} · 내구도 +${pct(cur.bonus)}` : '계급 효과 없음'}</span><em>계급 효과는 아레나·광산 쟁탈전에 적용되지 않습니다</em></div></div>${nextMarkup}<ol class="ct-ladder">${ladder}</ol></section>`;
  }

  function fleetPanel() {
    const main = fleetMain();
    const slots = main.map((ship, i) => {
      if (!ship) return `<div class="ct-slot empty"><small>${ROLE_NAMES[i]}</small><span>편성된 함선 없음</span></div>`;
      const c = captainOnShip(ship);
      return `<button type="button" class="ct-slot" data-ct-slot="${i}" data-type="${ship.type}"><small>${ROLE_NAMES[i]} · ${TYPE_NAMES[ship.type] || ''}</small><b>${esc(ship.name)}</b><span class="ct-slot-captain">${c ? `<span class="ct-mini">${portraitOf(c)}</span><span><b>${esc(nameOf(c))}</b><em>Lv.${levelOf(c.id)} · ${esc(c.skill.name)}</em></span>${c.type !== ship.type ? `<span class="ct-offspec" title="비전문 함선 · ${OFF_SPEC_TEXT}">비전문 -${Math.round(OFF_SPEC_PENALTY * 100)}%</span>` : ''}` : '<span class="ct-slot-add">＋ 함장 배치</span>'}</span></button>`;
    }).join('');
    return `<section class="ct-fleet"><header><small>FLEET COMMAND</small><b>함장 배치</b><span>어느 함선에나 탑승할 수 있습니다. 전문 함종이 아니면 ${OFF_SPEC_TEXT}</span></header><div class="ct-slots">${slots}</div></section>`;
  }

  function cardMarkup(c) {
    const has = owned(c.id);
    const lock = !has ? (c.heroLevel ? `주인공 훈련 Lv.${c.heroLevel}` : c.rank != null ? `${RANKS[c.rank].abbr} 이상` : '') : '';
    return `<button type="button" class="ct-card${has ? '' : ' locked'}" data-ct-open="${c.id}" data-grade="${c.grade}" data-type="${c.type}">
      <span class="ct-card-portrait">${portraitOf(c)}</span>
      <span class="ct-card-grade">${GRADE[c.grade].label}</span><span class="ct-card-type">${TYPE_NAMES[c.type]}</span>
      <span class="ct-card-name"><b>${esc(nameOf(c))}</b><small>${esc(c.hero ? 'Flagship' : c.en)}</small></span>
      <span class="ct-card-foot">${has ? `<span>Lv.<b>${levelOf(c.id)}</b></span><span>${esc(c.skill.name)}</span>` : `<span class="ct-card-lock">${lock}</span>`}</span></button>`;
  }

  function rosterPanel() {
    const groups = ['battlecruiser', 'dreadnought', 'destroyer'].map(type => `<div class="ct-group"><h3><span>${TYPE_EN[type]}</span>${TYPE_NAMES[type]} 전문</h3><div class="ct-cards">${CAPTAINS.filter(c => c.type === type).map(cardMarkup).join('')}</div></div>`).join('');
    return `<section class="ct-roster"><header><small>CAPTAIN ROSTER</small><b>함장 카드</b><span>전설 함장은 추후 합류합니다</span></header>${groups}</section>`;
  }

  function render() {
    if (!pool || !state.unlocked) { paintTab(); return; }
    pool.innerHTML = `<div class="ct-root">${rankPanel()}${fleetPanel()}${rosterPanel()}</div>`;
  }

  // 함장 카드 상세: 초상화·전문 함종·효과·특수기술·훈련/영입
  function openCard(id) {
    const c = byId[id];
    if (!c) return;
    closeModal();
    const has = owned(id), level = levelOf(id), max = level >= MAX_LEVEL;
    const passive = passiveOf(c, level), nextPassive = passiveOf(c, level + 1);
    const value = skillValue(c, level), nextValue = skillValue(c, level + 1);
    const cost = trainCost(c, level);
    const rankOk = c.rank == null || state.rank >= c.rank;
    let action = '';
    if (has) action = max ? '<button type="button" class="ct-action" disabled>최대 훈련 완료</button>' : `<button type="button" class="ct-action" data-ct-train="${id}"><span>훈련 Lv.${level} → ${level + 1}</span><em><i class="ct-gold"></i>${fmt(cost)}</em></button>`;
    else if (c.fee) action = `<button type="button" class="ct-action recruit" data-ct-recruit="${id}" ${rankOk ? '' : 'disabled'}><span>${rankOk ? '함장 영입' : `${RANKS[c.rank].name} 이상 영입 가능`}</span><em><i class="ct-gold"></i>${fmt(c.fee)}</em></button>`;
    else action = `<button type="button" class="ct-action" disabled>주인공 훈련 Lv.${c.heroLevel} 달성 시 자동 합류</button>`;
    const milestones = c.hero ? `<div class="ct-milestones">${CAPTAINS.filter(x => x.heroLevel).map(x => `<span class="${owned(x.id) ? 'done' : ''}"><b>Lv.${x.heroLevel}</b>${esc(x.name)} 합류</span>`).join('')}</div>` : '';
    const growing = has && !max;
    const modal = document.createElement('div');
    modal.className = 'ct-modal';
    modal.innerHTML = `<div class="ct-modal-backdrop" data-ct-close></div><article class="ct-detail" data-grade="${c.grade}" data-type="${c.type}" role="dialog" aria-modal="true" aria-label="${esc(nameOf(c))} 함장 카드">
      <button type="button" class="ct-close" data-ct-close aria-label="닫기">×</button>
      <div class="ct-detail-art">${portraitOf(c)}<span class="ct-card-grade">${GRADE[c.grade].label}</span>${c.hero ? `<span class="ct-detail-rank">${insignia(state.rank, '', { shine: true })}</span>` : ''}</div>
      <div class="ct-detail-body">
        <small class="ct-detail-kicker">${TYPE_EN[c.type]} SPECIALIST</small>
        <h3>${esc(nameOf(c))}</h3><p class="ct-detail-en">${esc(enOf(c))}</p>
        <p class="ct-detail-bio">${esc(c.bio)}</p>
        <dl class="ct-stats">
          <div><dt>전문 함종</dt><dd>${TYPE_NAMES[c.type]} <i class="ct-offspec-note">다른 함종 탑승 시 ${OFF_SPEC_TEXT}</i></dd></div>
          <div><dt>함장 효과</dt><dd>공격력·내구도 +${pct(passive)}${growing ? ` <i>다음 +${pct(nextPassive)}</i>` : ''}</dd></div>
          <div class="ct-skill"><dt>특수기술 <span>${esc(c.skill.name)} · ${c.skill.en}</span></dt><dd>${c.skill.text(value)}${growing ? ` <i>다음 ${pct(nextValue)}</i>` : ''}</dd></div>
          <div><dt>훈련</dt><dd><span class="ct-level"><b>Lv.${level}</b> / ${MAX_LEVEL}</span><span class="ct-bar"><span style="width:${(level / MAX_LEVEL * 100).toFixed(1)}%"></span></span></dd></div>
        </dl>${milestones}${action}
      </div></article>`;
    document.body.append(modal);
    modal.querySelector('.ct-close').focus();
  }
  function closeModal() { document.querySelector('.ct-modal')?.remove(); }

  function openPicker(index) {
    const ship = fleetMain()[index];
    if (!ship) return;
    closeModal();
    const current = captainOnShip(ship);
    const list = CAPTAINS.filter(c => owned(c.id)).sort((a, b) => (b.type === ship.type) - (a.type === ship.type));
    const where = id => { const main = fleetMain(); const k = main.findIndex(s => s && captainOnShip(s)?.id === id); return k >= 0 ? `${ROLE_NAMES[k]} ${main[k].name} 탑승 중` : '대기 중'; };
    const rows = list.length ? list.map(c => `<button type="button" class="ct-pick${current?.id === c.id ? ' selected' : ''}" data-ct-pick="${c.id}"><span class="ct-mini">${portraitOf(c)}</span><span><b>${esc(nameOf(c))} <i class="${c.type === ship.type ? 'ct-spec' : 'ct-offspec'}">${c.type === ship.type ? '전문' : `${TYPE_NAMES[c.type]} 전문 · ${OFF_SPEC_TEXT}`}</i></b><em>Lv.${levelOf(c.id)} · ${esc(c.skill.name)} · ${where(c.id)}</em></span></button>`).join('') : '<p class="ct-empty">보유한 함장이 없습니다.</p>';
    const modal = document.createElement('div');
    modal.className = 'ct-modal';
    modal.dataset.slot = String(index);
    modal.innerHTML = `<div class="ct-modal-backdrop" data-ct-close></div><article class="ct-picker" role="dialog" aria-modal="true" aria-label="함장 배치"><button type="button" class="ct-close" data-ct-close aria-label="닫기">×</button><small>${ROLE_NAMES[index]} · ${TYPE_NAMES[ship.type]}</small><h3>${esc(ship.name)} 함장 배치</h3><div class="ct-pick-list">${rows}</div>${current ? '<button type="button" class="ct-unassign" data-ct-pick="">배치 해제</button>' : ''}</article>`;
    document.body.append(modal);
  }

  function train(id) {
    const c = byId[id];
    if (!c || !owned(id)) return;
    const level = levelOf(id);
    if (level >= MAX_LEVEL) return;
    const cost = trainCost(c, level);
    if (!spendGold(cost)) { window.notice?.(`훈련에는 골드 ${fmt(cost)}가 필요합니다.`); return; }
    state.captains[id].level = level + 1;
    save();
    window.notice?.(`${nameOf(c)} 훈련 완료 · Lv.${level + 1}`);
    sync();
    render();
    window.dispatchEvent(new Event('captain-training-updated'));
    if (joined.length) showJoin(); else openCard(id);
  }
  function recruit(id) {
    const c = byId[id];
    if (!c || owned(id) || !c.fee || state.rank < c.rank) return;
    if (!spendGold(c.fee)) { window.notice?.(`영입에는 골드 ${fmt(c.fee)}가 필요합니다.`); return; }
    grant(id);
    autoAssign();
    save();
    render();
    window.dispatchEvent(new Event('captain-training-updated'));
    showJoin();
  }

  // 새 함장 합류 연출
  function showJoin() {
    const id = joined.shift();
    if (!id) return;
    const c = byId[id];
    closeModal();
    const modal = document.createElement('div');
    modal.className = 'ct-modal ct-ceremony';
    modal.innerHTML = `<div class="ct-modal-backdrop"></div><article class="ct-join" data-grade="${c.grade}" data-type="${c.type}" role="dialog" aria-modal="true" aria-label="새 함장 합류"><small>NEW CAPTAIN</small><h3>함장 합류</h3>${cardMarkup(c)}<p>${esc(nameOf(c))} 함장이 함대에 합류했습니다.</p><button type="button" class="ct-action" data-ct-join-ok>확인</button></article>`;
    document.body.append(modal);
  }

  // 진급·개방 연출: 전투 화면이나 대화가 끝난 뒤에 띄운다.
  let ceremonyTimer = 0;
  // 타이틀·연령 확인·인트로 영상·튜토리얼·시나리오 대화가 떠 있으면 기다린다.
  const shown = el => { if (!el || el.hidden) return false; const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && el.getClientRects().length > 0; };
  const BLOCKERS = '#title-screen, dialog.age-gate, #intro-video, .eva9-tutorial, .luca-tutorial, .farah-tutorial, .mars-scenario, .ct-modal';
  const busy = () => document.hidden || document.getElementById('battle')?.classList.contains('active') || [...document.querySelectorAll(BLOCKERS)].some(el => el.tagName === 'DIALOG' ? el.open : shown(el));
  function queueCeremony() {
    if (!state.unlocked || (state.unlockSeen && state.seenRank >= state.rank)) return;
    clearTimeout(ceremonyTimer);
    ceremonyTimer = setTimeout(() => { if (busy()) queueCeremony(); else showCeremony(); }, 1200);
  }
  function showCeremony() {
    const first = !state.unlockSeen, rank = state.rank, r = RANKS[rank];
    state.unlockSeen = true; state.seenRank = rank; save(); paintTab();
    const modal = document.createElement('div');
    modal.className = 'ct-modal ct-ceremony';
    modal.innerHTML = `<div class="ct-modal-backdrop"></div><article class="ct-promotion" role="dialog" aria-modal="true" aria-label="진급"><div class="ct-promotion-rays"></div>${insignia(rank, 'ct-promotion-badge', { shine: true })}<small>${first ? 'COMMANDER TRAINING ONLINE' : 'PROMOTION'}</small><h3>${r.name}</h3><p>${first ? '연구실 함장 훈련이 개방되었습니다. 지금까지의 전공으로 계급이 확정되었습니다.' : '새 계급으로 진급했습니다.'}</p><span class="ct-promotion-buff">${r.bonus ? `함대 공격력 +${pct(r.bonus)} · 내구도 +${pct(r.bonus)}` : '계급 효과 없음'}</span><div class="ct-promotion-actions"><button type="button" class="ct-action" data-ct-goto>함장 훈련으로</button><button type="button" class="ct-action ghost" data-ct-close>확인</button></div></article>`;
    document.body.append(modal);
  }

  // ── 이벤트 ────────────────────────────────────────────────────────────
  document.addEventListener('click', event => {
    const t = event.target;
    if (t.closest('[data-ct-close]')) { closeModal(); if (joined.length) showJoin(); return; }
    if (t.closest('[data-ct-join-ok]')) { closeModal(); if (joined.length) showJoin(); return; }
    if (t.closest('[data-ct-goto]')) { closeModal(); window.show?.('summon'); window.summonTab?.('captain'); return; }
    const train_ = t.closest('[data-ct-train]'); if (train_) { train(train_.dataset.ctTrain); return; }
    const rec = t.closest('[data-ct-recruit]'); if (rec) { recruit(rec.dataset.ctRecruit); return; }
    const pick = t.closest('[data-ct-pick]');
    if (pick) {
      const index = Number(pick.closest('.ct-modal')?.dataset.slot), ship = fleetMain()[index];
      if (ship) { assignCaptain(ship, pick.dataset.ctPick || null); save(); render(); window.dispatchEvent(new Event('captain-training-updated')); }
      closeModal();
      return;
    }
    if (!pool?.contains(t)) return;
    const slot = t.closest('[data-ct-slot]'); if (slot) { openPicker(Number(slot.dataset.ctSlot)); return; }
    const card = t.closest('[data-ct-open]'); if (card) openCard(card.dataset.ctOpen);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.querySelector('.ct-modal:not(.ct-ceremony)')) closeModal(); });

  window.CaptainTraining = {
    battleEffects,
    insignia,
    isUnlocked: () => state.unlocked,
    rank: () => (state.unlocked ? RANKS[state.rank] : null),
    rankAbbr: () => (state.unlocked ? RANKS[state.rank].abbr : 'Capt.'),
    rankIndex: () => (state.unlocked ? state.rank : -1),
    sync
  };

  window.addEventListener('DOMContentLoaded', () => {
    pool = document.getElementById('captain-pool');
    tab = document.querySelector('.research-tab-captain');
    if (pool) pool.classList.add('ct-pool');
    tab?.addEventListener('click', () => { if (state.unlocked) window.summonTab?.('captain'); });
    const baseSummonTab = window.summonTab;
    window.summonTab = kind => {
      baseSummonTab?.(kind);
      if (kind === 'captain') { sync(); render(); if (!state.unlockSeen) { state.unlockSeen = true; save(); paintTab(); } }
    };
    paintTab();
    setTimeout(sync, 300);
  });
  window.addEventListener('campaign-gate-cleared', () => setTimeout(sync, 60));
  ['fleet-ownership-updated', 'game-resources-updated', 'commander-character-changed'].forEach(name => window.addEventListener(name, () => setTimeout(sync, 30)));
  // 편성 변경은 따로 알림이 없어 주기적으로 계급 조건(함대 수준)을 확인한다.
  setInterval(() => { if (state.unlocked) sync(); }, 5000);
})();
