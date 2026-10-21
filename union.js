// 지구연합 · 회의장(1단계)
// 화면은 아래 "어댑터"만 부른다. 지금은 브라우저 저장소(로컬 어댑터)로 동작하고, 서버가 정해지면 같은 함수 목록의 서버 어댑터로 교체한다.
(() => {
  'use strict';
  const STORE_KEY = 'starfleet-union-local-v1';
  const PLAYER_KEY = 'starfleet-player-id-v1';
  const PROFILE_KEY = 'starfleet-commander-profile-v1';
  const EMBLEMS = ['⊕', '✦', '⬢', '☄', '⚑', '♜'];
  const ROLE_LABEL = { leader: '연합장', officer: '부연합장', manager: '시설 관리자', member: '연합원' };
  const CAPACITY = 30;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장소를 쓸 수 없어도 화면은 계속 동작한다 */ } };
  const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fail = message => { throw new Error(message); };

  // 연합 창설과 엠블럼 변경 비용(토륨). 서버가 생기면 같은 금액을 서버에서도 검사해야 한다.
  const COSTS = { create: 100, emblem: 100 };
  const THORIUM_KEY = 'starfleet-game-resources-v1';
  const thoriumBalance = () => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(THORIUM_KEY) || 'null') || {}; } catch { /* 무시 */ }
    const current = window.gameResources && typeof window.gameResources === 'object' ? window.gameResources : saved;
    return Math.max(0, Number(current.thorium) || 0);
  };
  function spendThorium(amount) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(THORIUM_KEY) || 'null') || {}; } catch { /* 무시 */ }
    const current = window.gameResources && typeof window.gameResources === 'object' ? window.gameResources : saved;
    const have = Math.max(0, Number(current.thorium) || 0);
    if (have < amount) fail(`토륨이 부족합니다. (필요 ${amount}, 보유 ${have})`);
    const next = { ...current, thorium: have - amount };
    try { localStorage.setItem(THORIUM_KEY, JSON.stringify(next)); } catch { fail('저장에 실패했습니다. 다시 시도해 주세요.'); }
    window.gameResources = next;
    window.updateGameResourceHud?.();
    window.dispatchEvent(new Event('game-resources-updated'));
  }

  // ───────── 로컬 어댑터 ─────────
  const Local = (() => {
    const playerId = () => {
      let id = '';
      try { id = localStorage.getItem(PLAYER_KEY) || ''; } catch { /* 무시 */ }
      if (!id) { id = `p-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`; try { localStorage.setItem(PLAYER_KEY, id); } catch { /* 무시 */ } }
      return id;
    };
    const playerName = () => {
      const profile = read(PROFILE_KEY, {});
      return profile.lastName ? `${profile.character || ''} ${profile.lastName}`.trim() : '신임 함장';
    };
    const npc = (unionIndex, count, names) => Array.from({ length: count }, (_, i) => ({
      playerId: `npc-${unionIndex}-${i}`,
      name: names[i % names.length] + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : ''),
      role: i === 0 ? 'leader' : i < 3 ? 'officer' : 'member',
      joinedAt: Date.now() - (60 - i) * 86400000,
      lastSeen: Date.now() - ((i * 37) % 300) * 3600000,
      contribution: Math.max(0, 5200 - i * 170)
    }));
  // ───────── 체험 연합 (United Stars Fleet) ─────────
  // 화성 10관문 뒤 에바-9 안내로 열린다. 정식 출시 때 사라지며, 받은 보상은 회수하지 않는다.
  // 연합 활동 보상은 정식 연합의 50%만 지급된다(window.unionRewardRate).
  const TRIAL_NOTICE = '체험 연합입니다. 정식 출시 때 이 연합은 사라지며, 받은 보상은 회수되지 않습니다. 정식 연합에서는 100% 보상을 받을 수 있습니다.';
  const TRIAL_MEMBERS = [
    ['강도윤', 'leader', ''], ['서지안', 'officer', ''],
    ['박민재', 'manager', '토륨 분배기 관리자'], ['최하린', 'manager', '기술협력소 관리자'],
    ['이준호', 'manager', '연합 R&D센터 관리자'], ['정유나', 'manager', '기록관 관리자'],
    ['오승우', 'member', ''], ['김태린', 'member', ''], ['윤서준', 'member', ''], ['한지호', 'member', ''],
    ['임다은', 'member', ''], ['조현우', 'member', ''], ['신예린', 'member', ''], ['배성민', 'member', ''],
    ['장하율', 'member', ''], ['노은비', 'member', ''], ['문재혁', 'member', ''], ['홍지아', 'member', ''],
    ['권도현', 'member', ''], ['송이레', 'member', '']
  ];
  const trialUnion = () => ({
    id: 'trial-usf', name: 'United Stars Fleet', emblem: '⊕', level: 2, exp: 0, notice: TRIAL_NOTICE,
    joinMode: 'open', capacity: CAPACITY, createdAt: Date.now(), trial: true, applications: [],
    members: TRIAL_MEMBERS.map(([name, role, post], i) => ({
      playerId: `trial-npc-${i}`, name, role, post,
      joinedAt: Date.now() - (30 - i) * 86400000,
      lastSeen: Date.now() - ((i * 53) % 240) * 60000,
      contribution: Math.max(0, 3000 - i * 120)
    }))
  });
    const seed = () => {
      const names = ['Sora', 'Kade', 'Mira', 'Jun', 'Dax', 'Lena', 'Orin', 'Yuna', 'Tarek', 'Hana'];
      return [
        { id: 'u-seed-1', name: '새벽연합', emblem: '✦', level: 3, exp: 420, notice: '매일 접속하는 분을 환영합니다.', joinMode: 'open', capacity: CAPACITY, createdAt: Date.now() - 90 * 86400000, members: npc(1, 18, names), applications: [] },
        { id: 'u-seed-2', name: '강철의 맹세', emblem: '♜', level: 5, exp: 1900, notice: '활동 위주의 정예 연합입니다. 가입 신청 후 승인 대기해 주세요.', joinMode: 'approval', capacity: CAPACITY, createdAt: Date.now() - 140 * 86400000, members: npc(2, 27, names), applications: [] },
        { id: 'u-seed-3', name: '푸른 별', emblem: '⊕', level: 1, exp: 30, notice: '초보 환영', joinMode: 'open', capacity: CAPACITY, createdAt: Date.now() - 20 * 86400000, members: npc(3, 9, names), applications: [] }
      ];
    };
    const load = () => { const data = read(STORE_KEY, null); if (data?.unions) { if (!data.unions.some(u => u.trial)) { data.unions.push(trialUnion()); write(STORE_KEY, data); } return data; } const fresh = { version: 1, unions: [...seed(), trialUnion()], trialUnlocked: false }; write(STORE_KEY, fresh); return fresh; };
    const save = data => write(STORE_KEY, data);
    const mineOf = (data, id) => data.unions.find(u => u.members.some(m => m.playerId === id));
    const summary = u => ({ id: u.id, name: u.name, emblem: u.emblem, level: u.level, joinMode: u.joinMode, capacity: u.capacity, memberCount: u.members.length, notice: u.notice });
    const requireMine = data => mineOf(data, playerId()) || fail('가입한 연합이 없습니다.');
    const requireRole = (union, roles, message) => { const me = union.members.find(m => m.playerId === playerId()); if (!me || !roles.includes(me.role)) fail(message || '권한이 없습니다.'); return me; };
    return {
      __rewardRate() { const data = load(); const mine = mineOf(data, playerId()); return mine?.trial ? 0.5 : 1; },
      __unlockTrial() { const data = load(); if (!data.unions.some(u => u.trial)) data.unions.push(trialUnion()); data.trialUnlocked = true; save(data); window.dispatchEvent(new Event('union-updated')); },
      async me() { return { playerId: playerId(), name: playerName() }; },
      async getMyUnion() {
        const data = load(); const union = mineOf(data, playerId());
        if (!union) return null;
        const me = union.members.find(m => m.playerId === playerId());
        me.lastSeen = Date.now(); me.name = playerName(); save(data);
        return JSON.parse(JSON.stringify(union));
      },
      async searchUnions(query = '') {
        const q = String(query).trim().toLowerCase();
        const data = load();
        return data.unions.filter(u => (!u.trial || data.trialUnlocked) && (!q || u.name.toLowerCase().includes(q))).map(summary);
      },
      async createUnion({ name, emblem, notice = '', joinMode = 'open' }) {
        const data = load();
        if (mineOf(data, playerId())) fail('이미 연합에 가입되어 있습니다.');
        const clean = String(name || '').trim();
        if (clean.length < 2 || clean.length > 12) fail('연합 이름은 2~12자로 입력해 주세요.');
        if (data.unions.some(u => u.name.toLowerCase() === clean.toLowerCase())) fail('이미 사용 중인 연합 이름입니다.');
        const union = { id: `u-${Math.random().toString(36).slice(2, 10)}`, name: clean, emblem: window.UnionEmblem ? window.UnionEmblem.normalize(emblem) : (EMBLEMS.includes(emblem) ? emblem : EMBLEMS[0]), level: 1, exp: 0, notice: String(notice).slice(0, 120), joinMode: joinMode === 'approval' ? 'approval' : 'open', capacity: CAPACITY, createdAt: Date.now(), members: [{ playerId: playerId(), name: playerName(), role: 'leader', joinedAt: Date.now(), lastSeen: Date.now(), contribution: 0 }], applications: [] };
        spendThorium(COSTS.create);
        data.unions.push(union); save(data);
        return JSON.parse(JSON.stringify(union));
      },
      async joinUnion(unionId) {
        const data = load();
        if (mineOf(data, playerId())) fail('이미 연합에 가입되어 있습니다.');
        const union = data.unions.find(u => u.id === unionId) || fail('연합을 찾을 수 없습니다.');
        if (union.trial && !data.trialUnlocked) fail('아직 열리지 않은 연합입니다.');
        if (union.members.length >= union.capacity) fail('인원이 가득 찬 연합입니다.');
        if (union.joinMode === 'approval') {
          if (union.applications.some(a => a.playerId === playerId())) fail('이미 가입 신청을 보냈습니다.');
          union.applications.push({ playerId: playerId(), name: playerName(), at: Date.now() }); save(data); return 'applied';
        }
        union.members.push({ playerId: playerId(), name: playerName(), role: 'member', joinedAt: Date.now(), lastSeen: Date.now(), contribution: 0 }); save(data); return 'joined';
      },
      async leaveUnion() {
        const data = load(); const union = requireMine(data); const me = union.members.find(m => m.playerId === playerId());
        if (me.role === 'leader' && union.members.length > 1) fail('연합장은 위임한 뒤에 탈퇴할 수 있습니다.');
        union.members = union.members.filter(m => m.playerId !== playerId());
        if (!union.members.length) data.unions = data.unions.filter(u => u.id !== union.id);
        save(data);
      },
      async updateUnion(patch) {
        const data = load(); const union = requireMine(data);
        if ('notice' in patch) { requireRole(union, ['leader', 'officer'], '공지는 연합장과 부연합장만 수정할 수 있습니다.'); union.notice = String(patch.notice).slice(0, 120); }
        if ('joinMode' in patch) { requireRole(union, ['leader'], '가입 방식은 연합장만 바꿀 수 있습니다.'); union.joinMode = patch.joinMode === 'approval' ? 'approval' : 'open'; }
        save(data);
      },
      async updateEmblem(emblem) {
        const data = load(); const union = requireMine(data);
        requireRole(union, ['leader'], '엠블럼은 연합장만 바꿀 수 있습니다.');
        const next = window.UnionEmblem ? window.UnionEmblem.normalize(emblem) : emblem;
        if (window.UnionEmblem?.same(union.emblem, next)) fail('현재 엠블럼과 같습니다.');
        spendThorium(COSTS.emblem);
        union.emblem = next; save(data);
        return JSON.parse(JSON.stringify(union));
      },
      async setRole(targetId, role) {
        const data = load(); const union = requireMine(data); requireRole(union, ['leader'], '직책 변경은 연합장만 할 수 있습니다.');
        const target = union.members.find(m => m.playerId === targetId) || fail('연합원을 찾을 수 없습니다.');
        if (target.role === 'leader') fail('연합장의 직책은 바꿀 수 없습니다.');
        if (!['officer', 'member'].includes(role)) fail('올바르지 않은 직책입니다.');
        target.role = role; save(data);
      },
      async kick(targetId) {
        const data = load(); const union = requireMine(data); const me = requireRole(union, ['leader', 'officer'], '추방 권한이 없습니다.');
        const target = union.members.find(m => m.playerId === targetId) || fail('연합원을 찾을 수 없습니다.');
        if (target.role === 'leader') fail('연합장은 추방할 수 없습니다.');
        if (me.role === 'officer' && target.role !== 'member') fail('부연합장은 연합원만 추방할 수 있습니다.');
        union.members = union.members.filter(m => m.playerId !== targetId); save(data);
      },
      async handleApplication(targetId, approve) {
        const data = load(); const union = requireMine(data); requireRole(union, ['leader', 'officer'], '신청 처리 권한이 없습니다.');
        const app = union.applications.find(a => a.playerId === targetId) || fail('신청을 찾을 수 없습니다.');
        union.applications = union.applications.filter(a => a.playerId !== targetId);
        if (approve) {
          if (union.members.length >= union.capacity) fail('인원이 가득 찼습니다.');
          union.members.push({ playerId: app.playerId, name: app.name, role: 'member', joinedAt: Date.now(), lastSeen: Date.now(), contribution: 0 });
        }
        save(data);
      },
      async transferLeader(targetId) {
        const data = load(); const union = requireMine(data); const me = requireRole(union, ['leader'], '연합장만 위임할 수 있습니다.');
        const target = union.members.find(m => m.playerId === targetId) || fail('연합원을 찾을 수 없습니다.');
        me.role = 'officer'; target.role = 'leader'; save(data);
      },
      async disband() {
        const data = load(); const union = requireMine(data); requireRole(union, ['leader'], '연합장만 해체할 수 있습니다.');
        if (union.members.length > 1) fail('연합원이 남아 있으면 해체할 수 없습니다.');
        data.unions = data.unions.filter(u => u.id !== union.id); save(data);
      }
    };
  })();

  // 서버가 정해지면 window.UnionAdapter를 서버 어댑터로 바꿔 끼운다.
  const adapter = () => window.UnionAdapter || Local;

  // ───────── 화면 ─────────
  const ui = { view: 'hub', edit: null, tab: 'hall', mode: 'join', query: '', draft: { name: '', emblem: EMBLEMS[0], notice: '', joinMode: 'open' }, menuFor: '' };
  const root = () => document.querySelector('#earth-union .union-panel');
  const notify = message => { if (window.notice) window.notice(message); };
  const ago = time => {
    const diff = Math.max(0, Date.now() - Number(time || 0)), minutes = Math.floor(diff / 60000);
    if (minutes < 5) return '접속 중';
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `${hours}시간 전` : `${Math.floor(hours / 24)}일 전`;
  };
  const num = value => Number(value || 0).toLocaleString('ko-KR');

  // ───────── 공통 디자인 부품 ─────────
  // 연합 휘장: 금속 테두리 방패 + 은빛 날개 + 상단 별. 배경 건물의 날개 달린 별 문장과 어울리게 만든 SVG.
  let crestSeq = 0;
  function crestSvg(glyph, { wings = true } = {}) {
    if (window.UnionEmblem) return window.UnionEmblem.svg(glyph, { wings });
    const k = `uc${++crestSeq}`;
    const wing = 'M44 44 C33 33 18 31 3 35 C15 39 22 42 29 46 C17 46 9 50 3 57 C17 57 29 55 38 53 C29 57 22 62 18 68 C30 66 38 61 44 56 Z';
    return `<svg class="crest-svg" viewBox="${wings ? '0 0 120 100' : '26 0 68 100'}" aria-hidden="true"><defs>
<linearGradient id="${k}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4fbff"/><stop offset=".45" stop-color="#9fc3e8"/><stop offset=".55" stop-color="#5b7fb0"/><stop offset="1" stop-color="#cfe6ff"/></linearGradient>
<linearGradient id="${k}w" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaf6ff"/><stop offset="1" stop-color="#5d86c4"/></linearGradient>
<radialGradient id="${k}f" cx=".5" cy=".38" r=".7"><stop offset="0" stop-color="#2f6fd6"/><stop offset=".6" stop-color="#0d2a66"/><stop offset="1" stop-color="#050f2e"/></radialGradient>
<filter id="${k}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
${wings ? `<path d="${wing}" fill="url(#${k}w)" stroke="#2c4f86" stroke-width=".8"/><path d="${wing}" transform="translate(120 0) scale(-1 1)" fill="url(#${k}w)" stroke="#2c4f86" stroke-width=".8"/>` : ''}
<path d="M60 8 L88 19 L88 52 C88 70 75 83 60 93 C45 83 32 70 32 52 L32 19 Z" fill="url(#${k}f)" stroke="url(#${k}m)" stroke-width="3.2" stroke-linejoin="round"/>
<path d="M60 15 L82 24 L82 52 C82 66 72 77 60 85 C48 77 38 66 38 52 L38 24 Z" fill="none" stroke="#7fd0ff" stroke-opacity=".75" stroke-width="1"/>
<path d="M60 1 L62.4 6.6 L68 6.8 L63.6 10.3 L65.2 16 L60 12.8 L54.8 16 L56.4 10.3 L52 6.8 L57.6 6.6 Z" fill="url(#${k}m)"/>
<text x="60" y="61" text-anchor="middle" dominant-baseline="middle" font-size="30" fill="#dff6ff" filter="url(#${k}g)">${esc(glyph)}</text></svg>`;
  }
  // 계급 표식: 연합장(금 별 + 3줄), 부연합장(청 2줄), 연합원(1줄)
  const rankSvg = role => {
    const n = role === 'leader' ? 3 : role === 'officer' ? 2 : 1;
    const chev = Array.from({ length: n }, (_, i) => `<path d="M3 ${10 + i * 6} L12 ${5 + i * 6} L21 ${10 + i * 6}" />`).join('');
    return `<svg class="rank-svg rank-${role}" viewBox="0 0 24 ${role === 'leader' ? 30 : 26}" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${chev}</g>${role === 'leader' ? '<path d="M12 22 L13.5 25.2 L17 25.4 L14.3 27.5 L15.2 30 L12 28.3 L8.8 30 L9.7 27.5 L7 25.4 L10.5 25.2 Z" fill="currentColor"/>' : ''}</svg>`;
  };
  // 시설 머리말: 장면에서 해당 건물 부분을 잘라 배경으로 쓰고, 테마 색 빛과 제목을 얹는다
  const HERO = {
    hall: { pos: '50% 31%', en: 'COUNCIL HALL', sub: '연합 지휘부' },
    thorium: { pos: '0% 66%', en: 'THORIUM DISTRIBUTOR', sub: '연합 에너지 분배 시설' },
    tech: { pos: '19% 46%', en: 'TECH COOPERATION', sub: '연합 기술 지원 시설' },
    command: { pos: '78% 52%', en: 'UNION COMMAND', sub: '연합 임무 사령부' },
    rnd: { pos: '100% 41%', en: 'UNION R&D CENTER', sub: '연합 전용 함선 연구소' },
    archive: { pos: '100% 69%', en: 'BATTLE ARCHIVE', sub: '전투 시뮬레이션 기록 보관소' }
  };
  const heroHtml = (id, title, extra = '') => {
    const h = HERO[id];
    return `<header class="fac-hero" style="background-position:${h.pos}"><button type="button" class="fac-back" data-view="hub" aria-label="연합 광장으로 돌아가기">‹ 연합 광장</button><div class="fac-hero-text"><small>${h.en}</small><h2>${esc(title)}</h2><span>${h.sub}</span></div>${extra}</header>`;
  };
  const panel = (title, body, cls = '') => `<section class="fac-panel ${cls}"><h3><i></i>${title}</h3>${body}</section>`;
  const soonBtn = label => `<button type="button" class="fac-btn" disabled>${label}<small>준비 중</small></button>`;

  async function run(action, success) {
    try { const result = await action(); if (success) notify(typeof success === 'function' ? success(result) : success); }
    catch (error) { notify(error.message || '처리하지 못했습니다.'); }
    ui.menuFor = '';
    await render();
  }

  // 연합장 전용: 엠블럼 변경(토륨 비용). 창설 때와 같은 꾸미기 화면을 쓴다.
  function emblemPanel(union) {
    if (!window.UnionEmblem) return '';
    if (!ui.edit) {
      return panel('엠블럼 <small>EMBLEM</small>', `<div class="em-current"><div class="em-current-crest">${crestSvg(union.emblem)}</div><button type="button" class="fac-btn" data-em-edit>엠블럼 변경 · 토륨 ${COSTS.emblem}</button></div><p class="union-hint">보유 토륨 ${thoriumBalance().toLocaleString('ko-KR')}</p>`);
    }
    const changed = !window.UnionEmblem.same(ui.edit.emblem, union.emblem);
    return panel(`엠블럼 변경 <small>토륨 ${COSTS.emblem}</small>`, `<div class="create-preview">${crestSvg(ui.edit.emblem)}</div>${emblemDesigner(ui.edit, 'edit')}<p class="union-hint">변경 비용: 토륨 ${COSTS.emblem} (보유 ${thoriumBalance().toLocaleString('ko-KR')})</p><div class="union-actions"><button type="button" class="fac-btn" data-em-apply ${changed ? '' : 'disabled'}>변경하기 · 토륨 ${COSTS.emblem}</button><button type="button" class="fac-btn" data-em-cancel>취소</button></div>`);
  }

  function hallHtml(union, me) {
    const myRole = union.members.find(m => m.playerId === me.playerId)?.role || 'member';
    const canManage = myRole === 'leader' || myRole === 'officer';
    const members = union.members.slice().sort((a, b) => ['leader', 'officer', 'manager', 'member'].indexOf(a.role) - ['leader', 'officer', 'manager', 'member'].indexOf(b.role) || b.contribution - a.contribution);
    const topContribution = Math.max(1, ...union.members.map(m => Number(m.contribution) || 0));
    const rows = members.map(m => {
      const self = m.playerId === me.playerId;
      const canKick = !self && canManage && m.role !== 'leader' && !(myRole === 'officer' && m.role !== 'member');
      const canRole = !self && myRole === 'leader' && m.role !== 'leader';
      const open = ui.menuFor === m.playerId;
      const actions = (canKick || canRole) ? `<button type="button" class="union-more" data-more="${esc(m.playerId)}" aria-label="${esc(m.name)} 관리">⋯</button>` : '';
      const menu = open ? `<div class="union-menu">${canRole ? `<button type="button" data-role="${esc(m.playerId)}:${m.role === 'officer' ? 'member' : 'officer'}">${m.role === 'officer' ? '부연합장 해임' : '부연합장 임명'}</button><button type="button" data-transfer="${esc(m.playerId)}">연합장 위임</button>` : ''}${canKick ? `<button type="button" class="danger" data-kick="${esc(m.playerId)}">추방</button>` : ''}</div>` : '';
      const online = Date.now() - Number(m.lastSeen || 0) < 5 * 60000;
      const share = Math.round(100 * Number(m.contribution || 0) / topContribution);
      return `<li class="union-member roster-row${self ? ' self' : ''}"><div class="roster-rank">${rankSvg(m.role)}</div><div class="roster-main"><div class="roster-name"><b>${esc(m.name)}</b>${self ? '<em class="roster-me">나</em>' : ''}<span class="role role-${m.role}">${ROLE_LABEL[m.role]}</span>${m.post ? `<small class="post">${esc(m.post)}</small>` : ""}</div><div class="roster-bar" aria-label="기여 ${num(m.contribution)}"><i style="width:${share}%"></i></div></div><div class="roster-meta"><b>${num(m.contribution)}</b><span class="${online ? 'on' : ''}"><i></i>${ago(m.lastSeen)}</span></div>${actions}${menu}</li>`;
    }).join('');
    const noticeBox = canManage
      ? `<textarea class="brief-edit" data-notice maxlength="120" rows="3" aria-label="공지">${esc(union.notice)}</textarea><div class="brief-actions"><button type="button" class="fac-btn small" data-save-notice>브리핑 송출</button></div>`
      : `<p class="brief-text">${esc(union.notice) || '등록된 브리핑이 없습니다.'}</p>`;
    const leaderTools = myRole === 'leader' ? `<div class="union-row"><span>가입 방식</span><select data-joinmode><option value="open"${union.joinMode === 'open' ? ' selected' : ''}>자유 가입</option><option value="approval"${union.joinMode === 'approval' ? ' selected' : ''}>승인 가입</option></select></div>` : `<div class="union-row"><span>가입 방식</span><b>${union.joinMode === 'approval' ? '승인 가입' : '자유 가입'}</b></div>`;
    const leave = myRole === 'leader'
      ? (union.members.length === 1 ? `<button type="button" class="union-btn danger" data-disband>연합 해체</button>` : `<p class="union-hint">탈퇴하려면 먼저 다른 연합원에게 연합장을 위임하세요.</p>`)
      : `<button type="button" class="union-btn danger" data-leave>연합 탈퇴</button>`;
    return `${myRole === 'leader' ? emblemPanel(union) : ''}${panel('지휘 브리핑 <small>COMMAND BRIEFING</small>', `<div class="brief">${noticeBox}</div>${leaderTools}`, 'brief-panel')}${panel(`함대 명단 <small>ROSTER ${union.members.length}/${union.capacity}</small>`, `<ul class="union-members roster">${rows}</ul>`)}<div class="union-actions">${leave}</div>`;
  }

  function applicationsHtml(union, canManage) {
    if (!canManage) return `<p class="union-empty">신청 목록은 연합장과 부연합장만 볼 수 있습니다.</p>`;
    if (!union.applications.length) return `<p class="union-empty">대기 중인 가입 신청이 없습니다.</p>`;
    return panel('입대 신청 <small>ENLISTMENT</small>', `<ul class="union-members roster">${union.applications.map(a => `<li class="union-member roster-row"><div class="roster-rank">${rankSvg('member')}</div><div class="roster-main"><div class="roster-name"><b>${esc(a.name)}</b></div><span class="roster-sub">${ago(a.at)} 신청</span></div><div class="roster-meta app-actions"><button type="button" class="fac-btn small" data-approve="${esc(a.playerId)}">수락</button><button type="button" class="fac-btn small danger" data-reject="${esc(a.playerId)}">거절</button></div></li>`).join('')}</ul>`);
  }

  // 시설 배치: x, y는 장면(540×760) 안의 퍼센트 좌표. 회의장이 맨 위, 나머지는 아래로 내려간다.
  const FACILITIES = [
    { id: 'hall', name: '회의장', desc: '연합원을 확인하고 연합을 운영합니다.', x: 50, y: 16, ready: true },
    { id: 'thorium', name: '토륨 분배기', desc: '생산된 토륨을 연합원이 나눠 받습니다.', x: 23, y: 76 },
    { id: 'tech', name: '기술협력소', desc: '연합원의 도움으로 연구 시간을 줄입니다. 연구에 진행 시간이 생기는 후반 단계에 열립니다.', x: 27, y: 33 },
    { id: 'command', name: '연합사령부', desc: '연합 임무를 의뢰받고 함대를 파견하는 지휘 시설입니다.', x: 78, y: 52, ready: true },
    { id: 'rnd', name: '연합 R&D센터', desc: '연합 안에서만 개발할 수 있는 함선 업그레이드를 연구합니다.', x: 82, y: 40 },
    { id: 'archive', name: '기록관', desc: '시뮬레이션 전투로 함대를 시험하고 기록에 따라 보상을 받습니다.', x: 81, y: 70 }
  ];
  const facility = id => FACILITIES.find(f => f.id === id);

  // 장면은 코드로 그린 벡터 그래픽이다(별빛, 중앙 항로, 시설 5개). 이미지 파일이 필요 없다.
  // 완성 이미지를 쓰려면 경로를 채운다. background는 장면 전체(540×760 비율), facilities는 시설별 이미지(생략 가능).
  // 값이 비어 있으면 아래의 코드 그래픽이 그려진다.
  const SCENE_ASSETS = { background: 'union-scene.webp?v=2', ships: { a: 'union-ship-angela.png?v=1', b: 'union-ship-varyag.png?v=1' }, facilities: {} };

  const sceneSvg = (() => {
    const rnd = (i, m, a) => ((i * m + a) % 9973) / 9973;
    const stars = Array.from({ length: 110 }, (_, i) => {
      const x = rnd(i, 7919, 1237) * 540, y = rnd(i, 4663, 811) * 760, c = rnd(i, 3571, 97);
      const cls = i % 5 === 0 ? ` class="tw tw${i % 3}"` : '';
      return `<circle${cls} cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(.4 + c * 1.2).toFixed(2)}" fill="${c > .85 ? '#ffe8b8' : '#cfe0ff'}" opacity="${(.25 + c * .6).toFixed(2)}"/>`;
    }).join('');
    const glow = (cx, cy, r, color, cls = '') => `<circle${cls ? ` class="${cls}"` : ''} cx="${cx}" cy="${cy}" r="${r}" fill="url(#g-${color})"/>`;
    const windows = (x0, y0, n, step, w, h, cls) => Array.from({ length: n }, (_, i) => `<rect class="win ${cls}${i % 3}" x="${x0 + i * step}" y="${y0 + (i % 2) * 2}" width="${w}" height="${h}" rx="1.5" fill="#ffe3a0"/>`).join('');
    const panels = (x, y, w, n, gap) => Array.from({ length: n }, (_, i) => `<path d="M${x + i * gap} ${y} v${w}" stroke="#0a1430" stroke-opacity=".55"/>`).join('');
    return `<svg viewBox="0 0 540 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs>
<linearGradient id="u-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1a46"/><stop offset=".45" stop-color="#070f27"/><stop offset="1" stop-color="#03070f"/></linearGradient>
<radialGradient id="g-blue"><stop offset="0" stop-color="#4a74d8" stop-opacity=".55"/><stop offset="1" stop-color="#4a74d8" stop-opacity="0"/></radialGradient>
<radialGradient id="g-green"><stop offset="0" stop-color="#37e0b0" stop-opacity=".5"/><stop offset="1" stop-color="#37e0b0" stop-opacity="0"/></radialGradient>
<radialGradient id="g-violet"><stop offset="0" stop-color="#8f6bff" stop-opacity=".45"/><stop offset="1" stop-color="#8f6bff" stop-opacity="0"/></radialGradient>
<radialGradient id="g-amber"><stop offset="0" stop-color="#ffb347" stop-opacity=".42"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
<radialGradient id="u-earth" cx=".35" cy=".35" r=".85"><stop offset="0" stop-color="#6fb4ff"/><stop offset=".45" stop-color="#2557b5"/><stop offset="1" stop-color="#07153a"/></radialGradient>
<radialGradient id="u-atmo"><stop offset=".82" stop-color="#7ab8ff" stop-opacity="0"/><stop offset=".93" stop-color="#7ab8ff" stop-opacity=".5"/><stop offset="1" stop-color="#7ab8ff" stop-opacity="0"/></radialGradient>
<linearGradient id="u-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fa8d6"/><stop offset=".18" stop-color="#5b78b0"/><stop offset=".6" stop-color="#2a3f72"/><stop offset="1" stop-color="#121d3d"/></linearGradient>
<linearGradient id="u-metal2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4d6aa6"/><stop offset=".5" stop-color="#26396b"/><stop offset="1" stop-color="#101a38"/></linearGradient>
<linearGradient id="u-lane" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7aa2ff" stop-opacity=".05"/><stop offset=".5" stop-color="#7aa2ff" stop-opacity=".24"/><stop offset="1" stop-color="#7aa2ff" stop-opacity=".08"/></linearGradient>
<linearGradient id="u-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bcd2ff" stop-opacity=".9"/><stop offset="1" stop-color="#bcd2ff" stop-opacity="0"/></linearGradient>
<filter id="u-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="u-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2"/></filter>
</defs>
<rect width="540" height="760" fill="url(#u-sky)"/>
<g class="neb"><ellipse cx="120" cy="140" rx="210" ry="110" fill="#6a45d8" opacity=".16" filter="url(#u-blur)"/><ellipse cx="450" cy="330" rx="170" ry="90" fill="#2f6bff" opacity=".18" filter="url(#u-blur)"/><ellipse cx="90" cy="610" rx="190" ry="100" fill="#2f6bff" opacity=".16" filter="url(#u-blur)"/></g>
${stars}
<!-- 지구 -->
<g opacity=".95"><circle cx="48" cy="112" r="96" fill="url(#u-earth)"/><circle cx="48" cy="112" r="104" fill="url(#u-atmo)"/>
<path d="M-30 90 Q10 70 60 92 Q100 110 120 90 M-20 140 Q30 120 80 150 M0 60 Q40 50 90 64" stroke="#e8f3ff" stroke-opacity=".35" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M-48 112 A96 96 0 0 1 144 112 A160 120 0 0 0 -48 112Z" fill="#000" opacity=".0"/></g>

<!-- 중앙 항로 -->
<path d="M240 238 L300 238 L478 760 L62 760 Z" fill="url(#u-lane)"/>
<path d="M270 238 L270 760" stroke="#9fc0ff" stroke-opacity=".3" stroke-width="2" stroke-dasharray="10 14"/>
<g stroke="#7aa2ff" stroke-opacity=".3" stroke-width="2" fill="none"><path d="M270 330 L168 354"/><path d="M270 400 L412 398"/><path d="M270 520 L152 548"/><path d="M270 610 L402 632"/></g>
<g class="pkts" fill="#cfe0ff"><circle class="pkt p0" cx="270" cy="250" r="2.6"/><circle class="pkt p1" cx="270" cy="250" r="2.2"/><circle class="pkt p2" cx="270" cy="250" r="2.6"/></g>

<!-- 회의장 -->
<g>
${glow(270, 140, 200, 'blue', 'pulse')}
<ellipse cx="270" cy="228" rx="214" ry="30" fill="#08122c" stroke="#4a74d8" stroke-opacity=".6"/>
<path d="M84 210 L140 160 L400 160 L456 210 L428 226 L112 226 Z" fill="url(#u-metal2)" stroke="#8fb0ff" stroke-opacity=".55"/>
<g stroke-width="1">${panels(130, 166, 52, 16, 17)}</g>
<path d="M165 160 L196 108 L344 108 L375 160 Z" fill="url(#u-metal)" stroke="#a9c3ff" stroke-opacity=".7"/>
<path d="M196 108 L270 96 L344 108" fill="none" stroke="#e8f0ff" stroke-opacity=".5"/>
<path d="M222 108 Q270 30 318 108 Z" fill="#7aa2ff" fill-opacity=".3" stroke="#cfe0ff" stroke-opacity=".85"/>
<path d="M240 106 Q270 56 300 106" fill="none" stroke="#eaf1ff" stroke-opacity=".5"/>
<rect x="266" y="18" width="8" height="70" fill="url(#u-beam)"/><circle class="beacon" cx="270" cy="17" r="5" fill="#fff"/>
<ellipse cx="270" cy="150" rx="262" ry="20" fill="none" stroke="#7aa2ff" stroke-opacity=".45" stroke-dasharray="3 7"/>
<g>${windows(126, 180, 10, 30, 14, 7, 'a')}</g>
<g>${windows(150, 196, 8, 34, 10, 5, 'b')}</g>
<path d="M30 192 L84 210 L76 244 L16 220 Z" fill="url(#u-metal2)" stroke="#8fb0ff" stroke-opacity=".4"/><path d="M510 192 L456 210 L464 244 L524 220 Z" fill="url(#u-metal2)" stroke="#8fb0ff" stroke-opacity=".4"/>
<circle class="beacon b2" cx="28" cy="206" r="3" fill="#ff7a7a"/><circle class="beacon" cx="512" cy="206" r="3" fill="#7affc8"/>
<path d="M196 226 L204 246 L336 246 L344 226 Z" fill="#0b1636" stroke="#4a74d8" stroke-opacity=".5"/>
</g>

<!-- 토륨 분배기 -->
<g>
${glow(112, 352, 120, 'green', 'pulse')}
<g stroke="#8fe9cd" stroke-opacity=".7">
<rect x="46" y="322" width="36" height="72" rx="15" fill="#0f423b"/><rect x="92" y="298" width="40" height="96" rx="17" fill="#136057"/><rect x="142" y="328" width="36" height="66" rx="15" fill="#0f423b"/></g>
<g fill="#6ff0c4" class="liquid"><rect x="54" y="342" width="20" height="6" rx="3"/><rect x="100" y="324" width="24" height="6" rx="3"/><rect x="100" y="344" width="24" height="6" rx="3"/><rect x="100" y="364" width="24" height="6" rx="3"/><rect x="150" y="348" width="20" height="6" rx="3"/></g>
<path d="M82 372 L92 372 M132 372 L142 372" stroke="#8fe9cd" stroke-width="4"/>
<path d="M60 322 Q64 312 70 322" fill="none" stroke="#bdf6e4" stroke-opacity=".6"/>
<rect x="34" y="394" width="156" height="14" rx="5" fill="url(#u-metal2)" stroke="#8fb0ff" stroke-opacity=".45"/>
<path d="M176 400 L270 402" stroke="#6ff0c4" stroke-opacity=".65" stroke-width="3"/>
</g>

<!-- 기술협력소 -->
<g>
${glow(432, 398, 124, 'violet', 'pulse')}
<g class="spin"><ellipse cx="432" cy="402" rx="82" ry="27" fill="none" stroke="#b79bff" stroke-width="5" stroke-opacity=".85"/><circle cx="514" cy="402" r="5" fill="#efe6ff"/></g>
<ellipse cx="432" cy="402" rx="82" ry="27" fill="none" stroke="#e5dbff" stroke-width="1.2" stroke-opacity=".7" transform="rotate(-18 432 402)"/>
<rect x="410" y="352" width="44" height="66" rx="9" fill="url(#u-metal)" stroke="#c7b4ff" stroke-opacity=".7"/>
<g stroke="#0a1430" stroke-opacity=".5"><path d="M410 372 H454 M410 392 H454"/></g>
<path d="M402 352 Q432 316 462 352 Z" fill="#8f6bff" fill-opacity=".55" stroke="#e5dbff" stroke-opacity=".85"/>
<rect x="430" y="314" width="4" height="22" fill="#e5dbff"/><circle class="beacon b2" cx="432" cy="312" r="5" fill="#fff"/>
<rect x="344" y="412" width="176" height="12" rx="5" fill="url(#u-metal2)" stroke="#8fb0ff" stroke-opacity=".4"/>
</g>

<!-- 연합 R&D센터 -->
<g>
${glow(136, 560, 124, 'blue', 'pulse')}
<path d="M92 604 L108 482 L164 482 L180 604 Z" fill="url(#u-metal)" stroke="#a9c3ff" stroke-opacity=".7"/>
<g stroke-width="1">${panels(112, 486, 114, 5, 12)}</g>
<rect x="116" y="450" width="40" height="36" rx="7" fill="#1a2f66" stroke="#a9c3ff" stroke-opacity=".8"/>
<g class="atom" fill="none" stroke="#7fb0ff" stroke-width="1.8"><ellipse cx="136" cy="438" rx="44" ry="14"/><ellipse cx="136" cy="438" rx="44" ry="14" transform="rotate(60 136 438)"/><ellipse cx="136" cy="438" rx="44" ry="14" transform="rotate(-60 136 438)"/></g><circle cx="136" cy="438" r="6" fill="#dfeaff"/>
<g>${windows(124, 502, 1, 0, 24, 6, 'a')}${windows(124, 524, 1, 0, 24, 6, 'b')}${windows(124, 546, 1, 0, 24, 6, 'a')}${windows(124, 568, 1, 0, 24, 6, 'b')}</g>
<rect x="58" y="604" width="156" height="14" rx="5" fill="url(#u-metal2)" stroke="#8fb0ff" stroke-opacity=".45"/>
</g>

<!-- 기록관 -->
<g>
${glow(420, 664, 134, 'amber', 'pulse')}
<ellipse cx="420" cy="702" rx="116" ry="31" fill="#10193a" stroke="#ffcf7a" stroke-opacity=".6"/>
<ellipse cx="420" cy="694" rx="90" ry="23" fill="#1d3066" stroke="#ffcf7a" stroke-opacity=".5"/>
<ellipse cx="420" cy="694" rx="60" ry="15" fill="none" stroke="#ffcf7a" stroke-opacity=".4" stroke-dasharray="4 6"/>
<path d="M358 694 L368 610 L472 610 L482 694 Z" fill="#ffcf7a" fill-opacity=".13" stroke="#ffcf7a" stroke-opacity=".75"/>
<g class="holo" stroke="#ffe3a0" stroke-opacity=".85" stroke-width="2" fill="none"><path d="M382 642 L405 652 L428 634 L452 648"/><path d="M382 664 L452 664"/><path d="M382 628 L412 628"/></g>
<rect x="396" y="692" width="48" height="10" rx="3" fill="#ffcf7a" fill-opacity=".5"/>
</g>
<rect width="540" height="760" fill="none"/>
</svg>`;
  })();

  // 배경 이미지 위의 효과 레이어(이미지 좌표 1024×1336). 시설 네온 외곽선과, 회의장 첨탑 뒤를 가로지르는 함선(앙헬라·바랴그).
  // 시설 건물 외곽선(이미지 좌표). 푸른 네온으로 덧입힌다.
  const NEON = [
    ['hall', 'M516.5 100 L517.4 128 L519.5 151 L522.8 154.7 L524.6 176.4 L528.4 207 L531.7 237.6 L534 268 L535.3 309 L538 330 L544.5 300 L547.5 263 L551.3 283.5 L554.7 309 L559.5 339 L561.8 359.5 L564.2 403.8 L566.9 418.6 L575 410 L580.2 400.9 L584.6 427.5 L589 462.9 L592 495.4 L593.4 519 L600.8 526.4 L612.6 517.5 L616.3 531.7 L620.2 566.9 L624.1 617.6 L627 630 L637 610.6 L641.7 637 L645.6 676 L647.5 700 L652 702 L659.2 691.8 L664.3 666.4 L669 695.7 L672.1 738.7 L676.8 754.3 L684.6 770 L686 773.3 L686.5 779 L676 796 L672 812 L657.8 812.7 L650 818 L643.7 829.7 L635.3 841 L621.2 843.7 L618.4 857.8 L528 863 L490 862 L446 855 L444 832 L432 824 L420 832 L418 852 L397.6 850 L383.8 846.6 L367.3 826 L356.3 808 L340 800 L327 795 L326 777.7 L328.7 770 L336.5 744.5 L338.4 738.7 L342.3 695.7 L343 691.8 L349.4 664.5 L354 691.8 L360 700 L371.6 699 L373.6 637 L379.4 611.8 L385.3 645 L390 650 L395 640 L395 578.6 L399 535.6 L401.5 536.7 L405.3 516 L410 525 L417.7 536.7 L429.5 495 L431 462.9 L434 448 L438.4 403.8 L441.3 384.6 L444.3 389 L450.2 398 L454.6 374 L462 339 L465.9 309 L471 283.5 L474.3 251.6 L479.2 283.5 L484 290 L487.6 283.5 L490.1 237.6 L494 209.6 L501.1 207 L502.9 189 L506.2 166 L510.5 151 L514.9 128 Z'],
    ['rnd', 'M960.6 326 L964.5 354 L969.7 380 L975 390.5 L984 393 L985.4 398.3 L989.3 424.3 L993.2 458 L995.8 497.2 L998.4 549.3 L1000 568 L1024 574 L1024 697.4 L1010.4 701 L993.1 709.8 L978.3 717.2 L963.5 729.5 L953.6 741.9 L946.2 751.7 L936.3 764 L932.6 774 L931.9 783.8 L931.4 800 L900.5 801.1 L894.3 796.2 L884.5 781.4 L874.6 764.1 L867.2 746.8 L868.5 730 L872.1 711 L873.5 669.5 L877.7 628 L886 586.5 L894.3 545 L899.5 531 L904.7 512.8 L912.5 494.6 L922.9 476.4 L930.7 460.8 L938.5 434.7 L943.7 419 L949 401 L950.2 393 L957.2 382.7 L958.8 354 Z'],
    ['archive', 'M1024 697.4 L1024 1085 L899.3 1075.1 L899.3 1053 L885 1048 L870.9 1038 L869.6 1028.2 L862.2 1014.6 L858.5 1008.4 L857.3 1001 L861 983.7 L862.2 971.4 L867.2 961.5 L883.2 961.5 L883.2 860.4 L872.1 855.5 L863.5 848 L861 838.2 L862.2 832 L869.6 823.4 L889.4 816 L906.7 806 L931.4 800 L931.9 783.8 L932.6 774 L936.3 764 L946.2 751.7 L953.6 741.9 L963.5 729.5 L978.3 717.2 L993.1 709.8 L1010.4 701 Z'],
    ['tech', 'M264.2 548 L265.7 590 L266.2 598 L272.4 600 L276 607 L278 615 L282.4 619 L291 622 L293.6 630 L291.8 638.5 L285 642 L280 645 L279.4 650 L279.4 700 L282.4 701 L285.9 657 L287.4 657 L288.9 701 L299.8 703.4 L307.3 706.6 L309 712 L308 718.4 L304.3 721.6 L301.3 723 L301.3 763.7 L302.4 766 L307 771.6 L316 782 L325.2 793 L332.5 799 L333.2 940 L297.4 940 L297.4 916 L295.3 901 L293.1 890 L289.8 875 L282.2 857.6 L271.4 844.6 L258.4 835.9 L238.9 833.8 L238.2 800 L239.8 794.4 L245.5 784.2 L252.3 775 L255.8 764.8 L255.4 721 L251 718.4 L248.7 712 L249.4 704.6 L252 700 L252 648.5 L248.7 645 L243 637 L243.7 626 L248.7 621 L250.4 599.4 L252 599.5 L254.4 606 L257 600.4 L262.9 590 Z'],
    ['command', 'M834 478 L842 500 L848 520 L874 560 L876 566 L862 580 L858 610 L866 640 L866 690 L884 745 L896 790 L898 842 L894 900 L898 953 L856 960 L818 958 L790 955 L780 920 L782 880 L775 845 L786 800 L790 770 L800 720 L806 660 L802 600 L792 575 L790 566 L806 575 L806 560 L812 548 L820 520 L826 500 Z'],
    ['thorium', 'M0 660.9 L18.5 662.4 L46.3 665.5 L68 671.7 L82.7 691.7 L83.4 698 L92.6 704.1 L117.3 710.3 L135.8 719.5 L145.1 728.8 L148.2 744.2 L145.1 750.4 L147 790 L150 830 L161 846 L151.4 853 L151.4 952.4 L160 960 L193.3 968.5 L206.2 981.4 L216.5 997.5 L214.2 1010.4 L193.3 1016.9 L148.2 1023.3 L96.6 1029.7 L0 1039.4 Z']
  ];
  // 시설 지시선: 건물의 연결점(anchor)에서 45° 대각선으로 올라가 평평한 선(shelf)을 만들고, 명판은 그 선 위에 놓인다.
  // 좌표는 배경 이미지 좌표(1024×1336)다. a=건물 연결점, sy=선의 높이, side=명판이 놓일 방향(+1 오른쪽, -1 왼쪽).
  const LEADERS = {
    hall: { a: [516, 300], sy: 263, side: 1, dx: 96, lx: 512 },
    tech: { a: [266, 560], sy: 515, side: -1 },
    command: { a: [778, 800], sy: 740, side: -1 },
    rnd: { a: [899, 530], sy: 480, side: -1 },
    archive: { a: [870, 1038], sy: 985, side: -1, hw: 75 },
    thorium: { a: [193, 1017], sy: 1080, side: 1 }
  };
  // 명판 반폭(이미지 좌표). 선은 명판 폭 전체를 받치도록 명판 아래까지 늘어난다.
  const PLATE_HALF = 100;
  const leaderGeom = id => {
    const L = LEADERS[id], dy = Math.abs(L.a[1] - L.sy), dx = L.dx ?? dy;
    const ex = L.a[0] + L.side * dx;
    const hw = L.hw ?? PLATE_HALF;
    const lx = L.lx ?? Math.min(1024 - hw, Math.max(hw, ex + L.side * hw));
    return { a: L.a, ex, s0: Math.min(ex, lx - hw), s1: Math.max(ex, lx + hw), sy: L.sy, lx };
  };
  const leaderSvg = Object.keys(LEADERS).map(id => {
    const g = leaderGeom(id);
    return `<g class="lead" data-lead="${id}"><path d="M${g.a[0]} ${g.a[1]} L${g.ex} ${g.sy} M${g.s0} ${g.sy} L${g.s1} ${g.sy}"/><circle cx="${g.a[0]}" cy="${g.a[1]}" r="5"/></g>`;
  }).join('');

  // 지나가는 함선: 게임 함선 이미지(옆모습, 원본은 왼쪽을 향함)를 오른쪽을 향하게 뒤집어 쓰고, 꼬리 쪽에 엔진 불꽃을 붙인다.
  const shipFrom = href => `<g class="ship-body"><rect x="-170" y="-4" width="96" height="8" fill="url(#fx-trail)" opacity=".7"/><rect x="-150" y="-1.6" width="76" height="3.2" fill="url(#fx-trail)"/><circle cx="-74" cy="0" r="9" fill="url(#fx-bloom)"/><image href="${esc(href)}" x="-75" y="-25" width="150" height="50" transform="scale(-1,1)" preserveAspectRatio="xMidYMid meet"/></g>`;
  const shipA = shipFrom(SCENE_ASSETS.ships.a), shipB = shipFrom(SCENE_ASSETS.ships.b);
  const fxSvg = `<svg class="union-fx" viewBox="0 0 1024 1336" preserveAspectRatio="none" aria-hidden="true">
<defs>
<linearGradient id="fx-trail" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#9fdcff" stop-opacity=".95"/><stop offset="1" stop-color="#9fdcff" stop-opacity="0"/></linearGradient>
<linearGradient id="fx-hull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f8ff"/><stop offset=".5" stop-color="#b9c8e8"/><stop offset="1" stop-color="#6f84b8"/></linearGradient>
<linearGradient id="fx-pod2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d90bd"/><stop offset="1" stop-color="#34456f"/></linearGradient>
<linearGradient id="fx-wing" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8397c6"/><stop offset="1" stop-color="#dce6fa"/></linearGradient>
<radialGradient id="fx-bloom"><stop offset="0" stop-color="#d8f2ff" stop-opacity=".95"/><stop offset="1" stop-color="#6fc0ff" stop-opacity="0"/></radialGradient>
<filter id="fx-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1336"><feGaussianBlur stdDeviation="7"/></filter>
<mask id="fx-occlude" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1336"><rect width="1024" height="1336" fill="#fff"/>
${NEON.map(([, d]) => `<path fill="#000" d="${d}"/>`).join('')}</mask>
</defs>
<g class="neon">${NEON.map(([id, d]) => `<g class="nz" data-fac="${id}"><path d="${d}" class="nz-glow" filter="url(#fx-glow)"/><path d="${d}" class="nz-fill"/><path d="${d}" class="nz-line"/><path d="${d}" class="nz-hit" data-nz="${id}"/></g>`).join('')}</g>
${leaderSvg}
<g mask="url(#fx-occlude)"><g class="fly fly-a">${shipA}</g><g class="fly fly-b"><g transform="scale(-1,1)">${shipB}</g></g></g>
</svg>`;

  // 살아 있는 도시 레이어(이미지 좌표 1024×1336): 중앙 대로의 빛 파동, 건물 창가 불빛, 낮/밤 변화, 걸어 다니는 사람들
  const LIFE_ROAD = 'M470 870 L556 870 L900 1336 L124 1336 Z';
  const LIFE_WINDOWS = [[512, 640], [470, 720], [556, 720], [512, 800], [262, 700], [270, 820], [96, 760], [70, 900], [120, 980], [930, 620], [960, 820], [960, 880], [940, 980]];
  // 창문 위치(이미지 좌표). window-picker.html로 찍은 목록이다.
  const WINDOW_PTS = [[16,755],[45,756],[22,691],[39,695],[10,999],[205,715],[191,691],[179,664],[166,644],[146,649],[138,655],[121,679],[115,703],[155,676],[142,701],[169,709],[170,689],[284,755],[284,892],[271,892],[251,894],[280,875],[260,875],[250,875],[268,860],[257,860],[256,851],[245,849],[354,843],[339,840],[354,883],[341,882],[592,767],[429,767],[631,765],[434,806],[589,809],[662,804],[369,806],[386,768],[567,727],[457,724],[620,724],[395,728],[351,765],[662,765],[913,679],[913,707],[913,727],[915,746],[915,770],[994,788],[964,792],[973,423],[981,462],[978,496],[979,523],[927,525],[921,555],[915,587],[982,1057],[1009,1060],[939,1057],[892,1002],[939,1005],[970,1011],[1015,1015],[797,831],[819,830],[834,831],[855,830],[758,671],[737,674],[810,570],[834,562],[860,565],[709,815],[707,771],[82,1046],[114,1040],[854,873],[872,872],[67,431],[194,613],[709,845],[712,873],[713,889]];
  const windowLights = `<g class="win-night">${WINDOW_PTS.map(([x, y], i) => `<rect class="wl w${i % 5}" x="${x - 3}" y="${y - 4}" width="6" height="8" rx="1"/>`).join('')}</g>`;
  const lifeSvg = `<svg class="union-life" viewBox="0 0 1024 1336" preserveAspectRatio="none" aria-hidden="true">
<defs>
<clipPath id="life-road"><path d="${LIFE_ROAD}"/></clipPath>
<linearGradient id="life-band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe9ff" stop-opacity="0"/><stop offset=".5" stop-color="#e8f8ff" stop-opacity=".85"/><stop offset="1" stop-color="#bfe9ff" stop-opacity="0"/></linearGradient>
<radialGradient id="life-lamp"><stop offset="0" stop-color="#fff2c4" stop-opacity="1"/><stop offset=".35" stop-color="#ffd27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
<radialGradient id="life-cyan"><stop offset="0" stop-color="#9ff0ff" stop-opacity="1"/><stop offset=".4" stop-color="#3bd0ff" stop-opacity=".5"/><stop offset="1" stop-color="#3bd0ff" stop-opacity="0"/></radialGradient>
</defs>
<rect class="life-dn" width="1024" height="1336" fill="#06133a"/>
<g clip-path="url(#life-road)"><rect class="life-glow" x="500" y="1212" width="24" height="80" fill="url(#life-band)"/><rect class="life-streak" x="508" y="1212" width="8" height="80" fill="url(#life-band)"/><rect class="life-streak s2" x="508" y="1212" width="8" height="80" fill="url(#life-band)"/></g>
<g class="life-rings"><ellipse class="ring r1" cx="512" cy="1292" rx="104" ry="24"/><ellipse class="ring r2" cx="512" cy="1292" rx="104" ry="24"/></g>
<clipPath id="glass-clip">${NEON.map(([, d]) => `<path d="${d}"/>`).join('')}</clipPath>
<linearGradient id="glass-sheen-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d6f7ff" stop-opacity="0"/><stop offset=".5" stop-color="#d6f7ff" stop-opacity=".32"/><stop offset="1" stop-color="#d6f7ff" stop-opacity="0"/></linearGradient>
<g class="glass" clip-path="url(#glass-clip)"><g class="glass-night"><rect class="glass-tint" width="1024" height="1336" fill="#a8f0ff"/></g><rect class="glass-sheen" x="-500" y="0" width="360" height="1336" fill="url(#glass-sheen-g)"/></g>
${windowLights}
</svg>`;
  const sceneInner = () => SCENE_ASSETS.background
    ? `<img class="union-bg" src="${esc(SCENE_ASSETS.background)}" alt="" draggable="false"/>${lifeSvg}${fxSvg}`
    : sceneSvg;

  function hubHtml(union, canManage) {
    const pending = union && canManage ? union.applications.length : 0;
    const exp = union ? Math.min(100, Math.round(union.exp % 1000 / 10)) : 0;
    const status = `<div class="ub-crest">${crestSvg(union ? union.emblem : '⊕')}</div><div class="ub-main"><small class="ub-kicker">EARTH UNION · 지구연합</small><b class="ub-name">${esc(union ? union.name : '지구연합')}</b>${union
      ? `<div class="ub-meta"><span class="ub-lv">Lv.${union.level}</span><span>연합원 <em>${union.members.length}</em>/${union.capacity}</span></div><div class="ub-exp" aria-label="연합 경험치 ${exp}%"><i style="width:${exp}%"></i></div>`
      : `<div class="ub-meta"><span>회의장에서 연합에 가입하거나 창설하세요</span></div>`}</div>`;
    const plaques = FACILITIES.map(f => `<button type="button" class="union-plaque${f.ready ? '' : ' soon'}${f.id === 'archive' ? ' short' : ''}" style="--lx:${leaderGeom(f.id).lx};--ly:${leaderGeom(f.id).sy}" data-view="${f.id}" aria-label="${f.name}"><b>${f.name}</b>${f.id === 'hall' && pending ? `<i class="dot" aria-label="가입 신청 ${pending}건">${pending}</i>` : ''}</button>`).join('');
    return `<div class="union-status union-banner">${status}</div><div class="union-scene"><div class="union-stage">${sceneInner()}</div>${plaques}</div>`;
  }

  // 장면을 하단 메뉴 바로 위까지 채운다(남는 세로 공간 사용). 이미지는 가운데 기준으로 확대되어 빈틈 없이 채워진다.
  function fitScene() {
    const scene = document.querySelector('#earth-union .union-scene');
    if (!scene || !scene.getBoundingClientRect().width) return;
    const menu = document.querySelector('#persistent-hud .fixed-nav') || document.querySelector('button[data-screen]')?.parentElement;
    const bottom = menu && menu.getBoundingClientRect().top > 0 ? menu.getBoundingClientRect().top : window.innerHeight;
    const hudBottom = document.querySelector('#persistent-hud .fixed-top')?.getBoundingClientRect().bottom || 96;
    scene.closest('.union-panel')?.style.setProperty('--hud', `${Math.round(hudBottom)}px`);
    scene.style.height = `${Math.max(360, Math.round(bottom - hudBottom))}px`;
    // 화면 하단 여백 때문에 페이지가 스크롤되면 그만큼 줄인다
    const over = document.documentElement.scrollHeight - window.innerHeight;
    if (over > 0) scene.style.height = `${Math.max(360, scene.getBoundingClientRect().height - over)}px`;
  }
  window.addEventListener('resize', fitScene);

  // ───────── 시설 화면(미리보기) ─────────
  // 기능은 아직 없고 화면 구성만 잡아 둔 상태다. 숫자는 모두 예시이며, 버튼은 '준비 중'으로 잠겨 있다.
  const previewTag = '<em class="fac-tag">미리보기 · 준비 중</em>';
  const gauge = (pct, big, small) => `<div class="fac-gauge" style="--p:${pct}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" class="g-track"/><circle cx="60" cy="60" r="50" class="g-fill" pathLength="100" stroke-dasharray="${pct} 100"/></svg><div><b>${big}</b><small>${small}</small></div></div>`;
  const bar = (pct, label = '') => `<div class="fac-bar"><i style="width:${pct}%"></i>${label ? `<span>${label}</span>` : ''}</div>`;
  const stars = n => `<span class="fac-stars">${'★'.repeat(n)}<s>${'★'.repeat(5 - n)}</s></span>`;

  const FACILITY_SCREENS = {
    thorium: () => `${heroHtml('thorium', '토륨 분배기', previewTag)}
${panel('연합 토륨 저장고 <small>RESERVOIR</small>', `<div class="fac-split">${gauge(68, '34,000', '/ 50,000')}<ul class="fac-stats"><li><span>시간당 생산</span><b>+1,200</b></li><li><span>다음 분배까지</span><b class="mono">04:12:30</b></li><li><span>분배 대상</span><b>연합원 전원</b></li></ul></div>`)}
${panel('나의 분배 몫 <small>MY SHARE</small>', `<div class="fac-claim"><div><span>기여도 비례 예상 수령량</span><b>≈ 850 <small>토륨</small></b></div>${soonBtn('수령하기')}</div>${bar(42, '이번 주기 기여도 42%')}`)}
${panel('분배 기록 <small>LOG</small>', `<ul class="fac-log"><li><span>어제 21:00</span><b>정기 분배</b><em>+820</em></li><li><span>어제 09:00</span><b>정기 분배</b><em>+760</em></li><li><span>2일 전</span><b>연합 보너스</b><em>+1,200</em></li></ul>`)}`,

    tech: () => `${heroHtml('tech', '기술협력소', previewTag)}
${panel('오늘의 지원 <small>SUPPORT</small>', `<div class="fac-claim"><div><span>남은 지원 횟수</span><b>7 <small>/ 10</small></b></div><div><span>지원 1회당 단축</span><b>−3% <small>남은 시간</small></b></div></div>${bar(30, '지원 보상 진행도 3/10')}`)}
${panel('지원 요청 <small>REQUESTS</small>', ['Sora|함포 출력 강화 Lv.3|02:41:10|62|5/8', 'Kade|보호막 증폭 Lv.2|05:12:44|25|2/8', 'Mira|추진기 개량 Lv.4|00:48:03|88|7/8'].map(row => { const [who, what, left, pct, help] = row.split('|'); return `<div class="fac-card"><div class="fac-card-head"><b>${what}</b><span>${who}</span></div>${bar(pct)}<div class="fac-card-foot"><span>남은 시간 <b class="mono">${left}</b></span><span>지원 ${help}</span>${soonBtn('지원')}</div></div>`; }).join(''))}
${panel('나의 연구 <small>MY RESEARCH</small>', `<div class="fac-empty"><p>진행 중인 연구가 없습니다.<br>연구를 시작하면 연합원에게 지원을 요청할 수 있습니다.</p>${soonBtn('지원 요청 보내기')}</div>`)}`,

    command: () => window.UnionCommand?.screen(heroHtml('command', '연합사령부')) ?? heroHtml('command', '연합사령부'),
    rnd: () => `${heroHtml('rnd', '연합 R&D센터', previewTag)}
${panel('연합 연구 포인트 <small>RESEARCH POINTS</small>', `<div class="fac-claim"><div><span>보유 RP</span><b>12,400 <small>RP</small></b></div><div><span>이번 주 적립</span><b>+3,150</b></div></div>`)}
${panel('함대 연구 트리 <small>TECH TREE</small>', `<div class="fac-tree">${[['화력', [['함포 출력', 2], ['미사일 장전', 1], ['광선 집속', 0]]], ['방어', [['장갑 강화', 3], ['보호막 증폭', 0], ['피해 분산', 0]]], ['기동', [['추진기 개량', 1], ['회피 기동', 0], ['도약 항법', 0]]]].map(([col, nodes]) => `<div class="fac-tree-col"><h4>${col}</h4>${nodes.map(([n, lv], i) => `<div class="fac-node${lv ? '' : ' locked'}"><b>${n}</b><span class="pips">${Array.from({ length: 5 }, (_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('')}</span><small>Lv.${lv}/5</small></div>${i < nodes.length - 1 ? '<span class="fac-link"></span>' : ''}`).join('')}</div>`).join('')}</div>`)}
${panel('진행 중인 연구 <small>IN PROGRESS</small>', `<div class="fac-card"><div class="fac-card-head"><b>장갑 강화 Lv.4</b><span>연합 공동 연구</span></div>${bar(42)}<div class="fac-card-foot"><span>완료까지 <b class="mono">11:20:05</b></span>${soonBtn('RP 투입')}</div></div>`)}`,

    archive: () => `${heroHtml('archive', '기록관', previewTag)}
${panel('시뮬레이션 작전 <small>SIMULATIONS</small>', [['미드웨이 해전', 3, '항모 기동부대 격파', 'A'], ['트라팔가르 해전', 2, '전열 돌파 작전', 'B'], ['명량 해전', 4, '13척으로 버텨라', '—'], ['레이테만 해전', 5, '최대 규모 함대전', '—']].map(([name, lv, desc, best]) => `<div class="fac-op"><div class="fac-op-main"><b>${name}</b><span>${desc}</span>${stars(lv)}</div><div class="fac-op-side"><span>최고 기록</span><b class="grade grade-${best === '—' ? 'none' : best}">${best}</b>${soonBtn('출격')}</div></div>`).join(''))}
${panel('기록 보상 <small>REWARDS</small>', `<div class="fac-tiers"><div class="tier s"><b>S</b><span>토륨 2,000</span></div><div class="tier a"><b>A</b><span>토륨 1,200</span></div><div class="tier b"><b>B</b><span>토륨 600</span></div></div>`)}
${panel('연합 기록 순위 <small>LEADERBOARD</small>', `<ol class="fac-rank"><li><i>1</i><b>Sora</b><span>미드웨이 S</span></li><li><i>2</i><b>Kade</b><span>트라팔가르 A</span></li><li><i>3</i><b>Mira</b><span>미드웨이 A</span></li></ol>`)}`
  };
  function facilityHtml(f) {
    const screen = FACILITY_SCREENS[f.id];
    return `<div class="fac fac-${f.id}">${screen ? screen() : `${heroHtml(f.id, f.name, previewTag)}${panel(f.name, `<p>${esc(f.desc)}</p>`)}`}</div>`;
  }

  function memberHtml(union, me) {
    const myRole = union.members.find(m => m.playerId === me.playerId)?.role || 'member';
    const canManage = myRole === 'leader' || myRole === 'officer';
    const pending = canManage ? union.applications.length : 0;
    const exp = Math.min(100, Math.round(union.exp % 1000 / 10));
    const online = union.members.filter(m => Date.now() - Number(m.lastSeen || 0) < 5 * 60000).length;
    const total = union.members.reduce((sum, m) => sum + (Number(m.contribution) || 0), 0);
    const tabs = [['hall', '함대 명단'], ['apps', `입대 신청${pending ? ` <i class="tab-dot">${pending}</i>` : ''}`]];
    const body = ui.tab === 'apps' ? applicationsHtml(union, canManage) : hallHtml(union, me);
    const command = `<section class="hall-command"><div class="hall-crest">${crestSvg(union.emblem)}</div><div class="hall-id"><small>UNION FLAGSHIP COMMAND</small><h3>${esc(union.name)}${union.trial ? '<em class="trial-tag">체험</em>' : ""}</h3><div class="hall-lv"><span class="ub-lv">Lv.${union.level}</span><div class="ub-exp"><i style="width:${exp}%"></i></div><em>${exp}%</em></div></div></section><div class="hall-stats"><div><span>연합원</span><b>${union.members.length}<small>/${union.capacity}</small></b></div><div><span>접속 중</span><b class="on">${online}</b></div><div><span>총 기여</span><b>${num(total)}</b></div></div>`;
    return `<div class="fac fac-hall">${heroHtml('hall', '회의장')}${command}<nav class="union-tabs fac-tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" aria-selected="${ui.tab === id}" data-tab="${id}">${label}</button>`).join('')}</nav><div class="union-body">${body}</div></div>`;
  }

  function joinHtml(list) {
    const items = list.map(u => {
      const full = u.memberCount >= u.capacity;
      return `<li class="union-card fac-union-card"><div class="card-crest">${crestSvg(u.emblem, { wings: false })}</div><div class="union-card-main"><b>${esc(u.name)}</b><span><em class="ub-lv">Lv.${u.level}</em> 연합원 ${u.memberCount}/${u.capacity} · ${u.joinMode === 'approval' ? '승인 가입' : '자유 가입'}</span><small>${esc(u.notice)}</small></div><button type="button" class="fac-btn small" data-join="${esc(u.id)}"${full ? ' disabled' : ''}>${full ? '정원 마감' : u.joinMode === 'approval' ? '가입 신청' : '가입'}</button></li>`;
    }).join('');
    return `<div class="union-search"><input type="search" data-query value="${esc(ui.query)}" placeholder="연합 이름 검색" maxlength="12" aria-label="연합 이름 검색"/></div><ul class="union-cards">${items || '<li class="union-empty">검색 결과가 없습니다.</li>'}</ul>`;
  }

  // 엠블럼 꾸미기: 외부 장식 · 방패 모양 · 내부 문양을 고르고, 방패·금속·문양 색을 따로 바꾼다.
  function emblemDesigner(d, target = 'draft') {
    const U = window.UnionEmblem;
    if (!U) return `<div class="union-field"><span>휘장 문양</span><div class="union-emblems">${EMBLEMS.map(e => `<button type="button" data-emblem="${e}" aria-pressed="${d.emblem === e}">${e}</button>`).join('')}</div></div>`;
    const cur = U.normalize(d.emblem);
    const opts = (part, list, wings = false) => list.map(item => `<button type="button" class="em-opt" data-em-target="${target}" data-em-part="${part}" data-em-value="${item.id}" aria-pressed="${cur[part] === item.id}" aria-label="${item.name}" title="${item.name}">${U.svg({ ...cur, [part]: item.id }, { wings })}<small>${item.name}</small></button>`).join('');
    const swatches = (part, list) => list.map(item => `<button type="button" class="em-swatch" data-em-target="${target}" data-em-part="${part}" data-em-value="${item.id}" aria-pressed="${cur[part] === item.id}" aria-label="${item.name}" title="${item.name}" style="--c1:${item.stops[0]};--c2:${item.stops[1]};--c3:${item.stops[2] || item.stops[1]}"></button>`).join('');
    return `<div class="em-designer"><div class="em-group"><span>외부 장식</span><div class="em-row em-wings">${opts('w', U.WINGS, true)}</div></div><div class="em-group"><span>방패 모양</span><div class="em-row">${opts('s', U.SHIELDS)}</div></div><div class="em-group"><span>내부 문양</span><div class="em-row">${opts('i', U.ICONS)}</div></div><div class="em-group"><span>방패 색</span><div class="em-swatches">${swatches('f', U.FIELD)}</div></div><div class="em-group"><span>장식·테두리 색</span><div class="em-swatches">${swatches('m', U.METALS)}</div></div><div class="em-group"><span>문양 색</span><div class="em-swatches">${swatches('c', U.ICON_COLORS)}</div></div><button type="button" class="em-random" data-em-target="${target}" data-em-random>무작위 조합</button></div>`;
  }

  function createHtml() {
    const d = ui.draft;
    return `<form class="union-form fac-panel" data-create><div class="create-preview">${crestSvg(d.emblem)}</div><label class="union-field"><span>연합 이름 (2~12자)</span><input data-name value="${esc(d.name)}" maxlength="12" autocomplete="off"/></label>${emblemDesigner(d)}<label class="union-field"><span>가입 방식</span><select data-create-mode><option value="open"${d.joinMode === 'open' ? ' selected' : ''}>자유 가입</option><option value="approval"${d.joinMode === 'approval' ? ' selected' : ''}>승인 가입</option></select></label><label class="union-field"><span>지휘 브리핑 (선택)</span><textarea data-create-notice maxlength="120" rows="2">${esc(d.notice)}</textarea></label><p class="union-hint">창설 비용: 토륨 ${COSTS.create} (보유 ${thoriumBalance().toLocaleString('ko-KR')})</p><button type="submit" class="fac-btn">연합 창설 · 토륨 ${COSTS.create}</button></form>`;
  }

  function noUnionHtml(list) {
    return `<div class="fac fac-hall"><header class="join-head"><small>EARTH UNION · 지구연합</small><h2>연합 가입 / 연합 창설</h2><span>연합에 가입해 함께 성장하세요</span></header><p class="union-lead">연합에 가입하면 연합원과 함께 토륨을 나누고, 연구와 개발을 서로 도울 수 있습니다.</p><nav class="union-tabs fac-tabs" role="tablist"><button type="button" role="tab" aria-selected="${ui.mode === 'join'}" data-mode="join">연합 가입</button><button type="button" role="tab" aria-selected="${ui.mode === 'create'}" data-mode="create">연합 창설</button></nav><div class="union-body">${ui.mode === 'create' ? createHtml() : joinHtml(list)}</div></div>`;
  }

  let rendering = false, again = false;
  async function render() {
    const host = root(); if (!host) return;
    if (rendering) { again = true; return; }
    rendering = true;
    try {
      const api = adapter(), me = await api.me(), union = await api.getMyUnion();
      host.className = 'union-panel union-live';
      const myRole = union?.members.find(m => m.playerId === me.playerId)?.role;
      // 화면 전환 때 남아 있는 스크롤 위치를 맨 위로 되돌려, 광장 화면이 위로 밀리지 않게 한다.
      const screenEl = document.getElementById("earth-union");
      const keep = ui.restoreScroll; ui.restoreScroll = null;
      if (!keep) {
        if (screenEl) screenEl.scrollTop = 0;
        if (window.scrollY) window.scrollTo(0, 0);
      }
      // 연합이 없으면 광장(건물 배경) 대신 연합 가입 / 연합 창설 화면을 바로 보여준다.
      if (!union && (ui.view === "hub" || ui.view === "hall")) host.innerHTML = noUnionHtml(await api.searchUnions(ui.query));
      else if (ui.view === "hub") host.innerHTML = hubHtml(union, myRole === "leader" || myRole === "officer");
      else if (ui.view === "hall") host.innerHTML = memberHtml(union, me);
      else host.innerHTML = facilityHtml(facility(ui.view) || FACILITIES[1]);
      bind(host, union, me);
      if (keep) { if (screenEl) screenEl.scrollTop = keep.y; window.scrollTo(0, keep.wy); }
      fitScene(); requestAnimationFrame(fitScene);
    } catch (error) {
      host.innerHTML = `<h1>지구연합</h1><p>연합 정보를 불러오지 못했습니다.</p>`;
    } finally { rendering = false; if (again) { again = false; render(); } }
  }

  function bind(host, union, me) {
    const on = (selector, handler, event = 'click') => host.querySelectorAll(selector).forEach(el => el.addEventListener(event, handler));
    // 건물 외곽선을 누르면 외곽선이 잠깐 켜진 뒤 해당 시설 화면으로 간다
    on('[data-nz]', e => {
      const id = e.currentTarget.dataset.nz;
      host.querySelector(`.nz[data-fac="${id}"]`)?.classList.add('on');
      setTimeout(() => { ui.view = id; ui.tab = 'hall'; ui.menuFor = ''; render(); }, 480);
    });
    on('[data-view]', e => { ui.view = e.currentTarget.dataset.view; ui.tab = 'hall'; ui.menuFor = ''; render(); });
    on('[data-tab]', e => { ui.tab = e.currentTarget.dataset.tab; ui.menuFor = ''; render(); });
    on('[data-mode]', e => { ui.mode = e.currentTarget.dataset.mode; render(); });
    on('[data-query]', e => { ui.query = e.currentTarget.value; render().then(() => { const input = root()?.querySelector('[data-query]'); input?.focus(); input?.setSelectionRange(ui.query.length, ui.query.length); }); }, 'change');
    on('[data-join]', e => run(() => adapter().joinUnion(e.currentTarget.dataset.join), r => r === 'applied' ? '가입 신청을 보냈습니다.' : '연합에 가입했습니다.'));
    const rememberScroll = () => { ui.restoreScroll = { y: document.getElementById('earth-union')?.scrollTop || 0, wy: window.scrollY || 0 }; };
    const emHolder = el => (el.dataset.emTarget === 'edit' ? ui.edit : ui.draft);
    on('[data-em-part]', e => { rememberScroll(); const holder = emHolder(e.currentTarget); if (!holder) return; const cur = window.UnionEmblem.normalize(holder.emblem); holder.emblem = { ...cur, [e.currentTarget.dataset.emPart]: e.currentTarget.dataset.emValue }; syncDraft(host); render(); });
    on('[data-em-random]', e => { rememberScroll(); const holder = emHolder(e.currentTarget); if (!holder) return; holder.emblem = window.UnionEmblem.random(); syncDraft(host); render(); });
    on('[data-em-edit]', () => { ui.edit = { emblem: window.UnionEmblem.normalize(union.emblem) }; render(); });
    on('[data-em-cancel]', () => { ui.edit = null; render(); });
    on('[data-em-apply]', async () => {
      try { await adapter().updateEmblem(ui.edit.emblem); notify(`엠블럼을 변경했습니다. (토륨 ${COSTS.emblem} 사용)`); ui.edit = null; }
      catch (error) { notify(error.message || '엠블럼을 변경하지 못했습니다.'); }
      render();
    });
    on('[data-emblem]', e => { ui.draft.emblem = e.currentTarget.dataset.emblem; syncDraft(host); render(); });
    on('[data-create]', e => { e.preventDefault(); syncDraft(host); run(() => adapter().createUnion(ui.draft), '연합을 창설했습니다.').then(() => { ui.draft = { name: '', emblem: EMBLEMS[0], notice: '', joinMode: 'open' }; ui.tab = 'hall'; }); }, 'submit');
    on('[data-save-notice]', () => run(() => adapter().updateUnion({ notice: host.querySelector('[data-notice]').value }), '공지를 저장했습니다.'));
    on('[data-joinmode]', e => run(() => adapter().updateUnion({ joinMode: e.currentTarget.value }), '가입 방식을 바꿨습니다.'), 'change');
    on('[data-more]', e => { const id = e.currentTarget.dataset.more; ui.menuFor = ui.menuFor === id ? '' : id; render(); });
    on('[data-role]', e => { const [id, role] = e.currentTarget.dataset.role.split(':'); run(() => adapter().setRole(id, role), '직책을 바꿨습니다.'); });
    on('[data-transfer]', e => run(() => adapter().transferLeader(e.currentTarget.dataset.transfer), '연합장을 위임했습니다.'));
    on('[data-kick]', e => run(() => adapter().kick(e.currentTarget.dataset.kick), '연합원을 추방했습니다.'));
    on('[data-approve]', e => run(() => adapter().handleApplication(e.currentTarget.dataset.approve, true), '가입을 수락했습니다.'));
    on('[data-reject]', e => run(() => adapter().handleApplication(e.currentTarget.dataset.reject, false), '신청을 거절했습니다.'));
    on('[data-leave]', () => run(() => adapter().leaveUnion(), '연합을 탈퇴했습니다.'));
    on('[data-disband]', () => run(() => adapter().disband(), '연합을 해체했습니다.'));
  }
  function syncDraft(host) {
    const name = host.querySelector('[data-name]'), mode = host.querySelector('[data-create-mode]'), notice = host.querySelector('[data-create-notice]');
    if (name) ui.draft.name = name.value; if (mode) ui.draft.joinMode = mode.value; if (notice) ui.draft.notice = notice.value;
  }

  window.addEventListener('game-screen-changed', e => { if (e.detail?.screen === 'earth-union') { ui.view = 'hub'; ui.tab = 'hall'; ui.menuFor = ''; render(); } });
  // 연합 활동 보상 배율: 체험 연합은 50%, 정식 연합은 100%. 화성 10관문 뒤 에바-9 안내가 끝나면 체험 연합을 연다.
  window.unionRewardRate = () => { try { return Local.__rewardRate(); } catch { return 1; } };
  window.renderUnionScreen = () => render();
  window.openUnionFacility = id => { ui.view = id; ui.tab = 'hall'; ui.menuFor = ''; render(); };
  window.unlockTrialUnion = () => Local.__unlockTrial();
  window.UnionLocal = Local; // 테스트와 서버 어댑터 작성 시 참고용
})();
