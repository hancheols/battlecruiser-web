// 서버 기능 공용 연결: 랭킹·아레나·연합이 쓰는 준비 확인, 요청, 함장 이름·최고 함선 보고, 연합 서버 어댑터.
// 서버 표(마이그레이션 0005·0006)가 아직 없으면 mode() 가 'local' 을 돌려주고, 각 기능은 지금처럼 기기 저장으로 동작한다.
// 한 번이라도 서버 모드로 동작한 기기가 연결이 끊기면 'down' 을 돌려준다(점수가 서버와 기기로 갈라지지 않게 대전을 막는다).
(() => {
  'use strict';
  const STICKY_KEY = 'starfleet-cloud-online-v1';   // starfleet-cloud-* 는 클라우드 백업 대상이 아니다
  const PROFILE_KEY = 'starfleet-commander-profile-v1';
  const RESEARCH_KEY = 'starfleet-tactical-weapon-research-v1';
  const RETRY_AFTER = 60000;
  const ACCOUNT_WAIT = 4000;
  const REPORT_EVERY = 600000;
  const RANKING_TTL = 30000;

  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const accountId = () => window.cloudSync?.status?.().guestId || null;

  class OnlineError extends Error {
    constructor(message, status, code) { super(message); this.status = status; this.code = code; }
  }

  async function call(path, { method = 'GET', body } = {}) {
    const api = window.cloudSync?.api;
    if (!api) throw new OnlineError('서버에 연결할 수 없습니다.', 0, 'no-client');
    let response;
    try { response = await api(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
    catch (_) { throw new OnlineError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.', 0, 'offline'); }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new OnlineError(data?.message || '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.', response.status, data?.error || 'bad-response');
    return data;
  }

  // ── 서버 준비 확인 ──────────────────────────────────────────────────────────
  let readyValue = null;
  let checkedAt = 0;
  let checking = null;

  async function waitForAccount() {
    const until = Date.now() + ACCOUNT_WAIT;
    while (!accountId() && Date.now() < until) await sleep(200);
    return accountId();
  }
  async function check() {
    if (!(await waitForAccount())) return false;   // 계정이 아직 없으면 이번에는 기기 저장으로
    try {
      await call('/player');
      try { localStorage.setItem(STICKY_KEY, '1'); } catch {}
      return true;
    } catch (error) {
      if (error.status === 0 || error.status === 429 || error.status >= 500 && error.code !== 'not-ready' && error.code !== 'db-unavailable') return null;
      return false;   // 표 없음(not-ready), 서버 기능 없음(404) 등
    }
  }
  function ready() {
    if (readyValue === true) return Promise.resolve(true);
    if (readyValue === false && Date.now() - checkedAt < RETRY_AFTER) return Promise.resolve(false);
    return checking ||= check().catch(() => null).then(value => { readyValue = value; checkedAt = Date.now(); checking = null; return value; });
  }
  async function mode() {
    const value = await ready();
    if (value === true) return 'server';
    if (value === false) return 'local';
    return read(STICKY_KEY, null) ? 'down' : 'local';
  }

  // ── 함장 이름·최고 함선 보고 ───────────────────────────────────────────────────
  const commanderName = () => {
    const profile = read(PROFILE_KEY, {});
    return profile.lastName ? `${profile.character || ''} ${profile.lastName}`.trim() : undefined;
  };
  // 랭킹 보고: 함종별(프리깃 제외) 최고 함선 1척. 희귀도 → 성급 → 무기 개발 레벨 순으로 비교한다.
  const RARITY_RANK = { R: 1, SR: 2, SSR: 3, L: 4 };
  function bestFleet() {
    const core = window.ArenaCore;
    const owned = window.getOwnedFleetVariants?.();
    if (!core || !owned) return null;
    const research = read(RESEARCH_KEY, {});
    const fleet = {};
    for (const type of ['dreadnought', 'battlecruiser', 'destroyer']) {
      const ships = owned.filter(ship => !ship.isFrame && ship.type === type).map(ship => ({ name: ship.name, rarity: ship.rarity, stars: Number(ship.stars ?? ship.enhancementStars) || 0, dev: core.weaponLevels(ship, research) }));
      ships.sort((x, y) => (RARITY_RANK[y.rarity] || 0) - (RARITY_RANK[x.rarity] || 0) || y.stars - x.stars || y.dev - x.dev);
      if (ships[0]) fleet[type] = ships[0];
    }
    return fleet;
  }
  let lastReport = '';
  let reporting = null;
  async function report() {
    if (reporting) return reporting;
    return reporting = (async () => {
      try {
        if ((await ready()) !== true) return false;
        const fleet = bestFleet();
        const body = { name: commanderName(), ...(fleet ? { fleet } : {}) };
        const sig = `${accountId()}:${JSON.stringify(body)}`;
        if (sig === lastReport) return false;
        await call('/player', { method: 'POST', body });
        lastReport = sig;
        rankingCache.clear();
        return true;
      } catch { return false; } finally { reporting = null; }
    })();
  }

  // ── 랭킹 ───────────────────────────────────────────────────────────────────
  const rankingCache = new Map();
  async function ranking(category) {
    const cached = rankingCache.get(category);
    if (cached && Date.now() - cached.at < RANKING_TTL) return cached.data;
    const data = await call(`/ranking?category=${encodeURIComponent(category)}`);
    rankingCache.set(category, { at: Date.now(), data });
    return data;
  }

  // ── 아레나 ─────────────────────────────────────────────────────────────────
  const arena = (action, extra = {}) => call('/arena', { method: 'POST', body: { action, ...extra } });

  // ── 연합 어댑터 ─────────────────────────────────────────────────────────────
  // 연합 화면(union.js)은 이 어댑터만 부른다. 서버 모드에서는 서버 연합을 쓰되, 시나리오에서 열리는 체험 연합(trial-usf)만 기기에 남긴다.
  const TRIAL_ID = 'trial-usf';
  const LOCAL_UNION_KEY = 'starfleet-union-local-v1';
  const ALREADY = '이미 연합에 가입되어 있습니다.';
  const DOWN = '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  const Local = () => window.UnionLocal;
  let mineCache = null;
  let cleaned = false;

  // 기기 저장 시절의 가상 연합은 서버 모드에서 쓰지 않는다. 체험 연합만 남긴다.
  function dropLocalUnions() {
    if (cleaned) return;
    cleaned = true;
    const data = read(LOCAL_UNION_KEY, null);
    if (!data?.unions?.some(union => !union.trial)) return;
    try { localStorage.setItem(LOCAL_UNION_KEY, JSON.stringify({ ...data, unions: data.unions.filter(union => union.trial) })); } catch {}
  }
  async function unionMode() {
    const value = await mode();
    if (value === 'down') throw new Error(DOWN);
    if (value === 'server') dropLocalUnions();
    return value;
  }
  async function fetchMine() {
    if (mineCache && Date.now() - mineCache.at < 1500) return mineCache.data;
    const data = await call('/union');
    mineCache = { at: Date.now(), data };
    return data;
  }
  const inTrial = async () => Boolean((await Local().getMyUnion())?.trial);
  const post = async (action, extra = {}) => { const data = await call('/union', { method: 'POST', body: { action, ...extra } }); mineCache = null; return data; };
  // 체험 연합 안에서 하는 일은 기기에서, 나머지는 서버에서 처리한다.
  const routed = (localMethod, serverCall) => async (...args) => {
    if ((await unionMode()) === 'local' || await inTrial()) return Local()[localMethod](...args);
    return serverCall(...args);
  };
  window.UnionAdapter = {
    async me() {
      if ((await unionMode()) === 'local' || await inTrial()) return Local().me();
      return (await fetchMine()).me;
    },
    async getMyUnion() {
      if ((await unionMode()) === 'local') return Local().getMyUnion();
      const trial = await Local().getMyUnion();
      return trial?.trial ? trial : (await fetchMine()).union;
    },
    async searchUnions(query = '') {
      if ((await unionMode()) === 'local') return Local().searchUnions(query);
      const [server, local] = await Promise.all([call(`/union?q=${encodeURIComponent(String(query).trim())}`), Local().searchUnions(query)]);
      return [...local.filter(union => union.id === TRIAL_ID), ...server.unions];
    },
    async createUnion(draft) {
      if ((await unionMode()) === 'local') return Local().createUnion(draft);
      if (await inTrial()) throw new Error(ALREADY);
      const costs = window.UnionCosts;
      if (costs.balance() < costs.create) throw new Error(`토륨이 부족합니다. (필요 ${costs.create}, 보유 ${costs.balance()})`);
      const emblem = window.UnionEmblem ? window.UnionEmblem.normalize(draft.emblem) : draft.emblem;
      const { union } = await post('create', { name: draft.name, emblem, notice: draft.notice, joinMode: draft.joinMode });
      costs.spend(costs.create);
      return union;
    },
    async joinUnion(unionId) {
      if ((await unionMode()) === 'local') return Local().joinUnion(unionId);
      if (unionId === TRIAL_ID) {
        if ((await fetchMine()).union) throw new Error(ALREADY);
        return Local().joinUnion(unionId);
      }
      if (await inTrial()) throw new Error(ALREADY);
      return (await post('join', { unionId })).status;
    },
    leaveUnion: routed('leaveUnion', () => post('leave')),
    updateUnion: routed('updateUnion', patch => post('update', patch)),
    updateEmblem: routed('updateEmblem', async emblem => {
      const costs = window.UnionCosts;
      const next = window.UnionEmblem ? window.UnionEmblem.normalize(emblem) : emblem;
      if (window.UnionEmblem?.same((await fetchMine()).union?.emblem, next)) throw new Error('현재 엠블럼과 같습니다.');
      if (costs.balance() < costs.emblem) throw new Error(`토륨이 부족합니다. (필요 ${costs.emblem}, 보유 ${costs.balance()})`);
      const { union } = await post('emblem', { emblem: next });
      costs.spend(costs.emblem);
      return union;
    }),
    setRole: routed('setRole', (target, role) => post('setRole', { target, role })),
    kick: routed('kick', target => post('kick', { target })),
    handleApplication: routed('handleApplication', (target, approve) => post('application', { target, approve: Boolean(approve) })),
    transferLeader: routed('transferLeader', target => post('transfer', { target })),
    disband: routed('disband', () => post('disband'))
  };

  window.Online = { ready, mode, call, arena, ranking, report, bestFleet, commanderName };

  // 접속하면 이름과 최고 함선을 한 번 알리고, 플레이 중에는 바뀌었을 때만 10분마다 다시 알린다.
  window.addEventListener('load', () => {
    setTimeout(report, 5000);
    setInterval(report, REPORT_EVERY);
  });
})();
