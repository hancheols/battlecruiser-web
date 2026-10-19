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
    screen.classList.add('leaving');
    setTimeout(() => { screen.hidden = true; }, 450);
  };

  const toggleInfo = () => {
    const open = infoPanel.hidden;
    infoPanel.hidden = !open;
    infoButton.setAttribute('aria-expanded', String(open));
  };

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
