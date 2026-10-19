(() => {
  // 미션 한 개는 tiers 배열을 가진다. 일일·주간 명령은 단계가 하나이고, 업적은 단계별로 차례대로 달성한다.
  // reward: { gold, thorium, items: [{ itemId, amount }] } — items는 탐색 보급품(탐색드론 등).
  const categories = [
    {
      id: 'daily', label: 'DAILY', code: 'DAILY OPERATIONS', reset: '갱신 13H 42M',
      missions: [
        { id: 'research', icon: '⌬', title: '첫 연구', detail: '연구실에서 연구 1회 완료', tiers: [{ goal: 1, reward: { gold: 500, thorium: 20 } }] },
        { id: 'patrol', icon: '◎', title: '전선 순찰', detail: '전선 전투 3회 완료', tiers: [{ goal: 3, reward: { gold: 800, thorium: 30 } }] },
        { id: 'sweep', icon: '✦', title: '함대 소탕', detail: '적 함선 50기 격파', tiers: [{ goal: 50, reward: { gold: 1000, thorium: 40 } }] },
        { id: 'resource', icon: '▰', title: '자원 확보', detail: '골드 2,000 획득', tiers: [{ goal: 2000, reward: { gold: 600, thorium: 30 } }] },
        { id: 'scan', icon: '◇', title: '함선 탐색', detail: '함선 탐색 1회 완료', tiers: [{ goal: 1, reward: { gold: 900, thorium: 40 } }] },
        { id: 'sortie', icon: '➤', title: '신속 출격', detail: '프리깃 함선 1회 출격', tiers: [{ goal: 1, reward: { gold: 700, thorium: 30 } }] },
        { id: 'arena-join', icon: '♜', title: '아레나 참여', detail: '아레나 전투 1회 참여', tiers: [{ goal: 1, reward: { gold: 1200, thorium: 50 } }] }
      ],
      milestones: [
        { goal: 2, gold: 1000, thorium: 50 },
        { goal: 4, gold: 2000, thorium: 100 },
        { goal: 7, items: [{ itemId: 'scoutTron', amount: 10 }] }
      ]
    },
    {
      id: 'weekly', label: 'WEEKLY', code: 'WEEKLY DIRECTIVES', reset: '갱신 4D 13H',
      missions: [
        { id: 'front-20', icon: '◎', title: '전선 장악', detail: '전선 전투 20회 완료', tiers: [{ goal: 20, reward: { gold: 5000, thorium: 80 } }] },
        { id: 'destroy-500', icon: '✦', title: '대규모 소탕', detail: '적 함선 10000기 격파', tiers: [{ goal: 10000, reward: { gold: 10000, thorium: 200 } }] },
        { id: 'research-50', icon: '⌬', title: '집중 연구', detail: '연구 총 50회 완료', tiers: [{ goal: 50, reward: { gold: 6400, thorium: 100 } }] },
        { id: 'scan-50', icon: '◇', title: '함대 재정비', detail: '함선 탐색 50회 완료', tiers: [{ goal: 50, reward: { gold: 9000, thorium: 140 } }] },
        { id: 'boss-5', icon: '◆', title: '지휘함 격파', detail: '보스 함대 5회 격파', tiers: [{ goal: 5, reward: { gold: 10000, thorium: 160 } }] },
        { id: 'arena-5', icon: '♜', title: '아레나 도전', detail: '아레나 전투 5회 완료', tiers: [{ goal: 5, reward: { gold: 7000, thorium: 120 } }] },
        { id: 'alliance-5', icon: '⬡', title: '연합 기여', detail: '연합 임무 5회 완료', tiers: [{ goal: 5, reward: { gold: 6000, thorium: 100 } }] },
        { id: 'thorium-100', icon: '♦', title: '토륨 비축', detail: '토륨 100 획득', tiers: [{ goal: 100, reward: { gold: 8400, thorium: 180 } }] },
        { id: 'fleet-8', icon: '▦', title: '다함급 전술', detail: '서로 다른 함선 8종 출격', tiers: [{ goal: 8, reward: { gold: 7600, thorium: 120 } }] },
        { id: 'login-5', icon: '◷', title: '주간 출석', detail: '5일 접속 완료', tiers: [{ goal: 5, reward: { gold: 5600, thorium: 100 } }] }
      ],
      milestones: [
        { goal: 3, gold: 30000, thorium: 200 },
        { goal: 6, gold: 50000, thorium: 300 },
        { goal: 10, gold: 90000, thorium: 900 }
      ]
    },
    {
      id: 'achievement', label: 'ACHIEVEMENT', code: 'SERVICE RECORD', reset: '누적 기록',
      missions: [
        { id: 'first-sortie', icon: '➤', title: '첫 출항', detail: '전투 1회 완료', tiers: [{ goal: 1, reward: { gold: 1000, thorium: 5 } }] },
        { id: 'veteran', icon: '★', title: '백전노장', detail: '전투 {goal}회 완료', tiers: [
          { goal: 100, reward: { gold: 10000, thorium: 30 } },
          { goal: 200, reward: { gold: 20000, thorium: 60 } },
          { goal: 500, reward: { gold: 40000, thorium: 120 } }
        ] },
        { id: 'collector', icon: '▦', title: '함선 수집가', detail: '서로 다른 함선 {goal}종 획득', tiers: [
          { goal: 20, reward: { gold: 8000, thorium: 25 } },
          { goal: 40, reward: { gold: 16000, thorium: 50 } }
        ] },
        { id: 'legend', icon: '♛', title: '전설의 기함', detail: 'L급 함선 1척 획득', tiers: [{ goal: 1, reward: { gold: 12000, thorium: 40 } }] },
        { id: 'max-level', icon: '▲', title: '극한 강화', detail: '함선 레벨 {goal} 달성', tiers: [
          { goal: 30, reward: { gold: 8000, thorium: 25 } },
          { goal: 50, reward: { gold: 15000, thorium: 45 } }
        ] },
        { id: 'weapons', icon: '⌖', title: '무장 전문가', detail: '무기 {goal}종 획득', tiers: [
          { goal: 50, reward: { gold: 10000, thorium: 30 } },
          { goal: 100, reward: { gold: 20000, thorium: 60 } }
        ] },
        { id: 'alliance', icon: '⬡', title: '연합의 일원', detail: '지구연합에 가입', tiers: [{ goal: 1, reward: { gold: 2500, thorium: 10 } }] },
        { id: 'arena', icon: '♜', title: '아레나 도전자', detail: '아레나 전투 {goal}회 참가', tiers: [
          { goal: 100, reward: { gold: 12000, thorium: 35 } },
          { goal: 200, reward: { gold: 24000, thorium: 70 } },
          { goal: 500, reward: { gold: 50000, thorium: 150 } }
        ] },
        { id: 'explorer', icon: '◉', title: '은하 개척자', detail: '작전 구역 {goal}개 해방', tiers: [
          { goal: 10, reward: { gold: 16000, thorium: 50 } },
          { goal: 20, reward: { gold: 32000, thorium: 100 } }
        ] },
        { id: 'wealth', icon: '▰', title: '은하의 자산가', detail: '골드 누적 {goal} 획득', tiers: [
          { goal: 1000000, reward: { gold: 25000, thorium: 75 } },
          { goal: 10000000, reward: { gold: 60000, thorium: 180 } }
        ] }
      ],
      milestones: []
    }
  ];

  const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ'];
  let activeCategory = 'daily';
  let opener = null;
  // 진행도와 수령 기록은 저장한다. 일일 명령은 매일 0시, 주간 명령은 매주 수요일 0시에 초기화한다.
  const STORAGE_KEY = "starfleet-missions-v2";
  const dayKey = (date = new Date()) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const weekKey = (date = new Date()) => {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    start.setDate(start.getDate() - ((start.getDay() - 3 + 7) % 7));
    return dayKey(start);
  };
  const loadStore = () => {
    try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); return saved && typeof saved === "object" ? saved : {}; } catch { return {}; }
  };
  let store = loadStore();
  const saveStore = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch {} };
  const ensurePeriod = category => {
    const period = category.id === "weekly" ? weekKey() : dayKey();
    const saved = store[category.id];
    if (!saved || saved.period !== period) {
      store[category.id] = { period, progress: {}, claimed: [], milestones: [], days: [] };
      saveStore();
    }
    return store[category.id];
  };
  const progressOf = (category, mission) => Number(ensurePeriod(category).progress[mission.id]) || 0;
  const format = value => Number(value).toLocaleString('ko-KR');
  const categoryFor = id => categories.find(category => category.id === id) || categories[0];
  const claimKey = (categoryId, mission, index) => `${categoryId}:${mission.id}:${index}`;
  // 지금까지 받은 단계 수 = 다음에 받을 단계의 번호
  const claimedCount = (category, mission) => {
    let count = 0;
    const claimed = ensurePeriod(category).claimed;
    while (claimed.includes(claimKey(category.id, mission, count))) count += 1;
    return count;
  };
  const currentTier = (category, mission) => mission.tiers[claimedCount(category, mission)] || null;
  const isComplete = (category, mission) => {
    const tier = currentTier(category, mission);
    return !!tier && progressOf(category, mission) >= tier.goal;
  };
  // 마일스톤 집계용: 한 번이라도 달성했으면 달성으로 센다(단계를 받아도 집계가 줄지 않도록)
  const achieved = (category, mission) => claimedCount(category, mission) > 0 || isComplete(category, mission);
  const tierLabel = (mission, index) => (mission.tiers.length > 1 ? ` ${ROMAN[index] || index + 1}` : '');
  const detailFor = (mission, tier) => (mission.detail || '').replace('{goal}', format(tier.goal));

  const rewardMarkup = reward => {
    const items = (reward.items || []).map(item => `<span><img class="mission-item-icon" src="icons/scout-drone.png" alt=""/>탐색드론 ${format(item.amount)}</span>`).join('');
    return `${reward.gold ? `<span><i class="mission-resource-icon gold" aria-hidden="true"></i>${format(reward.gold)}</span>` : ""}${reward.thorium ? `<span><i class="mission-resource-icon thorium" aria-hidden="true"></i>${reward.thorium}</span>` : ''}${items}`;
  };

  const grantReward = reward => {
    const balances = window.gameResources || (window.gameResources = { gold: 0, thorium: 0 });
    balances.gold += reward.gold || 0;
    balances.thorium += reward.thorium || 0;
    (reward.items || []).forEach(item => window.grantExplorationLoot?.(item.itemId, item.amount));
    if (window.updateGameResourceHud) {
      window.updateGameResourceHud();
      return;
    }
    document.querySelectorAll('.fixed-top .resources').forEach(resources => {
      const items = resources.querySelectorAll('.resource');
      if (items[0]) items[0].dataset.value = format(balances.gold);
      if (items[1]) items[1].dataset.value = format(balances.thorium);
    });
  };

  // 수령할 보상(미션 또는 마일스톤)이 있으면 미션 버튼에 붉은 '!'를 띄운다.
  const claimableCount = () => {
    let count = 0;
    categories.forEach(category => {
      category.missions.forEach(mission => { if (isComplete(category, mission)) count += 1; });
      const completed = category.missions.filter(mission => achieved(category, mission)).length;
      category.milestones.forEach(milestone => {
        if (completed >= milestone.goal && !ensurePeriod(category).milestones.includes(`${category.id}:milestone:${milestone.goal}`)) count += 1;
      });
    });
    return count;
  };
  const syncMissionAlert = () => {
    const button = document.querySelector('.mission-button');
    if (!button) return;
    let alert = button.querySelector('.mission-alert');
    if (claimableCount() > 0) {
      if (!alert) {
        alert = document.createElement('span');
        alert.className = 'mission-alert';
        alert.setAttribute('aria-label', '달성한 미션 있음');
        alert.textContent = '!';
        button.append(alert);
      }
    } else {
      alert?.remove();
    }
  };
  const syncDeckProgress = () => {
    const daily = categoryFor('daily');
    const completed = daily.missions.filter(mission => achieved(daily, mission)).length;
    const counter = document.querySelector('.mission-button em');
    if (counter) counter.textContent = `${completed} / ${daily.missions.length}`;
    syncMissionAlert();
  };

  const missionMarkup = (mission, category) => {
    const tier = currentTier(category, mission);
    const count = claimedCount(category, mission);
    const tierIndex = Math.max(0, count - (tier ? 0 : 1));
    const title = `${mission.title}${tierLabel(mission, tierIndex)}`;
    const shown = tier || mission.tiers[mission.tiers.length - 1];
    const complete = !!tier && progressOf(category, mission) >= tier.goal;
    const done = !tier;
    const percent = done ? 100 : Math.min(100, Math.round((progressOf(category, mission) / shown.goal) * 100));
    const buttonLabel = done ? '완료' : complete ? '보상 수령' : '진행 중';
    return `<article class="mission-item${complete ? ' is-complete' : ''}${done ? ' is-claimed' : ''}">
      <span class="mission-symbol" aria-hidden="true">${mission.icon}</span>
      <div class="mission-info">
        <header><div><b>${title}</b><small>${detailFor(mission, shown)}</small></div><strong>${done ? format(shown.goal) : format(Math.min(progressOf(category, mission), shown.goal))} / ${format(shown.goal)}</strong></header>
        <div class="mission-progress" aria-label="진행률 ${percent}%"><i style="width:${percent}%"></i></div>
        <div class="mission-reward"><small>COMPLETION REWARD</small>${rewardMarkup(shown.reward)}</div>
      </div>
      <button class="mission-claim" type="button" data-mission-claim="${mission.id}" ${complete ? '' : 'disabled'}>${buttonLabel}</button>
    </article>`;
  };

  const milestoneMarkup = (milestone, index, category, completed) => {
    const key = `${category.id}:milestone:${milestone.goal}`;
    const available = completed >= milestone.goal;
    const claimed = ensurePeriod(category).milestones.includes(key);
    const state = claimed ? 'is-claimed' : available ? 'is-ready' : '';
    const label = claimed ? '완료' : available ? '수령' : `${completed}/${milestone.goal}`;
    return `<article class="mission-milestone ${state}">
      <span class="mission-milestone-number">0${index + 1}</span>
      <div><small>MILESTONE</small><b>${milestone.goal}개 달성</b><p>${rewardMarkup(milestone)}</p></div>
      <button type="button" data-milestone-claim="${milestone.goal}" ${available && !claimed ? '' : 'disabled'}>${label}</button>
    </article>`;
  };

  const createModal = () => {
    if (document.getElementById('mission-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'mission-modal';
    modal.className = 'mission-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="mission-backdrop"></div>
      <article class="mission-panel" role="dialog" aria-modal="true" aria-labelledby="mission-title">
        <header class="mission-header">
          <div class="mission-header-mark" aria-hidden="true">M</div>
          <div><small>ORION FLEET COMMAND</small><h2 id="mission-title">MISSION CONTROL</h2></div>
          <div class="mission-reset"><span>작전 기록</span><b>03 / 07</b></div>
          <button class="mission-close" type="button" aria-label="Mission 닫기">×</button>
        </header>
        <div class="mission-tabs" role="tablist" aria-label="미션 분류"></div>
        <section class="mission-document">
          <header class="mission-document-head"></header>
          <section class="mission-milestones" aria-label="마일스톤 보상"></section>
          <section class="mission-list" aria-label="미션 목록"></section>
        </section>
      </article>`;
    document.body.append(modal);
    modal.querySelector('.mission-backdrop').addEventListener('click', closeMissionBoard);
    modal.querySelector('.mission-close').addEventListener('click', closeMissionBoard);
    modal.querySelector('.mission-tabs').addEventListener('click', event => {
      const tab = event.target.closest('[data-mission-category]');
      if (!tab) return;
      activeCategory = tab.dataset.missionCategory;
      renderMissionBoard();
    });
    modal.querySelector('.mission-tabs').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const index = categories.findIndex(category => category.id === activeCategory);
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      activeCategory = categories[(index + direction + categories.length) % categories.length].id;
      renderMissionBoard();
      modal.querySelector(`[data-mission-category="${activeCategory}"]`)?.focus();
    });
    modal.querySelector('.mission-document').addEventListener('click', event => {
      const category = categoryFor(activeCategory);
      // 모두 받기는 현재 탭의 보상만 받는다.
      if (event.target.closest('[data-mission-claim-all]')) {
        claimAllIn(category);
        return;
      }
      const missionButton = event.target.closest('[data-mission-claim]');
      if (missionButton) {
        const mission = category.missions.find(item => item.id === missionButton.dataset.missionClaim);
        if (!mission || !isComplete(category, mission)) return;
        const index = claimedCount(category, mission);
        const reward = mission.tiers[index].reward;
        ensurePeriod(category).claimed.push(claimKey(category.id, mission, index));
        saveStore();
        grantReward(reward);
        window.notice?.(`${mission.title}${tierLabel(mission, index)} 보상 획득 · 골드 ${format(reward.gold)} / 토륨 ${reward.thorium || 0}`);
        renderMissionBoard();
        return;
      }
      const milestoneButton = event.target.closest('[data-milestone-claim]');
      if (!milestoneButton) return;
      const goal = Number(milestoneButton.dataset.milestoneClaim);
      const milestone = category.milestones.find(item => item.goal === goal);
      const completed = category.missions.filter(mission => achieved(category, mission)).length;
      const key = `${category.id}:milestone:${goal}`;
      if (!milestone || completed < goal || ensurePeriod(category).milestones.includes(key)) return;
      ensurePeriod(category).milestones.push(key);
      saveStore();
      grantReward(milestone);
      window.notice?.(`${category.label} 마일스톤 보상 획득 · ${milestone.gold ? `골드 ${format(milestone.gold)}` : ""}${milestone.thorium ? ` / 토륨 ${milestone.thorium}` : ''}${milestone.items ? ' / 탐색드론 10' : ''}`);
      renderMissionBoard();
    });
  };

  // 현재 탭(일일·주간·업적)에서 받을 수 있는 보상 개수 (미션 단계 + 마일스톤)
  const claimableIn = category => {
    let count = category.missions.filter(mission => isComplete(category, mission)).length;
    const completed = category.missions.filter(mission => achieved(category, mission)).length;
    category.milestones.forEach(milestone => {
      if (completed >= milestone.goal && !ensurePeriod(category).milestones.includes(`${category.id}:milestone:${milestone.goal}`)) count += 1;
    });
    return count;
  };

  // "모두 받기": 이 탭의 완료된 미션 보상과 마일스톤 보상을 한 번에 받는다.
  const claimAllIn = category => {
    const store = ensurePeriod(category);
    const grants = [];
    category.missions.forEach(mission => {
      while (isComplete(category, mission)) {
        const index = claimedCount(category, mission);
        grants.push(mission.tiers[index].reward);
        store.claimed.push(claimKey(category.id, mission, index));
      }
    });
    const completed = category.missions.filter(mission => achieved(category, mission)).length;
    category.milestones.forEach(milestone => {
      const key = `${category.id}:milestone:${milestone.goal}`;
      if (completed >= milestone.goal && !store.milestones.includes(key)) {
        store.milestones.push(key);
        grants.push(milestone);
      }
    });
    if (!grants.length) return 0;
    saveStore();
    grants.forEach(reward => grantReward(reward));
    const gold = grants.reduce((sum, reward) => sum + (Number(reward.gold) || 0), 0);
    const thorium = grants.reduce((sum, reward) => sum + (Number(reward.thorium) || 0), 0);
    window.notice?.(`${category.label} 보상 ${grants.length}건 획득 · 골드 ${format(gold)} / 토륨 ${thorium}`);
    renderMissionBoard();
    return grants.length;
  };

  const renderMissionBoard = () => {
    const modal = document.getElementById('mission-modal');
    if (!modal) return;
    const category = categoryFor(activeCategory);
    const completed = category.missions.filter(mission => achieved(category, mission)).length;
    modal.querySelector('.mission-tabs').innerHTML = categories.map(item => `<button type="button" role="tab" data-mission-category="${item.id}" aria-selected="${item.id === category.id}" class="${item.id === category.id ? 'selected' : ''}"><span>${item.label}</span><small>${item.missions.filter(mission => achieved(item, mission)).length}/${item.missions.length}</small></button>`).join('');
    modal.querySelector('.mission-document-head').innerHTML = `<div><small>${category.code}</small><b>${category.label === 'ACHIEVEMENT' ? '업적 기록' : '작전 명령서'}</b></div><button type="button" class="mission-claim-all" data-mission-claim-all ${claimableIn(category) > 0 ? '' : 'disabled'}>모두 받기</button><div><span>${category.reset}</span><strong>${completed}<em> / ${category.missions.length}</em></strong></div>`;
    const milestones = modal.querySelector('.mission-milestones');
    milestones.hidden = !category.milestones.length;
    milestones.innerHTML = category.milestones.map((milestone, index) => milestoneMarkup(milestone, index, category, completed)).join('');
    modal.querySelector('.mission-list').innerHTML = category.missions.map(mission => missionMarkup(mission, category)).join('');
    modal.querySelector('.mission-reset b').textContent = `${String(completed).padStart(2, '0')} / ${String(category.missions.length).padStart(2, '0')}`;
    syncMissionAlert();
  };

  function closeMissionBoard() {
    const modal = document.getElementById('mission-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('mission-open');
    opener?.focus();
  }

  window.openMissionBoard = () => {
    createModal();
    opener = document.activeElement;
    const modal = document.getElementById('mission-modal');
    modal.hidden = false;
    document.body.classList.add('mission-open');
    renderMissionBoard();
    modal.querySelector('.mission-close')?.focus();
  };

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMissionBoard();
  });
  // 게임 행동을 미션 진행도로 옮긴다(다른 스크립트에서 window.addMissionProgress로 호출).
  window.addMissionProgress = (categoryId, missionId, amount = 1) => {
    const category = categoryFor(categoryId);
    if (category.id !== categoryId) return;
    const mission = category.missions.find(item => item.id === missionId);
    if (!mission) return;
    const saved = ensurePeriod(category);
    const cap = mission.tiers[mission.tiers.length - 1].goal;
    saved.progress[missionId] = Math.min(cap, (Number(saved.progress[missionId]) || 0) + amount);
    saveStore();
    syncDeckProgress();
    const modal = document.getElementById('mission-modal');
    if (modal && !modal.hidden) renderMissionBoard();
  };
  // 함선 탐색 완료: 일일 '함선 탐색' 1회, 주간 '함대 재정비' 탐색 횟수
  window.addEventListener('ship-exploration-completed', event => {
    window.addMissionProgress('daily', 'scan', 1);
    window.addMissionProgress('weekly', 'scan-50', Math.max(1, Number(event.detail?.count) || 1));
  });
  // 전선 전투(관문 클리어): 일일 '전선 순찰' 3회, 주간 '전선 장악' 20회
  window.addEventListener('campaign-gate-cleared', () => {
    window.addMissionProgress('daily', 'patrol', 1);
    window.addMissionProgress('weekly', 'front-20', 1);
  });
  // 접속 출석: 하루에 한 번, 주간 '주간 출석' 진행도 +1
  const markLoginDay = () => {
    const category = categoryFor('weekly');
    const saved = ensurePeriod(category);
    const today = dayKey();
    if (saved.days.includes(today)) return;
    saved.days.push(today);
    saved.progress['login-5'] = (Number(saved.progress['login-5']) || 0) + 1;
    saveStore();
  };
  window.addEventListener('DOMContentLoaded', () => { markLoginDay(); completeAllianceStub(); syncDeckProgress(); });
  // 자원 확보: 골드가 늘어난 만큼 진행도를 올린다(미션 보상, 금고, 전투 등 어디서 얻든 포함).
  let lastGold = null;
  const trackGoldGain = () => {
    const gold = Number(window.gameResources?.gold) || 0;
    if (lastGold !== null && gold > lastGold) window.addMissionProgress?.('daily', 'resource', gold - lastGold);
    lastGold = gold;
  };
  trackGoldGain();
  setInterval(trackGoldGain, 1500);
  window.addEventListener('game-resources-updated', trackGoldGain);
  // 토륨 비축: 토륨이 늘어난 만큼 주간 진행도를 올린다(상자, 미션, 전투 등 어디서 얻든 포함).
  let lastThorium = null;
  const trackThoriumGain = () => {
    const thorium = Number(window.gameResources?.thorium) || 0;
    if (lastThorium !== null && thorium > lastThorium) window.addMissionProgress?.('weekly', 'thorium-100', thorium - lastThorium);
    lastThorium = thorium;
  };
  trackThoriumGain();
  setInterval(trackThoriumGain, 1500);
  window.addEventListener('game-resources-updated', trackThoriumGain);
  // 연합 임무는 아직 구현 전이므로 주간 '연합 기여'를 달성으로 둔다(임무 구현 시 실제 진행도로 바꾼다).
  const completeAllianceStub = () => {
    const saved = ensurePeriod(categoryFor('weekly'));
    const goal = 5;
    if ((Number(saved.progress['alliance-5']) || 0) < goal) { saved.progress['alliance-5'] = goal; saveStore(); }
  };
  completeAllianceStub();
  // 0시가 지나면 기간이 바뀌므로 주기적으로 다시 확인해 초기화한다.
  setInterval(() => { syncDeckProgress(); markLoginDay(); completeAllianceStub(); const modal = document.getElementById('mission-modal'); if (modal && !modal.hidden) renderMissionBoard(); }, 60000);
})();
