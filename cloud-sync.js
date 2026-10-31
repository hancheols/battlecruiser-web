// 클라우드 저장(1단계): 게스트 계정을 자동으로 만들고, 기기에 저장된 게임 진행 정보를 서버에 백업한다.
// 서버가 없거나 느려도 게임은 지금처럼 기기 저장으로 계속 돌아간다(모든 요청 실패는 조용히 넘긴다).
// 저장 데이터 구조(SCHEMA_VERSION)를 바꾸면 옛 데이터를 읽는 변환 코드를 함께 넣어야 한다.
(() => {
  'use strict';
  const API = '/api';
  const META_KEY = 'starfleet-cloud-v1';           // { id, secret, revision } — 이 기기의 게스트 계정
  const SCHEMA_VERSION = 1;
  const BACKUP_KEY = /^(starfleet-|planet-|neptune-|magenta-|kepler-|tapao-)[a-z0-9-]*$/;
  const SKIP_KEY = /^starfleet-(cloud|age)-/;   // 클라우드 계정 정보와 만 14세 확인은 이 기기에만 둔다(백업·복원 대상 아님)
  const CHECK_EVERY = 15000;
  const REQUEST_TIMEOUT = 8000;

  let meta = readMeta();
  let lastPushed = null;
  let busy = false;
  let conflict = false;
  let disabled = false;
  let timer = 0;
  let lastError = '';

  function readMeta() {
    try {
      const value = JSON.parse(localStorage.getItem(META_KEY) || 'null');
      return value && /^[0-9a-f]{24}$/.test(value.id) && /^[0-9a-f]{64}$/.test(value.secret) ? { id: value.id, secret: value.secret, revision: Math.max(0, Number(value.revision) || 0) } : {};
    } catch (_) { return {}; }
  }
  const writeMeta = () => { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (_) {} };

  function snapshot() {
    const data = {};
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && BACKUP_KEY.test(key) && !SKIP_KEY.test(key)) data[key] = localStorage.getItem(key);
      }
    } catch (_) {}
    return data;
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const abort = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      return await fetch(API + path, { ...options, signal: controller.signal, cache: 'no-store' });
    } finally { clearTimeout(abort); }
  }
  const authHeaders = () => ({ 'X-Guest-Id': meta.id, Authorization: `Bearer ${meta.secret}`, 'Content-Type': 'application/json' });

  async function ensureGuest() {
    if (meta.id) return true;
    const response = await request('/guest', { method: 'POST' });
    if (!response.ok) { lastError = `guest ${response.status}`; if (response.status === 503) disabled = true; return false; }
    const created = await response.json();
    meta = { id: created.id, secret: created.secret, revision: 0 };
    writeMeta();
    return true;
  }

  async function push(keepalive = false) {
    if (busy || conflict || disabled || !meta.id) return false;
    const data = snapshot();
    if (!Object.keys(data).length) return false;
    const text = JSON.stringify(data);
    if (text === lastPushed) return false;
    busy = true;
    try {
      const response = await request('/save', { method: 'PUT', headers: authHeaders(), keepalive, body: JSON.stringify({ baseRevision: meta.revision, schemaVersion: SCHEMA_VERSION, data }) });
      if (response.ok) {
        meta.revision = (await response.json()).revision;
        writeMeta();
        lastPushed = text;
        lastError = '';
        return true;
      }
      lastError = `save ${response.status}`;
      if (response.status === 409) markConflict(await response.json().catch(() => ({})));
      else if (response.status === 401) { meta = {}; writeMeta(); }   // 서버가 이 계정을 모르면 다음 시작 때 새 게스트로 다시 시작한다
      else if (response.status === 503) disabled = true;               // 서버 저장소가 아직 준비되지 않았다
    } catch (error) {
      lastError = String(error?.message || error);
    } finally { busy = false; }
    return false;
  }

  // 서버의 저장 리비전이 이 기기가 알던 것과 다르면(다른 기기에서 저장했다는 뜻) 덮어쓰지 않고 멈춘 뒤 알린다.
  // 지금은 게스트 한 기기뿐이라 거의 없는 경우이며, 구글 연동 단계에서 선택 창을 붙인다.
  function markConflict(server) {
    conflict = true;
    window.dispatchEvent(new CustomEvent('cloud-sync-conflict', { detail: { serverRevision: server?.revision ?? null, localRevision: meta.revision } }));
  }

  // ── 지급함 ─────────────────────────────────────────────────────────────────
  // 웹 상점 구매·운영팀 보상을 서버에서 받아 우편함(commander-profile.js)에 넣는다.
  // 우편이 클라우드 저장에 올라간 것을 확인한 뒤에만 서버에 "전달됨"을 알린다. 그 전에 끊기면 다음 확인 때 다시 받고,
  // 우편함은 같은 id 를 두 번 넣지 않으므로 중복 지급되지 않는다.
  const MAIL_KEY = 'starfleet-captain-mail-v1';
  const GRANT_CHECK_EVERY = 180000;   // 플레이 중 3분마다
  const GRANT_MIN_GAP = 10000;        // 다른 탭(웹 상점)에서 돌아왔을 때는 10초만 지나면 바로
  let lastGrantCheck = 0;
  let grantBusy = false;
  const hasMail = id => { try { return (JSON.parse(localStorage.getItem(MAIL_KEY) || '[]') || []).some(mail => mail?.id === id); } catch (_) { return false; } };

  async function checkGrants(minGap = GRANT_CHECK_EVERY) {
    if (grantBusy || conflict || disabled || !meta.id || typeof window.deliverCaptainMail !== 'function') return 0;
    if (Date.now() - lastGrantCheck < minGap) return 0;
    lastGrantCheck = Date.now();
    grantBusy = true;
    try {
      const response = await request('/grants', { headers: authHeaders() });
      if (!response.ok) return 0;
      const { grants = [] } = await response.json();
      const ready = [];
      let arrived = 0;
      for (const grant of grants) {
        const id = `grant-${grant.id}`;
        if (window.deliverCaptainMail({ id, sender: grant.sender, title: grant.title, body: grant.body, createdAt: grant.createdAt, rewards: grant.items })) arrived += 1;
        if (hasMail(id)) ready.push(grant.id);
      }
      if (!ready.length) return 0;
      await push();
      if (JSON.stringify(snapshot()) !== lastPushed) return arrived;   // 아직 서버 저장에 안 올라갔다 → 확인은 다음 번에
      const ack = await request('/grants', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ids: ready }) });
      if (!ack.ok) lastError = `grants ${ack.status}`;
      if (arrived) {
        window.notice?.('우편함에 새 보급품이 도착했습니다.');
        window.dispatchEvent(new CustomEvent('cloud-grants-arrived', { detail: { count: arrived } }));
      }
      return arrived;
    } catch (error) {
      lastError = String(error?.message || error);
      return 0;
    } finally { grantBusy = false; }
  }

  async function start() {
    try {
      if (!(await ensureGuest())) return;
      const response = await request('/save', { headers: authHeaders() });
      if (response.status === 401) { meta = {}; writeMeta(); return; }
      if (response.status === 503) { disabled = true; return; }
      if (!response.ok) { lastError = `load ${response.status}`; return; }
      const server = await response.json();
      if (!server.empty && server.revision !== meta.revision) { markConflict(server); return; }
      await push();   // 서버에 저장이 없으면 기기 데이터를 처음 한 번 올린다(기존 사용자 이전)
      await checkGrants(0);
    } catch (error) {
      lastError = String(error?.message || error);
    }
    timer = setInterval(() => { push().then(() => checkGrants()); }, CHECK_EVERY);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') push(true);
      else checkGrants(GRANT_MIN_GAP);
    });
    window.addEventListener('pagehide', () => { push(true); });
  }

  // ── 구글 연동 ───────────────────────────────────────────────────────────────
  // 설정 화면(captain-settings.js)이 쓰는 도구. 구글 로그인 버튼(GIS)이 돌려준 ID 토큰(credential)을 서버로 보내 계정을 연결하거나 전환한다.
  let configPromise = null;
  const config = () => (configPromise ||= request('/config').then(response => response.ok ? response.json() : { googleClientId: null }).catch(() => ({ googleClientId: null })));

  async function accountInfo() {
    if (!meta.id) return { identities: [] };
    try {
      const response = await request('/account', { headers: authHeaders() });
      return response.ok ? await response.json() : { identities: [] };
    } catch (_) { return { identities: [] }; }
  }

  async function postAccount(action, credential) {
    try {
      const response = await request('/account', { method: 'POST', headers: meta.id ? authHeaders() : { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, credential }) });
      return { ...(await response.json().catch(() => ({}))), httpStatus: response.status };
    } catch (error) { return { status: 'error', error: String(error?.message || error) }; }
  }

  // 전환: 서버에 있던 그 계정의 저장을 이 기기로 내려받아 기기 저장을 대체한다. 끝나면 호출한 쪽이 화면을 새로 불러온다.
  async function switchTo(credential) {
    const result = await postAccount('switch', credential);
    if (result.status !== 'switched') return result;
    clearInterval(timer);
    busy = true;
    const previous = meta;
    meta = { id: result.id, secret: result.secret, revision: 0 };
    try {
      const response = await request('/save', { headers: authHeaders() });
      if (!response.ok) throw new Error(`load ${response.status}`);
      const server = await response.json();
      if (!server.empty) {
        const stale = [];
        for (let index = 0; index < localStorage.length; index += 1) { const key = localStorage.key(index); if (key && BACKUP_KEY.test(key) && !SKIP_KEY.test(key)) stale.push(key); }
        stale.forEach(key => localStorage.removeItem(key));
        Object.entries(server.data || {}).forEach(([key, value]) => { if (BACKUP_KEY.test(key) && !SKIP_KEY.test(key)) localStorage.setItem(key, value); });
        meta.revision = server.revision;
      }
      writeMeta();
      conflict = false;
      lastPushed = JSON.stringify(snapshot());
      return { status: 'switched', email: result.email, reload: true };
    } catch (error) {
      meta = previous;
      writeMeta();
      return { status: 'error', error: String(error?.message || error) };
    } finally { busy = false; }
  }

  // 계정 삭제: 서버의 계정·저장·연결 정보를 지우고, 이 기기의 게임 진행 정보와 로그인 정보도 지운다. 끝나면 호출한 쪽이 화면을 새로 불러온다.
  async function deleteAccount() {
    clearInterval(timer);
    busy = true;
    try {
      if (meta.id) {
        const response = await request('/account', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ confirm: 'delete' }) });
        // 서버가 이미 이 계정을 모르면(401) 기기 쪽만 지우면 된다.
        if (!response.ok && response.status !== 401) {
          timer = setInterval(() => { push(); }, CHECK_EVERY);
          return { status: 'error', httpStatus: response.status };
        }
      }
    } catch (error) {
      timer = setInterval(() => { push(); }, CHECK_EVERY);
      return { status: 'error', error: String(error?.message || error) };
    } finally { busy = false; }
    disabled = true;
    const doomed = [];
    for (let index = 0; index < localStorage.length; index += 1) { const key = localStorage.key(index); if (key && ((BACKUP_KEY.test(key) && !SKIP_KEY.test(key)) || key === META_KEY)) doomed.push(key); }
    doomed.forEach(key => localStorage.removeItem(key));
    meta = {};
    lastPushed = null;
    return { status: 'deleted', reload: true };
  }

  let gsiPromise = null;
  const loadGsi = () => (window.google?.accounts?.id ? Promise.resolve(window.google) : (gsiPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => { gsiPromise = null; reject(new Error('gsi-load-failed')); };
    document.head.append(script);
  })));

  window.cloudAccount = { config, info: accountInfo, link: credential => postAccount('link', credential), switchTo, deleteAccount, loadGsi };

  window.cloudSync = {
    status: () => ({ guestId: meta.id || null, revision: meta.revision || 0, conflict, disabled, busy, lastError }),
    pushNow: () => push(),
    checkGrants: () => checkGrants(0),
    stop: () => { disabled = true; clearInterval(timer); }
  };
  // 만 14세 이상 확인(age-gate.js) 전에는 서버에 계정을 만들지 않는다.
  if (typeof window.isAgeConfirmed === 'function' && !window.isAgeConfirmed()) window.addEventListener('age-confirmed', () => { start(); }, { once: true });
  else start();
})();
