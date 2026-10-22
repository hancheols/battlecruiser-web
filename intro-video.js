// 앱을 처음 열면 타이틀 화면 앞에 인트로 영상(15초)을 보여 준다.
// - 영상은 가로(16:9)라서 세로 화면 가운데에 "시네마 창"으로 띄우고, 아래 자막 띠는 잘라 낸 뒤 자막은 게임이 직접 그린다.
// - 음악은 영상 파일에 없으므로 WebAudio로 만든 짧은 시네마틱 음악(패드·아르페지오·상승음·마지막 타격)을 함께 재생한다.
// - 오른쪽 위 '건너뛰기'로 언제든 넘길 수 있고, 끝나면 타이틀 화면이 나타난다. 주소에 ?nointro 가 있으면 건너뛴다(테스트용).
(() => {
  'use strict';
  if (/[?&]nointro\b/.test(location.search)) return;

  const VIDEO_SRC = 'intro-cinematic.mp4';
  // [시작 초, 자막]. 마지막 줄은 제목 카드로 크게 보여 준다.
  const LINES = [
    [0, '우리가 살고 있는 아름다운 지구,'],
    [1.5, '그리고 지구가 살고 있는 신비로운 태양계.'],
    [3, '우리는 삶의 터전인 이곳을 지켜내기 위해\n많은 어려움을 이겨냈다.'],
    [4.5, '강력한 적으로부터 맞서 지켜낸\n‘태양계 수호 대전’이 끝난 지 20년,'],
    [6, '그날의 전쟁 영웅들은\n하나둘 스러져 갔지만'],
    [7.5, '우리는 여전히 이곳을 지켜내고 있다.'],
    [9, '날마다 새로운 전사들이'],
    [10.5, '곳곳의 전선으로 나아가던 어느 날…'],
    [12, '새로운 전쟁의 그림자가\n다시 나타나고…'],
    [13.5, '그리고, 그 중심에 우리가 있다.'],
    [14.7, '다시 시작될 태양계의 운명', 'title']
  ];

  const overlay = document.createElement('div');
  overlay.id = 'intro-video';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', '인트로 영상');
  overlay.innerHTML = `
    <div class="intro-stage">
      <div class="intro-window"><video playsinline muted preload="auto" src="${VIDEO_SRC}"></video><i class="intro-vignette"></i></div>
      <div class="intro-caption" aria-live="polite"><p></p></div>
    </div>
    <button type="button" class="intro-skip">건너뛰기 <span aria-hidden="true">›</span></button>
    <button type="button" class="intro-sound" hidden>🔊 터치하면 소리가 나옵니다</button>`;
  document.body.append(overlay);
  window.__introActive = true;

  const video = overlay.querySelector('video');
  const caption = overlay.querySelector('.intro-caption p');
  const soundHint = overlay.querySelector('.intro-sound');
  let lineIndex = -1;
  let finished = false;
  let music = null;

  // ───────── 음악 (WebAudio 합성) ─────────
  const midi = note => 440 * Math.pow(2, (note - 69) / 12);
  // 코드 진행: [시작초, 길이초, 음(미디 번호)…] — Dm → B♭ → F → C → B♭ → D(장조, 밝게 마무리)
  const CHORDS = [
    [0, 3.75, [50, 53, 57, 62], 38],
    [3.75, 3.75, [46, 50, 53, 58], 34],
    [7.5, 2, [41, 45, 48, 53], 29],
    [9.5, 2, [48, 52, 55, 60], 36],
    [11.5, 2, [46, 50, 53, 58], 34],
    [13.5, 4.5, [50, 54, 57, 62, 69], 38]
  ];

  const preference = () => {
    try { return window.gamePreferences?.get?.().music || { enabled: true, volume: .65 }; } catch { return { enabled: true, volume: .65 }; }
  };

  function noiseBuffer(ctx, seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    return buffer;
  }

  function reverbImpulse(ctx, seconds = 2.4) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, 2.6);
    }
    return impulse;
  }

  function startMusic(offset = 0) {
    const preferred = preference();
    if (!preferred.enabled || preferred.volume <= 0) return null;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    const ctx = new Context();
    const master = ctx.createGain();
    const level = .5 * Math.min(1, preferred.volume / .65);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(level, ctx.currentTime + 1.4);
    master.connect(ctx.destination);

    const dry = ctx.createGain();
    dry.gain.value = .8;
    dry.connect(master);
    const reverb = ctx.createConvolver();
    reverb.buffer = reverbImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = .42;
    reverb.connect(wet).connect(master);
    const bus = ctx.createGain();
    bus.connect(dry);
    bus.connect(reverb);

    const base = ctx.currentTime + .05 - offset;   // 음악 시간 0초에 해당하는 AudioContext 시각
    const at = time => Math.max(ctx.currentTime + .02, base + time);

    // 패드와 저음
    CHORDS.forEach(([start, length, notes, bass]) => {
      const end = start + length;
      if (end <= offset) return;
      const begin = Math.max(start, offset);
      const attack = start >= offset ? 1.1 : .5;
      const release = 1.3;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, at(begin));
      filter.frequency.linearRampToValueAtTime(start >= 13.5 ? 3200 : 1500, at(end));
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, at(begin));
      gain.gain.linearRampToValueAtTime(start >= 13.5 ? .22 : .16, at(begin + attack));
      gain.gain.setValueAtTime(start >= 13.5 ? .22 : .16, at(Math.max(begin + attack, end - release)));
      gain.gain.linearRampToValueAtTime(0, at(end + (start >= 13.5 ? 2.2 : .2)));
      filter.connect(gain).connect(bus);
      notes.forEach((note, index) => {
        [-6, 6].forEach(detune => {
          const osc = ctx.createOscillator();
          osc.type = index % 2 ? 'triangle' : 'sawtooth';
          osc.frequency.value = midi(note);
          osc.detune.value = detune;
          const voice = ctx.createGain();
          voice.gain.value = .28;
          osc.connect(voice).connect(filter);
          osc.start(at(begin));
          osc.stop(at(end + 2.6));
        });
      });
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = midi(bass);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0, at(begin));
      subGain.gain.linearRampToValueAtTime(.36, at(begin + .8));
      subGain.gain.linearRampToValueAtTime(0, at(end + .4));
      sub.connect(subGain).connect(dry);
      sub.start(at(begin));
      sub.stop(at(end + .6));
    });

    // 아르페지오(2초 뒤부터 0.5초 간격), 메아리 한 겹
    const echo = ctx.createDelay(1);
    echo.delayTime.value = .375;
    const echoGain = ctx.createGain();
    echoGain.gain.value = .32;
    echo.connect(echoGain).connect(echo);
    echoGain.connect(bus);
    const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
    for (let step = 0; step < 29; step += 1) {
      const time = 2 + step * .5;
      if (time < offset || time > 15.2) continue;
      const chord = CHORDS.find(([start, length]) => time >= start && time < start + length);
      if (!chord) continue;
      const notes = chord[2];
      const note = notes[pattern[step % pattern.length] % notes.length] + 12;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = midi(note);
      const gain = ctx.createGain();
      const peak = time >= 13.5 ? .17 : .12;
      gain.gain.setValueAtTime(0, at(time));
      gain.gain.linearRampToValueAtTime(peak, at(time + .01));
      gain.gain.exponentialRampToValueAtTime(.001, at(time + .9));
      osc.connect(gain);
      gain.connect(bus);
      gain.connect(echo);
      osc.start(at(time));
      osc.stop(at(time + 1));
    }

    // 9초부터 13.5초까지 상승음, 13.5초에 묵직한 타격
    if (offset < 13.5) {
      const rise = ctx.createBufferSource();
      rise.buffer = noiseBuffer(ctx, 6);
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 1.2;
      const from = Math.max(9, offset);
      band.frequency.setValueAtTime(300 + (from - 9) * 800, at(from));
      band.frequency.exponentialRampToValueAtTime(5000, at(13.5));
      const riseGain = ctx.createGain();
      riseGain.gain.setValueAtTime(0, at(from));
      riseGain.gain.linearRampToValueAtTime(.13, at(13.4));
      riseGain.gain.linearRampToValueAtTime(0, at(13.55));
      rise.connect(band).connect(riseGain).connect(bus);
      rise.start(at(from));
      rise.stop(at(13.6));
    }
    if (offset < 14) {
      const hit = ctx.createOscillator();
      hit.type = 'sine';
      hit.frequency.setValueAtTime(110, at(13.5));
      hit.frequency.exponentialRampToValueAtTime(34, at(14.6));
      const hitGain = ctx.createGain();
      hitGain.gain.setValueAtTime(.001, at(13.5));
      hitGain.gain.linearRampToValueAtTime(.55, at(13.52));
      hitGain.gain.exponentialRampToValueAtTime(.001, at(15.4));
      hit.connect(hitGain).connect(dry);
      hit.start(at(13.5));
      hit.stop(at(15.5));
      const crash = ctx.createBufferSource();
      crash.buffer = noiseBuffer(ctx, 2);
      const crashFilter = ctx.createBiquadFilter();
      crashFilter.type = 'highpass';
      crashFilter.frequency.value = 2500;
      const crashGain = ctx.createGain();
      crashGain.gain.setValueAtTime(.001, at(13.5));
      crashGain.gain.linearRampToValueAtTime(.14, at(13.53));
      crashGain.gain.exponentialRampToValueAtTime(.001, at(15.2));
      crash.connect(crashFilter).connect(crashGain).connect(bus);
      crash.start(at(13.5));
      crash.stop(at(15.3));
    }
    return { ctx, master };
  }

  function fadeOutMusic(seconds = 1.6) {
    if (!music) return;
    const { ctx, master } = music;
    try {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + seconds);
      setTimeout(() => ctx.close().catch(() => {}), seconds * 1000 + 200);
    } catch {}
    music = null;
  }

  // ───────── 자막 ─────────
  function showLine(index) {
    if (index === lineIndex) return;
    lineIndex = index;
    const line = LINES[index];
    caption.classList.remove('show', 'title');
    if (!line) { caption.textContent = ''; return; }
    caption.textContent = line[1];
    if (line[2]) caption.classList.add(line[2]);
    void caption.offsetWidth;
    caption.classList.add('show');
  }

  function syncCaption() {
    if (finished) return;
    const time = video.currentTime || 0;
    let index = -1;
    LINES.forEach(([start], position) => { if (time >= start) index = position; });
    showLine(index);
    requestAnimationFrame(syncCaption);
  }

  // ───────── 진행 ─────────
  function finish() {
    if (finished) return;
    finished = true;
    fadeOutMusic(1.8);
    overlay.classList.add('leaving');
    window.__introActive = false;
    window.dispatchEvent(new Event('intro-finished'));
    setTimeout(() => { overlay.remove(); }, 700);
    try { video.pause(); } catch {}
  }

  function ensureMusic() {
    if (finished || music) return;
    music = startMusic(video.currentTime || 0);
    if (!music) return;
    if (music.ctx.state === 'suspended') {
      soundHint.hidden = false;
      music.ctx.resume().then(() => { soundHint.hidden = music?.ctx.state === 'running'; }).catch(() => {});
    }
  }

  const unlockAudio = () => {
    if (finished) return;
    if (!music) ensureMusic();
    else if (music.ctx.state === 'suspended') music.ctx.resume().then(() => { soundHint.hidden = true; }).catch(() => {});
    else soundHint.hidden = true;
  };

  overlay.querySelector('.intro-skip').addEventListener('click', event => {
    event.stopPropagation();
    finish();
  });
  overlay.addEventListener('pointerdown', unlockAudio);
  overlay.addEventListener('click', event => { if (!event.target.closest('.intro-skip')) { event.stopPropagation(); } }, true);
  video.addEventListener('ended', finish);
  video.addEventListener('error', finish);
  video.addEventListener('playing', () => { ensureMusic(); syncCaption(); }, { once: true });

  const play = video.play();
  if (play?.catch) play.catch(() => finish());
  // 영상이 오래 안 뜨면(네트워크 문제 등) 5초 뒤 건너뛴다.
  setTimeout(() => { if (!finished && video.readyState < 2) finish(); }, 5000);
})();
