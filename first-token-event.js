(() => {
  const claimKey = 'starfleet-first-token-event-v1';
  const resourceKey = 'starfleet-game-resources-v1';
  const eventImage = 'icons/first-token-event.png';
  const rewards = [
    ['battlecruiser-turtle-ship-codex.png', '배틀크루저 거북선', 1],
    ['icons/scout-drone.png?v=20260929-2', '탐색드론', 10],
    ['icons/research-personnel-20261002.png', '연구인력', 10],
    ['icons/ship-frame.png', '미사일 함선골조', 1]
  ];
  const claimed = () => localStorage.getItem(claimKey) === 'claimed';
  const packClaimed = id => localStorage.getItem(`starfleet-${id}-v1`) === 'claimed';
  // 확신의 L급!! 패키지: 정밀탐색 장면을 마치면 열리고, 열린 뒤 24시간 동안만 구매할 수 있다.
  const precisionPackStartKey = 'starfleet-precision-pack-start-v1';
  const PRECISION_PACK_MS = 24 * 60 * 60 * 1000;
  const precisionScenarioDone = () => { try { return JSON.parse(localStorage.getItem('starfleet-mars-scenario-v1') || '{}').katm210EvaDone === true; } catch { return false; } };
  const precisionPackRemaining = () => {
    try {
      let start = Number(localStorage.getItem(precisionPackStartKey));
      if (!start) { start = Date.now(); localStorage.setItem(precisionPackStartKey, String(start)); }
      return Math.max(0, start + PRECISION_PACK_MS - Date.now());
    } catch { return PRECISION_PACK_MS; }
  };
  // 시나리오를 마치면 계속 판매한다. 할인은 처음 열린 뒤 24시간 동안만 적용된다.
  const precisionPackActive = () => precisionScenarioDone();
  // 증표 연계 패키지: 앞 단계를 구매한 사람에게만 목록에 보인다(구매 완료 후에도 목록에 남는다).
  const tokenPackDefs = [
    { id: 'token-pack-1', title: '한번에 3성까지!', summary: '증표 연계 패키지', requires: claimed },
    { id: 'token-pack-2', title: '달리자 5성까지!', summary: '증표 연계 패키지', requires: () => packClaimed('token-pack-1') }
  ];
  const tokenPackRewards = [
    ['battlecruiser-turtle-ship-codex.png', '1성 배틀크루저 거북선', 1],
    ['icons/ship-frame.png', '미사일 함선골조', 1],
    ['gold-resource-icon.svg', '골드', 100000]
  ];
  const eventCatalog = [
    { id: 'first-token', title: '생애 첫 증표', summary: '첫 증표 특별 보급', image: eventImage, isActive: () => true },
    ...tokenPackDefs.map(pack => ({ id: pack.id, title: pack.title, summary: pack.summary, image: eventImage, isActive: pack.requires })),
    { id: 'precision-pack', title: '확신의 L급!!', summary: '정밀탐색드론 50 · 24시간 50% 할인', image: 'icons/precision-scout-drone.webp', isActive: precisionPackActive },
    { id: 'arena', title: 'Arena', summary: 'AI 대전 · 함대 리그', image: 'icons/arena-button.png', isActive: () => true }
  ];

  window.addEventListener('DOMContentLoaded', () => {
    const deck = document.getElementById('command-deck');
    const toggle = deck?.querySelector('.deck-shortcut.events');
    if (!deck || !toggle) return;
    toggle.removeAttribute('onclick');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'deck-event-list');

    const list = document.createElement('div');
    list.id = 'deck-event-list';
    list.className = 'deck-event-list';
    list.setAttribute('aria-label', '이벤트 목록');
    list.hidden = true;
    list.innerHTML = '';
    document.body.append(list);

    const positionList = () => {
      if (list.hidden) return;
      const buttonRect = toggle.getBoundingClientRect();
      const margin = 12;
      const viewport = window.visualViewport;
      // A fixed menu belongs to the currently visible viewport. On mobile, the
      // visual viewport can move or shrink as the browser chrome changes size.
      const viewportLeft = viewport?.offsetLeft || 0;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportWidth = viewport?.width || window.innerWidth;
      const viewportHeight = viewport?.height || window.innerHeight;
      const leftEdge = viewportLeft + margin;
      const topEdge = viewportTop + margin;
      const rightEdge = viewportLeft + viewportWidth - margin;
      const bottomEdge = viewportTop + viewportHeight - margin;
      const availableWidth = Math.max(1, rightEdge - leftEdge);
      const menuWidth = Math.min(204, availableWidth);
      const centeredLeft = buttonRect.left + buttonRect.width / 2 - menuWidth / 2;
      let left = Math.max(leftEdge, Math.min(rightEdge - menuWidth, centeredLeft));
      list.style.width = `${menuWidth}px`;
      list.style.boxSizing = 'border-box';
      list.style.overflowY = 'auto';
      list.style.maxHeight = `${Math.max(1, Math.min(280, viewportHeight * 0.42, viewportHeight - margin * 2))}px`;
      list.style.left = `${left}px`;
      const renderedRect = list.getBoundingClientRect();
      if (renderedRect.left < leftEdge) left += leftEdge - renderedRect.left;
      if (renderedRect.right > rightEdge) left -= renderedRect.right - rightEdge;
      left = Math.max(leftEdge, Math.min(rightEdge - menuWidth, left));
      list.style.left = `${left}px`;
      list.style.setProperty('--event-arrow-left', `${Math.max(10, Math.min(menuWidth - 20, buttonRect.left + buttonRect.width / 2 - left - 5))}px`);
      const menuHeight = list.offsetHeight;
      const below = buttonRect.bottom + 8;
      const above = buttonRect.top - menuHeight - 8;
      const preferredTop = below + menuHeight <= bottomEdge ? below : above >= topEdge ? above : below;
      const top = Math.max(topEdge, Math.min(bottomEdge - menuHeight, preferredTop));
      list.style.top = `${top}px`;
    };

    const closeList = () => { list.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      list.hidden = !list.hidden;
      toggle.setAttribute('aria-expanded', String(!list.hidden));
      positionList();
    });
    window.addEventListener('resize', positionList);
    window.addEventListener('scroll', positionList, true);
    window.visualViewport?.addEventListener('resize', positionList);
    window.visualViewport?.addEventListener('scroll', positionList);
    document.addEventListener('click', event => {
      if (!list.hidden && !list.contains(event.target) && !toggle.contains(event.target)) closeList();
    });

    const overlay = document.createElement('div');
    overlay.className = 'first-token-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `<section class="first-token-dialog" role="dialog" aria-modal="true" aria-labelledby="first-token-title">
      <header><div><small>LIMITED EVENT · FIRST TOKEN</small><div class="first-token-title-row"><h2 id="first-token-title">생애 첫 증표</h2><b class="first-token-limit">계정당 1회</b></div></div><button type="button" class="first-token-close" aria-label="닫기">×</button></header>
      <div class="first-token-feature"><div class="first-token-ship"><img src="${rewards[0][0]}" alt="배틀크루저 거북선"/><b class="first-token-ssr-badge">SSR</b><button type="button" class="first-token-zoom" aria-label="거북선 상세정보 보기" title="상세정보 보기">⌕</button></div><div class="first-token-ship-name"><b>배틀크루저 거북선</b></div></div>
      <div class="first-token-rewards" aria-label="이벤트 보상">${rewards.slice(1).map(([image, name, count]) => `<div class="first-token-reward"><img src="${image}" alt="${name}"/><strong>×${count}</strong></div>`).join('')}</div>
      <p class="first-token-status" aria-live="polite"></p>
      <button type="button" class="first-token-buy"><span>특가 구매</span><span class="first-token-price"><img src="icons/lion-token.png" alt="사자증표"/> ×1</span></button>
    </section>`;
    document.body.append(overlay);
    const shortage = document.createElement('div');
    shortage.className = 'first-token-shortage';
    shortage.hidden = true;
    shortage.innerHTML = '<section role="dialog" aria-modal="true" aria-label="사자증표 부족"><span class="first-token-shortage-mark">!</span><b>사자증표가 부족합니다</b><small>암시장에서 사자증표를 준비할 수 있습니다.</small><button type="button">→ 상점이동</button></section>';
    document.body.append(shortage);

    // 확신의 L급!! 패키지 화면: 남은 시간을 보여 주고, 구매하면 정밀탐색드론 50개를 준다.
    const precisionView = document.createElement('div');
    precisionView.className = 'first-token-overlay';
    precisionView.hidden = true;
    precisionView.innerHTML = `<section class="first-token-dialog precision-pack-dialog" role="dialog" aria-modal="true" aria-label="확신의 L급">
      <header><div><small>24H LIMITED · PRECISION SCOUT</small><div class="first-token-title-row"><h2>확신의 L급!!</h2><b class="first-token-limit">계정당 1회</b></div></div><button type="button" class="first-token-close" aria-label="닫기">×</button></header>
      <div class="first-token-feature precision-pack-feature"><div class="first-token-ship precision-drone-ship"><img src="icons/precision-scout-drone.webp" alt="정밀탐색드론"/></div></div>
      <p class="first-token-status" aria-live="polite"></p>
      <button type="button" class="first-token-buy precision-buy"></button>
    </section>`;
    document.body.append(precisionView);
    const precisionStatus = precisionView.querySelector('.first-token-status');
    const precisionBuy = precisionView.querySelector('.precision-buy');
    let precisionTick = 0;
    const formatRemaining = ms => {
      const total = Math.floor(ms / 1000);
      const pad = value => String(value).padStart(2, '0');
      return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
    };
    const refreshPrecision = () => {
      const done = packClaimed('precision-pack');
      const remaining = precisionPackRemaining();
      precisionBuy.disabled = done;
      // 버튼 안에 할인 가격과 남은 시간을 함께 보여 준다.
      if (done) {
        precisionBuy.innerHTML = '<span class="pbuy-main">구매 완료</span>';
      } else if (remaining > 0) {
        precisionBuy.innerHTML = `<span class="pbuy-main">정밀탐색드론 50 · <s>사자증표 100</s> <em>50</em></span>
          <span class="pbuy-timer-row"><span class="pbuy-discount">-50%</span><span class="pbuy-timer"><small>할인 남은 시간</small><b>${formatRemaining(remaining)}</b></span></span>`;
      } else {
        precisionBuy.innerHTML = `<span class="pbuy-tag pbuy-tag-regular">정가 판매</span>
          <span class="pbuy-main">정밀탐색드론 50 · <em>사자증표 100</em></span>
          <span class="pbuy-timer"><small>언제든 구매 가능</small></span>`;
      }
      precisionStatus.textContent = done ? '구매 완료 · 정밀탐색드론은 물자창고에서 확인할 수 있습니다.' : '';
    };
    // 함교 이벤트 버튼 아래에 할인 남은 시간을 띄운다. 폭은 'EVENT' 글자 칸과 같게 맞춘다.
    const homeTimer = document.createElement('div');
    homeTimer.className = 'home-precision-timer';
    homeTimer.hidden = true;
    homeTimer.innerHTML = '<b></b>';
    document.body.append(homeTimer);
    const updateHomeTimer = () => {
      const remaining = precisionPackRemaining();
      const show = precisionScenarioDone() && !packClaimed('precision-pack') && remaining > 0;
      homeTimer.hidden = !show;
      if (!show) return;
      homeTimer.querySelector('b').textContent = formatRemaining(remaining);
      const label = toggle.querySelector(':scope > span');
      const box = label ? label.getBoundingClientRect() : null;
      // 함교 화면이 아니어서 기준 글자가 보이지 않으면(크기 0) 시간 표시도 숨긴다. 숨기지 않으면 화면 왼쪽 위에 떠 버린다.
      if (!box || !box.width || !box.height) { homeTimer.hidden = true; return; }
      homeTimer.style.left = `${box.left}px`; homeTimer.style.width = `${box.width}px`; homeTimer.style.top = `${box.bottom + 2}px`;
    };
    updateHomeTimer();
    setInterval(updateHomeTimer, 1000);
    window.addEventListener("resize", updateHomeTimer);
    const closePrecision = () => { precisionView.hidden = true; clearInterval(precisionTick); };
    precisionView.querySelector('.first-token-close').addEventListener('click', closePrecision);
    precisionView.addEventListener('click', event => { if (event.target === precisionView) closePrecision(); });
    precisionBuy.addEventListener('click', () => {
      const result = window.purchasePrecisionPack?.();
      if (!result?.ok) {
        if (result?.reason === '사자증표가 부족합니다.') shortage.hidden = false;
        else precisionStatus.textContent = result?.reason || '구매를 완료하지 못했습니다.';
        return;
      }
      refreshPrecision();
    });
    // 증표 연계 패키지 화면: 패키지마다 같은 구조의 창을 만든다.
    const packViews = {};
    tokenPackDefs.forEach(pack => {
      // 한번에 3성까지!에만 토륨 333을 함께 준다.
      const packRewards = pack.id === 'token-pack-1' ? [...tokenPackRewards, ['thorium-crystal-icon.png', '토륨', 333]] : pack.id === 'token-pack-2' ? [...tokenPackRewards, ['thorium-crystal-icon.png', '토륨', 555]] : tokenPackRewards;
      const view = document.createElement('div');
      view.className = 'first-token-overlay';
      view.hidden = true;
      view.innerHTML = `<section class="first-token-dialog" role="dialog" aria-modal="true" aria-label="${pack.title}">
        <header><div><small>LIMITED PACKAGE · TOKEN LINK</small><div class="first-token-title-row"><h2>${pack.title}</h2><b class="first-token-limit">계정당 1회</b></div></div><button type="button" class="first-token-close" aria-label="닫기">×</button></header>
        <div class="first-token-feature"><div class="first-token-ship pack-star-ship"><img src="battlecruiser-turtle-ship-codex.png" alt="1성 배틀크루저 거북선"/><span class="ship-enhancement-stars" aria-label="강화 1성">★</span></div><div class="first-token-ship-name"><b>1성 배틀크루저 거북선</b></div></div>
        <div class="first-token-rewards" aria-label="패키지 보상">${packRewards.slice(1).map(([image, name, count]) => `<div class="first-token-reward"><img src="${image}" alt="${name}"/><strong>${name} ×${count.toLocaleString('ko-KR')}</strong></div>`).join('')}</div>
        <p class="first-token-status" aria-live="polite"></p>
        <button type="button" class="first-token-buy"><span>특가 구매</span><span class="first-token-price"><img src="icons/lion-token.png" alt="사자증표"/> ×5</span></button>
      </section>`;
      document.body.append(view);
      const viewStatus = view.querySelector('.first-token-status');
      const viewBuy = view.querySelector('.first-token-buy');
      const refreshView = () => {
        const done = packClaimed(pack.id);
        viewBuy.disabled = done;
        viewBuy.querySelector('span:first-child').textContent = done ? '구매 완료' : '특가 구매';
        viewStatus.textContent = done ? '구매 완료 · 보상은 보유함선과 물자창고에서 확인할 수 있습니다.' : '';
      };
      const closeView = () => { view.hidden = true; };
      view.querySelector('.first-token-close').addEventListener('click', closeView);
      view.addEventListener('click', event => { if (event.target === view) closeView(); });
      viewBuy.addEventListener('click', () => {
        const result = window.purchaseTokenPack?.(pack.id);
        if (!result?.ok) {
          if (result?.reason === '사자증표가 부족합니다.') shortage.hidden = false;
          else viewStatus.textContent = result?.reason || '구매를 완료하지 못했습니다.';
          return;
        }
        refreshView();
      });
      packViews[pack.id] = { view, refreshView };
    });
    const status = overlay.querySelector('.first-token-status');
    const buy = overlay.querySelector('.first-token-buy');
    const refresh = () => {
      const done = claimed();
      buy.disabled = done;
      buy.querySelector('span:first-child').textContent = done ? '구매 완료' : '특가 구매';
      status.textContent = done ? '구매 완료 · 보상은 보유함선과 물자창고에서 확인할 수 있습니다.' : '';
      const activeEvents = eventCatalog.filter(item => item.isActive());
      const badge = toggle.querySelector('.deck-event-active-icon');
      if (badge && activeEvents[0]) {
        badge.src = activeEvents[0].image;
        badge.alt = `${activeEvents[0].title} 아이콘`;
      }
      toggle.classList.toggle('no-active-events', activeEvents.length === 0);
      toggle.setAttribute('aria-label', activeEvents.length > 1 ? `진행 중 이벤트 ${activeEvents.length}개, 목록 열기` : activeEvents.length ? `${activeEvents[0].title} 이벤트 목록 열기` : '진행 중인 이벤트 없음');
      list.innerHTML = activeEvents.length
        ? `${activeEvents.length > 1 ? `<b class="deck-event-list-heading">진행 중 이벤트 · ${activeEvents.length}</b>` : ''}${activeEvents.map(item => `<button type="button" class="deck-event-entry${(item.id === 'first-token' && done) || packClaimed(item.id) ? ' claimed' : ''}" data-event-id="${item.id}"><img src="${item.image}" alt=""/><span><b>${item.title}</b><small>${item.summary}</small></span><i aria-hidden="true">›</i></button>`).join('')}`
        : '<p class="deck-event-empty">현재 진행 중인 이벤트가 없습니다.</p>';
    };
    const close = () => { overlay.hidden = true; };
    shortage.addEventListener('click', event => {
      if (event.target === shortage) { shortage.hidden = true; return; }
      if (!event.target.closest('button')) return;
      shortage.hidden = true;
      close();
      window.openAlienShop?.('black-market');
    });
    list.addEventListener('click', event => {
      const entry = event.target.closest('[data-event-id]');
      if (!entry) return;
      closeList();
      if (entry.dataset.eventId === 'first-token') {
        refresh();
        overlay.hidden = false;
        overlay.querySelector('.first-token-close').focus();
      } else if (entry.dataset.eventId === 'precision-pack') {
        refreshPrecision();
        precisionView.hidden = false;
        clearInterval(precisionTick);
        precisionTick = setInterval(refreshPrecision, 1000);
        precisionView.querySelector('.first-token-close').focus();
      } else if (packViews[entry.dataset.eventId]) {
        const { view, refreshView } = packViews[entry.dataset.eventId];
        refreshView();
        view.hidden = false;
        view.querySelector('.first-token-close').focus();
      } else if (entry.dataset.eventId === 'arena') {
        toggle.focus();
        window.openArena?.();
      }
    });
    overlay.querySelector('.first-token-close').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.querySelector('.first-token-zoom').addEventListener('click', () => {
      close();
      window.openFleetShipDetailByName?.('battlecruiser', '거북선');
    });
    buy.addEventListener('click', () => {
      const result = window.purchaseFirstTokenEvent?.();
      if (!result?.ok) {
        if (result?.reason === '사자증표가 부족합니다.') shortage.hidden = false;
        else status.textContent = result?.reason || '구매를 완료하지 못했습니다.';
        return;
      }
      refresh();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeList(); close(); shortage.hidden = true; } });
    window.addEventListener('game-resources-updated', refresh);
    refresh();
  });
})();
