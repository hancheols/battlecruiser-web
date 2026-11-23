// 전체 채팅·연합 채팅. 실시간 연결 없이 몇 초마다 새 메시지를 묻는다(서버 /api/chat).
// 창을 열면 4초마다, 닫혀 있으면 60초마다 연합 채팅만 확인해 함교 버튼에 새 메시지 수를 표시한다.
// 온라인 기능(서버 모드)이 켜지기 전에는 버튼을 보이지 않는다. 신고·차단은 moderation.js 를 쓴다.
(() => {
  const STORE = 'starfleet-chat-v1';           // { unionSeen: 마지막으로 본 연합 메시지 id, tab }
  const OPEN_EVERY = 4000, CLOSED_EVERY = 60000, MAX_KEEP = 200, MAX_LEN = 80;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const read = () => { try { return JSON.parse(localStorage.getItem(STORE) || 'null') || {}; } catch { return {}; } };
  const write = patch => { try { localStorage.setItem(STORE, JSON.stringify({ ...read(), ...patch })); } catch {} };
  const toast = message => window.notice?.(message);
  const M = () => window.Moderation;
  const timeText = at => { const d = new Date(at); const same = new Date().toDateString() === d.toDateString(); return same ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`; };

  const channels = { global: { messages: [], last: 0, loaded: false, canWrite: false, reason: '' }, union: { messages: [], last: 0, loaded: false, canWrite: false, reason: '' } };
  let tab = read().tab === 'union' ? 'union' : 'global';
  let panel = null, button = null, timer = 0, busy = false, online = false, unread = 0;

  // ── 서버 ──
  const call = (path, options) => window.Online.call(path, options);
  async function pull(name) {
    const ch = channels[name];
    const data = await call(`/chat?channel=${name}&after=${ch.loaded ? ch.last : 0}`);
    ch.canWrite = Boolean(data.canWrite); ch.reason = data.reason || ''; ch.banUntil = data.banUntil || null; ch.unionName = data.unionName || '';
    const fresh = (data.messages || []).filter(m => !ch.messages.some(x => x.id === m.id));
    if (!ch.loaded) ch.messages = [];
    ch.messages = [...ch.messages, ...fresh].slice(-MAX_KEEP);
    ch.last = ch.messages.length ? ch.messages[ch.messages.length - 1].id : ch.last;
    ch.loaded = true;
    return fresh.length;
  }

  // ── 새 메시지 표시(연합 채팅) ──
  function updateBadge() {
    const ch = channels.union;
    const seen = Number(read().unionSeen) || 0;
    unread = ch.messages.filter(m => m.id > seen && !m.mine).length;
    const badge = button?.querySelector('.chat-badge');
    if (badge) { badge.hidden = !unread; badge.textContent = unread > 99 ? '99+' : String(unread); }
  }
  function markUnionSeen() { const ch = channels.union; if (ch.last) write({ unionSeen: ch.last }); updateBadge(); }

  // ── 함교 버튼 ──
  function placeButton() {
    if (!button) return;
    const events = document.querySelector('#command-deck .deck-shortcut.events');
    const host = button.offsetParent;
    if (!events || !events.offsetParent || !host) return;
    const e = events.getBoundingClientRect(), h = host.getBoundingClientRect();
    if (!e.width) return;
    button.style.left = `${Math.max(4, e.left - h.left + (e.width - button.offsetWidth) / 2)}px`;
    button.style.top = `${e.bottom - h.top + 6}px`;
  }
  function mountButton() {
    const deck = document.getElementById('command-deck');
    if (!deck || button) return;
    button = document.createElement('button');
    button.type = 'button'; button.className = 'deck-chat'; button.setAttribute('aria-label', '채팅');
    button.innerHTML = '<i aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M8 10h32a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H22l-9 7v-7H8a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Z"/><circle cx="16" cy="22" r="2.6"/><circle cx="24" cy="22" r="2.6"/><circle cx="32" cy="22" r="2.6"/></svg></i><span>CHAT</span><b class="chat-badge" hidden>0</b>';
    button.onclick = () => open();
    deck.append(button);
    placeButton();
    updateBadge();
  }

  // ── 채팅 창 ──
  function hintFor(ch) {
    if (tab === 'union' && ch.reason === 'no-union') return '연합에 가입하면 연합원끼리 대화할 수 있습니다.';
    if (ch.reason === 'banned') return `채팅 이용이 제한되어 있습니다${ch.banUntil ? ` (${timeText(ch.banUntil)}까지)` : ''}.`;
    if (ch.reason === 'link-required') return '전체 채팅에 글을 쓰려면 구글 계정을 연동해 주세요. (설정 › 계정연동)';
    return '';
  }
  function messageMarkup(m) {
    const blocked = !m.mine && M()?.isBlocked('player', m.playerId);
    const name = blocked ? '차단한 함장' : m.name;
    const union = tab === 'global' && m.union && !blocked ? `<em>${esc(m.union)}</em>` : '';
    const body = blocked ? '<i class="chat-hidden">차단한 함장의 메시지입니다.</i>' : esc(m.body);
    const tappable = !m.mine ? ` role="button" tabindex="0" data-chat-msg="${m.id}"` : '';
    return `<li class="chat-msg${m.mine ? ' mine' : ''}${blocked ? ' blocked' : ''}"${tappable}><div class="chat-meta"><b>${esc(name)}</b>${union}<time>${timeText(m.at)}</time></div><p>${body}</p></li>`;
  }
  function render(keepScroll = false) {
    if (!panel) return;
    const ch = channels[tab];
    const list = panel.querySelector('.chat-list');
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    panel.querySelectorAll('[data-chat-tab]').forEach(b => { const on = b.dataset.chatTab === tab; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
    panel.querySelector('[data-chat-tab="union"] small').textContent = channels.union.unionName || '';
    list.innerHTML = !ch.loaded ? '<li class="chat-empty">불러오는 중입니다…</li>'
      : ch.messages.length ? ch.messages.map(messageMarkup).join('')
      : `<li class="chat-empty">${tab === 'union' && ch.reason === 'no-union' ? '가입한 연합이 없습니다.' : '아직 메시지가 없습니다. 첫 인사를 남겨 보세요.'}</li>`;
    if (!keepScroll || nearBottom) list.scrollTop = list.scrollHeight;
    const hint = hintFor(ch), input = panel.querySelector('[data-chat-input]'), send = panel.querySelector('[data-chat-send]');
    panel.querySelector('.chat-hint').textContent = hint;
    panel.querySelector('.chat-hint').hidden = !hint;
    input.disabled = send.disabled = !ch.canWrite || busy;
    input.placeholder = ch.canWrite ? (tab === 'union' ? '연합원에게 보낼 메시지' : '모든 함장에게 보낼 메시지') : '메시지를 보낼 수 없습니다';
  }
  async function refresh() {
    try {
      await pull(tab);
      if (tab === 'union') markUnionSeen();
      render(true);
    } catch (error) {
      if (panel && !channels[tab].loaded) { panel.querySelector('.chat-list').innerHTML = `<li class="chat-empty">${esc(error?.status === 503 ? '채팅은 온라인 기능이 열린 뒤 이용할 수 있습니다.' : '채팅 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.')}</li>`; }
    }
  }
  function schedule() {
    clearTimeout(timer);
    if (!online || document.hidden) return;
    timer = setTimeout(async () => {
      if (panel) await refresh();
      else { try { await pull('union'); updateBadge(); } catch {} }
      schedule();
    }, panel ? OPEN_EVERY : CLOSED_EVERY);
  }
  async function sendMessage() {
    const input = panel.querySelector('[data-chat-input]');
    const body = input.value.replace(/\s+/g, ' ').trim();
    if (!body || busy) return;
    if ([...body].length > MAX_LEN) { toast(`메시지는 ${MAX_LEN}자까지 쓸 수 있습니다.`); return; }
    busy = true; render(true);
    try {
      await call('/chat', { method: 'POST', body: { channel: tab, body } });
      input.value = '';
      panel.querySelector('.chat-count').textContent = `0/${MAX_LEN}`;
      await pull(tab);
      if (tab === 'union') markUnionSeen();
    } catch (error) {
      toast(error?.message || '메시지를 보내지 못했습니다.');
    } finally { busy = false; render(); input.focus(); }
  }
  function open(which) {
    if (which === 'union' || which === 'global') tab = which;
    if (panel) { render(); return; }
    panel = document.createElement('div');
    panel.className = 'chat-panel';
    panel.innerHTML = `<section class="chat-card" role="dialog" aria-modal="true" aria-label="채팅">
      <header><div class="chat-tabs" role="tablist"><button type="button" role="tab" data-chat-tab="global">전체<small></small></button><button type="button" role="tab" data-chat-tab="union">연합<small></small></button></div><button type="button" class="chat-close" aria-label="닫기">×</button></header>
      <ul class="chat-list" aria-live="polite"></ul>
      <p class="chat-hint" hidden></p>
      <form class="chat-form"><input data-chat-input maxlength="${MAX_LEN}" autocomplete="off" enterkeyhint="send" aria-label="메시지"/><span class="chat-count">0/${MAX_LEN}</span><button type="submit" data-chat-send>전송</button></form>
      <p class="chat-rule">욕설·음란·혐오 표현, 개인정보, 광고·도배는 금지입니다. 메시지를 눌러 신고·차단할 수 있습니다. 메시지는 30일 뒤 삭제됩니다.</p>
    </section>`;
    document.body.append(panel);
    document.body.classList.add('chat-open');
    const close = () => { panel?.remove(); panel = null; document.body.classList.remove('chat-open'); document.removeEventListener('keydown', onKey, true); schedule(); };
    const onKey = event => { if (event.key === 'Escape' && !document.querySelector('.mod-sheet')) { event.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    panel.addEventListener('click', event => {
      if (event.target === panel || event.target.closest('.chat-close')) { close(); return; }
      const t = event.target.closest('[data-chat-tab]');
      if (t) { tab = t.dataset.chatTab; write({ tab }); render(); refresh(); return; }
      const msg = event.target.closest('[data-chat-msg]');
      if (msg) { const m = channels[tab].messages.find(x => String(x.id) === msg.dataset.chatMsg); if (m) M()?.openMessage?.({ id: String(m.id), playerId: m.playerId, name: m.name, body: m.body }); }
    });
    panel.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches?.('[data-chat-msg]')) { event.preventDefault(); event.target.click(); } });
    panel.querySelector('.chat-form').addEventListener('submit', event => { event.preventDefault(); sendMessage(); });
    panel.querySelector('[data-chat-input]').addEventListener('input', event => { panel.querySelector('.chat-count').textContent = `${[...event.target.value].length}/${MAX_LEN}`; });
    render();
    refresh().then(() => { if (tab !== 'union') pull('union').then(updateBadge).catch(() => {}); });
    schedule();
  }

  // ── 시작: 서버 모드일 때만 버튼을 붙인다 ──
  async function start() {
    try { online = (await window.Online?.mode?.()) === 'server'; } catch { online = false; }
    if (!online) return;
    mountButton();
    try { await pull('union'); updateBadge(); } catch {}
    schedule();
  }
  window.addEventListener('load', () => setTimeout(start, 7000));
  window.addEventListener('resize', placeButton);
  window.addEventListener('game-screen-changed', event => { if (event.detail?.screen === 'home') setTimeout(placeButton, 50); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  window.addEventListener('moderation-changed', () => render(true));
  window.openChat = which => { if (online) open(which); else toast('채팅은 온라인 기능이 열린 뒤 이용할 수 있습니다.'); };
})();
