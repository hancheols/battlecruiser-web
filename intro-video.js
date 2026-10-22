// 앱을 열면 타이틀 화면 앞에 인트로 영상(15초 영상을 0.7배속으로 약 21.5초)을 보여 준다.
// - 영상은 가로(16:9)라서 세로 화면 가운데에 "시네마 창"으로 띄우고, 아래 자막 띠는 잘라 낸 뒤 자막은 게임이 직접 그린다.
// - 영상은 확대하지 않고 화면 폭에 맞춰 보여 주며, 위아래 빈 공간은 같은 영상을 흐리게 키운 배경으로 채운다.
// - 음악은 sound/intro.mp3 를 영상과 함께 틀고, 타이틀에서 '게임 시작'을 누를 때까지 반복한 뒤 서서히 줄인다. 게임 설정의 음악 켜기/볼륨을 따른다.
// - 오른쪽 위 '건너뛰기'로 언제든 넘길 수 있고, 끝나면 타이틀 화면이 나타난다. 주소에 ?nointro 가 있으면 건너뛴다(테스트용).
(() => {
  'use strict';
  if (/[?&]nointro\b/.test(location.search)) return;

  const VIDEO_SRC = 'intro-cinematic.mp4';
  const MUSIC_SRC = 'sound/intro.mp3';
  const RATE = .7;               // 재생 배속
  const TITLE_HOLD = 2200;       // 영상이 끝난 뒤 제목 카드를 더 보여 주는 시간(ms)
  const MUSIC_LEVEL = .8;
  const VISIBLE_RATIO = 596 / 720; // 영상 아래쪽 자막 띠를 잘라 낸 뒤 보이는 높이 비율
  const LOOP_FADE = 1.6;         // 곡 끝에서 처음으로 돌아갈 때 겹쳐 흐르는 시간(초)
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
    <canvas class="intro-backdrop" width="72" height="128" aria-hidden="true"></canvas>
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
  const backdrop = overlay.querySelector('.intro-backdrop');
  const backdropContext = backdrop.getContext('2d');
  let lineIndex = -1;
  let finished = false;

  // ───────── 음악 ─────────
  // 곡이 끝나기 전에 같은 곡을 한 겹 더 시작해 겹쳐 흐르게 하면 처음으로 돌아가는 이음새가 덜 튄다.
  const layers = new Set();
  let started = false;      // 음악을 한 번이라도 시작했는지
  let musicStopped = false; // 게임 시작으로 음악을 마쳤는지
  let loopTimer = 0;

  function fadeAudio(audio, to, seconds, done) {
    clearInterval(audio.__fade);
    const from = audio.volume;
    const began = performance.now();
    audio.__fade = setInterval(() => {
      const ratio = Math.min(1, (performance.now() - began) / (seconds * 1000));
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * ratio));
      if (ratio >= 1) { clearInterval(audio.__fade); done?.(); }
    }, 40);
  }

  function startLayer(offset = 0, fadeIn = 1.2) {
    // 게임 설정(음악 켜기/볼륨)을 따르는 오디오로 만든다.
    const audio = window.createGameAudio ? window.createGameAudio(MUSIC_SRC, 'music') : new Audio(MUSIC_SRC);
    audio.loop = false;
    audio.volume = 0;
    if (offset > .3) audio.addEventListener('loadedmetadata', () => { try { audio.currentTime = offset; } catch {} }, { once: true });
    layers.add(audio);
    const attempt = audio.play();
    const ok = () => { soundHint.hidden = true; fadeAudio(audio, MUSIC_LEVEL, fadeIn); };
    if (attempt?.then) attempt.then(ok).catch(() => { layers.delete(audio); started = false; soundHint.hidden = false; });
    else ok();
    audio.addEventListener('ended', () => layers.delete(audio));
    return audio;
  }

  function ensureMusic() {
    if (started || musicStopped) return;
    started = true;
    // 영상이 이미 흐른 뒤에 시작하면 그 시간만큼 건너뛴다.
    startLayer((video.currentTime || 0) / RATE);
    loopTimer = setInterval(() => {
      if (musicStopped) return;
      const newest = [...layers].pop();
      if (!newest || !Number.isFinite(newest.duration) || newest.paused) return;
      if (newest.duration - newest.currentTime <= LOOP_FADE && !newest.__looped) {
        newest.__looped = true;
        fadeAudio(newest, 0, LOOP_FADE, () => { try { newest.pause(); } catch {} layers.delete(newest); });
        startLayer(0, LOOP_FADE);
      }
    }, 200);
  }

  // 타이틀에서 '게임 시작'을 누르면 음악을 서서히 줄이고, 메인 BGM이 이어서 나오게 한다.
  function stopMusic(seconds = 1.5) {
    musicStopped = true;
    clearInterval(loopTimer);
    layers.forEach(audio => fadeAudio(audio, 0, seconds, () => { try { audio.pause(); } catch {} layers.delete(audio); }));
  }

  function endIntro() {
    stopMusic(1.5);
    window.__introActive = false;
    window.dispatchEvent(new Event('intro-finished'));
  }
  window.addEventListener('title-start', endIntro);

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

  // 영상 가운데를 세로 비율로 잘라 작은 캔버스에 그리면 CSS 블러와 함께 흐린 배경이 된다.
  function paintBackdrop() {
    if (video.readyState < 2) return;
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight * VISIBLE_RATIO;
    const wanted = backdrop.width / backdrop.height;
    let cropWidth = sourceWidth;
    let cropHeight = sourceWidth / wanted;
    if (cropHeight > sourceHeight) { cropHeight = sourceHeight; cropWidth = sourceHeight * wanted; }
    backdropContext.drawImage(video, (sourceWidth - cropWidth) / 2, (sourceHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, backdrop.width, backdrop.height);
  }

  function syncCaption() {
    if (finished) return;
    paintBackdrop();
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
    overlay.classList.add('leaving');
    setTimeout(() => { overlay.remove(); }, 700);
    try { video.pause(); } catch {}
  }

  // 소리가 막혀 있었다면 첫 터치(인트로 중이든 타이틀이든)에서 시작한다.
  const unlockAudio = () => {
    if (musicStopped || window.__introActive === false) return;
    if (!started) ensureMusic();
    else layers.forEach(audio => { if (audio.paused && !audio.ended) audio.play().then(() => { soundHint.hidden = true; }).catch(() => {}); });
  };
  document.addEventListener('pointerdown', unlockAudio, true);

  overlay.querySelector('.intro-skip').addEventListener('click', event => {
    event.stopPropagation();
    finish();
  });
  overlay.addEventListener('click', event => { if (!event.target.closest('.intro-skip')) { event.stopPropagation(); } }, true);
  video.addEventListener('ended', () => setTimeout(finish, TITLE_HOLD));
  video.addEventListener('error', finish);
  video.addEventListener('playing', () => { video.playbackRate = RATE; ensureMusic(); syncCaption(); }, { once: true });

  video.defaultPlaybackRate = RATE;
  video.playbackRate = RATE;
  const play = video.play();
  if (play?.catch) play.catch(() => finish());
  // 영상이 오래 안 뜨면(네트워크 문제 등) 5초 뒤 건너뛴다.
  setTimeout(() => { if (!finished && video.readyState < 2) finish(); }, 5000);
})();
