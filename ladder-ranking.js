(() => {
  // 순위표는 서버(online.js → /api/ranking)에서 받는다. 아레나 순위는 아레나 화면에서 보여준다.
  const categories = [
    { id: 'total', label: '종합', code: 'TOP FLEET', metric: '함종별 최고 함선 3척' },
    { id: 'dreadnought', label: '중전함', code: 'DREADNOUGHT', metric: '최고 함선' },
    { id: 'battlecruiser', label: '배틀크루저', code: 'BATTLECRUISER', metric: '최고 함선' },
    { id: 'destroyer', label: '구축함', code: 'DESTROYER', metric: '최고 함선' },
    { id: 'alliance', label: '연합', code: 'ALLIANCE', metric: '연합 점수' },
    { id: 'arena', label: '아레나', code: 'ARENA', metric: '시즌 점수' }
  ];

  let activeCategory = 'total';
  let opener = null;
  let renderToken = 0;
  const balances = window.gameResources || (window.gameResources = { gold: 0, thorium: 0 });
  const format = value => Number(value).toLocaleString('ko-KR');
  const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const updateResourceHud = () => {
    document.querySelectorAll('.fixed-top .resources').forEach(resources => {
      const items = resources.querySelectorAll('.resource');
      if (items[0]) items[0].dataset.value = format(balances.gold);
      if (items[1]) items[1].dataset.value = format(balances.thorium);
    });
    window.dispatchEvent(new Event('game-resources-updated'));
  };
  window.updateGameResourceHud = updateResourceHud;

  // 순위 기록을 글로 바꾼다. 함종: 함선 이름·희귀도·성급, 종합: 세 척 요약, 연합: 활동 연합원 수.
  const starText = stars => '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));
  const shipLine = entry => `${entry.ship} · ${entry.rarity} ${starText(entry.stars)}`;
  const entryLine = (entry, category) => {
    if (category.id === 'alliance') return `활동 연합원 ${format(entry.active)}명`;
    if (category.id === 'total') return entry.ships.map(ship => `${ship.ship} ${ship.rarity}★${ship.stars}`).join(' · ');
    return shipLine(entry);
  };
  const entryScore = (entry, category) => category.id === 'alliance'
    ? `<b>${format(entry.value)}</b><small>연합 점수</small>`
    : `<b>Lv.${format(entry.dev)}</b><small>${category.id === 'total' ? '개발 합계' : '무기 개발'}</small>`;

  const rowMarkup = (rank, name, entry, category, isSelf = false) => {
    const podium = rank <= 3 ? ` podium-${rank}` : '';
    return `<div class="ladder-row${podium}${isSelf ? ' is-self' : ''}">
      <span class="ladder-rank">${rank}</span>
      <span class="ladder-player"><b>${esc(name)}</b><small>${esc(entryLine(entry, category))}</small></span>
      <span class="ladder-score">${entryScore(entry, category)}</span>
    </div>`;
  };

  const createModal = () => {
    if (document.getElementById('ladder-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'ladder-modal';
    modal.className = 'ladder-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="ladder-backdrop"></div>
      <article class="ladder-panel" role="dialog" aria-modal="true" aria-labelledby="ladder-title">
        <header class="ladder-header">
          <div><small data-ladder-season>SOL FRONT</small><h2 id="ladder-title">LADDER</h2></div>
          <div class="ladder-season"><span data-ladder-season-label>시즌</span><b data-ladder-season-days>—</b></div>
          <button class="ladder-close" type="button" aria-label="Ladder 닫기">×</button>
        </header>
        <div class="ladder-tabs" role="tablist" aria-label="랭킹 분야"></div>
        <section class="ladder-summary" aria-live="polite"></section>
        <section class="ladder-board" aria-label="순위표"></section>
        <section class="ladder-rewards" aria-label="순위 보상"></section>
      </article>`;
    document.body.append(modal);
    modal.querySelector('.ladder-backdrop').addEventListener('click', closeLadder);
    modal.querySelector('.ladder-close').addEventListener('click', closeLadder);
    modal.querySelector('.ladder-tabs').addEventListener('click', event => {
      const tab = event.target.closest('[data-ladder-category]');
      if (!tab) return;
      if(tab.dataset.ladderCategory==='arena'){closeLadder();window.openArena?.();return;}
      activeCategory = tab.dataset.ladderCategory;
      renderLadder();
    });
    modal.querySelector('.ladder-tabs').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const index = categories.findIndex(category => category.id === activeCategory);
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      activeCategory = categories[(index + direction + categories.length) % categories.length].id;
      if(activeCategory==='arena'){closeLadder();window.openArena?.();return;}
      renderLadder();
      modal.querySelector(`[data-ladder-category="${activeCategory}"]`)?.focus();
    });
  };

  const message = text => `<p class="ladder-message">${esc(text)}</p>`;

  // 시즌 보상표: 서버가 정한 표를 그대로 보여 준다. 보상은 시즌이 끝나면 우편으로 온다.
  const rewardsMarkup = (rank, tiers = []) => {
    if (!tiers.length) return '';
    const reward = rank ? tiers.find(tier => rank <= tier.max) : null;
    return `<div class="ladder-reward-head"><div><small>SEASON REWARD</small><b>시즌 보상</b></div><span>${reward ? reward.label : '보상 순위 밖'}</span></div><div class="ladder-reward-track">${tiers.map(tier => `<div class="${tier === reward ? 'current-tier' : ''}"><b>${tier.label}</b>${tier.gold ? `<span><i class="ladder-resource-icon gold"></i>${format(tier.gold)}</span>` : ''}<span><i class="ladder-resource-icon thorium"></i>${format(tier.thorium)}</span></div>`).join('')}</div><button class="ladder-claim" type="button" disabled>시즌 종료 후 우편으로 지급</button>`;
  };

  const renderLadder = async () => {
    const modal = document.getElementById('ladder-modal');
    if (!modal) return;
    const token = ++renderToken;
    const category = categories.find(item => item.id === activeCategory) || categories[0];
    const summary = modal.querySelector('.ladder-summary'), board = modal.querySelector('.ladder-board'), rewards = modal.querySelector('.ladder-rewards');
    modal.querySelector('.ladder-tabs').innerHTML = categories.map(item => `<button type="button" role="tab" data-ladder-category="${item.id}" aria-selected="${item.id === category.id}" class="${item.id === category.id ? 'selected' : ''}">${item.label}</button>`).join('');
    summary.innerHTML = `<div><small>${category.code}</small><b>내 순위 <em>—</em></b></div><div><small>${category.metric}</small><strong>—</strong></div>`;
    board.innerHTML = message('순위표를 불러오는 중입니다.');
    rewards.innerHTML = '';

    let data = null, failure = '';
    try {
      const mode = await window.Online?.mode?.();
      if (mode === 'server') { await window.Online.report(); data = await window.Online.ranking(category.id); }
      else failure = mode === 'down' ? '랭킹 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' : '랭킹 서비스를 준비하고 있습니다.';
    } catch (error) { failure = error.message || '순위표를 불러오지 못했습니다.'; }
    if (token !== renderToken || modal.hidden) return;
    if (!data) { board.innerHTML = message(failure); return; }

    const me = data.me;
    const selfName = category.id === 'alliance' ? `우리 연합 · ${me?.name || ''}` : `나 · ${me?.name || ''}`;
    const inList = me && data.leaders.some(row => row.id === me.id);
    const myValue = !me?.entry ? '—' : category.id === 'alliance' ? format(me.entry.value) : category.id === 'total' ? `개발 Lv.${format(me.entry.dev)}` : `${me.entry.ship} ${me.entry.rarity}★${me.entry.stars} · Lv.${format(me.entry.dev)}`;
    summary.innerHTML = `<div><small>${category.code}</small><b>내 순위 <em>${me?.rank ? `${format(me.rank)}위` : '—'}</em>${me?.percent ? ` · 상위 ${me.percent}%` : ''}</b></div><div><small>${category.metric}</small><strong>${esc(myValue)}</strong></div>`;
    const rows = data.leaders.map((row, index) => rowMarkup(index + 1, me && row.id === me.id ? selfName : row.name, row.entry, category, Boolean(me) && row.id === me.id)).join('');
    const selfRow = me?.rank && !inList ? `<div class="ladder-separator"><span>•••</span></div>${rowMarkup(me.rank, selfName, me.entry, category, true)}` : '';
    const emptyText = category.id === 'alliance' ? '아직 순위에 오른 연합이 없습니다.' : '아직 순위에 오른 함장이 없습니다.';
    board.innerHTML = rows || selfRow ? `<div class="ladder-columns"><span>RANK</span><span>PLAYER</span><span>SCORE</span></div>${rows}${selfRow}` : message(emptyText);
    rewards.innerHTML = rewardsMarkup(me?.rank || null, data.rewards);
    const season = data.season;
    modal.querySelector('[data-ladder-season]').textContent = `SEASON ${String(season.number).padStart(2, '0')} · SOL FRONT`;
    modal.querySelector('[data-ladder-season-label]').textContent = season.started ? '종료까지' : '시작까지';
    modal.querySelector('[data-ladder-season-days]').textContent = `${season.daysLeft}일`;
  };

  function closeLadder() {
    const modal = document.getElementById('ladder-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('ladder-open');
    opener?.focus();
  }

  window.openLadder = (category = 'total') => {
    if(category==='arena'){window.openArena?.();return;}
    activeCategory = categories.some(item => item.id === category) ? category : 'total';
    createModal();
    opener = document.activeElement;
    const modal = document.getElementById('ladder-modal');
    modal.hidden = false;
    document.body.classList.add('ladder-open');
    renderLadder();
    modal.querySelector('.ladder-close')?.focus();
  };

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeLadder();
  });
  window.addEventListener('DOMContentLoaded', updateResourceHud);
})();
