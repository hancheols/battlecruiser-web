// 토륨광산 점령: 연합 광장의 시설. 광산 점령(토벌·도전전·방어 함대)과 토륨 분배 두 메뉴로 나뉜다. 규칙과 수치는 서버(/api/mine)가 정한다.
(() => {
  'use strict';
  const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const num = value => Number(value || 0).toLocaleString('ko-KR');
  const RESEARCH_KEY = 'starfleet-tactical-weapon-research-v1';
  const ROLES = ['선봉', '좌익', '우익', '프리깃'];
  const RARITY_ORDER = { L: 4, SSR: 3, SR: 2, R: 1 };
  const SIZE_ORDER = ['large', 'medium', 'small'];
  const ui = { tab: 'mines', mineId: '', editing: null, picking: -1, targets: null, note: '' };
  let data = null;

  const api = (action, extra = {}) => window.Online.call('/mine', { method: 'POST', body: { action, ...extra } });
  const readResearch = () => { try { return JSON.parse(localStorage.getItem(RESEARCH_KEY)) || {}; } catch { return {}; } };

  // ── 함대 ───────────────────────────────────────────────────────────────────
  const compact = (ship, research) => {
    const variant = { ...ship, enhancementStars: Number(ship.stars ?? ship.enhancementStars) || 0 };
    const stats = window.ArenaCore.stats(variant, window.getArenaShipBaseStats(variant), research);
    return { name: stats.name, type: stats.type, rarity: stats.rarity, enhancementStars: stats.enhancementStars, hp: stats.hp, dps: stats.dps, skillStars: stats.skillStars, factor: stats.factor, dev: stats.dev };
  };
  const ownedShips = () => (window.getOwnedFleetVariants?.() || []).filter(ship => !ship.isFrame).sort((a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0) || (Number(b.stars) || 0) - (Number(a.stars) || 0));
  const sameShip = (a, b) => a && b && a.type === b.type && a.name === b.name;
  // 쟁탈전 계산에 넣는 내 연합 개발 효과. 상대 함대에는 서버가 같은 식으로 얹어 보낸다.
  const withUnionDev = ship => {
    if (!ship) return ship;
    const effect = window.getUnionDevEffects?.(ship) || {};
    return { ...ship, hp: ship.hp * (1 + (effect.hp || 0)), dps: ship.dps * (1 + (effect.damage || 0)) * (1 + (effect.attackSpeed || 0)), unionReduction: effect.reduction || 0, unionEnergy: effect.energy || 0 };
  };
  // 서버에서 받은 능력치에 내 함선 목록의 이미지·설명을 붙인다.
  function rehydrate(deck) {
    const catalog = window.getFleetCatalog?.() || [];
    const ships = (deck || []).map(ship => {
      if (!ship) return null;
      const base = catalog.find(item => sameShip(item, ship));
      return base ? { ...base, ...ship, stars: ship.enhancementStars } : undefined;
    });
    return ships.length === 4 && ships.slice(0, 3).every(Boolean) && ships[3] !== undefined ? ships : null;
  }

  // ── 출격 ───────────────────────────────────────────────────────────────────
  const backToMine = () => { window.battleArenaMatch = null; window.show?.('earth-union'); window.openUnionFacility?.('thorium'); };

  async function startRaid(mine) {
    if (!(window.getFleetAssignments?.() || []).slice(0, 3).some(Boolean)) throw new Error('함대관리에서 주력 함선을 먼저 편성하세요.');
    const res = await api('raid', { mine: mine.id });
    const operation = { chapter: 1, region: 'bounty', regionName: '토륨광산', regionEn: 'THORIUM MINE', gate: 1, bounty: { stage: 1, reward: 0, gold: 0, ...res.pirate, mine: { battleId: res.battleId, name: res.mine.name } } };
    window.battleOperation = operation;
    window.show?.('battle');
    requestAnimationFrame(() => window.prepareBattle?.(operation));
  }
  // 토벌 전투가 끝나면 엔진이 부른다. 결과는 서버가 반영하고, 점령 여부를 돌려준다.
  async function finishBattle(battleId, win, damage = 0, skipped = false) {
    try { return await api('finish', { battleId, win, damage, skipped }); }
    catch (error) { return { error: error.message }; }
  }
  async function startWar(mine, targetId, skip = false) {
    const fleet = rehydrate(data.fleet);
    if (!fleet) throw new Error('방어 함대를 먼저 등록해 주세요.');
    const res = await api('war', { mine: mine.id, target: targetId });
    const enemyDeck = rehydrate(res.enemy.deck);
    if (!enemyDeck) throw new Error('상대 함대 정보를 불러오지 못했습니다.');
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const match = {
      id: res.battleId, mineWar: { battleId: res.battleId, name: res.mine.name },
      enemy: { id: targetId, name: res.enemy.name, score: 0, tier: { label: '광산 쟁탈' } },
      fleet, enemyDeck, result: window.ArenaCore.simulate(fleet.map(withUnionDev), enemyDeck, seed), practice: false, scoreBefore: 0, created: Date.now()
    };
    if (skip) {   // 건너뛰기: 전투 화면 없이 미리 계산한 결과로 끝낸다
      const win = match.result.win === true, done = await finishBattle(res.battleId, win, 0, true);
      if (done.error) throw new Error(done.error);
      ui.note = `${res.enemy.name} 상대 ${win ? '승리' : '패배'} · 쟁탈 점수 +${num(done.points)}`;
      return false;
    }
    window.battleArenaMatch = match;
    window.show?.('battle');
    requestAnimationFrame(() => window.prepareBattle?.({ arenaMatch: match }));
    return true;
  }
  // 쟁탈 전투 결과: 아레나 결과 화면이 쓰는 형식으로 돌려준다.
  async function completeWar(match) {
    const win = match.forfeited ? false : match.result.win === true;
    const res = await finishBattle(match.mineWar.battleId, win);
    return { win, delta: res.points || 0, score: res.points || 0, rank: '—', tier: match.mineWar.name };
  }

  // ── 화면 조각 ───────────────────────────────────────────────────────────────
  const short = value => { const n = Number(value) || 0; return n >= 10000 ? `${Math.round(n / 1000) / 10}만` : num(n); };
  const percentOf = (value, total) => (total ? Math.min(100, Math.max(0, value * 100 / total)) : 0);
  const percentText = percent => (percent > 0 && percent < 1 ? '1 미만' : String(Math.floor(percent)));
  const crystal = '<img class="tm-crystal" src="thorium-crystal-icon.png" alt="토륨"/>';
  const bar = (percent, cls = '') => `<span class="tm-bar ${cls}"><i style="width:${percent}%"></i></span>`;
  const stat = (label, value) => `<div class="tm-stat"><span>${label}</span><b>${value}</b></div>`;
  const chip = (text, cls = '') => `<span class="tm-chip ${cls}">${text}</span>`;
  const rules = (title, text) => `<details class="tm-rules"><summary>${title}</summary><p>${text}</p></details>`;
  // 아레나 편성과 같은 함선 카드. 이미지는 저장값에 없어서 내 함선 목록에서 찾는다.
  const shipArt = ship => ship.image || (window.getFleetCatalog?.() || []).find(item => sameShip(item, ship))?.image || '';
  const shipCard = (ship, index, attrs = '') => `<button type="button" class="arena-ship" ${attrs || 'disabled'}><small>${ROLES[index]}</small>${ship ? `<img src="${esc(shipArt(ship))}" alt="${esc(ship.name)}"/><b>${esc(ship.name)}</b><em>${esc(ship.rarity)} · ${Number(ship.enhancementStars ?? ship.stars) || 0}성</em>` : '<span class="arena-empty">＋</span><b>선택</b>'}</button>`;
  const deckCards = (deck, attrsOf = () => '') => `<div class="arena-deck arena-deck-defense mine-deck"><div class="arena-ships">${ROLES.map((_, index) => shipCard(deck?.[index] || null, index, attrsOf(index))).join('')}</div></div>`;

  function statusOf(mine) {
    if (mine.war) return { cls: 'war', text: mine.war.mySide ? '쟁탈전 참가 중' : '쟁탈전' };
    if (mine.holder?.mine) return { cls: 'mine', text: '우리 점령' };
    if (mine.holder) return { cls: 'held', text: esc(mine.holder.name) };
    return { cls: 'pirate', text: '해적 점거' };
  }
  // 우리 연합이 지금 할 수 있는 일. 목록에서 바로 알아보게 한 줄로 보여 준다.
  function chanceOf(mine) {
    const u = data.union;
    if (!u || mine.holder?.mine || mine.war) return '';
    if (u.level < mine.minLevel) return `<em class="tm-lock">연합 Lv.${mine.minLevel} 필요</em>`;
    if (!mine.canTake) return '<em class="tm-lock">더 큰 광산만 가능</em>';
    if (mine.holder) return mine.applied ? '<em class="tm-go">도전 신청함</em>' : data.phase.war ? '' : '<em class="tm-go">도전 가능</em>';
    return u.inWar ? '' : '<em class="tm-go">토벌 가능</em>';
  }
  const warSplit = war => {
    const holder = percentOf(war.holderScore, war.holderScore + war.challengerScore) || 50;
    return `<span class="tm-split"><i style="width:${holder}%"></i><u style="width:${100 - holder}%"></u></span>`;
  };
  function mineCard(mine) {
    const status = statusOf(mine);
    let body;
    if (mine.war) {
      body = `<span class="tm-line"><span>${esc(mine.war.holder)} <b>${num(mine.war.holderScore)}</b></span><span><b>${num(mine.war.challengerScore)}</b> ${esc(mine.war.challenger)}</span></span>${warSplit(mine.war)}`;
    } else if (mine.holder) {
      body = `<span class="tm-line"><span>${mine.holder.mine ? `수비 보너스 <b>+${Math.round(mine.holder.bonus * 100)}%</b>` : '점령 연합이 있는 광산'}</span><span>도전 신청 <b>${num(mine.applicants)}</b></span></span>`;
    } else {
      const percent = percentOf(mine.myTotal, mine.pirate.hp);
      body = `<span class="tm-line"><span>우리 연합 토벌</span><span><b>${short(mine.myTotal)}</b> / ${short(mine.pirate.hp)}</span></span>${bar(percent)}`;
    }
    return `<button type="button" class="tm-card is-${status.cls} size-${esc(mine.size)}" data-mine-open="${esc(mine.id)}"><span class="tm-card-head"><b>${esc(mine.name)}</b>${chip(status.text, status.cls)}</span>${body}<span class="tm-card-foot"><span class="tm-yield">${crystal}주 <b>${num(mine.production)}</b></span>${chanceOf(mine)}<i aria-hidden="true">›</i></span></button>`;
  }

  function fleetBlock(panel) {
    const locked = data.phase.war, ships = Boolean(data.fleet);
    const count = data.union ? `<span>연합 등록 <b>${num(data.union.fleets)}</b>명 · 도전과 수비 보너스에 ${num(data.rules.minFleets)}명 이상 필요</span>` : '<span>연합에 가입하면 쓸 수 있습니다.</span>';
    return panel('광산 방어 함대 <small>GUARD FLEET</small>', `${deckCards(data.fleet)}<div class="tm-fleet-foot">${count}<button type="button" class="fac-btn small" data-mine-fleet ${locked ? 'disabled' : ''}>${locked ? '쟁탈 기간 잠김' : ships ? '함대 변경' : '함대 등록'}</button></div>`);
  }

  function weekPanel(panel) {
    const war = data.phase.war, u = data.union, left = data.sorties.max - data.sorties.used;
    const steps = [['신청', '수~토', !war], ['쟁탈전', '일~화', war], ['정산', '수 0시', false]].map(([name, when, on]) => `<li class="${on ? 'on' : ''}"><b>${name}</b><small>${when}</small></li>`).join('');
    const pips = Array.from({ length: data.sorties.max }, (_, index) => `<i class="${index < left ? 'on' : ''}"></i>`).join('');
    const stats = u ? `<div class="tm-stats">${stat('우리 점령', esc(u.heldMine) || '없음')}${stat('주간 생산', `${crystal}${num(u.production)}`)}${stat('오늘 출격', `<span class="tm-pips">${pips}</span>${left}/${data.sorties.max}`)}</div>` : '<p class="union-hint">연합에 가입하면 토벌과 도전전에 참여할 수 있습니다.</p>';
    return panel(`이번 주 전황 <small>${war ? `정산까지 ${data.phase.daysLeft}일` : `쟁탈전까지 ${data.phase.daysLeft}일`}</small>`, `<ol class="tm-steps">${steps}</ol>${stats}`);
  }

  function minesTab(panel) {
    const groups = SIZE_ORDER.map(size => {
      const list = data.mines.filter(mine => mine.size === size);
      if (!list.length) return '';
      return `<section class="tm-group size-${size}"><h4><b>${esc(list[0].sizeLabel)} 광산</b><small>연합 Lv.${num(list[0].minLevel)}부터</small></h4><div class="tm-list">${list.map(mineCard).join('')}</div></section>`;
    }).join('');
    return `${weekPanel(panel)}${fleetBlock(panel)}${groups}`;
  }

  function detailHead(mine) {
    const status = statusOf(mine);
    const owner = mine.war ? esc(mine.war.holder) : mine.holder ? esc(mine.holder.name) : esc(mine.pirate.name);
    return `<section class="tm-head is-${status.cls} size-${esc(mine.size)}"><div class="tm-card-head"><h3>${esc(mine.name)}</h3>${chip(status.text, status.cls)}</div><div class="tm-stats">${stat('규모', esc(mine.sizeLabel))}${stat('주간 생산', `${crystal}${num(mine.production)}`)}${stat(mine.holder || mine.war ? '점령 연합' : '점거 세력', owner)}</div></section>`;
  }

  function warDetail(panel, mine, left) {
    const war = mine.war;
    const side = (key, label, name, score) => `<div class="tm-side ${key}${war.mySide === key ? ' me' : ''}"><small>${label}${war.mySide === key ? ' · 우리' : ''}</small><b>${esc(name)}</b><strong>${num(score)}</strong></div>`;
    const board = panel('쟁탈전 점수 <small>WAR</small>', `<div class="tm-versus">${side('holder', '점령 연합', war.holder, war.holderScore)}<span>VS</span>${side('challenger', '도전 연합', war.challenger, war.challengerScore)}</div>${warSplit(war)}<p class="tm-note">점수는 상위 20명 합계입니다.${war.holderBonus ? ` 점령 연합 수비 보너스 +${Math.round(war.holderBonus * 100)}% 포함.` : ''} 동점이면 점령 연합이 지킵니다.</p>`);
    if (!war.mySide) return board;
    const catalog = window.getFleetCatalog?.() || [];
    const rows = (ui.targets || []).map(target => {
      const art = target.ships.map(ship => `<img src="${esc(catalog.find(item => item.name === ship.name)?.image || '')}" alt="${esc(ship.name)} ${esc(ship.rarity)} ${ship.stars}성" title="${esc(ship.name)}"/>`).join('');
      const done = target.attacked || left <= 0;
      return `<li class="tm-target${target.attacked ? ' done' : ''}"><div class="tm-target-main"><b>${esc(target.name)}</b><span class="tm-target-art">${art}</span></div><div class="mine-target-actions"><button type="button" class="fac-btn small" data-mine-attack="${esc(target.id)}" ${done ? 'disabled' : ''}>${target.attacked ? '공격함' : '공격'}</button>${done ? '' : `<button type="button" class="tm-sub-btn" data-mine-attack-skip="${esc(target.id)}">건너뛰기</button>`}</div></li>`;
    }).join('');
    return `${board}${panel(`상대 함장 <small>남은 출격 ${left}회</small>`, rows ? `<ul class="tm-targets">${rows}</ul>` : '<p class="union-hint">공격할 수 있는 방어 함대가 없습니다.</p>')}`;
  }

  function holdDetail(panel, mine) {
    const u = data.union;
    if (mine.holder.mine) {
      return panel('점령 현황 <small>HOLD</small>', `<div class="tm-stats">${stat('수비 보너스', `+${Math.round(mine.holder.bonus * 100)}%`)}${stat('도전 신청', `${num(mine.applicants)}개 연합`)}${stat('등록 함대', `${num(u.fleets)}명`)}</div><p class="tm-note">일요일 0시에 도전 상대가 정해집니다. 방어 함대가 ${num(data.rules.minFleets)}명 미만이면 수비 보너스를 받지 못합니다.</p>`);
    }
    const note = text => `<p class="tm-note">${text}</p>`;
    let action;
    if (!u) action = note('연합에 가입해야 도전할 수 있습니다.');
    else if (mine.applied) action = note('도전 신청을 마쳤습니다. 일요일 0시에 대진이 정해집니다.');
    else if (!mine.canTake) action = note(`점령 중에는 더 큰 광산에만 도전할 수 있습니다. 우리 연합 점령: ${esc(u.heldMine)}`);
    else if (u.appliedMine) action = note(`도전 신청은 한 주에 한 광산만 할 수 있습니다. 이번 주 신청: ${esc(u.appliedMine)}`);
    else if (data.phase.war) action = note('다음 주 수요일부터 도전 신청을 받습니다.');
    else if (!u.canChallenge) action = note('도전 신청은 연합장과 부연합장이 합니다.');
    else {
      const ready = u.fleets >= data.rules.minFleets;
      action = `<div class="tm-stats">${stat('등록 함대', `${num(u.fleets)} / ${num(data.rules.minFleets)}명`)}${stat('도전 신청', `${num(mine.applicants)}개 연합`)}</div>${u.heldMine ? `<p class="tm-warn">이기면 ${esc(u.heldMine)}은 해적에게 돌아갑니다.</p>` : ''}<button type="button" class="fac-btn tm-cta" data-mine-challenge="${esc(mine.id)}" ${ready ? '' : 'disabled'}>${ready ? '도전 신청' : `방어 함대 ${num(data.rules.minFleets)}명 필요`}</button>${rules('규칙 보기', '신청 연합이 여럿이면 연합 점수가 가장 비슷한 연합이 뽑힙니다. 쟁탈전은 일~화요일이고 수요일 0시에 정산합니다.')}`;
    }
    return panel('도전 신청 <small>CHALLENGE</small>', action);
  }

  function raidDetail(panel, mine, left) {
    const total = mine.pirate.hp, percent = percentOf(mine.myTotal, total), u = data.union;
    const reason = !u ? '연합 필요' : u.level < mine.minLevel ? `연합 Lv.${mine.minLevel} 필요` : !mine.canTake ? '더 큰 광산만 가능' : u.inWar ? '쟁탈전 진행 중' : left <= 0 ? '오늘 출격 완료' : '';
    const canSweep = !reason && mine.myBest > 0;
    const main = panel('우주해적 토벌 <small>RAID</small>', `<div class="tm-gauge"><strong>${percentText(percent)}<small>%</small></strong><div><span>우리 연합 합계 피해</span><b>${num(mine.myTotal)} <small>/ ${num(total)}</small></b></div></div>${bar(percent, 'big')}<div class="tm-stats">${stat('제한 시간', `${num(mine.pirate.limit)}초`)}${stat('남은 출격', `${num(left)}회`)}${stat('내 최고', num(mine.myBest))}</div>${bar(percentOf(mine.myBest, mine.recordCap), 'thin')}<p class="tm-note">내 기록은 ${num(mine.recordCap)}까지 합계에 반영됩니다.</p>${u?.heldMine && mine.canTake ? `<p class="tm-warn">점령하면 ${esc(u.heldMine)}은 해적에게 돌아갑니다.</p>` : ''}<div class="tm-actions"><button type="button" class="fac-btn tm-cta" data-mine-raid="${esc(mine.id)}" ${reason ? 'disabled' : ''}>${reason || '토벌 출격'}</button>${canSweep ? `<button type="button" class="tm-sub-btn" data-mine-sweep="${esc(mine.id)}">건너뛰기</button>` : ''}</div>${rules('규칙 보기', `연합원 각자의 최고 피해를 모두 더해 해적 체력에 이르면 점령합니다. 1인 기록은 해적 체력의 ${num(data.rules.recordCapPercent)}%까지 반영하고, 다시 출격하면 더 높은 기록만 남습니다. 건너뛰기는 출격 1회를 쓰고 CREDIT만 받으며 기록은 그대로입니다.`)}`);
    const race = mine.racers.length ? panel('연합 경쟁 <small>RACE</small>', `<ol class="tm-rank">${mine.racers.map((racer, index) => `<li class="${racer.mine ? 'me' : ''}"><span class="tm-rank-no">${index + 1}</span><div><span class="tm-line"><span>${esc(racer.name)}${racer.mine ? ' · 우리' : ''}</span><b>${percentText(percentOf(racer.total, total))}%</b></span>${bar(percentOf(racer.total, total))}</div></li>`).join('')}</ol>`) : '';
    const records = mine.records.length ? panel('우리 연합 최고 기록 <small>상위 5명</small>', `<ol class="tm-rank">${mine.records.map((row, index) => `<li class="${row.me ? 'me' : ''}"><span class="tm-rank-no">${index + 1}</span><div><span class="tm-line"><span>${esc(row.name)}</span><b>${num(row.best)}</b></span>${bar(percentOf(row.best, mine.recordCap))}</div></li>`).join('')}</ol>`) : '';
    return `${main}${race}${records}`;
  }

  function mineDetail(panel, mine) {
    const left = data.sorties.max - data.sorties.used;
    const body = mine.war ? warDetail(panel, mine, left) : mine.holder ? holdDetail(panel, mine) : raidDetail(panel, mine, left);
    return `${detailHead(mine)}${body}`;
  }

  function fleetEditor(panel) {
    const slots = ui.editing;
    if (ui.picking >= 0) {
      const slot = ui.picking;
      const ships = ownedShips().filter(ship => slot === 3 ? ship.type === 'frigate' : ship.type !== 'frigate');
      const best = new Map();
      ships.forEach(ship => { const key = `${ship.type}|${ship.name}`; if (!best.has(key)) best.set(key, ship); });
      const rows = [...best.values()].map((ship, index) => { const used = slots.some((item, i) => i !== slot && sameShip(item, ship)); return `<button type="button" class="mine-pick" data-mine-pick="${index}" ${used ? 'disabled' : ''}><img src="${esc(shipArt(ship))}" alt=""/><b>${esc(ship.name)}</b><small>${esc(ship.rarity)} · ${Number(ship.stars) || 0}성${used ? ' · 편성됨' : ''}</small></button>`; }).join('');
      ui.pickList = [...best.values()];
      return panel(`${ROLES[slot]} 선택`, `<div class="mine-picks">${rows || '<p class="union-hint">고를 수 있는 함선이 없습니다.</p>'}</div>${slot === 3 ? '<button type="button" class="tm-sub-btn" data-mine-pick-clear>프리깃 없음</button>' : ''}`);
    }
    return panel('광산 방어 함대 편성', `${deckCards(slots, index => `data-mine-slot="${index}"`)}<p class="tm-note">능력치는 저장할 때 기록됩니다. 함선을 키운 뒤 다시 저장하면 갱신됩니다. 아레나 편성이나 파견과 겹쳐도 됩니다.</p><div class="tm-actions"><button type="button" class="fac-btn tm-cta" data-mine-save>저장</button><button type="button" class="tm-sub-btn" data-mine-import>함대관리 편성 불러오기</button></div>`);
  }

  function shareTab(panel) {
    const u = data.union;
    if (!u) return panel('토륨 분배', '<p class="union-hint">연합에 가입하면 이용할 수 있습니다.</p>');
    const owned = data.mines.filter(mine => mine.holder?.mine);
    const me = u.shares.find(row => row.me);
    const blocked = !me?.linked ? '구글 연동 필요' : me.waiting ? '다음 주부터 받음' : '';
    const percent = u.totalPoints && !blocked ? u.myPoints * 100 / u.totalPoints : 0;
    const planned = u.shares.reduce((sum, row) => sum + row.expected, 0);
    const settledOn = week => { const date = new Date((week + 7) * 86400000); return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`; };
    const mineShare = `<section class="tm-share-hero"><span>이번 주 내 예상 분배</span><strong>${crystal}${num(me?.expected)}</strong>${blocked ? chip(blocked, 'war') : `<small>이번 주 CREDIT <b>${num(u.myPoints)}</b> · 연합 내 <b>${Math.round(percent)}%</b></small>`}${bar(percentOf(me?.expected || 0, data.rules.payoutCap))}<small>1인 상한 ${num(data.rules.payoutCap)} · 수요일 0시 우편 지급</small></section>`;
    const flow = panel('이번 주 분배 흐름 <small>FLOW</small>', `<div class="tm-flow"><div><span>저장고</span><b>${num(u.treasury)}</b></div><i>+</i><div><span>${owned.length ? esc(owned[0].name) : '광산 생산'}</span><b>${num(u.production)}</b></div><i>=</i><div class="sum"><span>분배 총량</span><b>${num(u.pool)}</b></div></div><div class="tm-stats two">${stat('지급 예정', num(planned))}${stat('저장고에 남음', num(Math.max(0, u.pool - planned)))}</div>${owned.length ? '' : '<p class="tm-note">토륨은 광산을 점령해야 생산됩니다. 아직 점령한 광산이 없습니다.</p>'}${rules('규칙 보기', `이번 주에 얻은 CREDIT 비율대로 나눕니다. 연합 개발에 CREDIT을 써도 몫은 줄지 않습니다. 1인 상한을 넘거나 나누고 남은 몫은 저장고에 남습니다. 구글 연동 계정만 받으며, 정산 24시간 전 뒤에 가입했으면 다음 주부터 받습니다.`)}`);
    const members = panel('연합원 분배 예상 <small>CREDIT · 토륨</small>', `<ol class="tm-members">${u.shares.map(row => `<li class="${row.me ? 'me' : ''}${row.expected ? '' : ' off'}"><div class="tm-line"><span>${esc(row.name)}${!row.linked ? chip('구글 연동 필요', 'war') : row.waiting ? chip('다음 주부터', 'held') : ''}</span><b>${crystal}${num(row.expected)}</b></div><div class="tm-member-sub"><small>CREDIT ${num(row.points)}</small>${bar(percentOf(row.expected, data.rules.payoutCap), 'thin')}</div></li>`).join('')}</ol>`);
    const history = panel('받은 기록 <small>HISTORY</small>', u.history.length ? `<ul class="tm-history">${u.history.map(item => `<li><span>${settledOn(item.week)}</span><small>CREDIT ${num(item.points)} · ${item.total ? Math.round(item.points * 100 / item.total) : 0}%</small><b>${crystal}+${num(item.amount)}</b></li>`).join('')}</ul>` : '<p class="union-hint">아직 받은 토륨이 없습니다.</p>');
    return `${mineShare}${flow}${members}${history}`;
  }

  // ── 화면 ───────────────────────────────────────────────────────────────────
  // 스크롤해도 남는 상단 메뉴. 뒤로가기는 지금 보는 화면에 맞춰 바뀐다.
  function topBar(tabs, mine) {
    const back = ui.tab === 'share' ? ['data-view="hub"', '연합 광장']
      : ui.editing ? (ui.picking >= 0 ? ['data-mine-pick-back', '함대 편성'] : ['data-mine-edit-cancel', '돌아가기'])
        : mine ? ['data-mine-back', '광산 목록'] : ['data-view="hub"', '연합 광장'];
    const top = Math.round(document.querySelector('#persistent-hud .fixed-top')?.getBoundingClientRect().bottom || 96);
    return `<header class="tm-top" style="top:${top}px"><div class="tm-top-row"><button type="button" class="tm-back" ${back[0]}>‹ ${back[1]}</button><div class="tm-top-title"><small>THORIUM MINES</small><b>토륨광산 점령</b></div></div><nav class="tm-tabs" role="tablist">${tabs}</nav></header>`;
  }
  async function html({ heroHtml, panel }) {
    const mode = await window.Online?.mode?.();
    if (mode !== 'server') return `${heroHtml('thorium', '토륨광산 점령')}${panel('토륨광산 점령', `<p class="union-hint">${mode === 'down' ? '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' : '정식 연합 서비스가 시작되면 이용할 수 있습니다.'}</p>`)}`;
    data = await window.Online.call('/mine');
    const tabs = [['mines', '광산 점령'], ['share', '토륨 분배']].map(([id, label]) => `<button type="button" role="tab" aria-selected="${ui.tab === id}" data-mine-tab="${id}">${label}</button>`).join('');
    const link = data.linked ? '' : panel('구글 계정 연동 필요', '<p class="union-hint">토륨광산은 구글 계정을 연동한 함장만 참여할 수 있습니다. (설정 > 계정연동)</p>');
    const note = ui.note ? `<p class="mine-note" role="status">${esc(ui.note)}</p>` : '';
    ui.note = '';
    const mine = ui.tab === 'mines' && !ui.editing ? data.mines.find(item => item.id === ui.mineId) : null;
    let body;
    if (ui.tab === 'share') body = shareTab(panel);
    else if (ui.editing) body = fleetEditor(panel);
    else {
      if (mine?.war?.mySide) { try { ui.targets = (await api('targets', { mine: mine.id })).targets; } catch { ui.targets = []; } }
      body = mine ? mineDetail(panel, mine) : minesTab(panel);
    }
    return `${topBar(tabs, mine)}${link}${note}${body}`;
  }

  function bind(host, render) {
    const on = (selector, handler) => host.querySelectorAll(selector).forEach(el => el.addEventListener('click', handler));
    const keep = () => window.rememberUnionScroll?.();
    const act = fn => async event => { const el = event.currentTarget; el.disabled = true; try { await fn(el); } catch (error) { ui.note = error.message || '처리하지 못했습니다.'; } render(); };
    on('[data-mine-tab]', e => { ui.tab = e.currentTarget.dataset.mineTab; ui.mineId = ''; ui.editing = null; ui.picking = -1; render(); });
    on('[data-mine-open]', e => { ui.mineId = e.currentTarget.dataset.mineOpen; ui.targets = null; render(); });
    on('[data-mine-back]', () => { ui.mineId = ''; render(); });
    // 연합 광장으로 나가면 다음에는 광산 목록부터 보인다. 화면 전환은 union.js 가 맡는다.
    on('[data-view]', () => { ui.mineId = ''; ui.editing = null; ui.picking = -1; });
    on('[data-mine-fleet]', () => {
      const catalog = ownedShips();
      ui.editing = (data.fleet || [null, null, null, null]).map(ship => ship ? catalog.find(item => sameShip(item, ship)) || null : null);
      ui.picking = -1; render();
    });
    on('[data-mine-edit-cancel]', () => { ui.editing = null; render(); });
    on('[data-mine-slot]', e => { keep(); ui.picking = Number(e.currentTarget.dataset.mineSlot); render(); });
    on('[data-mine-pick-back]', () => { ui.picking = -1; render(); });
    on('[data-mine-pick-clear]', () => { ui.editing[ui.picking] = null; ui.picking = -1; render(); });
    on('[data-mine-pick]', e => { ui.editing[ui.picking] = ui.pickList[Number(e.currentTarget.dataset.minePick)]; ui.picking = -1; render(); });
    on('[data-mine-import]', () => {
      const catalog = ownedShips();
      ui.editing = Array.from({ length: 4 }, (_, index) => { const ship = window.getFleetAssignments?.()[index]; return ship ? catalog.find(item => sameShip(item, ship)) || null : null; });
      render();
    });
    on('[data-mine-save]', act(async () => {
      const deck = ui.editing;
      if (deck.slice(0, 3).some(ship => !ship)) throw new Error('선봉·좌익·우익을 모두 편성해 주세요.');
      const research = readResearch();
      await api('fleet', { deck: deck.map(ship => ship ? compact(ship, research) : null) });
      ui.editing = null; ui.note = '방어 함대를 저장했습니다.';
    }));
    on('[data-mine-sweep]', act(async el => { await api('sweep', { mine: el.dataset.mineSweep }); ui.note = '건너뛰기 완료: 출격 1회를 쓰고 CREDIT을 받았습니다. 기록은 그대로입니다.'; }));
    on('[data-mine-attack-skip]', act(async el => { await startWar(data.mines.find(item => item.id === ui.mineId), el.dataset.mineAttackSkip, true); ui.targets = null; }));
    on('[data-mine-challenge]', act(async el => { await api('challenge', { mine: el.dataset.mineChallenge }); ui.note = '도전을 신청했습니다.'; }));
    on('[data-mine-raid]', async e => {
      const el = e.currentTarget, mine = data.mines.find(item => item.id === el.dataset.mineRaid);
      el.disabled = true;
      try { await startRaid(mine); } catch (error) { ui.note = error.message; render(); }
    });
    on('[data-mine-attack]', async e => {
      const el = e.currentTarget, mine = data.mines.find(item => item.id === ui.mineId);
      el.disabled = true;
      try { await startWar(mine, el.dataset.mineAttack); } catch (error) { ui.note = error.message; render(); }
    });
  }

  window.UnionMine = { html, bind, finishBattle, completeWar, back: backToMine };
})();
