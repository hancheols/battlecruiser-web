// 직접 합성한 소리 모음: 외계 상인 목소리와 L급 획득음(엔진 소리 + 군중 환호). 웹 오디오로 만들며 외부 소리 파일·다른 게임의 소리를 쓰지 않는다.
// 음절마다 음높이가 오르내리고(톱니파 두 개) 모음 필터(포먼트 두 개)와 떨림(비브라토)을 입혀 "외계어" 처럼 들리게 한다.
// createAlienVoice(종류) 는 기존 Audio 처럼 currentTime 과 play() 를 쓸 수 있는 객체를 돌려준다.
(() => {
  'use strict';
  // 음절: [길이(초), 시작 음높이(Hz), 끝 음높이(Hz), [첫째 포먼트, 둘째 포먼트](Hz)]
  const SPEC = {
    greet:  [[.16, 232, 250, [850, 1250]], [.14, 250, 236, [600, 2500]], [.26, 240, 205, [750, 1100]]],   // 상점에 들어올 때(뭐 찾아?) — 차분하게 내려가며 끝남
    yes:    [[.14, 236, 226, [600, 2500]], [.28, 226, 246, [380, 2700]]],                                   // 상점에 들어올 때(네?) — 살짝만 올라가는 부드러운 끝
    thanks: [[.14, 240, 256, [850, 1250]], [.14, 256, 236, [600, 2500]], [.12, 236, 226, [380, 2700]], [.32, 230, 198, [750, 1100]]]   // 구매 완료(고마워요) — 낮게 내려앉는 마무리
  };
  const STRETCH = 2, GAP = .02, PEAK = 1.6, GAIN_L = .45;   // STRETCH: 아르카 목소리 재생 시간 배수(음높이는 그대로) / GAIN_L: L급 획득음 음량 보정
  let shared = null;

  const effects = () => {
    try { const e = window.gamePreferences?.get?.().effects; return { enabled: e?.enabled !== false, volume: Number.isFinite(e?.volume) ? e.volume : 1 }; }
    catch { return { enabled: true, volume: 1 }; }
  };

  // ctx: AudioContext 또는 OfflineAudioContext, dest: 연결할 노드, start: 시작 시각(초)
  function render(ctx, dest, kind, start = 0) {
    let t = start;
    for (const [len0, f0, f1, [fa, fb]] of SPEC[kind]) {
      const len = len0 * STRETCH;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(PEAK, t + Math.min(.12, len * .4));   // 부드러운 시작
      env.gain.setValueAtTime(PEAK, t + Math.max(.05, len * .45));   // 일찍부터 서서히 줄어드는 끝
      env.gain.linearRampToValueAtTime(0, t + len);
      const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 3000;
      const a = ctx.createBiquadFilter(); a.type = 'bandpass'; a.frequency.value = fa; a.Q.value = 3.5;
      const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fb; b.Q.value = 5;
      const bGain = ctx.createGain(); bGain.gain.value = .4;
      a.connect(low); b.connect(bGain); bGain.connect(low);
      low.connect(env); env.connect(dest);
      // 거친 목소리 바탕: 톱니파 두 개를 살짝 어긋나게
      for (const detune of [-9, 9]) {
        const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.detune.value = detune;
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.linearRampToValueAtTime(f1, t + len);
        // 떨림(비브라토)
        const lfo = ctx.createOscillator(); lfo.frequency.value = 4.6 + Math.random() * .6;
        const depth = ctx.createGain(); depth.gain.value = 5;
        lfo.connect(depth); depth.connect(osc.detune);
        osc.connect(a); osc.connect(b);
        osc.start(t); lfo.start(t); osc.stop(t + len + .02); lfo.stop(t + len + .02);
      }
      // 숨소리(부드러운 여성 목소리 느낌)
      const nlen = Math.floor(ctx.sampleRate * (len + .05)), nbuf = ctx.createBuffer(1, nlen, ctx.sampleRate), nd = nbuf.getChannelData(0);
      for (let i = 0; i < nlen; i += 1) nd[i] = Math.random() * 2 - 1;
      const breath = ctx.createBufferSource(); breath.buffer = nbuf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fb * 1.6; bp.Q.value = .9;
      const bg = ctx.createGain(); bg.gain.value = .14;
      breath.connect(bp); bp.connect(bg); bg.connect(env);
      breath.start(t); breath.stop(t + len + .05);
      t += len + GAP;
    }
    return t - start;
  }

  const audioContext = () => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    shared = shared || new Ctx();
    return shared;
  };

  // 기존 Audio 와 같은 모양(currentTime, play, pause, load)으로 쓸 수 있다. base: 기본 음량(0~1)
  function make(kind, base = .5) {
    return {
      set currentTime(_) {}, get currentTime() { return 0; },
      pause() {}, load() {},
      play() {
        const pref = effects();
        if (!pref.enabled || pref.volume <= 0) return Promise.resolve();
        try {
          const ctx = audioContext();
          if (!ctx) return Promise.resolve();
          const go = () => {
            const master = ctx.createGain();
            master.gain.value = base * pref.volume * .5;
            master.connect(ctx.destination);
            render(ctx, master, kind, ctx.currentTime + .01);
          };
          if (ctx.state === 'suspended') return ctx.resume().then(go).catch(() => {});
          go();
        } catch (_) { /* 소리는 선택 사항이다. 재생할 수 없어도 화면 동작을 막지 않는다. */ }
        return Promise.resolve();
      }
    };
  }

  // ── L급 획득음: 함선 엔진 소리 + 군중 환호(직접 합성) ───────────────────────────────
  // 섬광 순간(0초)에 엔진이 크게 점화되어 올라가고, 군중이 "와아!" 하며 환호와 박수가 이어진다.
  // 'l' 은 연출 시간표에 맞춰 화면 흔들림(약 1.35초)에 엔진 재점화, 각인(약 1.77초)에 환호 절정을 더하고,
  // 'burst' 는 돌파 폭발 한 번만 낸다. 실제 녹음이 아니라 근사치이므로, 나중에 Pixabay 의 군중 환호 파일을 받으면 군중 층만 바꿔도 된다.
  const noise = (ctx, seconds) => {
    const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    return buf;
  };
  // 박수: 짧은 딸깍 소리를 무작위로 흩뿌린 버퍼 하나(소리 노드를 수십 개 만들지 않아 가볍다)
  const clapBuffer = (ctx, seconds, from, to) => {
    const sr = ctx.sampleRate, len = Math.floor(sr * seconds), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = Math.floor(from * sr); i < Math.min(len, Math.floor(to * sr)); i += 1) {
      const pos = (i / sr - from) / Math.max(.001, to - from), density = Math.sin(Math.PI * Math.min(1, pos * 1.15)) * .0045 + .0006;
      if (Math.random() < density) { const amp = .4 + Math.random() * .6; for (let k = 0; k < 90 && i + k < len; k += 1) d[i + k] += (Math.random() * 2 - 1) * amp * Math.exp(-k / 18); }
    }
    return buf;
  };
  // 엔진 바탕 소리: Pixabay 의 "Spaceship Engine Starting Up"(ezanarini, Pixabay 콘텐츠 라이선스). 못 불러오면 아래 합성 엔진으로 대신한다.
  const ENGINE_URL = 'sound/spaceship-engine-start.mp3?v=20261124-1';
  let engineBuffer = null, engineLoading = false;
  const loadEngine = () => {
    if (engineBuffer || engineLoading) return;
    engineLoading = true;
    try {
      const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Off) return;
      fetch(ENGINE_URL).then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(ab => new Off(1, 1, 44100).decodeAudioData(ab)).then(buf => { engineBuffer = buf; }).catch(() => { engineLoading = false; });
    } catch (_) { engineLoading = false; }
  };
  function level(ctx, dest, t, len, points) {   // points: [[시각, 크기], ...] 선형으로 이어 붙인 음량 곡선
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    for (const [at, v] of points) g.gain.linearRampToValueAtTime(Math.max(.0001, v), t + at);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    g.connect(dest); return g;
  }
  function engine(ctx, dest, { t, len, power = 1, startHz = 46, topHz = 98 }) {
    if (engineBuffer) {   // 불러온 엔진 소리: 낮게 시작해 빠르게 올라가는 점화 느낌(재생 속도로 음높이를 올린다)
      const src = ctx.createBufferSource(); src.buffer = engineBuffer;
      const lo = startHz / 46, hi = topHz / 98;          // 재점화는 시작 음높이를 높게 준다
      src.playbackRate.setValueAtTime(.7 * lo, t); src.playbackRate.exponentialRampToValueAtTime(1.3 * hi, t + 1.0); src.playbackRate.exponentialRampToValueAtTime(1.0 * hi, t + len);
      const out = level(ctx, dest, t, len, [[.06, 9 * power], [len * .5, 8 * power], [len * .85, 4 * power]]);
      src.connect(out); src.start(t, 1.0, len + .2); src.stop(t + len + .05);
      const thump = ctx.createOscillator(); thump.type = 'sine';   // 점화 순간의 낮은 쿵
      thump.frequency.setValueAtTime(95, t); thump.frequency.exponentialRampToValueAtTime(36, t + .9);
      const tg = level(ctx, dest, t, 1.0, [[.004, .8 * power]]); thump.connect(tg); thump.start(t); thump.stop(t + 1.05);
      return;
    }
    const out = level(ctx, dest, t, len, [[.05, .9 * power], [len * .45, .75 * power], [len * .8, .3 * power]]);
    // 낮은 엔진 울림: 어긋난 톱니파 둘이 점점 올라간다
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.4;
    lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(1100, t + 1.0); lp.frequency.exponentialRampToValueAtTime(500, t + len);
    lp.connect(out);
    for (const detune of [-14, 14]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = detune;
      o.frequency.setValueAtTime(startHz, t); o.frequency.exponentialRampToValueAtTime(topHz, t + 1.0); o.frequency.exponentialRampToValueAtTime(topHz * .78, t + len);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 17; const depth = ctx.createGain(); depth.gain.value = 9; lfo.connect(depth); depth.connect(o.detune);  // 엔진 떨림
      o.connect(lp); o.start(t); lfo.start(t); o.stop(t + len + .05); lfo.stop(t + len + .05);
    }
    // 터빈 소리: 높은 음이 빠르게 올라갔다 가라앉는다
    const whine = ctx.createOscillator(); whine.type = 'triangle';
    whine.frequency.setValueAtTime(260, t); whine.frequency.exponentialRampToValueAtTime(1500, t + 1.0); whine.frequency.exponentialRampToValueAtTime(700, t + len);
    const whineGain = level(ctx, dest, t, len, [[.2, .05 * power], [1.0, .11 * power], [len * .7, .05 * power]]);
    whine.connect(whineGain); whine.start(t); whine.stop(t + len + .05);
    // 배기 잡음(바람 소리 같은 쉬익)
    const src = ctx.createBufferSource(); src.buffer = noise(ctx, len + .1);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2200, t + 1.0); bp.Q.value = .8;
    src.connect(bp); bp.connect(level(ctx, dest, t, len, [[.08, .55 * power], [len * .5, .35 * power]]));
    src.start(t); src.stop(t + len + .1);
    // 점화 순간의 낮은 쿵
    const thump = ctx.createOscillator(); thump.type = 'sine';
    thump.frequency.setValueAtTime(95, t); thump.frequency.exponentialRampToValueAtTime(36, t + .9);
    const tg = level(ctx, dest, t, 1.0, [[.004, 1.0 * power]]); thump.connect(tg); thump.start(t); thump.stop(t + 1.05);
  }
  function crowd(ctx, dest, { t, len, size = 14, peakAt = .9, power = 1, clapFrom = .6 }) {
    // 환호의 바탕: 사람들이 한꺼번에 내는 "와아" 하는 넓은 잡음(떨림이 있다)
    const src = ctx.createBufferSource(); src.buffer = noise(ctx, len + .1);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = .55;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 220;
    const bed = level(ctx, dest, t, len, [[peakAt * .55, .22 * power], [peakAt, .5 * power], [len * .7, .38 * power]]);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6.5; const lfoDepth = ctx.createGain(); lfoDepth.gain.value = .08 * power; lfo.connect(lfoDepth); lfoDepth.connect(bed.gain);
    src.connect(hp); hp.connect(bp); bp.connect(bed); src.start(t); src.stop(t + len + .1); lfo.start(t); lfo.stop(t + len + .1);
    // 환호하는 사람들: 서로 다른 높이로 시작해 위로 치솟는 "아·오" 소리 여러 개
    for (let i = 0; i < size; i += 1) {
      const at = t + .05 + Math.random() * (peakAt * .9), hold = .55 + Math.random() * .8, base = 150 + Math.random() * 190;
      const vowel = Math.random() < .55 ? [720, 1150] : [520, 920], jitter = .94 + Math.random() * .12;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(base, at); o.frequency.exponentialRampToValueAtTime(base * (1.12 + Math.random() * .18), at + hold * .6); o.frequency.exponentialRampToValueAtTime(base * .96, at + hold);
      const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = vowel[0] * jitter; f1.Q.value = 4;
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = vowel[1] * jitter; f2.Q.value = 5;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime((.08 + Math.random() * .05) * power, at + .09); g.gain.setValueAtTime((.07 + Math.random() * .04) * power, at + Math.max(.1, hold - .35)); g.gain.linearRampToValueAtTime(0.0001, at + hold);
      o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(dest); o.start(at); o.stop(at + hold + .05);
    }
    // 박수
    const clap = ctx.createBufferSource(); clap.buffer = clapBuffer(ctx, len, Math.min(clapFrom, len * .5), len);
    const chp = ctx.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.value = 1400;
    const cg = ctx.createGain(); cg.gain.value = .55 * power;
    clap.connect(chp); chp.connect(cg); cg.connect(dest); clap.start(t); clap.stop(t + len + .05);
  }
  function fanfare(ctx, dest, variant = 'l', start = 0) {
    const t = start;
    if (variant === 'l') {
      engine(ctx, dest, { t, len: 3.0, power: 1 });
      crowd(ctx, dest, { t, len: 3.0, size: 16, peakAt: .95, power: 1, clapFrom: .8 });
      // 화면 흔들림(약 1.35초): 엔진 재점화
      engine(ctx, dest, { t: t + 1.35, len: 1.4, power: .55, startHz: 62, topHz: 112 });
      // 각인(약 1.77초): 환호가 한 번 더 치솟는다
      crowd(ctx, dest, { t: t + 1.7, len: 1.3, size: 10, peakAt: .35, power: .8, clapFrom: .1 });
      return 3.1;
    }
    engine(ctx, dest, { t, len: 1.9, power: .85 });
    crowd(ctx, dest, { t, len: 1.9, size: 10, peakAt: .7, power: .8, clapFrom: .5 });
    return 2.0;
  }
  // 기존 Audio 와 같은 모양(currentTime, play, pause)으로 쓸 수 있다. pause() 는 소리를 빠르게 줄여 끈다.
  function makeFanfare(variant = 'l', base = .8) {
    loadEngine();
    let master = null, ctxRef = null;
    return {
      set currentTime(_) {}, get currentTime() { return 0; },
      load() {},
      pause() { try { if (master && ctxRef) master.gain.setTargetAtTime(0, ctxRef.currentTime, .04); } catch (_) {} },
      play() {
        const pref = effects();
        if (!pref.enabled || pref.volume <= 0) return Promise.resolve();
        try {
          const ctx = audioContext();
          if (!ctx) return Promise.resolve();
          const go = () => {
            master = ctx.createGain(); ctxRef = ctx;
            master.gain.value = base * pref.volume * GAIN_L;
            master.connect(ctx.destination);
            fanfare(ctx, master, variant, ctx.currentTime + .01);
          };
          if (ctx.state === 'suspended') return ctx.resume().then(go).catch(() => {});
          go();
        } catch (_) { /* 소리는 선택 사항이다. */ }
        return Promise.resolve();
      }
    };
  }

  window.createAlienVoice = make;
  window.createLegendFanfare = makeFanfare;
  window.AlienVoice = { SPEC, render, fanfare, kinds: Object.keys(SPEC), peak: PEAK };
})();
