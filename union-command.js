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

  // 지역 설정. minStars: 함선 성급 하한(0이면 없음), frameChance: 완료 시 함선골조 확률, 골드·토륨 0은 지급 없음.
  // 오르트구름 지역5의 무기 종류는 기획에 없어서 3종으로 임시 설정했다.
  const REGIONS = [
    { id: 'mars', name: '화성', minRarity: 'R', minStars: 0, minWeapons: 2, thorium: 50, gold: 5000, frameChance: 0.5 },
    { id: 'titan', name: '타이탄', minRarity: 'R', minStars: 2, minWeapons: 2, thorium: 100, gold: 10000, frameChance: 0 },
    { id: 'oort1', name: '오르트구름 지역1', minRarity: 'SR', minStars: 0, minWeapons: 3, thorium: 200, gold: 0, frameChance: 0.6 },
    { id: 'oort2', name: '오르트구름 지역2', minRarity: 'SR', minStars: 2, minWeapons: 2, thorium: 0, gold: 20000, frameChance: 0 },
    { id: 'oort3', name: '오르트구름 지역3', minRarity: 'SR', minStars: 5, minWeapons: 3, thorium: 250, gold: 0, frameChance: 0 },
    { id: 'oort4', name: '오르트구름 지역4', minRarity: 'SSR', minStars: 0, minWeapons: 3, thorium: 250, gold: 25000, frameChance: 0 },
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
  const ui = { sub: 'menu', regionId: null, slots: [null, null, null], notice: '', picking: null, confirmPick: null };
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
      <button type="button" class="cmd-cell cmd-wanted" style="--cell-img:url('mystery-battleship-outline.png')" disabled><b>현상수배</b></button>
      <button type="button" class="cmd-cell cmd-soon" style="--cell-img:url('mystery-weapon-outline.png')" disabled><b>COMING SOON</b></button>
    </div>`);
  }

  function dispatchView(state) {
    const rows = REGIONS.map((region, index) => {
      const mine = state.active?.regionId === region.id;
      const tag = mine ? (state.active.status === 'pending' ? '보상 대기' : '파견 중') : (state.active ? '잠김' : '');
      return `<button type="button" class="cmd-cell cmd-region${mine ? ' live' : ''}" data-cmd="region" data-region="${region.id}"><div><b>${esc(region.name)}</b>${pips(index + 1, REGIONS.length)}</div>${tag ? `<span class="cmd-tag">${tag}</span>` : ''}</button>`;
    }).join('');
    return `<div class="cmd-back-row"><button type="button" class="fac-back cmd-back" data-cmd="menu">‹ 임무 메뉴</button></div>${panel('함대파견', `<p class="cmd-intro">연방함대 의뢰 : 잔당 소탕</p><div class="cmd-menu">${rows}</div>`)}`;
  }

  function regionView(state) {
    const region = regionById(ui.regionId) || REGIONS[0];
    const back = `<div class="cmd-back-row"><button type="button" class="fac-back cmd-back" data-cmd="dispatch">‹ 의뢰 목록</button></div>`;
    const info = panel(esc(region.name), `<ul class="cmd-facts"><li><span>요구 조건</span><b>${reqText(region)}</b></li><li><span>확정 보상</span><b>${fixedRewardText(region)}</b></li><li><span>확률 보상</span><b>${chanceRewardText(region)}</b></li><li><span>확률 보상</span><b>함선골조 1개 (50%)</b></li></ul>`);

    if (state.active && state.active.regionId === region.id) {
      const mission = state.active;
      if (mission.status === 'pending') {
        const pay = mission.payout;
        return back + info + panel('귀환 보고', `<ul class="cmd-facts"><li><span>토륨</span><b>${pay.thorium}</b></li><li><span>골드</span><b>${pay.gold.toLocaleString('ko-KR')}</b></li><li><span>함선골조</span><b>${pay.frame ? '1개' : '없음'}</b></li></ul><button type="button" class="fac-btn cmd-action" data-cmd="claim">보상 받기</button>`);
      }
      const elapsed = Math.min(DURATION, now() - mission.startedAt);
      const ratio = elapsed / DURATION;
      const preview = `토륨 ${Math.floor(region.thorium * 0.5 * ratio)} · 골드 ${Math.floor(region.gold * 0.5 * ratio).toLocaleString('ko-KR')} (보너스 없음)`;
      return back + info + panel('파견 중인 함대', `<div class="cmd-clock-big" data-cmd-remaining data-ends="${mission.endsAt}">${fmt(mission.endsAt - now())}</div><p class="cmd-preview">회수 시 지급 예상: ${preview}</p><button type="button" class="fac-btn cmd-action danger" data-cmd="recall">함대 회수</button>`);
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
      return `<div class="cmd-slot"><span class="cmd-slot-no">${i + 1}</span><button type="button" class="cmd-pick${picked ? ' filled' : ''}" data-cmd="pick" data-slot="${i}">${label}</button></div>`;
    }).join('');
    const checks = checklist(region, ui.slots);
    const ready = passes(checks);
    const checkList = `<ul class="cmd-check">${checks.map(c => `<li class="${c.ok ? 'ok' : 'ng'}">${c.ok ? '✔' : '✖'} ${esc(c.text)}</li>`).join('')}</ul>`;
    const form = owned.length
      ? `<div class="cmd-slots">${slots}</div>${checkList}<button type="button" class="fac-btn cmd-action" data-cmd="go" ${ready ? '' : 'disabled'}>함대 파견</button>`
      : `<p class="cmd-intro">파견할 함선이 없습니다. 함대관리에서 함선을 먼저 확보하세요.</p>`;
    return back + info + panel('함대 편성', form);
  }

  // 선택 목록: 조건(등급)에 맞는 보유 함선을 그림으로 보여준다. 배틀·아레나에 있는 함선은 어둡게, 선택할 수 없다.
  function pickerHtml(slot, region) {
    const used = inUseKeys();
    const others = ui.slots.filter((key, i) => i !== slot && key);
    const cards = ownedVariants()
      .filter(v => rankOf(v.rarity) >= rankOf(region.minRarity) && (v.stars || 0) >= region.minStars)
      .map(v => {
        const key = keyOf(v);
        const inUse = used.has(key);
        const taken = others.filter(k => k === key).length;
        const blocked = inUse || taken >= v.copies;
        const note = inUse ? '배틀·아레나 편성 중' : taken >= v.copies ? '다른 슬롯에 선택됨' : `보유 ${v.copies}`;
        return `<button type="button" class="cmd-card${inUse || blocked ? ' dim' : ''}" data-cmd="pick-choose" data-key="${esc(key)}" data-inuse="${inUse ? '1' : ''}" ${blocked ? 'disabled' : ''}><div class="cmd-card-img">${v.image ? `<img src="${esc(v.image)}" alt="" />` : ''}</div><b>${esc(v.name)}</b><span>${v.rarity}${v.stars ? ` ★${v.stars}` : ''} · ${esc(v.weapon || '무기 미정')}</span><em>${note}</em></button>`;
      }).join('');
    return `<div class="cmd-sheet" role="dialog" aria-modal="true" aria-label="함선 선택"><header><b>함선 ${slot + 1} 선택</b><button type="button" class="cmd-close" data-cmd="pick-close">닫기</button></header>${cards ? `<div class="cmd-grid">${cards}</div>` : `<p class="cmd-intro">${region.minRarity}급 이상 보유 함선이 없습니다.</p>`}</div>`;
  }

  // 배틀·아레나 편성 중인 함선을 고를 때만 띄우는 y/n 확인
  function inUseConfirmHtml(key) {
    const owned = ownedVariants().find(v => keyOf(v) === key);
    const name = owned ? owned.name : '선택한 함선';
    return `<div class="cmd-sheet cmd-confirm" role="dialog" aria-modal="true" aria-label="편성 중 함선 확인"><p class="cmd-confirm-q">${esc(name)}은(는) 편성 중입니다</p><p class="cmd-confirm-sub">파견하면 배틀·아레나 편성에서 빠집니다. 이 함선을 파견에 넣을까요?</p><div class="cmd-yn"><button type="button" data-cmd="inuse-no">아니오</button><button type="button" data-cmd="inuse-yes">예</button></div></div>`;
  }

  // 선택 목록과 확인 팝업은 화면 밖(body)에 띄운다. 상위 화면의 변형 효과에 가려지지 않도록.
  function renderModal() {
    let root = document.getElementById('cmd-modal-root');
    if (!root) { root = document.createElement('div'); root.id = 'cmd-modal-root'; document.body.appendChild(root); }
    const region = regionById(ui.regionId);
    if (ui.confirmPick && region) {
      root.innerHTML = `<div class="cmd-backdrop">${inUseConfirmHtml(ui.confirmPick.key)}</div>`;
    } else if (ui.picking !== null && region && ui.sub === 'region') {
      root.innerHTML = `<div class="cmd-backdrop" data-cmd="pick-close">${pickerHtml(ui.picking, region)}</div>`;
    } else {
      root.innerHTML = '';
    }
  }

  function screen(heroHtml) {
    const state = settle(read());
    const body = ui.sub === 'region' ? regionView(state) : ui.sub === 'dispatch' ? dispatchView(state) : menuView(state);
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
    if (act === 'menu') { ui.sub = 'menu'; ui.slots = [null, null, null]; }
    else if (act === 'dispatch') { ui.sub = 'dispatch'; }
    else if (act === 'region') { ui.sub = 'region'; ui.regionId = el.dataset.region; ui.slots = [null, null, null]; }
    else if (act === 'pick') { ui.picking = Number(el.dataset.slot); }
    else if (act === 'pick-close') { if (event.target === el || el.classList.contains('cmd-close')) ui.picking = null; }
    else if (act === 'pick-choose') {
      // 편성 중인 함선은 바로 넣지 않고 y/n으로 한 번 더 묻는다
      if (el.dataset.inuse) { ui.confirmPick = { key: el.dataset.key, slot: ui.picking }; }
      else { ui.slots[ui.picking] = el.dataset.key; ui.picking = null; }
    }
    else if (act === 'inuse-no') { ui.confirmPick = null; }
    else if (act === 'inuse-yes') {
      ui.slots[ui.confirmPick.slot] = ui.confirmPick.key;
      ui.picking = null;
      ui.confirmPick = null;
    }
    else if (act === 'go') {
      const result = dispatch(ui.regionId, ui.slots);
      ui.notice = result.message;
      if (result.ok) { ui.sub = 'menu'; ui.slots = [null, null, null]; }
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

  window.UnionCommand = { screen, regions: REGIONS, read, dispatch, recall, claim };
})();
