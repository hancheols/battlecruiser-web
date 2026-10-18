(() => {
  const categories = [
    {
      id: 'total', label: '총전투력', code: 'TOTAL POWER', metric: '전투력', rank: 128, value: 482600,
      leaders: [['NOVA PRIME', 982400], ['청룡 함대', 941200], ['SIRIUS-01', 915800], ['카이론', 876500], ['Admiral K', 842300]]
    },
    {
      id: 'dreadnought', label: '중전함', code: 'DREADNOUGHT', metric: '함급 전투력', rank: 76, value: 98420,
      leaders: [['IRON CROWN', 186700], ['백두산', 178250], ['Vanguard-9', 170880], ['묵룡', 166300], ['ARES FLEET', 160940]]
    },
    {
      id: 'battlecruiser', label: '배틀크루저', code: 'BATTLECRUISER', metric: '함급 전투력', rank: 214, value: 72880,
      leaders: [['Solaris', 194600], ['이클립스', 187500], ['ORBITAL-7', 181420], ['은하수', 176900], ['VEGA ACE', 169300]]
    },
    {
      id: 'destroyer', label: '구축함', code: 'DESTROYER', metric: '함급 전투력', rank: 51, value: 85210,
      leaders: [['RED COMET', 151800], ['충무공', 146700], ['POLARIS', 142460], ['검은 파도', 138900], ['NEMESIS', 134280]]
    },
    {
      id: 'frigate', label: '프리깃', code: 'FRIGATE', metric: '함급 전투력', rank: 342, value: 39450,
      leaders: [['SWIFT-01', 112900], ['해오라기', 108550], ['BLUE SPEAR', 104800], ['라그랑주', 101240], ['MISTRAL', 98900]]
    },
    {
      id: 'alliance', label: '연합', code: 'ALLIANCE', metric: '연합 명성', rank: 18, value: 12680, selfLabel: '우리 연합 · 오리온',
      leaders: [['TERRA UNION', 28450], ['은하 방위군', 27120], ['SOL GUARD', 26380], ['대한 함대', 24960], ['NEBULA CORPS', 23610]]
    },
    {
      id: 'arena', label: '아레나', code: 'ARENA', metric: '시즌 점수', rank: 93, value: 2140,
      leaders: [['PHOTON KING', 4820], ['무적함대', 4650], ['ACE-77', 4515], ['STARBLADE', 4380], ['아틀라스', 4260]]
    }
  ];

  const rewardTiers = [
    { max: 1, label: '1위', tier: '챔피언', gold: 30000, thorium: 120 },
    { max: 10, label: '2–10위', tier: '마스터', gold: 20000, thorium: 80 },
    { max: 100, label: '11–100위', tier: '엘리트', gold: 10000, thorium: 40 },
    { max: 500, label: '101–500위', tier: '베테랑', gold: 5000, thorium: 15 }
  ];

  let activeCategory = 'total';
  let opener = null;
  const claimed = new Set();
  const balances = window.gameResources || (window.gameResources = { gold: 0, thorium: 0 });
  const format = value => Number(value).toLocaleString('ko-KR');
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
      <span class="ladder-player"><b>${name}</b><small>${isSelf ? 'MY RANKING' : 'COMMANDER'}</small></span>
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
          <div><small>SEASON 01 · SOL FRONT</small><h2 id="ladder-title">LADDER</h2></div>
          <div class="ladder-season"><span>종료까지</span><b>06D 18H</b></div>
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

  const renderLadder = () => {
    const modal = document.getElementById('ladder-modal');
    if (!modal) return;
    const category = categories.find(item => item.id === activeCategory) || categories[0];
    const reward = rewardFor(category.rank);
    modal.querySelector('.ladder-tabs').innerHTML = categories.map(item => `<button type="button" role="tab" data-ladder-category="${item.id}" aria-selected="${item.id === category.id}" class="${item.id === category.id ? 'selected' : ''}">${item.label}</button>`).join('');
    modal.querySelector('.ladder-summary').innerHTML = `<div><small>${category.code}</small><b>내 순위 <em>${format(category.rank)}위</em></b></div><div><small>${category.metric}</small><strong>${format(category.value)}</strong></div>`;
    modal.querySelector('.ladder-board').innerHTML = `<div class="ladder-columns"><span>RANK</span><span>PLAYER</span><span>SCORE</span></div>${category.leaders.map(([name, value], index) => rowMarkup(index + 1, name, value, category)).join('')}<div class="ladder-separator"><span>•••</span></div>${rowMarkup(category.rank, category.selfLabel || '나 · 지휘관 리안', category.value, category, true)}`;
    modal.querySelector('.ladder-rewards').innerHTML = `<div class="ladder-reward-head"><div><small>SEASON REWARD</small><b>${reward.tier} 보상</b></div><span>${reward.label}</span></div><div class="ladder-reward-track">${rewardTiers.map(tier => `<div class="${tier === reward ? 'current-tier' : ''}"><b>${tier.label}</b><span><i class="ladder-resource-icon gold"></i>${format(tier.gold)}</span><span><i class="ladder-resource-icon thorium"></i>${tier.thorium}</span></div>`).join('')}</div><button class="ladder-claim" type="button" ${claimed.has(category.id) ? 'disabled' : ''}>${claimed.has(category.id) ? '수령 완료' : '현재 순위 보상 수령'}</button>`;
    const claimButton = modal.querySelector('.ladder-claim');
    if (!claimButton.disabled) claimButton.addEventListener('click', () => {
      claimed.add(category.id);
      balances.gold += reward.gold;
      balances.thorium += reward.thorium;
      updateResourceHud();
      window.notice?.(`${category.label} 보상 획득 · 골드 ${format(reward.gold)} / 토륨 ${reward.thorium}`);
      renderLadder();
    });
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
