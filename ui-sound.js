(() => {
  const clickSound = window.createGameAudio('sound/ui_button_click.ogg');
  clickSound.preload = 'auto';
  clickSound.volume = 0.24;
  // 메뉴 이동 버튼(하단 메뉴·작전지도·연구실·함대관리·뒤로가기 등)은 모두 기본 딸깍 음(clickSound)을 쓴다.
  // 아래의 따로 정한 소리는 행동을 알려 주는 것(편대 슬롯·함선 선택·슬롯 비우기·출격·전투개시·상점 인사)뿐이다.
  const fleetReadySound = window.createGameAudio('sound/fleet_ready.wav');
  fleetReadySound.preload = 'auto';
  fleetReadySound.volume = 0.3;
  const fleetShipSelectSound = window.createGameAudio('sound/fleet.wav');
  fleetShipSelectSound.preload = 'auto';
  fleetShipSelectSound.volume = 0.3;
  const emptySlotSound = window.createGameAudio('sound/empty_slot.wav');
  emptySlotSound.preload = 'auto';
  emptySlotSound.volume = 0.3;
  const deploySound = window.createGameAudio('sound/deploy.wav');
  deploySound.preload = 'auto';
  deploySound.volume = 0.38;
  const engageSound = window.createGameAudio('sound/engage.wav');
  engageSound.preload = 'auto';
  engageSound.volume = 0.38;
  // 상점에 들어갈 때 외계 상인의 인사(웹 오디오로 직접 합성한 목소리, alien-voice.js). 두 가지 중 무작위.
  const arkaGreetingSounds = ['greet', 'yes'].map(kind => window.createAlienVoice ? window.createAlienVoice(kind, 0.9) : { play() {}, set currentTime(_) {} });

  const interactiveSelector = [
    'button',
    '[role="button"]',
    '[role="option"]',
    '[role="menuitem"]',
    '[role="tab"]',
    '.codex-ship-card',
    '.formation-slot'
  ].join(',');
  let lastPlayedAt = 0;

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest(interactiveSelector);
    if (!control || control.closest('[inert]')) return;
    if (control.matches(':disabled,[aria-disabled="true"]')) return;
    if (control.matches('.tactical-research-actions [data-tactical-pull], .tactical-research-again')) return;

    const usesEmptySlotSound = control.matches('.formation-slot:not(.occupied)');
    const usesSlotClearSound = control.matches('.slot-clear-button')&&control.textContent.trim()==='슬롯 비우기';
    const usesFleetShipSelectSound = control.matches('.fleet-ship-choice:not(.owned-ship-choice)');
    const usesHangarClickSound = Boolean(control.closest('.fleet-hangar-popup, .fleet-codex-popup'));
    const usesFleetReadySound = control.matches('.formation-slot');
    const usesDeploySound = control.matches('.deck-launch, .campaign-battle, .magenta-deploy');
    const usesEngageSound = control.matches('#battle-start')&&control.querySelector('b')?.textContent.trim()==='전투개시';
    const usesShopSound = control.matches('.deck-shortcut.store, [data-panel="store"]');
    const sound = usesShopSound ? arkaGreetingSounds[Math.floor(Math.random() * arkaGreetingSounds.length)] : usesEngageSound ? engageSound : usesDeploySound ? deploySound : usesSlotClearSound || usesEmptySlotSound ? emptySlotSound : usesFleetShipSelectSound ? fleetShipSelectSound : usesHangarClickSound ? clickSound : usesFleetReadySound ? fleetReadySound : clickSound;

    const now = performance.now();
    if (now - lastPlayedAt < 55) return;
    lastPlayedAt = now;

    try {
      sound.currentTime = 0;
      const playback = sound.play();
      if (playback && typeof playback.catch === 'function') playback.catch(() => {});
    } catch {
      // Audio playback is optional; unavailable codecs/devices must not block UI actions.
    }
  }, true);
})();
