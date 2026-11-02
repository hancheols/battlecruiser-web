(() => {
  // 순위표는 서버(online.js → /api/ranking)에서 받는다. 아레나 순위는 아레나 화면에서 보여준다.
  const categories = [
    { id: 'total', label: '총전투력', code: 'TOTAL POWER', metric: '전투력' },
    { id: 'dreadnought', label: '중전함', code: 'DREADNOUGHT', metric: '함급 전투력' },
    { id: 'battlecruiser', label: '배틀크루저', code: 'BATTLECRUISER', metric: '함급 전투력' },
    { id: 'destroyer', label: '구축함', code: 'DESTROYER', metric: '함급 전투력' },
    { id: 'frigate', label: '프리깃', code: 'FRIGATE', metric: '함급 전투력' },
    { id: 'alliance', label: '연합', code: 'ALLIANCE', metric: '연합 전투력' },
    { id: 'arena', label: '아레나', code: 'ARENA', metric: '시즌 점수' }
  ];

  const rewardTiers = [
    { max: 1, label: '1위', tier: '챔피언', gold: 30000, thorium: 120 },
    { max: 10, label: '2–10위', tier: '마스터', gold: 20000, thorium: 80 },
    { max: 100, label: '11–100위', tier: '엘리트', gold: 10000, thorium: 40 },
    { max: 500, label: '101–500위', tier: '베테랑', gold: 5000, thorium: 15 }
  ];

  let activeCategory = 'total';
  let opener = null;
  let renderToken = 0;
  const balances = window.gameResources || (window.gameResources = { gold: 0, thorium: 0 });
  const format = value => Number(value).toLocaleString('ko-KR');
  const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const rewardFor = rank => rewardTiers.find(tier => rank <= tier.max) || { label: '참가', tier: '도전자', gold: 2000, thorium: 5 };

  const updateResourceHud = () => {
    document.querySelectorAll('.fixed-top .resources').forEach(resources => {
      const items = resources.querySelectorAll('.resource');
      if (items[0]) items[0].dataset.value = format(balances.gold);
      if (items[1]) items[1].dataset.value = format(balances.thorium);
    });
    window.dispatchEvent(new Event('game-resources-updated'));
  };
  window.updateGameResourceHud = updateResourceHud;

  const rowMarkup = (rank, name, value, category, isSelf = false) => {
    const podium = rank <= 3 ? ` podium-${rank}` : '';
    return `<div class="ladder-row${podium}${isSelf ? ' is-self' : ''}">
      <span class="ladder-rank">${rank}</span>
      <span class="ladder-player"><b>${esc(name)}</b><small>${isSelf ? 'MY RANKING' : category.id === 'alliance' ? 'UNION' : 'COMMANDER'}</small></span>
      <span class="ladder-score"><b>${format(value)}</b><small>${category.metric}</small></span>
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
          <div><small>PRE-SEASON · SOL FRONT</small><h2 id="ladder-title">LADDER</h2></div>
          <div class="ladder-season"><span>시즌 일정</span><b>준비 중</b></div>
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

  // 보상표는 안내만 한다. 시즌 정산이 생기면 순위 보상을 우편으로 보낸다.
  const rewardsMarkup = rank => {
    const reward = rank ? rewardFor(rank) : null;
    return `<div class="ladder-reward-head"><div><small>SEASON REWARD</small><b>${reward ? `${reward.tier} 보상` : '시즌 보상'}</b></div><span>${reward ? reward.label : '순위 없음'}</span></div><div class="ladder-reward-track">${rewardTiers.map(tier => `<div class="${tier === reward ? 'current-tier' : ''}"><b>${tier.label}</b><span><i class="ladder-resource-icon gold"></i>${format(tier.gold)}</span><span><i class="ladder-resource-icon thorium"></i>${tier.thorium}</span></div>`).join('')}</div><button class="ladder-claim" type="button" disabled>시즌 시작 후 우편으로 지급</button>`;
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
    rewards.innerHTML = rewardsMarkup(null);

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
    summary.innerHTML = `<div><small>${category.code}</small><b>내 순위 <em>${me?.rank ? `${format(me.rank)}위` : '—'}</em></b></div><div><small>${category.metric}</small><strong>${format(me?.value || 0)}</strong></div>`;
    const rows = data.leaders.map((row, index) => rowMarkup(index + 1, me && row.id === me.id ? selfName : row.name, row.value, category, Boolean(me) && row.id === me.id)).join('');
    const selfRow = me?.rank && !inList ? `<div class="ladder-separator"><span>•••</span></div>${rowMarkup(me.rank, selfName, me.value, category, true)}` : '';
    const emptyText = category.id === 'alliance' ? '아직 순위에 오른 연합이 없습니다.' : '아직 순위에 오른 함장이 없습니다.';
    board.innerHTML = rows || selfRow ? `<div class="ladder-columns"><span>RANK</span><span>PLAYER</span><span>SCORE</span></div>${rows}${selfRow}` : message(emptyText);
    rewards.innerHTML = rewardsMarkup(me?.rank || null);
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
