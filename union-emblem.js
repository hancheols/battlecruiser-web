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

  // ───────── 외부 장식 ─────────
  // 각 장식은 draw(P)로 방패 뒤에 그릴 SVG를 돌려준다. P는 금속 색 정보다(w: 금속 면, m: 금속 선, line: 외곽선, hi: 밝은 색).
  // 좌우 대칭 장식은 왼쪽만 그리고 mirror()가 오른쪽을 만든다.
  const mirror = (P, body, extra = '') => `<g fill="${P.w}" stroke="${P.line}" stroke-width=".8" stroke-linejoin="round">${body}<g transform="translate(120 0) scale(-1 1)">${body}</g></g>${extra}`;
  const strokes = (P, body, width = 3) => `<g fill="none" stroke="${P.m}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${body}<g transform="translate(120 0) scale(-1 1)">${body}</g></g>`;
  const star5 = (cx, cy, r) => {
    let d = '';
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 ? r * .45 : r;
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      d += `${i ? 'L' : 'M'}${(cx + radius * Math.cos(ang)).toFixed(1)} ${(cy + radius * Math.sin(ang)).toFixed(1)} `;
    }
    return d + 'Z';
  };
  const leafWing = () => {
    let leaves = '';
    for (let i = 0; i < 9; i += 1) {
      const t = i / 8;
      const x = 44 - 22 * Math.sin(Math.PI * t);
      const y = 14 + 72 * t;
      const angle = -70 + t * 140;
      leaves += `<path d="M0 0 C3 -6 11 -7 15 0 C11 7 3 6 0 0 Z" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(angle + 180).toFixed(0)})"/>`;
    }
    return leaves;
  };
  const burst = () => {
    let d = '';
    for (let i = 0; i < 24; i += 1) {
      const r = i % 2 ? .74 : 1;
      const ang = -Math.PI / 2 + i * Math.PI / 12;
      d += `${i ? 'L' : 'M'}${(60 + 54 * r * Math.cos(ang)).toFixed(1)} ${(52 + 48 * r * Math.sin(ang)).toFixed(1)} `;
    }
    return d + 'Z';
  };
  const cogRing = () => {
    let d = '';
    const teeth = 14;
    for (let i = 0; i < teeth; i += 1) {
      const base = i * 2 * Math.PI / teeth;
      [[.86, -.17], [1, -.1], [1, .1], [.86, .17]].forEach(([r, off], j) => {
        const ang = base + off - Math.PI / 2;
        d += `${i || j ? 'L' : 'M'}${(60 + 52 * r * Math.cos(ang)).toFixed(1)} ${(52 + 46 * r * Math.sin(ang)).toFixed(1)} `;
      });
    }
    return d + 'Z';
  };
  const starArc = () => {
    let d = '';
    for (let j = 0; j < 7; j += 1) {
      const t = j / 6;
      const ang = Math.PI * (1.08 + .84 * t);
      const r = j === 3 ? 8.5 : j % 3 === 0 ? 6 : 7;
      d += star5(60 + 56 * Math.cos(ang), 56 + 50 * Math.sin(ang), r) + ' ';
    }
    return d;
  };
  const featherLines = 'M45 46 C32 34 20 28 6 22 M45 57 C32 52 20 50 8 52 M45 66 C34 70 26 76 22 84';
  const batBones = 'M45 28 L4 12 M45 31 L9 36 M45 36 L20 46 M45 42 L33 54';
  const WINGS = [
    { id: 'angel', name: '천상의 날개', draw: P => mirror(P,
      '<path d="M45 38 C34 22 18 14 2 16 C9 24 12 29 14 35 C8 32 4 33 0 36 C12 42 28 48 45 54 Z"/><path d="M45 52 C34 42 20 40 5 44 C11 48 15 51 16 56 C11 55 7 57 3 61 C16 63 32 61 45 62 Z"/><path d="M45 62 C35 62 22 66 13 75 C19 73 25 73 29 76 C25 78 21 82 19 88 C30 82 39 75 45 70 Z"/>',
      `<g fill="none" stroke="${P.hi}" stroke-opacity=".55" stroke-width=".8" stroke-linecap="round"><path d="${featherLines}"/><g transform="translate(120 0) scale(-1 1)"><path d="${featherLines}"/></g></g>`) },
    { id: 'bat', name: '심연의 날개', draw: P => mirror(P,
      '<path d="M45 28 C34 18 20 12 4 12 C10 20 11 28 9 36 C15 34 20 38 20 46 C25 42 31 45 33 54 C37 51 41 53 45 62 Z"/>',
      `<g fill="none" stroke="${P.line}" stroke-width="1.1" stroke-linecap="round"><path d="${batBones}"/><g transform="translate(120 0) scale(-1 1)"><path d="${batBones}"/></g></g>`) },
    { id: 'halo', name: '태양 후광', draw: P => `<path d="${burst()}" fill="${P.w}" stroke="${P.line}" stroke-width=".8" stroke-linejoin="round"/><ellipse cx="60" cy="52" rx="42" ry="38" fill="none" stroke="${P.hi}" stroke-opacity=".55" stroke-width="1"/>` },
    { id: 'antler', name: '고대의 뿔', draw: P => strokes(P, '<path d="M44 50 C28 44 16 32 13 9"/><path d="M31 40 C22 41 13 38 6 31"/><path d="M24 34 C18 29 14 24 11 19"/><path d="M19 27 C13 26 7 22 3 16"/><path d="M13 9 L11 3"/>', 3.6) },
    { id: 'swirl', name: '성운 소용돌이', draw: P => strokes(P, '<path d="M46 62 C30 64 14 54 12 38 C11 26 22 18 32 22 C40 26 40 36 33 38 C28 39 26 34 29 32"/><path d="M46 74 C34 82 20 80 12 68"/>', 2.8) + `<g fill="${P.hi}"><circle cx="29" cy="32" r="2.4"/><circle cx="91" cy="32" r="2.4"/><circle cx="12" cy="68" r="2.2"/><circle cx="108" cy="68" r="2.2"/></g>` },
    { id: 'gear', name: '톱니 광환', draw: P => `<path d="${cogRing()}" fill="${P.w}" stroke="${P.line}" stroke-width=".8" stroke-linejoin="round"/><ellipse cx="60" cy="52" rx="40" ry="35" fill="none" stroke="${P.hi}" stroke-opacity=".6" stroke-width="1.2"/>` },
    { id: 'spears', name: '교차 전창', draw: P => `<g fill="none" stroke="${P.m}" stroke-width="3" stroke-linecap="round"><path d="M16 94 L100 16 M104 94 L20 16"/></g><g fill="${P.w}" stroke="${P.line}" stroke-width=".8" stroke-linejoin="round"><path d="M0 -11 L4.5 2 L0 6 L-4.5 2 Z" transform="translate(102 14) rotate(47)"/><path d="M0 -11 L4.5 2 L0 6 L-4.5 2 Z" transform="translate(18 14) rotate(-47)"/><circle cx="15" cy="95" r="2.6"/><circle cx="105" cy="95" r="2.6"/></g>` },
    { id: 'stars', name: '별무리 관', draw: P => `<path d="${starArc()}" fill="${P.w}" stroke="${P.line}" stroke-width=".8" stroke-linejoin="round"/>` },
    { id: 'phoenix', name: '불사조의 깃', draw: P => mirror(P,
      '<path d="M45 58 C30 58 16 46 12 26 C20 34 26 36 34 36 C28 28 28 18 34 8 C40 22 46 32 46 44 Z"/><path d="M45 66 C32 70 18 66 8 54 C18 58 28 58 38 54 Z"/><path d="M45 72 C34 82 22 86 12 84 C20 80 26 76 30 70 Z"/>') },
    { id: 'laurel', name: '승리의 월계관', draw: P => mirror(P, leafWing()) },
    { id: 'ribbon', name: '왕실 두루마리', draw: P => `<path d="M14 76 C32 84 46 84 60 88 C74 84 88 84 106 76 L98 88 L106 100 C88 94 74 95 60 98 C46 95 32 94 14 100 L22 88 Z" fill="${P.w}" stroke="${P.line}" stroke-width=".8" stroke-linejoin="round"/><path d="M22 88 L14 76 M98 88 L106 76" fill="none" stroke="${P.line}" stroke-width=".8"/>` },
    { id: 'none', name: '없음', draw: () => '' }
  ];
  // 예전 이름으로 저장된 엠블럼을 새 장식으로 옮긴다.
  const ICON_ALIAS = { comet: 'star', flag: 'castle' };
  const WING_ALIAS = { feather: 'angel', eagle: 'bat', flame: 'phoenix', blade: 'spears', mech: 'gear', horn: 'antler' };

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
    { id: 'heart', name: '하트', draw: P => `<path d="M12 21 C5 15.5 2.5 11.5 2.5 8 C2.5 5 4.8 3 7.4 3 C9.3 3 11 4 12 5.8 C13 4 14.7 3 16.6 3 C19.2 3 21.5 5 21.5 8 C21.5 11.5 19 15.5 12 21 Z" fill="${P}"/>` },
    { id: 'crown', name: '왕관', draw: P => `<path d="M3 19 L3 8 L8 12.5 L12 5 L16 12.5 L21 8 L21 19 Z" fill="${P}"/><rect x="3" y="20.2" width="18" height="2" fill="${P}"/>` },
    { id: 'anchor', name: '닻', draw: P => `<g fill="none" stroke="${P}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.2"/><path d="M12 7.2 V21 M7.5 11 H16.5 M4.5 15 C5.5 19.5 9 21 12 21 C15 21 18.5 19.5 19.5 15"/></g>` },
    { id: 'swords', name: '쌍검', draw: P => {
      const sword = `<path d="M12 -1.2 L14 2.8 L13.7 16 L10.3 16 L10 2.8 Z" fill="${P}"/><path d="M12 -1.2 L14 2.8 L13.7 16 L12 16 Z" fill="#000" fill-opacity=".24"/><path d="M12 2 V15.4" stroke="#fff" stroke-opacity=".75" stroke-width=".55" fill="none"/><path d="M6.4 16 H17.6 L16.8 18 H7.2 Z" fill="${P}"/><path d="M11.1 18 H12.9 V21.4 H11.1 Z" fill="${P}"/><circle cx="12" cy="22.4" r="1.6" fill="${P}"/>`;
      return `<g transform="translate(12 12) scale(1.1) translate(-12 -12)"><g transform="rotate(-40 12 12)">${sword}</g><g transform="rotate(40 12 12)">${sword}</g></g>`;
    } },
    { id: 'atom', name: '원자', draw: P => `<g fill="none" stroke="${P}" stroke-width="1.6"><ellipse cx="12" cy="12" rx="10" ry="3.8"/><ellipse cx="12" cy="12" rx="10" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="3.8" transform="rotate(120 12 12)"/></g><circle cx="12" cy="12" r="2.2" fill="${P}"/>` },
    { id: 'eye', name: '눈', draw: P => `<path d="M1.5 12 C6 5.5 18 5.5 22.5 12 C18 18.5 6 18.5 1.5 12 Z" fill="none" stroke="${P}" stroke-width="1.8"/><circle cx="12" cy="12" r="3.2" fill="${P}"/>` },
    { id: 'bolt', name: '번개', draw: P => `<path d="M13 2 L5 13 H11 L9 22 L19 9 H13 Z" fill="${P}"/>` },
    { id: 'rocket', name: '로켓', draw: P => `<path d="M12 2 C15.5 5.5 16.5 11 15 16 H9 C7.5 11 8.5 5.5 12 2 Z" fill="${P}"/><path d="M9 14 L5 19 L9 18 Z M15 14 L19 19 L15 18 Z M10.5 17 L12 22 L13.5 17 Z" fill="${P}"/>` },
    { id: 'castle', name: '성채', draw: P => `<path d="M3.5 21 V10.5 H4.8 V9 H6.2 V10.5 H7.4 V9 H8.8 V10.5 H9.5 V21 Z M14.5 21 V10.5 H15.2 V9 H16.6 V10.5 H17.8 V9 H19.2 V10.5 H20.5 V21 Z" fill="${P}"/><path d="M9 21 V8 H10.4 V6.6 H11.6 V8 H12.4 V6.6 H13.6 V8 H15 V21 Z" fill="${P}"/><path d="M12 6.6 V1.4" fill="none" stroke="${P}" stroke-width="1.2" stroke-linecap="round"/><path d="M12.4 1.6 L18.4 3.6 L12.4 5.8 Z" fill="${P}"/><path d="M10.6 21 V16 C10.6 13.8 13.4 13.8 13.4 16 V21 Z" fill="#0a1230"/>` },
    { id: 'sun', name: '태양', draw: P => {
      let spiral = '';
      for (let i = 0; i <= 64; i += 1) {
        const t = i / 64;
        const ang = t * Math.PI * 4.4 - Math.PI / 2;
        const r = .7 + t * 6.2;
        spiral += `${i ? 'L' : 'M'}${(12 + r * Math.cos(ang)).toFixed(2)} ${(12 + r * Math.sin(ang)).toFixed(2)} `;
      }
      let rays = '';
      for (let i = 0; i < 8; i += 1) {
        const a = i * Math.PI / 4 - Math.PI / 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const px = -sa, py = ca;
        const base = 8.9, tip = 12, half = 2.1;
        const bx = 12 + base * ca, by = 12 + base * sa;
        rays += `M${(bx + px * half).toFixed(2)} ${(by + py * half).toFixed(2)} L${(12 + tip * ca + px * .4).toFixed(2)} ${(12 + tip * sa + py * .4).toFixed(2)} L${(bx - px * half).toFixed(2)} ${(by - py * half).toFixed(2)} Z `;
      }
      return `<path d="${rays}" fill="${P}" stroke="${P}" stroke-width="1" stroke-linejoin="round"/><path d="${spiral}" fill="none" stroke="${P}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    } }
  ];

  const find = (list, id) => list.find(item => item.id === id);
  const ids = list => list.map(item => item.id);

  // ───────── 값 정리 ─────────
  // 옛 글리프 엠블럼('⊕' 등)을 같은 느낌의 새 엠블럼으로 바꾼다.
  const LEGACY = {
    '⊕': { w: 'angel', s: 'classic', i: 'planet', f: 'blue', m: 'silver', c: 'white' },
    '✦': { w: 'angel', s: 'classic', i: 'star', f: 'blue', m: 'silver', c: 'white' },
    '⬢': { w: 'gear', s: 'hex', i: 'atom', f: 'teal', m: 'ice', c: 'cyan' },
    '☄': { w: 'phoenix', s: 'kite', i: 'bolt', f: 'violet', m: 'silver', c: 'white' },
    '⚑': { w: 'spears', s: 'tower', i: 'castle', f: 'crimson', m: 'gold', c: 'gold' },
    '♜': { w: 'laurel', s: 'tower', i: 'castle', f: 'onyx', m: 'obsidian', c: 'white' }
  };
  const DEFAULT = LEGACY['⊕'];

  function normalize(value) {
    const source = typeof value === 'string' ? (LEGACY[value] || DEFAULT) : (value && typeof value === 'object' ? value : DEFAULT);
    const pick = (key, list) => { const v = key === 'w' ? (WING_ALIAS[source.w] || source.w) : key === 'i' ? (ICON_ALIAS[source.i] || source.i) : source[key]; return ids(list).includes(v) ? v : DEFAULT[key]; };
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
    const wingMarkup = !wings || wing.id === 'none' ? '' : wing.draw({ w: `url(#${k}w)`, m: `url(#${k}m)`, line: metal[3], hi: metal[0] });
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
