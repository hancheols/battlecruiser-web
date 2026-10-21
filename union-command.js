// 연합사령부 — 연합 임무(함대 파견)의 규칙, 저장, 화면.
// 파견된 함선은 보유 수에서 빠져 함대관리·나의 전투·아레나에서 쓸 수 없고, 귀환하거나 임무가 끝나면 다시 쓸 수 있다.
(() => {
  'use strict';

  const KEY = 'starfleet-union-missions-v1';
  const RESOURCE_KEY = 'starfleet-game-resources-v1';
  const HOUR = 3600000;
  const DURATION = 8 * HOUR;          // 최대 임무 시간
  const RARITIES = ['R', 'SR', 'SSR', 'L'];
  const WEAPONS = ['레이저포', '관통레이저', '함포', '미사일', '함재기', '전기'];
  const FRAMES = ['frameCannon', 'frameMissile', 'frameLaser', 'framePiercing', 'frameCarrier'];
  const SHIPS_PER_MISSION = 3;
  const FRAME_NAMES = { frameCannon: '함포 골조', frameMissile: '미사일 골조', frameLaser: '레이저포 골조', framePiercing: '관통레이저 골조', frameCarrier: '함재기 골조' };

  // 지역 설정. minStars: 함선 성급 하한(0이면 없음), frameChance: 완료 시 함선골조 획득 확률(기본 50%, 오르트1은 60%, 오르트5는 70%), 골드·토륨 0은 지급 없음.
  // 오르트구름 지역5의 무기 종류는 기획에 없어서 3종으로 임시 설정했다.
  const REGIONS = [
    { id: 'mars', name: '화성', minRarity: 'R', minStars: 0, minWeapons: 2, thorium: 50, gold: 5000, frameChance: 0.5 },
    { id: 'titan', name: '타이탄', minRarity: 'R', minStars: 2, minWeapons: 2, thorium: 100, gold: 10000, frameChance: 0.5 },
    { id: 'oort1', name: '오르트구름 지역1', minRarity: 'SR', minStars: 0, minWeapons: 3, thorium: 200, gold: 0, frameChance: 0.6 },
    { id: 'oort2', name: '오르트구름 지역2', minRarity: 'SR', minStars: 2, minWeapons: 2, thorium: 0, gold: 20000, frameChance: 0.5 },
    { id: 'oort3', name: '오르트구름 지역3', minRarity: 'SR', minStars: 5, minWeapons: 3, thorium: 250, gold: 0, frameChance: 0.5 },
    { id: 'oort4', name: '오르트구름 지역4', minRarity: 'SSR', minStars: 0, minWeapons: 3, thorium: 250, gold: 25000, frameChance: 0.5 },
    { id: 'oort5', name: '오르트구름 지역5', minRarity: 'SSR', minStars: 2, minWeapons: 3, thorium: 300, gold: 30000, frameChance: 0.7 }
  ];  const regionById = id => REGIONS.find(region => region.id === id);

  // ───────── 저장 ─────────
  const now = () => Date.now();
  const read = () => {
    try { return { active: null, ...(JSON.parse(localStorage.getItem(KEY) || 'null') || {}) }; }
    catch { return { active: null }; }
  };
  const write = state => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

  const isOngoing = mission => Boolean(mission && mission.status === 'ongoing' && now() < mission.endsAt);
  const rankOf = rarity => Math.max(0, RARITIES.indexOf(rarity));
  const rollFrame = region => (Math.random() < region.frameChance ? FRAMES[Math.floor(Math.random() * FRAMES.length)] : null);

  // 시간이 다 된 임무는 '보상 대기'로 넘긴다. 보너스는 이때 한 번만 굴려 저장한다.
  function settle(state) {
    const mission = state.active;
    if (mission && mission.status === 'ongoing' && now() >= mission.endsAt) {
      const region = regionById(mission.regionId);
      mission.status = 'pending';
      mission.payout = { thorium: region.thorium, gold: region.gold, frame: rollFrame(region), recalled: false };
      write(state);
    }
    return state;
  }

  // 함대관리·전투·아레나가 보유 수를 계산할 때 호출한다. 진행 중인 임무의 함선만 빼낸다.
  window.shipReservedCopies = (type, name, rarity, stars) => {
    const mission = read().active;
    if (!isOngoing(mission)) return 0;
    return mission.ships.filter(ship => ship.type === type && ship.name === name && ship.rarity === rarity && ship.stars === stars).length;
  };

  // ───────── 재화 지급 (command-deck.js 의 방식과 같다) ─────────
  function grantResources(delta) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(RESOURCE_KEY) || 'null') || {}; } catch {}
    const current = window.gameResources && typeof window.gameResources === 'object' ? window.gameResources : saved;
    const next = {
      ...current,
      gold: Math.max(0, Number(current.gold) || 0) + (delta.gold || 0),
      thorium: Math.max(0, Number(current.thorium) || 0) + (delta.thorium || 0)
    };
    try { localStorage.setItem(RESOURCE_KEY, JSON.stringify(next)); } catch { return false; }
    window.gameResources = next;
    window.dispatchEvent(new Event('game-resources-updated'));
    return true;
  }

  // ───────── 규칙 ─────────
  const parseKey = key => {
    const [type, name, rarity, stars] = String(key || '').split('|');
    return { type, name, rarity, stars: Number(stars) || 0 };
  };
  const keyOf = v => `${v.type}|${v.name}|${v.rarity}|${v.stars}`;
  // 프리깃은 별도 조건으로 분류하므로 파견 함선 선택에서 뺀다
  const ownedVariants = () => (window.getOwnedShipVariants?.() || []).filter(v => v.type !== 'frigate');

  // 선택한 함선 3대가 조건을 만족하는지 체크리스트로 돌려준다.
  function checklist(region, slots) {
    const owned = ownedVariants();
    const picked = slots.filter(Boolean).map(key => owned.find(v => keyOf(v) === key));
    const counts = {};
    slots.filter(Boolean).forEach(key => { counts[key] = (counts[key] || 0) + 1; });
    const enough = Object.entries(counts).every(([key, n]) => n <= (owned.find(v => keyOf(v) === key)?.copies || 0));
    const weapons = new Set(picked.filter(Boolean).flatMap(weaponsOf));
    const allRarity = picked.length === SHIPS_PER_MISSION && picked.every(v => v && rankOf(v.rarity) >= rankOf(region.minRarity) && (v.stars || 0) >= region.minStars);
    return [
      { ok: picked.length === SHIPS_PER_MISSION && picked.every(Boolean), text: `함선 ${SHIPS_PER_MISSION}대 선택 (${slots.filter(Boolean).length}/${SHIPS_PER_MISSION})` },
      { ok: allRarity, text: `전원 ${region.minRarity}급${region.minStars ? ` ${region.minStars}성` : ''} 이상` },
      { ok: weapons.size >= region.minWeapons, text: `무기 종류 ${region.minWeapons}가지 이상 (현재 ${weapons.size}가지)` },
      { ok: enough, text: '보유 수 안에서 선택' }
    ];
  }
  const passes = list => list.every(item => item.ok);
  // 게임 데이터의 무기 표기는 "관통 레이저"처럼 띄어 쓰기가 섞여 있어서 공백을 빼고 비교한다.
  const weaponsOf = ship => WEAPONS.filter(w => String(ship?.weapon || '').replace(/\s/g, '').includes(w));

  function dispatch(regionId, slots) {
    const region = regionById(regionId);
    const state = settle(read());
    if (!region) return { ok: false, message: '지역을 찾을 수 없습니다.' };
    if (state.active?.status === 'pending') return { ok: false, message: '먼저 지난 임무의 보상을 받아 주세요.' };
    if (state.active) return { ok: false, message: '함대는 한 지역에만 파견할 수 있습니다. 진행 중인 임무를 먼저 마무리하세요.' };
    if (!passes(checklist(region, slots))) return { ok: false, message: '파견 조건을 모두 채워 주세요.' };

    const owned = ownedVariants();
    const ships = slots.map(key => {
      const variant = owned.find(v => keyOf(v) === key);
      return { type: variant.type, name: variant.name, rarity: variant.rarity, stars: variant.stars, weapon: variant.weapon, image: variant.image };
    });
    const startedAt = now();
    state.active = { regionId, startedAt, endsAt: startedAt + DURATION, ships, status: 'ongoing', payout: null };
    state.last = { ...(state.last || {}), [regionId]: [...slots] };   // 지역별 지난 편성 기억
    write(state);
    window.refreshFleetAfterReservation?.();
    window.dispatchEvent(new Event('game-resources-updated'));
    return { ok: true, message: `${region.name}에 함대를 파견했습니다.` };
  }

  // 귀환: 경과 시간에 비례해 최대 보상의 50%를 나눠 지급한다. 보너스는 없다.
  function recall() {
    const state = settle(read());
    const mission = state.active;
    if (!isOngoing(mission)) return { ok: false, message: '회수할 함대가 없습니다.' };
    const region = regionById(mission.regionId);
    const elapsed = Math.min(DURATION, now() - mission.startedAt);
    const ratio = elapsed / DURATION;
    mission.status = 'pending';
    mission.endsAt = now();
    mission.payout = { thorium: Math.floor(region.thorium * 0.5 * ratio), gold: Math.floor(region.gold * 0.5 * ratio), frame: null, recalled: true };
    write(state);
    window.refreshFleetAfterReservation?.();
    return { ok: true, message: '함대를 회수했습니다. 보상을 받아 주세요.' };
  }

  function claim() {
    const state = settle(read());
    const mission = state.active;
    if (!mission || mission.status !== 'pending') return { ok: false, message: '받을 보상이 없습니다.' };
    const { thorium, gold, frame } = mission.payout;
    grantResources({ thorium, gold });
    if (frame) window.grantExplorationLoot?.(frame, 1);
    state.active = null;
    write(state);
    const frameName = frame ? FRAME_NAMES[frame] : '';
    return { ok: true, message: `보상 수령 · 토륨 ${thorium}, 골드 ${gold.toLocaleString('ko-KR')}${frameName ? `, ${frameName} 1개` : ''}` };
  }

  // ───────── 화면 ─────────
  // ───────── 화면 ─────────
  // ───────── 현상수배: 우주해적 (실전 보스전, 제한시간 안에 격파) ─────────
  // 검은수염은 월·수·금, 붉은수염은 화·목·토, 일요일에는 둘 다 나타난다. 도전 기록은 해적마다 따로 센다.
  const FREE_ATTEMPTS = 5;
  const stageSpecs = names => [
    { stage: 1, name: names[0], hp: 10000, limit: 90, reward: 50 },
    { stage: 2, name: names[1], hp: 100000, limit: 90, reward: 250 },
    { stage: 3, name: names[2], hp: 1000000, limit: 90, reward: 500 },
    { stage: 4, name: names[3], hp: 5000000, limit: 60, reward: 1000 }
  ];
  const PIRATES = [
    { id: 'black', title: '우주해적 검은수염', image: 'blackbeard.webp', key: 'starfleet-union-bounty-v1', days: [1, 3, 5, 0], dayText: '월·수·금·일', stages: stageSpecs(['검은수염 해적선', '검은수염 대장선', '검은수염 에드', '전설의 검은수염']) },
    { id: 'red', title: '우주해적 붉은수염', image: 'redbeard.webp', key: 'starfleet-union-bounty-red-v1', days: [2, 4, 6, 0], dayText: '화·목·토·일', stages: stageSpecs(['붉은수염 해적선', '붉은수염 대장선', '붉은수염 제독', '전설의 붉은수염']) }
  ];
  const pirateById = id => PIRATES.find(pirate => pirate.id === id);
  const piratesToday = () => PIRATES.filter(pirate => pirate.days.includes(new Date().getDay()));
  // 기기 시간 기준으로 하루가 바뀌면 도전 횟수와 클리어 기록을 비운다(단계 개방은 유지).
  const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function readBounty(pirate) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(pirate.key) || 'null') || {}; } catch {}
    const fresh = saved.day === dayKey();
    return {
      unlocked: Math.min(pirate.stages.length, Math.max(1, Number(saved.unlocked) || 1)),
      day: dayKey(),
      attempts: fresh ? Math.max(0, Number(saved.attempts) || 0) : 0,
      cleared: fresh && Array.isArray(saved.cleared) ? saved.cleared.map(Number) : []
    };
  }
  const writeBounty = (pirate, state) => { try { localStorage.setItem(pirate.key, JSON.stringify(state)); } catch {} };
  // 무료 5회가 지나면 도전마다 50토륨씩 늘어나고 500토륨에서 멈춘다.
  const attemptCost = attempts => (attempts < FREE_ATTEMPTS ? 0 : Math.min(500, 50 * (attempts - FREE_ATTEMPTS + 1)));
  const thoriumBalance = () => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(RESOURCE_KEY) || 'null') || {}; } catch {}
    const current = window.gameResources && typeof window.gameResources === 'object' ? window.gameResources : saved;
    return Math.max(0, Number(current.thorium) || 0);
  };

  function bountyStart(pirateId, stage) {
    const pirate = pirateById(pirateId);
    const spec = pirate?.stages.find(item => item.stage === Number(stage));
    if (!spec) return { ok: false, message: '현상수배를 찾을 수 없습니다.' };
    if (!piratesToday().includes(pirate)) return { ok: false, message: `${pirate.title}은(는) ${pirate.dayText}에 나타납니다.` };
    const state = readBounty(pirate);
    if (spec.stage > state.unlocked) return { ok: false, message: '이전 단계를 먼저 클리어하세요.' };
    if (state.cleared.length) return { ok: false, message: '오늘은 이미 클리어했습니다. 내일 다시 도전할 수 있습니다.' };
    if (window.tutorialAllowsScreen && !window.tutorialAllowsScreen('battle')) return { ok: false, message: '튜토리얼을 먼저 진행해 주세요.' };
    if (!(window.getFleetAssignments?.() || []).slice(0, 3).some(Boolean)) return { ok: false, message: '함대관리에서 주력 함선을 먼저 편성하세요.' };
    const cost = attemptCost(state.attempts);
    if (cost) {
      const have = thoriumBalance();
      if (have < cost) return { ok: false, message: `토륨이 부족합니다. (필요 ${cost}, 보유 ${have})` };
      if (!grantResources({ thorium: -cost })) return { ok: false, message: '저장에 실패했습니다. 다시 시도해 주세요.' };
    }
    state.attempts += 1;
    writeBounty(pirate, state);
    const operation = { chapter: 1, region: 'bounty', regionName: '현상수배', regionEn: 'BOUNTY', gate: 1, bounty: { ...spec, pirate: pirate.id, image: pirate.image } };
    window.battleOperation = operation;
    window.show?.('battle');
    requestAnimationFrame(() => window.prepareBattle?.(operation));
    // 아레나처럼 전장이 준비되면 바로 전투가 시작된다.
    setTimeout(() => { if (window.battleOperation === operation) document.getElementById('battle-start')?.click(); }, 700);
    return { ok: true, message: '' };
  }

  // 전투가 끝나면 엔진이 부른다. 승리하면 오늘 클리어로 기록하고 다음 날 다음 단계를 연다. 보상(토륨)은 엔진이 지급한다.
  function bountyFinish(pirateId, stage, victory) {
    const pirate = pirateById(pirateId);
    const spec = pirate?.stages.find(item => item.stage === Number(stage));
    if (!spec || !victory) return { reward: 0, next: false };
    const state = readBounty(pirate);
    // 하루에 모든 단계를 통틀어 한 번만 클리어할 수 있고, 보상도 그때 한 번만 받는다.
    const first = state.cleared.length === 0;
    if (first) state.cleared.push(spec.stage);
    state.unlocked = Math.max(state.unlocked, Math.min(pirate.stages.length, spec.stage + 1));
    writeBounty(pirate, state);
    return { reward: first ? spec.reward : 0, next: false };
  }

  function bountyReturn() {
    ui.sub = 'bounty';
    ui.confirmStage = '';
    window.show?.('earth-union');
    window.openUnionFacility?.('command');
  }

  const ui = { sub: 'menu', confirmStage: '', regionId: null, slots: [null, null, null], notice: '', picking: false, sheetNote: '', sort: 'power-asc', onlyEligible: false, weapon: '' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmt = ms => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const pad = n => String(n).padStart(2, '0');
    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total % 3600 / 60))}:${pad(total % 60)}`;
  };
  const reqText = region => `${region.minRarity}급${region.minStars ? ` ${region.minStars}성` : ''} 이상 함선 3대 · 무기 ${region.minWeapons}종 이상`;
  const fixedRewardText = region => [region.thorium ? `토륨 ${region.thorium}` : '', region.gold ? `골드 ${region.gold.toLocaleString('ko-KR')}` : ''].filter(Boolean).join(' · ') || '없음';
  const chanceRewardText = region => (region.frameChance ? `함선골조 1개 (${Math.round(region.frameChance * 100)}%)` : '없음');
  const pips = (value, total) => `<span class="cmd-pips" aria-label="난이도 ${value}/${total}">${Array.from({ length: total }, (_, i) => `<i class="${i < value ? 'on' : ''}"></i>`).join('')}</span>`;
  const panel = (title, body) => `<section class="fac-panel cmd-panel"><h3><i></i>${title}</h3>${body}</section>`;
  const notice = () => {
    const text = ui.notice;
    ui.notice = '';
    return text ? `<p class="cmd-notice" role="status">${esc(text)}</p>` : '';
  };

  // 배틀 편성(함대관리)과 아레나 덱에 이미 들어간 함선 키 목록. 목록에서 어둡게 표시한다.
  function inUseKeys() {
    const keys = new Set();
    (window.getFleetAssignments?.() || []).forEach(ship => {
      if (ship) keys.add(`${ship.type}|${ship.name}|${ship.rarity}|${Number(ship.enhancementStars) || 0}`);
    });
    try {
      const arena = JSON.parse(localStorage.getItem('starfleet-async-arena-v1') || 'null') || {};
      [...(arena.attack || []), ...(arena.defense || [])].forEach(ship => {
        if (ship) keys.add(`${ship.type}|${ship.name}|${ship.rarity}|${Number(ship.enhancementStars) || 0}`);
      });
    } catch {}
    return keys;
  }

  function statusBanner(state) {
    const mission = state.active;
    if (!mission) return '';
    const region = regionById(mission.regionId);
    if (mission.status === 'pending') {
      return `<section class="cmd-status ready"><div><small>귀환 완료</small><b>${esc(region.name)}</b></div><span>보상 대기 중</span></section>`;
    }
    return `<section class="cmd-status"><div><small>파견 중</small><b>${esc(region.name)}</b></div><span>남은 시간 <b class="cmd-clock" data-cmd-remaining data-ends="${mission.endsAt}">${fmt(mission.endsAt - now())}</b></span></section>`;
  }

  // 메뉴 칸: 제목과 '의뢰 n건'만 둔다. 배경 그림은 반투명으로 깔고, 테두리는 임무 컨셉에 맞춘다.
  function menuView(state) {
    return panel('연합 임무', `<div class="cmd-menu">
      <button type="button" class="cmd-cell cmd-dispatch${state.active ? ' live' : ''}" style="--cell-img:url('battle-scene-background.png')" data-cmd="dispatch"><b>함대파견</b><small>의뢰 ${REGIONS.length}건</small></button>
      <button type="button" class="cmd-cell cmd-wanted live" style="--cell-img:url('mystery-battleship-outline.png')" data-cmd="bounty"><b>현상수배</b><small>${piratesToday().map(pirate => pirate.title).join(' · ')}</small></button>
      <button type="button" class="cmd-cell cmd-soon" style="--cell-img:url('mystery-weapon-outline.png')" disabled><b>COMING SOON</b></button>
    </div>`);
  }

  function dispatchView(state) {
    const rows = REGIONS.map((region, index) => {
      const mine = state.active?.regionId === region.id;
      const pending = mine && state.active.status === 'pending';
      const badge = mine ? `<em class="cmd-inline">${pending ? '보상 대기' : '파견 중'}</em>` : '';
      const right = mine && !pending ? `<span class="cmd-timer" data-cmd-remaining data-ends="${state.active.endsAt}">${fmt(state.active.endsAt - now())}</span>` : (state.active && !mine ? '<span class="cmd-tag">잠김</span>' : '');
      return `<button type="button" class="cmd-cell cmd-region${mine ? ' live' : ''}" data-cmd="region" data-region="${region.id}"><div><div class="cmd-row-title"><b>${esc(region.name)}</b>${badge}</div>${pips(index + 1, REGIONS.length)}</div>${right}</button>`;
    }).join('');
    return `<div class="cmd-back-row"><button type="button" class="fac-back cmd-back" data-cmd="menu">‹ 임무 메뉴</button></div>${panel('함대파견', `<p class="cmd-intro">연방함대 의뢰 : 잔당 소탕</p><div class="cmd-menu">${rows}</div>`)}`;
  }

  function pirateBlock(pirate) {
    const state = readBounty(pirate);
    const cost = attemptCost(state.attempts);
    const freeLeft = Math.max(0, FREE_ATTEMPTS - state.attempts);
    const done = state.cleared.length > 0;
    const rows = pirate.stages.map(item => {
      const locked = item.stage > state.unlocked;
      const doneHere = state.cleared.includes(item.stage);
      const id = `${pirate.id}:${item.stage}`;
      const confirm = ui.confirmStage === id;
      const tag = done ? `<span class="cmd-tag done">${doneHere ? '오늘 클리어' : '내일 도전'}</span>`
        : locked ? '<span class="cmd-tag">잠김</span>'
        : `<span class="cmd-tag go">${confirm ? `토륨 ${cost} 사용 · 한 번 더 누르면 시작` : cost ? `도전 · 토륨 ${cost}` : '도전'}</span>`;
      return `<button type="button" class="cmd-cell cmd-bounty-row${locked ? ' locked' : ''}${done ? ' done' : ''}${confirm ? ' confirm' : ''}" data-cmd="bounty-go" data-pirate="${pirate.id}" data-stage="${item.stage}"${locked || done ? ' disabled' : ''}><div><div class="cmd-row-title"><b>${item.stage}단계 · ${esc(item.name)}</b></div><small class="cmd-bounty-meta">내구도 ${item.hp.toLocaleString('ko-KR')} · 제한시간 ${item.limit}초</small></div><div class="cmd-bounty-side"><span class="cmd-bounty-reward">토륨 ${item.reward}</span>${tag}</div></button>`;
    }).join('');
    const attemptLine = freeLeft ? `오늘 도전 ${state.attempts}회 · 무료 ${freeLeft}회 남음` : `오늘 도전 ${state.attempts}회 · 다음 도전 토륨 ${cost}`;
    return panel(esc(pirate.title), `<div class="cmd-wanted-hero ${pirate.id}"><img src="${pirate.image}" alt="${esc(pirate.title)}" onerror="this.onerror=null;this.src='blackbeard.webp'" /><div><small>WANTED</small><b>${esc(pirate.title)}</b><span>출현 ${pirate.dayText}</span><span>${attemptLine}</span></div></div><div class="cmd-menu">${rows}</div>`);
  }

  function bountyView() {
    const blocks = piratesToday().map(pirateBlock).join('');
    return `<div class="cmd-back-row"><button type="button" class="fac-back cmd-back" data-cmd="menu">‹ 임무 메뉴</button></div>${blocks}<p class="cmd-rule">검은수염은 월·수·금, 붉은수염은 화·목·토에 나타나고 일요일에는 둘 다 나타납니다 · 하루에 한 번만 클리어(보상도 1회) · 이전 단계를 클리어하면 다음 날 다음 단계 도전 가능 · 무료 ${FREE_ATTEMPTS}회 이후 토륨 50부터 50씩 늘어나 최대 500</p>`;
  }

  // 파견 지역에서 싸우는 듯한 작은 장면. 가로로 넓은 칸이라 횡스크롤 형태로 그린다:
  // 아군 3대(왼쪽)가 오른쪽을 보고 달리며 오른쪽의 적을 공격한다. 전투용 탑뷰 그림을 시계 방향으로 90도 돌려 쓴다.
  const FOE_IMAGES = { mars: 'enemy-gasimon.png', titan: 'enemy-blue-claw.png', oort1: 'enemy-blue-stinger.png', oort2: 'enemy-blue-spike.png', oort3: 'enemy-jipgemon.png', oort4: 'enemy-suicide-monster.png', oort5: 'enemy-blue-suicide.png' };
  const FOE_SLOTS = [[80, 22, 0], [91, 42, .9], [74, 62, 1.7], [87, 80, .4], [95, 56, 1.3]];
  const TINTS = { mars: '255,110,70', titan: '255,170,70', oort1: '90,170,255', oort2: '120,220,160', oort3: '170,140,255', oort4: '255,120,150', oort5: '255,220,120' };
  function battleScene(region, mission) {
    const foe = FOE_IMAGES[region.id] || 'enemy-raptor.png';
    const foes = FOE_SLOTS.map(([x, y, d]) => `<span class="cmd-foe" style="--x:${x}%;--y:${y}%;--d:${d}s"><img src="${foe}" alt="" /><i class="cmd-boom" style="--d:${d + .5}s"></i></span>`).join('');
    const foeShots = FOE_SLOTS.slice(0, 4).map(([x, y, d], i) => `<i class="cmd-fshot" style="--x:${x - 6}%;--y:${y}%;--d:${(d + i * .45).toFixed(2)}s"></i>`).join('');
    const lanes = [[14, 34], [19, 57], [14, 80]];
    const ships = (mission.ships || []).slice(0, 3).map((ship, i) => {
      const top = window.getShipTopviewImage?.(ship);
      return `<span class="cmd-ally" style="--x:${lanes[i][0]}%;--y:${lanes[i][1]}%;--d:${i * .35}s"><img class="${top ? 'rot' : ''}" src="${esc(top || ship.image || '')}" alt="" /><i class="cmd-flame"></i></span>`;
    }).join('');
    const shots = lanes.flatMap(([x, y], i) => [0, 1].map(k => `<i class="cmd-shot" style="--x:${x + 6}%;--y:${y}%;--d:${(i * .31 + k * .7).toFixed(2)}s"></i>`)).join('');
    return `<div class="cmd-battle" style="--tint:${TINTS[region.id] || '255,170,70'}" role="img" aria-label="${esc(region.name)}에서 교전 중인 파견 함대"><div class="cmd-bg"></div><div class="cmd-stars"></div><div class="cmd-stars s2"></div><span class="cmd-battle-tag"><i class="cmd-pulse"></i>${esc(region.name)} · 교전 중</span>${foes}${foeShots}${shots}${ships}</div>`;
  }

  function regionView(state) {
    const region = regionById(ui.regionId) || REGIONS[0];
    const back = `<div class="cmd-back-row"><button type="button" class="fac-back cmd-back" data-cmd="dispatch">‹ 의뢰 목록</button></div>`;
    const info = panel(esc(region.name), `<ul class="cmd-facts"><li><span>요구 조건</span><b>${reqText(region)}</b></li><li><span>확정 보상</span><b>${fixedRewardText(region)}</b></li><li><span>확률 보상</span><b>${chanceRewardText(region)}</b></li></ul>`);

    if (state.active && state.active.regionId === region.id) {
      const mission = state.active;
      if (mission.status === 'pending') {
        const pay = mission.payout;
        return back + info + panel('귀환 보고', `<ul class="cmd-facts"><li><span>토륨</span><b>${pay.thorium}</b></li><li><span>골드</span><b>${pay.gold.toLocaleString('ko-KR')}</b></li><li><span>함선골조</span><b>${pay.frame ? '1개' : '없음'}</b></li></ul><button type="button" class="fac-btn cmd-action" data-cmd="claim">보상 받기</button>`);
      }
      const elapsed = Math.min(DURATION, now() - mission.startedAt);
      const ratio = elapsed / DURATION;
      const preview = `토륨 ${Math.floor(region.thorium * 0.5 * ratio)} · 골드 ${Math.floor(region.gold * 0.5 * ratio).toLocaleString('ko-KR')} (보너스 없음)`;
      return back + info + panel('파견 중인 함대', `${battleScene(region, mission)}<p class="cmd-preview">회수 시 지급 예상: ${preview}</p><button type="button" class="fac-btn cmd-action danger" data-cmd="recall">함대 회수</button>`);
    }
    if (state.active) {
      const other = regionById(state.active.regionId);
      const msg = state.active.status === 'pending' ? `${other.name}의 보상을 먼저 받아 주세요.` : `${other.name}에 함대가 파견 중입니다. 한 지역에만 파견할 수 있습니다.`;
      return back + info + panel('파견 불가', `<p class="cmd-intro">${esc(msg)}</p>`);
    }

    const owned = ownedVariants();
    const slots = ui.slots.map((key, i) => {
      const picked = owned.find(v => keyOf(v) === key);
      const label = picked ? `<img src="${esc(picked.image || '')}" alt="" /><span>${esc(picked.name)} · ${picked.rarity}${picked.stars ? ` ★${picked.stars}` : ''}</span>` : '<span class="cmd-empty">선택</span>';
      return `<div class="cmd-slot"><span class="cmd-slot-no">${i + 1}</span><button type="button" class="cmd-pick${picked ? ' filled' : ''}" data-cmd="pick" data-slot="${i}">${label}</button>${picked ? `<button type="button" class="cmd-slot-x" data-cmd="slot-clear" data-slot="${i}" aria-label="${i + 1}번 칸 비우기">✕</button>` : ''}</div>`;
    }).join('');
    const checks = checklist(region, ui.slots);
    const ready = passes(checks);
    const checkList = `<ul class="cmd-check">${checks.map(c => `<li class="${c.ok ? 'ok' : 'ng'}">${c.ok ? '✔' : '✖'} ${esc(c.text)}</li>`).join('')}</ul>`;
    const hasLast = Array.isArray(state.last?.[region.id]);
    const tools = `<div class="cmd-tools"><button type="button" class="cmd-tool" data-cmd="pick">함선 고르기</button><button type="button" class="cmd-tool" data-cmd="auto">자동 편성</button>${hasLast ? '<button type="button" class="cmd-tool" data-cmd="repeat">지난 편성으로 파견</button>' : ''}<button type="button" class="cmd-tool ghost" data-cmd="clear">비우기</button></div>`;
    const form = owned.length
      ? `${tools}<div class="cmd-slots">${slots}</div>${checkList}<button type="button" class="fac-btn cmd-action" data-cmd="go" ${ready ? '' : 'disabled'}>함대 파견</button>`
      : `<p class="cmd-intro">파견할 함선이 없습니다. 함대관리에서 함선을 먼저 확보하세요.</p>`;
    return back + info + panel('함대 편성', form);
  }

  // 못 쓰는 이유를 문장으로 돌려준다(쓸 수 있으면 빈 문자열).
  const ineligibleReason = (region, v, used) => {
    if (rankOf(v.rarity) < rankOf(region.minRarity)) return `${region.minRarity}급 이상 필요`;
    if ((v.stars || 0) < region.minStars) return `${region.minStars}성 이상 필요`;
    if (used.has(keyOf(v))) return '배틀·아레나 편성 중';
    return '';
  };

  // 함선의 세기를 하나의 숫자로 본다. 등급 > 성급 > 내구 · 화력 순으로 크게 반영한다.
  function powerFn() {
    const catalog = window.getFleetCatalog?.() || [];
    return v => {
      const profile = catalog.find(ship => ship.type === v.type && ship.name === v.name)?.profile;
      return rankOf(v.rarity) * 100000 + (v.stars || 0) * 10000 + (Number(profile?.[0]) || 0) + (Number(profile?.[2]) || 0) * 3;
    };
  }

  // 자동 편성: 조건을 만족하는 3대 중 가장 약한 조합(전투용으로 강한 함선을 아끼는 방식)을 고른다.
  function autoFill(region) {
    const used = inUseKeys();
    const power = powerFn();
    const pool = [];
    ownedVariants().forEach(v => {
      if (ineligibleReason(region, v, used)) return;
      const entry = { key: keyOf(v), score: power(v), weapons: weaponsOf(v) };
      for (let c = 0; c < Math.min(SHIPS_PER_MISSION, v.copies); c += 1) pool.push(entry);
    });
    pool.sort((a, b) => a.score - b.score);
    if (pool.length < SHIPS_PER_MISSION) return { ok: false, message: `조건에 맞는 함선이 ${pool.length}대뿐입니다. (필요 ${SHIPS_PER_MISSION}대)` };
    let best = null;
    for (let i = 0; i < pool.length - 2; i += 1) {
      for (let j = i + 1; j < pool.length - 1; j += 1) {
        for (let k = j + 1; k < pool.length; k += 1) {
          const total = pool[i].score + pool[j].score + pool[k].score;
          if (best && total >= best.total) continue;
          const kinds = new Set([...pool[i].weapons, ...pool[j].weapons, ...pool[k].weapons]);
          if (kinds.size < region.minWeapons) continue;
          best = { total, keys: [pool[i].key, pool[j].key, pool[k].key] };
        }
      }
    }
    if (!best) return { ok: false, message: `무기 종류 ${region.minWeapons}가지를 채우는 조합이 없습니다.` };
    return { ok: true, keys: best.keys };
  }

  // 지난 편성: 지금도 쓸 수 있는 함선만 남기고 나머지는 비운다.
  function repeatLast(region) {
    const last = read().last?.[region.id];
    if (!Array.isArray(last) || last.length !== SHIPS_PER_MISSION) return { ok: false, message: '이 지역의 지난 편성 기록이 없습니다.' };
    const owned = ownedVariants();
    const used = inUseKeys();
    const keys = [];
    const missing = [];
    last.forEach(key => {
      const v = owned.find(x => keyOf(x) === key);
      const taken = keys.filter(k => k === key).length;
      let reason = '';
      if (!v) reason = '보유하지 않음';
      else if (taken >= v.copies) reason = '보유 수 부족';
      else reason = ineligibleReason(region, v, used);
      if (reason) { keys.push(null); missing.push(`${parseKey(key).name}(${reason})`); } else keys.push(key);
    });
    return { ok: true, keys, missing };
  }

  const SORTS = [
    ['power-asc', '약한 순'],
    ['power-desc', '강한 순'],
    ['rarity-desc', '등급 높은 순'],
    ['stars-desc', '성급 높은 순'],
    ['name', '이름순']
  ];

  // 함선 고르기 시트: 한 번 열어서 최대 3대까지 체크한다. 아래 줄에 선택 현황과 조건이 실시간으로 보인다.
  function pickerHtml(region) {
    const used = inUseKeys();
    const power = powerFn();
    const selectedKeys = ui.slots.filter(Boolean);
    const selectedShips = selectedKeys.map(key => ownedVariants().find(v => keyOf(v) === key)).filter(Boolean);
    const haveKinds = new Set(selectedShips.flatMap(weaponsOf));
    const needMore = selectedKeys.length > 0 && haveKinds.size < region.minWeapons && selectedKeys.length < SHIPS_PER_MISSION;

    let list = ownedVariants().map(v => ({ v, key: keyOf(v), reason: ineligibleReason(region, v, used), score: power(v) }));
    if (ui.weapon) list = list.filter(item => weaponsOf(item.v).includes(ui.weapon));
    if (ui.onlyEligible) list = list.filter(item => !item.reason);
    const order = {
      'power-asc': (a, b) => a.score - b.score,
      'power-desc': (a, b) => b.score - a.score,
      'rarity-desc': (a, b) => rankOf(b.v.rarity) - rankOf(a.v.rarity) || (b.v.stars || 0) - (a.v.stars || 0),
      'stars-desc': (a, b) => (b.v.stars || 0) - (a.v.stars || 0) || rankOf(b.v.rarity) - rankOf(a.v.rarity),
      'name': (a, b) => a.v.name.localeCompare(b.v.name, 'ko')
    }[ui.sort] || ((a, b) => a.score - b.score);
    list.sort((a, b) => (a.reason ? 1 : 0) - (b.reason ? 1 : 0) || order(a, b));

    const cards = list.map(({ v, key, reason }) => {
      const count = ui.slots.filter(k => k === key).length;
      const positions = ui.slots.map((k, i) => (k === key ? i + 1 : 0)).filter(Boolean);
      const gain = needMore && !reason ? weaponsOf(v).filter(w => !haveKinds.has(w)) : [];
      const note = reason || `보유 ${v.copies}${count ? ` · 선택 ${count}` : ''}`;
      return `<button type="button" class="cmd-card${reason ? ' dim' : ''}${count ? ' on' : ''}" data-cmd="card" data-key="${esc(key)}" ${reason ? 'disabled' : ''}>${count ? `<i class="cmd-order">${positions.join('·')}</i>` : ''}${gain.length ? `<i class="cmd-new">+${esc(gain.join('·'))}</i>` : ''}<div class="cmd-card-img">${v.image ? `<img src="${esc(v.image)}" alt="" />` : ''}</div><b>${esc(v.name)}</b><span>${v.rarity}${v.stars ? ` ★${v.stars}` : ''} · ${esc(v.weapon || '무기 미정')}</span><em>${esc(note)}</em></button>`;
    }).join('');

    const chips = ['', ...WEAPONS].map(w => `<button type="button" class="cmd-chip" data-cmd="filter" data-weapon="${esc(w)}" aria-pressed="${ui.weapon === w}">${w || '전체'}</button>`).join('');
    const sortSelect = `<select data-cmd-sort aria-label="정렬">${SORTS.map(([id, label]) => `<option value="${id}"${ui.sort === id ? ' selected' : ''}>${label}</option>`).join('')}</select>`;
    const mini = ui.slots.map((key, i) => {
      const v = ownedVariants().find(x => keyOf(x) === key);
      return `<button type="button" class="cmd-mini-slot${v ? ' filled' : ''}" data-cmd="slot-clear" data-slot="${i}" aria-label="${i + 1}번 칸${v ? ' 비우기' : ''}">${v ? `<img src="${esc(v.image || '')}" alt="" /><b>${esc(v.name)}</b>` : `<span>${i + 1}</span>`}</button>`;
    }).join('');
    const checks = checklist(region, ui.slots);
    const ready = passes(checks);
    const note = ui.sheetNote ? `<p class="cmd-sheet-note" role="status">${esc(ui.sheetNote)}</p>` : '';
    return `<div class="cmd-sheet cmd-multi" role="dialog" aria-modal="true" aria-label="함대 편성"><header><b>함대 편성 · ${esc(region.name)}</b><button type="button" class="cmd-close" data-cmd="pick-close">닫기</button></header><div class="cmd-toolbar">${sortSelect}<label class="cmd-only"><input type="checkbox" data-cmd-only ${ui.onlyEligible ? 'checked' : ''}/> 조건 맞는 함선만</label></div><div class="cmd-chips">${chips}</div>${cards ? `<div class="cmd-grid">${cards}</div>` : '<p class="cmd-intro">조건에 맞는 함선이 없습니다.</p>'}<footer class="cmd-bar">${note}<div class="cmd-mini">${mini}</div><ul class="cmd-check cmd-check-mini">${checks.map(c => `<li class="${c.ok ? 'ok' : 'ng'}">${c.ok ? '✔' : '✖'} ${esc(c.text)}</li>`).join('')}</ul><div class="cmd-bar-actions"><button type="button" data-cmd="auto">자동 편성</button><button type="button" class="cmd-bar-go" data-cmd="go" ${ready ? '' : 'disabled'}>파견</button><button type="button" class="cmd-done" data-cmd="pick-close">완료</button></div></footer></div>`;
  }

  // 선택 시트는 화면 밖(body)에 띄운다. 상위 화면의 변형 효과에 가려지지 않도록.
  function renderModal() {
    let root = document.getElementById('cmd-modal-root');
    if (!root) { root = document.createElement('div'); root.id = 'cmd-modal-root'; document.body.appendChild(root); }
    const region = regionById(ui.regionId);
    if (ui.picking && region && ui.sub === 'region') {
      const prevTop = root.querySelector('.cmd-grid')?.scrollTop || 0;
      root.innerHTML = `<div class="cmd-backdrop" data-cmd="pick-close">${pickerHtml(region)}</div>`;
      const grid = root.querySelector('.cmd-grid');
      if (grid) grid.scrollTop = prevTop;
    } else {
      root.innerHTML = '';
    }
  }

  function screen(heroHtml) {
    const state = settle(read());
    const body = ui.sub === 'region' ? regionView(state) : ui.sub === 'dispatch' ? dispatchView(state) : ui.sub === 'bounty' ? bountyView() : menuView(state);
    return `${heroHtml}<div class="cmd-wrap">${notice()}${statusBanner(state)}${body}</div>`;
  }

  const rerender = () => {
    renderModal();
    window.renderUnionScreen?.();
  };

  document.addEventListener('click', event => {
    const el = event.target.closest?.('[data-cmd]');
    if (!el || el.disabled) return;
    if (!el.closest('#earth-union, #cmd-modal-root')) return;
    const act = el.dataset.cmd;
    const region = regionById(ui.regionId);
    const reset = () => { ui.sub = 'menu'; ui.slots = [null, null, null]; ui.picking = false; ui.sheetNote = ''; };
    if (act === 'menu') { reset(); ui.confirmStage = ''; }
    else if (act === 'bounty') { ui.sub = 'bounty'; ui.confirmStage = ''; }
    else if (act === 'bounty-go') {
      const pirate = pirateById(el.dataset.pirate);
      const stage = Number(el.dataset.stage);
      const id = `${el.dataset.pirate}:${stage}`;
      if (pirate && attemptCost(readBounty(pirate).attempts) && ui.confirmStage !== id) ui.confirmStage = id;
      else {
        ui.confirmStage = '';
        const started = bountyStart(el.dataset.pirate, stage);
        if (started.ok) return;
        ui.notice = started.message;
      }
    }
    else if (act === 'dispatch') { ui.sub = 'dispatch'; }
    else if (act === 'region') { ui.sub = 'region'; ui.regionId = el.dataset.region; ui.slots = [null, null, null]; ui.picking = false; }
    else if (act === 'pick') { ui.picking = true; ui.sheetNote = ''; }
    else if (act === 'pick-close') { if (event.target === el || el.classList.contains('cmd-close') || el.classList.contains('cmd-done')) { ui.picking = false; ui.sheetNote = ''; } }
    else if (act === 'card') {
      // 눌러서 담고, 이미 고른 함선을 다시 누르면 뺀다(보유 수가 남아 있고 빈 칸이 있으면 한 대 더 담는다).
      const key = el.dataset.key;
      const v = ownedVariants().find(x => keyOf(x) === key);
      const count = ui.slots.filter(k => k === key).length;
      const empty = ui.slots.indexOf(null);
      if (v && count < v.copies && empty >= 0) { ui.slots[empty] = key; ui.sheetNote = ''; }
      else if (count > 0) { ui.slots = ui.slots.map(k => (k === key ? null : k)); ui.sheetNote = ''; }
      else { ui.sheetNote = '3대를 모두 골랐습니다. 아래 칸을 눌러 하나를 비운 뒤 고르세요.'; }
    }
    else if (act === 'slot-clear') { ui.slots[Number(el.dataset.slot)] = null; ui.sheetNote = ''; }
    else if (act === 'clear') { ui.slots = [null, null, null]; ui.sheetNote = ''; }
    else if (act === 'filter') { ui.weapon = ui.weapon === el.dataset.weapon ? '' : el.dataset.weapon; }
    else if (act === 'auto' && region) {
      const result = autoFill(region);
      if (result.ok) { ui.slots = result.keys; ui.sheetNote = '약한 함선 우선으로 자동 편성했습니다.'; ui.notice = ui.sheetNote; }
      else { ui.sheetNote = result.message; ui.notice = result.message; }
    }
    else if (act === 'repeat' && region) {
      const result = repeatLast(region);
      if (!result.ok) { ui.notice = result.message; }
      else {
        ui.slots = result.keys;
        if (!result.missing.length && passes(checklist(region, ui.slots))) {
          const sent = dispatch(ui.regionId, ui.slots);
          ui.notice = sent.message;
          if (sent.ok) reset();
        } else {
          ui.notice = result.missing.length ? `지난 편성에서 쓸 수 없는 함선: ${result.missing.join(', ')}. 빈 칸을 채워 주세요.` : '파견 조건을 확인해 주세요.';
        }
      }
    }
    else if (act === 'go') {
      const result = dispatch(ui.regionId, ui.slots);
      ui.notice = result.message;
      if (result.ok) reset(); else ui.sheetNote = result.message;
    } else if (act === 'recall') {
      const result = recall();
      ui.notice = result.message;
    } else if (act === 'claim') {
      const result = claim();
      ui.notice = result.message;
      if (result.ok) { ui.sub = 'dispatch'; ui.slots = [null, null, null]; }
    }
    rerender();
  });

  // 정렬과 '조건 맞는 함선만'은 입력 값이 바뀔 때 처리한다.
  document.addEventListener('change', event => {
    const target = event.target;
    if (!target?.closest?.('#cmd-modal-root')) return;
    if (target.matches?.('[data-cmd-sort]')) { ui.sort = target.value; rerender(); }
    else if (target.matches?.('[data-cmd-only]')) { ui.onlyEligible = target.checked; rerender(); }
  });

  // 파견 중인 시간을 1초마다 갱신하고, 끝나는 순간 화면을 '보상 대기'로 바꾼다.
  setInterval(() => {
    const clocks = document.querySelectorAll('#earth-union [data-cmd-remaining]');
    if (!clocks.length) return;
    let expired = false;
    clocks.forEach(el => {
      const left = Number(el.dataset.ends) - now();
      if (left <= 0) expired = true;
      el.textContent = fmt(left);
    });
    if (expired) rerender();
  }, 1000);

  const boot = () => {
    settle(read());
    window.refreshFleetAfterReservation?.();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.UnionCommand = { screen, regions: REGIONS, read, dispatch, recall, claim, pirates: PIRATES, bountyStart, bountyFinish, bountyReturn };
})();
