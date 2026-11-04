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
  async function finishBattle(battleId, win) {
    try { return await api('finish', { battleId, win }); }
    catch (error) { return { error: error.message }; }
  }
  async function startWar(mine, targetId) {
    const fleet = rehydrate(data.fleet);
    if (!fleet) throw new Error('방어 함대를 먼저 등록해 주세요.');
    const res = await api('war', { mine: mine.id, target: targetId });
    const enemyDeck = rehydrate(res.enemy.deck);
    if (!enemyDeck) throw new Error('상대 함대 정보를 불러오지 못했습니다.');
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const match = {
      id: res.battleId, mineWar: { battleId: res.battleId, name: res.mine.name },
      enemy: { id: targetId, name: res.enemy.name, score: 0, tier: { label: '광산 쟁탈' } },
      fleet, enemyDeck, result: window.ArenaCore.simulate(fleet, enemyDeck, seed), practice: false, scoreBefore: 0, created: Date.now()
    };
    window.battleArenaMatch = match;
    window.show?.('battle');
    requestAnimationFrame(() => window.prepareBattle?.({ arenaMatch: match }));
  }
  // 쟁탈 전투 결과: 아레나 결과 화면이 쓰는 형식으로 돌려준다.
  async function completeWar(match) {
    const win = match.forfeited ? false : match.result.win === true;
    const res = await finishBattle(match.mineWar.battleId, win);
    return { win, delta: res.points || 0, score: res.points || 0, rank: '—', tier: match.mineWar.name };
  }

  // ── 화면 조각 ───────────────────────────────────────────────────────────────
  const phaseText = phase => phase.war ? `쟁탈전 진행 중 · 수요일 0시 정산까지 ${phase.daysLeft}일` : `도전 신청·방어 함대 등록 기간 · 쟁탈전까지 ${phase.daysLeft}일`;
  const shipLine = ship => `${esc(ship.name)} <small>${esc(ship.rarity)} ★${Number(ship.enhancementStars ?? ship.stars) || 0}</small>`;
  const progress = (percent, label = '') => `<div class="mine-bar"><i style="width:${Math.min(100, Math.max(0, percent))}%"></i>${label ? `<span>${label}</span>` : ''}</div>`;

  function statusOf(mine) {
    if (mine.war) return { cls: 'war', text: mine.war.mySide ? '쟁탈전 참가 중' : '쟁탈전 중' };
    if (mine.holder?.mine) return { cls: 'mine', text: '우리 연합 점령' };
    if (mine.holder) return { cls: 'held', text: esc(mine.holder.name) };
    return { cls: 'pirate', text: '우주해적 점거' };
  }
  function mineCard(mine) {
    const status = statusOf(mine);
    const sub = mine.war
      ? `${esc(mine.war.holder)} ${num(mine.war.holderScore)} : ${num(mine.war.challengerScore)} ${esc(mine.war.challenger)}`
      : mine.holder ? `주간 토륨 ${num(mine.production)}${mine.applied ? ' · 도전 신청함' : ''}`
        : `토벌 ${num(mine.myWins)} / ${num(mine.needWins)}승 · 주간 토륨 ${num(mine.production)}`;
    return `<button type="button" class="mine-card mine-${status.cls}" data-mine-open="${esc(mine.id)}"><span class="mine-size ${esc(mine.size)}">${esc(mine.sizeLabel)}</span><span class="mine-main"><b>${esc(mine.name)}</b><small>${sub}</small></span><em>${status.text} ›</em></button>`;
  }

  function fleetBlock(panel) {
    const locked = data.phase.war;
    const ships = data.fleet ? data.fleet.filter(Boolean).map(ship => `<li>${shipLine(ship)}</li>`).join('') : '';
    const count = data.union ? `<p class="union-hint">연합 등록 ${num(data.union.fleets)}명 · 도전 신청과 수비 보너스에 ${num(data.rules.minFleets)}명 이상 필요</p>` : '';
    return panel('광산 방어 함대 <small>GUARD FLEET</small>', `${ships ? `<ul class="mine-ships">${ships}</ul>` : '<p class="union-hint">아직 등록하지 않았습니다. 아레나와 따로 등록합니다.</p>'}${count}<button type="button" class="fac-btn small" data-mine-fleet ${locked ? 'disabled' : ''}>${locked ? '쟁탈 기간에는 변경 불가' : ships ? '함대 변경' : '함대 등록'}</button>`);
  }

  function minesTab(panel) {
    const groups = SIZE_ORDER.map(size => {
      const list = data.mines.filter(mine => mine.size === size);
      return panel(`${esc(list[0]?.sizeLabel || '')} 광산 <small>${size.toUpperCase()}</small>`, `<div class="mine-list">${list.map(mineCard).join('')}</div>`);
    }).join('');
    const held = data.union?.holdings;
    const summary = data.union ? `<div class="fac-claim"><div><span>우리 연합 점령</span><b>대형 ${held.large} · 중형 ${held.medium} · 소형 ${held.small}</b></div><div><span>이번 주 생산</span><b>${num(data.union.production)}<small> 토륨</small></b></div></div>` : '<p class="union-hint">연합에 가입하면 토벌과 도전전에 참여할 수 있습니다.</p>';
    return `${panel('이번 주 전황 <small>STATUS</small>', `<p class="mine-phase ${data.phase.war ? 'war' : ''}">${phaseText(data.phase)}</p>${summary}<p class="union-hint">오늘 남은 출격 ${num(data.sorties.max - data.sorties.used)} / ${num(data.sorties.max)}회</p>`)}${fleetBlock(panel)}${groups}`;
  }

  function mineDetail(panel, mine) {
    const back = '<div class="mine-back-row"><button type="button" class="fac-back" data-mine-back>‹ 광산 목록</button></div>';
    const left = data.sorties.max - data.sorties.used;
    const head = panel(`${esc(mine.name)} <small>${esc(mine.sizeLabel)}</small>`, `<div class="fac-claim"><div><span>주간 토륨 생산</span><b>${num(mine.production)}</b></div><div><span>현재 상태</span><b>${statusOf(mine).text}</b></div></div>`);
    if (mine.war) {
      const total = Math.max(1, mine.war.holderScore + mine.war.challengerScore);
      const board = panel('쟁탈전 <small>WAR</small>', `<div class="mine-versus"><div><small>점령 연합</small><b>${esc(mine.war.holder)}</b><strong>${num(mine.war.holderScore)}</strong></div><div><small>도전 연합</small><b>${esc(mine.war.challenger)}</b><strong>${num(mine.war.challengerScore)}</strong></div></div>${progress(mine.war.holderScore * 100 / total)}${mine.war.holderBonus ? `<p class="union-hint">점령 연합 수비 보너스 +${Math.round(mine.war.holderBonus * 100)}% 포함 · 점수는 상위 20명 합계</p>` : '<p class="union-hint">점수는 상위 20명 합계입니다.</p>'}`);
      if (!mine.war.mySide) return `${back}${head}${board}`;
      const targets = ui.targets || [];
      const rows = targets.map(target => `<li class="mine-target"><div><b>${esc(target.name)}</b><small>${target.ships.map(ship => `${esc(ship.name)} ${esc(ship.rarity)}★${ship.stars}`).join(' · ')}</small></div><button type="button" class="fac-btn small" data-mine-attack="${esc(target.id)}" ${target.attacked || left <= 0 ? 'disabled' : ''}>${target.attacked ? '오늘 공격함' : '공격'}</button></li>`).join('');
      return `${back}${head}${board}${panel(`상대 함장 <small>남은 출격 ${left}회</small>`, rows ? `<ul class="mine-targets">${rows}</ul>` : '<p class="union-hint">공격할 수 있는 방어 함대가 없습니다.</p>')}`;
    }
    if (mine.holder) {
      const u = data.union;
      if (mine.holder.mine) {
        return `${back}${head}${panel('점령 현황 <small>HOLD</small>', `<p class="union-hint">수비 보너스 +${Math.round(mine.holder.bonus * 100)}% · 이번 주 도전 신청 ${num(mine.applicants)}개 연합. 일요일 0시에 도전 상대가 정해지고, 방어 함대가 ${num(data.rules.minFleets)}명 미만이면 보너스를 받지 못합니다.</p>`)}`;
      }
      const action = !u ? '<p class="union-hint">연합에 가입해야 도전할 수 있습니다.</p>'
        : mine.applied ? '<p class="union-hint">도전 신청을 마쳤습니다. 일요일 0시에 대진이 정해집니다.</p>'
          : data.phase.war ? '<p class="union-hint">다음 주 수요일부터 도전 신청을 받습니다.</p>'
            : !u.canChallenge ? '<p class="union-hint">도전 신청은 연합장과 부연합장이 합니다.</p>'
              : `<p class="union-hint">연합 등록 방어 함대 ${num(u.fleets)} / ${num(data.rules.minFleets)}명. 신청 연합이 여럿이면 연합 점수가 가장 비슷한 연합이 뽑힙니다.</p><button type="button" class="fac-btn" data-mine-challenge="${esc(mine.id)}" ${u.fleets < data.rules.minFleets ? 'disabled' : ''}>도전 신청</button>`;
      return `${back}${head}${panel(`점령 연합 · ${esc(mine.holder.name)} <small>CHALLENGE</small>`, action)}`;
    }
    const racers = mine.racers.length ? `<ul class="fac-stats">${mine.racers.map(racer => `<li><span>${esc(racer.name)}${racer.mine ? ' (우리)' : ''}</span><b>${num(racer.wins)}승</b></li>`).join('')}</ul>` : '';
    const reason = !data.union ? '연합 필요' : data.union.level < mine.minLevel ? `연합 Lv.${mine.minLevel} 필요` : data.union.holdings[mine.size] >= (mine.size === 'small' ? 2 : 1) ? '점령 상한' : left <= 0 ? '오늘 출격 완료' : '';
    return `${back}${head}${panel(`우주해적 토벌 <small>RAID</small>`, `<div class="fac-claim"><div><span>상대</span><b>${esc(mine.pirate.name)}</b></div><div><span>제한 시간</span><b>${num(mine.pirate.limit)}초</b></div></div>${progress(mine.myWins * 100 / mine.needWins, `우리 연합 ${num(mine.myWins)} / ${num(mine.needWins)}승`)}${racers}<p class="union-hint">연합원의 승리를 모아 가장 먼저 채운 연합이 점령합니다. 승리만 집계하며, 오늘 남은 출격은 ${num(left)}회입니다.</p><button type="button" class="fac-btn" data-mine-raid="${esc(mine.id)}" ${reason ? 'disabled' : ''}>${reason || '토벌 출격'}</button>`)}`;
  }

  function fleetEditor(panel) {
    const slots = ui.editing;
    if (ui.picking >= 0) {
      const slot = ui.picking;
      const ships = ownedShips().filter(ship => slot === 3 ? ship.type === 'frigate' : ship.type !== 'frigate');
      const best = new Map();
      ships.forEach(ship => { const key = `${ship.type}|${ship.name}`; if (!best.has(key)) best.set(key, ship); });
      const rows = [...best.values()].map((ship, index) => { const used = slots.some((item, i) => i !== slot && sameShip(item, ship)); return `<button type="button" class="mine-pick" data-mine-pick="${index}" ${used ? 'disabled' : ''}><b>${esc(ship.name)}</b><small>${esc(ship.rarity)} ★${Number(ship.stars) || 0}${used ? ' · 편성됨' : ''}</small></button>`; }).join('');
      ui.pickList = [...best.values()];
      return `<div class="mine-back-row"><button type="button" class="fac-back" data-mine-pick-back>‹ 함대 편성</button></div>${panel(`${ROLES[slot]} 선택`, `<div class="mine-picks">${rows || '<p class="union-hint">고를 수 있는 함선이 없습니다.</p>'}</div>${slot === 3 ? '<button type="button" class="fac-btn small" data-mine-pick-clear>프리깃 없음</button>' : ''}`)}`;
    }
    const rows = slots.map((ship, index) => `<button type="button" class="mine-slot" data-mine-slot="${index}"><small>${ROLES[index]}</small><b>${ship ? esc(ship.name) : '선택'}</b>${ship ? `<small>${esc(ship.rarity)} ★${Number(ship.stars) || 0}</small>` : ''}</button>`).join('');
    return `<div class="mine-back-row"><button type="button" class="fac-back" data-mine-edit-cancel>‹ 돌아가기</button></div>${panel('광산 방어 함대 편성', `<div class="mine-slots">${rows}</div><p class="union-hint">능력치는 저장할 때 기록됩니다. 함선을 키운 뒤 다시 저장하면 갱신됩니다. 아레나 편성이나 파견과 겹쳐도 됩니다.</p><div class="union-actions"><button type="button" class="fac-btn small" data-mine-import>함대관리 편성 불러오기</button><button type="button" class="fac-btn" data-mine-save>저장</button></div>`)}`;
  }

  function shareTab(panel) {
    const u = data.union;
    if (!u) return panel('토륨 분배', '<p class="union-hint">연합에 가입하면 이용할 수 있습니다.</p>');
    const owned = data.mines.filter(mine => mine.holder?.mine);
    const percent = u.totalPoints ? Math.round(u.myPoints * 100 / u.totalPoints) : 0;
    const me = u.shares.find(row => row.me);
    const list = u.shares.map(row => `<li class="${row.me ? 'me' : ''}"><span>${esc(row.name)}${row.linked ? '' : ' <small>구글 연동 필요</small>'}</span><b>${num(row.points)}</b><em>${num(row.expected)}</em></li>`).join('');
    const history = u.history.length ? `<ul class="fac-log">${u.history.map(item => `<li><span>${item.total ? Math.round(item.points * 100 / item.total) : 0}%</span><b>기여 ${num(item.points)}</b><em>+${num(item.amount)}</em></li>`).join('')}</ul>` : '<p class="union-empty">아직 받은 토륨이 없습니다.</p>';
    return `${panel('연합 토륨 저장고 <small>RESERVOIR</small>', `<div class="fac-claim"><div><span>저장고</span><b>${num(u.treasury)}</b></div><div><span>이번 주 생산 예정</span><b>+${num(u.production)}</b></div></div>${owned.length ? `<ul class="fac-stats">${owned.map(mine => `<li><span>${esc(mine.name)}</span><b>+${num(mine.production)}</b></li>`).join('')}</ul>` : '<p class="union-hint">토륨은 광산을 점령해야 생산됩니다. 아직 점령한 광산이 없습니다.</p>'}`)}${panel('이번 주 나의 몫 <small>MY SHARE</small>', `<div class="fac-claim"><div><span>이번 주 기여도</span><b>${num(u.myPoints)}</b></div><div><span>예상 분배</span><b>${num(me?.expected)}<small> 토륨</small></b></div></div>${progress(percent, `연합 내 ${percent}%`)}<p class="union-hint">수요일 0시에 기여 비율대로 우편으로 지급합니다. 1인 상한은 주 ${num(data.rules.payoutCap)} 토륨이고, 남은 몫은 저장고에 남습니다. 구글 연동 계정만 받으며, 정산 전 24시간 안에 가입했으면 다음 주부터 받습니다.</p>`)}${panel('연합원 분배 예상 <small>이번 주 기여 · 토륨</small>', `<ul class="mine-shares">${list}</ul>`)}${panel('받은 기록 <small>HISTORY</small>', history)}`;
  }

  // ── 화면 ───────────────────────────────────────────────────────────────────
  async function html({ heroHtml, panel }) {
    const hero = heroHtml('thorium', '토륨광산 점령');
    const mode = await window.Online?.mode?.();
    if (mode !== 'server') return `${hero}${panel('토륨광산 점령', `<p class="union-hint">${mode === 'down' ? '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' : '정식 연합 서비스가 시작되면 이용할 수 있습니다.'}</p>`)}`;
    data = await window.Online.call('/mine');
    const tabs = [['mines', '광산 점령'], ['share', '토륨 분배']].map(([id, label]) => `<button type="button" role="tab" aria-selected="${ui.tab === id}" data-mine-tab="${id}">${label}</button>`).join('');
    const link = data.linked ? '' : panel('구글 계정 연동 필요', '<p class="union-hint">토륨광산은 구글 계정을 연동한 함장만 참여할 수 있습니다. (설정 > 계정연동)</p>');
    const note = ui.note ? `<p class="mine-note" role="status">${esc(ui.note)}</p>` : '';
    ui.note = '';
    let body;
    if (ui.tab === 'share') body = shareTab(panel);
    else if (ui.editing) body = fleetEditor(panel);
    else {
      const mine = data.mines.find(item => item.id === ui.mineId);
      if (mine?.war?.mySide) { try { ui.targets = (await api('targets', { mine: mine.id })).targets; } catch { ui.targets = []; } }
      body = mine ? mineDetail(panel, mine) : minesTab(panel);
    }
    return `${hero}<nav class="union-tabs fac-tabs" role="tablist">${tabs}</nav>${link}${note}${body}`;
  }

  function bind(host, render) {
    const on = (selector, handler) => host.querySelectorAll(selector).forEach(el => el.addEventListener('click', handler));
    const keep = () => window.rememberUnionScroll?.();
    const act = fn => async event => { const el = event.currentTarget; el.disabled = true; try { await fn(el); } catch (error) { ui.note = error.message || '처리하지 못했습니다.'; } render(); };
    on('[data-mine-tab]', e => { ui.tab = e.currentTarget.dataset.mineTab; ui.mineId = ''; ui.editing = null; ui.picking = -1; render(); });
    on('[data-mine-open]', e => { ui.mineId = e.currentTarget.dataset.mineOpen; ui.targets = null; render(); });
    on('[data-mine-back]', () => { ui.mineId = ''; render(); });
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
