// 타이틀(대문) 화면 — 앱을 열면 먼저 보이고, "게임 시작"을 누르면 함교 화면으로 넘어갑니다.
(() => {
  'use strict';
  const screen = document.getElementById('title-screen');
  if (!screen) return;
  const infoPanel = document.getElementById('title-info-panel');
  const infoButton = document.getElementById('title-info');

  const playClick = () => {
    try {
      const sound = window.createGameAudio ? window.createGameAudio('sound/ui_button_click.ogg') : new Audio('sound/ui_button_click.ogg');
      sound.volume = 0.24;
      sound.play().catch(() => {});
    } catch {}
  };

  const startGame = () => {
    window.dispatchEvent(new Event('title-start'));
    screen.classList.add('leaving');
    setTimeout(() => { screen.hidden = true; }, 450);
  };

  const toggleInfo = () => {
    const open = infoPanel.hidden;
    infoPanel.hidden = !open;
    infoButton.setAttribute('aria-expanded', String(open));
  };

  // ───────── 연출: 레이저포가 가끔 크루저 근처로 지나간다 ─────────
  // 크루저는 오른쪽 아래를 향하고 있어서, 레이저는 그 방향(약 24도)으로 곁을 스쳐 지나간다.
  // 가끔은 반대편에서 날아오는 붉은 적 포격도 지나간다. 맞히지는 않는다.
  const hero = screen.querySelector('.title-hero');
  const HEADING = 24;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function fireBolt(enemy = false) {
    if (!hero || screen.hidden || screen.classList.contains('leaving')) return;
    const rect = hero.getBoundingClientRect();
    if (!rect.width) return;
    const bolt = document.createElement('i');
    bolt.className = `title-bolt${enemy ? ' enemy' : ''}`;
    const heading = (HEADING + (Math.random() * 8 - 4)) * Math.PI / 180;
    const along = { x: Math.cos(heading), y: Math.sin(heading) };
    const normal = { x: -along.y, y: along.x };
    // 크루저 중심에서 옆으로 45~100px 비켜서 지나간다(어느 쪽인지는 무작위).
    const side = (Math.random() < .5 ? -1 : 1) * (45 + Math.random() * 55);
    const center = { x: rect.left + rect.width / 2 + normal.x * side, y: rect.top + rect.height / 2 + normal.y * side };
    const reach = Math.max(window.innerWidth, window.innerHeight) * .75;
    const direction = enemy ? -1 : 1;
    const from = { x: center.x - along.x * reach * direction, y: center.y - along.y * reach * direction };
    const to = { x: center.x + along.x * reach * direction, y: center.y + along.y * reach * direction };
    const angle = HEADING + (enemy ? 180 : 0);
    const pose = point => `translate(${point.x}px, ${point.y}px) rotate(${angle}deg)`;
    screen.append(bolt);
    const flight = bolt.animate([
      { transform: pose(from), opacity: 0 },
      { opacity: 1, offset: .12 },
      { opacity: 1, offset: .86 },
      { transform: pose(to), opacity: 0 }
    ], { duration: enemy ? 1100 : 850, easing: 'cubic-bezier(.3,0,.7,1)' });
    flight.onfinish = () => bolt.remove();
  }

  function scheduleBolt() {
    const wait = 2600 + Math.random() * 4200;
    setTimeout(() => {
      // 인트로 영상이 위를 덮고 있는 동안은 건너뛴다.
      if (!document.hidden && !document.getElementById('intro-video')) {
        const enemy = Math.random() < .25;
        fireBolt(enemy);
        if (!enemy && Math.random() < .3) setTimeout(() => fireBolt(false), 260);
      }
      if (!screen.hidden) scheduleBolt();
    }, wait);
  }
  if (!reduced) scheduleBolt();
  window.titleScreenFx = { fireBolt };

  // 타이틀이 떠 있는 동안의 클릭은 여기서 먼저 처리합니다.
  // 튜토리얼 등 다른 화면의 클릭 차단기보다 먼저 받아야 버튼이 눌립니다.
  window.addEventListener('click', event => {
    if (screen.hidden || !screen.contains(event.target)) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    const button = event.target.closest('button');
    if (button?.id === 'title-start') {
      playClick();
      startGame();
    } else if (button?.id === 'title-info') {
      playClick();
      toggleInfo();
    }
  }, true);
})();
