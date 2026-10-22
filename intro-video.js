// 앱을 열면 타이틀 화면 앞에 인트로 영상(15초 영상을 0.7배속으로 약 21.5초)을 보여 준다.
// - 영상은 가로(16:9)라서 세로 화면 가운데에 "시네마 창"으로 띄우고, 아래 자막 띠는 잘라 낸 뒤 자막은 게임이 직접 그린다.
// - 음악은 sound/intro.mp3 를 영상과 함께 틀고, 끝날 때 서서히 줄인다. 게임 설정의 음악 켜기/볼륨을 따른다.
// - 오른쪽 위 '건너뛰기'로 언제든 넘길 수 있고, 끝나면 타이틀 화면이 나타난다. 주소에 ?nointro 가 있으면 건너뛴다(테스트용).
(() => {
  'use strict';
  if (/[?&]nointro\b/.test(location.search)) return;

  const VIDEO_SRC = 'intro-cinematic.mp4';
  const MUSIC_SRC = 'sound/intro.mp3';
  const RATE = .7;               // 재생 배속
  const TITLE_HOLD = 2200;       // 영상이 끝난 뒤 제목 카드를 더 보여 주는 시간(ms)
  const MUSIC_LEVEL = .8;
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

  // ───────── 음악 ─────────
  let track = null;
  let fadeTimer = 0;

  function fadeTrack(to, seconds, done) {
    clearInterval(fadeTimer);
    if (!track) return;
    const audio = track;
    const from = audio.volume;
    const started = performance.now();
    fadeTimer = setInterval(() => {
      const ratio = Math.min(1, (performance.now() - started) / (seconds * 1000));
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * ratio));
      if (ratio >= 1) { clearInterval(fadeTimer); done?.(); }
    }, 40);
  }

  function ensureMusic() {
    if (finished || track) return;
    // 게임 설정(음악 켜기/볼륨)을 따르는 오디오로 만든다.
    track = window.createGameAudio ? window.createGameAudio(MUSIC_SRC, 'music') : new Audio(MUSIC_SRC);
    track.loop = false;
    track.volume = 0;
    // 영상과 어긋나지 않게, 늦게 시작하면 영상이 흐른 시간만큼 건너뛴다.
    const elapsed = (video.currentTime || 0) / RATE;
    const start = () => { try { if (elapsed > 0.3) track.currentTime = elapsed; } catch {} };
    track.addEventListener('loadedmetadata', start, { once: true });
    const attempt = track.play();
    if (attempt?.then) {
      attempt.then(() => { soundHint.hidden = true; fadeTrack(MUSIC_LEVEL, 1.2); })
        .catch(() => { track = null; soundHint.hidden = false; });
    } else fadeTrack(MUSIC_LEVEL, 1.2);
  }

  function stopMusic(seconds = 1.8) {
    if (!track) return;
    const audio = track;
    fadeTrack(0, seconds, () => { try { audio.pause(); } catch {} });
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
    stopMusic(1.8);
    overlay.classList.add('leaving');
    window.__introActive = false;
    window.dispatchEvent(new Event('intro-finished'));
    setTimeout(() => { overlay.remove(); }, 700);
    try { video.pause(); } catch {}
  }

  const unlockAudio = () => {
    if (finished) return;
    if (!track) ensureMusic();
    else if (track.paused) track.play().then(() => { soundHint.hidden = true; }).catch(() => {});
  };

  overlay.querySelector('.intro-skip').addEventListener('click', event => {
    event.stopPropagation();
    finish();
  });
  overlay.addEventListener('pointerdown', unlockAudio);
  overlay.addEventListener('click', event => { if (!event.target.closest('.intro-skip')) { event.stopPropagation(); } }, true);
  video.addEventListener('ended', () => setTimeout(finish, TITLE_HOLD));
  video.addEventListener('error', finish);
  video.addEventListener('playing', () => { video.playbackRate = RATE; ensureMusic(); syncCaption(); }, { once: true });

  video.defaultPlaybackRate = RATE;
  video.playbackRate = RATE;
  overlay.querySelector('.intro-window video').style.animationDuration = `${15 / RATE}s`;
  const play = video.play();
  if (play?.catch) play.catch(() => finish());
  // 영상이 오래 안 뜨면(네트워크 문제 등) 5초 뒤 건너뛴다.
  setTimeout(() => { if (!finished && video.readyState < 2) finish(); }, 5000);
})();
