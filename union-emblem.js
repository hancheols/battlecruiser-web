// 연합 엠블럼 — 외부 장식(날개 등) · 방패 모양 · 내부 문양을 고르고, 방패·금속·문양 색을 따로 바꿔 만든다.
// 엠블럼 값은 { w: 장식, s: 방패, i: 문양, f: 방패색, m: 금속색, c: 문양색 } 객체이며, 옛 글리프 문자('⊕' 등)도 받아서 같은 모양의 객체로 바꿔 준다.
(() => {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  // ───────── 색 ─────────
  // 방패 바탕: [중심, 중간, 가장자리]
  const FIELD = [
    { id: 'blue', name: '청색', stops: ['#2f6fd6', '#0d2a66', '#050f2e'] },
    { id: 'crimson', name: '진홍', stops: ['#d24a55', '#6e1224', '#2a0510'] },
    { id: 'emerald', name: '에메랄드', stops: ['#2fc48a', '#0b5a45', '#032218'] },
    { id: 'violet', name: '보라', stops: ['#8f6bff', '#3a1f8a', '#12083a'] },
    { id: 'teal', name: '청록', stops: ['#2ec9d6', '#0a5f78', '#031f2e'] },
    { id: 'amber', name: '호박', stops: ['#e0a53a', '#7a4a0a', '#2a1503'] },
    { id: 'onyx', name: '흑요', stops: ['#4a5470', '#1a2036', '#080b16'] },
    { id: 'ivory', name: '상아', stops: ['#f4efe2', '#b9ae94', '#6b6250'] }
  ];
  // 테두리·날개 금속: [밝음, 중간, 어둠, 외곽선]
  const METALS = [
    { id: 'silver', name: '은', stops: ['#f4fbff', '#9fc3e8', '#5b7fb0', '#2c4f86'] },
    { id: 'gold', name: '금', stops: ['#fff1c2', '#e6b64a', '#8a5a12', '#6b430a'] },
    { id: 'bronze', name: '청동', stops: ['#f2c9a0', '#b8733a', '#5e3015', '#4a230d'] },
    { id: 'ice', name: '빙청', stops: ['#e8fcff', '#6fdcf2', '#2a8fb0', '#12607f'] },
    { id: 'obsidian', name: '흑철', stops: ['#cbd2e6', '#5a6384', '#1c2036', '#0c0f1e'] },
    { id: 'rose', name: '장미금', stops: ['#ffe3ee', '#e58aae', '#8a3258', '#6b1f43'] }
  ];
  // 내부 문양 색: [밝음, 기본]
  const ICON_COLORS = [
    { id: 'white', name: '백색', stops: ['#ffffff', '#cfe9ff'] },
    { id: 'gold', name: '황금', stops: ['#fff3c4', '#ffc94a'] },
    { id: 'cyan', name: '하늘', stops: ['#e6fdff', '#4fe0ff'] },
    { id: 'red', name: '적색', stops: ['#ffd9d9', '#ff5a5a'] },
    { id: 'green', name: '연두', stops: ['#e4ffe9', '#4fe08a'] },
    { id: 'violet', name: '연보라', stops: ['#f0e6ff', '#b48aff'] },
    { id: 'black', name: '먹색', stops: ['#59607a', '#1a1e30'] }
  ];

  // ───────── 외부 장식 (왼쪽 날개 모양. 오른쪽은 좌우 반전) ─────────
  const leafWing = () => {
    let leaves = '';
    for (let i = 0; i < 9; i += 1) {
      const t = i / 8;
      const x = 42 - 22 * Math.sin(Math.PI * t) + 2;
      const y = 14 + 72 * t;
      const angle = -70 + t * 140;
      leaves += `<path d="M0 0 C3 -6 11 -7 15 0 C11 7 3 6 0 0 Z" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(angle + 180).toFixed(0)})"/>`;
    }
    return leaves;
  };
  const WINGS = [
    { id: 'feather', name: '은빛 깃', body: '<path d="M44 44 C33 33 18 31 3 35 C15 39 22 42 29 46 C17 46 9 50 3 57 C17 57 29 55 38 53 C29 57 22 62 18 68 C30 66 38 61 44 56 Z"/>' },
    { id: 'eagle', name: '독수리', body: '<path d="M44 36 L30 24 L22 30 L10 22 L12 34 L2 36 L14 42 L6 52 L18 52 L12 64 L28 58 L44 62 Z"/>' },
    { id: 'flame', name: '불꽃', body: '<path d="M44 70 C30 68 22 58 26 44 C28 52 34 54 36 50 C30 42 32 30 40 22 C38 32 44 38 46 46 Z"/><path d="M44 78 C32 80 22 74 14 62 C24 68 32 68 40 63 Z"/>' },
    { id: 'blade', name: '칼날', body: '<path d="M44 30 L26 20 L6 14 L24 28 L2 34 L24 38 L8 50 L28 48 L16 62 L36 56 L44 66 Z"/>' },
    { id: 'mech', name: '기계', body: '<path d="M44 28 H28 V36 H16 V44 H6 V54 H16 V62 H28 V70 H44 Z"/>' },
    { id: 'horn', name: '뿔', body: '<path d="M44 66 C24 68 8 54 6 24 C18 38 32 42 44 40 Z"/><path d="M44 78 C30 82 18 76 12 64 C22 71 34 73 44 71 Z"/>' },
    { id: 'laurel', name: '월계수', body: leafWing() },
    { id: 'none', name: '없음', body: '' }
  ];

  // ───────── 방패 ─────────
  const SHIELDS = [
    { id: 'classic', name: '기본형', top: true, d: 'M60 8 L88 19 L88 52 C88 70 75 83 60 93 C45 83 32 70 32 52 L32 19 Z' },
    { id: 'kite', name: '곡선형', top: true, d: 'M60 8 C75 8 88 14 88 26 L84 56 C82 72 72 84 60 94 C48 84 38 72 36 56 L32 26 C32 14 45 8 60 8 Z' },
    { id: 'round', name: '원형', top: false, d: 'M60 12 A40 40 0 1 1 59.99 12 Z' },
    { id: 'hex', name: '육각형', top: false, d: 'M60 8 L94 28 L94 68 L60 94 L26 68 L26 28 Z' },
    { id: 'diamond', name: '마름모', top: false, d: 'M60 6 L92 52 L60 96 L28 52 Z' },
    { id: 'tower', name: '요새형', top: true, d: 'M34 12 L86 12 L86 62 L60 92 L34 62 Z' }
  ];

  // ───────── 내부 문양 (24×24 칸 안에 그린다) ─────────
  const ICONS = [
    { id: 'star', name: '별', draw: P => `<path d="M12 2 L14.9 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.1 8.6 Z" fill="${P}"/>` },
    { id: 'planet', name: '행성', draw: P => `<circle cx="12" cy="12" r="5.2" fill="${P}"/><ellipse cx="12" cy="12" rx="10.5" ry="3.6" transform="rotate(-22 12 12)" fill="none" stroke="${P}" stroke-width="1.8"/>` },
    { id: 'comet', name: '혜성', draw: P => `<circle cx="16.5" cy="7.5" r="4" fill="${P}"/><path d="M13.5 10.5 L3 21 M11 7 L2.5 10 M17 13.5 L14 22" fill="none" stroke="${P}" stroke-width="1.8" stroke-linecap="round"/>` },
    { id: 'crown', name: '왕관', draw: P => `<path d="M3 19 L3 8 L8 12.5 L12 5 L16 12.5 L21 8 L21 19 Z" fill="${P}"/><rect x="3" y="20.2" width="18" height="2" fill="${P}"/>` },
    { id: 'anchor', name: '닻', draw: P => `<g fill="none" stroke="${P}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.2"/><path d="M12 7.2 V21 M7.5 11 H16.5 M4.5 15 C5.5 19.5 9 21 12 21 C15 21 18.5 19.5 19.5 15"/></g>` },
    { id: 'swords', name: '쌍검', draw: P => `<g fill="none" stroke="${P}" stroke-width="2.2" stroke-linecap="round"><path d="M5 4 L19 18 M19 4 L5 18 M7.4 13.4 L4.6 16.2 M16.6 13.4 L19.4 16.2 M10.2 8 L7.6 10.6 M13.8 8 L16.4 10.6"/></g>` },
    { id: 'atom', name: '원자', draw: P => `<g fill="none" stroke="${P}" stroke-width="1.6"><ellipse cx="12" cy="12" rx="10" ry="3.8"/><ellipse cx="12" cy="12" rx="10" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="3.8" transform="rotate(120 12 12)"/></g><circle cx="12" cy="12" r="2.2" fill="${P}"/>` },
    { id: 'eye', name: '눈', draw: P => `<path d="M1.5 12 C6 5.5 18 5.5 22.5 12 C18 18.5 6 18.5 1.5 12 Z" fill="none" stroke="${P}" stroke-width="1.8"/><circle cx="12" cy="12" r="3.2" fill="${P}"/>` },
    { id: 'bolt', name: '번개', draw: P => `<path d="M13 2 L5 13 H11 L9 22 L19 9 H13 Z" fill="${P}"/>` },
    { id: 'rocket', name: '로켓', draw: P => `<path d="M12 2 C15.5 5.5 16.5 11 15 16 H9 C7.5 11 8.5 5.5 12 2 Z" fill="${P}"/><path d="M9 14 L5 19 L9 18 Z M15 14 L19 19 L15 18 Z M10.5 17 L12 22 L13.5 17 Z" fill="${P}"/>` },
    { id: 'flag', name: '깃발', draw: P => `<path d="M5.5 3 V22" fill="none" stroke="${P}" stroke-width="2" stroke-linecap="round"/><path d="M6.5 4 H19 L15.5 8.5 L19 13 H6.5 Z" fill="${P}"/>` },
    { id: 'castle', name: '성채', draw: P => `<path d="M3.5 21 V9.5 H6.5 V6.5 H9.5 V9.5 H14.5 V6.5 H17.5 V9.5 H20.5 V21 Z" fill="${P}"/><path d="M10 21 V15.5 C10 13.5 14 13.5 14 15.5 V21 Z" fill="#0a1230"/>` },
    { id: 'sun', name: '태양', draw: P => {
      let rays = '';
      for (let i = 0; i < 8; i += 1) {
        const a = i * Math.PI / 4;
        rays += `M${(12 + 6.8 * Math.cos(a)).toFixed(1)} ${(12 + 6.8 * Math.sin(a)).toFixed(1)} L${(12 + 10.4 * Math.cos(a)).toFixed(1)} ${(12 + 10.4 * Math.sin(a)).toFixed(1)} `;
      }
      return `<circle cx="12" cy="12" r="4.6" fill="${P}"/><path d="${rays}" fill="none" stroke="${P}" stroke-width="2" stroke-linecap="round"/>`;
    } }
  ];

  const find = (list, id) => list.find(item => item.id === id);
  const ids = list => list.map(item => item.id);

  // ───────── 값 정리 ─────────
  // 옛 글리프 엠블럼('⊕' 등)을 같은 느낌의 새 엠블럼으로 바꾼다.
  const LEGACY = {
    '⊕': { w: 'feather', s: 'classic', i: 'planet', f: 'blue', m: 'silver', c: 'white' },
    '✦': { w: 'feather', s: 'classic', i: 'star', f: 'blue', m: 'silver', c: 'white' },
    '⬢': { w: 'mech', s: 'hex', i: 'atom', f: 'teal', m: 'ice', c: 'cyan' },
    '☄': { w: 'flame', s: 'kite', i: 'comet', f: 'violet', m: 'silver', c: 'white' },
    '⚑': { w: 'blade', s: 'tower', i: 'flag', f: 'crimson', m: 'gold', c: 'gold' },
    '♜': { w: 'laurel', s: 'tower', i: 'castle', f: 'onyx', m: 'obsidian', c: 'white' }
  };
  const DEFAULT = LEGACY['⊕'];

  function normalize(value) {
    const source = typeof value === 'string' ? (LEGACY[value] || DEFAULT) : (value && typeof value === 'object' ? value : DEFAULT);
    const pick = (key, list) => (ids(list).includes(source[key]) ? source[key] : DEFAULT[key]);
    return { w: pick('w', WINGS), s: pick('s', SHIELDS), i: pick('i', ICONS), f: pick('f', FIELD), m: pick('m', METALS), c: pick('c', ICON_COLORS) };
  }

  const random = () => {
    const any = list => list[Math.floor(Math.random() * list.length)].id;
    return { w: any(WINGS), s: any(SHIELDS), i: any(ICONS), f: any(FIELD), m: any(METALS), c: any(ICON_COLORS) };
  };

  // ───────── 그리기 ─────────
  let seq = 0;
  function svg(value, { wings = true } = {}) {
    const e = normalize(value);
    const k = `ue${++seq}`;
    const field = find(FIELD, e.f).stops, metal = find(METALS, e.m).stops, iconColor = find(ICON_COLORS, e.c).stops;
    const wing = find(WINGS, e.w), shield = find(SHIELDS, e.s), icon = find(ICONS, e.i);
    const iconScale = e.s === 'diamond' ? 1.25 : e.s === 'round' ? 1.45 : 1.55;
    const wingMarkup = !wings || wing.id === 'none' ? '' :
      `<g fill="url(#${k}w)" stroke="${metal[3]}" stroke-width=".8" stroke-linejoin="round">${wing.body}<g transform="translate(120 0) scale(-1 1)">${wing.body}</g></g>`;
    const star = shield.top ? `<path d="M60 1 L62.4 6.6 L68 6.8 L63.6 10.3 L65.2 16 L60 12.8 L54.8 16 L56.4 10.3 L52 6.8 L57.6 6.6 Z" fill="url(#${k}m)"/>` : '';
    return `<svg class="crest-svg" viewBox="${wings ? '0 0 120 100' : '26 0 68 100'}" aria-hidden="true"><defs>
<linearGradient id="${k}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${metal[0]}"/><stop offset=".45" stop-color="${metal[1]}"/><stop offset=".55" stop-color="${metal[2]}"/><stop offset="1" stop-color="${metal[0]}"/></linearGradient>
<linearGradient id="${k}w" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${metal[0]}"/><stop offset="1" stop-color="${metal[2]}"/></linearGradient>
<radialGradient id="${k}f" cx=".5" cy=".38" r=".7"><stop offset="0" stop-color="${field[0]}"/><stop offset=".6" stop-color="${field[1]}"/><stop offset="1" stop-color="${field[2]}"/></radialGradient>
<linearGradient id="${k}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${iconColor[0]}"/><stop offset="1" stop-color="${iconColor[1]}"/></linearGradient>
<linearGradient id="${k}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
<filter id="${k}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
${wingMarkup}
<path d="${shield.d}" fill="url(#${k}f)" stroke="url(#${k}m)" stroke-width="3.4" stroke-linejoin="round"/>
<path d="${shield.d}" fill="url(#${k}s)"/>
<path d="${shield.d}" transform="translate(60 52) scale(.84) translate(-60 -52)" fill="none" stroke="${metal[0]}" stroke-opacity=".7" stroke-width="1"/>
${star}
<g transform="translate(60 53) scale(${iconScale}) translate(-12 -12)" filter="url(#${k}g)">${icon.draw(`url(#${k}i)`)}</g></svg>`;
  }

  window.UnionEmblem = {
    WINGS, SHIELDS, ICONS, FIELD, METALS, ICON_COLORS,
    normalize, svg, random, esc,
    // 같은 모양인지 비교
    same: (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
  };
})();
