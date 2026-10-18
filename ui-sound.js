(() => {
  const clickSound = window.createGameAudio('sound/ui_button_click.ogg');
  clickSound.preload = 'auto';
  clickSound.volume = 0.24;
  const fleetReadySound = window.createGameAudio('sound/fleet_ready.wav');
  fleetReadySound.preload = 'auto';
  fleetReadySound.volume = 0.3;
  const fleetShipSelectSound = window.createGameAudio('sound/fleet.wav');
  fleetShipSelectSound.preload = 'auto';
  fleetShipSelectSound.volume = 0.3;
  const emptySlotSound = window.createGameAudio('sound/empty_slot.wav');
  emptySlotSound.preload = 'auto';
  emptySlotSound.volume = 0.3;
  const mapPitchUpSound = window.createGameAudio('sound/map_pitch_up.ogg');
  mapPitchUpSound.preload = 'auto';
  mapPitchUpSound.volume = 0.3;
  const mapBackSound = window.createGameAudio('sound/map.wav');
  mapBackSound.preload = 'auto';
  mapBackSound.volume = 0.3;
  const labSound = window.createGameAudio('sound/lab.wav');
  labSound.preload = 'auto';
  labSound.volume = 0.3;
  const bridgeSound = window.createGameAudio('sound/bridge.wav');
  bridgeSound.preload = 'auto';
  bridgeSound.volume = 0.3;
  const deploySound = window.createGameAudio('sound/deploy.wav');
  deploySound.preload = 'auto';
  deploySound.volume = 0.38;
  const engageSound = window.createGameAudio('sound/engage.wav');
  engageSound.preload = 'auto';
  engageSound.volume = 0.38;
  const arkaGreetingSounds = ['sound/arka_greet.ogg', 'sound/arka_yes.ogg'].map(src => {
    const audio = window.createGameAudio(src);
    audio.preload = 'auto';
    audio.volume = 0.48;
    return audio;
  });

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
    const isBattleFleetManagementButton=control.matches('#battle-forfeit')&&control.textContent.trim()==='함대관리';
    const isBattleFleetSetupButton=control.matches('#battle-start')&&control.querySelector('b')?.textContent.trim()==='함대 편성';
    const usesFleetReadySound = control.matches(
      '.fixed-nav [data-screen="collection"], [data-panel="hangar"], .deck-shortcut.hangar, .formation-slot'
    )||isBattleFleetManagementButton||isBattleFleetSetupButton;
    const usesChapterBackSound = control.matches('.chapter-back');
    const usesOperationRegionClickSound = control.matches('.planet-hit, .magenta-pin');
    const usesMapPitchUpSound = control.matches('.fixed-nav [data-screen="map"], #battle-map, .chapter-picker .chapter-card, .galactic-solar');
    const usesDeploySound = control.matches('.deck-launch, .campaign-battle, .magenta-deploy');
    const usesEngageSound = control.matches('#battle-start')&&control.querySelector('b')?.textContent.trim()==='전투개시';
    const usesLabSound = control.matches('.fixed-nav [data-screen="summon"], .research-tab[data-research="ship"], .research-tab[data-research="weapon"], .deck-shortcut.research');
    const usesBridgeSound = control.matches('.fixed-nav [data-screen="home"]');
    const usesShopSound = control.matches('.deck-shortcut.store, [data-panel="store"]');
    const sound = usesShopSound ? arkaGreetingSounds[Math.floor(Math.random() * arkaGreetingSounds.length)] : usesChapterBackSound ? mapBackSound : usesOperationRegionClickSound ? clickSound : usesEngageSound ? engageSound : usesDeploySound ? deploySound : usesMapPitchUpSound ? mapPitchUpSound : usesLabSound ? labSound : usesBridgeSound ? bridgeSound : usesSlotClearSound || usesEmptySlotSound ? emptySlotSound : usesFleetShipSelectSound ? fleetShipSelectSound : usesHangarClickSound ? clickSound : usesFleetReadySound ? fleetReadySound : clickSound;

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
