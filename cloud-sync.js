// 클라우드 저장(1단계): 게스트 계정을 자동으로 만들고, 기기에 저장된 게임 진행 정보를 서버에 백업한다.
// 서버가 없거나 느려도 게임은 지금처럼 기기 저장으로 계속 돌아간다(모든 요청 실패는 조용히 넘긴다).
// 저장 데이터 구조(SCHEMA_VERSION)를 바꾸면 옛 데이터를 읽는 변환 코드를 함께 넣어야 한다.
(() => {
  'use strict';
  const API = '/api';
  const META_KEY = 'starfleet-cloud-v1';           // { id, secret, revision } — 이 기기의 게스트 계정
  const SCHEMA_VERSION = 1;
  const BACKUP_KEY = /^(starfleet-|planet-|neptune-|magenta-|kepler-|tapao-)[a-z0-9-]*$/;
  const SKIP_KEY = /^starfleet-cloud-/;
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
    } catch (error) {
      lastError = String(error?.message || error);
    }
    timer = setInterval(() => { push(); }, CHECK_EVERY);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') push(true); });
    window.addEventListener('pagehide', () => { push(true); });
  }

  window.cloudSync = {
    status: () => ({ guestId: meta.id || null, revision: meta.revision || 0, conflict, disabled, busy, lastError }),
    pushNow: () => push(),
    stop: () => { disabled = true; clearInterval(timer); }
  };
  start();
})();
