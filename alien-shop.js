(() => {
  'use strict';

  const STORAGE_KEY = 'starfleet-game-resources-v1';
  const format = value => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('ko-KR');
  const CURRENCIES = {
    gold: { name: '골드', image: 'gold-resource-icon.svg' },
    thorium: { name: '토륨', image: 'thorium-crystal-icon.png' },
    lionToken: { name: '사자증표', image: 'icons/lion-token.png' }
  };
  const TABS = [
    { id: 'featured', label: '오늘 특가!' },
    { id: 'supply', label: '보급품' },
    { id: 'research', label: '토륨 상점' },
    { id: 'black-market', label: '암시장' }
  ];
  const GOODS = [
    { sku: 'arena-ticket', itemId: 'arenaTicket', name: '아레나 티켓', image: 'icons/arena-button.png', detail: '무료 5회 소진 후 자동전투 1회 추가', amount: 1, currency: 'thorium', price: 20, badge: 'ARENA', groups: ['supply'], arenaTicket: true },
    { sku: 'scout-drone', itemId: 'scoutTron', name: '탐색드론', image: 'icons/scout-drone.png', detail: '함선 탐색에 필요한 정찰 장비', amount: 1, currency: 'thorium', price: 100, badge: '탐색 보급', groups: ['featured', 'supply'] },
    { sku: 'scout-drone-ten', itemId: 'scoutTron', name: '탐색드론 묶음', image: 'icons/scout-drone.png', detail: '탐색드론 10개를 한 번에 보급', amount: 10, currency: 'thorium', price: 900, badge: '10개 묶음', groups: ['supply'] },
    { sku: 'research-crew', itemId: 'researchStaff', name: '연구인력', image: 'icons/research-personnel-20261002.png', detail: '전술무기 연구에 투입할 인력', amount: 1, currency: 'thorium', price: 50, badge: '연구 필수', groups: ['featured', 'supply'] },
    // 보급품 탭의 골드 교환은 오늘의 특가와 따로 두어 수량 제한 없이 계속 판매한다.
    { sku: 'supply-gold-10000', itemId: 'gold', name: '골드', image: 'gold-resource-icon.svg', detail: '토륨 100개로 골드 10,000 교환', amount: 10000, currency: 'thorium', price: 100, badge: '교환', groups: ['supply'], rewardType: 'resource' },
    { sku: 'research-crew-ten', itemId: 'researchStaff', name: '연구인력 묶음', image: 'icons/research-personnel-20261002.png', detail: '연구인력 10개를 한 번에 보급', amount: 10, currency: 'thorium', price: 450, badge: '10개 묶음', groups: ['supply'] },
  ];
  const TOKEN_PACKS = [1, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
  const THORIUM_OFFERS = [1, 5, 10, 20, 50, 100, 500, 1000].map(amount => ({
    sku: `token-thorium-${amount}`, name: `토륨 ${format(amount * 100)}개`, image: 'icons/lion-token.png',
    detail: `사자증표 ${format(amount)}개 교환 · 1개당 토륨 100개`, amount, currency: 'lionToken', price: amount,
    badge: '사자증표 교환', groups: ['research'], rewardType: 'thorium', rewardAmount: amount * 100
  }));
  const DAILY_KEY = 'starfleet-shop-daily-gift-v1';
  const FEATURED_KEY = 'starfleet-shop-featured-v2';
  const STALL_KEY = 'starfleet-shop-token-stalls-v1';
  const FEATURED_GOODS = [
    ...[1, 5, 10, 20].map((amount, index) => ({
      sku: `daily-scout-${amount}`, itemId: 'scoutTron', name: '탐색드론', image: 'icons/scout-drone.png',
      detail: `토륨 환산가 ${format([10000, 50000, 90000, 180000][index])} 골드 · 20% 할인`, amount, currency: 'gold', price: [8000, 40000, 72000, 144000][index], badge: '20% 할인', groups: ['featured']
    })),
    ...[1, 5, 10, 20].map((amount, index) => ({
      sku: `daily-research-${amount}`, itemId: 'researchStaff', name: '연구인력', image: 'icons/research-personnel-20261002.png',
      detail: `토륨 환산가 ${format([5000, 25000, 45000, 90000][index])} 골드 · 20% 할인`, amount, currency: 'gold', price: [4000, 20000, 36000, 72000][index], badge: '20% 할인', groups: ['featured']
    })),
    { sku: 'featured-gold-10000', itemId: 'gold', name: '골드', image: 'gold-resource-icon.svg', detail: '토륨 100개로 골드 10,000 교환', amount: 10000, currency: 'thorium', price: 100, badge: '교환', groups: ['featured'], rewardType: 'resource' },
    ...[50, 100].map((amount, index) => ({
      sku: `daily-thorium-${amount}`, itemId: 'thorium', name: '토륨', image: 'thorium-crystal-icon.png',
      detail: `토륨 ${format(amount)}개 · 기준가 ${format(amount * 100)} 골드 · 20% 할인`, amount, currency: 'gold', price: [4000, 8000][index], badge: '20% 할인', groups: ['featured'], rewardType: 'resource'
    }))
  ];
  const TOKEN_STALLS = Array.from({ length: 6 }, (_, index) => ({ index: index + 1, unlockPair: Math.floor(index / 2) + 1 }));
  const TOKEN_PAIR_UNLOCK_COST = 1;
  const FIXED_KR_HOLIDAYS = new Set(['01-01', '03-01', '05-01', '05-05', '06-06', '07-17', '08-15', '10-03', '10-09', '12-25']);
  const LUNAR_KR_HOLIDAYS = new Set([
    '2026-02-16','2026-02-17','2026-02-18','2026-03-02','2026-05-24','2026-05-25','2026-06-08','2026-08-17','2026-09-24','2026-09-25','2026-09-26','2026-10-05',
    '2027-02-05','2027-02-06','2027-02-07','2027-05-03','2027-05-13','2027-06-07','2027-08-16','2027-09-14','2027-09-15','2027-09-16','2027-10-04','2027-10-11','2027-12-27'
  ]);
  let unlockedTokenPairs = 0;
  let dailyGiftBusy = false;
  const purchaseThankyou = window.createGameAudio('sound/arka_thankyou.ogg');
  purchaseThankyou.preload = 'auto';
  purchaseThankyou.volume = 0.5;
  let overlay = null;
  let activeTab = 'featured';
  let membershipOpen = false;
  let selectedGood = null;
  let lastFocus = null;
  let toastTimer = 0;

  function balances() {
    const current = window.gameResources || (window.gameResources = { gold: 0, thorium: 0 });
    if (!Number.isFinite(Number(current.lionToken))) current.lionToken = 0;
    if (!window.__inventoryBalancesHydrated) {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (saved && typeof saved === 'object') Object.assign(current, saved);
      } catch {}
      window.__inventoryBalancesHydrated = true;
    }
    return current;
  }

  function owned(itemId) {
    if(itemId==='arenaTicket')return window.getArenaTickets?.()||0;
    return Math.max(0, Math.floor(Number(window.getExplorationLootInventory?.()?.[itemId]) || 0));
  }

  function currencyMarkup(type, amount) {
    const currency = CURRENCIES[type];
    return `<span class="alien-shop-price ${type}"><img src="${currency.image}" alt="" />${format(amount)}</span>`;
  }

  function tokenPileMarkup(amount) {
    if (amount === 1) return '<img class="alien-shop-token-single" src="icons/lion-token.png" alt="사자증표 1개" />';
    if (amount <= 10) {
      const positions = amount === 5
        ? [[14, 6, -14], [43, 3, 9], [74, 8, -8], [31, 29, 15], [62, 30, -12]]
        : [[4, 7, -18], [32, 2, 12], [59, 8, -15], [88, 3, 10], [17, 22, 16], [46, 27, -11], [75, 23, 20], [2, 36, -8], [41, 36, 8], [87, 35, -17]];
      const coins = positions.map(([x, y, angle]) =>
        `<img src="icons/lion-token.png" alt="" style="left:${x}px;top:${y}px;transform:rotate(${angle}deg)" />`
      ).join('');
      return `<div class="alien-shop-loose-coins ${amount === 10 ? 'scattered' : ''}" role="img" aria-label="사자증표 ${amount}개">${coins}</div>`;
    }
    if (amount === 25) {
      return `<div class="alien-shop-twenty-five" role="img" aria-label="사자증표 20개 더미와 낱개 5개">
        <span class="alien-shop-tray-fragment" style="width:60px;height:60px"><img src="icons/lion-token-pile.png" alt="" style="width:120px" /></span>
        <div class="alien-shop-five-group" aria-hidden="true">${tokenPileMarkup(5)}</div>
      </div>`;
    }
    // The supplied tray depicts approximately 40 tokens; partial trays show the remainder.
    const fullTrays = Math.floor(amount / 40);
    const remainder = amount % 40;
    const trayCount = fullTrays + (remainder ? 1 : 0);
    const columns = trayCount <= 1 ? 1 : trayCount <= 4 ? 2 : trayCount <= 6 ? 3 : trayCount <= 12 ? 4 : 5;
    const traySize = trayCount <= 1 ? 120 : trayCount <= 4 ? 64 : trayCount <= 6 ? 50 : trayCount <= 12 ? 37 : 26;
    const trays = Array.from({ length: trayCount }, (_, index) => {
      const fraction = index < fullTrays ? 1 : remainder / 40;
      return `<span class="alien-shop-tray-fragment" style="width:${(traySize * fraction).toFixed(2)}px;height:${(traySize / 2).toFixed(2)}px"><img src="icons/lion-token-pile.png" alt="" style="width:${traySize}px" /></span>`;
    }).join('');
    return `<div class="alien-shop-tray-grid" role="img" aria-label="사자증표 ${format(amount)}개" style="grid-template-columns:repeat(${columns},${traySize}px)">${trays}</div>`;
  }

  function thoriumRewardImageMarkup(good) {
    if (good.rewardAmount >= 5000) {
      return `<div class="alien-shop-good-art alien-shop-thorium-mountain" role="img" aria-label="토륨 상자 네 줄 적재와 열린 상자 세 개"><img class="alien-shop-thorium-pile-image" src="thorium-chest-mountain-shop.png" alt="" /></div>`;
    }
    if (good.rewardAmount < 500) {
      return `<div class="alien-shop-good-art"><img src="thorium-crystal-icon.png" alt="토륨 결정" /></div>`;
    }
    const boxes = Math.max(1, Math.floor(good.rewardAmount / 500));
    if (boxes === 4) {
      const twoBoxes = '<img src="icons/thorium-box-open.png" alt="" /><img src="icons/thorium-box-open.png" alt="" />';
      return `<div class="alien-shop-good-art alien-shop-thorium-box-stack" aria-label="열린 토륨 상자 4개"><div class="alien-shop-thorium-boxes-four"><span class="rear">${twoBoxes}</span><span class="front">${twoBoxes}</span></div></div>`;
    }
    const images = Array.from({ length: boxes }, (_, index) =>
      `<img src="icons/thorium-box-open.png" alt="" style="--box-index:${index}" />`
    ).join('');
    return `<div class="alien-shop-good-art alien-shop-thorium-box-stack" aria-label="열린 토륨 상자 ${boxes}개">${images}</div>`;
  }

  function cardMarkup(good) {
    const isFeaturedOffer = FEATURED_GOODS.some(offer => offer.sku === good.sku) || good.arenaGold === true;
    const featuredState = isFeaturedOffer ? dailyFeaturedState() : null;
    const sold = Boolean(featuredState?.bought?.includes(good.sku));
    return `<article class="alien-shop-good ${good.currency === 'thorium' ? 'premium' : ''}">
      ${good.rewardType === 'thorium' ? thoriumRewardImageMarkup(good) : `<div class="alien-shop-good-art"><img src="${good.image}" alt="" /></div>`}
      <span class="alien-shop-good-badge">${good.badge}</span>
      <h3>${good.name}${good.rewardType === 'thorium' ? '' : good.amount > 1 ? `<small>× ${good.amount}</small>` : ''}</h3>
      <p>${good.detail}</p>
      <div class="alien-shop-good-bottom"><span class="alien-shop-owned">보유 ${format(owned(good.itemId))}</span><button type="button" data-shop-sku="${good.sku}" aria-label="${sold ? `${good.name} 판매 완료` : `${good.name} 교역 조건 확인`}" ${sold ? 'disabled' : ''}>${sold ? '오늘 판매 완료' : currencyMarkup(good.currency, good.price)}</button></div>
    </article>`;
  }

  function todayKey() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = type => parts.find(entry => entry.type === type)?.value || '00';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  function isKoreanHoliday(dateKey) {
    const date = new Date(`${dateKey}T12:00:00+09:00`);
    const weekday = date.getDay();
    return weekday === 0 || weekday === 6 || FIXED_KR_HOLIDAYS.has(dateKey.slice(5)) || LUNAR_KR_HOLIDAYS.has(dateKey);
  }

  function dailyGiftState() {
    const key = todayKey();
    let state;
    try { state = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null'); } catch {}
    if (!state || state.date !== key) state = { date: key, claims: 0, rewards: [] };
    return { ...state, date: key, claims: Math.max(0, Number(state.claims) || 0), rewards: Array.isArray(state.rewards) ? state.rewards : [] };
  }

  function dailyFeaturedState() {
    const key = todayKey();
    let state;
    try { state = JSON.parse(localStorage.getItem(FEATURED_KEY) || 'null'); } catch {}
    // 저장된 목록에 더 이상 없는 상품이 있으면(예전 버전 기록) 오늘 목록을 다시 뽑아 4칸을 채운다.
    const staleSku = Array.isArray(state?.skus) && state.skus.some(sku => sku !== 'daily-arena-ticket' && !FEATURED_GOODS.some(good => good.sku === sku));
    if (!state || state.date !== key || !Array.isArray(state.skus) || staleSku) {
      const picked = pickFeaturedSkus();
      state = { date: key, skus: picked.skus, discounts: picked.discounts, bought: [], refreshes: 0, arenaAmount: 1 + Math.floor(Math.random() * 5) };
      try { localStorage.setItem(FEATURED_KEY, JSON.stringify(state)); } catch {}
    }
    if (!state.discounts) {
      state.discounts = Object.fromEntries(state.skus.map(sku => [sku, randomDiscount()]));
      try { localStorage.setItem(FEATURED_KEY, JSON.stringify(state)); } catch {}
    }
    if (!Number(state.arenaAmount)) { state.arenaAmount = 1 + Math.floor(Math.random() * 5); try { localStorage.setItem(FEATURED_KEY, JSON.stringify(state)); } catch {} }
    return { ...state, bought: Array.isArray(state.bought) ? state.bought : [], refreshes: Math.max(0, Number(state.refreshes) || 0), discounts: state.discounts || {} };
  }

  // 할인율은 10~50%(10% 단위) 중 무작위. 오늘 특가 4칸을 무작위로 뽑고 각 칸에 할인율을 정한다.
  const DISCOUNT_STEPS = [10, 20, 30, 40, 50];
  function randomDiscount() {
    return DISCOUNT_STEPS[Math.floor(Math.random() * DISCOUNT_STEPS.length)];
  }
  function pickFeaturedSkus() {
    const shuffled = [...FEATURED_GOODS.map(good => good.sku), 'daily-arena-ticket'];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    const skus = shuffled.slice(0, 4);
    return { skus, discounts: Object.fromEntries(skus.map(sku => [sku, randomDiscount()])) };
  }
  // 할인율을 적용한 상품 정보. 기준가는 원래 표시 가격(20% 할인 상품은 기준가에서 20%를 뺀 값)이다.
  function applyDiscount(good, pct) {
    if (!pct) return good;
    const base = good.arenaTicket ? good.amount * 2000 : good.badge === '20% 할인' ? Math.round(good.price / 0.8) : good.price;
    return { ...good, price: Math.round(base * (100 - pct) / 100), badge: `${pct}% 할인`, detail: String(good.detail || '').replace(/·\s*\d+% 할인/, `· ${pct}% 할인`), basePrice: base };
  }
  // 새로고침: 1일 최대 2회(1회 무료, 2회 10,000골드). 사자증표 소지자는 3회(2회 무료, 3회 5,000골드).
  function refreshButtonMarkup() {
    const state = dailyFeaturedState();
    const holder = Number(balances().lionToken) > 0;
    const max = holder ? 3 : 2;
    const used = state.refreshes;
    const left = Math.max(0, max - used);
    const cost = holder ? (used < 2 ? 0 : 5000) : (used < 1 ? 0 : 10000);
    const label = left === 0 ? '소진' : cost === 0 ? '무료' : `${cost.toLocaleString('ko-KR')} 골드`;
    return `<button type="button" class="alien-shop-refresh" data-featured-refresh ${left === 0 ? 'disabled' : ''} aria-label="새로고침 ${label}, 남은 ${left}회"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${label}</span><small>${left}/${max}</small></button>`;
  }
  function refreshFeatured() {
    const state = dailyFeaturedState();
    const holder = Number(balances().lionToken) > 0;
    const max = holder ? 3 : 2;
    const used = state.refreshes;
    if (used >= max) { showToast('오늘 새로고침을 모두 사용했습니다.'); return; }
    const cost = holder ? (used < 2 ? 0 : 5000) : (used < 1 ? 0 : 10000);
    const current = balances();
    if (cost > 0 && Number(current.gold) < cost) { showToast('골드가 부족합니다.'); return; }
    const picked = pickFeaturedSkus();
    const next = { ...state, skus: picked.skus, discounts: picked.discounts, refreshes: used + 1 };
    try {
      if (cost > 0) { current.gold -= cost; localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); }
      localStorage.setItem(FEATURED_KEY, JSON.stringify(next));
    } catch { showToast('새로고침을 저장하지 못했습니다.'); return; }
    window.updateGameResourceHud?.();
    window.dispatchEvent(new Event('game-resources-updated'));
    render();
    showToast(cost > 0 ? `${cost.toLocaleString('ko-KR')} 골드로 새로고침했습니다.` : '새로고침했습니다.');
  }

  // 오늘 특가 아레나 티켓: 매일 1~5장 무작위, 50% 할인(장당 1,000골드, 기준가 2,000골드)
  // 오늘의 보급품 후보 중 하나인 아레나 티켓(1~5장 무작위, 50% 할인, 장당 1,000골드)
  function arenaGoodFor(amount) {
    return { sku: "daily-arena-ticket", itemId: "arenaTicket", name: "아레나 티켓", image: "icons/arena-button.png", detail: `토륨 환산가 ${format(amount * 2000)} 골드 · 50% 할인`, amount, currency: "gold", price: amount * 1000, badge: "50% 할인", groups: ["featured"], arenaTicket: true, arenaGold: true };
  }
  function arenaFeaturedGood() {
    return arenaGoodFor(Number(dailyFeaturedState().arenaAmount) || 1);
  }
  function featuredGoodFor(sku) {
    const good = sku === "daily-arena-ticket" ? arenaFeaturedGood() : FEATURED_GOODS.find(item => item.sku === sku);
    return good ? applyDiscount(good, dailyFeaturedState().discounts?.[sku]) : good;
  }

  function playPurchaseThankyou() {
    try {
      purchaseThankyou.currentTime = 0;
      purchaseThankyou.play()?.catch?.(() => {});
    } catch {}
  }

  function dailyGiftMarkup() {
    const state = dailyGiftState();
    const allowance = isKoreanHoliday(state.date) ? 2 : 1;
    const rewards = [
      { itemId: 'thorium', name: '토륨 50', image: 'thorium-crystal-icon.png', amount: 50 },
      { itemId: 'gold', name: '골드 1,000', image: 'gold-resource-icon.svg', amount: 1000 },
      { itemId: 'scoutTron', name: '탐색드론 1', image: 'icons/scout-drone.png', amount: 1 },
      { itemId: 'researchStaff', name: '연구인력 1', image: 'icons/research-personnel-20261002.png', amount: 1 }
    ];
    const claimed = state.claims >= allowance;
    const rewardRows = state.rewards.map(reward => `<span class="alien-shop-gift-history"><img src="${reward.image}" alt="" />${reward.name}</span>`).join('');
    return `<section class="alien-shop-daily-gift"><div class="alien-shop-gift-copy"><small>DAILY LOGIN GIFT</small><strong>방문 선물</strong><span>무작위 선물 · ${isKoreanHoliday(state.date) ? '주말·공휴일 2회' : '평일 1회'}</span>${rewardRows ? `<div class="alien-shop-gift-history-list">${rewardRows}</div>` : ''}</div><button type="button" data-daily-gift ${claimed || dailyGiftBusy ? 'disabled' : ''}><span>${claimed ? '오늘 수령 완료' : '무료 수령'}</span><small>${state.claims}/${allowance}</small></button></section>`;
  }

  // Membership Service: 오늘 특가 아래 판매대. 4칸 각각 아래 확률로 상품이 올라온다(매일 0시 갱신).
  // 함선 2종 각 10%, 정밀탐색드론 4종 각 10%, 고급연구인력 3종 각 10%, 토륨 1,000·2,000 각 5%.
  const MEMBERSHIP_KEY = 'starfleet-shop-membership-v2';
  const MEMBERSHIP_OUTCOMES = [
    { kind: 'ship', weight: 10 }, { kind: 'ship', weight: 10 },
    ...[1, 5, 10, 20].map(amount => ({ kind: 'drone', amount, weight: 10 })),
    ...[1, 5, 10].map(amount => ({ kind: 'research', amount, weight: 10 })),
    { kind: 'thorium', amount: 1000, weight: 5 },
    { kind: 'thorium', amount: 2000, weight: 5 }
  ];
  const MEMBERSHIP_WEIGHT_TOTAL = MEMBERSHIP_OUTCOMES.reduce((sum, item) => sum + item.weight, 0);
  const pickMembershipOutcome = () => {
    let roll = Math.random() * MEMBERSHIP_WEIGHT_TOTAL;
    for (const outcome of MEMBERSHIP_OUTCOMES) {
      roll -= outcome.weight;
      if (roll < 0) return outcome;
    }
    return MEMBERSHIP_OUTCOMES[0];
  };
  function membershipState() {
    const key = todayKey();
    let state = null;
    try { state = JSON.parse(localStorage.getItem(MEMBERSHIP_KEY) || 'null'); } catch {}
    if (!state || state.date !== key || !Array.isArray(state.slots)) {
      const pool = typeof window.getLClassShips === 'function' ? window.getLClassShips() : [];
      const slots = Array.from({ length: 4 }, (_, index) => {
        const outcome = pickMembershipOutcome();
        if (outcome.kind === 'ship') {
          const ship = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
          return { id: index, kind: 'ship', shipName: ship?.name || '', shipImage: ship?.image || 'dreadnought-angela-codex.png', bought: false };
        }
        return { id: index, kind: outcome.kind, amount: outcome.amount, bought: false };
      });
      state = { date: key, slots };
      try { localStorage.setItem(MEMBERSHIP_KEY, JSON.stringify(state)); } catch {}
    }
    return state;
  }
  function membershipDescriptor(slot) {
    if (slot.kind === 'ship') return { title: 'L급 함선', sub: slot.shipName, image: slot.shipImage, price: 75, currency: 'lionToken', unit: '사자증표' };
    if (slot.kind === 'drone') return { title: `정밀탐색드론 ×${slot.amount}`, image: 'icons/precision-scout-drone.webp', price: slot.amount * 2, currency: 'lionToken', unit: '사자증표' };
    if (slot.kind === 'research') return { title: `고급연구인력 ×${slot.amount}`, image: 'icons/research-personnel-20261002.png', price: slot.amount, currency: 'lionToken', unit: '사자증표' };
    return { title: `토륨 ${format(slot.amount)}`, image: 'thorium-crystal-icon.png', price: slot.amount === 1000 ? 8 : 15, currency: 'lionToken', unit: '사자증표' };
  }
  function membershipSlotMarkup(slot) {
    const d = membershipDescriptor(slot);
    return `<article class="alien-shop-good membership-card${slot.kind === 'ship' ? ' is-ship' : ''}"><div class="alien-shop-good-art"><img src="${d.image}" alt="" /></div><div class="alien-shop-good-bottom membership-bottom"><div class="membership-info"><span class="alien-shop-good-badge membership-badge">MEMBERSHIP</span><h3>${d.title}</h3><p>${d.sub || '사자증표로 교환하는 멤버십 상품'}</p></div><button type="button" data-membership-buy="${slot.id}" ${slot.bought ? 'disabled' : ''}>${slot.bought ? '구매 완료' : `<img class="membership-token-icon" src="icons/lion-token.png" alt="사자증표"/> ${format(d.price)}`}</button></div></article>`;
  }
  // 멤버십 서비스 잠금: 미개방이면 판매대 중앙에 잠금 안내를 띄우고, 누르면 증표 2개로 해제할지 묻는다.
  const MEMBERSHIP_UNLOCK_KEY = 'starfleet-membership-unlocked-v1';
  const MEMBERSHIP_UNLOCK_COST = 2;
  const isMembershipUnlocked = () => {
    try { return localStorage.getItem(MEMBERSHIP_UNLOCK_KEY) === '1'; } catch { return false; }
  };
  const lionCoinsMarkup = () => '<img src="icons/lion-token.png" alt="사자증표"/><img src="icons/lion-token.png" alt="사자증표"/>';
  function membershipStageMarkup() {
    return `<section class="membership-stage"><div class="membership-stage-head">MEMBERSHIP SERVICE · PREMIUM</div><div class="membership-stage-grid">${membershipState().slots.map(membershipSlotMarkup).join('')}</div></section>`;
  }
  function membershipLockedMarkup() {
    return `<section class="membership-locked"><div class="membership-locked-preview" aria-hidden="true">${membershipState().slots.map(membershipSlotMarkup).join('')}</div><div class="membership-lock-overlay"><button type="button" class="membership-unlock-button" data-membership-unlock><span class="membership-unlock-coins">${lionCoinsMarkup()}</span><b>로 잠금해제</b></button></div></section>`;
  }
  function openMembershipUnlockConfirm() {
    document.querySelector('.membership-unlock-confirm')?.remove();
    const pop = document.createElement('section');
    pop.className = 'membership-unlock-confirm';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Membership Service 잠금 해제');
    pop.innerHTML = `<div class="membership-unlock-card"><h3>Membership Service</h3><p>사자증표 ${MEMBERSHIP_UNLOCK_COST}개를 지불하고<br/>멤버십 서비스를 해제하시겠습니까?</p><div class="membership-unlock-actions"><button type="button" data-unlock-yes>해제</button><button type="button" data-unlock-no>취소</button></div></div>`;
    document.body.append(pop);
    pop.addEventListener('click', event => {
      if (event.target === pop || event.target.closest('[data-unlock-no]')) { pop.remove(); return; }
      if (event.target.closest('[data-unlock-yes]')) { pop.remove(); unlockMembership(); }
    });
  }
  function unlockMembership() {
    const current = balances();
    if (Number(current.lionToken) < MEMBERSHIP_UNLOCK_COST) { showToast('사자증표가 부족합니다.'); return; }
    current.lionToken -= MEMBERSHIP_UNLOCK_COST;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      localStorage.setItem(MEMBERSHIP_UNLOCK_KEY, '1');
    } catch { showToast('해제를 저장하지 못했습니다.'); return; }
    window.updateGameResourceHud?.();
    window.dispatchEvent(new Event('game-resources-updated'));
    render();
    showToast('멤버십 서비스를 해제했습니다.');
  }
  function tokenStallMarkup() {
    return `<div class="alien-shop-membership-row"><span class="membership-lion base left" aria-hidden="true"><img class="lion-img" src="icons/lion-crest.webp" alt=""/></span><span class="membership-lion base right" aria-hidden="true"><img class="lion-img" src="icons/lion-crest.webp" alt=""/></span><button type="button" class="alien-shop-membership-card" data-membership-toggle aria-expanded=""><span class="membership-title">Membership Service</span></button><span class="membership-lion front left" aria-hidden="true"><img class="lion-img lion-paw" src="icons/lion-crest.webp" alt=""/><img class="lion-img lion-hind" src="icons/lion-crest.webp" alt=""/></span><span class="membership-lion front right" aria-hidden="true"><img class="lion-img lion-paw" src="icons/lion-crest.webp" alt=""/><img class="lion-img lion-hind" src="icons/lion-crest.webp" alt=""/></span></div>`;
  }
  function buyMembership(id) {
    if (!isMembershipUnlocked()) return;
    const state = membershipState();
    const slot = state.slots.find(item => item.id === id);
    if (!slot || slot.bought) return;
    const d = membershipDescriptor(slot);
    const current = balances();
    if (Number(current[d.currency]) < d.price) { showToast(`${d.unit}이 부족합니다.`); return; }
    if (slot.kind === 'ship' && !window.grantMembershipShip?.(slot.shipName)) { showToast('함선을 지급하지 못했습니다.'); return; }
    current[d.currency] -= d.price;
    if (slot.kind === 'drone') window.grantExplorationLoot?.('precisionScout', slot.amount);
    else if (slot.kind === 'research') window.grantExplorationLoot?.('researchStaff', slot.amount);
    else if (slot.kind === 'thorium') current.thorium = (Number(current.thorium) || 0) + slot.amount;
    slot.bought = true;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); localStorage.setItem(MEMBERSHIP_KEY, JSON.stringify(state)); } catch {}
    window.updateGameResourceHud?.();
    window.dispatchEvent(new Event('game-resources-updated'));
    render();
    showToast(`${d.title} 구매 완료`);
  }

  function claimDailyGift() {
    if (dailyGiftBusy || !overlay) return;
    const state = dailyGiftState();
    const allowance = isKoreanHoliday(state.date) ? 2 : 1;
    if (state.claims >= allowance) return;
    dailyGiftBusy = true;
    const rewards = [
      { itemId: 'thorium', name: '토륨 50', image: 'thorium-crystal-icon.png', amount: 50 },
      { itemId: 'gold', name: '골드 1,000', image: 'gold-resource-icon.svg', amount: 1000 },
      { itemId: 'scoutTron', name: '탐색드론 1', image: 'icons/scout-drone.png', amount: 1 },
      { itemId: 'researchStaff', name: '연구인력 1', image: 'icons/research-personnel-20261002.png', amount: 1 }
    ];
    const reward = rewards[Math.floor(Math.random() * rewards.length)];
    const current = balances();
    const isInventory = reward.itemId === 'scoutTron' || reward.itemId === 'researchStaff';
    if (isInventory && !window.grantExplorationLoot?.(reward.itemId, reward.amount)) {
      dailyGiftBusy = false;
      showToast('선물을 지급하지 못했습니다. 다시 시도해 주세요.');
      return;
    }
    if (reward.itemId === 'gold' || reward.itemId === 'thorium') current[reward.itemId] = (Number(current[reward.itemId]) || 0) + reward.amount;
    state.claims += 1;
    state.rewards.push({ name: reward.name, image: reward.image });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      localStorage.setItem(DAILY_KEY, JSON.stringify(state));
    } catch {
      dailyGiftBusy = false;
      showToast('수령 기록을 저장하지 못했습니다. 다시 시도해 주세요.');
      return;
    }
    dailyGiftBusy = false;
    window.updateGameResourceHud?.();
    window.dispatchEvent(new Event('game-resources-updated'));
    render();
    showToast(`방문 선물: ${reward.name} 획득!`);
  }

  function unlockTokenPair(pair) {
    const current = balances();
    if (pair !== unlockedTokenPairs + 1 || pair !== 1) return;
    if (Number(current.lionToken) < TOKEN_PAIR_UNLOCK_COST) {
      showToast('사자증표가 부족합니다.');
      return;
    }
    current.lionToken -= TOKEN_PAIR_UNLOCK_COST;
    unlockedTokenPairs = pair;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); localStorage.setItem(STALL_KEY, String(unlockedTokenPairs)); } catch {
      current.lionToken += TOKEN_PAIR_UNLOCK_COST;
      unlockedTokenPairs = pair - 1;
      showToast('판매대 개방을 저장하지 못했습니다.');
      return;
    }
    window.updateGameResourceHud?.();
    window.dispatchEvent(new Event('game-resources-updated'));
    render();
    showToast('Membership Service 첫 두 칸을 개방했습니다.');
  }

  function cashCardMarkup(amount) {
    return `<article class="alien-shop-good premium alien-shop-cash-good">
      <div class="alien-shop-good-art">${tokenPileMarkup(amount)}</div>
      <span class="alien-shop-good-badge">암시장 · 현금 상품</span>
      <h3>사자증표 <small>× ${format(amount)}</small></h3>
      <p>개당 ₩1,500 · 결제 연동 준비 중</p>
      <div class="alien-shop-good-bottom"><span class="alien-shop-owned">₩${format(amount * 1500)}</span><button type="button" data-cash-pack="${amount}">상품 보기</button></div>
    </article>`;
  }

  function render() {
    if (!overlay) return;
    const current = balances();
    overlay.querySelector('[data-shop-balance="gold"]').textContent = format(current.gold);
    overlay.querySelector('[data-shop-balance="thorium"]').textContent = format(current.thorium);
    overlay.querySelector('[data-shop-balance="lionToken"]').textContent = format(current.lionToken);
    overlay.querySelector('[data-shop-balance="scoutTron"]').textContent = format(owned('scoutTron'));
    overlay.querySelector('[data-shop-balance="precisionScout"]').textContent = format(owned('precisionScout'));
    overlay.querySelector('[data-shop-balance="researchStaff"]').textContent = format(owned('researchStaff'));
    overlay.querySelectorAll('[data-shop-tab]').forEach(button => {
      const selected = button.dataset.shopTab === activeTab;
      button.classList.toggle('active', selected && !membershipOpen);
      button.setAttribute('aria-selected', String(selected));
    });
    // 보급품 탭은 항상 같은 순서로 보여 준다: 탐색드론 1·10, 연구인력 1·10, 아레나 티켓, 골드 10,000
    const SUPPLY_ORDER = ['scout-drone', 'scout-drone-ten', 'research-crew', 'research-crew-ten', 'arena-ticket', 'supply-gold-10000'];
    const goods = activeTab === 'supply'
      ? SUPPLY_ORDER.map(sku => GOODS.find(good => good.sku === sku) || FEATURED_GOODS.find(good => good.sku === sku)).filter(Boolean)
      : GOODS.filter(good => good.groups.includes(activeTab));
    const todaysFeaturedGoods = dailyFeaturedState().skus.map(sku => featuredGoodFor(sku)).filter(Boolean);
    const markup = activeTab === 'black-market'
      ? TOKEN_PACKS.map(cashCardMarkup).join('')
      : activeTab === 'research' ? THORIUM_OFFERS.map(cardMarkup).join('')
      : activeTab === 'featured' ? `${dailyGiftMarkup()}<section class="alien-shop-featured-shelf"><header><strong>오늘의 할인 상품</strong>${refreshButtonMarkup()}</header><div class="alien-shop-featured-grid">${todaysFeaturedGoods.map(cardMarkup).join('')}</div></section>`
      : goods.map(cardMarkup).join('');
    overlay.querySelector('.alien-shop-grid').innerHTML = membershipOpen ? (isMembershipUnlocked() ? membershipStageMarkup() : membershipLockedMarkup()) : markup;
    overlay.querySelector('[data-membership-unlock]') && (overlay.querySelector('[data-membership-unlock]').onclick = openMembershipUnlockConfirm);
    const toggle = overlay.querySelector('[data-membership-toggle]');
    if (toggle) { toggle.setAttribute('aria-expanded', String(membershipOpen)); toggle.onclick = () => { membershipOpen = !membershipOpen; render(); }; }
    overlay.querySelectorAll('[data-membership-buy]').forEach(button => { button.onclick = () => buyMembership(Number(button.dataset.membershipBuy)); });
    overlay.querySelector('.alien-shop-section-title').textContent = membershipOpen ? 'Membership Service' : (TABS.find(tab => tab.id === activeTab)?.label || '오늘 특가!');
    const sectionCount = overlay.querySelector('.alien-shop-section-count');
    sectionCount.hidden = activeTab === 'featured';
    sectionCount.textContent = activeTab === 'featured' ? '' : `${activeTab === 'black-market' ? TOKEN_PACKS.length : activeTab === 'research' ? THORIUM_OFFERS.length : goods.length}개 상품`;
  }

  function showToast(message) {
    if (!overlay) return;
    const toast = overlay.querySelector('.alien-shop-toast');
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
  }

  function closePurchase() {
    overlay?.querySelector('.alien-shop-purchase')?.remove();
    selectedGood = null;
    overlay?.querySelector('[data-shop-sku]')?.focus();
  }

  function openPurchase(good) {
    if (!overlay) return;
    selectedGood = good;
    const current = balances();
    const enough = Math.max(0, Number(current[good.currency]) || 0) >= good.price;
    const currency = CURRENCIES[good.currency];
    const purchase = document.createElement('div');
    purchase.className = 'alien-shop-purchase';
    purchase.innerHTML = `<section class="alien-shop-purchase-card" role="dialog" aria-modal="true" aria-labelledby="alien-shop-purchase-title">
      <button type="button" class="alien-shop-purchase-close" data-shop-cancel aria-label="구매 확인 닫기">×</button>
      <small>TRADE AGREEMENT</small><h3 id="alien-shop-purchase-title">교역 확인</h3>
      <div class="alien-shop-purchase-item"><img src="${good.image}" alt="" /><div><strong>${good.name} ${good.rewardType ? '' : good.amount > 1 ? `× ${good.amount}` : ''}</strong><span>${good.detail}</span></div></div>
      ${good.rewardType ? `<div class="alien-shop-exchange-result">교환 후 토륨 <b>+${format(good.rewardAmount)}</b></div>` : ''}
      <div class="alien-shop-purchase-ledger"><span>필요한 ${currency.name}</span>${currencyMarkup(good.currency, good.price)}<span>현재 보유</span>${currencyMarkup(good.currency, current[good.currency])}</div>
      <div class="alien-shop-purchase-actions"><button type="button" data-shop-cancel>취소</button><button type="button" class="alien-shop-confirm" data-shop-confirm ${enough ? '' : 'disabled'}>${enough ? '교역하기' : `${currency.name} 부족`}</button></div>
    </section>`;
    purchase.addEventListener('click', event => {
      if (event.target === purchase || event.target.closest('[data-shop-cancel]')) closePurchase();
      else if (event.target.closest('[data-shop-confirm]')) completePurchase();
    });
    overlay.append(purchase);
    purchase.querySelector('.alien-shop-purchase-close').focus();
  }

  function completePurchase() {
    const good = selectedGood;
    if (!good || !overlay) return;
    if (good.arenaGold) {
      const featured = dailyFeaturedState();
      if (featured.bought.includes(good.sku)) {
        closePurchase();
        render();
        showToast('오늘 특가 상품은 이미 구매했습니다.');
        return;
      }
      window.purchaseArenaTicketGold(good.amount, good.price).then(result => {
        if (result.ok) {
          const latest = dailyFeaturedState();
          latest.bought = [...latest.bought, good.sku];
          try { localStorage.setItem(FEATURED_KEY, JSON.stringify(latest)); } catch {}
        }
        closePurchase();
        render();
        showToast(result.message);
        if (result.ok) playPurchaseThankyou();
      }).catch(() => showToast('티켓 구매를 저장하지 못했습니다.'));
      return;
    }
    if(good.arenaTicket){
      const button=overlay.querySelector('[data-shop-confirm]');if(button?.disabled)return;if(button)button.disabled=true;
      window.purchaseArenaTicket().then(result=>{closePurchase();render();showToast(result.message);if(result.ok)playPurchaseThankyou();}).catch(()=>{if(button)button.disabled=false;showToast('티켓 구매를 저장하지 못했습니다.');});
      return;
    }
    const current = balances();
    const isFeaturedOffer = FEATURED_GOODS.some(offer => offer.sku === good.sku) || good.arenaGold === true;
    const featuredState = isFeaturedOffer ? dailyFeaturedState() : null;
    if (featuredState?.bought.includes(good.sku)) {
      closePurchase();
      render();
      showToast('오늘 특가 상품은 이미 구매했습니다.');
      return;
    }
    if (Math.max(0, Number(current[good.currency]) || 0) < good.price) {
      closePurchase();
      showToast(`${CURRENCIES[good.currency].name}가 부족합니다.`);
      return;
    }
    if (good.rewardType === 'thorium') {
      current.lionToken -= good.price;
      current.thorium = (Number(current.thorium) || 0) + good.rewardAmount;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); }
      catch {
        current.lionToken += good.price;
        current.thorium -= good.rewardAmount;
        closePurchase();
        showToast('교환을 저장하지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      window.updateGameResourceHud?.();
      window.dispatchEvent(new Event('game-resources-updated'));
      playPurchaseThankyou();
      closePurchase();
      render();
      showToast(`토륨 ${format(good.rewardAmount)}개를 교환했습니다.`);
      return;
    }
    if (good.rewardType === 'resource') current[good.itemId] = (Number(current[good.itemId]) || 0) + good.amount;
    else if (!window.grantExplorationLoot?.(good.itemId, good.amount)) {
      closePurchase();
      showToast('교역을 완료하지 못했습니다. 다시 시도해 주세요.');
      return;
    }
    current[good.currency] -= good.price;
    let previousResourceSave = null, previousFeaturedSave = null;
    try {
      previousResourceSave = localStorage.getItem(STORAGE_KEY);
      if (featuredState) previousFeaturedSave = localStorage.getItem(FEATURED_KEY);
    } catch {}
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      if (featuredState) {
        featuredState.bought.push(good.sku);
        localStorage.setItem(FEATURED_KEY, JSON.stringify(featuredState));
      }
    } catch {
      current[good.currency] += good.price;
      if (good.rewardType === 'resource') current[good.itemId] -= good.amount;
      else window.consumeExplorationLootBatch?.([{ itemId: good.itemId, amount: good.amount }]);
      if (featuredState) featuredState.bought = featuredState.bought.filter(sku => sku !== good.sku);
      try {
        if (previousResourceSave === null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, previousResourceSave);
        if (featuredState) {
          if (previousFeaturedSave === null) localStorage.removeItem(FEATURED_KEY);
          else localStorage.setItem(FEATURED_KEY, previousFeaturedSave);
        }
      } catch {}
      closePurchase();
      showToast('교역을 저장하지 못했습니다. 다시 시도해 주세요.');
      return;
    }
    window.updateGameResourceHud?.();
    window.dispatchEvent(new Event('game-resources-updated'));
    playPurchaseThankyou();
    closePurchase();
    render();
    showToast(good.rewardType === 'resource' ? `${good.name} ${format(good.amount)}개를 구매했습니다.` : `${good.name} ${good.amount > 1 ? `${good.amount}개` : '1개'}가 물자창고에 보관되었습니다.`);
  }

  function openCashPack(amount) {
    const price = amount * 1500;
    const purchase = document.createElement('div');
    purchase.className = 'alien-shop-purchase';
    purchase.innerHTML = `<section class="alien-shop-purchase-card" role="dialog" aria-modal="true" aria-labelledby="alien-shop-purchase-title">
      <button type="button" class="alien-shop-purchase-close" data-shop-cancel aria-label="상품 정보 닫기">×</button>
      <small>BLACK MARKET · CASH ITEM</small><h3 id="alien-shop-purchase-title">상품 정보</h3>
      <div class="alien-shop-purchase-item"><img src="icons/lion-token.png" alt="" /><div><strong>사자증표 × ${format(amount)}</strong><span>개당 ₩1,500 · 총 결제 금액 ₩${format(price)}</span></div></div>
      <p class="alien-shop-payment-note">현재 원화 결제 시스템이 연결되지 않아 구매는 아직 진행할 수 없습니다.</p>
      <div class="alien-shop-purchase-actions"><button type="button" data-shop-cancel>닫기</button><button type="button" class="alien-shop-confirm" disabled>결제 연결 준비 중</button></div>
    </section>`;
    purchase.addEventListener('click', event => {
      if (event.target === purchase || event.target.closest('[data-shop-cancel]')) closePurchase();
    });
    overlay.append(purchase);
    purchase.querySelector('.alien-shop-purchase-close').focus();
  }

  function closeShop() {
    if (!overlay) return;
    clearTimeout(toastTimer);
    overlay.remove();
    overlay = null;
    selectedGood = null;
    document.removeEventListener('keydown', onKeyDown);
    lastFocus?.focus?.();
  }

  function onKeyDown(event) {
    if (!overlay) return;
    if (event.key === 'Escape') {
      if (overlay.querySelector('.alien-shop-purchase')) closePurchase();
      else closeShop();
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = overlay.querySelector('.alien-shop-purchase-card') || overlay.querySelector('.alien-shop-dialog');
    const controls = [...dialog.querySelectorAll('button:not([disabled])')];
    if (!controls.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  window.openAlienShop = (initialTab = 'featured') => {
    const requestedTab = TABS.some(tab => tab.id === initialTab) ? initialTab : 'featured';
    if (overlay) {
      activeTab = requestedTab;
      render();
      overlay.querySelector('.alien-shop-close')?.focus();
      return;
    }
    lastFocus = document.activeElement;
    activeTab = requestedTab;
    try { unlockedTokenPairs = Math.max(0, Math.min(3, Number(localStorage.getItem(STALL_KEY)) || 0)); } catch { unlockedTokenPairs = 0; }
    overlay = document.createElement('div');
    overlay.className = 'alien-shop-overlay';
    overlay.innerHTML = `<section class="alien-shop-dialog" role="dialog" aria-modal="true" aria-labelledby="alien-shop-title">
      <div class="alien-shop-toolbar"><span class="alien-shop-brand">✦ OUTER EXCHANGE</span><div class="alien-shop-balances"><div class="alien-shop-balance-row"><span title="골드"><img src="gold-resource-icon.svg" alt="골드"/><b data-shop-balance="gold">0</b></span><span title="토륨"><img src="thorium-crystal-icon.png" alt="토륨"/><b data-shop-balance="thorium">0</b></span><span title="사자증표"><img src="icons/lion-token.png" alt="사자증표"/><b data-shop-balance="lionToken">0</b></span></div><div class="alien-shop-balance-row sub"><span title="탐색드론"><img src="icons/scout-drone.png" alt="탐색드론"/><b data-shop-balance="scoutTron">0</b></span><span title="정밀탐색드론"><img src="icons/precision-scout-drone.webp" alt="정밀탐색드론"/><b data-shop-balance="precisionScout">0</b></span><span title="연구인력"><img src="icons/research-personnel-20261002.png" alt="연구인력"/><b data-shop-balance="researchStaff">0</b></span></div></div><button type="button" class="alien-shop-close" aria-label="상점 닫기">×</button></div>
      <div class="alien-shop-hero"><div class="alien-shop-stars" aria-hidden="true"></div><div class="alien-shop-hero-copy"><span class="alien-shop-kicker">은하 변두리 교역소</span><h2 id="alien-shop-title">이방의 상점</h2><p>"먼 성계에서 건너온 물자입니다. 당신의 함대에는 꽤 쓸모가 있겠군요."</p><span class="alien-shop-merchant-sign">✧ 외계 상인 · 아르카</span></div><img class="alien-shop-merchant" src="alien-merchant.png" alt="희귀 물자를 내보이는 외계 상인" /></div>
      ${tokenStallMarkup()}
      <nav class="alien-shop-tabs" role="tablist" aria-label="상점 상품 분류">${TABS.map(tab => `<button type="button" role="tab" data-shop-tab="${tab.id}" aria-selected="false">${tab.label}</button>`).join('')}</nav>
      <div class="alien-shop-section-heading"><div><small>CURATED CARGO</small><strong class="alien-shop-section-title">오늘 특가!</strong></div><span class="alien-shop-section-count"></span></div>
      <div class="alien-shop-grid" role="tabpanel"></div>
      <footer class="alien-shop-footer"><span>구매한 물자는 물자창고에 보관됩니다.</span><button type="button" class="alien-shop-inventory">물자창고 보기 ›</button></footer>
      <div class="alien-shop-toast" role="status" aria-live="polite"></div>
    </section>`;
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('.alien-shop-close')) closeShop();
      else if (event.target.closest('[data-shop-tab]')) {
        activeTab = event.target.closest('[data-shop-tab]').dataset.shopTab;
        membershipOpen = false;
        render();
      } else if (event.target.closest('[data-featured-refresh]')) {
        if (!event.target.closest('[data-featured-refresh]').disabled) refreshFeatured();
      } else if (event.target.closest('[data-shop-sku]')) {
        const good = GOODS.find(entry => entry.sku === event.target.closest('[data-shop-sku]').dataset.shopSku);
        const featuredGood = featuredGoodFor(event.target.closest('[data-shop-sku]').dataset.shopSku);
        const offer = THORIUM_OFFERS.find(entry => entry.sku === event.target.closest('[data-shop-sku]').dataset.shopSku);
        if (good || featuredGood || offer) openPurchase(good || featuredGood || offer);
      } else if (event.target.closest('[data-cash-pack]')) {
        openCashPack(Number(event.target.closest('[data-cash-pack]').dataset.cashPack));
      } else if (event.target.closest('[data-daily-gift]')) {
        claimDailyGift();
      } else if (event.target.closest('[data-token-unlock]')) {
        unlockTokenPair(Number(event.target.closest('[data-token-unlock]').dataset.tokenUnlock));
      } else if (event.target.closest('.alien-shop-inventory')) {
        closeShop();
        window.openInventory?.();
      }
    });
    document.body.append(overlay);
    document.addEventListener('keydown', onKeyDown);
    render();
    overlay.querySelector('.alien-shop-close').focus();
  };
})();
