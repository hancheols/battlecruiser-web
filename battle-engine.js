(() => {
  'use strict';

  // 전투 배속: 전투 코드 안의 시간(performance.now)과 예약 실행(schedule)을 하나의 "전투 시계"로 묶어,
  // 배속을 바꾸면 이동·쿨다운·스킬 지속시간·탄환 명중이 모두 같은 비율로 빨라집니다(전투 결과는 동일).
  const realPerformance = window.performance;
  const BATTLE_SPEED_KEY = 'starfleet-battle-speed-v1';
  let battleSpeed = 1;
  let battleClock = realPerformance.now();
  let battleClockRealAt = battleClock;
  const battleNow = () => {
    const real = realPerformance.now();
    battleClock += (real - battleClockRealAt) * battleSpeed;
    battleClockRealAt = real;
    return battleClock;
  };
  const performance = { now: battleNow };
  const setBattleClockSpeed = speed => { battleNow(); battleSpeed = speed; };

  const RARITY_COLORS = { L: '#ff526d', SSR: '#ffd45b', SR: '#c883ff', R: '#69d8ff' };
  const ENHANCEMENT_RATE = { R: .2, SR: .2, SSR: .4, L: .4 };
  // 밸런스: 아군 내구 2배, PvE에서 적 공격 2배 (교전 시간 거의 동일하게 유지되는 조합)
  const ALLY_HP_BALANCE = 2;
  const ENEMY_ATTACK_BALANCE = 2;
  let activeDamageSource = null;
  function withDamageSource(source, action) {
    const previous = activeDamageSource;
    activeDamageSource = source;
    try { return action(); } finally { activeDamageSource = previous; }
  }
  function combatStatFactor(source) {
    const ship = source?.owner?.ship || source?.ship || source;
    if (!ship || !ship.type) return 1;
    const stars = Math.max(0, Math.floor(Number(ship.enhancementStars ?? ship.stars) || 0));
    const rarity = ship.rarity || 'R';
    return 1 + stars * (ENHANCEMENT_RATE[rarity] || .2) + (ship.baseRarity && rarity !== ship.baseRarity ? breakthroughBonus(ship.baseRarity, rarity) : 0);
  }
  // 돌파 가산분(도감·아레나와 같은 규칙): SR 5성(+100%) → SSR 0성 +140%, 원래 R → SR은 +50%.
  function breakthroughBonus(baseRarity, rarity) {
    const order = ['R', 'SR', 'SSR', 'L'];
    if (!baseRarity || baseRarity === 'R') return .5;
    const from = order.indexOf(baseRarity), to = order.indexOf(rarity);
    if (from < 0 || to <= from) return 0;
    let multiplier = 1 + 5 * (ENHANCEMENT_RATE[baseRarity] || .2);
    for (let index = from + 1; index <= to; index += 1) {
      multiplier += ENHANCEMENT_RATE[order[index]] || .2;
      if (index < to) multiplier += 5 * (ENHANCEMENT_RATE[order[index]] || .2);
    }
    return multiplier - 1;
  }
  const battleAudioPools=[];
  const battleAudioPriorityUntil=[0,0,0,0];
  let battleAudioMixTimer=null;
  function refreshBattleAudioMix(){
    const now=performance.now();let priority=0,nextExpiry=Infinity;
    for(let level=1;level<=3;level+=1){if(battleAudioPriorityUntil[level]>now){priority=Math.max(priority,level);nextExpiry=Math.min(nextExpiry,battleAudioPriorityUntil[level]);}}
    const duckFactor=priority===3?.14:priority===2?.24:priority===1?.4:1;
    battleAudioPools.forEach(pool=>pool.voices.forEach(audio=>{audio.volume=pool.baseVolume*(priority>pool.priority?duckFactor:1);}));
    clearTimeout(battleAudioMixTimer);
    if(Number.isFinite(nextExpiry))battleAudioMixTimer=setTimeout(refreshBattleAudioMix,Math.max(0,nextExpiry-now)+8);
  }
  function registerBattleAudioPool(voices,baseVolume,priority=0){battleAudioPools.push({voices,baseVolume,priority});refreshBattleAudioMix();}
  const battleLoseAudio=window.createGameAudio('sound/lose.mp3');battleLoseAudio.preload='auto';battleLoseAudio.volume=.65;
  const battleLoseVoices=Array.from({length:2},()=>battleLoseAudio.cloneNode());registerBattleAudioPool(battleLoseVoices,.65,2);
  let battleLoseVoiceIndex=0;
  function playBattleLoseSound(){const audio=battleLoseVoices[battleLoseVoiceIndex++%battleLoseVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  function focusBattleAudio(priority){
    const settings={retreat:[1,950],core:[2,1350],boss:[3,2100]}[priority];if(!settings)return;
    const [level,duration]=settings;battleAudioPriorityUntil[level]=Math.max(battleAudioPriorityUntil[level],performance.now()+duration);refreshBattleAudioMix();
  }
  const bossRoarAudio=window.createGameAudio('sound/boss_roar.wav');bossRoarAudio.preload='auto';bossRoarAudio.volume=.72;
  const bossRoarVoices=Array.from({length:2},()=>bossRoarAudio.cloneNode());registerBattleAudioPool(bossRoarVoices,.72,3);
  const bossKillAudio=window.createGameAudio('sound/boss_kill.wav');bossKillAudio.preload='auto';bossKillAudio.volume=.72;
  const bossKillVoices=Array.from({length:2},()=>bossKillAudio.cloneNode());registerBattleAudioPool(bossKillVoices,.72,3);
  const bossFireAudio=window.createGameAudio('sound/boss_fire_02.mp3');bossFireAudio.preload='auto';bossFireAudio.volume=.62;
  const bossFireVoices=Array.from({length:4},()=>bossFireAudio.cloneNode());registerBattleAudioPool(bossFireVoices,.62,3);
  const bossBladeVolleyAudio=window.createGameAudio('sound/boss_blade_volley_8x.ogg');bossBladeVolleyAudio.preload='auto';bossBladeVolleyAudio.volume=.68;
  const bossBladeVolleyVoices=Array.from({length:2},()=>bossBladeVolleyAudio.cloneNode());registerBattleAudioPool(bossBladeVolleyVoices,.68,3);
  const poisonBombAudio=window.createGameAudio('sound/poison_bomb.wav');poisonBombAudio.preload='auto';poisonBombAudio.volume=.6;
  const poisonBombVoices=Array.from({length:3},()=>poisonBombAudio.cloneNode());registerBattleAudioPool(poisonBombVoices,.6,2);
  const midBossKillAudio=window.createGameAudio('sound/boss_mid_kill.wav');midBossKillAudio.preload='auto';midBossKillAudio.volume=.72;
  const midBossKillVoices=Array.from({length:2},()=>midBossKillAudio.cloneNode());registerBattleAudioPool(midBossKillVoices,.72,3);
  let bossRoarVoiceIndex=0,bossKillVoiceIndex=0,midBossKillVoiceIndex=0,bossFireVoiceIndex=0,bossBladeVolleyVoiceIndex=0,poisonBombVoiceIndex=0;
  function playBossRoarSound(){const audio=bossRoarVoices[bossRoarVoiceIndex++%bossRoarVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  // 보스 출현 경고음: 파일 없이 합성음(사이렌처럼 오르내리는 톤 3회)으로 만든다. 설정의 효과음 음량·끄기를 따른다.
  let bossWarningCtx = null;
  // 보스 출현 경고음: 게임 음원 sound/alert.mp3를 재생한다.
  const bossAlertAudio = window.createGameAudio('sound/alert.mp3');
  bossAlertAudio.preload = 'auto';
  function playBossWarningSiren(){
    try{ bossAlertAudio.currentTime = 0; bossAlertAudio.play().catch(()=>{}); }catch{}
  }
  function playBossKillSound(){const audio=bossKillVoices[bossKillVoiceIndex++%bossKillVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  function playBossFireSound(){const audio=bossFireVoices[bossFireVoiceIndex++%bossFireVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  function playBossBladeVolleySound(){const audio=bossBladeVolleyVoices[bossBladeVolleyVoiceIndex++%bossBladeVolleyVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  function playPoisonBombSound(){const audio=poisonBombVoices[poisonBombVoiceIndex++%poisonBombVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  function playMidBossKillSound(){const audio=midBossKillVoices[midBossKillVoiceIndex++%midBossKillVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const machineBossSounds = {
    fly: window.createGameAudio('sound/machineBoss_fly.wav'),
    shock: window.createGameAudio('sound/machineBoss_shock.ogg'),
    icebeam: window.createGameAudio('sound/machineBoss_icebeam.ogg')
  };
  const machineBossSoundVoices = Object.fromEntries(Object.entries(machineBossSounds).map(([name, source]) => {
    source.preload = 'auto';
    source.volume = name === 'icebeam' ? .48 : .68;
    const voices = Array.from({ length: name === 'icebeam' ? 3 : 2 }, () => source.cloneNode());
    registerBattleAudioPool(voices, source.volume, name === 'icebeam' ? 1 : 3);
    return [name, voices];
  }));
  const machineBossSoundIndex = { fly: 0, shock: 0, icebeam: 0 };
  function playMachineBossSound(name) {
    const voices = machineBossSoundVoices[name];
    if (!voices) return;
    const audio = voices[machineBossSoundIndex[name]++ % voices.length];
    try { audio.currentTime = 0; audio.play().catch(() => {}); } catch {}
  }
  const turtleChargeAudio=window.createGameAudio('sound/turtle_charge.wav');turtleChargeAudio.preload='auto';turtleChargeAudio.volume=.62;
  const turtleChargeVoices=Array.from({length:2},()=>turtleChargeAudio.cloneNode());registerBattleAudioPool(turtleChargeVoices,.62);
  const turtleShockAudio=window.createGameAudio('sound/turtle_shock.wav');turtleShockAudio.preload='auto';turtleShockAudio.volume=.72;
  const turtleShockVoices=Array.from({length:2},()=>turtleShockAudio.cloneNode());registerBattleAudioPool(turtleShockVoices,.72);
  let turtleChargeVoiceIndex=0,turtleShockVoiceIndex=0;
  function playTurtleChargeSound(){const audio=turtleChargeVoices[turtleChargeVoiceIndex++%turtleChargeVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  function playTurtleShockSound(){const audio=turtleShockVoices[turtleShockVoiceIndex++%turtleShockVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const cannonFireAudio=window.createGameAudio('sound/heavy_cannon_fire.ogg');
  cannonFireAudio.preload='auto';
  cannonFireAudio.volume=.38;
  const cannonFireVoices=Array.from({length:12},()=>cannonFireAudio.cloneNode());
  registerBattleAudioPool(cannonFireVoices,.38);
  let cannonFireVoiceIndex=0;
  function playCannonFireSound(){
    const audio=cannonFireVoices[cannonFireVoiceIndex++%cannonFireVoices.length];
    try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}
  }
  const deimosShotgunAudio=window.createGameAudio('sound/Deimoth_shotgun.ogg');deimosShotgunAudio.preload='auto';deimosShotgunAudio.volume=.58;
  const deimosShotgunVoices=Array.from({length:4},()=>deimosShotgunAudio.cloneNode());registerBattleAudioPool(deimosShotgunVoices,.58);
  let deimosShotgunVoiceIndex=0;
  function playDeimosShotgunSound(){const audio=deimosShotgunVoices[deimosShotgunVoiceIndex++%deimosShotgunVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const missileLaunchAudio=window.createGameAudio('sound/missile_fire.wav');
  missileLaunchAudio.preload='auto';
  missileLaunchAudio.volume=.42;
  const missileLaunchVoices=Array.from({length:4},()=>missileLaunchAudio.cloneNode());
  registerBattleAudioPool(missileLaunchVoices,.42);
  let missileLaunchVoiceIndex=0;
  const missileImpactAudio=window.createGameAudio('sound/missile_shell_explosion.ogg');
  missileImpactAudio.preload='auto';
  missileImpactAudio.volume=.48;
  const missileImpactVoices=Array.from({length:4},()=>missileImpactAudio.cloneNode());
  registerBattleAudioPool(missileImpactVoices,.48);
  let missileImpactVoiceIndex=0;
  function playMissileLaunchSound(){const audio=missileLaunchVoices[missileLaunchVoiceIndex++%missileLaunchVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  function playMissileImpactSound(){const audio=missileImpactVoices[missileImpactVoiceIndex++%missileImpactVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const nuclearExplosionAudio=window.createGameAudio('sound/loud-explosion.mp3');nuclearExplosionAudio.preload='auto';nuclearExplosionAudio.volume=.85;
  const nuclearExplosionVoices=Array.from({length:2},()=>nuclearExplosionAudio.cloneNode());registerBattleAudioPool(nuclearExplosionVoices,.85,3);
  let nuclearExplosionVoiceIndex=0;
  function playNuclearExplosionSound(){const audio=nuclearExplosionVoices[nuclearExplosionVoiceIndex++%nuclearExplosionVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const pojakseonExplosionAudio=window.createGameAudio('sound/medium-explosion.mp3');pojakseonExplosionAudio.preload='auto';pojakseonExplosionAudio.volume=.58;
  const pojakseonExplosionVoices=Array.from({length:4},()=>pojakseonExplosionAudio.cloneNode());registerBattleAudioPool(pojakseonExplosionVoices,.58,2);
  let pojakseonExplosionVoiceIndex=0;
  function playPojakseonExplosionSound(){const audio=pojakseonExplosionVoices[pojakseonExplosionVoiceIndex++%pojakseonExplosionVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const varyagDroneAudio=window.createGameAudio('sound/varac_drone.wav');varyagDroneAudio.preload='auto';varyagDroneAudio.volume=.42;
  const varyagDroneVoices=Array.from({length:8},()=>varyagDroneAudio.cloneNode());registerBattleAudioPool(varyagDroneVoices,.42);
  let varyagDroneVoiceIndex=0;
  function playVaryagDroneSound(){const audio=varyagDroneVoices[varyagDroneVoiceIndex++%varyagDroneVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const panokFlymineAudio=window.createGameAudio('sound/panok_flymine.ogg');panokFlymineAudio.preload='auto';panokFlymineAudio.volume=.46;
  const panokFlymineVoices=Array.from({length:8},()=>panokFlymineAudio.cloneNode());registerBattleAudioPool(panokFlymineVoices,.46);
  const flymineBoomAudio=window.createGameAudio('sound/flymine_boom.wav');flymineBoomAudio.preload='auto';flymineBoomAudio.volume=.5;
  const flymineBoomVoices=Array.from({length:8},()=>flymineBoomAudio.cloneNode());registerBattleAudioPool(flymineBoomVoices,.5);
  let panokFlymineVoiceIndex=0,flymineBoomVoiceIndex=0;
  function playPanokFlymineSound(){const audio=panokFlymineVoices[panokFlymineVoiceIndex++%panokFlymineVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  function playFlymineBoomSound(){const audio=flymineBoomVoices[flymineBoomVoiceIndex++%flymineBoomVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const laserZapAudio=window.createGameAudio('sound/laser_zap.ogg');laserZapAudio.preload='auto';laserZapAudio.volume=.34;
  const laserZapVoices=Array.from({length:4},()=>laserZapAudio.cloneNode());registerBattleAudioPool(laserZapVoices,.34);
  let laserZapVoiceIndex=0,lastLaserZapAt=-Infinity;
  function playLaserZapSound(){const now=performance.now();if(now-lastLaserZapAt<90)return;lastLaserZapAt=now;const audio=laserZapVoices[laserZapVoiceIndex++%laserZapVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const cruiserLaserAudio=window.createGameAudio('sound/laser_cannon_cruiser.ogg');cruiserLaserAudio.preload='auto';cruiserLaserAudio.volume=.42;
  const cruiserLaserVoices=Array.from({length:4},()=>cruiserLaserAudio.cloneNode());registerBattleAudioPool(cruiserLaserVoices,.42);
  let cruiserLaserVoiceIndex=0,lastCruiserLaserAt=-Infinity;
  function playCruiserLaserSound(){const now=performance.now();if(now-lastCruiserLaserAt<90)return;lastCruiserLaserAt=now;const audio=cruiserLaserVoices[cruiserLaserVoiceIndex++%cruiserLaserVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const photonChargeAudio=window.createGameAudio('sound/cruiser_photon_chrg.ogg');photonChargeAudio.preload='auto';photonChargeAudio.volume=.82;
  const photonChargeVoices=Array.from({length:3},()=>photonChargeAudio.cloneNode());registerBattleAudioPool(photonChargeVoices,.82,3);
  let photonChargeVoiceIndex=0;
  function playPhotonChargeSound(){const audio=photonChargeVoices[photonChargeVoiceIndex++%photonChargeVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const photonShotAudio=window.createGameAudio('sound/cruiser_photon_shot.ogg');photonShotAudio.preload='auto';photonShotAudio.volume=.55;
  const photonShotVoices=Array.from({length:8},()=>photonShotAudio.cloneNode());registerBattleAudioPool(photonShotVoices,.55,2);
  let photonShotVoiceIndex=0;
  function playPhotonShotSound(){const audio=photonShotVoices[photonShotVoiceIndex++%photonShotVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const brownBessShotVoices=Array.from({length:4},()=>photonShotAudio.cloneNode());registerBattleAudioPool(brownBessShotVoices,.55,0);
  let brownBessShotVoiceIndex=0;
  function playBrownBessShotSound(){const audio=brownBessShotVoices[brownBessShotVoiceIndex++%brownBessShotVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const rLaserAudio=window.createGameAudio('sound/laser_cannon_R.ogg');rLaserAudio.preload='auto';rLaserAudio.volume=.42;
  const rLaserVoices=Array.from({length:16},()=>rLaserAudio.cloneNode());registerBattleAudioPool(rLaserVoices,.42,3);
  let rLaserVoiceIndex=0;
  function playRLaserSound(){const audio=rLaserVoices[rLaserVoiceIndex++%rLaserVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const penetrateBeamAudio=window.createGameAudio('sound/penetrate-beam-weapon.ogg');penetrateBeamAudio.preload='auto';penetrateBeamAudio.volume=.48;
  const penetrateBeamVoices=Array.from({length:8},()=>penetrateBeamAudio.cloneNode());registerBattleAudioPool(penetrateBeamVoices,.48,3);
  let penetrateBeamVoiceIndex=0;
  function playPenetrateBeamSound(){const audio=penetrateBeamVoices[penetrateBeamVoiceIndex++%penetrateBeamVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const supernovaLaserAudio=window.createGameAudio('sound/starD_laser.ogg');supernovaLaserAudio.preload='auto';supernovaLaserAudio.volume=.7;
  const supernovaLaserVoices=Array.from({length:2},()=>supernovaLaserAudio.cloneNode());registerBattleAudioPool(supernovaLaserVoices,.7,3);
  let supernovaLaserVoiceIndex=0;
  function playSupernovaLaserSound(){const audio=supernovaLaserVoices[supernovaLaserVoiceIndex++%supernovaLaserVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}return audio;}
  const hyperionWarpAudio=window.createGameAudio('sound/hyperion_warp.ogg');hyperionWarpAudio.preload='auto';hyperionWarpAudio.volume=.6;
  const hyperionWarpVoices=Array.from({length:2},()=>hyperionWarpAudio.cloneNode());registerBattleAudioPool(hyperionWarpVoices,.6,2);
  let hyperionWarpVoiceIndex=0;
  function playHyperionWarpSound(){const audio=hyperionWarpVoices[hyperionWarpVoiceIndex++%hyperionWarpVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const electricWeaponAudio=window.createGameAudio('sound/electric_weapon_01.ogg');electricWeaponAudio.preload='auto';electricWeaponAudio.volume=.38;
  const electricWeaponVoices=Array.from({length:4},()=>electricWeaponAudio.cloneNode());registerBattleAudioPool(electricWeaponVoices,.38);
  let electricWeaponVoiceIndex=0,lastElectricWeaponSoundAt=-Infinity;
  function playElectricWeaponSound(){const now=performance.now();if(now-lastElectricWeaponSoundAt<110)return;lastElectricWeaponSoundAt=now;const audio=electricWeaponVoices[electricWeaponVoiceIndex++%electricWeaponVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const kddxCoreAudio=window.createGameAudio('sound/KDDX_thunder.ogg');kddxCoreAudio.preload='auto';kddxCoreAudio.volume=.62;
  const kddxCoreVoices=Array.from({length:2},()=>kddxCoreAudio.cloneNode());registerBattleAudioPool(kddxCoreVoices,.62,2);
  let kddxCoreVoiceIndex=0;
  function playKddxCoreWeaponSound(){const audio=kddxCoreVoices[kddxCoreVoiceIndex++%kddxCoreVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const fighterLaunchAudio=window.createGameAudio('sound/jetcut.ogg');fighterLaunchAudio.preload='auto';fighterLaunchAudio.volume=.42;
  const fighterLaunchVoices=Array.from({length:8},()=>fighterLaunchAudio.cloneNode());registerBattleAudioPool(fighterLaunchVoices,.42);
  let fighterLaunchVoiceIndex=0,lastFighterLaunchSoundAt=-Infinity;
  function playFighterLaunchSound(){const now=performance.now();if(now-lastFighterLaunchSoundAt<90)return;lastFighterLaunchSoundAt=now;const audio=fighterLaunchVoices[fighterLaunchVoiceIndex++%fighterLaunchVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const fighterShotAudio=window.createGameAudio('sound/fighter_shot.ogg');fighterShotAudio.preload='auto';fighterShotAudio.volume=.46;
  const fighterShotVoices=Array.from({length:12},()=>fighterShotAudio.cloneNode());registerBattleAudioPool(fighterShotVoices,.46,3);
  let fighterShotVoiceIndex=0;
  function playFighterShotSound(){const audio=fighterShotVoices[fighterShotVoiceIndex++%fighterShotVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const colossusShieldAudio=window.createGameAudio('sound/colossus_shield_down.wav');colossusShieldAudio.preload='auto';colossusShieldAudio.volume=.58;
  const colossusShieldVoices=Array.from({length:2},()=>colossusShieldAudio.cloneNode());registerBattleAudioPool(colossusShieldVoices,.58,2);
  let colossusShieldVoiceIndex=0;
  function playColossusShieldSound(){const audio=colossusShieldVoices[colossusShieldVoiceIndex++%colossusShieldVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const angelaShieldAudio=window.createGameAudio('sound/angella_shield.ogg');
  angelaShieldAudio.preload='auto';angelaShieldAudio.volume=.55;
  const angelaShieldVoices=Array.from({length:3},()=>angelaShieldAudio.cloneNode());
  registerBattleAudioPool(angelaShieldVoices,.55,2);
  let angelaShieldVoiceIndex=0;
  function playAngelaShieldSound(){const audio=angelaShieldVoices[angelaShieldVoiceIndex++%angelaShieldVoices.length];try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}}
  const gasimonDeathAudio=window.createGameAudio('sound/monsdead04.mp3');
  gasimonDeathAudio.preload='auto';gasimonDeathAudio.volume=.5225;
  const gasimonDeathVoices=Array.from({length:3},()=>gasimonDeathAudio.cloneNode());
  registerBattleAudioPool(gasimonDeathVoices,.5225);
  const dokchimmonDeathAudio=window.createGameAudio('sound/monsdead03.mp3');
  dokchimmonDeathAudio.preload='auto';dokchimmonDeathAudio.volume=.5225;
  const dokchimmonDeathVoices=Array.from({length:3},()=>dokchimmonDeathAudio.cloneNode());
  registerBattleAudioPool(dokchimmonDeathVoices,.5225);
  const plasmaBugDeathAudio=window.createGameAudio('sound/plzBug_kill.wav');
  plasmaBugDeathAudio.preload='auto';plasmaBugDeathAudio.volume=.5225;
  const plasmaBugDeathVoices=Array.from({length:3},()=>plasmaBugDeathAudio.cloneNode());
  registerBattleAudioPool(plasmaBugDeathVoices,.5225);
  let gasimonDeathVoiceIndex=0,dokchimmonDeathVoiceIndex=0,plasmaBugDeathVoiceIndex=0;
  function playMonsterDeathSound(enemy){
    if(enemy?.monsterType==='plasma-bug'){
      const audio=plasmaBugDeathVoices[plasmaBugDeathVoiceIndex++%plasmaBugDeathVoices.length];
      try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}
      return;
    }
    const archetype=enemy?.archetype||enemy?.monsterType;
    const voices=archetype==='gasimon'||archetype==='jipgemon'?gasimonDeathVoices:archetype==='dokchimmon'||archetype==='suicidemon'?dokchimmonDeathVoices:null;
    if(!voices)return;
    const index=archetype==='dokchimmon'||archetype==='suicidemon'?dokchimmonDeathVoiceIndex++:gasimonDeathVoiceIndex++;
    const audio=voices[index%voices.length];
    try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}
  }
  const TYPE_LABELS = { dreadnought: '중전함', battlecruiser: '전투순양함', destroyer: '구축함', frigate: '프리깃' };
  const ROLE_LABELS = ['선봉', '좌익', '우익'];
  const WEAPONS = {
    missile:  { label: '미사일',   hits: 2, interval: 200, travel: 420, fx: 'missile' },
    laser:    { label: '레이저',   hits: 2, interval: 120, travel: 90,  fx: 'laser' },
    cannon:   { label: '레이저 포', hits: 2, interval: 350, travel: 120, fx: 'cannon' },
    plasma:   { label: '플라즈마', hits: 2, interval: 235, travel: 360, fx: 'plasma', splash: .5 },
    electric: { label: '전기 감전', hits: 2, interval: 360, travel: 100, fx: 'electric', chains: 3 }
  };
  const BATTLECRUISER_LASER = { hits: 125, starCruiserHits: 200, interval: 680, travel: 110 };
  const BATTLECRUISER_MAIN_BATTERY = { hits: 1000, charge: 1000, travel: 250, photonSplashRadius: 56, empoweredShots: 3, empoweredShotInterval: 260 };
  const IRONFIST_CANNON = { hits: 200, interval: 330, travel: 90, ports: 9 };
  const IRONFIST_MAIN = { cannonHits: 500, cannonShots: 3, cannonInterval: 1000, enhancedCannonShots: 6, enhancedCannonInterval: 500, missileHits: 250, missileRows: 5, missileInterval: 500, missileTravel: 420, duration: 2500, shieldRatio: .3, protectionDuration: 5000 };
  const IOWA_CANNON = { hits: 50, interval: 500 };
  const IOWA_TOMAHAWK = { hits: 500, enhancedHits: 700, splashRadius: 56, stun: 2000, fleetSpeedBonus: .5, fleetSpeedDuration: 3000, travel: 1500, acceleration: 500 };
  const HELIOS_REFRACTION = { hits: 100, interval: 800, travel: 120, chains: 2 };
  const HELIOS_MAIN = { hits: 200, enhancedHits: 400, shots: 5, duration: 2000, travel: 120, rechargePause: 3000 };
  const HYPERION_LASER = { hits: 300, interval: 330, travel: 110 };
  const HYPERION_MAIN = { hits: 300, interval: 100, duration: 2500, travel: 110, returnDelay: 500, movementSteps: 20, movementDistance: .26 };
  const HYPERION_MAX_OUTPUT = { durationMultiplier: 1.5, disruptionDuration: 3000, disruptionRadius: 118 };
  const APOCALYPSE_LASER = { hits: 110, interval: 500, travel: 115 };
  const APOCALYPSE_MAIN = { heavyHits: 220, salvos: 4, enhancedHits: 330, enhancedShots: 8, charge: 1000, interval: 250, travel: 115 };
  const NEMESIS_LASER = { hits: 100, duration: 3000, tick: 500, reload: 3000 };
  const NEMESIS_NET = { duration: 5000, travel: 320, launchGap: 120 };
  const AEGIS_CANNON = { hits: 50, interval: 500 };
  const AEGIS_REPAIR = { amount: .05, travel: 1000, duration: 1000, returnDelay: 1000, ticks: 5, enhancedDrones: 4 };
  const COLOSSUS_FIGHTER = { hits: 150, count: 4, interval: 300, travel: 1000, attackDuration: 500, returnTravel: 1000 };
  const COLOSSUS_MAIN = { unfold: 1000, disperse: 650, duration: 5000, enhancedShieldRatio: 1.05, throwDuration: 720, throwRadius: 34, throwMaxHits: 3 };
  const BASTION_FIGHTER = { hits: 150, count: 3, travel: 1000, attackDuration: 300, returnTravel: 1000, recovery: 1000, secondSquadDelay: 520 };
  const BASTION_MAIN = { shots: 4, hits: 100, interval: 100, travel: 90, repair: .05, tauntDuration: 5000 };
  const HAMMER_FIGHTER = { count: 2, interval: 1500, cannonHits: 100, travel: 120 };
  const HAMMER_DRONE = { count: 3, hits: 300, extraCount: 2, enhancedHits: 400, travel: 620, radius: 32, stun: 3000 };
  const NIMITZ_FIGHTER = { hits: 300, count: 5, travel: 1000, attackDuration: 1000, returnTravel: 1000, recovery: 1000, launchInterval: 330 };
  const NIMITZ_MAIN = { count: 25, hitsMultiplier: 1.2, ultimateMultiplier: 1.5, duration: 5000, shieldRatio: .1, immunityDuration: 1000, launchInterval: 30, rechargeLock: 5000 };
  const TANK_ELECTRIC = { hits: 250, interval: 2000, travel: 100, maxTargets: 5, stun: 500 };
  const TANK_PETRIFICATION = { immunity: 1000, enhancedImmunity: 2000, reduction: 3000, reductionRatio: .5, enhancedReductionRatio: .4, taunt: 5000 };
  const DOZER_CANNON = { hits: 135, ports: 4, interval: 200, reload: 2000, travel: 90 };
  const DOZER_EVASION = { chance: .3, enhancedChance: .5, decoyBonus: .2, duration: 5000, decoyTargets: 3 };
  const ANGELA_CANNON = { hits: 350, shots: 2, shotInterval: 200, reload: 1500, travel: 90 };
  const ANGELA_WINGS = { immunity: 2000, shield: 500, angelaShield: 500, taunt: 5000, cannonInterval: 150, bladeDuration: 900 };
  // 아군 앙헬라의 천사의 날개: 기본 면역 1초·보호막 500, 강화(3성) 면역 2초·보호막 1000. 날개 효과는 5초 동안 유지되며,
  // 징벌의 칼(5성)은 그 동안 1초마다 뱃머리 레이저를 쏜다.
  // 징벌의 칼(5성): 날개 효과 동안 뱃머리에서 대검을 1초마다 쏜다. 대검은 앞으로 날며 닿은 모든 적을 관통해 피해를 준다.
  const ANGELA_SWORD = { travel: 500, length: 120, hits: 1000, pierceWidth: 22 };
  const ANGELA_WING_EFFECT = { immunity: 1000, shield: 500, enhancedImmunity: 2000, enhancedShield: 1000, duration: 5000, judgmentDamage: 1000, judgmentInterval: 1000, judgmentWidth: .035 };
  const CARRIER_INTERCEPTOR = { hits: 55, count: 6, interval: 330, travel: 260 };
  const CARRIER_OVERFLOW = { duration: 5000, shieldInterval: 500, shieldAmount: 100, extraLifetime: 7000 };
  const SPACE_PIRATE = { hp: 1000, goldenHp: 10000, normalChance: .1, goldenChance: .01, duration: 35000, thoriumMin: 10, thoriumMax: 100, goldenThoriumMin: 1, goldenThoriumMax: 200 };
  const PLASMA_BUG = { hp: 3000, count: 5, speed: .000015, range: .15, charge: 3000, cooldown: 1000, damage: 1000, emerge: 900, shotSpeed: .55, tailOffset: 42 };
  const PLASMA_BUG_MARKUP = '<span class="plasma-bug-earth" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="pb-rig" aria-hidden="true"><span class="pb-body"><i class="pb-shadow"></i><i class="pb-shadow pb-abd-shadow"></i><span class="pb-front"><img class="pb-img" src="enemy-plasma-bug.png" alt="" /></span><span class="pb-abd-wrap"><span class="pb-abd"><img class="pb-img" src="enemy-plasma-bug.png" alt="" /><img class="pb-glow" src="enemy-plasma-bug.png" alt="" /></span></span></span></span><span class="enemy-hp"><i></i></span>';
  const KDDX_LASER = { hits: 450, interval: 1500, travel: 110 };
  const KDDX_CHAIN = { hits: 1500, transfers: 4, charge: 1000, interval: 200, falloff: .9, travel: 120, splashRadius: 56, stun: 3000, dotInterval: 1000, dotTicks: 3, dotRatio: .02 };
  const PEGASUS_LASER = { hits: 100, beams: 2, duration: 4000, tick: 330, reload: 3000, width: .027 };
  const PEGASUS_ANNIHILATION = { hits: 200, beams: 2, duration: 3000, tick: 200, width: .032 };
  const PEGASUS_RECOVERY = { duration: 2000 };
  const PEGASUS_LANCE = { interval: 5000, travel: 900, length: 100, pierceHits: 1000, grazeHits: 300 };
  const PLANET_DESTROYER_LASER = { hits: 350, shots: 5, shotInterval: 200, reload: 2000, travel: 110 };
  const PLANET_DESTROYER_FIGHTER = { ...BASTION_FIGHTER, hits: 150 };
  const PLANET_DESTROYER_SUPERNOVA = { move: 3000, charge: 2000, fire: 5000, tick: 1000, hits: 2000, stun: 3000, return: 2000, beamWidth: 84 };
  const PANDORA_ATTACK = { interval: 1000, missileHits: 300, laserHits: 500, cannonHits: 250, missileTravel: 420 };
  const PANDORA_MAIN = { charge: 2000, travel: 650, missileHits: 500, burstDelay: 1000, burstRadius: 45, burstDuration: 1500, burstHits: 300, hopeHitsPerSecond: 1000 };
  // 미사일은 0.4초마다 한 발씩 세 발사구를 돌아가며 쏜다. 용맹(5성)이면 피해가 40% 늘어난다.
  const VARYAG_MISSILE = { hits: 200, interval: 400, travel: 420, splashRadius: 48, valorDamage: 1.4 };
  const GARUDA_MISSILE = { hits: 250, count: 2, interval: 2000, wingmanInterval: 1800, travel: 420, guardianCount: 9, wingmanHpRatio: .3, wingmanDamageRatio: .3 };
  const VARYAG_DRONE = { perSide: 3, hits: 500, travel: 2000, launchInterval: 120, radius: .034 };
  const VARYAG_LAST_STAND = 10000;
  const FURY_MISSILE = { hits: 100, interval: 1000, travel: 420 };
  const FURY_BARRAGE = { salvos: 6, interval: 150, hits: 1000, stun: 3000, travel: 480, radius: 112 };
  const BROWN_BESS_LASER = { hits: 300, shots: 3, shotInterval: 150, sideInterval: 1500, travel: 100 };
  const BROWN_BESS_SNIPER = { aim: 2000, travel: 260, stopAfterHit: 1000, enhancedStopAfterHit: 2000, hits: 2500 };
  const YAMATO_CANNON = { hits: 400, shots: 2, shotInterval: 500, reload: 1500, travel: 90 };
  const YAMATO_FULL_BARRAGE = { duration: 3000, laserHits: 1000, laserTick: 1000, laserWidth: 7, missileHits: 300, missileSalvos: 3, missileInterval: 1000, missileTravel: 400, cooldown: 1000 };
  const OMEGA_LASER = { duration: 3000, tick: 500, hits: 150, cooldown: 2000, width: .026, spread: Math.PI / 6, blastRadius: 58, blastDamage: 1000 };
  const OMEGA_FOCUS = { beams: 5, duration: 3000, impactDelay: 2000, hits: 2500, width: .018, stun: 3000 };
  const DEIMOS_CANNON = { hits: 100, interval: 500, travel: 90 };
  const DEIMOS_SHOTGUN = { hits: 300, shots: 3, interval: 1500, radius: 400, knockback: 34, duration: 3300, cone: Math.PI / 3 };
  const URANUS_CANNON = { hits: 90, interval: 500, travel: 110 };
  const URANUS_BARRAGE = { hits: 900, shots: 3, interval: 500, travel: 120, radius: 52, duration: 1300 };
  const SPEAR_LASER = { hits: 100, interval: 1000, travel: 100 };
  const SPEAR_VOLLEY = { hits: 100, shots: 10, interval: 300, duration: 3050, blastRadius: 44 };
  const BLADE_LASER = { hits: 100, duration: 3000, tick: 1000, reload: 2000, width: .022 };
  const BLADE_MAIN = { hits: 100, beams: 3, duration: 5000, tick: 1000, width: .025 };
  // 사거리는 화면 높이 대비 비율로 둔다(기준: 세로 720px 화면에서 550px). 화면 크기가 달라도 같은 거리감을 유지한다.
  const ALLY_ATTACK_RANGE_RATIO = 550 / 720;
  const ENEMY_WAVE = { baseCount: 100, baseDuration: 30000, bonusCount: 0, bonusTimes: [] };
  const REGION_GATE_ORDER = ['mars', 'titan', 'oort'];
  const REGION_GATE_COUNTS = { mars: 10, titan: 20, oort: 20 };
  const ENEMY_PROFILES = {
    gasimon: { hp: 200, speed: .000031, range: .306, attack: 'spike', damage: 10, image: 'enemy-gasimon.png' },
    jipgemon: { hp: 300, speed: .0000516, range: .067, attack: 'claw', damage: 30, image: 'enemy-jipgemon.png' },
    dokchimmon: { hp: 150, speed: .000034, range: .285, attack: 'acid', damage: 5, image: 'enemy-dokchimmon.png' },
    suicidemon: { hp: 250, speed: .000062, range: .018, attack: 'suicide', damage: 100, image: 'enemy-suicide-monster.png' }
    ,raptor: { hp: 2000, speed: .000076, range: .285, attack: 'spike', damage: 20, image: 'enemy-raptor.png' }
  };
  const BLUE_ENEMY_PROFILES = {
    'blue-spike': { base: 'gasimon', hp: 200, speed: .000031, range: .306, attack: 'spike', damage: 10, image: 'enemy-blue-spike.png' },
    'blue-stinger': { base: 'dokchimmon', hp: 150, speed: .000034, range: .285, attack: 'acid', damage: 5, image: 'enemy-blue-stinger.png' },
    'blue-suicide': { base: 'suicidemon', hp: 250, speed: .000062, range: .018, attack: 'suicide', damage: 100, image: 'enemy-blue-suicide.png' },
    'blue-claw': { base: 'jipgemon', hp: 300, speed: .0000516, range: .067, attack: 'claw', damage: 30, image: 'enemy-blue-claw.png' }
  };
  const BLUE_ENEMY_TYPES = Object.keys(BLUE_ENEMY_PROFILES);
  const SUPANOKSEON_CANNON = { hits: 300, interval: 300, travel: 90 };
  const SUPANOKSEON_MAIN = { turnDuration: 1500, cannonShots: 10, cannonInterval: 100, cannonHits: 300, grenades: 5, grenadeTravel: 500, fuse: 3000, hits: 1000, splashHits: 500, weakDuration: 3000, returnWait: 1000 };
  const DREAD_TURTLE_CANNON = { hits: 200, interval: 2000, flameStep: 100, travel: 90 };
  const DREAD_TURTLE_CHARGE = { travel: 650, shockHits: 777, shield: 500, shieldBoostRatio: .2, fearDuration: 1000, fearTouchRadius: 56, shieldUnfold: 1650, firstTurnDelay: 2000, firstAdvance: .075, firstAdvanceDuration: 3000, secondAdvance: .05, secondAdvanceDuration: 2000, arrivalEchoDuration: 520 };
  const MAGELLAN_CANNON = { hits: 100, interval: 500 };
  const MAGELLAN_MAIN = { hits: 500, enhancedHits: 700, duration: 3000, radius: .2, stun: 2000, fleetSpeedBonus: .5, fleetSpeedDuration: 3000 };
  const ASSAULT_TURTLE_MISSILE = { hits: 400, interval: 330, travel: 420, fx: 'missile', splashRadius: 56, enhancedRadiusRatio: 1.3 };
  const ASSAULT_TURTLE_BARRAGE = { hits: 200, shots: 25, duration: 2000, travel: 360 };
  const ASSAULT_TURTLE_CHARGE = { travel: 525, returnDelay: 2000, shieldDuration: 2000, minTravel: .16, ramDamage: 1000, ramLength: .30, ramAngle: Math.PI / 2, ramStun: 3000, returnBlastRadius: 112, returnBlastRatio: .5, pathRadius: 40 };
  const TURTLE_SHIP_MISSILE = { hits: 250, interval: 330, travel: 360, splashRadius: 56, splashRatio: .5 };
  const TURTLE_SHIP_BOMBARDMENT = { hits: 250, salvos: 9, missilesPerSalvo: 5, interval: 250, turnDuration: 2000, travel: 360 };
  const ATLAS_ELECTRIC = { hits: 90, interval: 2000, travel: 100, chains: 2 };
  const ATLAS_PLASMA = { hits: 300, shots: 2, enhancedHits: 400, enhancedShots: 4, interval: 170, travel: 330, radius: .03, buffDuration: 3000 };
  const FRIGATE_SKILLS = {
    '방패선':   { name: '천상의 보호막', kind: 'celestial-shield', duration: 5000 },
    '레판토':   { name: '전열 포격', kind: 'lepanto-strike', duration: 5000, entry: 2000, exit: 2000, cannonInterval: 500, cannonDamage: 100, missileInterval: 1000, missileDamage: 150 },
    '포작선':   { name: '자폭 시퀀스', kind: 'self-destruct', amount: 500, explosions: 3, entry: 2000, interval: 2000 },
    '과학 드론': { name: '무작위 전술 시전', kind: 'science-random' },
    '과학드론':  { name: '무작위 전술 시전', kind: 'science-random' },
    '건설드론':  { name: '긴급 수복', kind: 'repair', amount: 28, repairRatio: .08 },
    '리틀보이':  { name: '핵폭탄 투하', kind: 'nuclear', amount: 1000, delay: 3000 }
  };
  const FRIGATE_CODEX_IMAGES = {
    '방패선': 'frigate-bangpaeseon-codex.png',
    '레판토': 'frigate-lepanto-codex.png',
    '포작선': 'frigate-pojagseon-codex.png',
    '과학 드론': 'frigate-science-drone-codex.png?v=2',
    '과학드론': 'frigate-science-drone-codex.png?v=2',
    '건설드론': 'frigate-construction-drone-codex.png',
    '리틀보이': 'frigate-littleboy-codex.png?v=3'
  };
  const FRIGATE_BATTLE_IMAGES = {
    '방패선': 'shield-ship-battle.png',
    '레판토': 'lepanto-battle.png',
    '포작선': 'pojakseon-battle.png',
    '과학 드론': 'science-drone-battle.png',
    '과학드론': 'science-drone-battle.png',
    '건설드론': 'construction-drone-battle.png',
    '리틀보이': 'littleboy-battle-topview.png'
  };
  const SCIENCE_DRONE_SKILLS = [
    { name: '방사능 오염', kind: 'radiation', targets: 2, ratio: .2, radius: 82, duration: 3000, tick: 1000, delay: 950 },
    { name: 'EMP 폭격', kind: 'emp', stun: 3000, delay: 950 },
    { name: '방어막 설치', kind: 'shield', amount: 500, target: 'single', delay: 950 }
  ];
  const CONSTRUCTION_DRONE_REPAIR = { entry: 1000, travel: 1000, repair: 1000, exit: 1000, pulses: 5 };

  const refs = {};
  const timers = new Set();
  let state = null;
  let selectedWeapon = 'missile';
  let frameHandle = 0;
  let generation = 0;
  let pendingOperation = null;
  let announceTimer = 0;
  let arenaPlaybackTimer = 0;

  window.prepareBattle = operation => {
    if (!refs.field) {
      pendingOperation = operation || {};
      return;
    }
    prepareBattle(operation || {});
  };

  document.addEventListener('DOMContentLoaded', initialiseBattleEngine);

  function initialiseBattleEngine() {
    const ids = [
      'space-battlefield', 'battle-enemies', 'battle-allies', 'battle-effects', 'enemy-attack-lattice',
      'battle-start', 'battle-forfeit', 'battle-map', 'battle-skip', 'battle-speed','battle-operation-name', 'battle-clock', 'battle-boss-hud',
      'battle-boss-bar', 'battle-boss-hp', 'battle-boss-name', 'battle-boss-row-secondary', 'battle-boss-name-secondary',
      'battle-boss-bar-secondary', 'battle-boss-hp-secondary', 'battle-gate-progress-hud', 'battle-gate-progress', 'battle-gate-progress-label',
      'frigate-skill', 'frigate-ship-name', 'frigate-ship-visual', 'frigate-skill-name', 'frigate-cooldown', 'frigate-auto',
      'battle-announcement', 'battle-result', 'battle-result-kicker', 'battle-result-title',
      'battle-result-stars', 'battle-result-copy', 'battle-rewards', 'battle-result-actions', 'forfeit-confirm'
    ];
    ids.forEach(id => { refs[toKey(id)] = document.getElementById(id); });
    refs.field = refs.spaceBattlefield;
    refs.viewport = refs.field?.closest('.battle-viewport');
    refs.battleOperationLabel = document.querySelector('.battle-operation small');
    refs.controls = document.querySelector('.battle-controls');
    refs.frigateAutoLabel = document.querySelector('.frigate-auto');
    refs.enemyLayer = refs.battleEnemies;
    refs.allyLayer = refs.battleAllies;
    refs.effects = refs.battleEffects;
    refs.lattice = refs.enemyAttackLattice;
    if (!refs.field) return;

    refs.battleStart.addEventListener('click', startBattle);
    refs.battleSpeed?.addEventListener('click', toggleBattleSpeed);
    watchBossBarPhase(refs.battleBossBar);
    watchBossBarPhase(refs.battleBossBarSecondary);
    window.addEventListener('game-resources-updated', () => { if (state) syncBattleSpeed(); });
    refs.battleSkip.addEventListener('click', () => {
      if (!state || state.status !== 'combat' || state.arenaMatch || state.bounty) return;
      if ((Number(state.operation?.gate) || 0) % 5 === 0) {
      announce('중요한 전투는 스킵할 수 없습니다', 'danger');
        return;
      }
      refs.battleSkip.hidden = true;
      finishBattle(true, '전투를 건너뛰었습니다.');
    });
    refs.battleForfeit.addEventListener('click', openForfeitConfirmation);
    refs.battleMap.addEventListener('click', openBattleMap);
    refs.frigateSkill.addEventListener('click', launchFrigateSkill);
    refs.frigateAuto.addEventListener('change', () => {
      if (state) state.frigateAuto = refs.frigateAuto.checked;
    });
    refs.forfeitConfirm.querySelector('[data-forfeit="no"]').addEventListener('click', closeForfeitConfirmation);
    refs.forfeitConfirm.querySelector('[data-forfeit="yes"]').addEventListener('click', () => {
      refs.forfeitConfirm.hidden = true;
      finishBattle(false, '함대가 작전 구역에서 철수했습니다.');
    });
    refs.forfeitConfirm.querySelector('.forfeit-backdrop').addEventListener('click', closeForfeitConfirmation);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && refs.forfeitConfirm && !refs.forfeitConfirm.hidden) closeForfeitConfirmation();
    });

    selectWeapon(selectedWeapon);
    if (pendingOperation) {
      const operation = pendingOperation;
      pendingOperation = null;
      requestAnimationFrame(() => prepareBattle(operation));
    }
  }

  function prepareBattle(operation) {
    if (!operation?.arenaMatch && !operation?.bounty && window.beforeSortieHook?.(operation, () => prepareBattle(operation))) return;
    if (operation?.arenaMatch) { prepareArenaBattle(operation.arenaMatch); return; }
    window.setBattleBossMusic?.(false);
    stopRuntime();
    generation += 1;
    const currentGeneration = generation;
    refs.enemyLayer.replaceChildren();
    refs.allyLayer.replaceChildren();
    // 아레나 전용 함대 바와 전투 기록은 일반 전투에 남지 않도록 지운다.
    refs.field?.querySelector('.arena-hud')?.remove();
    refs.field?.querySelector('.arena-combat-log')?.remove();
    refs.effects.replaceChildren();
    refs.lattice.replaceChildren();
    refs.battleResult.hidden = true;
    refs.battleSkip.hidden = true;
    refs.battleResult.classList.remove('victory', 'defeat');
    refs.forfeitConfirm.hidden = true;
    refs.battleBossHud.hidden = true;
    refs.battleStart.hidden = false;
    refs.battleForfeit.disabled = false;
    refs.battleForfeit.textContent = '함대관리';
    refs.battleMap.textContent = '우주지도';
    refs.battleForfeit.classList.remove('combat-forfeit');
    refs.battleMap.disabled = false;
    refs.field.classList.remove('combat-active');
    refs.viewport?.classList.remove('arena-battle');
    if (refs.battleOperationLabel) refs.battleOperationLabel.textContent = isKeplerOperation(operation) ? 'CHAPTER 03 · KEPLER FRONTIER' : 'CHAPTER 1 · COMBAT ZONE';
    refs.battleClock.previousElementSibling.textContent = 'ELAPSED';
    if (refs.battleGateProgressHud) refs.battleGateProgressHud.hidden = false;
    if (refs.frigateSkill) refs.frigateSkill.hidden = false;
    if (refs.frigateAutoLabel) refs.frigateAutoLabel.hidden = false;
    refs.viewport?.classList.remove('oort-colony-gate');
    refs.viewport?.classList.remove('oort-camera-active');

    const normalizedOperation = {
      chapter: Number(operation.chapter) || 1,
      region: operation.region || 'mars',
      regionName: operation.regionName || '화성',
      regionEn: operation.regionEn || 'MARS',
      gate: Number(operation.gate) || 1
    };
    refs.viewport?.classList.toggle('oort-colony-gate', isOortColonyGate(normalizedOperation));
    refs.viewport?.classList.toggle('kepler-secret-base-gate', isKeplerSecretBaseOperation(normalizedOperation));
    // 비밀기지 배경: 관문이 올라갈수록 그림을 조금씩 아래로 내려 보여 준다(1관문 위쪽 ~ 10관문 아래쪽).
    if (isKeplerSecretBaseOperation(normalizedOperation)) refs.viewport?.style.setProperty('--kepler-secret-base-y', `${((Number(normalizedOperation?.gate) || 1) - 1) * 10}%`);
    const fleet = resolveFleet();
    const blueExtraCount = magentaBlueBonusCount(normalizedOperation);
    const marsFirstGate = normalizedOperation.chapter === 1 && normalizedOperation.region === 'mars' && normalizedOperation.gate === 1;
    const enemyTotal = operation.bounty || isKeplerSecretBaseOperation(normalizedOperation)
      ? 0
      : marsFirstGate
      ? Math.round(ENEMY_WAVE.baseCount * .4)
      : ENEMY_WAVE.baseCount + ENEMY_WAVE.bonusCount * ENEMY_WAVE.bonusTimes.length + blueExtraCount;
    state = {
      generation: currentGeneration,
      operation: normalizedOperation,
      status: 'ready',
      paused: false,
      elapsed: 0,
      hudAccumulator: 0,
      enemies: [],
      allies: [],
      garudaWingmen: [],
      colossusShieldThrows: [],
      pegasusLances: [],
      angelaSwords: [],
      interceptors: [],
      boss: null,
      midBosses: [],
      midBossPending: false,
      midBossDefeated: false,
      machineBossSpawned: false,
      keplerMachineBossDefeated: false,
      keplerAtmosphereMachineBossDefeated: false,
      keplerAlienFleetSpawned: false,
      keplerAlienFleetSize: 0,
      keplerCarrierFightersLaunched: 0,
      atmosphereBossSpawned: false,
      oortOverlordSpawned: false,
      atmosphereBossDefeated: false,
      tasArmSequenceIndex: 0,
      pirates: [],
      normalTotal: enemyTotal,
      magentaBaseKills: 0,
      magentaBossesRemaining: 0,
      magentaBlueBonusCount: blueExtraCount,
      fleetPower: resolveFleetPower(fleet.main),
      gatePower: resolveGatePower(normalizedOperation),
      kills: 0,
      frigate: fleet.frigate,
      frigateCooldown: 0,
      frigateAuto: refs.frigateAuto.checked,
      celestialShield: null,
      damageBoost: 0,
      tacticalResearch: readTacticalResearch(),
      fleetAttackSpeedBoostUntil: 0,
      resultCommitted: false,
      lastFrame: 0
    };
    syncBattleSpeed();

    refs.battleOperationName.textContent = `${normalizedOperation.regionName} · ${normalizedOperation.gate}번 관문`;
    refs.battleClock.textContent = '00:00';
    if (operation.bounty) {
      // 현상수배: 일반 적 없이 보스 한 척과 제한시간 안에 싸운다.
      state.bounty = { ...operation.bounty };
      refs.battleOperationName.textContent = state.bounty.name;
      if (refs.battleOperationLabel) refs.battleOperationLabel.textContent = 'BOUNTY · SPACE PIRATE';
      refs.battleClock.previousElementSibling.textContent = 'TIME LIMIT';
      refs.battleClock.textContent = `${String(Math.floor(state.bounty.limit / 60)).padStart(2, '0')}:${String(state.bounty.limit % 60).padStart(2, '0')}`;
      if (refs.battleGateProgressHud) refs.battleGateProgressHud.hidden = true;
    }
    fleet.main.forEach(entry => createAlly(entry.ship, entry.slot, false));
    for (let index = 0; index < enemyTotal; index += 1) createNormalEnemy(index, enemyTotal);
    configureStartButton();
    configureFrigateButton();
    updateHud(true);
    announce('함대 전개 완료', 'friendly');
  }

  function prepareArenaBattle(match) {
    window.setBattleBossMusic?.(false);
    stopRuntime();generation+=1;
    refs.enemyLayer.replaceChildren();refs.allyLayer.replaceChildren();refs.effects.replaceChildren();refs.lattice.replaceChildren();
    refs.battleResult.hidden=true;refs.battleResult.classList.remove('victory','defeat');refs.forfeitConfirm.hidden=true;
    refs.battleSkip.hidden=true;
    refs.battleBossHud.hidden=true;refs.battleGateProgressHud.hidden=true;refs.battleStart.hidden=false;
    refs.battleForfeit.disabled=false;refs.battleForfeit.textContent='함대관리';refs.battleForfeit.classList.remove('combat-forfeit');
    refs.battleMap.disabled=false;refs.battleMap.textContent='아레나로';refs.field.classList.remove('combat-active');
    refs.viewport?.classList.remove('oort-colony-gate','oort-camera-active');refs.viewport?.classList.add('arena-battle');
    refs.frigateSkill.hidden=true;refs.frigateSkill.disabled=true;refs.frigateAutoLabel.hidden=true;
    refs.battleOperationLabel.textContent='ASYNC ARENA · OPPONENT';
    refs.battleOperationName.textContent=match.enemy.name;
    refs.battleClock.previousElementSibling.textContent='DUEL TIME';refs.battleClock.textContent='00:00';
    state={generation,status:'ready',paused:false,elapsed:0,arenaMatch:match,resultCommitted:false,allies:[],enemies:[],arenaEventIndex:0};syncBattleSpeed();
    renderArenaFleet(refs.enemyLayer,match.enemyDeck,'enemy',match.fleet);
    renderArenaFleet(refs.allyLayer,match.fleet,'friendly',match.enemyDeck);mountArenaHud();
    configureStartButton();
    announce('아레나 입장 완료','friendly');
  }

  // ── 아레나 전투 HUD: 함대 체력, 함선별 상성 표시, 전투 로그, 스킬 이름 콜아웃 (저장된 이벤트만 재생) ──
  let arenaLastCounter=new Map();
  function arenaMatchupMarkup(ship,opponents){
    if(!ship||ship.type==='frigate'||!window.ArenaCore)return '';
    const front=(opponents||[]).slice(0,3).filter(Boolean);
    const up=front.filter(o=>window.ArenaCore.typeBonus(ship,o)>0).length,down=front.filter(o=>window.ArenaCore.typeBonus(ship,o)<0).length;
    if(!up&&!down)return '';
    return `<em class="arena-vessel-matchup">${up?`<span class="up">▲${up}</span>`:''}${down?`<span class="down">▼${down}</span>`:''}</em>`;
  }
  function mountArenaHud(){
    refs.field.querySelector('.arena-hud')?.remove();refs.field.querySelector('.arena-combat-log')?.remove();
    const hud=document.createElement('div');hud.className='arena-hud';
    hud.innerHTML='<div class="arena-hud-side enemy"><span>상대 함대</span><span class="arena-hud-bar"><i></i></span><small>3/3</small></div><div class="arena-hud-side friendly"><span>아군 함대</span><span class="arena-hud-bar"><i></i></span><small>3/3</small></div>';
    const log=document.createElement('ol');log.className='arena-combat-log';log.setAttribute('aria-live','polite');
    refs.field.append(hud,log);
    arenaLastCounter=new Map();
  }
  function updateArenaHud(frame){
    const hud=refs.field.querySelector('.arena-hud');if(!hud)return;
    frame.teams.forEach((team,side)=>{
      const row=hud.querySelector(side===0?'.arena-hud-side.friendly':'.arena-hud-side.enemy');if(!row)return;
      const max=team.reduce((n,u)=>n+u.maxHp,0),now=team.reduce((n,u)=>n+Math.max(0,u.hp),0),alive=team.filter(u=>u.hp>0).length;
      row.querySelector('.arena-hud-bar i').style.width=`${max?Math.max(0,now/max*100):0}%`;
      row.querySelector('small').textContent=`${alive}/${team.length}`;
    });
  }
  function appendArenaLog(text,side){
    const log=refs.field.querySelector('.arena-combat-log');if(!log||!text)return;
    const item=document.createElement('li');item.className=side;item.textContent=text;
    log.append(item);while(log.children.length>6)log.firstElementChild.remove();
  }
  function createArenaCallout(piece,text,side,variant=''){
    if(!piece||!text)return;
    const point=arenaVesselPoint(piece),callout=document.createElement('i');
    callout.className=`arena-skill-callout ${side} ${variant}`.trim();callout.textContent=text;
    callout.style.left=percent(point.x);callout.style.top=percent(point.y);
    refs.effects.append(callout);schedule(()=>callout.remove(),1100);
  }
  // 이벤트마다 로그·콜아웃을 남긴다. 상성 표시는 같은 함선이 2초 안에 연속으로 표시되지 않도록 줄인다.
  function annotateArenaEvent(event,match){
    const side=event.side===0?'friendly':'enemy';
    const mine=event.side===0?match.fleet:match.enemyDeck,foe=event.side===0?match.enemyDeck:match.fleet;
    const actor=mine[event.slot];
    if(event.type==='core'){
      const skill=String(event.text||'').split(' · ')[0];
      appendArenaLog(`${actor?.name||'함선'} · ${skill}`,side);
      createArenaCallout(refs.field.querySelector(`[data-arena-piece="${side}-${event.slot}"]`),skill,side,'skill');
      return;
    }
    if(event.type==='support'){
      appendArenaLog(`${actor?.name||event.text||'지원'} 지원 출격`,side);
      return;
    }
    if(event.type==='shot'&&Number.isInteger(event.to)){
      const bonus=window.ArenaCore?.typeBonus?.(actor,foe[event.to])||0;
      if(!bonus)return;
      const key=`${side}-${event.slot}`,last=arenaLastCounter.get(key)??-99;
      if(event.time-last<2)return;
      arenaLastCounter.set(key,event.time);
      const targetSide=event.side===0?'enemy':'friendly';
      createArenaCallout(refs.field.querySelector(`[data-arena-piece="${targetSide}-${event.to}"]`),bonus>0?'▲ 상성':'▼ 상성',side,bonus>0?'counter-up':'counter-down');
    }
  }
  function renderArenaFleet(layer, ships, side, opponents = []) {
    ships.slice(0,3).forEach((ship,index)=>{
      const piece=document.createElement('div');
      piece.className=`arena-vessel ${side} slot-${index}`;
      piece.setAttribute('aria-label',`${side==='enemy'?'상대':'아군'} ${ship.name}`);
      piece.dataset.arenaPiece=`${side}-${index}`;
      piece.dataset.hp=String(ship.hp);
      piece.style.setProperty('--rarity-color',RARITY_COLORS[ship.rarity]||RARITY_COLORS.R);
      piece.style.setProperty('--arena-drift-delay',`${-index*.7-(side==='enemy'?1.1:0)}s`);
      piece.innerHTML=`<div class="arena-vessel-model"><div class="arena-vessel-sprite">${topViewMarkup(ship)}</div></div><div class="arena-vessel-hud"><b>${escapeHtml(ship.name)}</b>${arenaMatchupMarkup(ship,opponents)}<span class="arena-vessel-health"><i></i></span><span class="arena-vessel-shield"><i></i></span><span class="arena-vessel-energy"><i></i></span><small>${formatNumber(ship.hp)} / ${formatNumber(ship.hp)}</small></div>`;
      layer.append(piece);
    });
  }

  // ── 전투 배속(멤버십 서비스): 사자증표를 1개 이상 보유한 함장만 2배속을 쓸 수 있습니다. 보스전·아레나 포함.
  function hasBattleMembership() {
    let stored = 0;
    try { stored = Number(JSON.parse(localStorage.getItem('starfleet-game-resources-v1') || '{}')?.lionToken) || 0; } catch {}
    return Math.max(Number(window.gameResources?.lionToken) || 0, stored) >= 1;
  }
  function preferredBattleSpeed() {
    try { return localStorage.getItem(BATTLE_SPEED_KEY) === '2' ? 2 : 1; } catch { return 1; }
  }
  function restartArenaPlayback() {
    clearInterval(arenaPlaybackTimer);
    arenaPlaybackTimer = setInterval(playArenaFrame, 500 / battleSpeed);
  }
  // 멤버십 여부와 저장된 선택에 맞춰 실제 배속과 버튼 모양을 맞춥니다. 멤버십이 없으면 항상 1배속입니다.
  function syncBattleSpeed() {
    const member = hasBattleMembership();
    const speed = member ? preferredBattleSpeed() : 1;
    if (speed !== battleSpeed) {
      setBattleClockSpeed(speed);
      if (arenaPlaybackTimer) restartArenaPlayback();
    }
    const button = refs.battleSpeed;
    if (!button) return;
    button.hidden = !state || state.status === 'ended';
    button.textContent = `${speed}x`;
    button.classList.toggle('is-fast', speed === 2);
    button.classList.toggle('is-locked', !member);
    button.setAttribute('aria-pressed', String(speed === 2));
    const label = member ? `전투 배속 ${speed}배 · 눌러서 ${speed === 2 ? 1 : 2}배로 변경` : '전투 2배속 · 사자증표 보유 멤버십 전용';
    button.setAttribute('aria-label', label);
    button.title = label;
  }
  function toggleBattleSpeed() {
    if (!hasBattleMembership()) {
      announce('2배속은 멤버십 전용 · 사자증표 보유 시 사용 가능', 'danger');
    } else {
      try { localStorage.setItem(BATTLE_SPEED_KEY, preferredBattleSpeed() === 2 ? '1' : '2'); } catch {}
    }
    syncBattleSpeed();
  }

  function playArenaFrame() {
    if(!state?.arenaMatch||state.status!=='combat')return;
    const match=state.arenaMatch,frame=match.result.frames[state.arenaFrameIndex++];
    if(!frame){clearInterval(arenaPlaybackTimer);arenaPlaybackTimer=0;finishBattle(match.result.win===true);return;}
    state.elapsed=frame.time;const seconds=Math.floor(frame.time);
    refs.battleClock.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    frame.teams.forEach((team,side)=>team.forEach((unit,index)=>{
      const sideName=side===0?'friendly':'enemy',piece=refs.field.querySelector(`[data-arena-piece="${sideName}-${index}"]`);if(!piece)return;
      const previousHp=Number(piece.dataset.hp),wasDestroyed=piece.classList.contains('retreating');
      piece.dataset.hp=String(unit.hp);
      if(unit.hp<previousHp&&unit.hp>0){piece.classList.remove('arena-hit');void piece.offsetWidth;piece.classList.add('arena-hit');schedule(()=>piece.classList.remove('arena-hit'),380);}
      piece.classList.toggle('stunned',Boolean(unit.stunned));
      piece.classList.toggle('shielded',Number(unit.shield)>0);
      piece.querySelector('.arena-vessel-health i').style.width=`${Math.max(0,unit.hp/unit.maxHp)*100}%`;
      piece.querySelector('.arena-vessel-shield i').style.width=`${Math.min(100,Math.max(0,unit.shield/unit.maxHp*100))}%`;
      piece.querySelector('.arena-vessel-energy i').style.width=`${Math.min(100,Math.max(0,unit.energy||0))}%`;
      piece.querySelector('.arena-vessel-hud small').textContent=`${formatNumber(unit.hp)} / ${formatNumber(unit.maxHp)}`;
      if(unit.hp<=0&&!wasDestroyed){appendArenaLog(`${piece.querySelector('.arena-vessel-hud b')?.textContent||'함선'} 퇴각`,sideName);piece.classList.add('retreating');}
    }));
    drawArenaSalvo(match,frame.time);updateArenaHud(frame);
  }

  function arenaVesselPoint(piece) {
    const field=refs.field.getBoundingClientRect(),rect=piece?.getBoundingClientRect();
    if(!rect||!field.width||!field.height)return{x:.5,y:.5};
    return{x:(rect.left+rect.width/2-field.left)/field.width,y:(rect.top+rect.height/2-field.top)/field.height};
  }

  // 아레나 격파 연출: PvE 격파 연출(playMonsterDeath)을 기체 그림 위에 재생한다.
  function createArenaBurst(point,side) {
    const burst=document.createElement('i');burst.className=`arena-duel-burst ${side}`;
    burst.style.left=percent(point.x);burst.style.top=percent(point.y);refs.effects.append(burst);
    schedule(()=>burst.remove(),700);
  }

  function createArenaPulse(piece,kind='shield') {
    if(!piece)return;
    const point=arenaVesselPoint(piece),pulse=document.createElement('i');
    pulse.className=`arena-duel-pulse ${kind}`;pulse.style.left=percent(point.x);pulse.style.top=percent(point.y);
    refs.effects.append(pulse);schedule(()=>pulse.remove(),750);
  }

  function createArenaSupport(match,event) {
    const side=event.side===0?'friendly':'enemy',deck=event.side===0?match.fleet:match.enemyDeck;
    const frigate=deck[3];if(!frigate)return;
    const flyby=document.createElement('div');flyby.className=`arena-support-flyby ${side}`;
    flyby.style.setProperty('--arena-support-travel',`${(side==='friendly'?1:-1)*(refs.field.getBoundingClientRect().width+160)}px`);
    flyby.innerHTML=topViewMarkup(frigate);refs.effects.append(flyby);schedule(()=>flyby.remove(),1200);
    const defensive=/건설|과학|방패/.test(event.text||'');
    if(defensive){for(let index=0;index<3;index++)createArenaPulse(refs.field.querySelector(`[data-arena-piece="${side}-${index}"]`),/방패/.test(event.text||'')?'shield':'repair');}
    else{
      const targetSide=side==='friendly'?'enemy':'friendly';
      for(let index=0;index<3;index++)schedule(()=>{
        const target=refs.field.querySelector(`[data-arena-piece="${targetSide}-${index}"]`);
        if(target)createArenaBurst(arenaVesselPoint(target),targetSide);
      },230+index*80);
      schedule(playMissileImpactSound,230);
    }
  }

  function playArenaWeaponSound(event,weapon) {
    if(event.type==='support'){playFighterLaunchSound();return;}
    if(event.type==='core'&&/수리|수복|보호|방패|석화/.test(weapon)){playAngelaShieldSound();return;}
    if(/미사일/.test(weapon))playMissileLaunchSound();
    else if(/전기|번개|그물/.test(weapon))playElectricWeaponSound();
    else if(/함재기|드론/.test(weapon))playFighterShotSound();
    else if(/관통/.test(weapon))playPenetrateBeamSound();
    else if(/레이저|광자/.test(weapon))playCruiserLaserSound();
    else playCannonFireSound();
  }

  // 무기별 발사 연출: 전기는 PvE 번개(drawElectricStrike), 미사일은 PvE 미사일 탄(fx-missile),
  // 함포·레이저는 PvE 선 연출(fx-line), 함재기·드론은 탄 연출을 쓴다. 스킬 피해는 굵은 선으로 표시한다.
  function arenaWeaponKind(weapon,type) {
    if (type === 'core') return 'core';
    if (/전기|번개|그물/.test(weapon)) return 'electric';
    if (/미사일/.test(weapon)) return 'missile';
    if (/함재기|드론/.test(weapon)) return 'fighter';
    if (/레이저|관통/.test(weapon)) return 'laser';
    return 'cannon';
  }
  function drawArenaShot(sourceSide,sourceSlot,targetSide,targetSlot,type,weapon) {
    const targetName=targetSide===0?'friendly':'enemy';
    const source=refs.field.querySelector(`[data-arena-piece="${sourceSide}-${sourceSlot}"]`);
    const target=refs.field.querySelector(`[data-arena-piece="${targetName}-${targetSlot}"]`);
    if(!source||!target)return;
    const from=arenaVesselPoint(source),to=arenaVesselPoint(target);
    const kind=arenaWeaponKind(String(weapon||''),type);
    const lineSide=sourceSide===0?'friendly-line':'enemy-line';
    if (kind==='electric') {
      drawElectricStrike(from,to,Math.random()<.5?1:2);
    } else if (kind==='missile') {
      const missile=document.createElement('i');missile.className='fx-missile';
      refs.effects.append(missile);positionProjectile(missile,from,to);schedule(()=>missile.remove(),520);
    } else if (kind==='fighter') {
      const field=refs.field.getBoundingClientRect(),dx=(to.x-from.x)*field.width,dy=(to.y-from.y)*field.height;
      const shot=document.createElement('i');shot.className=`arena-duel-projectile ${sourceSide} fighter`;
      shot.style.left=percent(from.x);shot.style.top=percent(from.y);
      shot.style.setProperty('--arena-dx',`${dx}px`);shot.style.setProperty('--arena-dy',`${dy}px`);shot.style.setProperty('--arena-angle',`${Math.atan2(dy,dx)+Math.PI/2}rad`);
      refs.effects.append(shot);schedule(()=>shot.remove(),540);
    } else {
      const beam=document.createElement('i');
      beam.className=`fx-line ${kind==='cannon'?'cannon':''} ${kind==='core'?'heavy ':''}${lineSide}`.replace(/\s+/g,' ').trim();
      refs.effects.append(beam);positionLine(beam,from,to);
      schedule(()=>beam.remove(),kind==='core'?420:260);
    }
    const impact=document.createElement('i');impact.className=`arena-duel-impact ${sourceSide}${kind==='core'?' core':''}`;
    impact.style.left=percent(to.x);impact.style.top=percent(to.y);refs.effects.append(impact);schedule(()=>impact.remove(),650);
    source.classList.add('arena-firing');schedule(()=>source.classList.remove('arena-firing'),260);
    const muzzle=document.createElement('i');muzzle.className='arena-muzzle '+(sourceSide===0?'friendly':'enemy');muzzle.style.left=percent(from.x);muzzle.style.top=percent(from.y);refs.effects.append(muzzle);schedule(()=>muzzle.remove(),180);
  }

  function drawArenaSalvo(match,time) {
    const events=match.result.events;
    while(state.arenaEventIndex<events.length&&events[state.arenaEventIndex].time<=time+.001){
      const event=events[state.arenaEventIndex++],side=event.side===0?'friendly':'enemy';annotateArenaEvent(event,match);
      if(event.type==='support'){playArenaWeaponSound(event,'');createArenaSupport(match,event);continue;}
      const ship=(event.side===0?match.fleet:match.enemyDeck)[event.slot];
      const skill=event.type==='core'?String(ship?.profile?.[4]||''):'';
      const weapon=event.type==='core'?skill:String(event.weapon||ship?.profile?.[1]||'');
      playArenaWeaponSound(event,weapon);
      if(event.type==='core'&&/수리|수복|보호|방패|석화/.test(skill)){
        for(let index=0;index<3;index++)createArenaPulse(refs.field.querySelector(`[data-arena-piece="${side}-${index}"]`),/수리|수복/.test(skill)?'repair':'shield');
        continue;
      }
      const targets=event.type==='core'&&/광역|난사|초신성|번개|포화|다련장/.test(skill)?[0,1,2]:[event.to];
      targets.forEach(target=>drawArenaShot(side,event.slot,1-event.side,target,event.type,weapon));
    }
  }

  async function finishArenaBattle(forcedLoss=false) {
    if(!state||state.resultCommitted)return;
    state.resultCommitted=true;state.status='ended';clearInterval(arenaPlaybackTimer);arenaPlaybackTimer=0;syncBattleSpeed();
    refs.forfeitConfirm.hidden=true;refs.battleForfeit.disabled=true;refs.battleMap.disabled=false;refs.battleStart.hidden=true;
    if(forcedLoss)state.arenaMatch.forfeited=true;
    let result;
    try{result=await window.completeArenaBattle?.(state.arenaMatch)||{win:state.arenaMatch.result.win,delta:0,score:state.arenaMatch.scoreBefore,rank:'—',tier:'ARENA'};}
    catch(error){state.resultCommitted=false;announce('아레나 결과 저장에 실패했습니다','danger');return;}
    const draw=result.win===null,victory=result.win===true;
    refs.battleResult.hidden=false;refs.battleResult.classList.toggle('victory',victory);refs.battleResult.classList.toggle('defeat',!victory&&!draw);
    refs.battleResultKicker.textContent='ASYNC ARENA · DUEL COMPLETE';refs.battleResultTitle.textContent=draw?'무승부':victory?'승리':'패배';
    refs.battleResultStars.textContent=draw?'—':victory?'VICTORY':'DEFEAT';
    refs.battleResultCopy.textContent=`${state.arenaMatch.enemy.name} · ${Math.ceil(state.arenaMatch.result.time)}초 교전 · ${result.tier} ${formatNumber(result.score)}점 · ${result.rank}위`;
    refs.battleRewards.innerHTML=draw?'<span>무승부 <b>점수 변동 없음</b></span>':`<span>아레나 점수 <b>${result.delta>0?'+':''}${result.delta}</b></span>`;
    refs.battleResultActions.replaceChildren();addResultButton('아레나로 돌아가기',()=>window.returnFromArenaBattle?.());
    refs.battleOperationName.textContent=state.arenaMatch.enemy.name;
  }

  function readTacticalResearch() {
    try { return JSON.parse(localStorage.getItem('starfleet-tactical-weapon-research-v1') || '{}') || {}; }
    catch { return {}; }
  }

  function tacticalWeaponBonus(source,attackType='normal') {
    const ship=source?.owner?.ship||source?.ship||source;
    if(!ship||!state?.tacticalResearch||ship.type==='frigate')return {damage:0,speed:0};
    const type=source?.isStarCruiser&&attackType==='normal'?selectedWeapon:attackType;
    return window.ArenaCore?.weaponBonus(ship,state.tacticalResearch,type)||{damage:0,speed:0};
  }

  function tacticalShieldDuration(duration) {
    const levels=state?.tacticalResearch?.defenseTree||{};
    const legacy=Array.from({length:6},(_,index)=>Math.max(0,Number(levels['duration'+(index+1)])||0)).reduce((a,b)=>a+b,0);
    const materials=Array.from({length:5},(_,index)=>Math.max(0,Number(levels['materialDuration'+(index+1)])||0)).reduce((a,b)=>a+b,0);
    return duration*(1+(legacy+materials)*.001);
  }

  function tacticalFrigateBonus(frigate=state?.frigate) {
    return window.ArenaCore?.frigateBonus(frigate,state?.tacticalResearch||{})||{power:1,cooldown:0};
  }

  function resolveFleet() {
    const assignments = typeof window.getFleetAssignments === 'function' ? window.getFleetAssignments() : [];
    const main = [0, 1, 2]
      .filter(slot => Boolean(assignments[slot]))
      .map(slot => ({ ship: assignments[slot], slot }));
    const frigate = assignments[3]?.type === 'frigate' ? assignments[3] : null;
    return { main, frigate };
  }

  function resolveFleetPower(mainFleet) {
    const reportedPower = Number(window.getFleetPower?.());
    if (Number.isFinite(reportedPower) && reportedPower > 0) return Math.round(reportedPower);
    const fallback = mainFleet.reduce((total, entry) => {
      const value = Number(String(entry.ship?.stats || '').replace(/[^\d]/g, '')) || 0;
      return total + value;
    }, 0);
    return fallback || 1280;
  }

  function resolveGatePower(operation) {
    const chapter = Math.max(1, Number(operation.chapter) || 1);
    const gate = Math.max(1, Number(operation.gate) || 1);
    return 900 + chapter * 120 + gate * 180;
  }

  function resolveGlobalGate(operation) {
    const requestedGate = Math.max(1, Number(operation?.gate) || 1);
    const explicitGate = Number(operation?.globalGate);
    if (Number.isFinite(explicitGate) && explicitGate > 0) return Math.floor(explicitGate);
    const chapter = Math.max(1, Number(operation?.chapter) || 1);
    const region = operation?.region || 'mars';
    const regionIndex = REGION_GATE_ORDER.indexOf(region);
    const gatesPerChapter = Object.values(REGION_GATE_COUNTS).reduce((sum, count) => sum + count, 0);
    const completedRegions = regionIndex >= 0
      ? REGION_GATE_ORDER.slice(0, regionIndex).reduce((sum, key) => sum + REGION_GATE_COUNTS[key], 0)
      : gatesPerChapter;
    return (chapter - 1) * gatesPerChapter + completedRegions + requestedGate;
  }

  function normalEnemyGrowth(operation) {
    const globalGate = resolveGlobalGate(operation);
    const gateGrowth = 1 + (globalGate - 1) * .01;
    const milestoneBonus = globalGate % 10 === 0 ? 1.2 : globalGate % 5 === 0 ? 1.1 : 1;
    return { globalGate, multiplier: gateGrowth * milestoneBonus };
  }

  function tutorialEnemyFactor(operation = state?.operation) {
    const marsChapter = Number(operation?.chapter) === 1 || !operation?.chapter;
    const marsRegion = String(operation?.region || '').toLowerCase() === 'mars';
    const gate = Number(operation?.gate);
    return (marsChapter && marsRegion && gate >= 2 && gate <= 5) ? .5 : 1;
  }

  function isMagentaOperation(operation = state?.operation) {
    return Number(operation?.chapter) === 2 || String(operation?.region || '').toLowerCase().startsWith('magenta-');
  }

  function isKeplerOperation(operation = state?.operation) {
    return Number(operation?.chapter) === 3 || String(operation?.region || '').toLowerCase() === 'kepler';
  }

  function isKeplerSecretBaseOperation(operation = state?.operation) {
    return isKeplerOperation(operation) && String(operation?.region || '').toLowerCase() === 'kepler-base';
  }

  function isMagentaNearOperation(operation = state?.operation) {
    return isMagentaOperation(operation) && String(operation?.region || '').toLowerCase() === 'magenta-near';
  }

  function isMagentaTasOperation(operation = state?.operation) {
    return isMagentaOperation(operation) && String(operation?.region || '').toLowerCase() === 'magenta-tas';
  }

  function isMagentaAtmosphereOperation(operation = state?.operation) {
    return isMagentaOperation(operation) && String(operation?.region || '').toLowerCase() === 'magenta-atmosphere';
  }

  function isMachineBeastGate(operation = state?.operation) {
    return (isMagentaAtmosphereOperation(operation) && Number(operation?.gate) === 10)
      || (isKeplerOperation(operation) && ['kepler-orbit', 'kepler-atmosphere'].includes(String(operation?.region || '').toLowerCase()) && Number(operation?.gate) === 5);
  }

  function normalEnemyModifiers(operation) {
    const growth = normalEnemyGrowth(operation);
    const magenta = isMagentaOperation(operation);
    const kepler = isKeplerOperation(operation);
    return {
      growth: growth.multiplier * (magenta ? 1.5 : kepler ? 1.5 : 1) * tutorialEnemyFactor(operation),
      speed: magenta ? 1.2 : 1,
      range: magenta ? 1.2 : 1
    };
  }

  function magentaBlueBonusCount(operation = state?.operation) {
    if (!isMagentaOperation(operation)) return 0;
    const region = String(operation?.region || '').toLowerCase();
    const ratio = region === 'magenta-near' ? .05 : region === 'magenta-tas' ? .10 : region === 'magenta-atmosphere' ? .20 : 0;
    return Math.round(ENEMY_WAVE.baseCount * ratio);
  }

  function enemyArchetype(enemy) {
    return enemy?.profile?.base || enemy?.monsterType;
  }

  function createAlly(ship, index, auto, side = 'friendly') {
    // 진영(side): 'enemy'면 상대 쪽(위쪽) 배치로 만들고 상대 목록(state.enemyAllies)에 넣는다.
    const basePositions = [{ x: .5, y: .71 }, { x: .27, y: .87 }, { x: .73, y: .87 }];
    const positions = side === 'enemy' ? basePositions.map(point => ({ x: point.x, y: 1 - point.y })) : basePositions;
    const isAssaultTurtle = ship.name === '돌격 거북선';
    const isTurtleShip = ship.type === 'battlecruiser' && ship.name === '거북선';
    const isAtlas = ship.name === '아틀라스';
    const isIowa = ship.name === '아이오와';
    const isHelios = ship.name === '헬리오스';
    const isHyperion = ship.name === '히페리온';
    const isApocalypse = ship.name === '아포칼립스';
    const isNemesis = ship.name === '네메시스';
    const isAegis = ship.name === '아이기스';
    const isColossus = ship.name === '콜로서스';
    const isBastion = ship.name === '배스천';
    const isHammer = ship.name === '해머';
    const isNimitz = ship.name === '니미츠';
    const isAngela = ship.name === '앙헬라';
    const isTank = ship.name === '탱크';
    const isDozer = ship.name === '도저';
    const isCarrier = ship.name === '우주항모';
    const isKddx = ship.name === 'KDDX';
    const isPegasus = ship.name === '페가수스';
    const isPlanetDestroyer = ship.name === '행성파괴자';
    const isPandora = ship.name === '판도라';
    const isVaryag = ship.name === '바랴그';
    const isGaruda = ship.type === 'destroyer' && ship.name === '가루다';
    const isOmega = ship.name === '오메가';
    const isDeimos = ship.name === '데이모스';
    const isUranus = ship.name === '우라노스';
    const isSpear = ship.name === '스피어';
    const isBlade = ship.name === '블레이드';
    const isSuPanokseon = ship.name === '수 판옥선';
    const isDreadTurtle = ship.type === 'dreadnought' && ship.name === '거북선';
    const isMagellan = ship.name === '마젤란';
    const isIronFist = ship.name === '아이언피스트';
    const isFury = ship.name === '퓨리';
    const isBrownBess = ship.name === '브라운베스';
    const isYamato = ship.name === '야마토';
    const isStarCruiser = ship.name === '스타 크루저';
    const usesEnergy = ship.type === 'battlecruiser' || isAtlas || isNemesis || isAegis || isColossus || isBastion || isHammer || isNimitz || isAngela || isTank || isDozer || isCarrier || isDreadTurtle || isSuPanokseon || isKddx || isPegasus || isPlanetDestroyer || isPandora || isVaryag || isGaruda || isFury || isOmega || isDeimos || isUranus || isSpear || isBlade;
    const fallbackHp = isGaruda ? 1000 : isAngela ? 7900 : isVaryag ? 5300 : isYamato ? 5900 : isBrownBess ? 2500 : isTank ? 4500 : isNemesis ? 2200 : isDozer ? 1900 : isIronFist ? 2700 : isFury ? 1250 : isBlade ? 800 : isSpear ? 800 : isUranus ? 800 : isDeimos ? 1000 : isOmega ? 1100 : isPandora ? 2000 : isPlanetDestroyer ? 6000 : isNimitz ? 8000 : isCarrier ? 3500 : isSuPanokseon ? 6000 : isKddx || isPegasus ? 2000 : isDreadTurtle ? 4400 : isColossus ? 4500 : isBastion ? 2300 : isHammer ? 1100 : isAssaultTurtle ? 7000 : isHyperion ? 9000 : isAtlas ? 1300 : isHelios ? 1000 : isMagellan ? 1000 : isTurtleShip ? 3300 : ship.type === 'dreadnought' ? 135 : ship.type === 'battlecruiser' ? 120 : 105;
    const baseHp = Number(ship.profile?.[0]) > 0 ? Number(ship.profile[0]) : fallbackHp;
    const maxHp = Math.floor(baseHp * combatStatFactor(ship) * ALLY_HP_BALANCE * (state?.arenaLive ? ARENA_DURABILITY_MULT : 1));
    // 보호막 사양은 추후 함선별로 정의한다. 현재 전투에서는 수치와 시각 효과를 모두 사용하지 않는다.
    const maxShield = isCarrier ? 3000 : 0;
    const ally = {
      id: `ally-${index}`,
      ship,
      role: ROLE_LABELS[index],
      x: positions[index].x,
      y: positions[index].y,
      facingAngle: 0,
      hp: maxHp,
      maxHp,
      tacticalDefense: window.ArenaCore?.development(ship,state.tacticalResearch)||{shield:0,shieldDuration:0,reduction:0},
      tacticalFighterGuard: ship.name==='우주항모'?0:Math.max(0,300*(isNimitz?5:isColossus?4:isBastion?3:isHammer?2:0)*(window.ArenaCore?.development(ship,state.tacticalResearch).carrierHull||0)),
      shield: maxShield,
      maxShield,
      nextShot: 220 + index * 95,
      energy: usesEnergy ? 0 : null,
      maxEnergy: usesEnergy ? 100 : 0,
      isAssaultTurtle,
      assaultTurtleStars: isAssaultTurtle ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      assaultTurtleBarrageDamage: 0,
      assaultTurtleUltimateActive: false,
      isTurtleShip,
      turtleShipStars: isTurtleShip ? Math.max(ship.rarity === 'L' ? 5 : 0, Math.max(0, Math.floor(Number(ship.enhancementStars) || 0))) : 0,
      isAtlas,
      atlasStars: isAtlas ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isIowa,
      iowaStars: isIowa ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isHelios,
      heliosStars: isHelios ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isHyperion,
      hyperionStars: isHyperion ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isApocalypse,
      apocalypseStars: isApocalypse ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isNemesis,
      nemesisStars: isNemesis ? Math.max(ship.rarity !== 'SR' ? 5 : 0, Math.max(0, Math.floor(Number(ship.enhancementStars) || 0))) : 0,
      isAegis,
      aegisStars: isAegis ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isColossus,
      colossusStars: isColossus ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isBastion,
      bastionStars: isBastion ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isHammer,
      hammerStars: isHammer ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isNimitz,
      nimitzStars: isNimitz ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isAngela,
      isTank,
      tankStars: isTank ? Math.max(ship.rarity === 'L' ? 5 : 0, Math.max(0, Math.floor(Number(ship.enhancementStars) || 0))) : 0,
      isDozer,
      dozerStars: isDozer ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      dozerCannonIndex: 0,
      isCarrier,
      isKddx,
      kddxStars: isKddx ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      kddxRetreatCount: 0,
      kddxReturnPending: false,
      isPegasus,
      pegasusStars: isPegasus ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      pegasusLanceCooldown: PEGASUS_LANCE.interval,
      isPlanetDestroyer,
      planetDestroyerStars: isPlanetDestroyer ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isPandora,
      pandoraStars: isPandora ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      pandoraAttackIndex: 0,
      pandoraDespairActive: false,
      pandoraFacingLocked: false,
      isVaryag,
      isGaruda,
      garudaStars: isGaruda ? Math.max(ship.rarity === 'SR' && ship.baseRarity === 'R' ? 5 : 0, Math.max(0, Math.floor(Number(ship.enhancementStars) || 0))) : 0,
      varyagStars: isVaryag ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      varyagLastStandUsed: false,
      varyagLastStandUntil: 0,
      isOmega,
      omegaStars: isOmega ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isDeimos,
      deimosStars: isDeimos ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      deimosCannonIndex: 0,
      isUranus,
      uranusStars: isUranus ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      uranusMuzzleIndex: 0,
      isSpear,
      spearStars: isSpear ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isBlade,
      bladeStars: isBlade ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isSuPanokseon,
      suPanokseonStars: isSuPanokseon ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      suPanokseonTurnSide: -1,
      suPanokseonReturning: false,
      shieldRechargeElapsed: 0,
      nimitzAvailableFighters: isNimitz ? NIMITZ_FIGHTER.count : 0,
      nimitzAttackLocks: 0,
      nimitzAttackLocked: false,
      isDreadTurtle,
      dreadTurtleStars: isDreadTurtle ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isMagellan,
      magellanStars: isMagellan ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isIronFist,
      ironFistStars: isIronFist ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isFury,
      furyStars: isFury ? Math.max(ship.rarity !== 'SR' ? 5 : 0, Math.max(0, Math.floor(Number(ship.enhancementStars) || 0))) : 0,
      isBrownBess,
      brownBessStars: isBrownBess ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      isYamato,
      yamatoStars: isYamato ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      angelaStars: isAngela ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      yamatoLastStandUsed: false,
      yamatoImmuneUntil: 0,
      isStarCruiser,
      starCruiserStars: isStarCruiser ? Math.max(0, Math.floor(Number(ship.enhancementStars) || 0)) : 0,
      brownbessNextSide: -1,
      ironFistCannonIndex: 0,
      hammerNextCannon: HAMMER_FIGHTER.interval,
      planetDestroyerNextFighters: 220,
      homeX: positions[index].x,
      homeY: positions[index].y,
      dreadTurtleDeployed: false,
      gwimyeonShieldActive: false,
      rechargePause: 0,
      charging: false,
      missileTargetIndex: 0,
      dead: false,
      auto
    };
    if (ship.baseRarity && ship.rarity !== ship.baseRarity) {
      Object.keys(ally).filter(key => key.endsWith('Stars') && typeof ally[key] === 'number')
        .forEach(key => { ally[key] = Math.max(ally[key], 5); });
    }
    const element = document.createElement('div');
    element.className = `ally-unit ally-${['front', 'left', 'right'][index]}${ship.type === 'battlecruiser' ? ' battlecruiser-unit' : ''}${isAssaultTurtle ? ' assault-turtle-unit' : ''}${isTurtleShip ? ' turtle-ship-unit' : ''}${isAtlas ? ' atlas-unit' : ''}${isIowa ? ' iowa-unit' : ''}${isHyperion ? ' hyperion-unit' : ''}${isApocalypse ? ' apocalypse-unit' : ''}${isNemesis ? ' nemesis-unit' : ''}${isAegis ? ' aegis-unit' : ''}${isColossus ? ' colossus-unit' : ''}${isBastion ? ' bastion-unit' : ''}${isHammer ? ' hammer-unit' : ''}${isNimitz ? ' nimitz-unit' : ''}${isAngela ? ' angela-unit' : ''}${isTank ? ' tank-unit' : ''}${isDozer ? ' dozer-unit' : ''}${isCarrier ? ' carrier-unit' : ''}${isDreadTurtle ? ' dread-turtle-unit' : ''}${isSuPanokseon ? ' supanokseon-unit' : ''}${isKddx ? ' kddx-unit' : ''}${isPegasus ? ' pegasus-unit' : ''}${isPlanetDestroyer ? ' planet-destroyer-unit' : ''}${isPandora ? ' pandora-unit' : ''}${isVaryag ? ' varyag-unit' : ''}${isGaruda ? ' garuda-unit' : ''}${isFury ? ' fury-unit' : ''}${isBrownBess ? ' brown-bess-unit' : ''}${isYamato ? ' yamato-unit' : ''}${isOmega ? ' omega-unit' : ''}${isDeimos ? ' deimos-unit' : ''}${isUranus ? ' uranus-unit' : ''}${isSpear ? ' spear-unit' : ''}${isBlade ? ' blade-unit' : ''}${isIronFist ? ' ironfist-unit' : ''}`;
    element.style.left = percent(ally.x);
    element.style.top = percent(ally.y);
    element.style.setProperty('--rarity-color', RARITY_COLORS[ship.rarity] || RARITY_COLORS.R);
    element.innerHTML = `${maxShield ? `<div class="ally-shield${isCarrier ? ' carrier-energy-shield' : ''}">${isCarrier ? `<em>ENERGY ${formatNumber(maxShield)}</em>` : ''}</div>` : ''}<div class="ally-facing-shell">${topViewMarkup(ship)}</div><div class="ally-info"><b>${escapeHtml(ship.name || '전술함')}</b>${isCarrier ? '<span class="carrier-shield-health"><i></i><em></em></span>' : ''}<span class="ally-health"><i></i></span>${usesEnergy ? '<span class="ally-energy"><i></i><em>0 / 100</em></span>' : ''}<small>${ally.role} · ${escapeHtml(ship.rarity || 'R')}${auto ? ' · AUTO' : ''}</small></div>`;
    ally.el = element;
    ally.facingShell = element.querySelector('.ally-facing-shell');
    ally.healthBar = element.querySelector('.ally-health i');
    ally.energyBar = element.querySelector('.ally-energy i');
    ally.energyLabel = element.querySelector('.ally-energy em');
    ally.shieldEl = element.querySelector('.ally-shield');
    if (isCarrier) addCarrierShieldGauge(ally);
    if (side === 'enemy') {
      ally.side = 'enemy';
      refs.enemyLayer.append(element);
      (state.enemyAllies ||= []).push(ally);
    } else {
      refs.allyLayer.append(element);
      state.allies.push(ally);
    }
  }

  // ── 아레나 실시간 전투 (A1): 상대 함선을 엔진 안의 적 유닛으로 만들어 실제로 싸우게 한다. ──
  // 적 함선은 제자리에서 공격만 하고(몬스터처럼 다가가지 않는다), 체력이 0이 되면 퇴각한다.
  // 상대 배치는 아군 배치(createAlly의 basePositions)를 위아래로 뒤집은 것이다: 0번(선봉)은 가운데 앞, 1·2번은 뒤쪽 좌우 날개.
  const ARENA_ENEMY_SLOTS = [{ x: .5, y: .29 }, { x: .27, y: .13 }, { x: .73, y: .13 }];
  // 상대 함선 발사 주기(PvE 발사 구조와 같은 값, arena-fire-table.md 기준).
  // interval: 한 발과 다음 발의 간격(ms), shots: 한 주기에 쏘는 발수, cycle: 주기 길이(ms).
  // 한 발의 피해는 DPS × cycle ÷ shots 이므로, 주기 평균 DPS는 스탯 DPS와 같다.
  const ARENA_ENEMY_CADENCE = {
    'dreadnought:거북선': { interval: 2000, shots: 1, cycle: 2000 },
    'battlecruiser:거북선': { interval: 330, shots: 1, cycle: 330 },
    'battlecruiser:돌격 거북선': { interval: 330, shots: 1, cycle: 330 },
    'battlecruiser:스타 크루저': { interval: 680, shots: 1, cycle: 680 },
    'destroyer:페가수스': { interval: 330, shots: 12, cycle: 7000 },
    'destroyer:우라노스': { interval: 500, shots: 1, cycle: 500 },
    'battlecruiser:브라운베스': { interval: 150, shots: 3, cycle: 1500 },
    'battlecruiser:아이오와': { interval: 500, shots: 1, cycle: 500 },
    'dreadnought:아틀라스': { interval: 2000, shots: 1, cycle: 2000 },
    'dreadnought:탱크': { interval: 2000, shots: 1, cycle: 2000 },
    'dreadnought:콜로서스': { interval: 300, shots: 4, cycle: 1360 },
    'dreadnought:니미츠': { interval: 330, shots: 5, cycle: 1000 },
    'dreadnought:앙헬라': { interval: 200, shots: 2, cycle: 1700 },
    'destroyer:블레이드': { interval: 1000, shots: 3, cycle: 5000 },
    'destroyer:오메가': { interval: 500, shots: 6, cycle: 5000 },
    'destroyer:가루다': { interval: 2000, shots: 2, cycle: 2000 },
    'destroyer:판도라': { interval: 1000, shots: 1, cycle: 1000 },
    'destroyer:스피어': { interval: 1000, shots: 1, cycle: 1000 },
    'destroyer:데이모스': { interval: 500, shots: 1, cycle: 500 },
    'battlecruiser:야마토': { interval: 500, shots: 2, cycle: 2000 },
    'dreadnought:네메시스': { interval: 500, shots: 6, cycle: 6000 },
    'dreadnought:배스천': { interval: 3300, shots: 1, cycle: 3300 },
    'dreadnought:해머': { interval: 1500, shots: 1, cycle: 1500 },
    'dreadnought:도저': { interval: 200, shots: 4, cycle: 2600 },
    'dreadnought:아이기스': { interval: 500, shots: 1, cycle: 500 },
    'dreadnought:우주항모': { interval: 330, shots: 6, cycle: 330 },
    'battlecruiser:아포칼립스': { interval: 500, shots: 1, cycle: 500 },
    'battlecruiser:헬리오스': { interval: 800, shots: 1, cycle: 800 },
    'battlecruiser:히페리온': { interval: 330, shots: 1, cycle: 330 },
    'battlecruiser:마젤란': { interval: 500, shots: 1, cycle: 500 },
    'battlecruiser:퓨리': { interval: 1000, shots: 2, cycle: 1000 },
    'battlecruiser:아이언피스트': { interval: 330, shots: 1, cycle: 330 },
    'destroyer:바랴그': { interval: 1200, shots: 1, cycle: 1200 },
    'destroyer:행성파괴자': { interval: 200, shots: 5, cycle: 2800 },
    'destroyer:수 판옥선': { interval: 300, shots: 1, cycle: 300 },
    'destroyer:KDDX': { interval: 1500, shots: 1, cycle: 1500 },
  };
  const ARENA_DEFAULT_CADENCE = { interval: 500, shots: 1, cycle: 500 };
  function createArenaEnemyShip(ship, index) {
    const slot = ARENA_ENEMY_SLOTS[index] || ARENA_ENEMY_SLOTS[0];
    const hp = Math.max(1, Math.round((Number(ship.hp) || Number(ship.maxHp) || 1000) * ARENA_DURABILITY_MULT));
    const cadence = ARENA_ENEMY_CADENCE[`${ship.type}:${ship.name}`] || ARENA_DEFAULT_CADENCE;
    const enemy = {
      id: `arena-enemy-${index}`,
      kind: 'normal',
      isArenaShip: true,
      shipName: ship.name,
      monsterType: 'arena-ship',
      profile: { image: ship.image },
      hp,
      maxHp: hp,
      x: slot.x,
      y: slot.y,
      deployed: true,
      atSlot: true,
      wasAtSlot: true,
      dead: false,
      countsForGate: false,
      stun: 0,
      cadence,
      cycleTime: 0,
      travel: enemyShotTravel(ship),
      skill: String(ship.profile?.[4] || ''),
      dps: Number(ship.dps) || 0,
      skillTimer: ARENA_ENEMY_SKILL_COOLDOWN,
      shotsFired: 0,
      shotDamage: (Number(ship.dps) || 0) * cadence.cycle / 1000 / cadence.shots,
      weapon: String(ship.profile?.[1] || ''),
      rarity: ship.rarity
    };
    // 파일럿: 스타 크루저는 아군과 같은 레이저 함수(fireBattlecruiserLaser)를 쓴다. 나머지 함선은 기존 간이 발사 표를 쓴다.
    // 거북선(드레드)은 배치된 상태에서 6열 주포 사격만 쓴다(돌격·기동·기력 방패는 아직 상대 쪽에 없음).
    if (ship.name === '스타 크루저') {
      enemy.ship = ship;
      enemy.isStarCruiser = true;
      enemy.sharedWeapon = 'battlecruiserLaser';
      enemy.energy = 0;
      enemy.maxEnergy = 100;
      enemy.starCruiserStars = Math.max(0, Math.floor(Number(ship.enhancementStars) || 0));
      enemy.facingAngle = Math.PI;
      enemy.nextShot = 220 + index * 95;
      enemy.nextLaserSide = 0;
      enemy.pendingLaserTarget = null;
    } else if (ship.name === '페가수스') {
      enemy.ship = ship;
      enemy.isPegasus = true;
      enemy.pegasusStars = Math.max(0, Math.floor(Number(ship.enhancementStars) || 0));
      enemy.energy = 0;
      enemy.maxEnergy = 100;
      enemy.charging = false;
      enemy.sharedWeapon = 'pegasusLaser';
      enemy.facingAngle = Math.PI;
      enemy.nextShot = 220 + index * 95;
    } else if (ship.type === 'dreadnought' && ship.name === '거북선') {
      enemy.ship = ship;
      enemy.isDreadTurtle = true;
      enemy.dreadTurtleDeployed = false;
      enemy.homeX = enemy.x;
      enemy.homeY = enemy.y;
      enemy.dreadTurtleStars = Math.max(0, Math.floor(Number(ship.enhancementStars) || 0));
      enemy.energy = 0;
      enemy.maxEnergy = 100;
      enemy.sharedWeapon = 'dreadTurtleCannon';
      enemy.facingAngle = Math.PI;
      enemy.nextShot = 220 + index * 95;
    }
    // 공통 발사 표에 있는 함선: 아군과 같은 첫 발 타이밍과 강화 단계 필드를 준다.
    if (ARENA_SHARED_FIRE[ship.name] && !enemy.sharedWeapon) {
      const stars = Math.max(0, Math.floor(Number(ship.enhancementStars) || 0));
      enemy.ship = ship;
      enemy.shipType = ship.type;
      enemy.nextShot = 220 + index * 95;
      // 함선별 강화 단계 필드(발사 함수가 아군과 같은 조건으로 읽는다).
      enemy.omegaStars = stars;
      enemy.varyagStars = stars;
      enemy.kddxStars = stars;
      enemy.pandoraStars = stars;
      enemy.brownBessStars = stars;
      enemy.yamatoStars = stars;
      enemy.angelaStars = stars;
      enemy.iowaStars = stars;
      enemy.heliosStars = stars;
      enemy.hyperionStars = stars;
      enemy.apocalypseStars = stars;
      enemy.magellanStars = stars;
      enemy.furyStars = stars;
      enemy.dozerStars = stars;
      enemy.assaultTurtleStars = stars;
      enemy.dozerCannonIndex = 0;
      enemy.bastionStars = stars;
      enemy.colossusStars = stars;
      enemy.nimitzStars = stars;
      enemy.hammerStars = stars;
      enemy.planetDestroyerStars = stars;
      enemy.turtleShipStars = stars;
      enemy.planetDestroyerNextFighters = 220;
      enemy.hammerNextCannon = HAMMER_FIGHTER.interval;
      // 우주항모: 기력과 방어 필드(아군 createAlly와 같은 초기값)
      enemy.energy = 0;
      enemy.maxEnergy = 100;
      enemy.shield = 0;
      enemy.maxShield = 0;
      enemy.shieldRechargeElapsed = 0;
      enemy.carrierOverflow = false;
    }
    enemy.shipType = ship.type;
    // 기본 방향은 아래(모델 180도)를 향하게 맞춘다. 파일럿이 아닌 함선도 같은 방향에서 광선이 나오게 한다.
    enemy.facingAngle = Math.PI;
    const element = document.createElement('div');
    element.className = `arena-enemy-ship ${ship.type || ''}`;
    element.style.left = percent(enemy.x);
    element.style.top = percent(enemy.y);
    element.style.setProperty('--rarity-color', RARITY_COLORS[ship.rarity] || RARITY_COLORS.R);
    // 방어막 표시: 체력 바 바로 아래에 별도 막대로 보인다(상대 쪽 방어막 수치와 같이 줄어든다).
    element.innerHTML = `<div class="arena-enemy-model">${topViewMarkup(ship)}</div><span class="enemy-hp"><i></i></span><span class="enemy-shield-bar" style="display:block;height:3px;margin-top:2px;background:rgba(0,0,0,.55);overflow:hidden"><i style="display:block;height:100%;width:0;background:#7fd8ff"></i></span><b>${escapeHtml(ship.name || '')}</b>`;
    enemy.el = element;
    enemy.healthBar = element.querySelector('.enemy-hp i');
    refs.enemyLayer.append(element);
    state.enemies.push(enemy);
    return enemy;
  }
  // 무기 종류별 투사체 시간(ms, PvE 값 기준): 미사일 420, 함재기 1000, 그 외 100.
  function enemyShotTravel(ship) {
    const kind = arenaWeaponKind(String(ship?.profile?.[1] || ''), 'normal');
    if (kind === 'missile') return 420;
    if (kind === 'fighter') return 1000;
    return 100;
  }
  // 상대 함선 스킬(간이 규칙): 10초마다 한 번, 스킬 설명 키워드로 효과 종류를 고른다.
  // 수리·회복 → 체력이 가장 낮은 상대 함선 18% 회복, 보호·방패 → 상대 전체 방어막 15%,
  // 광역·번개·포화 등 → 아군 전체에 DPS×1.8, 그 밖의 스킬 → 아군 한 척에 DPS×4 (기존 시뮬레이션 배수와 같음).
  const ARENA_ENEMY_SKILL_COOLDOWN = 10000;
  // 아레나 내구도 배율(양쪽 함선 모두 적용). 교전이 9~11초로 너무 빨리 끝나 기력 스킬이 거의 나오지 않아서 올린다.
  const ARENA_DURABILITY_MULT = 2;
  function castArenaEnemySkill(enemy) {
    const skill = String(enemy.skill || '');
    const alive = state.enemies.filter(item => item.isArenaShip && !item.dead);
    const allies = state.allies.filter(ally => !ally.dead);
    const label = skill.split(' · ')[0] || '스킬';
    if (!allies.length && !/수리|수복|회복|보호|방패|석화/.test(skill)) return;
    if (/수리|수복|회복/.test(skill)) {
      const low = alive.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (low) low.hp = Math.min(low.maxHp, low.hp + low.maxHp * .18);
    } else if (/보호|방패|석화/.test(skill)) {
      alive.forEach(item => setArenaEnemyShield(item, (Number(item.enemyShield) || 0) + item.maxHp * .15));
    } else if (/광역|난사|초신성|번개|포화|다련장/.test(skill)) {
      const source = { id: 'arena-skill', isArenaShip: true, shipName: enemy.shipName };
      allies.forEach(target => dealAllyDamage(target, enemy.dps * 1.8, source));
    } else {
      const target = allies[Math.floor(Math.random() * allies.length)];
      dealAllyDamage(target, enemy.dps * 4, { id: 'arena-skill', isArenaShip: true, shipName: enemy.shipName });
    }
    announce(`${enemy.shipName} · ${label}`, 'danger');
    appendArenaLog(`${enemy.shipName} · ${label}`, 'enemy');
  }

  // 아군 발사 루프(updateAlliedFleet)와 같은 발사 간격·발사 함수를 쓰는 상대 함선 표(기력 스킬은 아직 연결하지 않음).
  const ARENA_SHARED_FIRE = {
    '블레이드': { interval: () => BLADE_LASER.duration + BLADE_LASER.reload, fire: fireBladePiercingLaser },
    '아이언피스트': { interval: () => IRONFIST_CANNON.interval, fire: fireIronFistCannon },
    '스피어': { interval: () => SPEAR_LASER.interval, fire: fireSpearLaser },
    '우라노스': { interval: () => URANUS_CANNON.interval, fire: fireUranusCannon },
    '데이모스': { interval: () => DEIMOS_CANNON.interval, fire: fireDeimosCannon },
    '오메가': { interval: u => OMEGA_LASER.duration + (u.omegaStars >= 3 ? OMEGA_LASER.cooldown * .5 : OMEGA_LASER.cooldown), fire: fireOmegaPiercingLasers },
    '판도라': { interval: () => PANDORA_ATTACK.interval, fire: firePandoraNormalAttack },
    '가루다': { interval: () => GARUDA_MISSILE.interval, fire: fireGarudaMissilePair },
    '바랴그': { interval: u => VARYAG_MISSILE.interval / (u.varyagStars >= 3 ? 1.3 : 1), fire: fireVaryagMissiles },
    'KDDX': { interval: u => KDDX_LASER.interval * (u.kddxStars >= 3 ? .5 : 1), fire: fireKddxLaser },
    '수 판옥선': { interval: () => SUPANOKSEON_CANNON.interval, fire: fireSuPanokseonCannon },
    '아틀라스': { interval: () => ATLAS_ELECTRIC.interval, fire: fireAtlasElectric },
    '네메시스': { interval: () => NEMESIS_LASER.duration + NEMESIS_LASER.reload, fire: fireNemesisPiercingLaser },
    '아이기스': { interval: () => AEGIS_CANNON.interval, fire: fireAegisCannon },
    '탱크': { interval: () => TANK_ELECTRIC.interval, fire: fireTankElectric },
    '앙헬라': { interval: () => (ANGELA_CANNON.shots - 1) * ANGELA_CANNON.shotInterval + ANGELA_CANNON.reload, fire: fireAngelaCannonBurst },
    '판도라': { interval: () => PANDORA_ATTACK.interval, fire: firePandoraNormalAttack },
    '브라운베스': { interval: () => BROWN_BESS_LASER.sideInterval, fire: fireBrownBessLaserBurst },
    '야마토': { interval: () => (YAMATO_CANNON.shots - 1) * YAMATO_CANNON.shotInterval + YAMATO_CANNON.reload, fire: fireYamatoCannonCycle },
    '아이오와': { interval: () => IOWA_CANNON.interval, fire: fireIowaCannon },
    '헬리오스': { interval: () => HELIOS_REFRACTION.interval, fire: fireHeliosRefraction },
    '히페리온': { interval: () => HYPERION_LASER.interval, fire: fireHyperionLaser },
    '아포칼립스': { interval: () => APOCALYPSE_LASER.interval, fire: fireApocalypseLaser },
    '마젤란': { interval: () => MAGELLAN_CANNON.interval, fire: fireMagellanCannon },
    '퓨리': { interval: () => FURY_MISSILE.interval, fire: fireFuryMissiles },
    '도저': { interval: () => (DOZER_CANNON.ports - 1) * DOZER_CANNON.interval + DOZER_CANNON.reload, fire: fireDozerCannonCycle },
    '돌격 거북선': { interval: () => ASSAULT_TURTLE_MISSILE.interval, fire: fireAssaultTurtleMissile },
    // 여러 발사 주기가 함께 도는 함선: 매 프레임 tick(unit, dt)이 아군 발사 루프와 같은 주기 값으로 각 무기를 돌린다.
    '배스천': { tick: (u, dt) => arenaTickTimer(u, dt, () => BASTION_FIGHTER.travel + BASTION_FIGHTER.attackDuration + BASTION_FIGHTER.returnTravel + BASTION_FIGHTER.recovery + (u.bastionStars >= 5 ? BASTION_FIGHTER.secondSquadDelay : 0), () => fireBastionFighterWing(u)) },
    '콜로서스': { tick: (u, dt) => arenaTickTimer(u, dt, () => COLOSSUS_FIGHTER.count * COLOSSUS_FIGHTER.interval + 160, () => fireColossusFighterWing(u)) },
    '니미츠': { tick: (u, dt) => arenaTickTimer(u, dt, () => NIMITZ_FIGHTER.launchInterval, () => fireNimitzFighterWing(u)) },
    '해머': { tick: (u, dt) => {
      arenaTickTimer(u, dt, () => BASTION_FIGHTER.travel + BASTION_FIGHTER.attackDuration + BASTION_FIGHTER.returnTravel + BASTION_FIGHTER.recovery, () => fireHammerFighterWing(u));
      u.hammerNextCannon = (Number(u.hammerNextCannon) || HAMMER_FIGHTER.interval) - dt;
      if (u.hammerNextCannon <= 0) { u.hammerNextCannon = HAMMER_FIGHTER.interval; fireHammerCannon(u); }
    } },
    '행성파괴자': { tick: (u, dt) => {
      arenaTickTimer(u, dt, () => (PLANET_DESTROYER_LASER.shots - 1) * PLANET_DESTROYER_LASER.shotInterval + PLANET_DESTROYER_LASER.reload, () => firePlanetDestroyerLaserVolley(u));
      u.planetDestroyerNextFighters = (Number(u.planetDestroyerNextFighters) || 220) - dt;
      if (u.planetDestroyerNextFighters <= 0) {
        u.planetDestroyerNextFighters = PLANET_DESTROYER_FIGHTER.travel + PLANET_DESTROYER_FIGHTER.attackDuration + PLANET_DESTROYER_FIGHTER.returnTravel + PLANET_DESTROYER_FIGHTER.recovery;
        fireBastionFighterWing(u, PLANET_DESTROYER_FIGHTER);
      }
    } },
    '우주항모': { tick: (u, dt) => {
      // 기력이 차면 과부하 요격기를 쓴다. 요격기 유지(updateCarrierInterceptor)는 매 프레임 돈다.
      if (!u.charging) {
        u.energy = Math.min(u.maxEnergy, u.energy + dt / 100);
        if (u.energy >= u.maxEnergy && fireCarrierOverflow(u)) u.energy = 0;
      }
      updateCarrierInterceptor(u, dt);
    } },
    // 이름이 같은 드레드 거북선은 위에서 별도 무기(sharedWeapon)로 처리되므로, 여기에는 전투순양함 거북선만 들어온다.
    '거북선': { tick: (u, dt) => arenaTickTimer(u, dt, () => TURTLE_SHIP_MISSILE.interval / (u.turtleShipStars >= 5 ? 1.1 : 1), () => fireTurtleShipMissile(u)) }
  };

  // 기력 스킬(공격형): 기력이 차면 아군 쪽 스킬 함수를 그대로 쓴다. 보호·회복·이동형(앙헬라, 탱크, 가루다, 아이기스, 콜로서스, 니미츠, 도저, 히페리온, 돌격 거북선)은 아직 연결하지 않았다.
  const ARENA_ENERGY_SKILLS = {
    '블레이드': fireBladePiercingVolley,
    '아이언피스트': fireIronFistMainBattery,
    '오메가': fireOmegaFocusStrike,
    '데이모스': fireDeimosShotgun,
    '우라노스': fireUranusFocusBarrage,
    '스피어': fireSpearLaserVolley,
    '바랴그': fireVaryagSuicideDrones,
    '판도라': firePandoraTorpedoes,
    '행성파괴자': firePlanetDestroyerSupernova,
    'KDDX': fireKddxChainLightning,
    '수 판옥선': fireSuPanokseonMainBattery,
    '아틀라스': fireAtlasMainBattery,
    '네메시스': fireNemesisElectricNet,
    '해머': fireHammerDrones,
    '배스천': fireBastionMainBattery,
    '거북선': fireTurtleShipBombardment,
    '아이오와': fireIowaTomahawk,
    '헬리오스': fireHeliosMainBattery,
    '아포칼립스': fireApocalypseMainBattery,
    '마젤란': fireMagellanMainBattery,
    '야마토': fireYamatoFullBarrage,
    '브라운베스': fireBrownBessSniper,
    '퓨리': fireFuryBarrage,
    '앙헬라': fireAngelaWings,
    '탱크': fireTankPetrification,
    '가루다': fireGarudaGuardian,
    '아이기스': fireAegisRepair,
    '콜로서스': fireColossusMainShield,
    '니미츠': fireNimitzTotalOffensive,
    '도저': fireDozerEvasiveManeuver,
    '히페리온': fireHyperionJump,
    '돌격 거북선': fireAssaultTurtleCharge
  };

  // 기력을 채우고, 가득 차면 스킬을 쓰고 기력을 0으로 되돌린다(아군 기력 충전과 같은 속도).
  function arenaEnergyTick(enemy, dt, skill) {
    enemy.energy = Math.min(enemy.maxEnergy, (Number(enemy.energy) || 0) + dt / 100);
    if (enemy.energy >= enemy.maxEnergy && skill(enemy)) enemy.energy = 0;
  }

  // 여러 발사 주기 중 하나를 돌린다: 시간이 다 되면 발사하고, 다음 주기를 다시 잡는다.
  function arenaTickTimer(unit, dt, nextInterval, fire) {
    unit.nextShot -= dt;
    if (unit.nextShot <= 0) {
      unit.nextShot = nextInterval();
      fire();
    }
  }

  // 상대 함선 발사: 주기 안에서 정해진 간격마다 쏘고, 주기가 끝나면 다시 시작한다.
  function updateArenaShipFire(enemy, dt) {
    // 간이 스킬(castArenaEnemySkill)은 실제 기력 스킬 연결로 대체되어 더 이상 쓰지 않는다(이중 피해 방지).
    // 아군과 같은 무기 함수를 쓰는 함선은 여기서 처리한다(발사 간격도 아군 쪽 값과 같다).
    if (enemy.sharedWeapon === 'battlecruiserLaser') {
      enemy.nextShot -= dt;
      if (enemy.nextShot <= 0) {
        enemy.nextShot = BATTLECRUISER_LASER.interval * (.9 + Math.random() * .2);
        fireBattlecruiserLaser(enemy);
      }
      // 기력이 차면 주포(스킬)를 쓴다. 아군 전투함과 같은 충전 속도(100ms당 0.1)와 같은 함수를 쓴다.
      enemy.energy = Math.min(enemy.maxEnergy, enemy.energy + dt / 100);
      if (enemy.energy >= enemy.maxEnergy && fireBattlecruiserMainBattery(enemy)) enemy.energy = 0;
      return;
    }
    if (enemy.sharedWeapon === 'pegasusLaser') {
      // 충전(기력 스킬) 중에는 일반 관통 레이저를 쏘지 않는다(아군과 같은 규칙).
      if (!enemy.charging) {
        enemy.nextShot -= dt;
        if (enemy.nextShot <= 0) {
          enemy.nextShot = PEGASUS_LASER.duration + PEGASUS_LASER.reload;
          firePegasusPiercingLasers(enemy);
        }
        enemy.energy = Math.min(enemy.maxEnergy, enemy.energy + dt / 100);
        if (enemy.energy >= enemy.maxEnergy && firePegasusAnnihilation(enemy)) enemy.energy = 0;
      }
      return;
    }
    if (enemy.sharedWeapon === 'dreadTurtleCannon') {
      // 돌격은 아군과 같은 시각(전투 시작 직후)에 한 번 한다. 돌격 중에는 사격과 기력 스킬을 쓰지 않는다.
      if (!enemy.dreadTurtleDeployed && !enemy.charging) {
        fireDreadTurtleCharge(enemy);
        return;
      }
      if (enemy.charging) return;
      enemy.nextShot -= dt;
      if (enemy.nextShot <= 0) {
        enemy.nextShot = DREAD_TURTLE_CANNON.interval;
        fireDreadTurtleCannonBarrage(enemy);
      }
      // 기력이 차면 관기연 방패를 쓴다. 아군과 같은 충전 속도를 쓴다(돌격·순간이동은 상대 쪽에 없음).
      enemy.energy = Math.min(enemy.maxEnergy, enemy.energy + dt / 100);
      if (enemy.energy >= enemy.maxEnergy && fireArenaEnemyGwimyeonShield(enemy)) enemy.energy = 0;
      return;
    }
    const shared = ARENA_SHARED_FIRE[enemy.shipName];
    if (shared) {
      // 충전 중(예: 니미츠 과부하, 아이기스 수리 중)에는 기본 발사를 멈춘다. 기력은 계속 채운다(아군과 같은 규칙).
      if (enemy.charging) {
        const chargingSkill = ARENA_ENERGY_SKILLS[enemy.shipName];
        if (chargingSkill && !enemy.dead) enemy.energy = Math.min(enemy.maxEnergy, (Number(enemy.energy) || 0) + dt / 100);
        return;
      }
      if (shared.tick) shared.tick(enemy, dt);
      else {
        enemy.nextShot -= dt;
        if (enemy.nextShot <= 0) {
          enemy.nextShot = shared.interval(enemy);
          shared.fire(enemy);
        }
      }
      const energySkill = ARENA_ENERGY_SKILLS[enemy.shipName];
      if (energySkill) arenaEnergyTick(enemy, dt, energySkill);
      return;
    }
    const cadence = enemy.cadence || ARENA_DEFAULT_CADENCE;
    enemy.cycleTime = (Number(enemy.cycleTime) || 0) + dt;
    if (enemy.cycleTime >= cadence.cycle) {
      enemy.cycleTime -= cadence.cycle;
      enemy.shotsFired = 0;
    }
    while ((enemy.shotsFired || 0) < cadence.shots && enemy.cycleTime >= (enemy.shotsFired || 0) * cadence.interval) {
      enemy.shotsFired = (enemy.shotsFired || 0) + 1;
      const target = monsterTargetFor(enemy);
      if (!target || target.dead) continue;
      drawArenaShipShot(enemy, target);
      const shotDamage = enemy.shotDamage;
      schedule(() => { if (!enemy.dead && !target.dead) dealAllyDamage(target, shotDamage, enemy); }, enemy.travel || 0);
    }
  }
  function drawArenaShipShot(source, target) {
    const kind = arenaWeaponKind(source.weapon, 'normal');
    const from = pointOf(source), to = pointOf(target);
    const lineSide = 'enemy-line';
    if (kind === 'electric') {
      drawElectricStrike(from, to, Math.random() < .5 ? 1 : 2);
    } else if (kind === 'missile') {
      const missile = document.createElement('i');
      missile.className = 'fx-missile';
      refs.effects.append(missile);
      positionProjectile(missile, from, to);
      schedule(() => missile.remove(), 520);
    } else {
      const beam = document.createElement('i');
      beam.className = `fx-line ${kind === 'cannon' ? 'cannon' : ''} ${lineSide}`.replace(/\s+/g, ' ').trim();
      refs.effects.append(beam);
      positionLine(beam, from, to);
      schedule(() => beam.remove(), 260);
    }
    source.el?.classList.add('arena-firing');
    schedule(() => source.el?.classList.remove('arena-firing'), 260);
  }
  function retreatArenaShip(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    enemy.el?.classList.add('retreating');
    announce(`${enemy.shipName || '적 함선'} 퇴각`, 'friendly');
    schedule(() => enemy.el?.remove(), 900);
    checkArenaLiveEnd();
  }
  // 아군 전원 퇴각 → 패배, 적 전원 퇴각 → 승리. 결과는 엔진에서 정한다.
  function checkArenaLiveEnd() {
    if (!state?.arenaLive || state.status !== 'combat') return;
    const alliesAlive = state.allies.some(ally => !ally.dead);
    const enemiesAlive = state.enemies.some(enemy => enemy.isArenaShip && !enemy.dead);
    if (!enemiesAlive) finishBattle(true);
    else if (!alliesAlive) finishBattle(false);
  }
  function updateArenaLiveHud() {
    const hud = refs.field.querySelector('.arena-hud');
    if (!hud) return;
    const toUnit = unit => ({ hp: Math.max(0, unit.hp), maxHp: unit.maxHp || 1 });
    updateArenaHud({
      teams: [
        state.allies.filter(ally => !ally.dead || ally.hp > 0).slice(0, 3).map(toUnit),
        state.enemies.filter(enemy => enemy.isArenaShip).slice(0, 3).map(toUnit)
      ]
    });
  }
  // 실시간 전투 시작: 아군은 전투 함선 생성 함수로, 적은 적 함선 함수로 만든다.
  function startArenaBattle() {
    window.addMissionProgress?.('daily', 'arena-join', 1);
    window.addMissionProgress?.('weekly', 'arena-5', 1);
    if (!state || state.status !== 'ready' || !state.arenaMatch) return;
    const match = state.arenaMatch;
    refs.allyLayer.replaceChildren();
    refs.enemyLayer.replaceChildren();
    state.arenaLive = true;
    state.hudAccumulator = 0;
    state.frigateCooldown = 0;
    state.damageBoost = 0;
    state.frigate = match.fleet[3]?.type === 'frigate' ? match.fleet[3] : null;
    state.frigateAuto = Boolean(state.frigate);
    state.arenaEnemyFrigate = match.enemyDeck[3]?.type === 'frigate' ? { ship: match.enemyDeck[3], cooldown: ARENA_ENEMY_FRIGATE_COOLDOWN * .5 } : null;
    state.allies = [];
    state.enemies = [];
    state.kills = 0;
    match.fleet.slice(0, 3).forEach((ship, index) => { if (ship) createAlly(ship, index, false); });
    match.enemyDeck.slice(0, 3).forEach((ship, index) => { if (ship) createArenaEnemyShip(ship, index); });
    state.status = 'combat';
    state.paused = false;
    state.elapsed = 0;
    state.lastFrame = performance.now();
    refs.battleStart.hidden = true;
    refs.battleSkip.hidden = true;
    syncBattleSpeed();
    refs.battleForfeit.textContent = '전투포기';
    refs.battleForfeit.classList.add('combat-forfeit');
    refs.battleMap.disabled = true;
    refs.field.classList.add('combat-active');
    updateArenaLiveHud();
    announce('결투 개시', 'danger');
    frameHandle = requestAnimationFrame(runFrame);
  }

  // 상대 프리깃(간이 규칙): 12초마다 이름 계열에 따라 아군 전체 방어막, 상대 함선 회복, 아군 1척 지원 공격 중 하나를 쓴다.
  const ARENA_ENEMY_FRIGATE_COOLDOWN = 12000;
  function updateArenaEnemyFrigate(dt) {
    const frigate = state.arenaEnemyFrigate;
    if (!frigate) return;
    frigate.cooldown -= dt;
    if (frigate.cooldown > 0) return;
    frigate.cooldown += ARENA_ENEMY_FRIGATE_COOLDOWN;
    const ships = state.enemies.filter(enemy => enemy.isArenaShip && !enemy.dead);
    if (!ships.length) return;
    const name = frigate.ship.name || '';
    if (/방패|보호/.test(name)) {
      ships.forEach(enemy => setArenaEnemyShield(enemy, (Number(enemy.enemyShield) || 0) + enemy.maxHp * .2));
      announce(`${name} · 방어막 전개`, 'danger');
    } else if (/건설|과학|수리/.test(name)) {
      ships.forEach(enemy => { enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * .1); });
      announce(`${name} · 수리 지원`, 'danger');
    } else {
      const targets = state.allies.filter(ally => !ally.dead);
      if (targets.length) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        dealAllyDamage(target, Math.max(1, (Number(frigate.ship.dps) || 0) * 2), { id: 'arena-frigate', isArenaShip: true, ship: frigate.ship });
      }
      announce(`${name} · 지원 공격`, 'danger');
    }
  }

  function createNormalEnemy(index, total) {
    const blueExtraCount = Number(state.magentaBlueBonusCount || 0);
    const keplerOperation = isKeplerOperation();
    const isBlueVariant = keplerOperation || index >= ENEMY_WAVE.baseCount && index < ENEMY_WAVE.baseCount + blueExtraCount;
    const blueType = isBlueVariant ? BLUE_ENEMY_TYPES[(keplerOperation ? index : index - ENEMY_WAVE.baseCount) % BLUE_ENEMY_TYPES.length] : null;
    const ratioIndex = index % 20;
    const suicideMonstersEnabled = resolveGlobalGate(state.operation) > REGION_GATE_COUNTS.mars;
    const baseMonsterType = !suicideMonstersEnabled
      ? (ratioIndex < 12 ? 'gasimon' : ratioIndex < 18 ? 'jipgemon' : 'dokchimmon')
      : (ratioIndex < 11 ? 'gasimon' : ratioIndex < 17 ? 'jipgemon' : ratioIndex < 19 ? 'dokchimmon' : 'suicidemon');
    const plasmaBug = !isBlueVariant && isOortPlasmaBugMixGate() && index % 10 === 0;
    const monsterType = plasmaBug ? 'plasma-bug' : (blueType || baseMonsterType);
    const profile = plasmaBug
      ? { hp: PLASMA_BUG.hp, speed: PLASMA_BUG.speed, range: PLASMA_BUG.range, attack: 'plasma', damage: PLASMA_BUG.damage, image: 'enemy-plasma-bug.png' }
      : (isBlueVariant ? BLUE_ENEMY_PROFILES[monsterType] : ENEMY_PROFILES[monsterType]);
    const modifiers = normalEnemyModifiers(state.operation);
    const blueMultiplier = isBlueVariant ? 2 : 1;
    const frenzyMultiplier = isOortFrenzyGate() ? 2 : 1;
    const attackInterval = plasmaBug ? PLASMA_BUG.cooldown : 3000 / (isOortFrenzyGate() ? 1.2 : 1) / blueMultiplier;
    const baseEnemy = index < ENEMY_WAVE.baseCount;
    const bonusIndex = Math.max(0, index - ENEMY_WAVE.baseCount);
    const bonusWave = ENEMY_WAVE.bonusCount ? Math.floor(bonusIndex / ENEMY_WAVE.bonusCount) : 0;
    const bonusOrder = ENEMY_WAVE.bonusCount ? bonusIndex % ENEMY_WAVE.bonusCount : 0;
    const spawnAt = baseEnemy
      ? 150 + index / Math.max(1, Math.min(ENEMY_WAVE.baseCount, total) - 1) * (ENEMY_WAVE.baseDuration - 150)
      : (blueExtraCount
        ? 150 + (index - ENEMY_WAVE.baseCount) / Math.max(1, blueExtraCount - 1) * (ENEMY_WAVE.baseDuration - 150)
        : ENEMY_WAVE.bonusTimes[bonusWave] + bonusOrder * 70);
    const spawn = plasmaBug
      ? { x: .1 + Math.random() * .8, y: .42 + Math.random() * .21 }
      : { x: .07 + Math.random() * .86, y: -.075 - Math.random() * .055 };
    const enemy = {
      id: `enemy-${index}`,
      kind: 'normal',
      monsterType,
      profile,
      hp: plasmaBug ? PLASMA_BUG.hp : Math.round(profile.hp * modifiers.growth * blueMultiplier),
      maxHp: plasmaBug ? PLASMA_BUG.hp : Math.round(profile.hp * modifiers.growth * blueMultiplier),
      x: spawn.x,
      y: spawn.y,
      speed: profile.speed * frenzyMultiplier * modifiers.speed * blueMultiplier * (.86 + Math.random() * .28),
      attackRange: profile.range * modifiers.range,
      approachOffset: plasmaBug || (profile.base || monsterType) === 'suicidemon' ? 0 : (Math.random() - .5) * ((profile.base || monsterType) === 'jipgemon' ? .055 : .15),
      spawnAt,
      deployed: false,
      atSlot: false,
      wasAtSlot: false,
      dead: false,
      countsForGate: true,
      target: null,
      nextAttack: attackInterval,
      attackInterval,
      stun: 0,
      attackPower: plasmaBug ? PLASMA_BUG.damage : Math.round(profile.damage * modifiers.growth * blueMultiplier),
      attackKind: profile.attack,
      archetype: profile.base || monsterType
    };
    const element = document.createElement('div');
    element.className = `enemy-unit monster-${monsterType}${isBlueVariant ? ' blue-variant' : ''}${plasmaBug ? ' plasma-bug-dormant' : ''}`;
    element.style.left = percent(enemy.x);
    element.style.top = percent(enemy.y);
    element.innerHTML = plasmaBug
      ? PLASMA_BUG_MARKUP
      : `<img class="enemy-sprite" src="${profile.image}" alt="" /><span class="enemy-hp"><i></i></span>`;
    enemy.el = element;
    enemy.healthBar = element.querySelector('.enemy-hp i');
    refs.enemyLayer.append(element);
    state.enemies.push(enemy);
  }

  function startBattle() {
    if (!state || state.status !== 'ready') return;
    if (state.arenaMatch) { startArenaBattle(); return; }
    if (!state.allies.length) {
      announce('함대관리에서 주력 함선을 편성하세요', 'danger');
      window.show?.('collection');
      return;
    }
    state.status = 'combat';
    state.paused = false;
    state.elapsed = 0;
    state.lastFrame = performance.now();
    window.dispatchEvent(new CustomEvent('tutorial-battle-started', {detail:{operation:state.operation}}));
    refs.battleStart.hidden = true;
    refs.battleSkip.hidden = Boolean(state.arenaMatch || state.bounty);
    syncBattleSpeed();
    refs.battleForfeit.textContent = '전투포기';
    refs.battleForfeit.classList.add('combat-forfeit');
    refs.battleMap.disabled = true;
    refs.field.classList.add('combat-active');
    if (isOortColonyGate()) { refs.viewport?.classList.add('oort-camera-active'); state.oortCameraStartedAt = performance.now(); }
    if (state.bounty) {
      spawnBlackbeard();
    } else {
      deployNormalEnemies();
      if (!isKeplerOperation()) schedule(spawnPiratesIfLucky, 10000 + Math.random() * 5000);
      scheduleMidMonsterArrival();
    }
    if (isKeplerSecretBaseOperation()) checkBossThreshold();
    updateFrigateButton();
    announce('전투 개시', 'danger');
    frameHandle = requestAnimationFrame(runFrame);
  }

  function configureStartButton() {
    if (state?.arenaMatch) {
      refs.battleStart.classList.remove('fleet-required');
      refs.battleStart.querySelector('b').textContent = 'SHOOTOUT';
      refs.battleStart.querySelector('span').textContent = 'BEGIN SHOOTOUT';
      return;
    }
    const hasFleet = state.allies.length > 0;
    refs.battleStart.classList.toggle('fleet-required', !hasFleet);
    refs.battleStart.querySelector('b').textContent = hasFleet ? '전투개시' : '함대 편성';
    refs.battleStart.querySelector('span').textContent = hasFleet ? 'TOUCH TO ENGAGE' : 'RETURN TO FLEET MANAGEMENT';
  }

  function deployNormalEnemies() {
    state.enemies.forEach(enemy => {
      const delay = enemy.spawnAt;
      schedule(() => {
        if (!state || state.status !== 'combat' || enemy.dead) return;
        if (enemy.monsterType === 'plasma-bug') {
          enemy.el.classList.remove('plasma-bug-dormant');
          enemy.el.classList.add('emerging');
          createPlasmaBugHole(enemy);
          schedule(() => {
            if (!state || state.status !== 'combat' || enemy.dead) return;
            enemy.deployed = true;
            enemy.el.classList.remove('emerging');
            enemy.el.classList.add('entered');
          }, PLASMA_BUG.emerge);
          return;
        }
        enemy.deployed = true;
        enemy.el.classList.add('entered');
      }, delay);
    });
  }

  function isOortOperation() {
    return ['oort', 'oort-cloud', 'oortcloud'].includes(String(state?.operation?.region || '').toLowerCase());
  }

  function isOortColonyGate(operation = state?.operation) {
    const region = String(operation?.region || '').toLowerCase();
    const gate = Number(operation?.gate);
    return ['oort', 'oort-cloud', 'oortcloud'].includes(region) && [10, 15, 20].includes(gate);
  }

  function isOortAncientBeastGate(operation = state?.operation) {
    const region = String(operation?.region || '').toLowerCase();
    return ['oort', 'oort-cloud', 'oortcloud'].includes(region) && [10, 15].includes(Number(operation?.gate));
  }

  function isOortFinalBossGate(operation = state?.operation) {
    const region = String(operation?.region || '').toLowerCase();
    return ['oort', 'oort-cloud', 'oortcloud'].includes(region) && Number(operation?.gate) === 20;
  }

  function isOortPlasmaBugGate() {
    return isOortOperation() && Number(state?.operation?.gate) === 15;
  }

  function isAncientBeastPlasmaWaveGate() {
    // 타스 5관문에서는 플라즈마 버그를 내보내지 않는다(중형몹 호출 간격으로 압박).
    return isOortPlasmaBugGate();
  }

  function isOortFrenzyGate(operation = state?.operation) {
    const region = String(operation?.region || '').toLowerCase();
    const gate = Number(operation?.gate);
    return ['oort', 'oort-cloud', 'oortcloud'].includes(region) && [15, 20].includes(gate);
  }

  function isOortPlasmaBugMixGate(operation = state?.operation) {
    const region = String(operation?.region || '').toLowerCase();
    return ['oort', 'oort-cloud', 'oortcloud'].includes(region) && Number(operation?.gate) === 20;
  }

  function scheduleMidMonsterArrival() {
    // 오르트구름 10·15관문의 고대 괴수는 별도 등장 조건을 사용한다.
    if (isOortAncientBeastGate()) return;
    if (!state || !(isMidMonsterOperation() || isOortAncientBeastGate())) return;
    state.midBossPending = true;
    schedule(() => {
      if (!state) return;
      state.midBossPending = false;
      if (state.status !== 'combat' || hasActiveMidMonster()) return;
      spawnBoss();
    }, isKeplerOperation() ? 0 : isMagentaAtmosphereOperation() ? 10000 : 15000);
  }

  function spawnPiratesIfLucky() {
    if (!state || state.status !== 'combat') return;
    if (Math.random() < SPACE_PIRATE.normalChance) spawnPirate(false);
    if (Math.random() < SPACE_PIRATE.goldenChance) spawnPirate(true);
  }

  function spawnPirate(isGolden = false) {
    if (!state || state.status !== 'combat') return;
    const chapter = Math.max(1, Number(state.operation?.chapter) || 1);
    const hp = Math.round((isGolden ? SPACE_PIRATE.goldenHp : SPACE_PIRATE.hp) * Math.pow(1.2, chapter - 1));
    const pirate = {
      id: `space-pirate-${isGolden ? 'golden-' : ''}${state.pirates.length + 1}`,
      kind: 'pirate',
      isGoldenPirate: isGolden,
      hp,
      maxHp: hp,
      x: -.08,
      y: .68,
      elapsed: 0,
      deployed: true,
      dead: false,
      escaped: false
    };
    const element = document.createElement('div');
    element.className = `enemy-unit space-pirate${isGolden ? ' golden-pirate' : ''}`;
    element.style.left = percent(pirate.x);
    element.style.top = percent(pirate.y);
    element.innerHTML = `<img class="enemy-sprite" src="enemy-space-pirate.png" alt="${isGolden ? '황금 우주해적선' : '우주해적선'}" /><span class="enemy-hp"><i></i></span>`;
    pirate.el = element;
    pirate.healthBar = element.querySelector('.enemy-hp i');
    state.pirates.push(pirate);
    refs.enemyLayer.append(element);
    requestAnimationFrame(() => element.classList.add('entered'));
    announce(isGolden ? '황금 우주해적선 포착' : '우주해적선 포착', 'friendly');
  }

  function updatePirates(dt) {
    if (!state?.pirates?.length) return;
    state.pirates.forEach(pirate => {
      if (pirate.dead || pirate.escaped) return;
      pirate.elapsed += dt;
      const progress = Math.min(1, pirate.elapsed / SPACE_PIRATE.duration);
      // 좌측(9시)에서 우상단(1시)으로 천천히 지나간다.
      pirate.x = -.08 + 1.18 * progress;
      pirate.y = .68 - .83 * progress;
      pirate.el.style.left = percent(pirate.x);
      pirate.el.style.top = percent(pirate.y);
      if (progress >= 1) {
        pirate.escaped = true;
        pirate.el.classList.add('exiting');
        schedule(() => pirate.el?.remove(), 320);
      }
    });
    state.pirates = state.pirates.filter(pirate => !pirate.escaped || !pirate.el?.isConnected);
  }

  function runFrame(now) {
    if (!state || state.status !== 'combat') return;
    if (!document.getElementById('battle')?.classList.contains('active')) {
      stopRuntime();
      return;
    }
    // 화면 갱신 시각(now) 대신 전투 시계로 흐른 시간을 잽니다. 2배속이면 한 프레임에 최대 55ms씩 나눠 두 번 계산합니다.
    const current = performance.now();
    const elapsedMs = Math.min(55 * battleSpeed, Math.max(0, current - state.lastFrame));
    state.lastFrame = current;
    applyBattleAnimationSpeed();
    if (!state.paused) {
      for (let remaining = elapsedMs; remaining > 0 && state.status === 'combat'; remaining -= 55) stepBattle(Math.min(55, remaining));
    }
    frameHandle = requestAnimationFrame(runFrame);
  }

  function stepBattle(dt) {
    // 대기권 5관문 종료 안전장치: 종료 판정은 처치 이벤트에서만 돌기 때문에, 조건이 마지막 이벤트 뒤에 맞으면 여기서 매 프레임 확인한다.
    if (state.status === 'combat' && isKeplerOperation() && String(state.operation?.region || '').toLowerCase() === 'kepler-atmosphere' && Number(state.operation?.gate) === 5 && state.kills >= state.normalTotal && state.keplerAtmosphereMachineBossDefeated) {
      state.enemies.filter(enemy => !enemy.dead).forEach(enemy => { enemy.dead = true; enemy.el?.remove(); });
      state.midBosses = [];
      finishBattle(true);
      return;
    }
    {
      state.elapsed += dt / 1000;
      if (state.bounty && state.elapsed >= state.bounty.limit) {
        state.elapsed = state.bounty.limit;
        finishBattle(false, '제한시간이 끝났습니다. 보스를 격파하지 못했습니다.');
        return;
      }
      state.hudAccumulator += dt;
      state.frigateCooldown = Math.max(0, state.frigateCooldown - dt / 1000);
      if (state.frigateAuto && state.frigate && state.frigateCooldown <= 0) launchFrigateSkill();
      state.damageBoost = Math.max(0, state.damageBoost - dt);
      if (state.damageBoost <= 0) state.allies.forEach(ally => ally.el?.classList.remove('atlas-damage-boost'));
      updateNormalEnemies(dt);
      updatePirates(dt);
      updateAlliedFleet(dt);
      updateBoss(dt);
      updateToxicPoison(dt);
      updateColossusShieldThrows(dt);
      updateAngelaSwords(dt);
    updatePegasusLances(dt);
      if (state.arenaLive) checkArenaLiveEnd();
      if (state.arenaLive) updateArenaEnemyFrigate(dt);
      if (state.hudAccumulator >= 120) {
        state.hudAccumulator = 0;
        if (state.arenaLive) updateArenaLiveHud();
        updateHud();
        updateFrigateButton();
      }
    }
  }

  // 전투 화면 안의 CSS 애니메이션(탄환 비행, 폭발 등)도 배속에 맞춰 재생 속도를 바꿉니다.
  let appliedAnimationSpeed = 1;
  function applyBattleAnimationSpeed() {
    if (battleSpeed === 1 && appliedAnimationSpeed === 1) return;
    const root = refs.viewport || refs.field;
    if (!root?.getAnimations) return;
    for (const animation of root.getAnimations({ subtree: true })) {
      if (animation.playbackRate !== battleSpeed) animation.playbackRate = battleSpeed;
    }
    appliedAnimationSpeed = battleSpeed;
  }

  function updateNormalEnemies(dt) {
    for (const enemy of state.enemies) {
      if (enemy.dead) {
        if (enemy.pbAim) clearPlasmaBugFx(enemy);
        continue;
      }
      if (!enemy.deployed) continue;
      if (enemy.monsterType === 'plasma-bug' && applyPlasmaBugTerrainDrift(enemy, dt)) continue;
      enemy.stun = Math.max(0, enemy.stun - dt);
      if (updateDreadTurtleFearMovement(enemy, dt)) continue;
      if (enemy.stun > 0) continue;
      if (enemy.monsterType === 'plasma-bug' && enemy.plasmaAnchored) {
        updatePlasmaBugAttack(enemy, dt);
        continue;
      }
      if (enemy.charging) continue;
      const target = monsterTargetFor(enemy);
      if (!target) continue;
      if (enemy.isArenaShip) {
        // 상대 함선이 쏘는 동안에는 발사자를 해당 함선으로 둔다(아군 발사 루프와 같은 방식). 예약된 피해도 같은 발사자를 쓴다.
        const previousSource = activeDamageSource;
        activeDamageSource = enemy;
        try { updateArenaShipFire(enemy, dt); } finally { activeDamageSource = previousSource; }
        continue;
      }
      const isSuicideMonster = enemyArchetype(enemy) === 'suicidemon';
      const destination = enemy.monsterType === 'plasma-bug' ? { x: target.x, y: target.y } : {
        x: Math.max(.05, Math.min(.95, target.x + enemy.approachOffset)),
        y: Math.max(.12, target.y - enemy.attackRange)
      };
      const dx = destination.x - enemy.x;
      const dy = destination.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      // 플라즈마버그: 지형이 흐르는 동안에는 충전 중 흘러내릴 거리만큼 더 멀리서 자리를 잡는다.
      const plasmaInRange = enemy.monsterType === 'plasma-bug'
        && plasmaBugDistance(enemy, target) <= enemy.attackRange + plasmaBugDriftAllowance();
      if (enemy.monsterType === 'plasma-bug') setPlasmaBugHeading(enemy, plasmaBugAngleTo(enemy, target), dt);
      if (distance > .012 && !plasmaInRange) {
        if (enemy.monsterType === 'plasma-bug') kickPlasmaBugDust(enemy, dt);
        enemy.atSlot = false;
        enemy.wasAtSlot = false;
        enemy.el.classList.remove('attacking');
        const distance = Math.hypot(dx, dy);
        const step = enemy.speed * dt;
        if (distance <= step) {
          enemy.x = destination.x;
          enemy.y = destination.y;
        } else {
          enemy.x += (dx / distance) * step;
          enemy.y += (dy / distance) * step;
        }
        enemy.el.style.left = percent(enemy.x);
        enemy.el.style.top = percent(enemy.y);
      } else {
        enemy.atSlot = true;
        enemy.el.classList.add('attacking');
        if (!enemy.wasAtSlot) {
          enemy.wasAtSlot = true;
          if (enemy.monsterType === 'plasma-bug') {
            enemy.plasmaAnchored = true;
            enemy.plasmaCharge = PLASMA_BUG.charge;
            enemy.plasmaCooldown = 0;
            enemy.charging = true;
            enemy.el.classList.add('plasma-bug-anchored', 'charging');
            continue;
          }
        }
      }
      if (!enemy.atSlot) continue;
      if (isSuicideMonster) {
        if (!enemy.suicideArmed) {
          enemy.suicideArmed = true;
          enemy.el.classList.add('arming');
          schedule(() => {
            if (!enemy.dead && enemy.suicideArmed) explodeSuicideMonster(enemy, target);
          }, 3000);
        }
        continue;
      }
      enemy.nextAttack -= dt;
      if (enemy.nextAttack <= 0) {
        enemy.nextAttack = enemy.attackInterval;
        enemyAttack(enemy);
      }
    }
  }

  function explodeSuicideMonster(enemy, target) {
    if (!enemy || enemy.dead) return;
    enemy.dead = true;
    enemy.el?.classList.remove('arming', 'attacking');
    enemy.el?.classList.add('destroyed');
    const point = pointOf(enemy);
    createExplosion(point, 'suicide');
    if (target && !target.dead) {
      dealAllyDamage(target, enemy.attackPower);
    }
    state.kills += 1;
    if (enemy.countsForGate) state.magentaBaseKills = Number(state.magentaBaseKills || 0) + 1;
    updateHud(true);
    checkBossThreshold();
    schedule(() => enemy.el?.remove(), 420);
  }

  function updateAlliedFleet(dt) {
    const profile = WEAPONS[selectedWeapon] || WEAPONS.missile;
    for (const ally of state.allies) {
      if (ally.dead) continue;
      const previousDamageSource = activeDamageSource;
      activeDamageSource = ally;
      try {
      if (ally.machineFreezeStacks && performance.now() >= ally.machineFreezeUntil) {
        ally.machineFreezeStacks = 0;
        ally.el?.classList.remove('machine-frozen');
        ally.el?.querySelector('.machine-freeze-badge')?.remove();
      }
      const attackSpeedRatio = 1 - Math.min(10, ally.machineFreezeStacks || 0) * .05;
      ally.stun = Math.max(0, Number(ally.stun) || 0);
      if (ally.stun > 0) { ally.stun = Math.max(0, ally.stun - dt); continue; }
      if (!ally.charging && ally.nextShot > 0) ally.nextShot += dt * (1 - attackSpeedRatio);
      const energyRechargeLocked = Number(ally.energyRechargeDisabledUntil) > performance.now();
      if (state.fleetAttackSpeedBoostUntil > performance.now() && !ally.charging && ally.nextShot > 0) ally.nextShot -= dt * IOWA_TOMAHAWK.fleetSpeedBonus;
      if (ally.gwimyeonShieldActive && ally.dreadTurtleFearEnabled) updateDreadTurtleNearbyFear(ally);
      const mainBatteryReady = !ally.charging && ally.energy >= ally.maxEnergy && (ally.isStarCruiser || ally.isBrownBess || ally.isYamato);
      if (!(ally.facingLockUntil > performance.now() || mainBatteryReady)) faceAllyTowardTarget(ally, shooterTargetFor(ally));
      if (ally.isPegasus && ally.pegasusStars >= 5) {
        ally.pegasusLanceCooldown -= dt;
        if (ally.pegasusLanceCooldown <= 0) {
          ally.pegasusLanceCooldown += PEGASUS_LANCE.interval;
          launchPegasusLance(ally);
        }
      }
      if (ally.isCarrier) {
        if (!ally.charging && !energyRechargeLocked) {
          ally.energy = Math.min(ally.maxEnergy, ally.energy + dt * attackSpeedRatio / 100);
          updateBattlecruiserEnergy(ally);
          if (ally.energy >= ally.maxEnergy && fireCarrierOverflow(ally)) {
            ally.energy = 0;
            updateBattlecruiserEnergy(ally);
          }
        }
        ally.shieldRechargeElapsed += dt;
        const shieldInterval = ally.carrierOverflow ? CARRIER_OVERFLOW.shieldInterval : 3000;
        const shieldAmount = ally.carrierOverflow ? CARRIER_OVERFLOW.shieldAmount : 1;
        while (ally.shieldRechargeElapsed >= shieldInterval) {
          ally.shieldRechargeElapsed -= shieldInterval;
          ally.shield = Math.min(ally.maxShield, ally.shield + shieldAmount);
          if (ally.shield > 0 && !ally.shieldEl) restoreCarrierShieldVisual(ally);
          updateCarrierShieldGauge(ally);
          const shieldLabel = ally.shieldEl?.querySelector('em');
          if (shieldLabel) shieldLabel.textContent = `ENERGY ${formatNumber(ally.shield)}`;
        }
        updateCarrierInterceptor(ally, dt);
        continue;
      }
      if (ally.ship.type === 'battlecruiser' || ally.isAtlas || ally.isNemesis || ally.isAegis || ally.isColossus || ally.isBastion || ally.isHammer || ally.isNimitz || ally.isAngela || ally.isTank || ally.isDozer || ally.isDreadTurtle || ally.isSuPanokseon || ally.isKddx || ally.isPegasus || ally.isPlanetDestroyer || ally.isPandora || ally.isVaryag || ally.isGaruda || ally.isOmega || ally.isDeimos || ally.isUranus || ally.isSpear || ally.isBlade || ally.isIronFist) {
        if (ally.isDreadTurtle && !ally.dreadTurtleDeployed && !ally.charging) {
          fireDreadTurtleCharge(ally);
          continue;
        }
        if (!ally.charging) {
          ally.rechargePause = Math.max(0, (ally.rechargePause || 0) - dt);
          const brownBessRechargesWhileSniping = ally.isBrownBess && ally.brownBessStars >= 5;
          if (!energyRechargeLocked && !ally.rechargePause && (!ally.charging || brownBessRechargesWhileSniping)) ally.energy = Math.min(ally.maxEnergy, ally.energy + dt * attackSpeedRatio / 100);
          updateBattlecruiserEnergy(ally);
          if (ally.energy >= ally.maxEnergy) {
            const triggerMainBattery = ally.isAngela ? fireAngelaWings(ally) : ally.isTank ? fireTankPetrification(ally) : ally.isDozer ? fireDozerEvasiveManeuver(ally) : ally.isIronFist ? fireIronFistMainBattery(ally) : ally.isBlade ? fireBladePiercingVolley(ally) : ally.isOmega ? fireOmegaFocusStrike(ally) : ally.isDeimos ? fireDeimosShotgun(ally) : ally.isUranus ? fireUranusFocusBarrage(ally) : ally.isSpear ? fireSpearLaserVolley(ally) : ally.isVaryag ? fireVaryagSuicideDrones(ally) : ally.isGaruda ? fireGarudaGuardian(ally) : ally.isPandora ? firePandoraTorpedoes(ally) : ally.isPlanetDestroyer ? firePlanetDestroyerSupernova(ally) : ally.isPegasus ? firePegasusAnnihilation(ally) : ally.isKddx ? fireKddxChainLightning(ally) : ally.isSuPanokseon ? fireSuPanokseonMainBattery(ally) : ally.isAtlas ? fireAtlasMainBattery(ally) : ally.isNemesis ? fireNemesisElectricNet(ally) : ally.isAegis ? fireAegisRepair(ally) : ally.isColossus ? fireColossusMainShield(ally) : ally.isBastion ? fireBastionMainBattery(ally) : ally.isHammer ? fireHammerDrones(ally) : ally.isNimitz ? fireNimitzTotalOffensive(ally) : ally.isDreadTurtle ? fireDreadTurtleGwimyeonShield(ally) : ally.isAssaultTurtle ? fireAssaultTurtleCharge(ally) : ally.isTurtleShip ? fireTurtleShipBombardment(ally) : ally.isIowa ? fireIowaTomahawk(ally) : ally.isHelios ? fireHeliosMainBattery(ally) : ally.isHyperion ? fireHyperionJump(ally) : ally.isApocalypse ? fireApocalypseMainBattery(ally) : ally.isMagellan ? fireMagellanMainBattery(ally) : ally.isYamato ? fireYamatoFullBarrage(ally) : ally.isBrownBess ? fireBrownBessSniper(ally) : ally.isFury ? fireFuryBarrage(ally) : fireBattlecruiserMainBattery(ally);
            if (triggerMainBattery) {
              if (!ally.isBrownBess) focusBattleAudio('core');
              ally.energy = 0;
              updateBattlecruiserEnergy(ally);
            }
          }
        }
        if (ally.charging || ally.suPanokseonReturning) continue;
        ally.nextShot -= dt * tacticalWeaponBonus(ally).speed;
        if (ally.isBlade) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = BLADE_LASER.duration + BLADE_LASER.reload;
            fireBladePiercingLaser(ally);
          }
          continue;
        }
        if (ally.isIronFist) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = IRONFIST_CANNON.interval;
            fireIronFistCannon(ally);
          }
          continue;
        }
        if (ally.isSpear) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = SPEAR_LASER.interval;
            fireSpearLaser(ally);
          }
          continue;
        }
        if (ally.isUranus) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = URANUS_CANNON.interval;
            fireUranusCannon(ally);
          }
          continue;
        }
        if (ally.isDeimos) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = DEIMOS_CANNON.interval;
            fireDeimosCannon(ally);
          }
          continue;
        }
        if (ally.isOmega) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            const reload = ally.omegaStars >= 3 ? OMEGA_LASER.cooldown * .5 : OMEGA_LASER.cooldown;
            ally.nextShot = OMEGA_LASER.duration + reload;
            fireOmegaPiercingLasers(ally);
          }
          continue;
        }
        if (ally.isPandora) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = PANDORA_ATTACK.interval;
            firePandoraNormalAttack(ally);
          }
          continue;
        }
        if (ally.isGaruda) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = GARUDA_MISSILE.interval;
            fireGarudaMissilePair(ally);
          }
          continue;
        }
        if (ally.isVaryag) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = VARYAG_MISSILE.interval / (ally.varyagStars >= 3 ? 1.3 : 1);
            fireVaryagMissiles(ally);
          }
          continue;
        }
        if (ally.isPlanetDestroyer) {
          ally.nextShot -= dt;
          ally.planetDestroyerNextFighters -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = (PLANET_DESTROYER_LASER.shots - 1) * PLANET_DESTROYER_LASER.shotInterval + PLANET_DESTROYER_LASER.reload;
            firePlanetDestroyerLaserVolley(ally);
          }
          if (ally.planetDestroyerNextFighters <= 0) {
            ally.planetDestroyerNextFighters = PLANET_DESTROYER_FIGHTER.travel + PLANET_DESTROYER_FIGHTER.attackDuration + PLANET_DESTROYER_FIGHTER.returnTravel + PLANET_DESTROYER_FIGHTER.recovery;
            fireBastionFighterWing(ally, PLANET_DESTROYER_FIGHTER);
          }
          continue;
        }
        if (ally.isKddx) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = KDDX_LASER.interval * (ally.kddxStars >= 3 ? .5 : 1);
            fireKddxLaser(ally);
          }
          continue;
        }
        if (ally.isPegasus) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = PEGASUS_LASER.duration + PEGASUS_LASER.reload;
            firePegasusPiercingLasers(ally);
          }
          continue;
        }
        if (ally.isSuPanokseon) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = SUPANOKSEON_CANNON.interval;
            fireSuPanokseonCannon(ally);
          }
          continue;
        }
        if (ally.isAtlas) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = ATLAS_ELECTRIC.interval;
            fireAtlasElectric(ally);
          }
          continue;
        }
        if (ally.isNemesis) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = NEMESIS_LASER.duration + NEMESIS_LASER.reload;
            fireNemesisPiercingLaser(ally);
          }
          continue;
        }
        if (ally.isAegis) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = AEGIS_CANNON.interval;
            fireAegisCannon(ally);
          }
          continue;
        }
        if (ally.isColossus) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = COLOSSUS_FIGHTER.count * COLOSSUS_FIGHTER.interval + 160;
            fireColossusFighterWing(ally);
          }
          continue;
        }
        if (ally.isBastion) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = BASTION_FIGHTER.travel + BASTION_FIGHTER.attackDuration + BASTION_FIGHTER.returnTravel + BASTION_FIGHTER.recovery + (ally.bastionStars >= 5 ? BASTION_FIGHTER.secondSquadDelay : 0);
            fireBastionFighterWing(ally);
          }
          continue;
        }
        if (ally.isHammer) {
          ally.nextShot -= dt;
          ally.hammerNextCannon -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = BASTION_FIGHTER.travel + BASTION_FIGHTER.attackDuration + BASTION_FIGHTER.returnTravel + BASTION_FIGHTER.recovery;
            fireHammerFighterWing(ally);
          }
          if (ally.hammerNextCannon <= 0) {
            ally.hammerNextCannon = HAMMER_FIGHTER.interval;
            fireHammerCannon(ally);
          }
          continue;
        }
        if (ally.isNimitz) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = NIMITZ_FIGHTER.launchInterval;
            fireNimitzFighterWing(ally);
          }
          continue;
        }
        if (ally.isAngela) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = (ANGELA_CANNON.shots - 1) * ANGELA_CANNON.shotInterval + ANGELA_CANNON.reload;
            fireAngelaCannonBurst(ally);
          }
          continue;
        }
        if (ally.isTank) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = TANK_ELECTRIC.interval;
            fireTankElectric(ally);
          }
          continue;
        }
        if (ally.isDozer) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = (DOZER_CANNON.ports - 1) * DOZER_CANNON.interval + DOZER_CANNON.reload;
            fireDozerCannonCycle(ally);
          }
          continue;
        }
        if (ally.isDreadTurtle) {
          ally.nextShot -= dt;
          if (ally.nextShot <= 0) {
            ally.nextShot = DREAD_TURTLE_CANNON.interval;
            fireDreadTurtleCannonBarrage(ally);
          }
          continue;
        }
        ally.nextShot -= dt;
        if (ally.nextShot <= 0) {
          ally.nextShot = ally.isIowa
            ? IOWA_CANNON.interval
            : ally.isHelios
            ? HELIOS_REFRACTION.interval
            : ally.isHyperion
            ? HYPERION_LASER.interval
            : ally.isApocalypse
            ? APOCALYPSE_LASER.interval
            : ally.isMagellan
            ? MAGELLAN_CANNON.interval
            : ally.isAssaultTurtle
            ? ASSAULT_TURTLE_MISSILE.interval
            : ally.isTurtleShip
              ? TURTLE_SHIP_MISSILE.interval / (ally.turtleShipStars >= 5 ? 1.1 : 1)
            : ally.isFury
            ? FURY_MISSILE.interval
            : ally.isYamato
            ? (YAMATO_CANNON.shots - 1) * YAMATO_CANNON.shotInterval + YAMATO_CANNON.reload
            : ally.isBrownBess
            ? BROWN_BESS_LASER.sideInterval
            : BATTLECRUISER_LASER.interval * (.9 + Math.random() * .2);
          if (ally.isIowa) fireIowaCannon(ally);
          else if (ally.isHelios) fireHeliosRefraction(ally);
          else if (ally.isHyperion) fireHyperionLaser(ally);
          else if (ally.isApocalypse) fireApocalypseLaser(ally);
          else if (ally.isMagellan) fireMagellanCannon(ally);
          else if (ally.isAssaultTurtle) fireAssaultTurtleMissile(ally);
          else if (ally.isTurtleShip) fireTurtleShipMissile(ally);
          else if (ally.isFury) fireFuryMissiles(ally);
          else if (ally.isYamato) fireYamatoCannonCycle(ally);
          else if (ally.isBrownBess) fireBrownBessLaserBurst(ally);
          else fireBattlecruiserLaser(ally);
        }
        continue;
      }
      ally.nextShot -= dt * tacticalWeaponBonus(ally).speed;
      ally.nextShot -= dt;
      if (ally.nextShot <= 0) {
        ally.nextShot = profile.interval * (.88 + Math.random() * .24);
        fireAlliedWeapon(ally, profile);
      }
      } finally { activeDamageSource = previousDamageSource; }
    }
    updateGarudaWingmen(dt);
  }

  function updateKeplerAlienAttack(ship, dt) {
    if (!ship || ship.dead || ship.entryTime > 0) return;
    // 기절은 시간이 지나야 풀린다(이전에는 카운트가 줄지 않아 한 번 걸리면 영영 멈췄다).
    if (ship.stun > 0) {
      ship.stun = Math.max(0, ship.stun - dt);
      if (ship.stun <= 0) ship.el?.classList.remove('stunned');
      return;
    }
    // 외계 스타크루저는 공포에 걸리면 공격과 이동을 하지 못한다.
    if (ship.variant === 'kepler-alien-starcruiser' && Number(ship.dreadTurtleFearUntil || 0) > performance.now()) return;
    if (ship.variant === 'kepler-alien-carrier') {
      // 내구도 70%, 40%가 되면 호위함을 한 척씩 호출한다.
      const hpRatio = ship.hp / Math.max(1, ship.maxHp);
      [.7, .4].forEach((threshold, index) => {
        if (hpRatio <= threshold && !ship.escortCalled?.[index]) {
          (ship.escortCalled ||= [])[index] = true;
          spawnKeplerCarrierEscort(index);
        }
      });
      ship.nextShieldbreaker -= dt;
      if (ship.nextShieldbreaker <= 0) {
        ship.nextShieldbreaker += 5000;
        fireKeplerCarrierShieldbreaker(ship);
      }
      ship.nextFighterLaunch -= dt;
      if (ship.nextFighterLaunch <= 0) {
        ship.nextFighterLaunch += 9000;
        launchKeplerCarrierFighterWave(ship);
      }
      return;
    }
    if (ship.variant === 'kepler-alien-fighter') {
      ship.nextAttack -= dt;
      if (ship.nextAttack <= 0) {
        ship.nextAttack += 2000;
        fireKeplerCarrierFighterShot(ship);
      }
      return;
    }
    if (ship.variant === 'kepler-alien-angela') {
      checkKeplerAngelaShieldThresholds(ship);
    } else if (ship.variant === 'kepler-alien-escort') {
      ship.nextBladeLaser -= dt;
      if (ship.nextBladeLaser <= 0 && fireKeplerBladeLaser(ship)) ship.nextBladeLaser = BLADE_LASER.duration + BLADE_LASER.reload;
      ship.nextBladeVolley -= dt;
      if (ship.nextBladeVolley <= 0 && fireKeplerBladeVolley(ship)) ship.nextBladeVolley = 10000;
    } else if (ship.variant === 'kepler-alien-starcruiser') {
      ship.nextPhotonBattery -= dt;
      if (ship.nextPhotonBattery <= 0 && fireKeplerStarCruiserBattery(ship)) ship.nextPhotonBattery = 100000;
    } else {
      return;
    }
    if (ship.variant === 'kepler-alien-escort') return;
    ship.nextAttack -= dt;
    if (ship.nextAttack > 0) return;
    ship.nextAttack += ship.variant === 'kepler-alien-angela' ? 1900 : ship.variant === 'kepler-alien-starcruiser' ? BATTLECRUISER_LASER.interval : 2900;
    const targets = hostileAllyTargets();
    const target = ship.variant === 'kepler-alien-starcruiser'
      ? targets.sort((a, b) => Math.hypot(a.x - ship.x, a.y - ship.y) - Math.hypot(b.x - ship.x, b.y - ship.y))[0]
      : targets[Math.floor(Math.random() * targets.length)];
    if (!target) return;
    const damage = ship.variant === 'kepler-alien-angela' ? 350 : ship.variant === 'kepler-alien-starcruiser'
      ? BATTLECRUISER_LASER.starCruiserHits * combatStatFactor(ship.damageSource)
      : BLADE_LASER.hits * combatStatFactor(ship.damageSource);
    const shots = ship.variant === 'kepler-alien-angela' ? 2 : 1;
    for (let shot = 0; shot < shots; shot += 1) {
      schedule(() => {
        if (!state || state.status !== 'combat' || ship.dead || target.dead) return;
        const from = { x: ship.x + (shot % 2 ? .035 : -.035), y: ship.y + .13 };
        const to = pointOf(target);
        const beam = document.createElement('i');
        beam.className = `fx-line ${ship.variant === 'kepler-alien-starcruiser' ? 'battlecruiser-laser' : 'kepler-alien-laser'}`;
        positionLine(beam, from, to);
        refs.effects.append(beam);
        schedule(() => beam.remove(), 300);
        schedule(() => {
          if (state?.status !== 'combat' || ship.dead || target.dead) return;
          dealAllyDamage(target, damage, ship);
          createExplosion(to, 'enemy');
        }, 220);
      }, shot * 240);
    }
  }

  // 우주항모는 전투가 시작되면 함재기 10기를 내보내고, 이후 9초마다 모자란 만큼 보충해 10기를 채운다.
  // 함재기는 빠르게 가로 한 줄 대형(자리 0~9)을 갖추고 바로 공격을 시작한다.
  function launchKeplerCarrierFighterWave(carrier) {
    if (!state || carrier?.dead || state.status !== 'combat') return;
    const taken = new Set((state.midBosses || []).filter(ship => ship.variant === 'kepler-alien-fighter' && !ship.dead).map(ship => ship.slot));
    const free = Array.from({ length: 10 }, (_, slot) => slot).filter(slot => !taken.has(slot));
    if (!free.length) return;
    carrier.fighterWaves = (carrier.fighterWaves || 0) + 1;
    announce(carrier.fighterWaves === 1 ? '외계 우주항모 · 함재기 편대 출격' : `외계 우주항모 · 함재기 ${free.length}기 보충`, 'boss');
    playFighterLaunchSound();
    free.forEach((slot, order) => schedule(() => launchKeplerCarrierFighter(carrier, slot), order * 45));
  }

  function launchKeplerCarrierFighter(carrier, slot) {
    if (!state || carrier?.dead || state.status !== 'combat') return;
    const index = carrier.fightersLaunched++;
    state.keplerCarrierFightersLaunched = carrier.fightersLaunched;
    const targetX = .1 + slot * (.8 / 9);
    // 함재기는 우주항모의 뱃머리 쪽 우현(화면 왼쪽 면)에서 출격한다.
    const launchX = Math.max(.12, carrier.x - .16);
    const launchY = carrier.y + .02;
    const fighter = {
      id: `kepler-alien-fighter-${index + 1}`,
      kind: 'boss',
      variant: 'kepler-alien-fighter',
      name: `외계 함재기 ${index + 1}`,
      hp: 2000,
      maxHp: 2000,
      attackPower: 100,
      slot,
      x: launchX,
      y: launchY,
      entryStartX: launchX,
      entryTargetX: targetX,
      entryStartY: launchY,
      entryTargetY: .36,
      entryDuration: 650,
      entryTime: 650,
      nextAttack: 300,
      enemyShield: 0,
      enemyImmuneUntil: 0,
      dead: false,
      stun: 0,
      requiredForGate: true
    };
    const element = document.createElement('div');
    element.className = 'boss-unit kepler-alien-vessel kepler-alien-fighter';
    element.style.left = percent(launchX);
    element.style.top = percent(launchY);
    element.innerHTML = '<img class="boss-sprite" src="kepler-alien-fighter.png" alt="외계 함재기" />';
    fighter.el = element;
    state.midBosses.push(fighter);
    refs.enemyLayer.append(element);
    requestAnimationFrame(() => element.classList.add('entered'));
    updateBossHud();
  }

  // 우주항모가 호출하는 호위함(블레이드 편성). 처음 한 척은 왼쪽, 두 번째는 오른쪽에서 합류한다.
  function spawnKeplerCarrierEscort(callIndex) {
    if (!state || state.status !== 'combat') return;
    const sourceShip = { name: '블레이드', type: 'destroyer', rarity: 'SR', enhancementStars: 0 };
    const x = callIndex % 2 ? .76 : .24;
    const escort = {
      id: `kepler-alien-escort-call-${callIndex}`,
      kind: 'boss',
      variant: 'kepler-alien-escort',
      name: '외계 호위함',
      ship: sourceShip,
      damageSource: sourceShip,
      hp: 25000,
      maxHp: 25000,
      attackPower: Math.round(BLADE_LASER.hits * combatStatFactor(sourceShip)),
      x,
      y: -.26,
      entryStartY: -.26,
      entryTargetY: .195,
      entryDuration: 1500,
      entryTime: 1500,
      nextAttack: Infinity,
      nextBladeLaser: 3000,
      nextBladeVolley: 6000,
      enemyShield: 0,
      enemyImmuneUntil: 0,
      dead: false,
      stun: 0,
      requiredForGate: true
    };
    const element = document.createElement('div');
    element.className = 'boss-unit kepler-alien-vessel kepler-alien-escort';
    element.style.left = percent(x);
    element.style.top = percent(escort.y);
    element.innerHTML = '<img class="boss-sprite" src="kepler-alien-escort.png" alt="외계 호위함" /><span>ALIEN ESCORT</span>';
    escort.el = element;
    state.midBosses.push(escort);
    refs.enemyLayer.append(element);
    requestAnimationFrame(() => element.classList.add('entered'));
    announce('외계 우주항모 · 호위함 호출', 'boss');
    updateBossHud();
  }

  function fireKeplerCarrierFighterShot(fighter) {
    const targets = [...(state?.allies || []), ...(state?.garudaWingmen || [])].filter(ally => !ally.dead);
    const target = targets[Math.floor(Math.random() * targets.length)];
    if (!target) return false;
    const from = pointOf(fighter);
    const to = pointOf(target);
    const beam = document.createElement('i');
    beam.className = 'fx-line kepler-carrier-fighter-shot';
    positionLine(beam, from, to);
    refs.effects.append(beam);
    schedule(() => beam.remove(), 280);
    schedule(() => {
      if (state?.status !== 'combat' || fighter.dead || target.dead) return;
      dealAllyDamage(target, 100, fighter);
      createExplosion(pointOf(target), 'enemy');
    }, 220);
    return true;
  }

  function fireKeplerCarrierShieldbreaker(carrier) {
    const targets = [...(state?.allies || []), ...(state?.garudaWingmen || [])].filter(ally => !ally.dead);
    const target = targets[Math.floor(Math.random() * targets.length)];
    if (!target) return false;
    const from = { x: Math.min(.96, carrier.x + .09), y: carrier.y + .12 };
    const to = pointOf(target);
    const beam = document.createElement('i');
    beam.className = 'fx-line kepler-carrier-shieldbreaker';
    positionLine(beam, from, to);
    refs.effects.append(beam);
    schedule(() => beam.remove(), 520);
    announce('외계 우주항모 · 실드 제거 광선', 'boss');
    schedule(() => {
      if (state?.status !== 'combat' || carrier.dead || target.dead) return;
      if (Number(target.shield) > 0) {
        target.shield = 0;
        target.shieldEl?.remove();
        target.shieldEl = null;
        clearCarrierShieldGauge(target);
        showUnitDamage(target, '실드 제거');
        createCarrierShieldImpact(pointOf(target));
        return;
      }
      dealAllyDamage(target, 500, carrier);
      if (!target.dead && !isAllyStatusImmune(target)) {
        target.stun = Math.max(Number(target.stun) || 0, 2000);
        target.el?.classList.add('kepler-carrier-stunned');
        schedule(() => target.el?.classList.remove('kepler-carrier-stunned'), 2000);
      }
      createExplosion(pointOf(target), 'photon');
    }, 300);
    return true;
  }

  function keplerAlienFleet() {
    return [state?.boss, ...(state?.midBosses || [])]
      .filter(ship => ship?.variant?.startsWith('kepler-alien-') && !ship.dead);
  }

  // 외계 앙헬라 보호막 발동 기준: 출전 함선(앙헬라 포함) 중 누구든 최초 내구의 50%·30%가 되면 각각 한 번씩 발동.
  // 앙헬라만 남으면 10%에서도 한 번 발동한다. 발동은 함대 전체에 적용한다.
  const KEPLER_ANGELA_SHIELD_THRESHOLDS = [.5, .3];
  const KEPLER_ANGELA_ALONE_THRESHOLD = .1;
  const KEPLER_ANGELA_WING_SHIELD = 1000; // 외계 앙헬라 천사의 날개 보호막(함대 전체)
  function checkKeplerAngelaShieldThresholds(angela) {
    const fleet = keplerAlienFleet();
    if (!fleet.length) return;
    const fired = angela.keplerShieldFired ||= {};
    const ratioOf = ship => Math.max(0, Number(ship.hp) || 0) / Math.max(1, Number(ship.maxHp) || 1);
    const lowest = Math.min(...fleet.map(ratioOf));
    // 비밀기지 관문 5: 날개는 50% 지점에서 한 번만 발동한다(20% 단독 발동과 30%·10%는 없다).
    const secretGate5 = isKeplerSecretBaseOperation() && Number(state.operation?.gate) === 5;
    const crossed = (secretGate5 ? [.5] : KEPLER_ANGELA_SHIELD_THRESHOLDS).filter(t => lowest <= t && !fired[t]);
    if (!secretGate5 && fleet.length === 1 && fleet[0] === angela && ratioOf(angela) <= KEPLER_ANGELA_ALONE_THRESHOLD && !fired.alone) {
      fired.alone = true;
      crossed.push('alone');
    }
    if (!crossed.length) return;
    crossed.forEach(key => { fired[key] = true; });
    castKeplerAngelaShield(angela);
  }

  function castKeplerAngelaShield(angela) {
    const fleet = keplerAlienFleet();
    if (!fleet.length) return false;
    const now = performance.now();
    fleet.forEach(ship => {
      setArenaEnemyShield(ship, Math.max(Number(ship.enemyShield) || 0, KEPLER_ANGELA_WING_SHIELD));
      ship.enemyImmuneUntil = now + ANGELA_WINGS.immunity;
      ship.el?.classList.add('kepler-alien-shielded');
      if (ship.el && !ship.el.querySelector('.kepler-alien-shield')) {
        const shield = document.createElement('i');
        shield.className = 'kepler-alien-shield';
        shield.setAttribute('aria-hidden', 'true');
        ship.el.append(shield);
      }
      schedule(() => {
        if (performance.now() >= ship.enemyImmuneUntil && ship.enemyShield <= 0) {
          ship.el?.classList.remove('kepler-alien-shielded');
          ship.el?.querySelector('.kepler-alien-shield')?.remove();
        }
      }, ANGELA_WINGS.immunity + 40);
    });
    angela.el?.classList.add('angel-wing-blessing');
    announce('외계 앙헬라 · 천사의 보호막', 'boss');
    return true;
  }

  function fireKeplerBladeVolley(ship) {
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    const targets = [...(state?.allies || []), ...(state?.garudaWingmen || [])]
      .filter(target => !target.dead)
      .sort((a, b) => Math.hypot((a.x - ship.x) * width, (a.y - ship.y) * height) - Math.hypot((b.x - ship.x) * width, (b.y - ship.y) * height))
      .slice(0, BLADE_MAIN.beams);
    if (!targets.length) return false;
    targets.forEach((target, index) => {
      const lane = index - (targets.length - 1) / 2;
      const from = { x: ship.x + lane * .023, y: ship.y + .13 };
      const to = bladeBeamEnd(from, target);
      const beam = document.createElement('i');
      beam.className = 'fx-line kepler-blade-piercing-laser';
      positionLine(beam, from, to);
      refs.effects.append(beam);
      for (let elapsed = 0; elapsed < BLADE_MAIN.duration; elapsed += BLADE_MAIN.tick) {
        schedule(() => {
          if (state?.status !== 'combat' || ship.dead) return;
          [...(state.allies || []), ...(state.garudaWingmen || [])].forEach(ally => {
            if (!ally.dead && distanceToBeam(pointOf(ally), from, to) <= BLADE_MAIN.width) {
              dealAllyDamage(ally, BLADE_MAIN.hits * combatStatFactor(ship.damageSource), ship);
            }
          });
        }, elapsed);
      }
      schedule(() => beam.remove(), BLADE_MAIN.duration + 40);
    });
    announce('외계 호위함 · 삼중 관통 레이저', 'boss');
    return true;
  }

  function fireKeplerBladeLaser(ship) {
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    const target = [...(state?.allies || []), ...(state?.garudaWingmen || [])]
      .filter(ally => !ally.dead)
      .sort((a, b) => Math.hypot((a.x - ship.x) * width, (a.y - ship.y) * height) - Math.hypot((b.x - ship.x) * width, (b.y - ship.y) * height))[0];
    if (!target) return false;
    const from = { x: ship.x, y: ship.y + .13 };
    const to = bladeBeamEnd(from, target);
    const beam = document.createElement('i');
    beam.className = 'fx-line kepler-blade-piercing-laser';
    positionLine(beam, from, to);
    refs.effects.append(beam);
    for (let elapsed = 0; elapsed < BLADE_LASER.duration; elapsed += BLADE_LASER.tick) {
      schedule(() => {
        if (state?.status !== 'combat' || ship.dead) return;
        [...(state.allies || []), ...(state.garudaWingmen || [])].forEach(ally => {
          if (!ally.dead && distanceToBeam(pointOf(ally), from, to) <= BLADE_LASER.width) {
            dealAllyDamage(ally, BLADE_LASER.hits * combatStatFactor(ship.damageSource), ship);
          }
        });
      }, elapsed);
    }
    schedule(() => beam.remove(), BLADE_LASER.duration + 40);
    return true;
  }

  function fireKeplerStarCruiserBattery(ship) {
    const targets = hostileAllyTargets();
    const target = targets.sort((a, b) => Math.hypot(a.x - ship.x, a.y - ship.y) - Math.hypot(b.x - ship.x, b.y - ship.y))[0];
    if (!target) return false;
    const factor = combatStatFactor(ship.damageSource);
    const from = { x: ship.x, y: ship.y + .13 };
    const targetPoint = pointOf(target);
    const charge = document.createElement('i');
    charge.className = 'fx-photon-charge';
    charge.style.left = percent(from.x);
    charge.style.top = percent(from.y);
    refs.effects.append(charge);
    schedule(() => charge.remove(), BATTLECRUISER_MAIN_BATTERY.charge + 40);
    schedule(() => {
      if (state?.status !== 'combat' || ship.dead) return;
      launchPhotonShell(from, targetPoint);
      schedule(() => {
        if (state?.status !== 'combat' || ship.dead) return;
        const impactPoint = pointOf(target);
        const field = refs.field?.getBoundingClientRect();
        if (!target.dead) dealAllyDamage(target, BATTLECRUISER_MAIN_BATTERY.hits * factor, ship);
        if (field) [...(state.allies || []), ...(state.garudaWingmen || [])]
          .filter(ally => ally !== target && !ally.dead && Math.hypot((ally.x - impactPoint.x) * field.width, (ally.y - impactPoint.y) * field.height) <= BATTLECRUISER_MAIN_BATTERY.photonSplashRadius)
          .forEach(ally => dealAllyDamage(ally, BATTLECRUISER_MAIN_BATTERY.hits * factor, ship));
        createPlasmaCannonImpact(impactPoint, false);
        createExplosion(impactPoint, 'photon');
      }, BATTLECRUISER_MAIN_BATTERY.travel);
    }, BATTLECRUISER_MAIN_BATTERY.charge);
    announce('외계 스타크루저 · 중광자포', 'boss');
    return true;
  }

  function updateBoss(dt) {
    const boss = state.boss;
    state.midBosses?.forEach(monster => {
      if (monster.dead) return;
      if (monster.entryTime > 0) {
        monster.entryTime = Math.max(0, monster.entryTime - dt);
        const progress = 1 - monster.entryTime / monster.entryDuration;
        const eased = 1 - Math.pow(1 - progress, 3);
        if (Number.isFinite(monster.entryStartX) && Number.isFinite(monster.entryTargetX)) {
          monster.x = monster.entryStartX + (monster.entryTargetX - monster.entryStartX) * eased;
        }
        monster.y = monster.entryStartY + (monster.entryTargetY - monster.entryStartY) * eased;
        monster.el.style.left = percent(monster.x);
        monster.el.style.top = percent(monster.y);
        return;
      }
      if (monster.variant?.startsWith('kepler-alien-')) updateKeplerAlienAttack(monster, dt);
      else if (monster.variant === 'toxic-beast') updateToxicBeastAttack(monster, dt);
      else if (monster.variant === 'flame-beast') updateFlameBeastAttack(monster, dt);
      else updateRaptorUnit(monster, dt);
    });
    if (boss?.entryTime > 0) {
      boss.entryTime = Math.max(0, boss.entryTime - dt);
      const progress = 1 - boss.entryTime / boss.entryDuration;
      const eased = 1 - Math.pow(1 - progress, 3);
      boss.y = boss.entryStartY + (boss.entryTargetY - boss.entryStartY) * eased;
      if (boss.variant?.startsWith('kepler-alien-')) {
        boss.el.style.left = percent(boss.x);
        boss.el.style.top = percent(boss.y);
      }
    }
    if (!boss || boss.dead) {
      return;
    }
    if (boss.variant?.startsWith('kepler-alien-')) {
      updateKeplerAlienAttack(boss, dt);
      return;
    }
    if (boss.variant === 'toxic-beast') {
      updateToxicBeastAttack(boss, dt);
      return;
    }
    if (boss.variant === 'machine-beast') {
      if (!boss.machineAirborne && updateDreadTurtleFearMovement(boss, dt)) return;
      if (boss.stun > 0 && !boss.machineAirborne) {
        boss.stun = Math.max(0, boss.stun - dt);
        return;
      }
      updateMachineBeastAttack(boss, dt);
      return;
    }
    if (updateDreadTurtleFearMovement(boss, dt)) return;
    if (boss.stun > 0) {
      if (boss) boss.stun = Math.max(0, boss.stun - dt);
      return;
    }
    if (boss.variant === 'tas-right-arm' || boss.variant === 'tas-long-arm') {
      updateTasArmBoss(boss, dt);
      return;
    }
    if (boss.variant === 'blackbeard') {
      updateBlackbeardAttack(boss, dt);
      return;
    }
    if (boss.variant === 'four-wing-beast') {
      updateFourWingBeastAttack(boss, dt);
      return;
    }
    if (boss.variant === 'giant-gasimon') {
      boss.nextAttack -= dt;
      if (boss.nextAttack <= 0) {
        boss.nextAttack = boss.attackInterval;
        const targets = hostileAllyTargets();
        for (let shot = 0; shot < boss.shotCount; shot += 1) {
          const target = targets[Math.floor(Math.random() * targets.length)];
          if (target) enemyProjectile(boss, target, 'monster-spike', boss.attackPower, null, giantGasimonMuzzlePoint(boss, shot % 2));
        }
      }
      return;
    }
    if (boss.variant === 'giant-dokchimmon') {
      boss.nextAttack -= dt;
      boss.nextBurst -= dt;
      if (boss.nextAttack <= 0) {
        boss.nextAttack = 3000;
        const target = giantDokchimmonTarget();
        if (target) enemyProjectile(boss, target, 'monster-acid', boss.attackPower, () => applyMonsterCorrosion(target, boss.attackPower), giantDokchimmonMuzzlePoint(boss));
      }
      if (boss.nextBurst <= 0) {
        boss.nextBurst = 5000;
        castGiantDokchimmonPoison(boss);
      }
      return;
    }
    if (boss.variant === 'oort-final-boss') {
      boss.lifetime += dt;
      if (!boss.berserk && boss.lifetime >= 120000) {
        boss.berserk = true;
        boss.el?.classList.add('oort-final-berserk');
        announce('오르트 최종 보스 · 광폭화', 'boss');
      }
      const damageScale = boss.berserk ? 2 : 1;
      boss.nextAttack -= dt;
      boss.nextWingAttack -= dt;
      boss.nextTailAttack -= dt;
      boss.nextPlasmaBug -= dt;
      if (boss.nextPlasmaBug <= 0) {
        boss.nextPlasmaBug = 3000;
        spawnAncientPlasmaBugs(boss, 1);
      }
      if (boss.nextAttack <= 0) {
        boss.nextAttack = 1000;
        const targets = hostileAllyTargets();
        const target = targets[Math.floor(Math.random() * targets.length)];
        if (target) enemyProjectile(boss, target, 'ancient-bone-spike', 200 * damageScale, null, oortFinalMuzzlePoint(boss));
      }
      if (boss.nextWingAttack <= 0) {
        boss.nextWingAttack = 8000;
        playBossBladeVolleySound();
        const targets = hostileAllyTargets();
        for (let shot = 0; shot < 8; shot += 1) {
          const target = targets[Math.floor(Math.random() * targets.length)];
          if (target) enemyProjectile(boss, target, 'monster-spike', 100 * damageScale, null, oortFinalWingPoint(boss, shot), 'oort-final-wing-spike');
        }
        boss.el?.classList.add('oort-final-wing-firing');
        schedule(() => boss.el?.classList.remove('oort-final-wing-firing'), 520);
      }
      if (boss.nextTailAttack <= 0) {
        boss.nextTailAttack = 12000;
        const targets = hostileAllyTargets();
        const target = targets[Math.floor(Math.random() * targets.length)];
        createOortSlimeLaunchEffect(boss);
        if (target) enemyProjectile(boss, target, 'oort-slime', 300 * damageScale, () => { applyOortFinalSlime(target, boss); createOortSlimeImpact(pointOf(target)); }, oortFinalTailPoint(boss));
        boss.el?.classList.add('oort-final-tail-firing');
        schedule(() => boss.el?.classList.remove('oort-final-tail-firing'), 720);
      }
      return;
    }
    if (boss.variant === 'ancient-beast') {
      boss.lifetime += dt;
      if (!boss.berserk && boss.lifetime >= 90000) {
        boss.berserk = true;
        boss.el?.classList.add('ancient-beast-berserk');
        announce('고대 괴수 · 광폭화', 'boss');
      }
      boss.nextAttack -= dt;
      boss.nextEscort -= dt;
      if (boss.nextAttack <= 0) {
        boss.nextAttack = boss.berserk ? 1500 : 3000;
        const slots = hostileAllyTargets();
        slots.forEach((ally, index) => enemyProjectile(boss, ally, 'ancient-bone-spike', boss.berserk ? 200 : 100, null, ancientBeastMuzzlePoint(boss, index)));
      }
      if (boss.nextEscort <= 0) {
        boss.nextEscort = isMagentaTasOperation() && Number(state.operation?.gate) === 5 ? 7500 : 15000;
        spawnAncientBeastRaptors(boss, 5);
      }
      return;
    }
    if (boss.variant === 'raptor' || boss.variant === 'primitive-raptor') {
      updateRaptorUnit(boss, dt);
      return;
    }
    if (boss.variant === 'red-overlord') {
      boss.lifetime += dt;
      if (!boss.berserk && boss.lifetime >= 60000) {
        boss.berserk = true;
        boss.el?.classList.add('berserk');
        announce('붉은 대군주 · 폭주', 'boss');
      }
      boss.nextSummon -= dt;
      if (boss.nextSummon <= 0) {
        boss.nextSummon = 10000;
        spawnRedOverlordMinions(boss, boss.berserk ? 40 : 20);
      }
      return;
    }
    if (boss.variant === 'green-overlord') {
      boss.nextSummon -= dt;
      if (boss.nextSummon <= 0) {
        boss.nextSummon = 10000;
        spawnGreenOverlordMinions(boss);
      }
      return;
    }
    if (boss.variant === 'flame-beast') {
      updateFlameBeastAttack(boss, dt);
      return;
    }
    boss.nextAttack -= dt;
    boss.nextBurst -= dt;
    if (boss.nextAttack <= 0) {
      boss.nextAttack = 780 + Math.random() * 720;
      const target = hostileTargetFor(boss);
      if (target) enemyProjectile(boss, target, Math.random() < .45 ? 'corrosion' : 'spike');
    }
    if (boss.nextBurst <= 0) {
      boss.nextBurst = 5200 + Math.random() * 1800;
      hostileAllyTargets().forEach((ally, index) => {
        schedule(() => enemyProjectile(boss, ally, index % 2 ? 'corrosion' : 'spike'), index * 90);
      });
    }
  }

  function tasArmVisualPoint(boss, xRatio, yRatio) {
    const field = refs.field?.getBoundingClientRect();
    const rect = boss?.el?.getBoundingClientRect();
    if (!field?.width || !field?.height || !rect?.width || !rect?.height) return pointOf(boss);
    return {
      x: (rect.left + rect.width * xRatio - field.left) / field.width,
      y: (rect.top + rect.height * yRatio - field.top) / field.height
    };
  }

  function fireTasRightArmClaws(boss) {
    const targets = hostileAllyTargets();
    const target = targets[Math.floor(Math.random() * targets.length)];
    if (!target) return;
    const from = tasArmVisualPoint(boss, .66, .9);
    const to = pointOf(target);
    const field = refs.field?.getBoundingClientRect();
    const dx = (to.x - from.x) * (field?.width || 480);
    const dy = (to.y - from.y) * (field?.height || 720);
    const baseAngle = Math.atan2(dy, dx);
    const generation = state?.generation;
    for (let index = 0; index < 5; index += 1) {
      const claw = document.createElement('i');
      const fan = (index - 2) * .075;
      claw.className = 'fx-tas-arm-claw';
      claw.style.left = percent(from.x);
      claw.style.top = percent(from.y);
      claw.style.setProperty('--dx', `${dx}px`);
      claw.style.setProperty('--dy', `${dy}px`);
      claw.style.setProperty('--angle', `${baseAngle + fan}rad`);
      claw.style.animationDelay = `${index * 65}ms`;
      refs.effects.append(claw);
      schedule(() => claw.remove(), 900 + index * 65);
      schedule(() => {
        if (state?.generation === generation && state.status === 'combat' && !target.dead) dealAllyDamage(target, 100, boss);
      }, 520 + index * 65);
    }
  }

  function updateTasArmBoss(boss, dt) {
    boss.armTimer = Math.max(0, Number(boss.armTimer) - dt);
    if (boss.variant === 'tas-right-arm') {
      if (boss.armPhase === 'right-wait' && boss.armTimer <= 0) {
        startTasRightArmAttack(boss);
      } else if (boss.armPhase === 'right-cycle' && boss.armTimer <= 0) {
        boss.el?.classList.remove('tas-right-arm-swipe');
        boss.armPhase = 'right-rest';
        boss.armTimer = 2000;
      } else if (boss.armPhase === 'right-rest' && boss.armTimer <= 0) {
        startTasRightArmAttack(boss);
      }
      return;
    }

    if (boss.armPhase === 'long-wait' && boss.armTimer <= 0) {
      boss.armPhase = 'long-raising';
      boss.armTimer = 5000;
      boss.el?.classList.add('tas-long-arm-raising');
    } else if (boss.armPhase === 'long-raising' && boss.armTimer <= 0) {
      boss.armPhase = 'long-holding';
      boss.armTimer = 2000;
      boss.el?.classList.remove('tas-long-arm-raising');
      boss.el?.classList.add('tas-long-arm-holding');
    } else if (boss.armPhase === 'long-holding' && boss.armTimer <= 0) {
      boss.armPhase = 'long-swinging';
      boss.armTimer = 4000;
      boss.el?.classList.remove('tas-long-arm-holding');
      boss.el?.classList.add('tas-long-arm-swinging');
      const targets = (state?.allies || []).filter(ally => !ally.dead);
      boss.swingTarget = targets[Math.floor(Math.random() * targets.length)] || null;
      setTasSniperTarget(boss.swingTarget);
    } else if (boss.armPhase === 'long-swinging' && boss.armTimer <= 0) {
      if (boss.swingTarget && !boss.swingTarget.dead && state?.status === 'combat') dealAllyDamage(boss.swingTarget, 10000, boss);
      setTasSniperTarget(null);
      boss.swingTarget = null;
      boss.armPhase = 'long-returning';
      boss.armTimer = 4000;
      boss.el?.classList.remove('tas-long-arm-swinging');
      boss.el?.classList.add('tas-long-arm-returning');
    } else if (boss.armPhase === 'long-returning' && boss.armTimer <= 0) {
      boss.armPhase = 'long-raising';
      boss.armTimer = 5000;
      boss.el?.classList.remove('tas-long-arm-returning');
      boss.el?.classList.add('tas-long-arm-raising');
    }
  }

  function startTasRightArmAttack(boss) {
    boss.armPhase = 'right-cycle';
    boss.armTimer = 3500;
    boss.el?.classList.remove('tas-right-arm-swipe');
    void boss.el?.offsetWidth;
    boss.el?.classList.add('tas-right-arm-swipe');
    fireTasRightArmClaws(boss);
  }

  function setTasSniperTarget(target) {
    document.querySelectorAll('.ally-unit .tas-sniper-reticle').forEach(marker => marker.remove());
    if (!target?.el || target.dead) return;
    const marker = document.createElement('span');
    marker.className = 'tas-sniper-reticle';
    marker.setAttribute('aria-label', '긴팔의 저격 대상');
    marker.innerHTML = '<i></i><b>LOCK</b>';
    target.el.append(marker);
  }

  function updateToxicBeastAttack(boss, dt) {
    if (boss.toxicBreathWindup) {
      boss.toxicBreathCharge -= dt;
      chargeToxicBeastBreath(boss, dt);
      if (boss.toxicBreathCharge <= 0) finishToxicBeastBreath(boss);
    } else {
      dripToxicBeast(boss, dt);
      boss.nextToxicShot -= dt;
      boss.nextPoisonBreath -= dt;
      if (boss.nextPoisonBreath <= 0) {
        boss.toxicBreathWindup = true;
        boss.toxicBreathCharge = 2000;
        boss.el?.classList.add('toxic-charging');
        boss.el?.classList.remove('toxic-tail-firing', 'toxic-tail-aiming');
        boss.toxicMouthGlow?.remove();
        boss.toxicMouthGlow = addToxicFx('fx-toxic-mouth-glow', toxicBeastMouthPoint(boss));
      } else if (boss.nextToxicShot <= 0) {
        boss.nextToxicShot = 2000;
        fireToxicBeastVenom(boss);
      }
    }
  }

  function updateFlameBeastAttack(boss, dt) {
    boss.nextFireDust -= dt;
    if (boss.nextFireDust <= 0) {
      boss.nextFireDust = 15000;
      castFlameBeastFireDust(boss);
    }
    boss.nextAttack -= dt;
    if (boss.nextAttack <= 0 && !boss.flameWindup) {
      boss.nextAttack = 3000;
      boss.flameWindup = true;
      boss.el?.classList.add('flame-beast-firing');
      schedule(() => {
        boss.flameWindup = false;
        boss.el?.classList.remove('flame-beast-firing');
        if (!state || state.status !== 'combat' || boss.dead) return;
        const targets = hostileAllyTargets();
        for (let shot = 0; shot < 3; shot += 1) {
          const target = targets[Math.floor(Math.random() * targets.length)];
          if (target) enemyProjectile(boss, target, 'flameball', boss.attackPower, null, flameBeastMuzzlePoint(boss));
        }
      }, 1000);
    }
  }

  function updateRaptorUnit(boss, dt) {
    if (!boss || boss.dead) return;
    if (boss.entryTime > 0) {
      boss.entryTime = Math.max(0, boss.entryTime - dt);
      const progress = 1 - boss.entryTime / boss.entryDuration;
      const eased = 1 - Math.pow(1 - progress, 3);
      boss.y = boss.entryStartY + (boss.entryTargetY - boss.entryStartY) * eased;
      boss.el.style.left = percent(boss.x);
      boss.el.style.top = percent(boss.y);
      return;
    }
    if (updateDreadTurtleFearMovement(boss, dt)) return;
    if (boss.stun > 0) {
      boss.stun = Math.max(0, boss.stun - dt);
      return;
    }
    updateRaptorMovement(boss, dt);
    boss.nextAttack -= dt;
    if (boss.nextAttack <= 0) {
      boss.nextAttack = 2000;
      const targets = hostileAllyTargets().filter(ally => ally.y > boss.y + .02);
      for (let shot = 0; shot < 4; shot += 1) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        if (target) enemyProjectile(boss, target, 'monster-spike', boss.attackPower, null, raptorMuzzlePoint(boss, shot));
      }
    }
  }

  function castFourWingElectricNet(boss) {
    if (!boss || boss.dead || state?.status !== 'combat') return;
    const ships = (state.allies || []).filter(ally => !ally.dead);
    const target = ships.find(ally => ally.role === '선봉') || ships[Math.floor(Math.random() * ships.length)];
    boss.fourWingChargeTimer = 3000;
    boss.fourWingVolleyRemaining = 0;
    boss.fourWingVolleyCooldown = 0;
    boss.el?.classList.remove('four-wing-volley');
    boss.el?.classList.add('four-wing-charging');
    if (!target) return;

    const orb = document.createElement('i');
    orb.className = 'fx-nemesis-orb';
    positionProjectile(orb, { x: boss.x, y: boss.y + .04 }, pointOf(target));
    refs.effects.append(orb);
    schedule(() => orb.remove(), NEMESIS_NET.travel + 50);
    schedule(() => {
      if (target.dead || state?.status !== 'combat' || isAllyStatusImmune(target)) return;
      const point = pointOf(target);
      const netDuration = 3000;
      target.stun = Math.max(Number(target.stun) || 0, netDuration);
      target.energyRechargeDisabledUntil = Math.max(Number(target.energyRechargeDisabledUntil) || 0, performance.now() + netDuration);
      target.nemesisNetUntil = performance.now() + netDuration;
      target.el?.classList.add('four-wing-net-stunned');
      const cage = document.createElement('i');
      cage.className = 'fx-nemesis-net';
      cage.style.left = percent(point.x);
      cage.style.top = percent(point.y);
      const targetRect = target.el?.getBoundingClientRect();
      const diameter = Math.max(46, Math.max(targetRect?.width || 0, targetRect?.height || 0) * 1.38);
      cage.style.width = `${diameter}px`;
      cage.style.height = `${diameter}px`;
      cage.style.marginLeft = `${-diameter / 2}px`;
      cage.style.marginTop = `${-diameter / 2}px`;
      refs.effects.append(cage);
      schedule(() => {
        cage.remove();
        if (performance.now() >= target.nemesisNetUntil) target.el?.classList.remove('four-wing-net-stunned');
      }, netDuration);
    }, NEMESIS_NET.travel);
  }

  function fireFourWingLaser(boss, damage) {
    const ships = (state?.allies || []).filter(ally => !ally.dead);
    const target = ships[Math.floor(Math.random() * ships.length)];
    if (!target) return;
    playRLaserSound();
    const beam = document.createElement('i');
    beam.className = 'fx-line four-wing-laser';
    positionLine(beam, { x: boss.x, y: boss.y + .04 }, pointOf(target));
    refs.effects.append(beam);
    schedule(() => beam.remove(), 280);
    schedule(() => {
      if (!target.dead && state?.status === 'combat') {
        dealAllyDamage(target, damage, boss);
        createExplosion(pointOf(target), 'electric');
      }
    }, 260);
  }

  function updateFourWingBeastAttack(boss, dt) {
    boss.nextAttack -= dt;
    if (boss.nextAttack <= 0) {
      boss.nextAttack += 1000;
      fireFourWingLaser(boss, 300);
    }

    boss.fourWingNetCooldown -= dt;
    if (boss.fourWingNetCooldown <= 0) {
      boss.fourWingNetCooldown += 9000;
      castFourWingElectricNet(boss);
    }

    if (boss.fourWingChargeTimer > 0) {
      boss.fourWingChargeTimer = Math.max(0, boss.fourWingChargeTimer - dt);
      if (boss.fourWingChargeTimer === 0) {
        boss.el?.classList.remove('four-wing-charging');
        boss.el?.classList.add('four-wing-volley');
        boss.fourWingVolleyRemaining = 10;
        boss.fourWingVolleyCooldown = 0;
      }
    }
    if (boss.fourWingVolleyRemaining > 0) {
      boss.fourWingVolleyCooldown -= dt;
      if (boss.fourWingVolleyCooldown <= 0) {
        fireFourWingLaser(boss, 200);
        boss.fourWingVolleyRemaining -= 1;
        boss.fourWingVolleyCooldown = .5;
        if (boss.fourWingVolleyRemaining <= 0) boss.el?.classList.remove('four-wing-volley');
      }
    }
  }

  function applyMachineFreeze(ally) {
    if (!ally || ally.dead) return;
    ally.machineFreezeStacks = Math.min(10, (ally.machineFreezeStacks || 0) + 1);
    ally.machineFreezeUntil = performance.now() + 5000;
    ally.el?.classList.add('machine-frozen');
    let badge = ally.el?.querySelector('.machine-freeze-badge');
    if (!badge && ally.el) {
      badge = document.createElement('span');
      badge.className = 'machine-freeze-badge';
      ally.el.append(badge);
    }
    if (badge) badge.textContent = `❄ ${ally.machineFreezeStacks}`;
  }

  function fireMachineIceBeam(boss) {
    const ships = (state?.allies || []).filter(ally => !ally.dead);
    const target = ships[Math.floor(Math.random() * ships.length)];
    if (!target) return;
    const beam = document.createElement('i');
    beam.className = 'fx-line machine-icebeam';
    positionLine(beam, { x: boss.x, y: boss.y + .078 }, pointOf(target));
    refs.effects.append(beam);
    playMachineBossSound('icebeam');
    schedule(() => beam.remove(), 260);
    schedule(() => {
      if (target.dead || state?.status !== 'combat') return;
      dealAllyDamage(target, 300, boss);
      applyMachineFreeze(target);
    }, 180);
  }

  function landMachineBeast(boss) {
    if (!state || state.status !== 'combat' || boss.dead) return;
    boss.machineAirborne = false;
    boss.el?.classList.remove('machine-taking-off');
    boss.el?.classList.add('machine-reappearing');
    schedule(() => boss.el?.classList.remove('machine-reappearing'), 650);

    const wave = document.createElement('i');
    wave.className = 'machine-shockwave';
    wave.style.left = percent(boss.x);
    wave.style.top = percent(boss.y);
    refs.effects.append(wave);
    schedule(() => wave.remove(), 850);

    const afterimage = document.createElement('img');
    afterimage.className = 'machine-afterimage';
    afterimage.src = 'enemy-machine-beast.png';
    afterimage.alt = '';
    afterimage.style.left = percent(boss.x);
    afterimage.style.top = percent(boss.y);
    refs.effects.append(afterimage);
    schedule(() => afterimage.remove(), 850);

    playMachineBossSound('shock');
    (state.allies || []).filter(ally => !ally.dead).forEach(ally => {
      dealAllyDamage(ally, 1000, boss);
      createExplosion(pointOf(ally), 'electric');
    });
  }

  function updateMachineBeastAttack(boss, dt) {
    if (boss.entryTime > 0) return;
    boss.machineFlightCooldown -= dt;
    if (boss.machineAirborne) {
      boss.machineFlightTimer -= dt;
      if (boss.machineFlightTimer <= 0) landMachineBeast(boss);
      return;
    }
    if (boss.machineFlightCooldown <= 0) {
      boss.machineFlightCooldown += 10000;
      boss.machineFlightTimer = 3000;
      boss.machineAirborne = true;
      boss.el?.classList.remove('machine-reappearing');
      boss.el?.classList.add('machine-taking-off');
      playMachineBossSound('fly');
      return;
    }
    boss.nextAttack -= dt;
    if (boss.nextAttack <= 0) {
      boss.nextAttack += 1000;
      fireMachineIceBeam(boss);
    }
  }

  function giantGasimonMuzzlePoint(boss, index) {
    return { x: boss.x + (index ? .064 : -.064), y: boss.y + .052 };
  }

  function giantDokchimmonMuzzlePoint(boss) {
    return { x: boss.x, y: boss.y + .082 };
  }

  // 독성마수 그림(enemy-toxic-beast.png) 안의 위치(0~1): 꼬리 끝 빛나는 눈알, 입, 날개 끝
  const TOXIC_BEAST_SPOTS = { tail: { x: .555, y: .905 }, mouth: { x: .61, y: .42 }, wings: [{ x: .06, y: .72 }, { x: .95, y: .7 }, { x: .22, y: .5 }, { x: .83, y: .48 }] };

  // 보스 그림 안의 비율 위치를 전장 좌표로 바꾼다(보스 요소의 실제 화면 크기 기준).
  function toxicBeastSpot(boss, spot) {
    const field = refs.field?.getBoundingClientRect();
    const rect = boss.el?.getBoundingClientRect();
    if (!field?.width || !rect?.width) return { x: boss.x, y: boss.y };
    return {
      x: boss.x + (spot.x - .5) * rect.width / field.width,
      y: boss.y + (spot.y - .5) * rect.height / field.height
    };
  }

  function toxicBeastTailPoint(boss) {
    return toxicBeastSpot(boss, TOXIC_BEAST_SPOTS.tail);
  }

  function toxicBeastMouthPoint(boss) {
    return toxicBeastSpot(boss, TOXIC_BEAST_SPOTS.mouth);
  }

  function addToxicFx(className, point) {
    const el = document.createElement('i');
    el.className = className;
    el.style.left = percent(point.x);
    el.style.top = percent(point.y);
    refs.effects.append(el);
    return el;
  }

  // 독침: 꼬리 끝 눈알이 밝아지며 몸을 젖혔다가(0.25초) 반동과 함께 발사. 한 발·두 발을 번갈아 쏜다.
  function fireToxicBeastVenom(boss) {
    const targets = [...(state?.allies || []), ...(state?.garudaWingmen || [])].filter(ally => !ally.dead);
    if (!targets.length) return;
    const count = boss.toxicVolleyDouble ? 2 : 1;
    boss.toxicVolleyDouble = !boss.toxicVolleyDouble;
    const picks = [...targets].sort(() => Math.random() - .5);
    const volley = Array.from({ length: count }, (_, index) => picks[index % picks.length]);
    boss.el?.classList.add('toxic-tail-aiming');
    const glow = addToxicFx('fx-toxic-tail-glow', toxicBeastTailPoint(boss));
    schedule(() => {
      glow.remove();
      boss.el?.classList.remove('toxic-tail-aiming');
      if (!state || state.status !== 'combat' || boss.dead) return;
      boss.el?.classList.remove('toxic-tail-firing');
      void boss.el?.offsetWidth;
      boss.el?.classList.add('toxic-tail-firing');
      schedule(() => boss.el?.classList.remove('toxic-tail-firing'), 420);
      volley.forEach((target, index) => schedule(() => {
        if (!state || state.status !== 'combat' || boss.dead) return;
        const tail = toxicBeastTailPoint(boss);
        const burst = addToxicFx('fx-toxic-tail-burst', tail);
        schedule(() => burst.remove(), 320);
        launchToxicGlob(boss, target, tail, count === 2 ? (index ? 1 : -1) : 0);
      }, index * 160));
    }, 250);
  }

  // 포물선 독침: 물방울 꼬리를 남기며 날아가 명중하면 산성 튀김과 독 웅덩이를 남긴다.
  function launchToxicGlob(boss, target, from, bend) {
    if (!target || target.dead || !refs.effects) return;
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480, height = field?.height || 720;
    const glob = addToxicFx('fx-toxic-glob', from);
    const startPoint = { ...from };
    const travel = 620;
    const token = generation;
    const startedAt = performance.now();
    let lastDrop = 0;
    const side = bend || (pointOf(target).x < from.x ? -1 : 1);
    const step = () => {
      if (token !== generation || !state || state.status !== 'combat') { glob.remove(); return; }
      const t = Math.min(1, (performance.now() - startedAt) / travel);
      const end = pointOf(target);
      const control = { x: (startPoint.x + end.x) / 2 + side * 70 / width, y: (startPoint.y + end.y) / 2 - 40 / height };
      const x = (1 - t) * (1 - t) * startPoint.x + 2 * (1 - t) * t * control.x + t * t * end.x;
      const y = (1 - t) * (1 - t) * startPoint.y + 2 * (1 - t) * t * control.y + t * t * end.y;
      glob.style.left = percent(x);
      glob.style.top = percent(y);
      glob.style.transform = `translate(-50%,-50%) rotate(${Math.round(t * 540)}deg)`;
      if (t - lastDrop > .08) {
        lastDrop = t;
        const drop = addToxicFx('fx-toxic-drop trail', { x, y });
        schedule(() => drop.remove(), 520);
      }
      if (t < 1) { requestAnimationFrame(step); return; }
      glob.remove();
      if (target.dead) return;
      const hit = resolveEnemyProjectileHit(boss, target, 'monster-acid', 200, () => addToxicPoisonStack(target), end, false);
      if (hit) createToxicSplash(end);
    };
    requestAnimationFrame(step);
  }

  function createToxicSplash(point) {
    const splash = addToxicFx('fx-toxic-splash', point);
    schedule(() => splash.remove(), 420);
    for (let index = 0; index < 6; index += 1) {
      const drop = addToxicFx('fx-toxic-drop splash', point);
      const angle = -Math.PI * (.1 + .8 * Math.random());
      drop.style.setProperty('--drop-x', `${Math.round(Math.cos(angle) * (16 + Math.random() * 16))}px`);
      drop.style.setProperty('--drop-y', `${Math.round(Math.sin(angle) * (16 + Math.random() * 16))}px`);
      schedule(() => drop.remove(), 460);
    }
    const puddle = addToxicFx('fx-toxic-puddle', { x: point.x, y: point.y + .012 });
    schedule(() => puddle.remove(), 1300);
  }

  // 평상시: 날개 끝에서 독 방울이 가끔 떨어진다.
  function dripToxicBeast(boss, dt) {
    boss.toxicDripTimer = (boss.toxicDripTimer || 0) - dt;
    if (boss.toxicDripTimer > 0 || !refs.effects) return;
    boss.toxicDripTimer = 380 + Math.random() * 260;
    const wings = TOXIC_BEAST_SPOTS.wings;
    const drop = addToxicFx('fx-toxic-drop drip', toxicBeastSpot(boss, wings[Math.floor(Math.random() * wings.length)]));
    schedule(() => drop.remove(), 900);
  }

  // 브레스 충전: 독 입자가 입으로 빨려 들어가고 입의 빛이 차오른다.
  function chargeToxicBeastBreath(boss, dt) {
    const mouth = toxicBeastMouthPoint(boss);
    if (boss.toxicMouthGlow) {
      boss.toxicMouthGlow.style.left = percent(mouth.x);
      boss.toxicMouthGlow.style.top = percent(mouth.y);
      boss.toxicMouthGlow.style.setProperty('--charge', (1 - Math.max(0, boss.toxicBreathCharge) / 2000).toFixed(3));
    }
    boss.toxicMoteTimer = (boss.toxicMoteTimer || 0) - dt;
    if (boss.toxicMoteTimer > 0) return;
    boss.toxicMoteTimer = 55;
    const field = refs.field?.getBoundingClientRect();
    const angle = Math.random() * Math.PI * 2, radius = 90 + Math.random() * 40;
    const mote = addToxicFx('fx-toxic-mote', {
      x: mouth.x + Math.cos(angle) * radius / (field?.width || 480),
      y: mouth.y + Math.sin(angle) * radius * .8 / (field?.height || 720)
    });
    mote.style.setProperty('--mote-x', `${Math.round(-Math.cos(angle) * radius)}px`);
    mote.style.setProperty('--mote-y', `${Math.round(-Math.sin(angle) * radius * .8)}px`);
    schedule(() => mote.remove(), 540);
  }

  // 브레스 발사: 머리를 숙이며 아래쪽 아군 함대로 부채꼴 독가스. 독가스가 닿으면 독 중첩·독 안개.
  function finishToxicBeastBreath(boss) {
    if (!boss || boss.dead || state?.status !== 'combat') return;
    playPoisonBombSound();
    boss.toxicBreathWindup = false;
    boss.nextPoisonBreath = 3000;
    boss.nextToxicShot = 2000;
    boss.el?.classList.remove('toxic-charging');
    boss.el?.classList.add('toxic-breath-firing');
    schedule(() => boss.el?.classList.remove('toxic-breath-firing'), 1100);
    boss.toxicMouthGlow?.remove();
    boss.toxicMouthGlow = null;
    const mouth = toxicBeastMouthPoint(boss);
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480, height = field?.height || 720;
    const victims = [...(state.allies || []), ...(state.garudaWingmen || [])].filter(ally => !ally.dead);
    const fleetY = victims.length ? Math.max(...victims.map(ally => ally.y)) : .82;
    const fleetX = victims.length ? victims.reduce((sum, ally) => sum + ally.x, 0) / victims.length : .5;
    const length = Math.max(120, (fleetY - mouth.y) * height + 50);
    const cone = addToxicFx('fx-toxic-breath-cone', mouth);
    cone.style.height = `${length}px`;
    cone.style.width = `${Math.min(width * 1.05, length * 1.25)}px`;
    cone.style.setProperty('--cone-angle', `${Math.atan2((fleetX - mouth.x) * width, (fleetY - mouth.y) * height) * -1}rad`);
    schedule(() => cone.remove(), 1150);
    for (let index = 0; index < 9; index += 1) {
      const cloud = addToxicFx('fx-toxic-cloud', mouth);
      cloud.style.setProperty('--cloud-x', `${Math.round((fleetX - mouth.x) * width + (Math.random() - .5) * width * .8)}px`);
      cloud.style.setProperty('--cloud-y', `${Math.round((fleetY - mouth.y) * height - 10 + (Math.random() - .5) * 40)}px`);
      cloud.style.animationDelay = `${index * 45}ms`;
      schedule(() => cloud.remove(), 1400 + index * 45);
    }
    victims.forEach((ally, index) => {
      schedule(() => {
        if (state?.status !== 'combat' || ally.dead) return;
        addToxicPoisonStack(ally);
        createToxicImpact(pointOf(ally));
        const mist = addToxicFx('fx-toxic-mist', pointOf(ally));
        schedule(() => mist.remove(), 2000);
      }, 380 + index * 70);
    });
  }

  function addToxicPoisonStack(target) {
    if (!target || target.dead || (state?.allies?.includes(target) && isAllyStatusImmune(target))) return;
    target.toxicPoisonApplications ||= [];
    if (target.toxicPoisonApplications.length >= 10) return;
    target.toxicPoisonApplications.push({ untilTick: 1000 });
    target.toxicPoisonRemaining = 5000;
    target.toxicPoisonStacks = target.toxicPoisonApplications.length;
    target.el?.classList.add('toxic-poisoned');
    if (target.el) {
      target.el.dataset.toxicPoisonStacks = String(target.toxicPoisonStacks);
      let badge = target.el.querySelector('.toxic-poison-badge');
      if (!badge) { badge = document.createElement('span'); badge.className = 'toxic-poison-badge'; badge.setAttribute('aria-hidden', 'true'); target.el.append(badge); }
      badge.textContent = `독 ${target.toxicPoisonStacks}/10`;
    }
    if (target.toxicPoisonStacks >= 10 && !(target.toxicExplosionRemaining > 0)) {
      target.toxicExplosionRemaining = 3000;
      target.el?.classList.add('toxic-overloaded');
      announce(`${target.ship?.name || '아군 함선'} · 독성 중첩 한계 · 폭발 임박`, 'boss');
    }
  }

  function updateToxicPoison(dt) {
    for (const ally of [...(state?.allies || []), ...(state?.garudaWingmen || [])]) {
      if (ally.dead || !ally.toxicPoisonApplications?.length) continue;
      ally.toxicPoisonRemaining = Math.max(0, Number(ally.toxicPoisonRemaining || 0) - dt);
      for (const stack of ally.toxicPoisonApplications) {
        stack.untilTick -= dt;
        while (stack.untilTick <= 0 && ally.toxicPoisonRemaining > 0) {
          dealAllyDamage(ally, 20, state.boss);
          stack.untilTick += 1000;
          if (ally.dead) break;
        }
      }
      if (ally.toxicPoisonRemaining <= 0) {
        ally.toxicPoisonApplications = [];
        ally.toxicExplosionRemaining = 0;
      }
      ally.toxicPoisonStacks = ally.toxicPoisonApplications.length;
      if (ally.toxicPoisonStacks) {
        const badge = ally.el?.querySelector('.toxic-poison-badge');
        if (badge) badge.textContent = `독 ${ally.toxicPoisonStacks}/10`;
        if (ally.toxicExplosionRemaining > 0) {
          ally.toxicExplosionRemaining -= dt;
          if (ally.toxicExplosionRemaining <= 0) detonateToxicPoison(ally);
        }
      } else {
        ally.toxicExplosionRemaining = 0;
        ally.el?.classList.remove('toxic-poisoned', 'toxic-overloaded');
        ally.el?.querySelector('.toxic-poison-badge')?.remove();
        if (ally.el) ally.el.dataset.toxicPoisonStacks = '0';
      }
    }
  }

  function detonateToxicPoison(sourceAlly) {
    if (!sourceAlly || sourceAlly.dead || sourceAlly.toxicPoisonStacks < 10) {
      if (sourceAlly) sourceAlly.toxicExplosionRemaining = 0;
      return;
    }
    sourceAlly.toxicExplosionRemaining = 0;
    sourceAlly.el?.classList.remove('toxic-overloaded');
    const blast = document.createElement('i');
    blast.className = 'fx-toxic-poison-detonation';
    blast.style.setProperty('--toxic-blast-x', percent(sourceAlly.x));
    blast.style.setProperty('--toxic-blast-y', percent(sourceAlly.y));
    refs.effects.append(blast);
    schedule(() => blast.remove(), 900);
    for (const ally of [...(state?.allies || []), ...(state?.garudaWingmen || [])]) {
      if (!ally.dead) dealAllyDamage(ally, 3000, state.boss);
    }
    sourceAlly.toxicPoisonApplications = sourceAlly.toxicPoisonApplications.slice(0, 1);
    if (sourceAlly.toxicPoisonApplications.length) {
      sourceAlly.toxicPoisonApplications[0].untilTick = 1000;
      sourceAlly.toxicPoisonRemaining = 5000;
    }
    sourceAlly.toxicPoisonStacks = sourceAlly.toxicPoisonApplications.length;
    if (sourceAlly.el) {
      sourceAlly.el.dataset.toxicPoisonStacks = String(sourceAlly.toxicPoisonStacks);
      const badge = sourceAlly.el.querySelector('.toxic-poison-badge');
      if (badge) badge.textContent = `독 ${sourceAlly.toxicPoisonStacks}/10`;
    }
    announce('독성마수 · 독성 중첩 폭발', 'boss');
  }

  function createToxicImpact(point) {
    const impact = document.createElement('i');
    impact.className = 'fx-toxic-impact';
    impact.style.left = percent(point.x);
    impact.style.top = percent(point.y);
    refs.effects.append(impact);
    schedule(() => impact.remove(), 540);
  }

  function raptorMuzzlePoint(boss, index) {
    const side = index < 2 ? -1 : 1;
    const row = index % 2;
    return { x: boss.x + side * .108, y: boss.y + .035 + row * .047 };
  }

  function flameBeastMuzzlePoint(boss) {
    return { x: boss.x + .014, y: boss.y - .055 };
  }

  function ancientBeastMuzzlePoint(boss, index) {
    return { x: boss.x + (index - 1) * .028, y: boss.y + .16 };
  }

  function oortFinalMuzzlePoint(boss) {
    return { x: boss.x, y: boss.y + .12 };
  }

  function oortFinalWingPoint(boss, index) {
    const side = index < 4 ? -1 : 1;
    const row = index % 4;
    return { x: boss.x + side * (.19 + row * .025), y: boss.y + .08 + row * .035 };
  }

  function oortFinalTailPoint(boss) {
    return { x: boss.x, y: boss.y - .19 };
  }

  function applyOortFinalSlime(target, boss) {
    if (!target || target.dead) return;
    if (state?.allies?.includes(target) && isAllyStatusImmune(target)) return;
    target.stun = Math.max(Number(target.stun) || 0, 5000);
    target.el?.classList.add('stunned', 'oort-final-slime');
    schedule(() => {
      if (!target.dead && Number(target.stun || 0) <= 0) target.el?.classList.remove('stunned', 'oort-final-slime');
    }, 5050);
    if (!boss?.berserk) return;
    const generation = Number(target.oortAcidGeneration || 0) + 1;
    target.oortAcidGeneration = generation;
    target.el?.classList.add('oort-final-acid-petrified');
    for (let tick = 1; tick <= 5; tick += 1) {
      schedule(() => {
        if (target.oortAcidGeneration === generation && !target.dead) dealAllyDamage(target, 500, boss);
      }, tick * 1000);
    }
    schedule(() => {
      if (target.oortAcidGeneration === generation) target.el?.classList.remove('oort-final-acid-petrified');
    }, 5080);
  }

  function castFlameBeastFireDust(boss) {
    if (!state || boss?.dead) return;
    announce('화염마수 · 불의 티끌', 'boss');
    const storm = document.createElement('div');
    storm.className = 'fx-fire-dust-storm';
    for (let index = 0; index < 30; index += 1) {
      const petal = document.createElement('i');
      petal.style.setProperty('--petal-x', `${Math.round(Math.random() * 100)}%`);
      petal.style.setProperty('--petal-delay', `${Math.round(Math.random() * 520)}ms`);
      petal.style.setProperty('--petal-duration', `${900 + Math.round(Math.random() * 650)}ms`);
      petal.style.setProperty('--petal-drift', `${-45 + Math.round(Math.random() * 90)}px`);
      petal.style.setProperty('--petal-spin', `${180 + Math.round(Math.random() * 420)}deg`);
      storm.append(petal);
    }
    refs.effects.append(storm);
    schedule(() => storm.remove(), 2300);
    state.allies.filter(ally => !ally.dead).forEach(ally => applyFireDust(ally));
  }

  function applyFireDust(ally) {
    if (!ally || ally.dead) return;
    if (isAllyStatusImmune(ally)) return;
    if (ally.shield > 0) {
      clearFireDust(ally);
      return;
    }
    clearFireDust(ally);
    ally.fireDustActive = true;
    ally.fireDustGeneration = Number(ally.fireDustGeneration || 0) + 1;
    const generation = ally.fireDustGeneration;
    ally.el?.classList.add('fire-dusted');
    const sparks = document.createElement('span');
    sparks.className = 'fire-dust-sparks';
    const sparkCount = 3 + Math.floor(Math.random() * 2);
    for (let index = 0; index < sparkCount; index += 1) {
      const spark = document.createElement('i');
      spark.style.setProperty('--spark-x', `${18 + Math.round(Math.random() * 64)}%`);
      spark.style.setProperty('--spark-y', `${12 + Math.round(Math.random() * 68)}%`);
      spark.style.setProperty('--spark-delay', `${Math.round(Math.random() * 720)}ms`);
      sparks.append(spark);
    }
    ally.el?.append(sparks);
    ally.fireDustAura = sparks;
    const tick = () => schedule(() => {
      if (!state || state.status !== 'combat' || ally.dead || !ally.fireDustActive || ally.fireDustGeneration !== generation) return;
      dealAllyDamage(ally, Math.max(1, Math.round(ally.maxHp * .05)));
      tick();
    }, 5000);
    tick();
  }

  function clearFireDust(ally) {
    if (!ally) return;
    ally.fireDustGeneration = Number(ally.fireDustGeneration || 0) + 1;
    ally.fireDustActive = false;
    ally.el?.classList.remove('fire-dusted');
    ally.fireDustAura?.remove();
    ally.fireDustAura = null;
  }

  function isAllyStatusImmune(ally) {
    const now = performance.now();
    return Number(ally?.tankImmuneUntil || 0) > now || Number(ally?.angelaImmuneUntil || 0) > now ||
      Number(ally?.nimitzImmuneUntil || 0) > now || Number(ally?.ironFistImmuneUntil || 0) > now ||
      Number(ally?.repairDroneImmuneUntil || 0) > now;
  }

  // 수리 드론 보조기술 '회복': 모든 상태이상(부식·기절·독·화염 분진·포획망 등) 해제
  function allyHasStatus(ally) {
    return Number(ally?.corrosionStacks || 0) > 0 || Number(ally?.stun || 0) > 0 || Boolean(ally?.toxicPoisonApplications?.length) || Boolean(ally?.fireDustActive);
  }

  function cleanseAllAllyStatuses(ally) {
    if (!ally || ally.dead) return;
    cleanseTankStatuses(ally);
    ally.toxicPoisonApplications = [];
    ally.toxicPoisonStacks = 0;
    ally.toxicPoisonRemaining = 0;
    ally.toxicExplosionRemaining = 0;
    ally.el?.classList.remove('toxic-poisoned', 'toxic-overloaded');
    ally.el?.querySelector('.toxic-poison-badge')?.remove();
    if (ally.el) ally.el.dataset.toxicPoisonStacks = '0';
  }

  function updateRaptorMovement(boss, dt) {
    const living = hostileAllyTargets();
    if (!living.length || boss.entryTime > 0) return;
    boss.raptorMoveRetarget = Math.max(0, (boss.raptorMoveRetarget || 0) - dt);
    if (!boss.raptorTarget || boss.raptorTarget.dead || boss.raptorMoveRetarget <= 0) {
      boss.raptorTarget = living[Math.floor(Math.random() * living.length)];
      boss.raptorMoveRetarget = 850;
    }
    const target = boss.raptorTarget;
    const destination = { x: Math.max(.12, Math.min(.88, target.x)), y: Math.min(.48, Math.max(.2, target.y - .2)) };
    const dx = destination.x - boss.x;
    const dy = destination.y - boss.y;
    const distance = Math.hypot(dx, dy);
    const step = boss.speed * dt;
    if (distance > .004) {
      boss.x += (dx / distance) * Math.min(step, distance);
      boss.y += (dy / distance) * Math.min(step, distance);
      boss.el.style.left = percent(boss.x);
      boss.el.style.top = percent(boss.y);
    }
  }

  function redOverlordMuzzlePoint(boss, index) {
    const side = index % 2 ? 1 : -1;
    const tier = Math.floor(index / 2) % 4;
    return { x: boss.x + side * (.105 + tier * .008), y: boss.y + .035 + tier * .017 };
  }

  function randomNormalMonsterType() {
    const roll = Math.random();
    if (roll < .55) return 'gasimon';
    if (roll < .85) return 'jipgemon';
    if (roll < .95) return 'dokchimmon';
    return 'suicidemon';
  }

  function spawnRedOverlordMinions(boss, count) {
    if (!state || boss.dead) return;
    for (let index = 0; index < count; index += 1) {
      const monsterType = randomNormalMonsterType();
      const profile = ENEMY_PROFILES[monsterType];
      const modifiers = normalEnemyModifiers(state.operation);
      const muzzle = redOverlordMuzzlePoint(boss, index);
      const spread = (Math.floor(index / 2) % 4 - 1.5) * .018;
      const enemy = {
        id: `overlord-minion-${Date.now()}-${index}`,
        kind: 'normal',
        monsterType,
        profile,
        hp: Math.round(profile.hp * modifiers.growth),
        maxHp: Math.round(profile.hp * modifiers.growth),
        x: muzzle.x + (index % 2 ? .012 : -.012),
        y: muzzle.y + spread,
        speed: profile.speed * modifiers.speed * (.9 + Math.random() * .22),
        attackRange: profile.range * modifiers.range,
        approachOffset: monsterType === 'suicidemon' ? 0 : (Math.random() - .5) * (monsterType === 'jipgemon' ? .055 : .15),
        deployed: true,
        atSlot: false,
        wasAtSlot: false,
        dead: false,
        target: null,
        nextAttack: 3000,
        attackInterval: 3000,
        stun: 0,
        attackPower: Math.round(profile.damage * modifiers.growth),
        attackKind: profile.attack
      };
      const element = document.createElement('div');
      element.className = `enemy-unit monster-${monsterType} overlord-minion`;
      element.style.left = percent(enemy.x);
      element.style.top = percent(enemy.y);
      element.innerHTML = `<img class="enemy-sprite" src="${profile.image}" alt="" /><span class="enemy-hp"><i></i></span>`;
      enemy.el = element;
      enemy.healthBar = element.querySelector('.enemy-hp i');
      refs.enemyLayer.append(element);
      state.enemies.push(enemy);
      requestAnimationFrame(() => element.classList.add('entered'));
    }
    announce(`붉은 대군주 · ${count}체 산란`, 'boss');
  }

  function spawnGreenOverlordMinions(boss) {
    if (!state || boss.dead || state.status !== 'combat') return;
    const types = [
      ...Array(10).fill('dokchimmon'),
      ...Array(10).fill('blue-stinger')
    ];
    const modifiers = normalEnemyModifiers(state.operation);
    types.forEach((monsterType, index) => {
      const profile = BLUE_ENEMY_PROFILES[monsterType] || ENEMY_PROFILES[monsterType];
      const muzzle = redOverlordMuzzlePoint(boss, index);
      const spread = (Math.floor(index / 2) % 4 - 1.5) * .018;
      const enemy = {
        id: `green-overlord-minion-${Date.now()}-${index}`,
        kind: 'normal', monsterType, profile,
        archetype: profile.base || monsterType,
        hp: Math.round(profile.hp * modifiers.growth),
        maxHp: Math.round(profile.hp * modifiers.growth),
        x: muzzle.x + (index % 2 ? .012 : -.012),
        y: muzzle.y + spread,
        speed: profile.speed * modifiers.speed * (.9 + Math.random() * .22),
        attackRange: profile.range * modifiers.range,
        approachOffset: (Math.random() - .5) * .15,
        deployed: true, atSlot: false, wasAtSlot: false, dead: false,
        countsForGate: false,
        target: null, nextAttack: 3000, attackInterval: 3000, stun: 0,
        attackPower: Math.round(profile.damage * modifiers.growth),
        attackKind: profile.attack
      };
      const element = document.createElement('div');
      element.className = `enemy-unit monster-${monsterType} overlord-minion green-overlord-minion${monsterType === 'blue-stinger' ? ' blue-variant' : ''}`;
      element.style.left = percent(enemy.x);
      element.style.top = percent(enemy.y);
      element.innerHTML = `<img class="enemy-sprite" src="${profile.image}" alt="" /><span class="enemy-hp"><i></i></span>`;
      enemy.el = element;
      enemy.healthBar = element.querySelector('.enemy-hp i');
      refs.enemyLayer.append(element);
      state.enemies.push(enemy);
      requestAnimationFrame(() => element.classList.add('entered'));
    });
    const targets = [...(state.allies || []), ...(state.garudaWingmen || [])].filter(ally => !ally.dead);
    const target = targets[Math.floor(Math.random() * targets.length)];
    if (target) {
      addToxicPoisonStack(target);
      createToxicImpact(pointOf(target));
      playPoisonBombSound();
    }
    announce('초록대군주 · 독침몬 10기와 푸른독침몬 10기 소환', 'boss');
  }

  function spawnAncientBeastRaptors(boss, count) {
    if (!state || boss.dead || state.status !== 'combat') return;
    const profile = ENEMY_PROFILES.raptor;
    const growth = normalEnemyGrowth(state.operation);
    for (let index = 0; index < count; index += 1) {
      const offsetX = (index - (count - 1) / 2) * .055;
      const enemy = {
        id: `ancient-raptor-${Date.now()}-${index}`,
        kind: 'normal',
        monsterType: 'raptor',
        profile,
        hp: Math.round(profile.hp * growth.multiplier),
        maxHp: Math.round(profile.hp * growth.multiplier),
        x: boss.x + offsetX,
        y: boss.y + .18 + Math.abs(offsetX) * .16,
        speed: profile.speed,
        attackRange: profile.range,
        approachOffset: offsetX * .45,
        deployed: true,
        atSlot: false,
        wasAtSlot: false,
        dead: false,
        target: null,
        nextAttack: 450,
        attackInterval: 2000,
        stun: 0,
        attackPower: Math.round(profile.damage * growth.multiplier),
        attackKind: profile.attack
      };
      const element = document.createElement('div');
      element.className = 'enemy-unit monster-raptor ancient-raptor-guard';
      element.style.left = percent(enemy.x);
      element.style.top = percent(enemy.y);
      element.innerHTML = `<img class="enemy-sprite" src="${profile.image}" alt="중형 몬스터" /><span class="enemy-hp"><i></i></span>`;
      enemy.el = element;
      enemy.healthBar = element.querySelector('.enemy-hp i');
      refs.enemyLayer.append(element);
      state.enemies.push(enemy);
      requestAnimationFrame(() => element.classList.add('entered'));
    }
    announce(`고대 괴수 · 호위 중형 몬스터 ${count}기 호출`, 'boss');
  }

  function spawnAncientPlasmaBugs(boss, count) {
    if (!state || boss.dead || state.status !== 'combat') return;
    boss.plasmaWaves = Number(boss.plasmaWaves || 0) + 1;
    for (let index = 0; index < count; index += 1) {
      const bug = {
        id: `plasma-bug-${Date.now()}-${boss.plasmaWaves}-${index}`,
        kind: 'normal', monsterType: 'plasma-bug', hp: PLASMA_BUG.hp, maxHp: PLASMA_BUG.hp,
        x: .1 + Math.random() * .8, y: .42 + Math.random() * .21,
        speed: PLASMA_BUG.speed * (isOortFrenzyGate() ? 2 : 1), attackRange: PLASMA_BUG.range, approachOffset: 0,
        deployed: false, atSlot: false, wasAtSlot: false, dead: false, charging: false,
        target: null, nextAttack: 0, attackInterval: PLASMA_BUG.cooldown,
        stun: 0, attackPower: PLASMA_BUG.damage, attackKind: 'plasma'
      };
      const element = document.createElement('div');
      element.className = 'enemy-unit monster-plasma-bug emerging';
      element.style.left = percent(bug.x);
      element.style.top = percent(bug.y);
      element.innerHTML = PLASMA_BUG_MARKUP;
      bug.el = element;
      bug.healthBar = element.querySelector('.enemy-hp i');
      refs.enemyLayer.append(element);
      state.enemies.push(bug);
      createPlasmaBugHole(bug);
      schedule(() => {
        if (bug.dead || state.status !== 'combat') return;
        bug.deployed = true;
        element.classList.remove('emerging');
        element.classList.add('entered');
      }, PLASMA_BUG.emerge);
    }
    if (!isOortFinalBossGate()) announce(`${boss.variant === 'oort-final-boss' ? '오르트 최종 보스' : '고대 괴수'} · 플라즈마버그 ${count}마리 출현`, 'boss');
  }

  function createOortSlimeLaunchEffect(boss) {
    const effect = document.createElement('i');
    const point = oortFinalTailPoint(boss);
    effect.className = 'fx-oort-slime-launch';
    effect.style.left = percent(point.x);
    effect.style.top = percent(point.y);
    refs.effects.append(effect);
    schedule(() => effect.remove(), 620);
  }

  function createOortSlimeImpact(point) {
    const effect = document.createElement('i');
    effect.className = 'fx-oort-slime-impact';
    effect.style.left = percent(point.x);
    effect.style.top = percent(point.y);
    refs.effects.append(effect);
    schedule(() => effect.remove(), 860);
  }

  function updatePlasmaBugAttack(bug, dt) {
    bug.el.classList.add('attacking');
    const target = monsterTargetFor(bug);
    // 엉덩이(복부 끝)를 목표 쪽으로 향한다. 그림의 머리가 +x 방향이므로 목표 방향 + 180도.
    if (target) setPlasmaBugHeading(bug, plasmaBugAngleTo(bug, target) + Math.PI, dt);
    if (bug.plasmaCooldown > 0) {
      bug.plasmaCooldown = Math.max(0, bug.plasmaCooldown - dt);
      if (bug.plasmaCooldown > 0) return;
      bug.plasmaCharge = PLASMA_BUG.charge;
      bug.charging = true;
      bug.el.classList.remove('plasma-bug-cooling');
      bug.el.classList.add('charging');
      return;
    }
    bug.el.classList.add('charging');
    bug.plasmaCharge = Math.max(0, bug.plasmaCharge - dt);
    updatePlasmaBugChargeFx(bug, target, 1 - bug.plasmaCharge / PLASMA_BUG.charge);
    if (bug.plasmaCharge > 0) return;
    // 지형이 흐르는 동안에는 사거리에 들어올 때까지 충전한 채로 기다린다.
    if (!target || (plasmaBugTerrainScrolling() && plasmaBugDistance(bug, target) > bug.attackRange)) return;
    bug.charging = false;
    bug.el.classList.remove('charging');
    bug.el.classList.add('firing', 'plasma-bug-cooling');
    clearPlasmaBugFx(bug);
    firePlasmaBugPierce(bug, target);
    bug.plasmaCooldown = PLASMA_BUG.cooldown;
    schedule(() => bug.el?.classList.remove('firing'), 520);
  }

  function plasmaBugDistance(bug, target) {
    return Math.hypot(target.x - bug.x, target.y - bug.y);
  }

  // 화면(픽셀) 기준 방향. 전장 가로·세로 비율이 달라 비율 좌표 그대로 각도를 재면 머리가 어긋난다.
  function plasmaBugAngleTo(bug, target) {
    const field = refs.field?.getBoundingClientRect();
    return Math.atan2((target.y - bug.y) * (field?.height || 720), (target.x - bug.x) * (field?.width || 480));
  }

  // 머리를 목표 방향으로 초당 약 340도씩 돌린다(CSS 전환은 매 프레임 다시 시작돼 거의 돌지 않으므로 직접 돌림).
  const PLASMA_BUG_TURN_RATE = .006;
  function setPlasmaBugHeading(bug, angle, dt = 0) {
    const current = Number.isFinite(bug.pbHeading) ? bug.pbHeading : angle;
    const diff = Math.atan2(Math.sin(angle - current), Math.cos(angle - current));
    const turn = Math.sign(diff) * Math.min(Math.abs(diff), PLASMA_BUG_TURN_RATE * dt);
    bug.pbHeading = current + turn;
    bug.el?.style.setProperty('--pb-heading', `${bug.pbHeading.toFixed(4)}rad`);
  }

  // 오르트 서식지 관문은 전투 시작 후 28초 동안 지형(배경)이 아래로 흐른다. 땅 위의 플라즈마버그도 함께 흘러내린다.
  const OORT_TERRAIN_SCROLL = 28000;
  function plasmaBugTerrainScrolling() {
    return Boolean(state?.oortCameraStartedAt) && performance.now() - state.oortCameraStartedAt < OORT_TERRAIN_SCROLL;
  }

  function plasmaBugTerrainDriftRate() {
    if (state.oortDriftRate != null) return state.oortDriftRate;
    const view = refs.viewport?.getBoundingClientRect();
    const field = refs.field?.getBoundingClientRect();
    if (!view?.width || !field?.height) return 0;
    // 배경: 가로 118% 맞춤, 원본 836×1881. 아래 끝에서 위 끝까지 28초에 걸쳐 흐른다.
    const travel = Math.max(0, view.width * 1.18 * 1881 / 836 - view.height);
    state.oortDriftRate = travel / OORT_TERRAIN_SCROLL / field.height;
    return state.oortDriftRate;
  }

  function plasmaBugDriftAllowance() {
    return plasmaBugTerrainScrolling() ? plasmaBugTerrainDriftRate() * PLASMA_BUG.charge : 0;
  }

  function applyPlasmaBugTerrainDrift(bug, dt) {
    if (!plasmaBugTerrainScrolling()) return false;
    bug.y += plasmaBugTerrainDriftRate() * dt;
    bug.el.style.top = percent(bug.y);
    if (bug.y <= 1.06) return false;
    // 지형에 실려 화면 아래로 벗어나면 조용히 사라진다(처치 보상 없음).
    bug.dead = true;
    clearPlasmaBugFx(bug);
    bug.el?.remove();
    return true;
  }

  function plasmaBugTailPoint(bug, target) {
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480, height = field?.height || 720;
    const dx = (target.x - bug.x) * width, dy = (target.y - bug.y) * height;
    const length = Math.hypot(dx, dy) || 1;
    return { x: bug.x + dx / length * PLASMA_BUG.tailOffset / width, y: bug.y + dy / length * PLASMA_BUG.tailOffset / height };
  }

  function createPlasmaBugHole(bug) {
    if (!refs.enemyLayer) return;
    const hole = document.createElement('i');
    hole.className = 'fx-plasma-bug-hole';
    hole.style.left = percent(bug.x);
    hole.style.top = percent(bug.y);
    refs.enemyLayer.prepend(hole); // 몬스터 층 맨 아래: 벌레를 덮지 않는다
    schedule(() => hole.remove(), 2600);
  }

  function kickPlasmaBugDust(bug, dt) {
    bug.pbDustTimer = (bug.pbDustTimer || 0) - dt;
    if (bug.pbDustTimer > 0 || !refs.enemyLayer) return;
    bug.pbDustTimer = 260;
    const field = refs.field?.getBoundingClientRect();
    const angle = Number(bug.pbHeading) || 0;
    const dust = document.createElement('i');
    dust.className = 'fx-plasma-bug-dust';
    dust.style.left = percent(bug.x - Math.cos(angle) * 28 / (field?.width || 480));
    dust.style.top = percent(bug.y - Math.sin(angle) * 28 / (field?.height || 720));
    refs.enemyLayer.prepend(dust);
    schedule(() => dust.remove(), 800);
  }

  // 충전: 복부가 점점 빠르게 맥동하며 밝아지고, 엉덩이 끝 에너지 구슬이 자라며 조준선이 진해진다.
  function updatePlasmaBugChargeFx(bug, target, progress) {
    if (!refs.effects || !target) return;
    const now = performance.now();
    const pulse = (Math.sin(now / Math.max(60, 180 - progress * 120)) + 1) / 2;
    bug.el.style.setProperty('--pb-glow', (.15 + progress * .55 + pulse * .3 * progress).toFixed(3));
    if (!bug.pbAim) {
      bug.pbAim = document.createElement('i');
      bug.pbAim.className = 'fx-plasma-bug-aim';
      bug.pbOrb = document.createElement('i');
      bug.pbOrb.className = 'fx-plasma-bug-orb';
      refs.effects.append(bug.pbAim, bug.pbOrb);
    }
    const tail = plasmaBugTailPoint(bug, target);
    positionLine(bug.pbAim, tail, pointOf(target));
    bug.pbAim.style.opacity = progress > .8 ? (Math.sin(now / 30) > 0 ? .95 : .35) : (progress * .75).toFixed(3);
    bug.pbOrb.style.left = percent(tail.x);
    bug.pbOrb.style.top = percent(tail.y);
    bug.pbOrb.style.transform = `translate(-50%,-50%) scale(${(.2 + progress * 1.1 + pulse * .15).toFixed(3)})`;
  }

  function clearPlasmaBugFx(bug) {
    bug.pbAim?.remove();
    bug.pbOrb?.remove();
    bug.pbAim = null;
    bug.pbOrb = null;
    bug.el?.style.setProperty('--pb-glow', '0');
  }

  // 관통 플라즈마 구: 목표 방향으로 화면 끝까지 날아가며 닿은 아군 모두에게 피해를 준다.
  function firePlasmaBugPierce(bug, target) {
    const field = refs.field?.getBoundingClientRect();
    if (!field?.width || !refs.effects) return;
    const width = field.width, height = field.height;
    const origin = plasmaBugTailPoint(bug, target);
    const dx = (target.x - origin.x) * width, dy = (target.y - origin.y) * height;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length, uy = dy / length;
    // 화면 밖으로 완전히 나갈 때까지의 거리
    const exitX = ux > 0 ? (width + 40 - origin.x * width) / ux : ux < 0 ? (-40 - origin.x * width) / ux : Infinity;
    const exitY = uy > 0 ? (height + 40 - origin.y * height) / uy : uy < 0 ? (-40 - origin.y * height) / uy : Infinity;
    const maxTravel = Math.max(0, Math.min(exitX, exitY));
    const muzzle = document.createElement('i');
    muzzle.className = 'fx-plasma-bug-muzzle';
    muzzle.style.left = percent(origin.x);
    muzzle.style.top = percent(origin.y);
    refs.effects.append(muzzle);
    schedule(() => muzzle.remove(), 320);
    createPlasmaBugSteam(bug);
    const shot = document.createElement('i');
    shot.className = 'fx-plasma-bug-pierce';
    shot.style.setProperty('--pb-shot-angle', `${Math.atan2(uy, ux)}rad`);
    refs.effects.append(shot);
    const token = generation;
    const startedAt = performance.now();
    const struck = new Set();
    const step = () => {
      if (token !== generation || !state || state.status !== 'combat') { shot.remove(); return; }
      const travelled = Math.min(maxTravel, (performance.now() - startedAt) * PLASMA_BUG.shotSpeed);
      const x = origin.x + ux * travelled / width, y = origin.y + uy * travelled / height;
      shot.style.left = percent(x);
      shot.style.top = percent(y);
      let absorbed = false;
      hostileAllyTargets().forEach(ally => {
        if (absorbed || struck.has(ally) || ally.dead) return;
        const point = pointOf(ally);
        const rect = ally.el?.getBoundingClientRect();
        const radius = rect?.width ? (rect.width + rect.height) * .2 : 22;
        if (Math.hypot((point.x - x) * width, (point.y - y) * height) > radius + 9) return;
        struck.add(ally);
        if (ally.isCelestialShield) {
          hitCelestialShield(ally, point, bug, PLASMA_BUG.damage);
          absorbed = true;
          return;
        }
        dealAllyDamage(ally, PLASMA_BUG.damage, bug);
        createPlasmaBugHitFx(ally);
      });
      if (absorbed || travelled >= maxTravel) { shot.remove(); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // 발사 직후 복부에서 김이 피어오른다(냉각).
  function createPlasmaBugSteam(bug) {
    const field = refs.field?.getBoundingClientRect();
    const angle = Number(bug.pbHeading) || 0;
    for (let index = 0; index < 4; index += 1) {
      const steam = document.createElement('i');
      steam.className = 'fx-plasma-bug-steam';
      // 복부는 머리 반대쪽(-x)에 있다.
      const along = -(10 + Math.random() * 18), side = (Math.random() - .5) * 20;
      steam.style.left = percent(bug.x + (Math.cos(angle) * along - Math.sin(angle) * side) / (field?.width || 480));
      steam.style.top = percent(bug.y + (Math.sin(angle) * along + Math.cos(angle) * side) / (field?.height || 720));
      steam.style.animationDelay = `${index * 110}ms`;
      refs.effects.append(steam);
      schedule(() => steam.remove(), 1000 + index * 110);
    }
  }

  // 아군 피격 효과: 함선이 푸르게 번쩍이고 전기 불꽃이 튄다.
  function createPlasmaBugHitFx(ally) {
    const point = pointOf(ally);
    createExplosion(point, 'plasma-bug');
    const spark = document.createElement('i');
    spark.className = 'fx-plasma-bug-struck';
    spark.style.left = percent(point.x);
    spark.style.top = percent(point.y);
    spark.innerHTML = '<b></b><b></b><b></b><b></b><b></b><b></b>';
    refs.effects.append(spark);
    schedule(() => spark.remove(), 420);
    if (!ally.el) return;
    ally.el.classList.remove('plasma-bug-struck');
    void ally.el.offsetWidth;
    ally.el.classList.add('plasma-bug-struck');
    schedule(() => ally.el?.classList.remove('plasma-bug-struck'), 380);
  }

  function giantDokchimmonTarget() {
    const celestialShield = activeCelestialShieldTarget();
    if (celestialShield) return celestialShield;
    const living = hostileAllyTargets();
    const destroyers = living.filter(ally => ally.ship?.type === 'destroyer');
    const targets = destroyers.length ? destroyers : living;
    return targets[Math.floor(Math.random() * targets.length)] || null;
  }

  function castGiantDokchimmonPoison(boss) {
    if (!boss || boss.dead) return;
    playPoisonBombSound();
    boss.el?.classList.add('poison-casting');
    schedule(() => boss.el?.classList.remove('poison-casting'), 820);
    const mouth = giantDokchimmonMuzzlePoint(boss);
    const burst = document.createElement('i');
    burst.className = 'fx-giant-dokchimmon-burst';
    burst.style.left = percent(mouth.x);
    burst.style.top = percent(mouth.y);
    refs.effects.append(burst);
    const poisonWave = document.createElement('i');
    poisonWave.className = 'fx-giant-dokchimmon-wave';
    poisonWave.style.left = percent(mouth.x);
    poisonWave.style.top = percent(mouth.y);
    refs.effects.append(poisonWave);
    schedule(() => burst.remove(), 920);
    schedule(() => poisonWave.remove(), 1420);
    state.allies.filter(ally => !ally.dead).forEach((ally, index) => {
      schedule(() => {
        applyMonsterCorrosion(ally, boss.attackPower);
        applyMonsterCorrosion(ally, boss.attackPower);
        createGiantDokchimmonDroplets(ally);
      }, 220 + index * 70);
    });
  }

  function createGiantDokchimmonDroplets(target) {
    const point = pointOf(target);
    for (let index = 0; index < 4; index += 1) {
      const droplet = document.createElement('i');
      droplet.className = 'fx-giant-dokchimmon-droplet';
      droplet.style.left = percent(point.x + (Math.random() - .5) * .028);
      droplet.style.top = percent(point.y + (Math.random() - .5) * .018);
      droplet.style.setProperty('--drop-x', `${(Math.random() - .5) * 26}px`);
      droplet.style.setProperty('--drop-y', `${-8 - Math.random() * 18}px`);
      refs.effects.append(droplet);
      schedule(() => droplet.remove(), 560);
    }
  }

  function fireAlliedWeapon(ally, profile) {
    const targets = inRangeTargetsFor(ally);
    if (!targets.length) return;
    const origin = pointOf(ally);
    const target = targets.slice().sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y))[0];
    if (!target) return;
    faceAllyTowardTarget(ally, target);
    if(profile.fx==='cannon')playCannonFireSound();

    if (profile.chains) {
      const chained = [target, ...targets.filter(candidate => candidate !== target).sort(() => Math.random() - .5)].slice(0, profile.chains);
      chained.forEach((chainTarget, index) => {
        drawFriendlyShot(ally, chainTarget, profile, index * 45);
        const packets = profile.hits;
        schedule(() => shooterDamage(chainTarget, packets, profile.fx === 'cannon' ? ally : null, profile.fx), profile.travel + index * 45);
      });
      return;
    }
    drawFriendlyShot(ally, target, profile, 0);
    schedule(() => {
      shooterDamage(target, profile.hits, profile.fx === 'cannon' ? ally : null, profile.fx);
      if (profile.splash) dealPlasmaSplash(target, profile.hits * profile.splash);
    }, profile.travel);
  }

  // 쏘는 쪽에 따라 목표를 고른다. 아군은 기존대로 적을 고르고, 아레나 상대 함선은 아군을 고른다.
  function shooterTargetsFor(shooter) {
    if (!shooter?.isArenaShip) return battlecruiserTargetsFor(shooter);
    const origin = pointOf(shooter);
    return state.allies
      .filter(ally => !ally.dead)
      .sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y));
  }
  function shooterTargetFor(shooter) {
    return shooterTargetsFor(shooter)[0] || null;
  }
  function battlecruiserTargetFor(ally) {
    const target = shooterTargetsFor(ally)[0] || null;
    faceAllyTowardTarget(ally, target);
    return target;
  }

  function highestDurabilityEnemyTarget(ally) {
    const target = shooterTargetsFor(ally)
      .slice()
      .sort((a, b) => (Number(b.maxHp || b.hp || 0) - Number(a.maxHp || a.hp || 0)) || (Number(b.hp || 0) - Number(a.hp || 0)))[0] || null;
    faceAllyTowardTarget(ally, target);
    return target;
  }

  function faceAllyTowardTarget(ally, target) {
    // 아레나 상대 함선: 화면의 함선 모델을 돌려서 목표를 향하게 한다(아군과 같은 각도 규칙). 함체 방향이 잠긴 동안에는 돌지 않는다.
    if (ally?.isArenaShip && target && !target.dead) {
      if (Number(ally.facingLockUntil || 0) > performance.now()) return;
      const angle = Math.atan2(target.y - ally.y, target.x - ally.x) + Math.PI / 2;
      ally.facingAngle = angle;
      ally.el?.querySelector('.arena-enemy-model')?.style.setProperty('transform', `scale(.86) rotate(${angle}rad)`);
      return;
    }
    if (!ally?.facingShell || !target || target.dead) return;
    const shipName = String(ally.ship?.name || '');
    if (shipName.includes('거북선') || shipName.includes('판옥선')) return;
    if (ally.isHyperion && (ally.charging || ally.hyperionFacingLocked)) return;
    // 니미츠는 전투 중 함체 방향을 고정한다. 공격 대상이 바뀌어도
    // 함선 자체가 회전하지 않고, 함재기만 목표를 향해 출격한다.
    if (ally.isNimitz) return;
    if (ally.isOmega && ally.omegaFacingLocked) return;
    if (ally.isPandora && ally.pandoraFacingLocked) return;
    if (ally.isPlanetDestroyer) return;
    const angle = Math.atan2(target.y - ally.y, target.x - ally.x) + Math.PI / 2;
    ally.facingAngle = angle;
    ally.facingShell.style.setProperty('--ally-facing-angle', `${angle}rad`);
  }

  function orientedAllyPoint(ally, localX = 0, localY = 0) {
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    const angle = Number(ally?.facingAngle) || 0;
    const x = localX * width;
    const y = localY * height;
    return {
      x: (ally?.x || 0) + (x * Math.cos(angle) - y * Math.sin(angle)) / width,
      y: (ally?.y || 0) + (x * Math.sin(angle) + y * Math.cos(angle)) / height
    };
  }

  function battlecruiserTargetsFor(ally) {
    const origin = pointOf(ally);
    return inRangeTargetsFor(ally)
      .sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y));
  }

  function updateCarrierInterceptor(ally, dt) {
    state.interceptors ||= [];
    const active = state.interceptors.filter(unit => unit.owner === ally && !unit.dead);
    if (!ally.carrierInterceptorsInitialized) {
      for (let index = 0; index < carrierInterceptorCount(ally); index += 1) spawnCarrierInterceptor(ally);
      ally.carrierInterceptorsInitialized = true;
      return;
    }
    active.forEach(interceptor => updateSingleCarrierInterceptor(ally, interceptor, dt));
  }

  function updateSingleCarrierInterceptor(ally, interceptor, dt) {
    const targetIsValid = interceptor.target && !interceptor.target.dead && (interceptor.target.kind === 'boss' || interceptor.target.deployed);
    if (!targetIsValid) interceptor.target = shooterTargetFor(ally);
    if (!interceptor.target) return;
    interceptor.moveTimer -= dt;
    if (interceptor.moveTimer <= 0) {
      interceptor.moveTimer = 440 + Math.random() * 360;
      const point = bastionAttackPoint(interceptor.target);
      interceptor.x = point.x;
      interceptor.y = point.y;
      setBastionFighterFacing(interceptor.el, pointOf(interceptor), pointOf(interceptor.target));
      interceptor.el.style.left = percent(interceptor.x);
      interceptor.el.style.top = percent(interceptor.y);
    }
    interceptor.nextAttack -= dt;
    if (interceptor.nextAttack <= 0) {
      interceptor.nextAttack = CARRIER_INTERCEPTOR.interval;
      const target = interceptor.target;
      if (target && !target.dead) {
        playFighterShotSound();
        const damageBonus=window.ArenaCore?.weaponBonus(ally.ship,state.tacticalResearch,'fighter').damage||0;
        const interceptorPackets = Math.round(CARRIER_INTERCEPTOR.hits*(1+damageBonus));
        shooterDamage(target, interceptorPackets);
        applyDoubleTargetStrike(target, interceptorPackets, ally);
        createExplosion(pointOf(target), 'cannon');
      }
    }
  }

  // 함재기 개발 '더블 타겟': 함재기가 공격한 대상 가까이의 적 1기도 함께 공격하여 그 피해의 50%를 준다(반경 84px 안에서 가장 가까운 적).
  const DOUBLE_TARGET = { ratio: .5, radius: 84 };
  function applyDoubleTargetStrike(target, packets, carrier) {
    if (!(Number(state?.tacticalResearch?.carrierTree?.doubleTarget) > 0) || !carrier || carrier.isArenaShip) return;
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480, height = field?.height || 720;
    const center = pointOf(target);
    const nearest = livingEnemyTargets()
      .filter(enemy => enemy !== target && !enemy.dead)
      .map(enemy => ({ enemy, distance: Math.hypot((enemy.x - center.x) * width, (enemy.y - center.y) * height) }))
      .filter(entry => entry.distance <= DOUBLE_TARGET.radius)
      .sort((a, b) => a.distance - b.distance)[0];
    if (!nearest) return;
    const strike = Math.round(packets * combatStatFactor(carrier) * DOUBLE_TARGET.ratio);
    if (strike > 0) shooterDamage(nearest.enemy, strike, carrier, 'cannon-splash');
  }

  function carrierInterceptorCount(ally) {
    const extra=window.ArenaCore?.development(ally?.ship,state?.tacticalResearch||{}).carrierFighters||0;
    return CARRIER_INTERCEPTOR.count+extra;
  }

  function spawnCarrierInterceptor(ally, overflowExtra = false) {
    if (!state || ally.dead) return;
    const launch = orientedAllyPoint(ally, 0, .05);
    const interceptor = {
      id: `carrier-interceptor-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: 'interceptor',
      owner: ally,
      x: launch.x,
      y: launch.y,
      hp: Math.round(300*(1+(window.ArenaCore?.development(ally.ship,state.tacticalResearch).carrierHull||0))),
      maxHp: Math.round(300*(1+(window.ArenaCore?.development(ally.ship,state.tacticalResearch).carrierHull||0))),
      target: shooterTargetFor(ally),
      nextAttack: 0,
      moveTimer: 0,
      overflowExtra,
      dead: false
    };
    const element = document.createElement('i');
    element.className = 'carrier-interceptor-unit';
    element.style.left = percent(interceptor.x);
    element.style.top = percent(interceptor.y);
    interceptor.el = element;
    refs.allyLayer.append(element);
    state.interceptors.push(interceptor);
    playFighterLaunchSound();
    requestAnimationFrame(() => element.classList.add('deployed'));
    if (overflowExtra) schedule(() => destroyCarrierInterceptor(interceptor, false), CARRIER_OVERFLOW.extraLifetime);
  }

  function dealCarrierInterceptorDamage(interceptor, amount) {
    if (!interceptor || interceptor.dead) return;
    interceptor.hp = Math.max(0, interceptor.hp - amount);
    interceptor.el?.classList.add('hit');
    schedule(() => interceptor.el?.classList.remove('hit'), 90);
    if (interceptor.hp > 0) return;
    destroyCarrierInterceptor(interceptor, !interceptor.overflowExtra);
  }

  function destroyCarrierInterceptor(interceptor, rebuild) {
    if (!interceptor || interceptor.dead) return;
    interceptor.dead = true;
    interceptor.el?.classList.add('destroyed');
    createExplosion(pointOf(interceptor), 'enemy');
    schedule(() => interceptor.el?.remove(), 280);
    const owner = interceptor.owner;
    if (!rebuild || !owner || owner.dead) return;
    owner.carrierProductionQueue = (owner.carrierProductionQueue || 0) + 1;
    processCarrierProduction(owner);
  }

  function processCarrierProduction(owner) {
    if (owner.carrierProducing || !owner.carrierProductionQueue || owner.dead) return;
    owner.carrierProducing = true;
    schedule(() => {
      owner.carrierProductionQueue = Math.max(0, owner.carrierProductionQueue - 1);
      owner.carrierProducing = false;
      if (!owner.dead) spawnCarrierInterceptor(owner);
      processCarrierProduction(owner);
    }, 3500);
  }

  function fireCarrierOverflow(ally) {
    if (ally.carrierOverflow) return false;
    ally.charging = true;
    ally.carrierOverflow = true;
    ally.shieldRechargeElapsed = 0;
    ally.el?.classList.add('carrier-overflow-active');
    announce(`${ally.ship.name} · 오버플로우`, 'friendly');
    for (let index = 0; index < carrierInterceptorCount(ally); index += 1) {
      schedule(() => spawnCarrierInterceptor(ally, true), index * 90);
    }
    schedule(() => {
      ally.carrierOverflow = false;
      ally.charging = false;
      ally.el?.classList.remove('carrier-overflow-active');
    }, CARRIER_OVERFLOW.duration);
    return true;
  }

  function restoreCarrierShieldVisual(ally) {
    if (!ally?.el || ally.shieldEl) return;
    clearFireDust(ally);
    const shield = document.createElement('div');
    shield.className = 'ally-shield carrier-energy-shield';
    shield.innerHTML = `<em>ENERGY ${formatNumber(ally.shield)}</em>`;
    ally.el.prepend(shield);
    ally.shieldEl = shield;
    addCarrierShieldGauge(ally);
  }

  function addCarrierShieldGauge(ally) {
    ally?.carrierShieldGauge?.remove();
    if (ally) ally.carrierShieldGauge = null;
    const health = ally.el?.querySelector('.carrier-shield-health');
    if (!health) return;
    const gauge = document.createElement('span');
    gauge.className = 'carrier-shield-gauge';
    gauge.innerHTML = '<i></i><em></em>';
    health.append(gauge);
    ally.carrierShieldGauge = gauge;
    updateCarrierShieldGauge(ally);
  }

  function updateCarrierShieldGauge(ally) {
    if (!ally?.carrierShieldGauge) return;
    const ratio = ally.maxShield ? Math.max(0, ally.shield / ally.maxShield * 100) : 0;
    const bar = ally.carrierShieldGauge.querySelector('i');
    const label = ally.carrierShieldGauge.querySelector('em');
    if (bar) bar.style.width = `${ratio}%`;
    if (label) label.textContent = formatNumber(Math.ceil(Math.max(0, ally.shield)));
  }

  function clearCarrierShieldGauge(ally) {
    if (!ally?.carrierShieldGauge) return;
    const bar = ally.carrierShieldGauge.querySelector('i');
    const label = ally.carrierShieldGauge.querySelector('em');
    if (bar) bar.style.width = '0%';
    if (label) label.textContent = '0';
  }

  function createCarrierShieldImpact(point) {
    const impact = document.createElement('i');
    impact.className = 'carrier-shield-impact';
    impact.style.left = percent(point.x);
    impact.style.top = percent(point.y);
    refs.effects.append(impact);
    schedule(() => impact.remove(), 360);
  }

  function fireBattlecruiserLaser(ally) {
    const targets = shooterTargetsFor(ally);
    const side = ally.nextLaserSide || 0;
    const target = side
      ? (ally.pendingLaserTarget && !ally.pendingLaserTarget.dead ? ally.pendingLaserTarget : targets[0])
      : targets[0];
    if (!target) return false;
    if (!side) ally.pendingLaserTarget = targets[1] || target;
    else ally.pendingLaserTarget = null;
    ally.nextLaserSide = side ? 0 : 1;
    ally.el.classList.add('battlecruiser-firing', `battlecruiser-firing-${side ? 'right' : 'left'}`);
    schedule(() => ally.el?.classList.remove('battlecruiser-firing', 'battlecruiser-firing-left', 'battlecruiser-firing-right'), 190);
    const targetPoint = pointOf(target);
    if (ally.isStarCruiser) playCruiserLaserSound();
    drawBattlecruiserBeam(battlecruiserMuzzlePoints(ally)[side], targetPoint);
    schedule(() => {
      shooterDamage(target, ally.isStarCruiser ? BATTLECRUISER_LASER.starCruiserHits : BATTLECRUISER_LASER.hits, ally);
      createExplosion(targetPoint, 'laser');
    }, BATTLECRUISER_LASER.travel);
    return true;
  }

  function furyMissileMuzzle(ally, side) {
    return orientedAllyPoint(ally, side * .078, .012);
  }

  function launchFuryMissile(ally, from, to, damageTarget = null) {
    const missile = document.createElement('i');
    missile.className = 'fx-missile fury-missile';
    missile.style.animationDuration = `${FURY_MISSILE.travel}ms`;
    positionProjectile(missile, from, to);
    refs.effects.append(missile);
    schedule(() => missile.remove(), FURY_MISSILE.travel + 150);
    schedule(() => {
      if (damageTarget && !damageTarget.dead) {
        const missileHits = FURY_MISSILE.hits * (ally.furyStars >= 3 ? 1.5 : 1);
        shooterDamage(damageTarget, missileHits, ally, 'missile');
      }
      createExplosion(to, 'missile');
    }, FURY_MISSILE.travel);
  }

  function fireFuryMissiles(ally) {
    const target = shooterTargetsFor(ally)[0];
    if (!target) return false;
    faceAllyTowardTarget(ally, target);
    [-1, 1].forEach(side => launchFuryMissile(ally, furyMissileMuzzle(ally, side), pointOf(target), target));
    ally.el?.classList.add('fury-missile-firing');
    schedule(() => ally.el?.classList.remove('fury-missile-firing'), 250);
    return true;
  }

  function furyBarrageRadius(ally) {
    return FURY_BARRAGE.radius * (ally.furyStars >= 5 ? 1.5 : 1);
  }

  function furyDenseRegion(ally) {
    const targets = shooterTargetsFor(ally);
    if (!targets.length) return null;
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    const radius = furyBarrageRadius(ally) * 1.6;
    const cluster = targets.map(anchor => ({
      anchor,
      members: targets.filter(target => Math.hypot((target.x - anchor.x) * width, (target.y - anchor.y) * height) <= radius)
    })).sort((a, b) => b.members.length - a.members.length)[0]?.members || targets;
    return {
      x: cluster.reduce((sum, target) => sum + target.x, 0) / cluster.length,
      y: cluster.reduce((sum, target) => sum + target.y, 0) / cluster.length
    };
  }

  function furyAreaTargets(center, ally) {
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    const radius = furyBarrageRadius(ally);
    return hostileTargetsFor(ally).filter(target => Math.hypot((target.x - center.x) * width, (target.y - center.y) * height) <= radius);
  }

  function applyFuryStun(target) {
    if (!target || target.dead || target.kind === 'boss') return;
    target.stun = Math.max(Number(target.stun) || 0, FURY_BARRAGE.stun);
    target.furyStunnedUntil = performance.now() + FURY_BARRAGE.stun;
    target.el?.classList.add('stunned', 'fury-stunned');
    schedule(() => {
      if (performance.now() >= Number(target.furyStunnedUntil || 0)) {
        target.el?.classList.remove('fury-stunned');
        if (Number(target.stun) <= 0) target.el?.classList.remove('stunned');
      }
    }, FURY_BARRAGE.stun + 50);
  }

  function fireFuryBarrage(ally) {
    const center = furyDenseRegion(ally);
    if (!center) return false;
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    const radius = furyBarrageRadius(ally);
    const auxDamageMultiplier = ally.furyStars >= 3 ? 1.5 : 1;
    const ultimateDamageMultiplier = ally.furyStars >= 5 ? 1.5 : 1;
    ally.charging = true;
    ally.el?.classList.add('fury-bombarding');
    announce(`${ally.ship.name} · 다련장미사일`, 'friendly');
    for (let salvo = 0; salvo < FURY_BARRAGE.salvos; salvo += 1) {
      schedule(() => {
        if (ally.dead || state.status !== 'combat') return;
        [-1, 1].forEach(side => {
          const spread = (Math.random() - .5) * radius * .78;
          const targetPoint = {
            x: Math.max(.015, Math.min(.985, center.x + spread / width)),
            y: Math.max(.025, Math.min(.82, center.y + (Math.random() - .5) * radius * .68 / height))
          };
          launchFuryMissile(ally, furyMissileMuzzle(ally, side), targetPoint);
        });
      }, salvo * FURY_BARRAGE.interval);
    }
    const impactDelay = (FURY_BARRAGE.salvos - 1) * FURY_BARRAGE.interval + FURY_BARRAGE.travel;
    schedule(() => {
      if (ally.dead || state.status !== 'combat') return;
      createExplosion(center, 'missile');
      furyAreaTargets(center, ally).forEach(target => {
        shooterDamage(target, FURY_BARRAGE.hits * auxDamageMultiplier * ultimateDamageMultiplier, ally, 'missile');
        applyFuryStun(target);
      });
      ally.charging = false;
      ally.el?.classList.remove('fury-bombarding');
    }, impactDelay);
    return true;
  }

  function brownBessMuzzle(ally, side) {
    return orientedAllyPoint(ally, side * .075, -.008);
  }

  function fireBrownBessLaserBurst(ally) {
    const target = shooterTargetsFor(ally)[0];
    if (!target) return false;
    const side = Number(ally.brownbessNextSide) || -1;
    ally.brownbessNextSide = -side;
    faceAllyTowardTarget(ally, target);
    ally.el?.classList.add('brown-bess-laser-firing', side < 0 ? 'brown-bess-left-firing' : 'brown-bess-right-firing');
    for (let shot = 0; shot < BROWN_BESS_LASER.shots; shot += 1) {
      schedule(() => {
        if (!target || target.dead || ally.dead) return;
        const from = brownBessMuzzle(ally, side);
        const to = pointOf(target);
        const beam = document.createElement('i');
        beam.className = 'fx-line brown-bess-laser';
        positionLine(beam, from, to);
        refs.effects.append(beam);
        schedule(() => beam.remove(), BROWN_BESS_LASER.travel + 50);
        schedule(() => {
          if (target.dead) return;
          shooterDamage(target, BROWN_BESS_LASER.hits, ally);
          createExplosion(pointOf(target), 'laser');
        }, BROWN_BESS_LASER.travel);
      }, shot * BROWN_BESS_LASER.shotInterval);
    }
    schedule(() => ally.el?.classList.remove('brown-bess-laser-firing', 'brown-bess-left-firing', 'brown-bess-right-firing'), (BROWN_BESS_LASER.shots - 1) * BROWN_BESS_LASER.shotInterval + 240);
    return true;
  }

  function immobilizeBrownBessTarget(target, duration) {
    if (!target || target.dead) return;
    target.stun = Math.max(Number(target.stun) || 0, duration);
    target.brownBessLockedUntil = Math.max(Number(target.brownBessLockedUntil) || 0, performance.now() + duration);
    target.el?.classList.add('stunned', 'brown-bess-locked');
    schedule(() => {
      if (performance.now() < Number(target.brownBessLockedUntil || 0)) return;
      target.el?.classList.remove('brown-bess-locked');
      if (Number(target.stun) <= 0) target.el?.classList.remove('stunned');
    }, duration + 60);
  }

  function fireBrownBessSniper(ally) {
    const ultimateUnlocked = ally.brownBessStars >= 5;
    const targets = shooterTargetsFor(ally).slice()
      .sort((a, b) => (Number(b.maxHp || b.hp || 0) - Number(a.maxHp || a.hp || 0)) || (Number(b.hp || 0) - Number(a.hp || 0)))
      .slice(0, ultimateUnlocked ? 2 : 1);
    const target = targets[0];
    if (!target) return false;
    faceAllyTowardTarget(ally, target);
    const afterHitStun = ally.brownBessStars >= 3 ? BROWN_BESS_SNIPER.enhancedStopAfterHit : BROWN_BESS_SNIPER.stopAfterHit;
    ally.charging = true;
    ally.facingLockUntil = performance.now() + BROWN_BESS_SNIPER.aim + BROWN_BESS_SNIPER.travel + afterHitStun + 90;
    ally.el?.classList.add('brown-bess-sniping');
    announce(`${ally.ship.name} · ${ultimateUnlocked ? '더블타겟 조준' : '저격 조준'}`, 'friendly');
    targets.forEach((lockedTarget, index) => {
      immobilizeBrownBessTarget(lockedTarget, BROWN_BESS_SNIPER.aim + BROWN_BESS_SNIPER.travel + 150);
      const scope = document.createElement('i');
      scope.className = 'fx-brown-bess-scope';
      const lockedPoint = pointOf(lockedTarget);
      scope.style.left = percent(lockedPoint.x);
      scope.style.top = percent(lockedPoint.y);
      refs.effects.append(scope);
      schedule(() => {
        scope.remove();
        if (ally.dead || lockedTarget.dead || state.status !== 'combat') return;
        const impact = pointOf(lockedTarget);
        playBrownBessShotSound();
        launchPlasmaCannonShot(orientedAllyPoint(ally, (index ? .038 : -.038), -.115), impact, BROWN_BESS_SNIPER.travel, 'brown-bess-sniper');
        const impactPoint = { ...impact };
        schedule(() => {
          if (!lockedTarget.dead) {
            shooterDamage(lockedTarget, BROWN_BESS_SNIPER.hits, ally);
            immobilizeBrownBessTarget(lockedTarget, afterHitStun);
          }
          createPlasmaCannonImpact(impactPoint, lockedTarget.kind === 'boss');
        }, BROWN_BESS_SNIPER.travel);
      }, BROWN_BESS_SNIPER.aim);
    });
    schedule(() => {
      ally.charging = false;
      ally.el?.classList.remove('brown-bess-sniping');
    }, BROWN_BESS_SNIPER.aim + BROWN_BESS_SNIPER.travel + afterHitStun + 90);
    return true;
  }

  function yamatoCannonMuzzle(ally, turret = 0) {
    return orientedAllyPoint(ally, turret ? .029 : -.029, -.112);
  }

  function fireYamatoCannon(ally, turret = 0, randomTarget = false) {
    const targets = shooterTargetsFor(ally);
    const target = randomTarget ? targets[Math.floor(Math.random() * targets.length)] : targets[0];
    if (!target) return false;
    const muzzle = yamatoCannonMuzzle(ally, turret);
    drawIowaMuzzleFlash(muzzle, 'yamato-cannon', ally.facingAngle);
    ally.el?.classList.add('yamato-cannon-firing');
    schedule(() => ally.el?.classList.remove('yamato-cannon-firing'), 180);
    schedule(() => {
      if (target.dead) return;
      shooterDamage(target, YAMATO_CANNON.hits, ally, 'cannon');
      createExplosion(pointOf(target), 'cannon');
    }, YAMATO_CANNON.travel);
    return true;
  }

  function fireYamatoCannonCycle(ally) {
    const initialTarget = shooterTargetsFor(ally)[0];
    if (!initialTarget) return false;
    if (ally.yamatoStars >= 3) {
      const targets = shooterTargetsFor(ally).slice().sort((left, right) => left.x - right.x);
      [-1, 1].forEach(side => {
        const target = targets[side < 0 ? targets.length - 1 : 0];
        launchYamatoMissile(ally, yamatoMissileMuzzle(ally, side), target);
      });
    }
    for (let turret = 0; turret < YAMATO_CANNON.shots; turret += 1) {
      schedule(() => {
        if (!ally.dead && state?.status === 'combat') fireYamatoCannon(ally, turret, false);
      }, turret * YAMATO_CANNON.shotInterval);
    }
    return true;
  }

  function yamatoMissileMuzzle(ally, side) {
    return orientedAllyPoint(ally, side * .09, .005);
  }

  // 야마토: 광선은 뱃머리에서 나가므로, 함체 방향을 "뱃머리에서 목표를 바라보는 방향"으로 맞춘다(몇 번 반복하면 수렴한다).
  function alignYamatoBowToTarget(ally, target) {
    if (!ally || !target || target.dead) return;
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    for (let step = 0; step < 4; step += 1) {
      const bow = yamatoBeamMuzzle(ally);
      ally.facingAngle = Math.atan2((target.y - bow.y) * height, (target.x - bow.x) * width) + Math.PI / 2;
    }
    if (ally.isArenaShip) ally.el?.querySelector('.arena-enemy-model')?.style.setProperty('transform', `scale(.86) rotate(${ally.facingAngle}rad)`);
    else ally.facingShell?.style.setProperty('--ally-facing-angle', `${ally.facingAngle}rad`);
  }

  function yamatoBeamMuzzle(ally) {
    const field = refs.field?.getBoundingClientRect();
    const topview = ally.facingShell?.querySelector('.yamato-topview');
    const width = field?.width || 480;
    const height = field?.height || 720;
    // 함선 요소가 화면에서 축소·확대된 배율을 반영해, 실제 뱃머리 끝(함선 세로 길이의 절반)에서 광선이 나오게 한다.
    const shipScale = ally.el ? (ally.el.getBoundingClientRect().width / (ally.el.offsetWidth || 1)) || 1 : 1;
    const bowDistance = Math.max(0, (topview?.offsetHeight || 156) * .5 * shipScale);
    const angle = Number(ally?.facingAngle) || 0;
    return {
      x: ally.x + Math.sin(angle) * bowDistance / width,
      y: ally.y - Math.cos(angle) * bowDistance / height
    };
  }

  function launchYamatoMissile(ally, from, target) {
    if (!target || target.dead) return;
    const missile = document.createElement('i');
    missile.className = 'fx-missile yamato-missile';
    missile.style.animationDuration = `${YAMATO_FULL_BARRAGE.missileTravel}ms`;
    positionProjectile(missile, from, pointOf(target));
    refs.effects.append(missile);
    schedule(() => missile.remove(), YAMATO_FULL_BARRAGE.missileTravel + 150);
    schedule(() => {
      if (!target.dead) shooterDamage(target, YAMATO_FULL_BARRAGE.missileHits, ally, 'missile');
      createExplosion(pointOf(target), 'missile');
    }, YAMATO_FULL_BARRAGE.missileTravel);
  }

  function fireYamatoFullBarrage(ally, options = {}) {
    const initialTarget = shooterTargetsFor(ally)[0];
    if (!initialTarget) return false;
    ally.charging = true;
    // 전집중을 쏘기 전에 목표 쪽으로 먼저 돌고, 뱃머리에서 목표를 바라보도록 함체 방향을 맞춘 뒤 잠근다.
    faceAllyTowardTarget(ally, initialTarget);
    alignYamatoBowToTarget(ally, initialTarget);
    ally.facingLockUntil = performance.now() + YAMATO_FULL_BARRAGE.duration + YAMATO_FULL_BARRAGE.cooldown + 120;
    ally.el?.classList.add('yamato-full-barrage');
    announce(`${ally.ship.name} · 전집중!`, 'friendly');
    startBladePiercingBeam(ally, () => initialTarget, {
      duration: YAMATO_FULL_BARRAGE.duration,
      tick: YAMATO_FULL_BARRAGE.laserTick,
      hits: YAMATO_FULL_BARRAGE.laserHits,
      width: YAMATO_FULL_BARRAGE.laserWidth
    }, 0, 'yamato-piercing-laser', true, true);
    const bowPoint = yamatoBeamMuzzle(ally);
    const bowCharge = document.createElement('i');
    bowCharge.className = 'planet-destroyer-charge-effect yamato-bow-charge-effect';
    bowCharge.style.left = percent(bowPoint.x);
    bowCharge.style.top = percent(bowPoint.y);
    refs.effects.append(bowCharge);
    schedule(() => bowCharge.remove(), YAMATO_FULL_BARRAGE.duration + 80);
    const bowFlash = document.createElement('i');
    bowFlash.className = 'fx-yamato-bow-flash';
    bowFlash.style.left = percent(bowPoint.x);
    bowFlash.style.top = percent(bowPoint.y);
    refs.effects.append(bowFlash);
    schedule(() => bowFlash.remove(), 300);
    for (let shot = 0; shot < YAMATO_FULL_BARRAGE.duration / YAMATO_CANNON.shotInterval; shot += 1) {
      schedule(() => {
        if (!ally.dead && state?.status === 'combat') fireYamatoCannon(ally, shot % YAMATO_CANNON.shots, true);
      }, shot * YAMATO_CANNON.shotInterval);
    }
    for (let salvo = 0; salvo < YAMATO_FULL_BARRAGE.missileSalvos; salvo += 1) {
      schedule(() => {
        if (ally.dead || state?.status !== 'combat') return;
        const targets = shooterTargetsFor(ally);
        if (!targets.length) return;
        [-1, 1].forEach(side => {
          const target = targets[Math.floor(Math.random() * targets.length)];
          launchYamatoMissile(ally, yamatoMissileMuzzle(ally, side), target);
        });
      }, salvo * YAMATO_FULL_BARRAGE.missileInterval);
    }
    schedule(() => {
      ally.el?.classList.remove('yamato-full-barrage');
    }, YAMATO_FULL_BARRAGE.duration);
    if (!options.keepCharging) {
      schedule(() => {
        ally.charging = false;
      }, YAMATO_FULL_BARRAGE.duration + YAMATO_FULL_BARRAGE.cooldown);
    }
    if (typeof options.onComplete === 'function') {
      schedule(options.onComplete, YAMATO_FULL_BARRAGE.duration + 40);
    }
    return true;
  }

  // 최후의 저항(5성, 전투당 1회): 치명적 피해를 입으면 쓰러지지 않고 전장에 10초간 남는다.
  // 그 10초 동안은 공격 대상이 되지 않고 일반공격만 하며, 끝나면 전집중!을 발동한 뒤 퇴각한다.
  const YAMATO_LAST_STAND = { duration: 10000 };
  function triggerYamatoLastStand(ally) {
    if (!ally || ally.yamatoLastStandUsed || ally.yamatoStars < 5) return false;
    ally.yamatoLastStandUsed = true;
    ally.hp = 0;
    ally.dead = true;
    ally.yamatoLastStandActive = true;
    ally.el?.classList.add('yamato-last-stand');
    if (ally.energy !== null) {
      ally.energy = 0;
      updateBattlecruiserEnergy(ally);
    }
    announce(`${ally.ship.name} · 최후의 저항`, 'friendly');
    // 10초 동안 일반공격(함포)을 계속한다. 공격 대상이 되지 않도록 dead 상태로 두고, 발사만 직접 호출한다.
    const interval = (YAMATO_CANNON.shots - 1) * YAMATO_CANNON.shotInterval + YAMATO_CANNON.reload;
    for (let elapsed = 0; elapsed < YAMATO_LAST_STAND.duration; elapsed += interval) {
      schedule(() => {
        if (!state || state.status !== 'combat' || !ally.yamatoLastStandActive) return;
        fireYamatoCannonCycle(ally);
      }, elapsed);
    }
    // 10초가 끝나면 다시 전장의 함선으로 돌아와 전집중!을 쏘고 퇴각한다.
    schedule(() => {
      if (!state || state.status !== 'combat') return;
      ally.yamatoLastStandActive = false;
      ally.dead = false;
      ally.el?.classList.remove('yamato-last-stand');
      const started = fireYamatoFullBarrage(ally, {
        keepCharging: true,
        onComplete: () => retreatAlly(ally)
      });
      if (!started) retreatAlly(ally);
    }, YAMATO_LAST_STAND.duration);
    return true;
  }

  function fireBattlecruiserMainBattery(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    const auxUnlocked = ally.isStarCruiser && ally.starCruiserStars >= 3;
    const ultimateUnlocked = ally.isStarCruiser && ally.starCruiserStars >= 5;
    const shotCount = ultimateUnlocked ? BATTLECRUISER_MAIN_BATTERY.empoweredShots : 1;
    const sequenceDuration = BATTLECRUISER_MAIN_BATTERY.charge + (shotCount - 1) * BATTLECRUISER_MAIN_BATTERY.empoweredShotInterval + BATTLECRUISER_MAIN_BATTERY.travel;
    ally.el.classList.add('battlecruiser-main-firing');
    if (ultimateUnlocked) ally.charging = true;
    if (ally.isStarCruiser) ally.facingLockUntil = performance.now() + BATTLECRUISER_MAIN_BATTERY.charge + BATTLECRUISER_MAIN_BATTERY.travel + 90;
    if (ally.isStarCruiser) playPhotonChargeSound();
    launchPhotonCharge(orientedAllyPoint(ally, 0, -.105));
    announce(`${ally.ship.name} · ${ultimateUnlocked ? '3연광자포' : auxUnlocked ? '중광자포' : '주포 발동'}`, 'friendly');
    for (let shot = 0; shot < shotCount; shot += 1) {
      schedule(() => {
        const liveTarget = target && !target.dead ? target : shooterTargetFor(ally);
        if (!liveTarget || ally.dead) return;
        const muzzleX = ally.isStarCruiser ? (((ally.starCruiserMuzzleIndex = ((ally.starCruiserMuzzleIndex || 0) + 1) % 2) === 0) ? -.024 : .024) : 0;
        const muzzle = orientedAllyPoint(ally, muzzleX, -.105);
        const targetPoint = pointOf(liveTarget);
        if (ally.isStarCruiser) playPhotonShotSound();
        launchPhotonShell(muzzle, targetPoint);
      schedule(() => {
        const impactTarget = liveTarget && !liveTarget.dead ? liveTarget : shooterTargetFor(ally);
        const impactPoint = impactTarget ? pointOf(impactTarget) : targetPoint;
        if (impactTarget) {
          shooterDamage(impactTarget, BATTLECRUISER_MAIN_BATTERY.hits, ally);
          if (auxUnlocked) {
            const field = refs.field.getBoundingClientRect();
            hostileTargetsFor(ally).filter(candidate => candidate !== impactTarget && !candidate.dead &&
              Math.hypot((candidate.x - impactPoint.x) * field.width, (candidate.y - impactPoint.y) * field.height) <= BATTLECRUISER_MAIN_BATTERY.photonSplashRadius)
              .forEach(candidate => shooterDamage(candidate, BATTLECRUISER_MAIN_BATTERY.hits, ally));
          }
        }
        createPlasmaCannonImpact(impactPoint, impactTarget?.kind === 'boss' || liveTarget?.kind === 'boss');
        createExplosion(impactPoint, 'photon');
      }, BATTLECRUISER_MAIN_BATTERY.travel);
      }, BATTLECRUISER_MAIN_BATTERY.charge + shot * BATTLECRUISER_MAIN_BATTERY.empoweredShotInterval);
    }
    schedule(() => {
      ally.charging = false;
      ally.el?.classList.remove('battlecruiser-main-firing');
    }, sequenceDuration + 90);
    return true;
  }

  function fireIowaCannon(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    const muzzleIndex = ally.iowaMuzzleIndex || 0;
    ally.iowaMuzzleIndex = (muzzleIndex + 1) % 8;
    const muzzle = iowaMuzzlePoint(ally, muzzleIndex);
    drawIowaMuzzleFlash(muzzle, 'iowa');
    schedule(() => {
      if (target && !target.dead) {
        shooterDamage(target, IOWA_CANNON.hits, ally, 'cannon');
        createExplosion(pointOf(target), 'cannon');
      }
    }, 90);
    return true;
  }

  function fireTankElectric(ally) {
    const primary = shooterTargetFor(ally);
    if (!primary) return false;
    const sequence = [primary];
    let source = primary;
    while (sequence.length < TANK_ELECTRIC.maxTargets) {
      const next = inRangeTargetsFor(ally)
        .filter(target => !sequence.includes(target))
        .sort((a, b) => Math.hypot(a.x - source.x, a.y - source.y) - Math.hypot(b.x - source.x, b.y - source.y))[0];
      if (!next) break;
      sequence.push(next);
      source = next;
    }
    sequence.forEach((target, index) => {
      const from = index === 0 ? orientedAllyPoint(ally, 0, -.04) : pointOf(sequence[index - 1]);
      drawAtlasElectric(from, pointOf(target));
      schedule(() => {
        if (target.dead) return;
        const hits = Math.max(1, Math.round(TANK_ELECTRIC.hits * Math.pow(.5, index)));
        shooterDamage(target, hits, ally, 'electric');
        if (target.dead) return;
        target.el?.classList.add('atlas-electrified');
        schedule(() => target.el?.classList.remove('atlas-electrified'), 420);
        if (ally.tankStars >= 5) applyTankElectricStun(target);
      }, TANK_ELECTRIC.travel);
    });
    return true;
  }

  function applyTankElectricStun(target) {
    target.stun = Math.max(Number(target.stun) || 0, TANK_ELECTRIC.stun);
    target.tankElectricStunUntil = performance.now() + TANK_ELECTRIC.stun;
    target.el?.classList.add('stunned', 'tank-electrified');
    schedule(() => {
      if (performance.now() < Number(target.tankElectricStunUntil || 0)) return;
      target.el?.classList.remove('tank-electrified');
      if (Number(target.stun || 0) <= 0) target.el?.classList.remove('stunned');
    }, TANK_ELECTRIC.stun + 50);
  }

  function dozerMuzzlePoint(ally, index) {
    const ports = [
      { x: -.055, y: -.006, angle: 0 },
      { x: .055, y: -.006, angle: Math.PI },
      { x: -.024, y: .072, angle: Math.PI * 1.5 },
      { x: .024, y: .072, angle: Math.PI * 1.5 }
    ];
    const port = ports[index % ports.length];
    return { point: orientedAllyPoint(ally, port.x, port.y), angle: ally.facingAngle + port.angle };
  }

  function fireDozerCannon(ally, index) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    const muzzle = dozerMuzzlePoint(ally, index);
    drawIowaMuzzleFlash(muzzle.point, 'dozer-cannon', muzzle.angle);
    schedule(() => {
      if (!target.dead) {
        shooterDamage(target, DOZER_CANNON.hits, ally, 'cannon');
        createExplosion(pointOf(target), 'cannon');
      }
    }, DOZER_CANNON.travel);
    return true;
  }

  function fireDozerCannonCycle(ally) {
    for (let index = 0; index < DOZER_CANNON.ports; index += 1) {
      schedule(() => {
        if (!ally.dead) fireDozerCannon(ally, (ally.dozerCannonIndex + index) % DOZER_CANNON.ports);
      }, index * DOZER_CANNON.interval);
    }
    ally.dozerCannonIndex = (ally.dozerCannonIndex + 1) % DOZER_CANNON.ports;
    return true;
  }

  function fireDozerEvasiveManeuver(ally) {
    if (!ally || ally.dead) return false;
    const now = performance.now();
    ally.dozerEvasionUntil = now + DOZER_EVASION.duration;
    ally.el?.classList.add('dozer-evasive');
    schedule(() => ally.el?.classList.remove('dozer-evasive'), DOZER_EVASION.duration);
    if (ally.dozerStars >= 5) {
      const targets = hostileTargetsFor(ally)
        .sort((left, right) => Math.hypot(left.x - ally.x, left.y - ally.y) - Math.hypot(right.x - ally.x, right.y - ally.y))
        .slice(0, DOZER_EVASION.decoyTargets);
      ally.dozerDecoyUntil = ally.dozerEvasionUntil;
      targets.forEach(enemy => {
        enemy.forcedTarget = ally;
        enemy.forcedTargetUntil = ally.dozerEvasionUntil;
        enemy.el?.classList.add('tank-taunted');
        schedule(() => {
          if (enemy.forcedTarget === ally && performance.now() >= enemy.forcedTargetUntil) enemy.forcedTarget = null;
          if (performance.now() >= ally.dozerEvasionUntil) enemy.el?.classList.remove('tank-taunted');
        }, DOZER_EVASION.duration + 40);
      });
      announce(`${ally.ship.name} · 디코이 · 적 ${targets.length}기 도발`, 'friendly');
    } else {
      announce(`${ally.ship.name} · 회피기동`, 'friendly');
    }
    return true;
  }

  function cleanseTankStatuses(ally) {
    clearFireDust(ally);
    ally.corrosionGeneration = Number(ally.corrosionGeneration || 0) + 1;
    ally.corrosionStacks = 0;
    ally.stun = 0;
    if (ally.el) {
      ally.el.dataset.corrosionStacks = '0';
      ally.el.classList.remove('monster-corroding', 'stunned', 'hammer-stunned', 'nemesis-net-active', 'science-drone-emp-stunned', 'fire-dusted');
    }
    ally.nemesisNetActive = false;
  }

  function fireTankPetrification(ally) {
    if (!ally || ally.dead) return false;
    const now = performance.now();
    const immunity = ally.tankStars >= 3 ? TANK_PETRIFICATION.enhancedImmunity : TANK_PETRIFICATION.immunity;
    cleanseTankStatuses(ally);
    ally.tankImmuneUntil = now + immunity;
    ally.tankReducedFrom = ally.tankImmuneUntil;
    ally.tankReducedUntil = ally.tankReducedFrom + TANK_PETRIFICATION.reduction;
    ally.tankReductionRatio = ally.tankStars >= 3 ? TANK_PETRIFICATION.enhancedReductionRatio : TANK_PETRIFICATION.reductionRatio;
    ally.el?.classList.add('tank-petrified', 'tank-immune');
    announce(`${ally.ship.name} · ${ally.tankStars >= 3 ? '암석화' : '석화'}`, 'friendly');
    hostileTargetsFor(ally).forEach(enemy => {
      enemy.forcedTarget = ally;
      enemy.forcedTargetUntil = now + TANK_PETRIFICATION.taunt;
      enemy.el?.classList.add('tank-taunted');
      schedule(() => {
        if (enemy.forcedTarget === ally && performance.now() >= enemy.forcedTargetUntil) enemy.forcedTarget = null;
        if (performance.now() >= now + TANK_PETRIFICATION.taunt) enemy.el?.classList.remove('tank-taunted');
      }, TANK_PETRIFICATION.taunt + 40);
    });
    schedule(() => {
      if (performance.now() >= ally.tankImmuneUntil) ally.el?.classList.remove('tank-immune');
    }, immunity + 40);
    schedule(() => {
      if (performance.now() >= ally.tankReducedUntil) ally.el?.classList.remove('tank-petrified');
    }, immunity + TANK_PETRIFICATION.reduction + 40);
    return true;
  }

  function fireAngelaCannon(ally, target) {
    if (!target || target.dead) return;
    const muzzle = orientedAllyPoint(ally, 0, -.018);
    drawIowaMuzzleFlash(muzzle, 'angela-cannon', ally.facingAngle + Math.PI / 2);
    schedule(() => {
      if (!target.dead) {
        shooterDamage(target, ANGELA_CANNON.hits, ally, 'cannon');
        createExplosion(pointOf(target), 'cannon');
      }
    }, ANGELA_CANNON.travel);
  }

  function fireAngelaCannonBurst(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    for (let index = 0; index < ANGELA_CANNON.shots; index += 1) {
      schedule(() => {
        const liveTarget = target && !target.dead ? target : shooterTargetFor(ally);
        if (!ally.dead && liveTarget) fireAngelaCannon(ally, liveTarget);
      }, index * ANGELA_CANNON.shotInterval);
    }
    return true;
  }

  function applyAngelaShield(ally, amount) {
    if (ally?.isArenaShip && !ally.dead) { setArenaEnemyShield(ally, amount); return; }
    if (!ally || ally.dead || !ally.el) return;
    ally.shieldEl?.remove();
    ally.shield = amount;
    ally.shieldEl = null;
    ally.angelaShieldActive = true;
    if (ally.isAngela) ally.el.classList.add('angel-wing-blessing');
  }

  // 대검이 발사될 때 앙헬라 뱃머리에서 터지는 섬광
  function angelaSwordMuzzleFlash(ally, angle) {
    const muzzle = orientedAllyPoint(ally, 0, -.105);
    const flash = document.createElement('i');
    flash.className = 'fx-angela-muzzle';
    flash.style.left = percent(muzzle.x);
    flash.style.top = percent(muzzle.y);
    flash.style.setProperty('--angela-angle', `${angle}rad`);
    refs.effects.append(flash);
    schedule(() => flash.remove(), 460);
  }

  // 징벌의 칼(5성): 뱃머리에서 대검 한 자루를 날린다. 페가수스의 창과 같은 방식으로 날아가며 닿은 적을 관통한다.
  function launchAngelaSword(ally) {
    if (ally.dead || state.status !== 'combat') return;
    const field = refs.field?.getBoundingClientRect();
    if (!field?.width || !field?.height) return;
    const angle = ally.facingAngle - Math.PI / 2;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const muzzle = orientedAllyPoint(ally, 0, -.105);
    const start = { x: muzzle.x * field.width, y: muzzle.y * field.height };
    const ahead = pegasusRayToEdge(start.x, start.y, dx, dy, field.width, field.height) + 80;
    const sword = document.createElement('i');
    sword.className = 'fx-angela-sword';
    sword.style.left = `${start.x}px`;
    sword.style.top = `${start.y}px`;
    sword.style.setProperty('--angela-angle', `${angle}rad`);
    refs.effects.append(sword);
    state.angelaSwords.push({ el: sword, owner: ally, start, dx, dy, distance: ahead, elapsed: 0, hit: new Set() });
    angelaSwordMuzzleFlash(ally, angle);
    playPenetrateBeamSound();
  }

  function updateAngelaSwords(dt) {
    if (!state?.angelaSwords?.length) return;
    state.angelaSwords = state.angelaSwords.filter(sword => {
      if (state.status !== 'combat') {
        sword.el.remove();
        return false;
      }
      sword.elapsed = Math.min(ANGELA_SWORD.travel, sword.elapsed + dt);
      const tipDistance = sword.distance * sword.elapsed / ANGELA_SWORD.travel;
      sword.el.style.left = `${sword.start.x + sword.dx * tipDistance}px`;
      sword.el.style.top = `${sword.start.y + sword.dy * tipDistance}px`;
      const field = refs.field.getBoundingClientRect();
      for (const target of hostileTargetsFor(sword.owner)) {
        if (sword.hit.has(target) || target.dead) continue;
        const relativeX = target.x * field.width - sword.start.x;
        const relativeY = target.y * field.height - sword.start.y;
        const along = relativeX * sword.dx + relativeY * sword.dy;
        const bounds = target.el?.getBoundingClientRect();
        const radius = Math.min(48, Math.max(bounds?.width || 18, bounds?.height || 18) * .35);
        if (along > tipDistance + radius || along < tipDistance - ANGELA_SWORD.length - radius) continue;
        const offset = Math.abs(relativeX * sword.dy - relativeY * sword.dx);
        if (offset > ANGELA_SWORD.pierceWidth + radius * .5) continue;
        sword.hit.add(target);
        shooterDamage(target, ANGELA_SWORD.hits, sword.owner);
        createExplosion(pointOf(target), 'laser');
        if (state.status !== 'combat') break;
      }
      if (sword.elapsed < ANGELA_SWORD.travel && state.status === 'combat') return true;
      sword.el.remove();
      return false;
    });
  }

  function startAngelaJudgment(ally) {
    for (let shot = 0; shot * ANGELA_WING_EFFECT.judgmentInterval < ANGELA_WING_EFFECT.duration; shot += 1) {
      schedule(() => {
        if (!state || state.status !== 'combat' || ally.dead) return;
        launchAngelaSword(ally);
      }, shot * ANGELA_WING_EFFECT.judgmentInterval);
    }
  }

  function fireAngelaWings(ally) {
    if (!ally || ally.dead) return false;
    playAngelaShieldSound();
    const now = performance.now();
    const enhanced = ally.angelaStars >= 3;
    const immunity = enhanced ? ANGELA_WING_EFFECT.enhancedImmunity : ANGELA_WING_EFFECT.immunity;
    const shield = enhanced ? ANGELA_WING_EFFECT.enhancedShield : ANGELA_WING_EFFECT.shield;
    const allies = friendliesOf(ally);
    allies.forEach(candidate => {
      cleanseTankStatuses(candidate);
      candidate.angelaImmuneUntil = now + immunity;
      applyAngelaShield(candidate, shield);
    });
    if (ally.angelaStars >= 5) startAngelaJudgment(ally);
    const targets = hostileTargetsFor(ally);
    targets.forEach(target => {
      target.forcedTarget = ally;
      target.forcedTargetUntil = now + ANGELA_WINGS.taunt;
      target.el?.classList.add('angela-taunted');
      schedule(() => {
        if (target.forcedTarget === ally && performance.now() >= target.forcedTargetUntil) target.forcedTarget = null;
        if (performance.now() >= now + ANGELA_WINGS.taunt) target.el?.classList.remove('angela-taunted');
      }, ANGELA_WINGS.taunt + 40);
    });
    targets.forEach((target, index) => schedule(() => {
      if (!ally.dead && !target.dead) fireAngelaCannon(ally, target);
    }, index * ANGELA_WINGS.cannonInterval));
    ally.el.classList.remove('angela-judgment-active');
    void ally.el.offsetWidth;
    ally.el.classList.add('angela-judgment-active');
    schedule(() => ally.el.classList.remove('angela-judgment-active'), ANGELA_WINGS.bladeDuration);
    announce(`${ally.ship.name} · 천사의 날개`, 'friendly');
    return true;
  }

  function suPanokseonMuzzlePoint(ally, index, side = 0) {
    const row = Math.floor(index / 2);
    const lane = side || (index % 2 ? 1 : -1);
    return orientedAllyPoint(ally, lane * .049, -.103 + row * .031);
  }

  function hitSuPanokseonCannon(ally, target, damage) {
    if (target.dead) return;
    const impact = pointOf(target);
    shooterDamage(target, damage, ally, 'cannon');
    createExplosion(impact, 'cannon');
    if (ally.suPanokseonStars < 3) return;
    const rect = refs.field?.getBoundingClientRect();
    const width = rect?.width || 480;
    const height = rect?.height || 720;
    const next = hostileTargetsFor(ally)
      .filter(enemy => enemy !== target)
      .map(enemy => ({ enemy, distance: Math.hypot((enemy.x - impact.x) * width, (enemy.y - impact.y) * height) }))
      .filter(candidate => candidate.distance <= 120)
      .sort((a, b) => a.distance - b.distance)[0]?.enemy;
    if (!next) return;
    const beam = document.createElement('i');
    beam.className = 'fx-line supanokseon-ricochet';
    positionLine(beam, impact, pointOf(next));
    refs.effects?.append(beam);
    schedule(() => beam.remove(), 220);
    schedule(() => {
      if (next.dead) return;
      shooterDamage(next, damage, ally, 'cannon');
      createExplosion(pointOf(next), 'cannon');
    }, 130);
  }

  function fireSuPanokseonCannon(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    const index = ally.suPanokseonMuzzleIndex || 0;
    ally.suPanokseonMuzzleIndex = (index + 1) % 10;
    drawIowaMuzzleFlash(suPanokseonMuzzlePoint(ally, index), 'supanokseon-front');
    schedule(() => {
      hitSuPanokseonCannon(ally, target, SUPANOKSEON_CANNON.hits);
    }, SUPANOKSEON_CANNON.travel);
    return true;
  }

  function kddxMuzzlePoint(ally) {
    return orientedAllyPoint(ally, 0, -.045);
  }

  function fireKddxLaser(ally) {
    const target = weakestEnemyTarget(ally);
    if (!target) return false;
    playLaserZapSound();
    const muzzle = kddxMuzzlePoint(ally);
    drawBattlecruiserBeam(muzzle, pointOf(target));
    schedule(() => {
      if (!target.dead) {
        shooterDamage(target, KDDX_LASER.hits);
        createExplosion(pointOf(target), 'laser');
      }
    }, KDDX_LASER.travel);
    return true;
  }

  function drawPlanetDestroyerLaser(from, to) {
    const beam = document.createElement('i');
    beam.className = 'fx-line planet-destroyer-normal-laser';
    positionLine(beam, from, to);
    refs.effects.append(beam);
    schedule(() => beam.remove(), 180);
  }

  function pandoraMuzzlePoint(ally, localX, localY) {
    return pegasusMuzzlePoint(ally, localX, localY);
  }

  function pandoraSideMuzzlePoints(ally) {
    return [-28, 28].map(x => pandoraMuzzlePoint(ally, x, 4));
  }

  function launchPandoraMissile(ally, from, target, damage, torpedo = false) {
    if (!target || target.dead) return;
    const to = pointOf(target);
    const missile = document.createElement('i');
    missile.className = `fx-missile pandora-missile${torpedo ? ' pandora-torpedo' : ''}`;
    positionProjectile(missile, from, to);
    refs.effects.append(missile);
    const travel = torpedo ? PANDORA_MAIN.travel : PANDORA_ATTACK.missileTravel;
    schedule(() => missile.remove(), travel + 160);
    schedule(() => {
      if (state.status !== 'combat') return;
      if (!target.dead) shooterDamage(target, damage, ally, 'missile');
      if(torpedo)playMissileImpactSound();
      createExplosion(to, torpedo ? 'electric' : 'missile');
    }, travel);
  }

  function firePandoraNormalAttack(ally) {
    const target = weakestEnemyTarget(ally);
    if (!target) return false;
    const mode = ally.pandoraAttackIndex % 3;
    ally.pandoraAttackIndex += 1;
    if (mode === 0) {
      pandoraSideMuzzlePoints(ally).forEach(from => launchPandoraMissile(ally, from, target, PANDORA_ATTACK.missileHits));
    } else if (mode === 1) {
      const from = pandoraMuzzlePoint(ally, 0, -67);
      playCruiserLaserSound();
      const beam = document.createElement('i');
      beam.className = 'fx-line pandora-laser';
      positionLine(beam, from, pointOf(target));
      refs.effects.append(beam);
      shooterDamage(target, PANDORA_ATTACK.laserHits, ally, 'laser');
      schedule(() => beam.remove(), 190);
    } else {
      [-11, 11].forEach((x, index) => {
        const from = pandoraMuzzlePoint(ally, x, -29);
        drawIowaMuzzleFlash(from, 'pandora-cannon', ally.facingAngle);
        schedule(() => { if (!target.dead) shooterDamage(target, PANDORA_ATTACK.cannonHits, ally, 'cannon'); }, 90 + index * 35);
      });
    }
    ally.el?.classList.add('pandora-missile-firing');
    schedule(() => ally.el?.classList.remove('pandora-missile-firing'), 260);
    return true;
  }

  function varyagDeckMuzzle(ally, index) {
    const ports = [-.052, 0, .052];
    return orientedAllyPoint(ally, ports[index % ports.length], -.032);
  }

  function launchVaryagMissile(ally, from, target) {
    if (!target || target.dead) return;
    const to = pointOf(target);
    const missile = document.createElement('i');
    missile.className = 'fx-missile varyag-missile';
    positionProjectile(missile, from, to);
    refs.effects.append(missile);
    schedule(() => missile.remove(), VARYAG_MISSILE.travel + 160);
    schedule(() => {
      if (state.status !== 'combat') return;
      const field = refs.field.getBoundingClientRect();
      createExplosion(to, 'missile');
      const splash = document.createElement('i');
      splash.className = 'fx-varyag-splash';
      splash.style.left = percent(to.x);
      splash.style.top = percent(to.y);
      refs.effects.append(splash);
      schedule(() => splash.remove(), 380);
      // 폭발 범위 대상: 아군은 적(몬스터), 아레나 상대 함선은 아군을 고른다.
      const splashTargets = ally.isArenaShip ? state.allies.filter(candidate => !candidate.dead) : hostileTargetsFor(ally);
      splashTargets.filter(candidate => Math.hypot((candidate.x - to.x) * field.width, (candidate.y - to.y) * field.height) <= VARYAG_MISSILE.splashRadius)
        .forEach(candidate => shooterDamage(candidate, Math.round(VARYAG_MISSILE.hits * (ally.varyagStars >= 5 ? VARYAG_MISSILE.valorDamage : 1)), ally, 'missile'));
    }, VARYAG_MISSILE.travel);
  }

  function fireVaryagMissiles(ally) {
    const target = shooterTargetsFor(ally)[0];
    if (!target) return false;
    faceAllyTowardTarget(ally, target);
    ally.varyagPort = ((ally.varyagPort || 0) + 1) % 3;
    launchVaryagMissile(ally, varyagDeckMuzzle(ally, ally.varyagPort), target);
    ally.el?.classList.add('varyag-missile-firing');
    schedule(() => ally.el?.classList.remove('varyag-missile-firing'), 160);
    return true;
  }

  function garudaMuzzle(ally, side, index = 0) {
    return orientedAllyPoint(ally, side * (.105 + (index % 3) * .004), -.016 + Math.floor(index / 3) * .008);
  }

  function launchGarudaMissile(ally, target, from, hits) {
    if (!target || target.dead || !state || state.status !== 'combat') return;
    const destination = pointOf(target);
    const missile = document.createElement('i');
    missile.className = 'fx-missile garuda-missile';
    positionProjectile(missile, from, destination);
    refs.effects.append(missile);
    schedule(() => {
      missile.remove();
      if (!target.dead && state?.status === 'combat') {
        shooterDamage(target, hits, ally, 'missile');
        createExplosion(pointOf(target), 'missile');
      }
    }, GARUDA_MISSILE.travel);
  }

  function garudaShotDamage(ally, ratio = 1) {
    const enhanced = Number(ally.garudaStars || 0) >= 3 ? 1.2 : 1;
    return Math.round(GARUDA_MISSILE.hits * enhanced * ratio);
  }

  function fireGarudaMissilePair(ally, ratio = 1) {
    const target = shooterTargetsFor(ally)[0];
    if (!target) return false;
    faceAllyTowardTarget(ally, target);
    [-1, 1].forEach((side, index) => launchGarudaMissile(ally, target, garudaMuzzle(ally, side), garudaShotDamage(ally, ratio)));
    ally.el?.classList.add('garuda-missile-firing');
    schedule(() => ally.el?.classList.remove('garuda-missile-firing'), 260);
    return true;
  }

  function fireGarudaGuardian(ally) {
    const targets = shooterTargetsFor(ally);
    if (!targets.length) return false;
    const firstTarget = targets[0];
    faceAllyTowardTarget(ally, firstTarget);
    for (let index = 0; index < GARUDA_MISSILE.guardianCount; index += 1) {
      const target = targets[Math.floor(Math.random() * targets.length)];
      const side = index % 2 ? 1 : -1;
      launchGarudaMissile(ally, target, garudaMuzzle(ally, side, index), garudaShotDamage(ally));
    }
    ally.el?.classList.add('garuda-guardian-firing');
    schedule(() => ally.el?.classList.remove('garuda-guardian-firing'), 650);
    if (ally.garudaStars >= 5) summonGarudaWingmen(ally);
    announce('가루다 · 수호자', 'friendly');
    return true;
  }

  function summonGarudaWingmen(owner) {
    if (!state || state.status !== 'combat' || !owner || owner.dead) return;
    const livingWingmen = (state.garudaWingmen || []).filter(wingman => !wingman.dead && wingman.owner === owner);
    const slots = [-1, 1].filter(side => !livingWingmen.some(wingman => wingman.wingSide === side));
    if (slots.length && livingWingmen.length < 2) summonGarudaWingman(owner, slots[0]);
  }

  function summonGarudaWingman(owner, side) {
    const wingman = {
      id: `garuda-wingman-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ship: { name: '우파가루다', type: owner.ship?.type, rarity: owner.ship?.rarity }, owner, isGarudaWingman: true, garudaStars: owner.garudaStars, wingSide: side,
      x: Math.max(.05, Math.min(.95, owner.x + side * .115)), y: owner.y - .015,
      hp: Math.round(owner.maxHp * GARUDA_MISSILE.wingmanHpRatio),
      maxHp: Math.round(owner.maxHp * GARUDA_MISSILE.wingmanHpRatio),
      nextShot: 0, dead: false, shield: 0
    };
    const element = document.createElement('div');
    element.className = 'ally-unit garuda-wingman garuda-wingman-arriving';
    element.style.left = percent(wingman.x);
    element.style.top = percent(wingman.y);
    element.style.setProperty('--rarity-color', RARITY_COLORS[owner.ship.rarity] || RARITY_COLORS.R);
    element.innerHTML = '<div class="ally-facing-shell"><div class="ship-topview garuda-topview"><img src="garuda-codex.png" alt="" /></div></div><div class="ally-info"><b>우파가루다</b><span class="ally-health"><i></i></span></div>';
    wingman.el = element;
    wingman.facingShell = element.querySelector('.ally-facing-shell');
    wingman.healthBar = element.querySelector('.ally-health i');
    refs.allyLayer.append(element);
    state.garudaWingmen.push(wingman);
    requestAnimationFrame(() => element.classList.remove('garuda-wingman-arriving'));
    // 수호자의 미사일 포화를 능력치 30%로 한 차례 계승한다.
    const targets = shooterTargetsFor(wingman);
    for (let index = 0; index < GARUDA_MISSILE.guardianCount && targets.length; index += 1) {
      const target = targets[Math.floor(Math.random() * targets.length)];
      launchGarudaMissile(wingman, target, garudaMuzzle(wingman, index % 2 ? 1 : -1, index), garudaShotDamage(wingman, GARUDA_MISSILE.wingmanDamageRatio));
    }
  }

  function updateGarudaWingmen(dt) {
    for (const wingman of state.garudaWingmen || []) {
      if (wingman.dead) continue;
      if (wingman.owner && !wingman.owner.dead) {
        wingman.x = Math.max(.05, Math.min(.95, wingman.owner.x + wingman.wingSide * .115));
        wingman.y = wingman.owner.y - .02;
        wingman.el.style.left = percent(wingman.x);
        wingman.el.style.top = percent(wingman.y);
        faceAllyTowardTarget(wingman, shooterTargetsFor(wingman)[0]);
      }
      wingman.nextShot -= dt;
      if (wingman.nextShot <= 0) {
        wingman.nextShot = GARUDA_MISSILE.wingmanInterval;
        fireGarudaMissilePair(wingman, GARUDA_MISSILE.wingmanDamageRatio);
      }
    }
    state.garudaWingmen = (state.garudaWingmen || []).filter(wingman => !wingman.dead || wingman.el?.isConnected);
  }

  function varyagDroneMuzzle(ally, side, index) {
    return orientedAllyPoint(ally, side * (.086 + index * .006), -.005 + index * .025);
  }

  function varyagDroneTarget(ally) {
    const targets = inRangeTargetsFor(ally);
    return targets[Math.floor(Math.random() * targets.length)] || null;
  }

  function launchVaryagSuicideDrone(ally, from, target) {
    if (!target || target.dead) return;
    playVaryagDroneSound();
    const drone = document.createElement('i');
    const laser = document.createElement('i');
    drone.className = 'fx-varyag-suicide-drone';
    laser.className = 'fx-line varyag-tracking-laser';
    let origin = { x: from.x, y: from.y };
    let goal = pointOf(target);
    let current = origin;
    let legStart = performance.now();
    let legDuration = VARYAG_DRONE.travel;
    let finished = false;
    drone.style.left = percent(from.x);
    drone.style.top = percent(from.y);
    drone.style.setProperty('--drone-angle', `${Math.atan2(goal.y - from.y, goal.x - from.x) + Math.PI / 2}rad`);
    refs.effects.append(laser, drone);
    const detonate = () => {
      finished = true;
      drone.remove();
      laser.remove();
      if (ally.dead || state.status !== 'combat') return;
      createExplosion(current, 'missile');
      hostileTargetsFor(ally).filter(candidate => !candidate.dead && Math.hypot(candidate.x - current.x, candidate.y - current.y) <= VARYAG_DRONE.radius)
        .forEach(candidate => shooterDamage(candidate, VARYAG_DRONE.hits, ally));
    };
    const trackTarget = () => {
      if (finished) return;
      if (!drone.isConnected || state.status !== 'combat') {
        finished = true;
        drone.remove();
        laser.remove();
        return;
      }
      const now = performance.now();
      if (target.dead) {
        // 이동 중 대상이 사라지면 곧바로 살아 있는 다른 대상 중 무작위로 바꿔 계속 날아간다(남은 대상이 없으면 마지막 위치로).
        const alive = hostileTargetsFor(ally).filter(candidate => !candidate.dead);
        if (alive.length) {
          const remaining = Math.max(700, legDuration - (now - legStart) * battleSpeed);
          target = alive[Math.floor(Math.random() * alive.length)];
          origin = { x: current.x, y: current.y };
          legStart = now;
          legDuration = remaining;
        }
      }
      if (!target.dead) goal = pointOf(target);
      const progress = Math.min(1, (now - legStart) * battleSpeed / legDuration);
      current = { x: origin.x + (goal.x - origin.x) * progress, y: origin.y + (goal.y - origin.y) * progress };
      drone.style.left = percent(current.x);
      drone.style.top = percent(current.y);
      drone.style.setProperty('--drone-angle', `${Math.atan2(goal.y - current.y, goal.x - current.x) + Math.PI / 2}rad`);
      positionLine(laser, current, goal);
      if (progress >= 1) detonate();
      else requestAnimationFrame(trackTarget);
    };
    requestAnimationFrame(trackTarget);
  }

  function fireVaryagSuicideDrones(ally) {
    if (!inRangeTargetsFor(ally).length) return false;
    ally.charging = false;
    ally.el?.classList.add('varyag-drone-launching');
    announce(`${ally.ship.name} · 자폭드론 편대`, 'friendly');
    [-1, 1].forEach(side => {
      for (let index = 0; index < VARYAG_DRONE.perSide + (ally.varyagStars >= 3 ? 1 : 0); index += 1) {
        schedule(() => {
          if (ally.dead || state.status !== 'combat') return;
          const target = varyagDroneTarget(ally);
          if (target) launchVaryagSuicideDrone(ally, varyagDroneMuzzle(ally, side, index), target);
        }, (index + (side > 0 ? .35 : 0)) * VARYAG_DRONE.launchInterval);
      }
    });
    schedule(() => ally.el?.classList.remove('varyag-drone-launching'), VARYAG_DRONE.launchInterval * (VARYAG_DRONE.perSide + (ally.varyagStars >= 3 ? 1 : 0)));
    return true;
  }

  function firePandoraTorpedoes(ally) {
    const target = weakestEnemyTarget(ally);
    if (!target) return false;
    faceAllyTowardTarget(ally, target);
    ally.charging = true;
    ally.el?.classList.add('pandora-main-charging');
    announce(`${ally.ship.name} · 뇌격미사일`, 'friendly');
    if (ally.pandoraStars >= 5) {
      ally.pandoraDespairActive = false;
      ally.pandoraFacingLocked = true;
      const from = pandoraMuzzlePoint(ally, 0, -67);
      const end = bladeBeamEnd(from, target);
      playCruiserLaserSound();
      const beam = document.createElement('i');
      beam.className = 'fx-line pandora-hope-laser';
      positionLine(beam, from, end);
      refs.effects.append(beam);
      [0, 1000].forEach(delay => schedule(() => {
        if (ally.dead || state.status !== 'combat') return;
        hostileTargetsFor(ally).filter(enemy => yamatoBeamTouchesTarget(enemy, from, end, 12))
          .forEach(enemy => shooterDamage(enemy, PANDORA_MAIN.hopeHitsPerSecond, ally, 'piercing'));
      }, delay));
      schedule(() => { beam.remove(); ally.pandoraFacingLocked = false; }, PANDORA_MAIN.charge);
    } else if (ally.pandoraStars >= 3) {
      const cost = Math.min(ally.hp - 1, Math.floor(ally.hp * .5));
      if (cost > 0) {
        ally.hp -= cost;
        ally.healthBar.style.width = `${ally.hp / ally.maxHp * 100}%`;
        showUnitDamage(ally, cost);
      }
      ally.pandoraDespairActive = true;
    }
    for (let pulse = 0; pulse < 5; pulse += 1) {
      schedule(() => {
        if (ally.dead || state.status !== 'combat') return;
        const side = pandoraMuzzlePoint(ally, pulse % 2 ? 28 : -28, 4);
        drawElectricStrike(side, pandoraMuzzlePoint(ally, 0, -67), pulse % 2 + 1, 190);
      }, pulse * 400);
    }
    schedule(() => {
      ally.el?.classList.remove('pandora-main-charging');
      if (ally.dead || state.status !== 'combat') { ally.charging = false; return; }
      const impactTarget = target.dead ? weakestEnemyTarget(ally) : target;
      if (!impactTarget) { ally.charging = false; return; }
      const impact = pointOf(impactTarget);
      pandoraSideMuzzlePoints(ally).forEach(from => launchPandoraMissile(ally, from, impactTarget, PANDORA_MAIN.missileHits, true));
      schedule(() => {
        if (state.status !== 'combat') return;
        const field = refs.field.getBoundingClientRect();
        const electricField = document.createElement('i');
        electricField.className = 'fx-pandora-electric-field';
        electricField.style.left = percent(impact.x);
        electricField.style.top = percent(impact.y);
        electricField.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i>';
        refs.effects.append(electricField);
        schedule(() => electricField.remove(), PANDORA_MAIN.burstDuration);
        hostileTargetsFor(ally).filter(enemy => Math.hypot((enemy.x - impact.x) * field.width, (enemy.y - impact.y) * field.height) <= PANDORA_MAIN.burstRadius)
          .forEach(enemy => shooterDamage(enemy, PANDORA_MAIN.burstHits, ally, 'electric'));
      }, PANDORA_MAIN.travel + PANDORA_MAIN.burstDelay);
      schedule(() => { ally.charging = false; }, PANDORA_MAIN.travel);
    }, PANDORA_MAIN.charge);
    return true;
  }

  function omegaMuzzlePoint(ally, localX = 0, localY = -66) {
    return pegasusMuzzlePoint(ally, localX, localY);
  }

  function omegaDenseTarget(ally) {
    const targets = inRangeTargetsFor(ally);
    const target = targets.slice().sort((a, b) => {
      const aCount = targets.filter(candidate => Math.hypot(candidate.x - a.x, candidate.y - a.y) <= .09).length;
      const bCount = targets.filter(candidate => Math.hypot(candidate.x - b.x, candidate.y - b.y) <= .09).length;
      return bCount - aCount;
    })[0] || null;
    faceAllyTowardTarget(ally, target);
    return target;
  }

  function omegaBeamEnd(from, angle) {
    return { x: from.x + Math.cos(angle) * 1.65, y: from.y + Math.sin(angle) * 1.65 };
  }

  function drawOmegaBeam(from, to, className, duration) {
    const beam = document.createElement('i');
    beam.className = `fx-line ${className}`;
    positionLine(beam, from, to);
    refs.effects.append(beam);
    schedule(() => beam.remove(), duration + 40);
    return beam;
  }

  function fireOmegaPiercingLasers(ally) {
    const target = omegaDenseTarget(ally);
    if (!target) return false;
    playPenetrateBeamSound();
    const from = omegaMuzzlePoint(ally);
    const heading = Math.atan2(target.y - from.y, target.x - from.x);
    const beams = [-OMEGA_LASER.spread, 0, OMEGA_LASER.spread].map(offset => {
      const angle = heading + offset;
      return { from, to: omegaBeamEnd(from, angle) };
    });
    beams.forEach(beam => drawOmegaBeam(beam.from, beam.to, 'omega-piercing-laser', OMEGA_LASER.duration));
    ally.omegaFacingLocked = true;
    ally.el?.classList.add('omega-piercing-firing');
    schedule(() => {
      ally.omegaFacingLocked = false;
      ally.el?.classList.remove('omega-piercing-firing');
    }, OMEGA_LASER.duration);
    for (let tick = 0; tick < OMEGA_LASER.duration; tick += OMEGA_LASER.tick) {
      schedule(() => {
        if (ally.dead || state.status !== 'combat') return;
        inRangeTargetsFor(ally).forEach(candidate => {
          if (beams.some(beam => distanceToBeam(pointOf(candidate), beam.from, beam.to) <= OMEGA_LASER.width)) shooterDamage(candidate, OMEGA_LASER.hits, ally);
        });
      }, tick);
    }
    return true;
  }

  function deimosMuzzlePoint(ally, side = 0) {
    return orientedAllyPoint(ally, side * .0255, -.039);
  }

  function fireDeimosCannon(ally) {
    const target = shooterTargetsFor(ally)[0];
    if (!target) return false;
    const side = ally.deimosCannonIndex ? 1 : -1;
    ally.deimosCannonIndex = ally.deimosCannonIndex ? 0 : 1;
    const muzzle = deimosMuzzlePoint(ally, side);
    drawIowaMuzzleFlash(muzzle, 'deimos-cannon', ally.facingAngle);
    schedule(() => {
      if (!target.dead) {
        shooterDamage(target, DEIMOS_CANNON.hits, ally, 'cannon');
        createExplosion(pointOf(target), 'cannon');
      }
    }, DEIMOS_CANNON.travel);
    return true;
  }

  function deimosShotgunTargets(ally, muzzle, target) {
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    const enhanced = ally.deimosStars >= 3 ? 1.3 : 1;
    const heading = Math.atan2((target.y - muzzle.y) * height, (target.x - muzzle.x) * width);
    return hostileTargetsFor(ally).filter(candidate => {
      const dx = (candidate.x - muzzle.x) * width;
      const dy = (candidate.y - muzzle.y) * height;
      const distance = Math.hypot(dx, dy);
      if (distance > DEIMOS_SHOTGUN.radius * enhanced) return false;
      const angle = Math.atan2(dy, dx);
      let delta = angle - heading;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      return Math.abs(delta) <= DEIMOS_SHOTGUN.cone * enhanced * .5;
    });
  }

  function deimosShotgunTarget(ally) {
    const muzzle = deimosMuzzlePoint(ally, 0);
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    const radius = DEIMOS_SHOTGUN.radius * (ally.deimosStars >= 3 ? 1.3 : 1);
    return shooterTargetsFor(ally).find(candidate => Math.hypot((candidate.x - muzzle.x) * width, (candidate.y - muzzle.y) * height) <= radius) || null;
  }

  function drawDeimosShotgunBurst(ally, from, target) {
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    const heading = Math.atan2((target.y - from.y) * height, (target.x - from.x) * width);
    const enhanced = ally.deimosStars >= 3 ? 1.3 : 1;
    const flameLength = DEIMOS_SHOTGUN.radius * enhanced;
    const flameWidth = flameLength * .4;
    const blast = document.createElement('i');
    blast.className = 'fx-deimos-shotgun-art';
    blast.style.left = percent(from.x);
    blast.style.top = percent(from.y);
    blast.style.width = `${flameWidth}px`;
    blast.style.height = `${flameLength}px`;
    blast.style.margin = `-${flameLength}px 0 0 -${flameWidth / 2}px`;
    blast.style.setProperty('--shotgun-art-angle', `${heading + Math.PI / 2}rad`);
    blast.innerHTML = '<img src="deimos-shotgun-blast.png" alt="" />';
    refs.effects.append(blast);
    schedule(() => blast.remove(), 1000);
  }

  function knockbackDeimosTarget(target, origin) {
    if (!target || target.dead) return;
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    const dx = (target.x - origin.x) * width;
    const dy = (target.y - origin.y) * height;
    const distance = Math.hypot(dx, dy) || 1;
    target.x = Math.max(.04, Math.min(.96, target.x + (dx / distance) * DEIMOS_SHOTGUN.knockback / width));
    target.y = Math.max(.08, Math.min(1.08, target.y + (dy / distance) * DEIMOS_SHOTGUN.knockback / height));
    target.el?.style.setProperty('left', percent(target.x));
    target.el?.style.setProperty('top', percent(target.y));
    target.el?.classList.add('deimos-knockback');
    schedule(() => target.el?.classList.remove('deimos-knockback'), 280);
  }

  function igniteDeimosTarget(ally, target, shotgunDamage) {
    const token = target.deimosBurnToken = (target.deimosBurnToken || 0) + 1;
    if (!target.deimosBurnFx && target.el) {
      const flame = document.createElement('i');
      flame.className = 'deimos-burn-flame';
      target.el.append(flame);
      target.deimosBurnFx = flame;
    }
    for (let tick = 1; tick <= 6; tick += 1) {
      schedule(() => {
        if (target.deimosBurnToken !== token || target.dead || state.status !== 'combat') return;
        const damage = Math.round(tick * shotgunDamage * .05) - Math.round((tick - 1) * shotgunDamage * .05);
        shooterDamage(target, damage, ally, 'fire');
        if (tick === 6 || target.dead) {
          target.deimosBurnFx?.remove();
          target.deimosBurnFx = null;
        }
      }, tick * 500);
    }
  }

  function fireDeimosShotgun(ally) {
    const target = deimosShotgunTarget(ally);
    if (!target) return false;
    ally.charging = true;
    ally.el?.classList.add('deimos-shotgun-firing');
    announce(`${ally.ship.name} · ${ally.deimosStars >= 5 ? '드래곤 브레스' : '샷건포'}`, 'friendly');
    for (let shot = 0; shot < DEIMOS_SHOTGUN.shots; shot += 1) {
      schedule(() => {
        if (ally.dead || state.status !== 'combat') return;
        const liveTarget = deimosShotgunTarget(ally) || target;
        if (!liveTarget || liveTarget.dead) return;
        const muzzle = deimosMuzzlePoint(ally, 0);
        playDeimosShotgunSound();
        drawDeimosShotgunBurst(ally, muzzle, liveTarget);
        const damage = Math.round(DEIMOS_SHOTGUN.hits * (ally.deimosStars >= 3 ? 1.3 : 1));
        deimosShotgunTargets(ally, muzzle, liveTarget).forEach(candidate => {
          shooterDamage(candidate, damage, ally, 'cannon');
          createExplosion(pointOf(candidate), 'cannon');
          if (!candidate.dead) {
            if (ally.deimosStars >= 5) igniteDeimosTarget(ally, candidate, damage);
            if (candidate.kind !== 'boss') knockbackDeimosTarget(candidate, muzzle);
          }
        });
      }, shot * DEIMOS_SHOTGUN.interval);
    }
    schedule(() => {
      ally.charging = false;
      ally.el?.classList.remove('deimos-shotgun-firing');
    }, DEIMOS_SHOTGUN.duration);
    return true;
  }

  function uranusMuzzlePoints(ally) {
    return [
      { x: -.0255, y: -.078 }, { x: .0255, y: -.078 },
      { x: -.03225, y: -.06 }, { x: .03225, y: -.06 },
      { x: -.0285, y: -.045 }, { x: .0285, y: -.045 },
      { x: -.024, y: -.03 }, { x: .024, y: -.03 },
      { x: -.02175, y: -.015 }, { x: .02175, y: -.015 }
    ].map(point => orientedAllyPoint(ally, point.x, point.y));
  }

  function uranusDenseTarget(ally) {
    const targets = shooterTargetsFor(ally);
    if (!targets.length) return null;
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    return targets.map(candidate => ({
      candidate,
      density: targets.filter(other => Math.hypot((candidate.x - other.x) * width, (candidate.y - other.y) * height) <= 78).length
    })).sort((a, b) => b.density - a.density || Math.hypot(a.candidate.x - ally.x, a.candidate.y - ally.y) - Math.hypot(b.candidate.x - ally.x, b.candidate.y - ally.y))[0]?.candidate || null;
  }

  function fireUranusCannon(ally) {
    const target = shooterTargetsFor(ally)[0];
    if (!target) return false;
    const muzzles = uranusMuzzlePoints(ally);
    const index = ally.uranusMuzzleIndex || 0;
    const shotCount = ally.uranusStars >= 3 ? 2 : 1;
    ally.uranusMuzzleIndex = (index + shotCount) % muzzles.length;
    for (let shot = 0; shot < shotCount; shot += 1) {
      const muzzle = muzzles[(index + shot) % muzzles.length];
      drawIowaMuzzleFlash(muzzle, 'uranus-cannon');
      schedule(() => {
        if (!target.dead) {
          shooterDamage(target, URANUS_CANNON.hits, ally, 'cannon');
          createExplosion(pointOf(target), 'cannon');
        }
      }, URANUS_CANNON.travel + shot * 45);
    }
    return true;
  }

  function drawUranusBarrageShot(from, to) {
    const shot = document.createElement('i');
    shot.className = 'fx-line uranus-barrage-shot';
    positionLine(shot, from, to);
    refs.effects.append(shot);
    schedule(() => shot.remove(), URANUS_BARRAGE.travel + 100);
  }

  function uranusBarrageTargets(point, ally) {
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    return hostileTargetsFor(ally).filter(candidate => Math.hypot((candidate.x - point.x) * width, (candidate.y - point.y) * height) <= URANUS_BARRAGE.radius);
  }

  function fireUranusFocusBarrage(ally) {
    const target = uranusDenseTarget(ally);
    if (!target) return false;
    ally.charging = true;
    ally.el?.classList.add('uranus-barrage-firing');
    announce(`${ally.ship.name} · 집중포화`, 'friendly');
    for (let shot = 0; shot < URANUS_BARRAGE.shots; shot += 1) {
      schedule(() => {
        if (ally.dead || state.status !== 'combat') return;
        const liveTarget = uranusDenseTarget(ally) || target;
        if (!liveTarget || liveTarget.dead) return;
        const impact = pointOf(liveTarget);
        uranusMuzzlePoints(ally).forEach(muzzle => {
          drawIowaMuzzleFlash(muzzle, 'uranus-barrage');
          drawUranusBarrageShot(muzzle, impact);
        });
        schedule(() => {
          uranusBarrageTargets(impact, ally).forEach(candidate => shooterDamage(candidate, URANUS_BARRAGE.hits, ally));
          createExplosion(impact, 'cannon');
        }, URANUS_BARRAGE.travel);
      }, shot * URANUS_BARRAGE.interval);
    }
    schedule(() => {
      ally.charging = false;
      ally.el?.classList.remove('uranus-barrage-firing');
    }, URANUS_BARRAGE.duration);
    return true;
  }

  function spearMuzzlePoint(ally) {
    return orientedAllyPoint(ally, 0, -.094);
  }

  function drawSpearLaser(from, to, className = 'spear-laser') {
    playRLaserSound();
    const laser = document.createElement('i');
    laser.className = `fx-line ${className}`;
    positionLine(laser, from, to);
    refs.effects.append(laser);
    schedule(() => laser.remove(), 240);
  }

  function fireSpearLaser(ally) {
    const target = shooterTargetsFor(ally)[0];
    if (!target) return false;
    const muzzle = spearMuzzlePoint(ally);
    drawSpearLaser(muzzle, pointOf(target));
    schedule(() => {
      if (!target.dead) {
        shooterDamage(target, SPEAR_LASER.hits, ally);
        createExplosion(pointOf(target), 'laser');
      }
    }, SPEAR_LASER.travel);
    return true;
  }

  function fireSpearLaserVolley(ally) {
    const candidates = shooterTargetsFor(ally);
    if (!candidates.length) return false;
    const orderedTargets = candidates.slice().sort(() => Math.random() - .5);
    ally.charging = true;
    ally.el?.classList.add('spear-volley-firing');
    announce(`${ally.ship.name} · 레이저포 난사`, 'friendly');
    for (let shot = 0; shot < SPEAR_VOLLEY.shots; shot += 1) {
      schedule(() => {
        if (ally.dead || state.status !== 'combat') return;
        const living = shooterTargetsFor(ally);
        const assigned = orderedTargets[shot % orderedTargets.length];
        const target = assigned && !assigned.dead && living.includes(assigned)
          ? assigned
          : living[Math.floor(Math.random() * living.length)];
        if (!target) return;
        const muzzle = spearMuzzlePoint(ally);
        drawSpearLaser(muzzle, pointOf(target), 'spear-volley-laser');
        schedule(() => {
          if (target.dead) return;
          const impact = pointOf(target);
          if (ally.spearStars >= 3) {
            const field = refs.field?.getBoundingClientRect();
            const width = field?.width || 480;
            const height = field?.height || 720;
            hostileTargetsFor(ally).filter(candidate => Math.hypot((candidate.x - impact.x) * width, (candidate.y - impact.y) * height) <= SPEAR_VOLLEY.blastRadius)
              .forEach(candidate => shooterDamage(candidate, SPEAR_VOLLEY.hits, ally));
          } else {
            shooterDamage(target, SPEAR_VOLLEY.hits, ally);
          }
          createExplosion(impact, 'laser');
        }, SPEAR_LASER.travel);
      }, shot * SPEAR_VOLLEY.interval);
    }
    schedule(() => {
      ally.charging = false;
      ally.el?.classList.remove('spear-volley-firing');
    }, SPEAR_VOLLEY.duration);
    return true;
  }

  function bladeMuzzlePoint(ally, lane = 0) {
    return orientedAllyPoint(ally, lane * .023, -.006);
  }

  function bladeBeamEnd(from, target) {
    const targetPoint = pointOf(target);
    const dx = targetPoint.x - from.x;
    const dy = targetPoint.y - from.y;
    if (Math.abs(dx) < .0001 && Math.abs(dy) < .0001) return targetPoint;
    const intersections = [];
    if (dx > 0) intersections.push((1 - from.x) / dx);
    if (dx < 0) intersections.push(-from.x / dx);
    if (dy > 0) intersections.push((1 - from.y) / dy);
    if (dy < 0) intersections.push(-from.y / dy);
    const distance = Math.min(...intersections.filter(value => value > 0));
    return { x: from.x + dx * distance, y: from.y + dy * distance };
  }

  function startBladePiercingBeam(ally, targetForBeam, profile, lane, className, keepAfterTargetDeath = false, lockGeometry = false) {
    const beam = document.createElement('i');
    beam.className = `fx-line ${className}`;
    refs.effects.append(beam);
    const initialTarget = targetForBeam();
    const initialMuzzle = ally.isYamato ? yamatoBeamMuzzle(ally) : bladeMuzzlePoint(ally, lane);
    const geometry = { from: initialMuzzle, to: initialMuzzle };
    if (initialTarget && keepAfterTargetDeath) geometry.to = bladeBeamEnd(geometry.from, initialTarget);
    let active = true;
    const updateGeometry = () => {
      if (!active || ally.dead || state?.status !== 'combat') return;
      const target = targetForBeam();
      if (!target || (target.dead && !keepAfterTargetDeath)) {
        active = false;
        beam.remove();
        return;
      }
      if (lockGeometry) {
        positionLine(beam, geometry.from, geometry.to);
        return;
      }
      geometry.from = bladeMuzzlePoint(ally, lane);
      if (!target.dead) geometry.to = bladeBeamEnd(geometry.from, target);
      positionLine(beam, geometry.from, geometry.to);
      requestAnimationFrame(updateGeometry);
    };
    updateGeometry();
    for (let elapsed = 0; elapsed < profile.duration; elapsed += profile.tick) {
      schedule(() => {
        if (!active || ally.dead || state?.status !== 'combat') return;
        hostileTargetsFor(ally).forEach(candidate => {
          const touchesBeam = ally.isYamato
            ? yamatoBeamTouchesTarget(candidate, geometry.from, geometry.to, profile.width)
            : distanceToBeam(pointOf(candidate), geometry.from, geometry.to) <= profile.width;
          if (!candidate.dead && touchesBeam) {
            shooterDamage(candidate, profile.hits, ally);
          }
        });
      }, elapsed);
    }
    schedule(() => {
      active = false;
      beam.remove();
    }, profile.duration + 30);
  }

  function bladeTargetsByDistance(ally) {
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    return inRangeTargetsFor(ally).slice().sort((left, right) => {
      const leftDistance = Math.hypot((left.x - ally.x) * width, (left.y - ally.y) * height);
      const rightDistance = Math.hypot((right.x - ally.x) * width, (right.y - ally.y) * height);
      return leftDistance - rightDistance;
    });
  }

  function bladeNearestTarget(ally) {
    const target = bladeTargetsByDistance(ally)[0] || null;
    faceAllyTowardTarget(ally, target);
    return target;
  }

  function fireBladePiercingLaser(ally) {
    let target = bladeNearestTarget(ally);
    if (!target) return false;
    playPenetrateBeamSound();
    const targetForBeam = () => target = bladeNearestTarget(ally);
    ally.el?.classList.add('blade-piercing-firing');
    startBladePiercingBeam(ally, targetForBeam, BLADE_LASER, 0, 'blade-piercing-laser');
    if (ally.bladeStars >= 3) {
      startBladePiercingBeam(ally, targetForBeam, { ...BLADE_LASER, hits: Math.floor(BLADE_LASER.hits * .5) }, -.32, 'blade-aux-piercing-laser');
    }
    schedule(() => ally.el?.classList.remove('blade-piercing-firing'), BLADE_LASER.duration + 40);
    return true;
  }

  function fireBladePiercingVolley(ally) {
    const targets = bladeTargetsByDistance(ally).slice(0, BLADE_MAIN.beams);
    if (!targets.length) return false;
    playPenetrateBeamSound();
    faceAllyTowardTarget(ally, targets[0]);
    ally.el?.classList.add('blade-main-firing');
    announce(`${ally.ship.name} · 삼중 관통 레이저`, 'friendly');
    targets.forEach((target, index) => {
      startBladePiercingBeam(ally, () => target, BLADE_MAIN, index - (targets.length - 1) / 2, 'blade-main-piercing-laser');
    });
    // 블레이드는 주포를 유지하는 동안에도 충전 장치를 멈추지 않는다.
    schedule(() => ally.el?.classList.remove('blade-main-firing'), BLADE_MAIN.duration + 40);
    return true;
  }

  function fireOmegaFocusStrike(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    // 집중타격에 포착된 목표는 레이저가 유지되는 동안 이동할 수 없다.
    target.stun = Math.max(Number(target.stun) || 0, OMEGA_FOCUS.stun);
    target.el?.classList.add('stunned');
    schedule(() => {
      if ((Number(target.stun) || 0) <= 0) target.el?.classList.remove('stunned');
    }, OMEGA_FOCUS.stun + 80);
    ally.charging = true;
    ally.omegaFacingLocked = true;
    ally.el?.classList.add('omega-focus-firing');
    announce(`${ally.ship.name} · 집중타격`, 'friendly');
    const targetPoint = pointOf(target);
    const spread = [-8, -4, 0, 4, 8];
    spread.slice(0, OMEGA_FOCUS.beams).forEach(offset => {
      const from = omegaMuzzlePoint(ally, offset, -66);
      drawOmegaBeam(from, targetPoint, 'omega-focus-laser', OMEGA_FOCUS.duration);
    });
    schedule(() => {
      if (!ally.dead) {
        ally.charging = false;
        ally.omegaFacingLocked = false;
        ally.el?.classList.remove('omega-focus-firing');
      }
    }, OMEGA_FOCUS.duration);
    schedule(() => {
      if (state.status !== 'combat') return;
      const impact = pointOf(target);
      if (!target.dead) shooterDamage(target, OMEGA_FOCUS.hits, ally);
      createExplosion(impact, ally.omegaStars >= 5 ? 'omega-focus-blast' : 'laser');
      if (ally.omegaStars >= 5) {
        const field = refs.field?.getBoundingClientRect();
        const width = field?.width || 480;
        const height = field?.height || 720;
        hostileTargetsFor(ally).forEach(enemy => {
          const distance = Math.hypot((enemy.x - impact.x) * width, (enemy.y - impact.y) * height);
          if (distance <= OMEGA_LASER.blastRadius) shooterDamage(enemy, OMEGA_LASER.blastDamage, ally, 'laser');
        });
      }
    }, OMEGA_FOCUS.duration + OMEGA_FOCUS.impactDelay);
    return true;
  }

  function firePlanetDestroyerLaserVolley(ally) {
    if (!weakestEnemyTarget(ally)) return false;
    for (let shot = 0; shot < PLANET_DESTROYER_LASER.shots; shot += 1) {
      schedule(() => {
        if (ally.dead || ally.charging || state.status !== 'combat') return;
        const target = weakestEnemyTarget(ally);
        if (!target) return;
        const from = { x: ally.x, y: ally.y - .027 };
        drawPlanetDestroyerLaser(from, pointOf(target));
        schedule(() => {
          if (!target.dead) shooterDamage(target, PLANET_DESTROYER_LASER.hits, ally);
        }, PLANET_DESTROYER_LASER.travel);
      }, shot * PLANET_DESTROYER_LASER.shotInterval);
    }
    return true;
  }

  function counterPlanetDestroyerAttack(ally, source) {
    if (!source || source.dead || !Number.isFinite(Number(source.hp)) || state.allies.includes(source)) return;
    drawPlanetDestroyerLaser({ x: ally.x, y: ally.y - .027 }, pointOf(source));
    schedule(() => {
      if (!ally.dead && !source.dead && state.status === 'combat') {
        shooterDamage(source, PLANET_DESTROYER_LASER.hits, ally);
      }
    }, PLANET_DESTROYER_LASER.travel);
  }

  function planetDestroyerBeamTouches(target, centerX, beamStartY, beamWidth) {
    const field = refs.field.getBoundingClientRect();
    const targetBounds = target.el?.getBoundingClientRect();
    const radius = Math.min(60, Math.max(targetBounds?.width || 18, targetBounds?.height || 18) * .38);
    const y = target.y * field.height;
    if (y < -radius || y > beamStartY + radius) return false;
    const halfWidth = beamWidth * .5;
    return Math.abs((target.x - centerX) * field.width) <= halfWidth + radius;
  }

  function applyPlanetDestroyerDefense(ally) {
    const amount = Math.round(ally.maxHp * .1);
    if (ally.shield >= amount) return;
    ally.shieldEl?.remove();
    ally.shield = amount;
    ally.maxShield = Math.max(ally.maxShield, amount);
    const shield = document.createElement('div');
    shield.className = 'ally-shield planet-destroyer-defense-shield';
    shield.innerHTML = `<em>SPACE ${formatNumber(amount)}</em>`;
    ally.el?.prepend(shield);
    ally.shieldEl = shield;
  }

  function flashPlanetDestroyerExtinction() {
    const flash = document.createElement('i');
    flash.className = 'planet-destroyer-extinction-flash';
    document.body.append(flash);
    flash.addEventListener('animationend', () => flash.remove(), { once: true });
    setTimeout(() => flash.remove(), 1100);
  }

  function firePlanetDestroyerSupernova(ally) {
    if (!hostileTargetsFor(ally).length) return false;
    const profile = PLANET_DESTROYER_SUPERNOVA;
    const destination = { x: .5, y: .84 };
    ally.charging = true;
    ally.el?.classList.add('planet-destroyer-moving');
    if (ally.planetDestroyerStars >= 3) applyPlanetDestroyerDefense(ally);
    announce('행성파괴자 · 초신성', 'friendly');
    void ally.el.offsetWidth;
    moveAlly(ally, destination);

    schedule(() => {
      if (ally.dead) return;
      ally.el?.classList.remove('planet-destroyer-moving');
      ally.el?.classList.add('planet-destroyer-charging');
      const charge = document.createElement('i');
      charge.className = 'planet-destroyer-charge-effect';
      (ally.facingShell?.querySelector('.planet-destroyer-topview') || ally.el)?.append(charge);
    }, profile.move);

    const fireAt = profile.move + profile.charge;
    schedule(() => {
      if (ally.dead) return;
      ally.el?.classList.remove('planet-destroyer-charging');
      ally.el?.classList.add('planet-destroyer-firing');
      const field = refs.field.getBoundingClientRect();
      const hull = ally.facingShell?.querySelector('.planet-destroyer-topview')?.getBoundingClientRect();
      const beamWidth = hull?.width || profile.beamWidth;
      // 충전 구체 중심에서 레이저가 위쪽 화면 끝까지 뻗는다.
      const beamStartY = Math.max(0, Math.min(field.height, (hull?.top || field.top + destination.y * field.height - 76) - field.top + 4));
      const beam = document.createElement('i');
      beam.className = 'planet-destroyer-supernova-beam';
      beam.style.left = percent(destination.x);
      beam.style.width = `${beamWidth}px`;
      beam.style.height = `${beamStartY}px`;
      refs.effects.append(beam);
      // 초신성 광선음(4.5초): 발사와 함께 재생하고, 배속 등으로 광선이 먼저 끝나면 함께 멈춘다.
      const laserSound = playSupernovaLaserSound();
      schedule(() => { beam.remove(); try { laserSound.pause(); } catch {} }, profile.fire);
      for (const side of [-1, 1]) {
        const edge = document.createElement('i');
        edge.className = 'fx-line planet-destroyer-supernova-edge';
        const edgeX = destination.x + side * beamWidth * .5 / (field.width || 360);
        positionLine(edge, { x: edgeX, y: beamStartY / (field.height || 1) }, { x: edgeX, y: 0 });
        refs.effects.append(edge);
        schedule(() => edge.remove(), profile.fire);
      }
      for (let tick = 0; tick < profile.fire; tick += profile.tick) {
        schedule(() => {
          if (ally.dead || state.status !== 'combat') return;
          const extinction = ally.planetDestroyerStars >= 5 && tick + profile.tick >= profile.fire;
          if (extinction) flashPlanetDestroyerExtinction();
          hostileTargetsFor(ally).forEach(target => {
            if (extinction || planetDestroyerBeamTouches(target, destination.x, beamStartY, beamWidth)) shooterDamage(target, profile.hits, ally);
          });
        }, tick);
      }
    }, fireAt);

    const endFireAt = fireAt + profile.fire;
    schedule(() => {
      if (ally.dead) return;
      ally.el?.classList.remove('planet-destroyer-firing');
      ally.el?.classList.add('planet-destroyer-overheated');
      ally.facingShell?.querySelector('.planet-destroyer-charge-effect')?.remove();
    }, endFireAt);

    const returnAt = endFireAt + profile.stun;
    schedule(() => {
      if (ally.dead) return;
      ally.el?.classList.remove('planet-destroyer-overheated');
      ally.el?.classList.add('planet-destroyer-returning');
      moveAlly(ally, { x: ally.homeX, y: ally.homeY });
    }, returnAt);

    schedule(() => {
      if (ally.dead) return;
      ally.el?.classList.remove('planet-destroyer-returning');
      ally.charging = false;
      ally.nextShot = 0;
      ally.planetDestroyerNextFighters = 0;
    }, returnAt + profile.return);
    return true;
  }

  function applyKddxElectrocution(target) {
    if (!target || target.dead) return;
    target.stun = Math.max(target.stun || 0, KDDX_CHAIN.stun);
    target.el?.classList.add('stunned', 'kddx-electrified');
    const generation = target.kddxElectrocutionGeneration = (target.kddxElectrocutionGeneration || 0) + 1;
    for (let tick = 1; tick <= KDDX_CHAIN.dotTicks; tick += 1) {
      schedule(() => {
        if (target.dead || target.kddxElectrocutionGeneration !== generation) return;
        shooterDamage(target, Math.max(1, Math.round(target.maxHp * KDDX_CHAIN.dotRatio)));
      }, tick * KDDX_CHAIN.dotInterval);
    }
    schedule(() => {
      if (target.kddxElectrocutionGeneration === generation) target.el?.classList.remove('stunned', 'kddx-electrified');
    }, KDDX_CHAIN.stun + 80);
  }

  function fireKddxChainLightning(ally) {
    if (!inRangeTargetsFor(ally).length) return false;
    ally.charging = true;
    ally.el?.classList.add('kddx-chain-charging');
    announce(`${ally.ship.name} · 연쇄번개 충전`, 'friendly');
    schedule(() => {
      ally.charging = false;
      ally.el?.classList.remove('kddx-chain-charging');
      if (ally.dead || state?.status !== 'combat') return;
      const fieldRect = refs.field.getBoundingClientRect();
      const distance = (a, b) => Math.hypot((a.x - b.x) * fieldRect.width, (a.y - b.y) * fieldRect.height);
      const primary = inRangeTargetsFor(ally).sort((a, b) => distance(a, ally) - distance(b, ally))[0];
      if (!primary) return;
      playKddxCoreWeaponSound();
      const sequence = [primary];
      let source = primary;
      for (let jump = 0; jump < KDDX_CHAIN.transfers; jump += 1) {
        const next = inRangeTargetsFor(ally)
          .filter(target => !sequence.includes(target))
          .sort((a, b) => distance(a, source) - distance(b, source))[0];
        if (!next) break;
        sequence.push(next);
        source = next;
      }
      ally.el?.classList.add('kddx-chain-firing');
      schedule(() => ally.el?.classList.remove('kddx-chain-firing'), 420);
      sequence.forEach((target, index) => {
        const from = index === 0 ? kddxMuzzlePoint(ally) : pointOf(sequence[index - 1]);
        const impact = pointOf(target);
        schedule(() => drawElectricStrike(from, impact, Math.random() < .5 ? 1 : 2, 260, null), index * KDDX_CHAIN.interval);
        schedule(() => {
          createExplosion(impact, 'electric');
          const burst = document.createElement('i');
          burst.className = 'fx-kddx-splash';
          burst.style.left = percent(impact.x);
          burst.style.top = percent(impact.y);
          burst.style.width = `${KDDX_CHAIN.splashRadius * 2}px`;
          burst.style.height = `${KDDX_CHAIN.splashRadius * 2}px`;
          refs.effects.append(burst);
          schedule(() => burst.remove(), 420);
          const damage = Math.max(1, Math.round(KDDX_CHAIN.hits * Math.pow(KDDX_CHAIN.falloff, index)));
          hostileTargetsFor(ally).filter(enemy => distance(enemy, impact) <= KDDX_CHAIN.splashRadius).forEach(enemy => {
            shooterDamage(enemy, damage, ally, 'electric');
            applyKddxElectrocution(enemy);
          });
        }, KDDX_CHAIN.travel + index * KDDX_CHAIN.interval);
      });
      announce(`${ally.ship.name} · 연쇄번개`, 'friendly');
    }, KDDX_CHAIN.charge);
    return true;
  }

  function mostDamagedEnemyTarget(ally, excludedTargets = null) {
    const target = inRangeTargetsFor(ally)
      .filter(candidate => !excludedTargets?.has(candidate))
      .sort((a, b) => (a.hp / Math.max(1, a.maxHp)) - (b.hp / Math.max(1, b.maxHp)))[0] || null;
    faceAllyTowardTarget(ally, target);
    return target;
  }

  function exposeBigeokWeakness(target) {
    if (!target || target.dead) return;
    target.weakExposedUntil = performance.now() + SUPANOKSEON_MAIN.weakDuration;
    target.el?.classList.add('weak-exposed');
    schedule(() => {
      if (performance.now() >= Number(target.weakExposedUntil || 0)) target.el?.classList.remove('weak-exposed');
    }, SUPANOKSEON_MAIN.weakDuration + 30);
  }

  function detonateBigeok(grenade) {
    if (!grenade || grenade.detonated) return;
    grenade.detonated = true;
    playFlymineBoomSound();
    grenade.el?.remove();
    const primary = grenade.target;
    const point = primary && !primary.dead ? pointOf(primary) : grenade.point;
    if (primary && !primary.dead) {
      shooterDamage(primary, SUPANOKSEON_MAIN.hits, grenade.owner);
      exposeBigeokWeakness(primary);
    }
    createExplosion(point, 'plasma');
    hostileTargetsFor(ally)
      .filter(target => target !== primary && (target.kind === 'boss' || target.deployed))
      .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))
      .slice(0, 3)
      .forEach((target, index) => schedule(() => {
        if (target.dead) return;
        shooterDamage(target, SUPANOKSEON_MAIN.splashHits, grenade.owner);
        exposeBigeokWeakness(target);
        createExplosion(pointOf(target), 'cannon');
      }, index * 55));
  }

  function launchBigeok(ally, muzzle, target, shotIndex = 0) {
    if (!target) return;
    playPanokFlymineSound();
    const grenade = { target, owner: ally, point: pointOf(target), detonated: false, el: document.createElement('i') };
    const offsets = [[-12, -7], [0, -10], [12, -7], [-6, 6], [6, 6]];
    const [offsetX, offsetY] = offsets[shotIndex % offsets.length];
    grenade.el.className = 'fx-bigeok';
    grenade.el.style.left = percent(muzzle.x);
    grenade.el.style.top = percent(muzzle.y);
    refs.effects.append(grenade.el);
    requestAnimationFrame(() => {
      grenade.el.style.left = percent(grenade.point.x);
      grenade.el.style.top = percent(grenade.point.y);
    });
    schedule(() => {
      if (grenade.detonated) return;
      if (target.dead || !target.el) {
        detonateBigeok(grenade);
        return;
      }
      target.el.append(grenade.el);
      grenade.el.style.left = `calc(50% + ${offsetX}px)`;
      grenade.el.style.top = `calc(50% + ${offsetY}px)`;
      grenade.el.classList.add('attached');
    }, SUPANOKSEON_MAIN.grenadeTravel);
    schedule(() => detonateBigeok(grenade), SUPANOKSEON_MAIN.grenadeTravel + SUPANOKSEON_MAIN.fuse);
    const watchTarget = () => {
      if (grenade.detonated) return;
      if (target.dead) {
        detonateBigeok(grenade);
        return;
      }
      schedule(watchTarget, 80);
    };
    schedule(watchTarget, 80);
  }

  function fireSuPanokseonMainBattery(ally) {
    if (!shooterTargetsFor(ally).length) return false;
    const rapid = ally.suPanokseonStars >= 5;
    const turnDuration = SUPANOKSEON_MAIN.turnDuration * (rapid ? .5 : 1);
    const sides = rapid ? [-1, 1] : [ally.suPanokseonTurnSide || -1];
    if (!rapid) ally.suPanokseonTurnSide = -sides[0];
    ally.charging = true;
    ally.el.classList.add('supanokseon-turning');
    ally.el.style.setProperty('--supanokseon-turn-duration', `${turnDuration}ms`);
    announce(`${ally.ship.name} · 비격진천뢰`, 'friendly');
    const turnTo = side => {
      ally.facingAngle = side * Math.PI / 2;
      ally.el?.style.setProperty('--supanokseon-angle', `${side * 90}deg`);
    };
    let nextTurnAt = 0;
    for (const side of sides) {
      if (nextTurnAt) schedule(() => turnTo(side), nextTurnAt);
      else turnTo(side);
      const barrageStart = nextTurnAt + turnDuration;
      for (let index = 0; index < SUPANOKSEON_MAIN.cannonShots; index += 1) {
        schedule(() => {
          const targets = shooterTargetsFor(ally);
          const target = targets[Math.floor(Math.random() * targets.length)];
          if (!target) return;
          drawIowaMuzzleFlash(suPanokseonMuzzlePoint(ally, index, -side), 'supanokseon-side');
          schedule(() => hitSuPanokseonCannon(ally, target, SUPANOKSEON_MAIN.cannonHits), SUPANOKSEON_CANNON.travel);
        }, barrageStart + index * SUPANOKSEON_MAIN.cannonInterval);
      }
      const grenadeLaunch = barrageStart + SUPANOKSEON_MAIN.cannonShots * SUPANOKSEON_MAIN.cannonInterval;
      for (let index = 0; index < SUPANOKSEON_MAIN.grenades; index += 1) {
        schedule(() => {
          const targets = shooterTargetsFor(ally);
          const target = targets[Math.floor(Math.random() * targets.length)] || null;
          if (!target) return;
          launchBigeok(ally, suPanokseonMuzzlePoint(ally, index, -side), target, index);
        }, grenadeLaunch + index * 120);
      }
      nextTurnAt = grenadeLaunch + (SUPANOKSEON_MAIN.grenades - 1) * 120;
    }
    const returnAt = nextTurnAt + (rapid ? 0 : SUPANOKSEON_MAIN.returnWait);
    schedule(() => {
      ally.suPanokseonReturning = true;
      ally.el?.classList.remove('supanokseon-turning');
      ally.el?.classList.add('supanokseon-returning');
      ally.el?.style.setProperty('--supanokseon-angle', '0deg');
    }, returnAt);
    schedule(() => {
      ally.charging = false;
      ally.suPanokseonReturning = false;
      ally.facingAngle = 0;
      ally.el?.classList.remove('supanokseon-returning');
    }, returnAt + turnDuration);
    return true;
  }

  function fireAegisCannon(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    const muzzleIndex = ally.aegisMuzzleIndex || 0;
    ally.aegisMuzzleIndex = (muzzleIndex + 1) % 4;
    drawIowaMuzzleFlash(aegisMuzzlePoint(ally, muzzleIndex), 'aegis');
    schedule(() => {
      if (target && !target.dead) shooterDamage(target, AEGIS_CANNON.hits, ally, 'cannon');
    }, 90);
    return true;
  }

  function fireColossusFighterWing(ally) {
    if (!shooterTargetFor(ally)) return false;
    for (let index = 0; index < COLOSSUS_FIGHTER.count; index += 1) {
      schedule(() => launchColossusFighter(ally, index), index * COLOSSUS_FIGHTER.interval);
    }
    return true;
  }

  function launchColossusFighter(ally, index) {
    if (!state || state.status !== 'combat' || ally.dead || ally.charging) return;
    let target = shooterTargetFor(ally);
    if (!target) return;
    const origin = orientedAllyPoint(ally, 0, -.025);
    let attackPoint = bastionAttackPoint(target);
    const fighter = document.createElement('i');
    fighter.className = 'fx-colossus-fighter';
    fighter.style.left = percent(origin.x);
    fighter.style.top = percent(origin.y);
    refs.allyLayer.append(fighter);
    playFighterLaunchSound();
    requestAnimationFrame(() => {
      fighter.style.left = percent(attackPoint.x);
      fighter.style.top = percent(attackPoint.y);
    });
    schedule(() => {
      if (target.dead) {
        target = shooterTargetFor(ally);
        if (target) {
          attackPoint = bastionAttackPoint(target);
          fighter.style.left = percent(attackPoint.x);
          fighter.style.top = percent(attackPoint.y);
        }
      }
    }, COLOSSUS_FIGHTER.travel * .5);
    schedule(() => {
      const liveTarget = target && !target.dead ? target : shooterTargetFor(ally);
      if (liveTarget) {
        if (liveTarget !== target) {
          target = liveTarget;
          attackPoint = bastionAttackPoint(liveTarget);
          fighter.style.left = percent(attackPoint.x);
          fighter.style.top = percent(attackPoint.y);
        }
        playFighterShotSound();
        shooterDamage(liveTarget, COLOSSUS_FIGHTER.hits);
        createExplosion(attackPoint, 'cannon');
      }
      fighter.classList.add('returning');
      fighter.style.left = percent(origin.x);
      fighter.style.top = percent(origin.y);
    }, COLOSSUS_FIGHTER.travel + COLOSSUS_FIGHTER.attackDuration);
    schedule(() => fighter.classList.add('docking'), COLOSSUS_FIGHTER.travel + COLOSSUS_FIGHTER.attackDuration + COLOSSUS_FIGHTER.returnTravel - 70);
    schedule(() => fighter.remove(), COLOSSUS_FIGHTER.travel + COLOSSUS_FIGHTER.attackDuration + COLOSSUS_FIGHTER.returnTravel + 80);
  }

  function bastionDeckPoint(ally, index) {
    const group = Math.floor(index / 3), point = [{ x: -.032 + group * .02, y: -.055 }, { x: 0, y: -.002 }, { x: .032 - group * .02, y: .052 }][index % 3];
    return orientedAllyPoint(ally, point.x, point.y);
  }

  function bastionMuzzlePoints(ally) {
    return [{ x: -.052, y: -.115 }, { x: .052, y: -.115 }, { x: -.061, y: -.058 }, { x: .061, y: -.058 }]
      .map(point => orientedAllyPoint(ally, point.x, point.y));
  }

  function bastionAttackPoint(target) {
    const angle = Math.random() * Math.PI * 2;
    const fieldRect = refs.field?.getBoundingClientRect();
    const targetRect = target.el?.getBoundingClientRect();
    const fieldWidth = fieldRect?.width || 360;
    const fieldHeight = fieldRect?.height || 640;
    // 대상의 화면상 외곽과 함재기 크기를 함께 반영해, 적의 크기에 관계없이 겹치지 않게 한다.
    const targetRadius = Math.max(targetRect?.width || 18, targetRect?.height || 18) * .5;
    const clearance = targetRadius + 13 + Math.random() * 9;
    return {
      x: Math.max(.025, Math.min(.975, target.x + Math.cos(angle) * clearance / fieldWidth)),
      y: Math.max(.025, Math.min(.975, target.y + Math.sin(angle) * clearance / fieldHeight))
    };
  }

  function setBastionFighterFacing(fighter, from, to) {
    const rect = refs.field?.getBoundingClientRect();
    const dx = (to.x - from.x) * (rect?.width || 360);
    const dy = (to.y - from.y) * (rect?.height || 640);
    fighter.style.setProperty('--bastion-fighter-angle', `${Math.atan2(dy, dx) + Math.PI / 2}rad`);
  }

  function fireBastionFighterWing(ally, profile = BASTION_FIGHTER) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    for (let index = 0; index < profile.count; index += 1) launchBastionFighter(ally, index, target, profile);
    if (ally.isBastion && ally.bastionStars >= 5) {
      schedule(() => {
        if (ally.dead || !state || state.status !== 'combat') return;
        const nextTarget = shooterTargetFor(ally);
        if (!nextTarget) return;
        for (let index = 0; index < profile.count; index += 1) launchBastionFighter(ally, index + profile.count, nextTarget, profile);
      }, BASTION_FIGHTER.secondSquadDelay);
    }
    return true;
  }

  function launchBastionFighter(ally, index, initialTarget, profile = BASTION_FIGHTER) {
    if (!state || state.status !== 'combat' || ally.dead || ally.charging) return;
    let target = initialTarget && !initialTarget.dead ? initialTarget : shooterTargetFor(ally);
    if (!target) return;
    const origin = bastionDeckPoint(ally, index);
    let attackPoint = bastionAttackPoint(target);
    const fighter = document.createElement('i');
    fighter.className = `fx-colossus-fighter bastion-fighter${ally.isPlanetDestroyer ? ' planet-destroyer-fighter' : ''}`;
    fighter.style.left = percent(origin.x);
    fighter.style.top = percent(origin.y);
    setBastionFighterFacing(fighter, origin, attackPoint);
    refs.allyLayer.append(fighter);
    playFighterLaunchSound();
    requestAnimationFrame(() => {
      fighter.style.left = percent(attackPoint.x);
      fighter.style.top = percent(attackPoint.y);
    });
    schedule(() => {
      if (target.dead) {
        target = shooterTargetFor(ally);
        if (target) {
          attackPoint = bastionAttackPoint(target);
          setBastionFighterFacing(fighter, origin, attackPoint);
          fighter.style.left = percent(attackPoint.x);
          fighter.style.top = percent(attackPoint.y);
        }
      }
    }, profile.travel * .5);
    schedule(() => {
      const liveTarget = target && !target.dead ? target : shooterTargetFor(ally);
      if (liveTarget) setBastionFighterFacing(fighter, attackPoint, pointOf(liveTarget));
    }, profile.travel);
    schedule(() => {
      const liveTarget = target && !target.dead ? target : shooterTargetFor(ally);
      if (liveTarget) {
        playFighterShotSound();
        shooterDamage(liveTarget, profile.hits, ally);
        createExplosion(pointOf(liveTarget), 'cannon');
      }
      fighter.classList.add('returning');
      setBastionFighterFacing(fighter, attackPoint, { x: ally.x, y: ally.y });
      fighter.style.left = percent(ally.x);
      fighter.style.top = percent(ally.y);
    }, profile.travel + profile.attackDuration);
    schedule(() => fighter.classList.add('docking'), profile.travel + profile.attackDuration + profile.returnTravel - 70);
    schedule(() => fighter.remove(), profile.travel + profile.attackDuration + profile.returnTravel + 80);
  }

  function healthiestEnemyTarget(ally) {
    const target = inRangeTargetsFor(ally)
      .sort((left, right) => right.hp / right.maxHp - left.hp / left.maxHp)[0] || null;
    faceAllyTowardTarget(ally, target);
    return target;
  }

  function fireBastionMainBattery(ally) {
    const target = healthiestEnemyTarget(ally);
    if (!target) return false;
    ally.charging = true;
    ally.el?.classList.add('bastion-main-firing');
    announce(`${ally.ship.name} · 정밀 함포사격`, 'friendly');
    for (let index = 0; index < BASTION_MAIN.shots; index += 1) {
      schedule(() => {
        const liveTarget = target && !target.dead ? target : healthiestEnemyTarget(ally);
        if (!liveTarget || ally.dead) return;
        drawIowaMuzzleFlash(bastionMuzzlePoints(ally)[index], 'bastion');
        schedule(() => {
          if (liveTarget.dead) return;
          shooterDamage(liveTarget, BASTION_MAIN.hits);
          liveTarget.forcedTarget = ally;
          liveTarget.forcedTargetUntil = performance.now() + BASTION_MAIN.tauntDuration;
        }, BASTION_MAIN.travel);
      }, index * BASTION_MAIN.interval);
    }
    schedule(() => {
      if (!ally.dead) {
        const repairRatio = ally.bastionStars >= 3 ? .1 : BASTION_MAIN.repair;
        ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * repairRatio);
        ally.healthBar.style.width = `${ally.hp / ally.maxHp * 100}%`;
        showUnitDamage(ally, `+${formatNumber(Math.ceil(ally.maxHp * repairRatio))}`);
      }
      ally.charging = false;
      ally.el?.classList.remove('bastion-main-firing');
    }, BASTION_MAIN.shots * BASTION_MAIN.interval + BASTION_MAIN.travel + 30);
    return true;
  }

  function hammerDeckPoint(ally, index) {
    const points = [{ x: -.026, y: .045 }, { x: .026, y: .045 }];
    const point = points[index % points.length];
    return orientedAllyPoint(ally, point.x, point.y);
  }

  function hammerMuzzlePoint(ally) {
    return orientedAllyPoint(ally, 0, -.11);
  }

  function fireHammerFighterWing(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    for (let index = 0; index < HAMMER_FIGHTER.count; index += 1) {
      launchBastionFighter(ally, index, target);
    }
    return true;
  }

  function fireHammerCannon(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    const muzzle = hammerMuzzlePoint(ally);
    drawIowaMuzzleFlash(muzzle, 'hammer');
    schedule(() => {
      const liveTarget = target && !target.dead ? target : shooterTargetFor(ally);
      if (!liveTarget) return;
      shooterDamage(liveTarget, HAMMER_FIGHTER.cannonHits);
      createExplosion(pointOf(liveTarget), 'cannon');
    }, HAMMER_FIGHTER.travel);
    return true;
  }

  function hammerDroneTargets(ally) {
    const priorityAllies = state.allies.filter(candidate => !candidate.dead && (candidate.ship?.type === 'destroyer' || candidate.ship?.type === 'battlecruiser'));
    const anchors = priorityAllies.length ? priorityAllies : [ally];
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    return hostileTargetsFor(ally).sort((left, right) => {
      const distance = target => Math.min(...anchors.map(anchor => Math.hypot((target.x - anchor.x) * width, (target.y - anchor.y) * height)));
      return distance(left) - distance(right);
    });
  }

  function applyHammerDroneStun(target) {
    if (!target || target.dead) return;
    const stunClass = target.kind === 'boss' ? 'hammer-boss-stunned' : 'hammer-stunned';
    target.stun = Math.max(Number(target.stun) || 0, HAMMER_DRONE.stun);
    target.hammerStunnedUntil = performance.now() + HAMMER_DRONE.stun;
    target.el?.classList.remove('hammer-stunned');
    target.el?.classList.add(stunClass);
    schedule(() => {
      if (performance.now() >= Number(target.hammerStunnedUntil || 0)) target.el?.classList.remove(stunClass);
    }, HAMMER_DRONE.stun + 30);
  }

  function hammerDroneAreaTargets(point, ally) {
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    return hostileTargetsFor(ally).filter(target => Math.hypot((target.x - point.x) * width, (target.y - point.y) * height) <= HAMMER_DRONE.radius);
  }

  function launchHammerDrone(ally, initialTarget, index, hits = HAMMER_DRONE.hits) {
    let target = initialTarget;
    const origin = hammerDeckPoint(ally, index);
    const destination = pointOf(target);
    const rect = refs.field?.getBoundingClientRect();
    const dx = (destination.x - origin.x) * (rect?.width || 480);
    const dy = (destination.y - origin.y) * (rect?.height || 720);
    const drone = document.createElement('i');
    drone.className = 'fx-hammer-drone';
    drone.style.left = percent(origin.x);
    drone.style.top = percent(origin.y);
    drone.style.setProperty('--dx', `${dx}px`);
    drone.style.setProperty('--dy', `${dy}px`);
    drone.style.setProperty('--hammer-drone-angle', `${Math.atan2(dy, dx) + Math.PI / 2}rad`);
    refs.effects.append(drone);
    playFighterLaunchSound();
    requestAnimationFrame(() => drone.classList.add('launched'));
    schedule(() => {
      drone.remove();
      target = target && !target.dead ? target : hammerDroneTargets(ally)[0];
      if (!target) return;
      playFighterShotSound();
      const impact = pointOf(target);
      hammerDroneAreaTargets(impact, ally).forEach(areaTarget => {
        shooterDamage(areaTarget, hits, ally);
        applyHammerDroneStun(areaTarget);
      });
      createExplosion(impact, 'hammer-drone');
    }, HAMMER_DRONE.travel);
  }

  function fireHammerDrones(ally) {
    const targets = hammerDroneTargets(ally);
    if (!targets.length) return false;
    ally.charging = true;
    ally.el?.classList.add('hammer-drone-launching');
    announce(`${ally.ship.name} · 해머드론 전개`, 'friendly');
    const count = HAMMER_DRONE.count + (ally.hammerStars >= 3 ? HAMMER_DRONE.extraCount : 0);
    const hits = ally.hammerStars >= 3 ? HAMMER_DRONE.enhancedHits : HAMMER_DRONE.hits;
    for (let index = 0; index < count; index += 1) {
      schedule(() => launchHammerDrone(ally, targets[index % targets.length], index, hits), index * 110);
    }
    schedule(() => {
      ally.charging = false;
      ally.el?.classList.remove('hammer-drone-launching');
    }, HAMMER_DRONE.travel + (count - 1) * 110 + 40);
    return true;
  }

  function nimitzDeckPoint(ally, index) {
    const columns = [-.038, -.019, 0, .019, .038];
    const rows = [-.055, -.018, .02, .056, .082];
    return orientedAllyPoint(ally, columns[index % columns.length], rows[Math.floor(index / columns.length) % rows.length]);
  }

  function randomNimitzEnemyTarget(ally) {
    const targets = inRangeTargetsFor(ally);
    const target = targets[Math.floor(Math.random() * targets.length)] || null;
    faceAllyTowardTarget(ally, target);
    return target;
  }

  function fireNimitzFighterWing(ally, count = NIMITZ_FIGHTER.count, multiplier = 1, interval = NIMITZ_FIGHTER.launchInterval, useInventory = multiplier <= 1) {
    if (!randomNimitzEnemyTarget(ally)) return false;
    const launchCount = useInventory ? Math.min(count, ally.nimitzAvailableFighters || 0) : count;
    if (!launchCount) return false;
    if (useInventory) ally.nimitzAvailableFighters -= launchCount;
    for (let index = 0; index < launchCount; index += 1) {
      schedule(() => launchNimitzFighter(ally, index, multiplier, useInventory), index * interval);
    }
    return true;
  }

  function launchNimitzFighter(ally, index, multiplier, usesInventory) {
    if (!state || state.status !== 'combat' || ally.dead) return;
    let target = randomNimitzEnemyTarget(ally);
    if (!target) return;
    ally.nimitzAttackLocks = (ally.nimitzAttackLocks || 0) + 1;
    ally.nimitzAttackLocked = true;
    const origin = nimitzDeckPoint(ally, index);
    const attackPoint = bastionAttackPoint(target);
    const fighter = document.createElement('i');
    fighter.className = `fx-colossus-fighter nimitz-fighter${multiplier > 1 ? ' nimitz-total-fighter' : ''}`;
    fighter._nimitzAttackPoint = attackPoint;
    fighter._nimitzUsesInventory = usesInventory;
    fighter.style.left = percent(origin.x);
    fighter.style.top = percent(origin.y);
    setBastionFighterFacing(fighter, origin, attackPoint);
    refs.allyLayer.append(fighter);
    playFighterLaunchSound();
    requestAnimationFrame(() => {
      fighter.style.left = percent(attackPoint.x);
      fighter.style.top = percent(attackPoint.y);
    });
    schedule(() => {
      const liveTarget = target && !target.dead && (target.kind === 'boss' || target.deployed) ? target : null;
      if (!liveTarget) {
        returnNimitzFighter(fighter, ally, attackPoint);
        return;
      }
      setBastionFighterFacing(fighter, attackPoint, pointOf(liveTarget));
      sustainNimitzFighterAttack(fighter, ally, liveTarget, attackPoint, multiplier);
    }, NIMITZ_FIGHTER.travel);
  }

  function sustainNimitzFighterAttack(fighter, ally, target, attackPoint, multiplier) {
    if (!state || state.status !== 'combat' || ally.dead || fighter.classList.contains('returning')) return;
    const liveTarget = target && !target.dead && (target.kind === 'boss' || target.deployed)
      ? target
      : randomNimitzEnemyTarget(ally);
    if (!liveTarget) {
      returnNimitzFighter(fighter, ally, fighter._nimitzAttackPoint || attackPoint);
      return;
    }
    // 우주항모 인터셉터처럼 목표 주변의 임의 지점을 계속 옮겨 다니며 공격한다.
    const currentPoint = fighter._nimitzAttackPoint || attackPoint;
    const nextPoint = bastionAttackPoint(liveTarget);
    fighter._nimitzAttackPoint = nextPoint;
    setBastionFighterFacing(fighter, currentPoint, nextPoint);
    fighter.style.left = percent(nextPoint.x);
    fighter.style.top = percent(nextPoint.y);
    playFighterShotSound();
    shooterDamage(liveTarget, Math.round(NIMITZ_FIGHTER.hits * multiplier), ally);
    createExplosion(pointOf(liveTarget), 'cannon');
    if (liveTarget.dead) {
      returnNimitzFighter(fighter, ally, nextPoint);
      return;
    }
    schedule(() => sustainNimitzFighterAttack(fighter, ally, liveTarget, nextPoint, multiplier), NIMITZ_FIGHTER.attackDuration);
  }

  function returnNimitzFighter(fighter, ally, attackPoint) {
    if (fighter.classList.contains('returning')) return;
    fighter.classList.add('returning');
    setBastionFighterFacing(fighter, fighter._nimitzAttackPoint || attackPoint, { x: ally.x, y: ally.y });
    fighter.style.left = percent(ally.x);
    fighter.style.top = percent(ally.y);
    schedule(() => fighter.classList.add('docking'), NIMITZ_FIGHTER.returnTravel - 70);
    schedule(() => {
      if (fighter._nimitzUsesInventory) ally.nimitzAvailableFighters = Math.min(NIMITZ_FIGHTER.count, (ally.nimitzAvailableFighters || 0) + 1);
    }, NIMITZ_FIGHTER.returnTravel);
    schedule(() => {
      ally.nimitzAttackLocks = Math.max(0, (ally.nimitzAttackLocks || 0) - 1);
      ally.nimitzAttackLocked = ally.nimitzAttackLocks > 0;
    }, NIMITZ_FIGHTER.returnTravel + 80);
    schedule(() => fighter.remove(), NIMITZ_FIGHTER.returnTravel + 80);
  }

  function applyNimitzShield(ally, amount, duration = NIMITZ_MAIN.duration) {
    if (ally.isArenaShip) { setArenaEnemyShield(ally, amount); return; }
    ally.maxShield = amount;
    ally.shield = amount;
    clearFireDust(ally);
    ally.shieldEl?.remove();
    const shield = document.createElement('div');
    shield.className = 'ally-shield nimitz-overdrive-shield';
    shield.innerHTML = `<em>OVERDRIVE ${formatNumber(amount)}</em>`;
    ally.el.prepend(shield);
    ally.shieldEl = shield;
    addNimitzShieldGauge(ally);
    ally.el.classList.add('nimitz-shield-pulse');
    schedule(() => {
      if (ally.shieldEl !== shield) return;
      ally.shield = 0;
      ally.maxShield = 0;
      clearNimitzShieldGauge(ally);
      ally.el?.classList.remove('nimitz-shield-pulse');
      shield.classList.add('broken');
      ally.shieldEl = null;
      schedule(() => shield.remove(), 420);
    }, tacticalShieldDuration(duration));
  }

  function addNimitzShieldGauge(ally) {
    clearNimitzShieldGauge(ally);
    const health = ally.el?.querySelector('.ally-health');
    if (!health) return;
    const gauge = document.createElement('span');
    gauge.className = 'nimitz-shield-gauge';
    gauge.innerHTML = '<i></i><em></em>';
    health.append(gauge);
    ally.nimitzShieldGauge = gauge;
    updateNimitzShieldGauge(ally);
  }

  function updateNimitzShieldGauge(ally) {
    if (!ally?.nimitzShieldGauge) return;
    const ratio = ally.maxShield ? Math.max(0, ally.shield / ally.maxShield * 100) : 0;
    const bar = ally.nimitzShieldGauge.querySelector('i');
    const label = ally.nimitzShieldGauge.querySelector('em');
    if (bar) bar.style.width = `${ratio}%`;
    if (label) label.textContent = formatNumber(Math.ceil(Math.max(0, ally.shield)));
  }

  function clearNimitzShieldGauge(ally) {
    ally?.nimitzShieldGauge?.remove();
    if (ally) ally.nimitzShieldGauge = null;
  }

  function fireNimitzTotalOffensive(ally) {
    if (!randomNimitzEnemyTarget(ally)) return false;
    ally.charging = true;
    ally.nimitzOverload = true;
    ally.el?.classList.add('nimitz-total-offensive');
    ally.el?.querySelector('.nimitz-topview img')?.setAttribute('src', 'nimitz-assault-topview.png');
    if (ally.nimitzStars >= 3) {
      ally.nimitzImmuneUntil = performance.now() + NIMITZ_MAIN.immunityDuration;
      ally.el?.classList.add('nimitz-skill-immunity');
      schedule(() => ally.el?.classList.remove('nimitz-skill-immunity'), NIMITZ_MAIN.immunityDuration);
      schedule(() => {
        if (!ally.dead && ally.nimitzOverload) applyNimitzShield(ally, ally.maxHp * NIMITZ_MAIN.shieldRatio, NIMITZ_MAIN.duration - NIMITZ_MAIN.immunityDuration);
      }, NIMITZ_MAIN.immunityDuration);
    }
    hostileTargetsFor(ally).forEach(enemy => {
      enemy.forcedTarget = ally;
      enemy.forcedTargetUntil = performance.now() + NIMITZ_MAIN.duration;
    });
    announce(`${ally.ship.name} · 총공세`, 'friendly');
    const offensiveMultiplier = NIMITZ_MAIN.hitsMultiplier * (ally.nimitzStars >= 5 ? NIMITZ_MAIN.ultimateMultiplier : 1);
    fireNimitzFighterWing(ally, NIMITZ_MAIN.count, offensiveMultiplier, NIMITZ_MAIN.launchInterval, false);
    schedule(() => ally.el?.classList.add('nimitz-deck-cleared'), NIMITZ_MAIN.count * NIMITZ_MAIN.launchInterval);
    schedule(() => {
      ally.charging = false;
      ally.rechargePause = NIMITZ_MAIN.rechargeLock;
      refs.allyLayer.querySelectorAll('.nimitz-total-fighter').forEach(fighter => {
        returnNimitzFighter(fighter, ally, fighter._nimitzAttackPoint || { x: ally.x, y: ally.y });
      });
      ally.el?.classList.remove('nimitz-total-offensive', 'nimitz-deck-cleared');
      ally.el?.querySelector('.nimitz-topview img')?.setAttribute('src', 'nimitz-battle-topview.png');
      schedule(() => {
        ally.nimitzOverload = false;
        updateBattlecruiserEnergy(ally);
      }, NIMITZ_MAIN.rechargeLock);
    }, NIMITZ_MAIN.duration);
    return true;
  }

  function fireColossusMainShield(ally) {
    const livingAllies = friendliesOf(ally);
    const shieldTargets = ally.colossusStars >= 3
      ? livingAllies
      : livingAllies.sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp).slice(0, 1);
    if (!shieldTargets.length) return false;
    ally.charging = true;
    ally.el?.classList.add('colossus-main-active');
    const shield = document.createElement('i');
    shield.className = 'fx-colossus-square-shield';
    shield.style.left = '50%';
    shield.style.top = '49%';
    refs.effects.append(shield);
    playColossusShieldSound();
    announce(`${ally.ship.name} · ${ally.colossusStars >= 3 ? '전 아군' : shieldTargets[0].ship.name} 보호막 전개`, 'friendly');
    schedule(() => {
      shield.classList.add('dispersing');
      if (shieldTargets.some(target => !target.dead)) playColossusShieldSound();
      shieldTargets.forEach(target => { if (!target.dead) launchColossusShieldEcho(target); });
    }, COLOSSUS_MAIN.unfold);
    schedule(() => {
      shield.remove();
      const shieldAmount = Math.round(ally.maxHp * .5 * (ally.colossusStars >= 3 ? COLOSSUS_MAIN.enhancedShieldRatio : 1));
      shieldTargets.forEach(target => { if (!target.dead) applyColossusShield(target, shieldAmount, ally.colossusStars >= 5 ? ally : null); });
      ally.el?.classList.remove('colossus-main-active');
      ally.charging = false;
    }, COLOSSUS_MAIN.unfold + COLOSSUS_MAIN.disperse);
    return true;
  }

  function launchColossusShieldEcho(ally) {
    const echo = document.createElement('i');
    echo.className = 'fx-colossus-shield-echo';
    echo.style.left = '50%';
    echo.style.top = '49%';
    refs.effects.append(echo);
    requestAnimationFrame(() => {
      echo.style.left = percent(ally.x);
      echo.style.top = percent(ally.y);
    });
    schedule(() => {
      if (!echo.isConnected || ally.dead || !ally.el) return;
      echo.style.transition = 'none';
      ally.el.append(echo);
      echo.style.left = '50%';
      echo.style.top = '50%';
      echo.classList.add('settling', 'attached');
    }, COLOSSUS_MAIN.disperse);
    schedule(() => echo.classList.add('fading'), COLOSSUS_MAIN.disperse + 5000);
    schedule(() => echo.remove(), COLOSSUS_MAIN.disperse + 5650);
  }

  function applyColossusShield(ally, amount, ultimateSource = null) {
    amount = Math.max(0, amount);
    if (!amount) return;
    if (ally.isArenaShip) { setArenaEnemyShield(ally, amount); return; }
    ally.maxShield = amount;
    ally.shield = amount;
    clearFireDust(ally);
    ally.shieldEl?.remove();
    const shield = document.createElement('div');
    shield.className = 'ally-shield colossus-reinforced';
    shield.innerHTML = `<em>AEGIS ${formatNumber(amount)}</em>`;
    ally.el.prepend(shield);
    ally.shieldEl = shield;
    addColossusShieldGauge(ally);
    ally.el.classList.add('colossus-shield-pulse');
    schedule(() => ally.el?.classList.remove('colossus-shield-pulse'), 1000);
    schedule(() => {
      if (ally.shieldEl !== shield) return;
      const remaining = Math.max(0, ally.shield);
      ally.shield = 0;
      ally.maxShield = 0;
      clearColossusShieldGauge(ally);
      ally.shieldEl = null;
      shield.remove();
      if (ultimateSource && remaining > 0 && !ally.dead) launchColossusShieldThrow(ally, remaining, ultimateSource);
    }, tacticalShieldDuration(COLOSSUS_MAIN.duration));
  }

  function launchColossusShieldThrow(ally, remaining, source) {
    if (!state || state.status !== 'combat' || !refs.effects) return;
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480, height = field?.height || 720;
    const angle = Number(ally.facingAngle) || 0;
    const vx = Math.sin(angle), vy = -Math.cos(angle);
    const origin = orientedAllyPoint(ally, 0, -.08);
    const distances = [
      vx > 0 ? (1 - origin.x) * width / vx : vx < 0 ? -origin.x * width / vx : Infinity,
      vy > 0 ? (1 - origin.y) * height / vy : vy < 0 ? -origin.y * height / vy : Infinity
    ].filter(value => value > 0);
    const distance = Math.max(80, Math.min(...distances) + 60);
    const shield = document.createElement('i');
    shield.className = 'fx-colossus-shield-throw';
    shield.style.left = percent(origin.x);
    shield.style.top = percent(origin.y);
    shield.style.setProperty('--colossus-shield-angle', `${angle}rad`);
    refs.effects.append(shield);
    state.colossusShieldThrows.push({ el: shield, source, damage: Math.round(remaining), origin, vx, vy, distance, elapsed: 0, hit: new Set() });
  }

  function updateColossusShieldThrows(dt) {
    if (!state?.colossusShieldThrows?.length) return;
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480, height = field?.height || 720;
    state.colossusShieldThrows = state.colossusShieldThrows.filter(throwing => {
      const previous = Math.min(1, throwing.elapsed / COLOSSUS_MAIN.throwDuration);
      throwing.elapsed += dt;
      const progress = Math.min(1, throwing.elapsed / COLOSSUS_MAIN.throwDuration);
      const fromX = throwing.origin.x * width + throwing.vx * throwing.distance * previous;
      const fromY = throwing.origin.y * height + throwing.vy * throwing.distance * previous;
      const toX = throwing.origin.x * width + throwing.vx * throwing.distance * progress;
      const toY = throwing.origin.y * height + throwing.vy * throwing.distance * progress;
      throwing.el.style.left = percent(toX / width);
      throwing.el.style.top = percent(toY / height);
      const segmentX = toX - fromX, segmentY = toY - fromY;
      const segmentLength = segmentX * segmentX + segmentY * segmentY;
      const touched = hostileTargetsFor(ally).filter(target => {
        if (throwing.hit.has(target)) return false;
        const enemyX = target.x * width, enemyY = target.y * height;
        const ratio = segmentLength ? Math.max(0, Math.min(1, ((enemyX - fromX) * segmentX + (enemyY - fromY) * segmentY) / segmentLength)) : 0;
        const nearestX = fromX + segmentX * ratio, nearestY = fromY + segmentY * ratio;
        const targetRect = target.el?.getBoundingClientRect();
        const radius = COLOSSUS_MAIN.throwRadius + Math.min(55, Math.max(12, Math.max(targetRect?.width || 0, targetRect?.height || 0) * .32));
        return Math.hypot(enemyX - nearestX, enemyY - nearestY) <= radius;
      }).sort((left, right) => (left.x * width - fromX) ** 2 + (left.y * height - fromY) ** 2 - (right.x * width - fromX) ** 2 - (right.y * height - fromY) ** 2);
      for (const target of touched) {
        if (throwing.hit.size >= COLOSSUS_MAIN.throwMaxHits || state.status !== 'combat') break;
        throwing.hit.add(target);
        shooterDamage(target, throwing.damage, throwing.source, 'shield');
        createExplosion(pointOf(target), 'colossus-shield-hit');
      }
      if (progress < 1 && throwing.hit.size < COLOSSUS_MAIN.throwMaxHits && state.status === 'combat') return true;
      throwing.el.remove();
      return false;
    });
  }

  function addColossusShieldGauge(ally) {
    clearColossusShieldGauge(ally);
    const health = ally.el?.querySelector('.ally-health');
    if (!health) return;
    const gauge = document.createElement('span');
    gauge.className = 'colossus-shield-gauge';
    gauge.innerHTML = '<i></i><em></em>';
    health.append(gauge);
    ally.shieldGauge = gauge;
    updateColossusShieldGauge(ally);
    updateNimitzShieldGauge(ally);
    updateCarrierShieldGauge(ally);
  }

  function updateColossusShieldGauge(ally) {
    if (!ally?.shieldGauge) return;
    const ratio = ally.maxShield ? Math.max(0, ally.shield / ally.maxShield * 100) : 0;
    const bar = ally.shieldGauge.querySelector('i');
    const label = ally.shieldGauge.querySelector('em');
    if (bar) bar.style.width = `${ratio}%`;
    if (label) label.textContent = formatNumber(Math.ceil(Math.max(0, ally.shield)));
  }

  function clearColossusShieldGauge(ally) {
    ally?.shieldGauge?.remove();
    if (ally) ally.shieldGauge = null;
  }

  function fireAegisRepair(ally) {
    const targets = friendliesOf(ally)
      .filter(candidate => candidate.hp < candidate.maxHp)
      .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp);
    if (!targets.length) return false;

    ally.charging = true;
    ally.el?.classList.add('aegis-repairing');
    const launch = orientedAllyPoint(ally, 0, .095);
    const droneCount = ally.aegisStars >= 3 ? AEGIS_REPAIR.enhancedDrones : 1;
    const launchGap = 120;
    const cycleDuration = AEGIS_REPAIR.travel + AEGIS_REPAIR.duration + AEGIS_REPAIR.returnDelay;
    for (let index = 0; index < droneCount; index += 1) {
      // 각 드론이 손상 비율이 낮은 아군부터 맡고, 대상 수보다 드론이 많으면 분담 수리한다.
      const target = targets[index % targets.length];
      const drone = document.createElement('i');
      drone.className = 'fx-aegis-drone';
      drone.style.left = percent(launch.x);
      drone.style.top = percent(launch.y);
      refs.effects.append(drone);
      const offset = index * launchGap;
      schedule(() => {
        if (target.dead) return;
        requestAnimationFrame(() => {
          drone.style.left = percent(target.x);
          drone.style.top = percent(target.y);
        });
        schedule(() => {
          if (target.dead) return;
          drone.classList.add('repairing');
          const repairPerTick = target.maxHp * AEGIS_REPAIR.amount / AEGIS_REPAIR.ticks;
          for (let tick = 0; tick < AEGIS_REPAIR.ticks; tick += 1) {
            schedule(() => repairAlly(target, repairPerTick), tick * (AEGIS_REPAIR.duration / AEGIS_REPAIR.ticks));
          }
        }, AEGIS_REPAIR.travel);
        schedule(() => {
          drone.classList.remove('repairing');
          drone.style.left = percent(launch.x);
          drone.style.top = percent(launch.y);
        }, AEGIS_REPAIR.travel + AEGIS_REPAIR.duration);
        schedule(() => drone.remove(), cycleDuration);
      }, offset);
    }
    announce(`${ally.ship.name} · 수리 드론 ${droneCount}기`, 'friendly');
    schedule(() => {
      ally.charging = false;
      ally.el?.classList.remove('aegis-repairing');
    }, cycleDuration + (droneCount - 1) * launchGap);
    return true;
  }

  function repairAlly(ally, amount) {
    if (!ally || ally.dead || !amount) return;
    clearFireDust(ally);
    ally.hp = Math.min(ally.maxHp, ally.hp + amount);
    ally.healthBar.style.width = `${Math.max(0, ally.hp / ally.maxHp * 100)}%`;
    flashTarget(ally);
  }

  function fireIowaTomahawk(ally) {
    const target = inRangeTargetsFor(ally).sort((a, b) => a.hp - b.hp)[0];
    if (!target) return false;
    const enhanced = ally.iowaStars >= 3;
    const commandSkill = ally.iowaStars >= 5;
    faceAllyTowardTarget(ally, target);
    const from = orientedAllyPoint(ally, 0, -.105);
    const to = pointOf(target);
    const missile = document.createElement('i');
    missile.className = 'fx-missile iowa-tomahawk';
    positionProjectile(missile, from, to);
    refs.effects.append(missile);
    schedule(() => missile.remove(), IOWA_TOMAHAWK.travel + 150);
    schedule(() => {
      const liveTarget = target && !target.dead ? target : inRangeTargetsFor(ally).sort((a, b) => a.hp - b.hp)[0];
      const impact = liveTarget ? pointOf(liveTarget) : to;
      const hits = enhanced ? IOWA_TOMAHAWK.enhancedHits : IOWA_TOMAHAWK.hits;
      if (liveTarget) shooterDamage(liveTarget, hits, null, 'missile');
      if (enhanced) {
        const field = refs.field.getBoundingClientRect();
        hostileTargetsFor(ally).filter(candidate => candidate !== liveTarget && !candidate.dead &&
          Math.hypot((candidate.x - impact.x) * field.width, (candidate.y - impact.y) * field.height) <= IOWA_TOMAHAWK.splashRadius)
          .forEach(candidate => shooterDamage(candidate, hits, null, 'missile'));
      }
      if (commandSkill) hostileTargetsFor(ally).filter(candidate => !candidate.dead &&
        Math.hypot((candidate.x - impact.x) * refs.field.clientWidth, (candidate.y - impact.y) * refs.field.clientHeight) <= IOWA_TOMAHAWK.splashRadius)
        .forEach(candidate => applyTimedEnemyStun(candidate, IOWA_TOMAHAWK.stun));
      if (commandSkill) boostAlliedFleetAttackSpeed(IOWA_TOMAHAWK.fleetSpeedBonus, IOWA_TOMAHAWK.fleetSpeedDuration, `${ally.ship.name} · 지휘`);
      createExplosion(impact, 'missile');
    }, IOWA_TOMAHAWK.travel);
    announce(`${ally.ship.name} · 토마호크 발사`, 'friendly');
    return true;
  }

  function applyTimedEnemyStun(target, duration) {
    if (!target || target.dead) return;
    target.stun = Math.max(Number(target.stun) || 0, duration);
    target.el?.classList.add('stunned');
    schedule(() => {
      if (Number(target.stun) <= 0) target.el?.classList.remove('stunned');
    }, duration + 60);
  }

  function boostAlliedFleetAttackSpeed(bonus, duration, message) {
    if (!state) return;
    state.fleetAttackSpeedBoostUntil = Math.max(Number(state.fleetAttackSpeedBoostUntil) || 0, performance.now() + duration);
    announce(`${message} · 아군 공속 +${Math.round(bonus * 100)}%`, 'friendly');
  }

  function fireHeliosRefraction(ally) {
    const targets = shooterTargetsFor(ally);
    if (!targets.length) return false;
    const sequence = [targets[0]];
    const candidates = targets.slice(1);
    for (let index = 0; index < HELIOS_REFRACTION.chains && candidates.length; index += 1) {
      const pick = Math.floor(Math.random() * candidates.length);
      sequence.push(candidates.splice(pick, 1)[0]);
    }
    sequence.forEach((target, index) => {
      const from = index ? pointOf(sequence[index - 1]) : orientedAllyPoint(ally, 0, -.05);
      schedule(() => {
        playRLaserSound();
        const beam = document.createElement('i');
        beam.className = 'fx-line helios-laser';
        positionLine(beam, from, pointOf(target));
        refs.effects.append(beam);
        schedule(() => beam.remove(), HELIOS_REFRACTION.travel + 30);
      }, index * 45);
      schedule(() => {
        if (!target.dead) shooterDamage(target, Math.max(1, Math.round(HELIOS_REFRACTION.hits * Math.pow(.5, index))));
      }, HELIOS_REFRACTION.travel + index * 45);
    });
    return true;
  }

  function fireHeliosMainBattery(ally) {
    ally.el.classList.add('helios-main-firing');
    announce(`${ally.ship.name} · 강화 굴절레이저`, 'friendly');
    const interval = HELIOS_MAIN.duration / HELIOS_MAIN.shots;
    for (let index = 0; index < HELIOS_MAIN.shots; index += 1) {
      schedule(() => {
        const target = shooterTargetFor(ally);
        if (!target) return;
        const from = orientedAllyPoint(ally, 0, -.05);
        const to = pointOf(target);
        playRLaserSound();
        const beam = document.createElement('i');
        beam.className = 'fx-line helios-laser';
        positionLine(beam, from, to);
        refs.effects.append(beam);
        schedule(() => beam.remove(), HELIOS_MAIN.travel + 30);
        const hits = ally.heliosStars >= 3 ? HELIOS_MAIN.enhancedHits : HELIOS_MAIN.hits;
        schedule(() => { if (!target.dead) shooterDamage(target, hits); }, HELIOS_MAIN.travel);
      }, index * interval);
    }
    schedule(() => {
      ally.rechargePause = HELIOS_MAIN.rechargePause;
      ally.el?.classList.remove('helios-main-firing');
    }, HELIOS_MAIN.duration + HELIOS_MAIN.travel);
    return true;
  }

  function hyperionMuzzlePoints(ally) {
    const direction = ally.hyperionJumped ? 1 : -1;
    return [{ x: -.018, y: direction * .09 }, { x: .018, y: direction * .09 }, { x: -.09, y: direction * .008 }, { x: .09, y: direction * .008 }]
      .map(point => orientedAllyPoint(ally, point.x, point.y));
  }

  function hyperionMainMuzzlePoints(ally) {
    const direction = ally.hyperionJumped ? 1 : -1;
    const forward = hyperionMuzzlePoints(ally);
    const waist = [{ x: -.103, y: direction * .018 }, { x: -.101, y: direction * .052 }, { x: .103, y: direction * .018 }, { x: .101, y: direction * .052 }]
      .map(point => orientedAllyPoint(ally, point.x, point.y));
    return forward.concat(waist);
  }

  function drawHyperionLaser(from, target) {
    playCruiserLaserSound();
    const beam = document.createElement('i');
    beam.className = 'fx-line hyperion-laser';
    positionLine(beam, from, pointOf(target));
    refs.effects.append(beam);
    schedule(() => beam.remove(), HYPERION_LASER.travel + 40);
  }

  function fireHyperionLaser(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    const muzzleIndex = ally.hyperionMuzzleIndex || 0;
    ally.hyperionMuzzleIndex = (muzzleIndex + 1) % 4;
    drawHyperionLaser(hyperionMuzzlePoints(ally)[muzzleIndex], target);
    schedule(() => {
      if (!target.dead) shooterDamage(target, HYPERION_LASER.hits);
    }, HYPERION_LASER.travel);
    return true;
  }

  function hyperionTeleportTrace(ally, point, angle = null) {
    const trace = document.createElement('div');
    trace.className = 'hyperion-jump-trace';
    trace.style.left = percent(point.x);
    trace.style.top = percent(point.y);
    trace.innerHTML = '<div class="ship-topview hyperion-topview"><img src="hyperion-battle-topview.png" alt="" /></div>';
    if (Number.isFinite(angle)) trace.querySelector('.hyperion-topview')?.style.setProperty('transform', `rotate(${angle}rad)`);
    refs.effects.append(trace);
    schedule(() => trace.remove(), 620);
  }

  function weakestEnemyTarget(ally) {
    const target = inRangeTargetsFor(ally).sort((a, b) => a.hp - b.hp)[0] || null;
    faceAllyTowardTarget(ally, target);
    return target;
  }

  function hyperionJumpPoint(ally) {
    const targets = hostileTargetsFor(ally);
    // 후방은 아군 쪽이면 위(화면 위쪽), 아레나 상대 함선이면 아래(아군 쪽)의 반대편이다(진영 대칭).
    const rearY = ally.isArenaShip
      ? Math.max(.76, Math.min(.93, Math.max(...targets.map(target => target.y)) + .105))
      : Math.max(.07, Math.min(.24, Math.min(...targets.map(target => target.y)) - .105));
    const candidates = [.12, .25, .38, .5, .62, .75, .88].map(x => ({ x, y: rearY }));
    return candidates.sort((a, b) => {
      const distanceToEnemy = point => Math.min(...targets.map(enemy => Math.hypot(point.x - enemy.x, point.y - enemy.y)), 1);
      return distanceToEnemy(b) - distanceToEnemy(a);
    })[0] || { x: ally.x, y: .105 };
  }

  function hyperionCrowdedHeading(from, ally) {
    const targets = hostileTargetsFor(ally);
    const sectors = Array.from({ length: 8 }, () => ({ count: 0, distance: 0 }));
    targets.forEach(target => {
      const dx = target.x - from.x;
      const dy = target.y - from.y;
      const distance = Math.hypot(dx, dy);
      if (distance < .015) return;
      const angle = Math.atan2(dy, dx);
      const sector = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * sectors.length) % sectors.length;
      sectors[sector].count += 1;
      sectors[sector].distance += distance;
    });
    const selected = sectors.reduce((best, sector, index) => {
      if (sector.count > best.count || sector.count === best.count && sector.distance < best.distance) return { ...sector, index };
      return best;
    }, { count: -1, distance: Infinity, index: 0 });
    const angle = -Math.PI + (selected.index + .5) / sectors.length * Math.PI * 2;
    // 이동 가능한 세로 범위도 진영별로 대칭이다(아군 .07~.79, 아레나 상대 .21~.93).
    const minY = ally.isArenaShip ? .21 : .07;
    const maxY = ally.isArenaShip ? .93 : .79;
    return { angle, x: Math.max(.08, Math.min(.92, from.x + Math.cos(angle) * HYPERION_MAIN.movementDistance)), y: Math.max(minY, Math.min(maxY, from.y + Math.sin(angle) * HYPERION_MAIN.movementDistance)) };
  }

  function setHyperionJumpFacing(ally, heading) {
    if (!ally?.facingShell && ally?.isArenaShip) {
      // 아레나 상대 함선은 모델 자체를 돌린다(아군 facingShell과 같은 각도 규칙).
      ally.hyperionFacingAngle = heading + Math.PI / 2;
      ally.facingAngle = ally.hyperionFacingAngle;
      ally.hyperionFacingLocked = true;
      ally.el?.querySelector('.arena-enemy-model')?.style.setProperty('transform', `scale(.86) rotate(${ally.hyperionFacingAngle}rad)`);
      return;
    }
    if (!ally?.facingShell) return;
    ally.hyperionFacingAngle = heading + Math.PI / 2;
    ally.facingAngle = ally.hyperionFacingAngle;
    ally.hyperionFacingLocked = true;
    ally.facingShell.style.setProperty('--ally-facing-angle', `${ally.hyperionFacingAngle}rad`);
  }

  function hyperionTargetsAlongHeading(ally, heading) {
    return shooterTargetsFor(ally)
      .filter(target => Math.abs(Math.atan2(Math.sin(Math.atan2(target.y - ally.y, target.x - ally.x) - heading), Math.cos(Math.atan2(target.y - ally.y, target.x - ally.x) - heading))) < Math.PI / 3);
  }

  function applyHyperionEnergyDisruption(center, ally) {
    const field = document.createElement('i');
    field.className = 'hyperion-emp-field';
    field.style.left = percent(center.x);
    field.style.top = percent(center.y);
    refs.effects.append(field);
    schedule(() => field.remove(), 1050);
    const bounds = refs.field.getBoundingClientRect();
    hostileTargetsFor(ally).filter(target => Math.hypot((target.x - center.x) * bounds.width, (target.y - center.y) * bounds.height) <= HYPERION_MAX_OUTPUT.disruptionRadius).forEach(target => {
      const until = performance.now() + HYPERION_MAX_OUTPUT.disruptionDuration;
      target.energyRechargeDisabledUntil = Math.max(Number(target.energyRechargeDisabledUntil) || 0, until);
      target.hyperionDisruptedUntil = Math.max(Number(target.hyperionDisruptedUntil) || 0, until);
      applyTimedEnemyStun(target, HYPERION_MAX_OUTPUT.disruptionDuration);
      target.el?.classList.add('hyperion-emp-stunned');
      schedule(() => { if (performance.now() >= Number(target.hyperionDisruptedUntil || 0)) target.el?.classList.remove('hyperion-emp-stunned'); }, HYPERION_MAX_OUTPUT.disruptionDuration + 80);
    });
    announce(`${ally.ship.name} · 에너지 장 교란`, 'friendly');
  }

  function fireHyperionJump(ally) {
    if (!hostileTargetsFor(ally).length) return false;
    const maxOutputUnlocked = ally.hyperionStars >= 3;
    const barrageDuration = Math.round(HYPERION_MAIN.duration * (maxOutputUnlocked ? HYPERION_MAX_OUTPUT.durationMultiplier : 1));
    const origin = { x: ally.x, y: ally.y };
    const destination = hyperionJumpPoint(ally);
    const heading = hyperionCrowdedHeading(destination, ally);
    const departure = { x: destination.x, y: destination.y };
    const movementEnd = { x: heading.x, y: heading.y };
    ally.charging = true;
    ally.el.classList.add('hyperion-jumping');
    playHyperionWarpSound();
    hyperionTeleportTrace(ally, origin);
    ally.x = destination.x;
    ally.y = destination.y;
    ally.hyperionJumped = true;
    ally.el.style.left = percent(ally.x);
    ally.el.style.top = percent(ally.y);
    setHyperionJumpFacing(ally, heading.angle);
    announce(`${ally.ship.name} · 함선 도약`, 'friendly');
    const shots = Math.ceil(barrageDuration / HYPERION_MAIN.interval);
    for (let step = 1; step <= HYPERION_MAIN.movementSteps; step += 1) {
      schedule(() => {
        if (ally.dead || !ally.charging) return;
        const ratio = step / HYPERION_MAIN.movementSteps;
        ally.x = departure.x + (movementEnd.x - departure.x) * ratio;
        ally.y = departure.y + (movementEnd.y - departure.y) * ratio;
        ally.el.style.left = percent(ally.x);
        ally.el.style.top = percent(ally.y);
      }, step * barrageDuration / HYPERION_MAIN.movementSteps);
    }
    for (let shot = 0; shot < shots; shot += 1) {
      schedule(() => {
        if (ally.dead) return;
        const targets = hyperionTargetsAlongHeading(ally, heading.angle);
        const fallbackTargets = shooterTargetsFor(ally);
        const targetPool = targets.length ? targets : fallbackTargets;
        if (!targetPool.length) return;
        const muzzles = hyperionMainMuzzlePoints(ally);
        const muzzle = muzzles[shot % muzzles.length];
        const target = targetPool[Math.floor(Math.random() * targetPool.length)];
        faceAllyTowardTarget(ally, target);
        drawHyperionLaser(muzzle, target);
        schedule(() => { if (!target.dead) shooterDamage(target, HYPERION_MAIN.hits); }, HYPERION_MAIN.travel);
      }, shot * HYPERION_MAIN.interval);
    }
    schedule(() => {
      if (!ally.dead && state?.status === 'combat') playHyperionWarpSound();
      hyperionTeleportTrace(ally, movementEnd, ally.hyperionFacingAngle);
      ally.x = origin.x;
      ally.y = origin.y;
      ally.hyperionJumped = false;
      ally.el.style.left = percent(ally.x);
      ally.el.style.top = percent(ally.y);
      ally.charging = false;
      ally.hyperionFacingLocked = false;
      ally.el?.classList.remove('hyperion-jumping');
    }, barrageDuration + HYPERION_MAIN.returnDelay);
    if (maxOutputUnlocked) schedule(() => applyHyperionEnergyDisruption(origin, ally), barrageDuration + HYPERION_MAIN.returnDelay);
    return true;
  }

  function apocalypseMuzzlePoints(ally) {
    return [{ x: -.07, y: -.048 }, { x: .07, y: -.048 }, { x: -.052, y: .004 }, { x: .052, y: .004 }]
      .map(point => orientedAllyPoint(ally, point.x, point.y));
  }

  function apocalypseHeavyMuzzlePoint(ally) {
    return orientedAllyPoint(ally, 0, -.12);
  }

  function drawApocalypseLaser(from, target, heavy = false) {
    playRLaserSound();
    const beam = document.createElement('i');
    beam.className = `fx-line apocalypse-laser${heavy ? ' apocalypse-heavy-laser' : ''}`;
    positionLine(beam, from, pointOf(target));
    refs.effects.append(beam);
    schedule(() => beam.remove(), APOCALYPSE_LASER.travel + 40);
  }

  function fireApocalypseLaser(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    const muzzleIndex = ally.apocalypseMuzzleIndex || 0;
    ally.apocalypseMuzzleIndex = (muzzleIndex + 1) % 4;
    drawApocalypseLaser(apocalypseMuzzlePoints(ally)[muzzleIndex], target);
    schedule(() => { if (!target.dead) shooterDamage(target, APOCALYPSE_LASER.hits); }, APOCALYPSE_LASER.travel);
    return true;
  }

  function fireApocalypseMainBattery(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    ally.charging = true;
    ally.el.classList.add('apocalypse-main-charging');
    announce(`${ally.ship.name} · 집중포격 장전`, 'friendly');
    const enhanced = ally.apocalypseStars >= 3;
    const salvoCount = enhanced ? APOCALYPSE_MAIN.enhancedShots : APOCALYPSE_MAIN.salvos;
    for (let salvo = 0; salvo < salvoCount; salvo += 1) {
      schedule(() => {
        const liveTarget = shooterTargetFor(ally);
        if (!liveTarget || ally.dead) return;
        if (enhanced) {
          const muzzle = apocalypseMuzzlePoints(ally)[salvo % 4];
          drawApocalypseLaser(muzzle, liveTarget, true);
          schedule(() => { if (!liveTarget.dead) shooterDamage(liveTarget, APOCALYPSE_MAIN.enhancedHits); }, APOCALYPSE_MAIN.travel);
          return;
        }
        apocalypseMuzzlePoints(ally).forEach(muzzle => {
          drawApocalypseLaser(muzzle, liveTarget);
          schedule(() => { if (!liveTarget.dead) shooterDamage(liveTarget, APOCALYPSE_LASER.hits); }, APOCALYPSE_MAIN.travel);
        });
        drawApocalypseLaser(apocalypseHeavyMuzzlePoint(ally), liveTarget, true);
        schedule(() => { if (!liveTarget.dead) shooterDamage(liveTarget, APOCALYPSE_MAIN.heavyHits); }, APOCALYPSE_MAIN.travel);
      }, APOCALYPSE_MAIN.charge + salvo * APOCALYPSE_MAIN.interval);
    }
    schedule(() => {
      ally.charging = false;
      ally.el?.classList.remove('apocalypse-main-charging');
    }, APOCALYPSE_MAIN.charge + salvoCount * APOCALYPSE_MAIN.interval + APOCALYPSE_MAIN.travel);
    return true;
  }

  function nemesisMuzzlePoints(ally) {
    return [{ x: -.046, y: -.012 }, { x: .046, y: -.012 }]
      .map(point => orientedAllyPoint(ally, point.x, point.y));
  }

  function distanceToBeam(point, from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const projection = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared));
    return Math.hypot(point.x - (from.x + dx * projection), point.y - (from.y + dy * projection));
  }

  function yamatoBeamTouchesTarget(target, from, to, beamWidthPx) {
    const field = refs.field?.getBoundingClientRect();
    if (!field?.width || !field?.height) return false;
    const start = { x: from.x * field.width, y: from.y * field.height };
    const end = { x: to.x * field.width, y: to.y * field.height };
    const center = { x: target.x * field.width, y: target.y * field.height };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const projection = Math.max(0, Math.min(1, ((center.x - start.x) * dx + (center.y - start.y) * dy) / lengthSquared));
    const distance = Math.hypot(center.x - (start.x + projection * dx), center.y - (start.y + projection * dy));
    const bounds = target.el?.getBoundingClientRect();
    const targetRadius = Math.max(bounds?.width || 18, bounds?.height || 18) * .36;
    return distance <= beamWidthPx / 2 + targetRadius;
  }

  function pegasusMuzzlePoint(ally, localX, localY) {
    // 아레나 상대 함선은 화면 요소(facingShell)가 없으므로, 함선 방향 기준 좌표 계산으로 같은 위치를 구한다.
    if (!ally.facingShell) {
      const size = refs.field?.getBoundingClientRect();
      return orientedAllyPoint(ally, localX / (size?.width || 480), localY / (size?.height || 720));
    }
    const field = refs.field.getBoundingClientRect();
    const shell = ally.facingShell.getBoundingClientRect();
    const transform = getComputedStyle(ally.facingShell).transform;
    const matrix = transform === 'none' ? null : new DOMMatrixReadOnly(transform);
    const angle = matrix ? Math.atan2(matrix.b, matrix.a) : 0;
    const scale = ally.el.getBoundingClientRect().width / (ally.el.offsetWidth || 104);
    const x = shell.left + shell.width / 2 - field.left + (localX * Math.cos(angle) - localY * Math.sin(angle)) * scale;
    const y = shell.top + shell.height / 2 - field.top + (localX * Math.sin(angle) + localY * Math.cos(angle)) * scale;
    return { x: x / (field.width || 1), y: y / (field.height || 1) };
  }

  function pegasusSternMuzzlePoints(ally) {
    return [-14, 14].map(x => pegasusMuzzlePoint(ally, x, 40));
  }

  function pegasusSideMuzzlePoints(ally) {
    return [-27, 27].map(x => pegasusMuzzlePoint(ally, x, -3));
  }

  function extendPegasusBeam(from, target) {
    const targetPoint = pointOf(target);
    return {
      x: from.x + (targetPoint.x - from.x) * 4.5,
      y: from.y + (targetPoint.y - from.y) * 4.5
    };
  }

  function firePegasusTrackingBeam(ally, initialTarget, muzzlePoint, profile, className, retarget = () => shooterTargetsFor(ally)[0] || null) {
    let target = initialTarget;
    let active = true;
    let frame = 0;
    const token = generation;
    const beam = document.createElement('i');
    beam.className = `fx-line pegasus-piercing-laser ${className}`;
    refs.effects.append(beam);
    const normalBeams = className === 'pegasus-normal-laser' ? (ally.pegasusNormalBeams ||= new Set()) : null;
    const handle = {
      cancel() {
        if (!active) return;
        active = false;
        cancelAnimationFrame(frame);
        beam.remove();
        normalBeams?.delete(handle);
      }
    };
    normalBeams?.add(handle);

    const refreshBeam = () => {
      if (!active || ally.dead || token !== generation || state.status !== 'combat') {
        handle.cancel();
        return null;
      }
      if (!target || target.dead || !inRangeTargetsFor(ally).includes(target)) {
        target = retarget();
      }
      if (!target) {
        beam.hidden = true;
        return null;
      }
      beam.hidden = false;
      const from = muzzlePoint();
      const to = extendPegasusBeam(from, target);
      positionLine(beam, from, to);
      return { from, to };
    };

    const render = () => {
      refreshBeam();
      if (active) frame = requestAnimationFrame(render);
    };
    render();
    for (let elapsed = 0; elapsed < profile.duration; elapsed += profile.tick) {
      schedule(() => {
        const geometry = refreshBeam();
        if (!geometry) return;
        inRangeTargetsFor(ally).forEach(candidate => {
          if (!candidate.dead && distanceToBeam(pointOf(candidate), geometry.from, geometry.to) < profile.width) {
            shooterDamage(candidate, profile.hits, ally);
          }
        });
      }, elapsed);
    }
    schedule(() => handle.cancel(), profile.duration);
    return handle;
  }

  function firePegasusPiercingLasers(ally) {
    const targets = shooterTargetsFor(ally);
    const primary = targets[0];
    if (!primary) return false;
    playPenetrateBeamSound();
    faceAllyTowardTarget(ally, primary);
    pegasusSternMuzzlePoints(ally).forEach((_, index) => {
      const target = targets[index] || primary;
      firePegasusTrackingBeam(
        ally,
        target,
        () => pegasusSternMuzzlePoints(ally)[index],
        PEGASUS_LASER,
        'pegasus-normal-laser'
      );
    });
    return true;
  }

  function pegasusRayToEdge(x, y, dx, dy, width, height) {
    return Math.min(
      dx > 0 ? (width - x) / dx : dx < 0 ? -x / dx : Infinity,
      dy > 0 ? (height - y) / dy : dy < 0 ? -y / dy : Infinity
    );
  }

  function launchPegasusLance(ally) {
    if (ally.dead || state.status !== 'combat') return;
    const field = refs.field?.getBoundingClientRect();
    if (!field?.width || !field?.height) return;
    const angle = ally.facingAngle - Math.PI / 2;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const x = ally.x * field.width, y = ally.y * field.height;
    const behind = pegasusRayToEdge(x, y, -dx, -dy, field.width, field.height) + 80;
    const ahead = pegasusRayToEdge(x, y, dx, dy, field.width, field.height) + 80;
    const start = { x: x - dx * behind, y: y - dy * behind };
    const lance = document.createElement('i');
    lance.className = 'fx-pegasus-silver-lance';
    lance.style.left = `${start.x}px`;
    lance.style.top = `${start.y}px`;
    lance.style.setProperty('--pegasus-lance-angle', `${angle}rad`);
    refs.effects.append(lance);
    state.pegasusLances.push({ el: lance, owner: ally, start, dx, dy, distance: behind + ahead, elapsed: 0, hit: new Set() });
    announce(`${ally.ship.name} · 벨레로폰의 창`, 'friendly');
  }

  function updatePegasusLances(dt) {
    if (!state?.pegasusLances?.length) return;
    state.pegasusLances = state.pegasusLances.filter(lance => {
      if (lance.owner.dead || state.status !== 'combat') {
        lance.el.remove();
        return false;
      }
      lance.elapsed = Math.min(PEGASUS_LANCE.travel, lance.elapsed + dt);
      const tipDistance = lance.distance * lance.elapsed / PEGASUS_LANCE.travel;
      lance.el.style.left = `${lance.start.x + lance.dx * tipDistance}px`;
      lance.el.style.top = `${lance.start.y + lance.dy * tipDistance}px`;
      const field = refs.field.getBoundingClientRect();
      for (const target of hostileTargetsFor(lance.owner)) {
        if (lance.hit.has(target)) continue;
        const relativeX = target.x * field.width - lance.start.x;
        const relativeY = target.y * field.height - lance.start.y;
        const along = relativeX * lance.dx + relativeY * lance.dy;
        const bounds = target.el?.getBoundingClientRect();
        const radius = Math.min(48, Math.max(bounds?.width || 18, bounds?.height || 18) * .35);
        if (along > tipDistance + radius || along < tipDistance - PEGASUS_LANCE.length - radius) continue;
        const offset = Math.abs(relativeX * lance.dy - relativeY * lance.dx);
        const pierceWidth = 13 + radius * .5;
        const grazeWidth = 38 + radius * .7;
        if (offset > grazeWidth) continue;
        lance.hit.add(target);
        shooterDamage(target, offset <= pierceWidth ? PEGASUS_LANCE.pierceHits : PEGASUS_LANCE.grazeHits, lance.owner);
        createExplosion(pointOf(target), 'laser');
        if (state.status !== 'combat') break;
      }
      if (lance.elapsed < PEGASUS_LANCE.travel && state.status === 'combat') return true;
      lance.el.remove();
      return false;
    });
  }

  function firePegasusAnnihilation(ally) {
    const target = strongestEnemyTarget(ally);
    if (!target) return false;
    playPenetrateBeamSound();
    ally.pegasusNormalBeams?.forEach(handle => handle.cancel());
    ally.charging = true;
    ally.el?.classList.add('pegasus-annihilating');
    pegasusSideMuzzlePoints(ally).forEach((_, index) => {
      firePegasusTrackingBeam(
        ally,
        target,
        () => pegasusSideMuzzlePoints(ally)[index],
        PEGASUS_ANNIHILATION,
        'pegasus-annihilation-laser',
        () => strongestEnemyTarget(ally)
      );
    });
    schedule(() => {
      if (ally.dead) return;
      ally.el?.classList.remove('pegasus-annihilating');
      ally.el?.classList.add('pegasus-incapacitated');
      if (ally.pegasusStars >= 3) {
        for (let tick = 1; tick <= PEGASUS_RECOVERY.duration / 1000; tick += 1) {
          schedule(() => {
            if (ally.dead || state.status !== 'combat' || !ally.el?.classList.contains('pegasus-incapacitated')) return;
            const previousHp = ally.hp;
            ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * .05);
            ally.healthBar.style.width = `${Math.max(0, ally.hp / ally.maxHp * 100)}%`;
            if (ally.hp > previousHp) showUnitDamage(ally, `+${formatNumber(Math.round(ally.hp - previousHp))}`);
            ally.el?.classList.add('pegasus-healing');
            schedule(() => ally.el?.classList.remove('pegasus-healing'), 460);
          }, tick * 1000);
        }
      }
      schedule(() => {
        if (ally.dead) return;
        ally.charging = false;
        ally.el?.classList.remove('pegasus-incapacitated', 'pegasus-healing');
      }, PEGASUS_RECOVERY.duration);
    }, PEGASUS_ANNIHILATION.duration);
    return true;
  }

  function fireNemesisPiercingLaser(ally) {
    const primary = shooterTargetFor(ally);
    if (!primary) return false;
    playPenetrateBeamSound();
    // 레이저가 발사되는 동안에는 함선 방향을 바꾸지 않는다.
    ally.facingLockUntil = performance.now() + NEMESIS_LASER.duration + 60;
    const beams = nemesisMuzzlePoints(ally).map((from, index) => {
      const target = index ? shooterTargetsFor(ally)[1] || primary : primary;
      const targetPoint = pointOf(target);
      const to = { x: from.x + (targetPoint.x - from.x) * 5, y: from.y + (targetPoint.y - from.y) * 5 };
      const beam = document.createElement('i');
      beam.className = 'fx-line nemesis-piercing-laser';
      positionLine(beam, from, to);
      refs.effects.append(beam);
      schedule(() => beam.remove(), NEMESIS_LASER.duration);
      return { from, to };
    });
    for (let tick = 0; tick < NEMESIS_LASER.duration / NEMESIS_LASER.tick; tick += 1) {
      schedule(() => {
        beams.forEach(beam => {
          inRangeTargetsFor(ally).forEach(target => {
            if (!target.dead && distanceToBeam(pointOf(target), beam.from, beam.to) < .035) shooterDamage(target, NEMESIS_LASER.hits);
          });
        });
      }, tick * NEMESIS_LASER.tick);
    }
    return true;
  }

  function strongestEnemyTarget(ally) {
    const target = inRangeTargetsFor(ally).sort((a, b) => (b.attackPower || 0) - (a.attackPower || 0))[0] || null;
    faceAllyTowardTarget(ally, target);
    return target;
  }

  function fireNemesisElectricNet(ally) {
    const candidates = inRangeTargetsFor(ally)
      .sort((a, b) => (b.attackPower || 0) - (a.attackPower || 0));
    if (!candidates.length) return false;
    const count = ally.nemesisStars >= 5 ? 3 : ally.nemesisStars >= 3 ? 2 : 1;
    const targets = Array.from({ length: count }, (_, index) => candidates[index % candidates.length]);
    faceAllyTowardTarget(ally, candidates[0]);
    // 5성에서는 전기그물을 유지하는 동안에도 관통레이저 공격과 에너지 충전을 계속한다.
    if (ally.nemesisStars < 5) ally.charging = true;
    targets.forEach((selectedTarget, index) => {
      schedule(() => {
        if (ally.dead || state?.status !== 'combat') return;
        const target = selectedTarget && !selectedTarget.dead ? selectedTarget : strongestEnemyTarget(ally);
        if (!target) return;
        const orb = document.createElement('i');
        orb.className = 'fx-nemesis-orb';
        positionProjectile(orb, orientedAllyPoint(ally, 0, -.108), pointOf(target));
        refs.effects.append(orb);
        schedule(() => orb.remove(), NEMESIS_NET.travel + 50);
        schedule(() => {
          const liveTarget = target && !target.dead ? target : strongestEnemyTarget(ally);
          if (!liveTarget) return;
          const point = pointOf(liveTarget);
          liveTarget.stun = Math.max(liveTarget.stun || 0, NEMESIS_NET.duration);
          liveTarget.energy = 0;
          liveTarget.rechargePause = NEMESIS_NET.duration;
          liveTarget.nemesisNetUntil = performance.now() + NEMESIS_NET.duration;
          liveTarget.el?.classList.add('electrified-net');
          const cage = document.createElement('i');
          cage.className = 'fx-nemesis-net';
          cage.style.left = percent(point.x);
          cage.style.top = percent(point.y);
          const targetRect = liveTarget.el?.getBoundingClientRect();
          const diameter = Math.max(46, Math.max(targetRect?.width || 0, targetRect?.height || 0) * 1.38);
          cage.style.width = `${diameter}px`;
          cage.style.height = `${diameter}px`;
          cage.style.marginLeft = `${-diameter / 2}px`;
          cage.style.marginTop = `${-diameter / 2}px`;
          refs.effects.append(cage);
          ally.nemesisNetCount = (ally.nemesisNetCount || 0) + 1;
          ally.nemesisNetActive = true;
          ally.el?.classList.add('nemesis-net-active');
          schedule(() => {
            cage.remove();
            if (performance.now() >= liveTarget.nemesisNetUntil) liveTarget.el?.classList.remove('electrified-net');
            ally.nemesisNetCount = Math.max(0, (ally.nemesisNetCount || 0) - 1);
            ally.nemesisNetActive = ally.nemesisNetCount > 0;
            if (!ally.nemesisNetActive) ally.el?.classList.remove('nemesis-net-active');
          }, NEMESIS_NET.duration);
        }, NEMESIS_NET.travel);
      }, index * NEMESIS_NET.launchGap);
    });
    if (ally.nemesisStars < 5) {
      schedule(() => { if (!ally.dead) ally.charging = false; }, NEMESIS_NET.travel + NEMESIS_NET.duration + (count - 1) * NEMESIS_NET.launchGap);
    }
    announce(`${ally.ship.name} · 전기그물 ${count}개`, 'friendly');
    return true;
  }

  function fireMagellanCannon(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    const muzzleIndex = ally.magellanMuzzleIndex || 0;
    ally.magellanMuzzleIndex = (muzzleIndex + 1) % 8;
    drawIowaMuzzleFlash(magellanMuzzlePoint(ally, muzzleIndex), 'magellan');
    schedule(() => {
      if (!target.dead) {
        shooterDamage(target, MAGELLAN_CANNON.hits, ally, 'cannon');
        createExplosion(pointOf(target), 'cannon');
      }
    }, 90);
    return true;
  }

  function fireMagellanMainBattery(ally) {
    const targets = shooterTargetsFor(ally);
    if (!targets.length) return false;
    const anchor = targets.slice().sort((a, b) => a.hp - b.hp)[0];
    const point = { x: anchor.x, y: Math.max(.08, anchor.y - .1) };
    const enhanced = ally.magellanStars >= 3;
    const commandSkill = ally.magellanStars >= 5;
    ally.charging = true;
    ally.el.classList.add('magellan-main-firing');
    announce(`${ally.ship.name} · 집중포화`, 'friendly');
    if (commandSkill) boostAlliedFleetAttackSpeed(MAGELLAN_MAIN.fleetSpeedBonus, MAGELLAN_MAIN.fleetSpeedDuration, `${ally.ship.name} · 지휘`);
    for (let volley = 0; volley < 6; volley += 1) {
      schedule(() => {
        for (let muzzle = 0; muzzle < 8; muzzle += 1) {
          drawIowaMuzzleFlash(magellanMuzzlePoint(ally, muzzle), 'magellan');
        }
      }, volley * 500);
    }
    for (let second = 0; second < 3; second += 1) {
      schedule(() => {
        hostileTargetsFor(ally)
          .filter(target => Math.hypot(target.x - point.x, target.y - point.y) <= MAGELLAN_MAIN.radius)
          .forEach(target => {
            shooterDamage(target, enhanced ? MAGELLAN_MAIN.enhancedHits : MAGELLAN_MAIN.hits);
            if (commandSkill) applyTimedEnemyStun(target, MAGELLAN_MAIN.stun);
          });
        for (let burst = 0; burst < 6; burst += 1) {
          const effect = document.createElement('i');
          effect.className = 'fx-explosion magellan-barrage';
          effect.style.left = percent(point.x + (Math.random() - .5) * .26);
          effect.style.top = percent(point.y + (Math.random() - .5) * .16);
          refs.effects.append(effect);
          schedule(() => effect.remove(), 520);
        }
      }, second * 1000);
    }
    schedule(() => {
      ally.charging = false;
      ally.el?.classList.remove('magellan-main-firing');
    }, MAGELLAN_MAIN.duration + 180);
    return true;
  }

  function fireIronFistCannon(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    const index = ally.ironFistCannonIndex || 0;
    ally.ironFistCannonIndex = (index + 1) % IRONFIST_CANNON.ports;
    const muzzle = ironFistCannonPoint(ally, index);
    drawIowaMuzzleFlash(muzzle, 'ironfist-cannon', ally.facingAngle + Math.PI / 2);
    const targetPoint = pointOf(target);
    schedule(() => {
      if (target && !target.dead) {
        shooterDamage(target, IRONFIST_CANNON.hits, ally, 'cannon');
        createExplosion(pointOf(target), 'cannon');
      }
    }, IRONFIST_CANNON.travel);
    return true;
  }

  function fireIronFistMainBattery(ally) {
    const initialTarget = highestDurabilityEnemyTarget(ally);
    if (!initialTarget) return false;
    const enhanced = ally.ironFistStars >= 3;
    const ultimate = ally.ironFistStars >= 5;
    const cannonShots = enhanced ? IRONFIST_MAIN.enhancedCannonShots : IRONFIST_MAIN.cannonShots;
    const cannonInterval = enhanced ? IRONFIST_MAIN.enhancedCannonInterval : IRONFIST_MAIN.cannonInterval;
    ally.charging = true;
    ally.el?.classList.add('ironfist-main-firing');
    if (ultimate) applyIronFistProtection(ally);
    announce(`${ally.ship.name} · ${ultimate ? '철방패' : enhanced ? '철권TT' : '철권'}`, 'friendly');
    for (let shot = 0; shot < cannonShots; shot += 1) {
      schedule(() => {
        const target = initialTarget && !initialTarget.dead ? initialTarget : highestDurabilityEnemyTarget(ally);
        if (!target) return;
        const muzzle = ironFistMainGunPoint(ally);
        drawIowaMuzzleFlash(muzzle, 'ironfist-main', ally.facingAngle + Math.PI / 2);
        const targetPoint = pointOf(target);
        schedule(() => {
          if (!target.dead) {
            shooterDamage(target, IRONFIST_MAIN.cannonHits);
            createExplosion(pointOf(target), 'cannon');
          }
        }, 90);
      }, shot * cannonInterval);
    }
    for (let row = 0; row < IRONFIST_MAIN.missileRows; row += 1) {
      schedule(() => {
        [-1, 1].forEach(side => {
          const target = initialTarget && !initialTarget.dead ? initialTarget : highestDurabilityEnemyTarget(ally);
          if (!target) return;
          const muzzle = ironFistMissilePoint(ally, row, side);
          const targetPoint = pointOf(target);
          const missile = document.createElement('i');
          missile.className = 'fx-missile ironfist-missile';
          positionProjectile(missile, muzzle, targetPoint);
          refs.effects.append(missile);
          schedule(() => {
            missile.remove();
            if (!target.dead) {
              shooterDamage(target, IRONFIST_MAIN.missileHits, null, 'missile');
              createExplosion(pointOf(target), 'cannon');
            }
          }, IRONFIST_MAIN.missileTravel);
        });
      }, row * IRONFIST_MAIN.missileInterval);
    }
    schedule(() => {
      ally.charging = false;
      ally.el?.classList.remove('ironfist-main-firing');
    }, Math.max(IRONFIST_MAIN.duration, (cannonShots - 1) * cannonInterval + 120));
    return true;
  }

  function applyIronFistProtection(ally) {
    const generation = Number(ally.ironFistProtectionGeneration || 0) + 1;
    ally.ironFistProtectionGeneration = generation;
    const shieldAmount = Math.round(ally.maxHp * IRONFIST_MAIN.shieldRatio);
    clearFireDust(ally);
    ally.shieldEl?.remove();
    ally.maxShield = shieldAmount;
    ally.shield = shieldAmount;
    ally.ironFistImmuneUntil = performance.now() + tacticalShieldDuration(IRONFIST_MAIN.protectionDuration);
    const shield = document.createElement('div');
    shield.className = 'ally-shield ironfist-defense-shield';
    shield.innerHTML = `<em>IRON SHIELD ${formatNumber(shieldAmount)}</em>`;
    ally.el.prepend(shield);
    ally.shieldEl = shield;
    ally.ironFistShieldEl = shield;
    ally.el.classList.add('ironfist-status-immune');
    schedule(() => {
      if (ally.ironFistProtectionGeneration !== generation) return;
      if (ally.ironFistShieldEl === shield) {
        ally.shield = 0;
        ally.maxShield = 0;
        ally.shieldEl = null;
        ally.ironFistShieldEl = null;
        shield.classList.add('broken');
        schedule(() => shield.remove(), 420);
      }
      ally.ironFistImmuneUntil = 0;
      ally.el?.classList.remove('ironfist-status-immune');
    }, tacticalShieldDuration(IRONFIST_MAIN.protectionDuration));
  }

  function ironFistCannonPoint(ally, index) {
    const points = [
      { x: -.075, y: -.052 }, { x: -.035, y: -.066 }, { x: .035, y: -.066 }, { x: .075, y: -.052 },
      { x: -.078, y: .004 }, { x: .078, y: .004 }, { x: -.066, y: .062 }, { x: 0, y: .078 }, { x: .066, y: .062 }
    ];
    const point = points[index % points.length];
    return orientedAllyPoint(ally, point.x, point.y);
  }

  function ironFistMainGunPoint(ally) {
    return orientedAllyPoint(ally, 0, -.108);
  }

  function ironFistMissilePoint(ally, row, side) {
    return orientedAllyPoint(ally, side * (.078 + Math.floor(row / 2) * .008), -.015 + (row % 2) * .035);
  }

  function iowaMuzzlePoint(ally, index) {
    const points = [
      { x: -.026, y: -.09 }, { x: .026, y: -.09 },
      { x: -.03, y: -.045 }, { x: .03, y: -.045 },
      { x: -.028, y: .005 }, { x: .028, y: .005 },
      { x: -.023, y: .052 }, { x: .023, y: .052 }
    ];
    const point = points[index % points.length];
    return orientedAllyPoint(ally, point.x, point.y);
  }

  function aegisMuzzlePoint(ally, index) {
    const points = [
      { x: -.018, y: -.112 }, { x: .018, y: -.112 },
      { x: -.048, y: -.035 }, { x: .048, y: -.035 }
    ];
    const point = points[index % points.length];
    return orientedAllyPoint(ally, point.x, point.y);
  }

  function magellanMuzzlePoint(ally, index) {
    const points = [
      { x: -.022, y: -.082 }, { x: .022, y: -.082 },
      { x: -.027, y: -.038 }, { x: .027, y: -.038 },
      { x: -.024, y: .012 }, { x: .024, y: .012 },
      { x: -.019, y: .058 }, { x: .019, y: .058 }
    ];
    const point = points[index % points.length];
    return orientedAllyPoint(ally, point.x, point.y);
  }

  function drawIowaMuzzleFlash(point, shipClass = 'iowa', facingAngle = null) {
    playCannonFireSound();
    const flash = document.createElement('i');
    flash.className = `iowa-muzzle-flash ${shipClass}-muzzle-flash`;
    flash.style.left = percent(point.x);
    flash.style.top = percent(point.y);
    if (Number.isFinite(facingAngle)) flash.style.setProperty('--muzzle-angle', `${facingAngle - Math.PI / 2}rad`);
    refs.effects.append(flash);
    schedule(() => flash.remove(), 180);
  }

  function fireAssaultTurtleMissile(ally) {
    const targets = shooterTargetsFor(ally);
    if (!targets.length) return false;
    const target = targets[ally.missileTargetIndex % targets.length];
    ally.missileTargetIndex += 1;
    launchAssaultTurtleMissile(ally, orientedAllyPoint(ally, 0, -.105), target, ASSAULT_TURTLE_MISSILE.hits, ASSAULT_TURTLE_MISSILE.travel);
    return true;
  }

  function fireTurtleShipMissile(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    launchTurtleShipMissile(ally, orientedAllyPoint(ally, 0, -.105), target, TURTLE_SHIP_MISSILE.hits, TURTLE_SHIP_MISSILE.travel);
    return true;
  }

  function fireDreadTurtleCharge(ally) {
    const targets = shooterTargetsFor(ally);
    if (!targets.length) return false;
    playTurtleChargeSound();
    // 아레나 상대 거북선은 같은 거리를 반대편(아래)으로 돌격한다.
    const destination = { x: .5, y: ally.isArenaShip ? .62 : .38 };
    ally.charging = true;
    ally.dreadTurtleManeuvering = false;
    ally.el?.classList.add('dread-turtle-charging');
    announce(`${ally.ship.name} · 적진 돌입`, 'friendly');
    moveAlly(ally, destination);
    schedule(() => {
      if (ally.dead) return;
      playTurtleShockSound();
      createDreadTurtleChargeSilhouette(ally);
      playDreadTurtleShockwave(destination, ally);
      ally.dreadTurtleDeployed = true;
      ally.charging = false;
      ally.el?.classList.remove('dread-turtle-charging');
      schedule(() => beginDreadTurtleManeuver(ally), DREAD_TURTLE_CHARGE.firstTurnDelay);
    }, DREAD_TURTLE_CHARGE.travel);
    return true;
  }

  function setDreadTurtleFacing(ally, angle) {
    ally.facingAngle = angle;
    ally.facingShell?.style.setProperty('--ally-facing-angle', `${angle}rad`);
    // 아레나 상대 거북선은 화면 요소가 함선 모델이므로, 모델 자체를 같은 각도로 돌린다(기본 180도 = 아래를 향함).
    if (!ally.facingShell && ally.isArenaShip) {
      ally.el?.querySelector('.arena-enemy-model')?.style.setProperty('transform', `scale(.86) rotate(${angle}rad)`);
    }
  }

  function advanceDreadTurtle(ally, angle, distance, duration, onComplete) {
    if (!ally || ally.dead) return;
    // 기준 각도는 아군 기준(0 = 위쪽). 아레나 상대 거북선은 뒤집혀 있으므로 180도를 더해 앞면이 아래(아군 쪽)를 향하게 한다.
    const heading = ally.isArenaShip ? angle + Math.PI : angle;
    setDreadTurtleFacing(ally, heading);
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    const start = { x: ally.x, y: ally.y };
    const end = {
      x: start.x + Math.sin(heading) * distance * height / width,
      y: start.y - Math.cos(heading) * distance
    };
    const startedAt = performance.now();
    ally.dreadTurtleManeuvering = true;
    ally.el?.classList.add('dread-turtle-maneuver-moving');
    const tick = () => {
      const now = performance.now();
      if (!state || state.status !== 'combat' || ally.dead) return;
      const progress = Math.min(1, (now - startedAt) / duration);
      moveAlly(ally, {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress
      });
      if (progress < 1) requestAnimationFrame(tick);
      else {
        ally.el?.classList.remove('dread-turtle-maneuver-moving');
        onComplete?.();
      }
    };
    requestAnimationFrame(tick);
  }

  function beginDreadTurtleManeuver(ally) {
    if (!state || state.status !== 'combat' || ally.dead || ally.charging) return;
    // 함선 기준 위쪽이 12시이므로 -30도는 11시, +30도는 1시 방향이다.
    advanceDreadTurtle(ally, -Math.PI / 6, DREAD_TURTLE_CHARGE.firstAdvance, DREAD_TURTLE_CHARGE.firstAdvanceDuration, () => {
      if (ally.dead || !state || state.status !== 'combat') return;
      advanceDreadTurtle(ally, Math.PI / 6, DREAD_TURTLE_CHARGE.secondAdvance, DREAD_TURTLE_CHARGE.secondAdvanceDuration, () => {
        ally.dreadTurtleManeuvering = false;
        ally.dreadTurtleHolding = true;
      });
    });
  }

  function fireDreadTurtleCannonBarrage(ally) {
    const targets = shooterTargetsFor(ally);
    if (!targets.length) return false;
    for (let row = 0; row < 6; row += 1) {
      schedule(() => {
        if (ally.dead || ally.charging) return;
        const liveTargets = shooterTargetsFor(ally);
        if (!liveTargets.length) return;
        [-1, 1].forEach(side => {
          const target = liveTargets[Math.floor(Math.random() * liveTargets.length)];
          const muzzle = dreadTurtleMuzzlePoint(ally, row, side);
          playCannonFireSound();
          drawDreadTurtleMuzzleFlash(muzzle, side, ally.facingAngle);
          schedule(() => {
            if (!target.dead) shooterDamage(target, DREAD_TURTLE_CANNON.hits, ally, 'cannon');
          }, DREAD_TURTLE_CANNON.travel);
        });
      }, row * DREAD_TURTLE_CANNON.flameStep);
    }
    return true;
  }

  // 상대 거북선 관기연 방패(간이): 기력이 차면 상대 함선에 방패를 씌운다(별 3 이상이면 전체, 아니면 자신).
  // 방패 수치는 아군과 같다(DREAD_TURTLE_CHARGE.shield, 별 3 이상 +20%). 방패는 아군의 공격 피해를 흡수한다.
  function fireArenaEnemyGwimyeonShield(enemy) {
    const auxiliaryUnlocked = enemy.dreadTurtleStars >= 3;
    const targets = auxiliaryUnlocked ? state.enemies.filter(item => item.isArenaShip && !item.dead) : [enemy];
    const amount = DREAD_TURTLE_CHARGE.shield * (auxiliaryUnlocked ? 1 + DREAD_TURTLE_CHARGE.shieldBoostRatio : 1);
    targets.forEach(target => setArenaEnemyShield(target, amount));
    announce(`${enemy.shipName} · 귀면방패`, 'danger');
    appendArenaLog(`${enemy.shipName} · 귀면방패`, 'enemy');
    // 아군 거북선과 같은 순서: 원래 자리로 복귀해 방패를 펼친 뒤 다시 돌격한다.
    if (enemy.isDreadTurtle) {
      enemy.charging = true;
      dreadTurtleTeleportTrace(enemy, pointOf(enemy));
      moveAlly(enemy, { x: enemy.homeX, y: enemy.homeY });
      setDreadTurtleFacing(enemy, Math.PI);
      schedule(() => {
        if (enemy.dead) return;
        enemy.charging = false;
        fireDreadTurtleCharge(enemy);
      }, DREAD_TURTLE_CHARGE.shieldUnfold + 80);
    }
    return true;
  }

  function fireDreadTurtleGwimyeonShield(ally) {
    ally.charging = true;
    ally.dreadTurtleDeployed = true;
    const origin = { x: ally.homeX, y: ally.homeY };
    dreadTurtleTeleportTrace(ally, pointOf(ally));
    ally.el?.classList.add('dread-turtle-teleporting');
    setDreadTurtleFacing(ally, 0);
    moveAlly(ally, origin);
    schedule(() => ally.el?.classList.remove('dread-turtle-teleporting'), 100);
    const auxiliaryUnlocked = ally.dreadTurtleStars >= 3;
    const ultimateUnlocked = ally.dreadTurtleStars >= 5;
    const shieldTargets = auxiliaryUnlocked ? state.allies.filter(candidate => !candidate.dead) : [ally];
    state.allies.forEach(candidate => {
      candidate.dreadTurtleFearEnabled = false;
      if (candidate.gwimyeonShieldActive) clearDreadTurtleGwimyeonShield(candidate);
    });
    announce(`${ally.ship.name} · 귀면방패`, 'friendly');
    const unfold = document.createElement('i');
    unfold.className = 'fx-dread-turtle-gwimyeon-unfold';
    unfold.style.left = '50%';
    unfold.style.top = '49%';
    refs.effects.append(unfold);
    schedule(() => {
      unfold.classList.add('dispersing');
      shieldTargets.forEach(target => launchDreadTurtleGwimyeonEcho(target));
      if (ultimateUnlocked) hostileTargetsFor(ally).forEach(applyDreadTurtleFear);
    }, COLOSSUS_MAIN.unfold);
    schedule(() => {
      unfold.remove();
      shieldTargets.filter(target => !target.dead).forEach(target => {
        const amount = DREAD_TURTLE_CHARGE.shield * (auxiliaryUnlocked ? 1 + DREAD_TURTLE_CHARGE.shieldBoostRatio : 1);
        applyDreadTurtleGwimyeonShield(target, amount, ultimateUnlocked);
      });
      ally.charging = false;
      schedule(() => {
        if (!ally.dead) fireDreadTurtleCharge(ally);
      }, 80);
    }, DREAD_TURTLE_CHARGE.shieldUnfold);
    return true;
  }

  function clearDreadTurtleGwimyeonShield(ally) {
    if (ally.shieldEl?.classList.contains('dread-turtle-gwimyeon-shield')) ally.shieldEl.remove();
    if (ally.gwimyeonShieldActive) ally.shield = 0;
    ally.gwimyeonShieldActive = false;
    ally.dreadTurtleFearEnabled = false;
    ally.el?.classList.remove('dread-turtle-gwimyeon-active');
    clearDreadTurtleShieldGauge(ally);
    clearDreadTurtleShieldVisual(ally);
    if (ally.shieldEl?.classList.contains('dread-turtle-gwimyeon-shield')) ally.shieldEl = null;
  }

  function applyDreadTurtleGwimyeonShield(ally, amount, fearEnabled) {
    if (!ally || ally.dead || !ally.el) return;
    if (ally.shieldEl) ally.shieldEl.remove();
    clearColossusShieldGauge(ally);
    clearDreadTurtleShieldGauge(ally);
    clearNimitzShieldGauge(ally);
    clearCarrierShieldGauge(ally);
    clearAssaultTurtleShieldGauge(ally);
    clearDreadTurtleShieldVisual(ally);
    ally.shield = amount;
    ally.maxShield = amount;
    ally.gwimyeonShieldActive = true;
    ally.dreadTurtleFearEnabled = fearEnabled;
    const shield = document.createElement('div');
    shield.className = 'ally-shield dread-turtle-gwimyeon-shield';
    ally.el.prepend(shield);
    ally.shieldEl = shield;
    addDreadTurtleShieldGauge(ally);
    ally.el.classList.add('dread-turtle-gwimyeon-active');
  }

  function applyDreadTurtleFear(target) {
    if (!target || target.dead || Number(target.dreadTurtleFearUntil || 0) > performance.now()) return;
    const now = performance.now();
    target.dreadTurtleFearUntil = now + DREAD_TURTLE_CHARGE.fearDuration;
    const angle = Math.random() * Math.PI * 2;
    target.dreadTurtleFearX = Math.max(.04, Math.min(.96, target.x + Math.cos(angle) * .22));
    target.dreadTurtleFearY = Math.max(.04, Math.min(.92, target.y + Math.sin(angle) * .2));
    target.suicideArmed = false;
    target.el?.classList.add('dread-turtle-feared');
    target.el?.classList.remove('attacking', 'arming', 'charging', 'firing');
  }

  function updateDreadTurtleFearMovement(target, dt) {
    if (isChargeImmune(target)) { target.dreadTurtleFearUntil = 0; return false; }
    const until = Number(target?.dreadTurtleFearUntil || 0);
    if (!until) return false;
    if (until <= performance.now()) {
      target.dreadTurtleFearUntil = 0;
      target.el?.classList.remove('dread-turtle-feared');
      return false;
    }
    const dx = target.dreadTurtleFearX - target.x;
    const dy = target.dreadTurtleFearY - target.y;
    const distance = Math.hypot(dx, dy);
    if (distance > .006) {
      const step = Math.min(distance, Math.max(.000025, Number(target.speed || .12) * .00025) * dt);
      target.x = Math.max(.035, Math.min(.965, target.x + dx / distance * step));
      target.y = Math.max(.035, Math.min(.93, target.y + dy / distance * step));
      target.el?.style.setProperty('--bug-angle', `${Math.atan2(dy, dx)}rad`);
      target.el && (target.el.style.left = percent(target.x));
      target.el && (target.el.style.top = percent(target.y));
    }
    return true;
  }

  function updateDreadTurtleNearbyFear(ally) {
    if (!ally?.gwimyeonShieldActive || !ally.dreadTurtleFearEnabled) return;
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    hostileTargetsFor(ally).forEach(target => {
      if (Math.hypot((target.x - ally.x) * width, (target.y - ally.y) * height) <= DREAD_TURTLE_CHARGE.fearTouchRadius) applyDreadTurtleFear(target);
    });
  }

  function launchDreadTurtleGwimyeonEcho(ally) {
    const echo = document.createElement('i');
    echo.className = 'fx-dread-turtle-gwimyeon-echo';
    echo.style.left = '50%';
    echo.style.top = '49%';
    refs.effects.append(echo);
    requestAnimationFrame(() => {
      echo.style.left = percent(ally.x);
      echo.style.top = percent(ally.y);
    });
    schedule(() => {
      if (!echo.isConnected || ally.dead || !ally.el) return;
      echo.style.transition = 'none';
      ally.el.append(echo);
      echo.style.left = '50%';
      echo.style.top = '50%';
      echo.classList.add('settling', 'attached');
      ally.gwimyeonShieldVisual = echo;
    }, COLOSSUS_MAIN.disperse);
  }

  function clearDreadTurtleShieldVisual(ally) {
    ally?.gwimyeonShieldVisual?.remove();
    if (ally) ally.gwimyeonShieldVisual = null;
  }

  function addDreadTurtleShieldGauge(ally) {
    clearDreadTurtleShieldGauge(ally);
    const health = ally.el?.querySelector('.ally-health');
    if (!health) return;
    const gauge = document.createElement('span');
    gauge.className = 'dread-turtle-shield-gauge';
    gauge.innerHTML = '<i></i><em></em>';
    health.append(gauge);
    ally.dreadTurtleShieldGauge = gauge;
    updateDreadTurtleShieldGauge(ally);
  }

  function updateDreadTurtleShieldGauge(ally) {
    const gauge = ally?.dreadTurtleShieldGauge;
    if (!gauge) return;
    const ratio = ally.maxShield ? Math.max(0, ally.shield / ally.maxShield * 100) : 0;
    gauge.querySelector('i').style.width = `${ratio}%`;
    gauge.querySelector('em').textContent = `귀면 ${formatNumber(Math.ceil(Math.max(0, ally.shield)))}`;
  }

  function clearDreadTurtleShieldGauge(ally) {
    ally?.dreadTurtleShieldGauge?.remove();
    if (ally) ally.dreadTurtleShieldGauge = null;
  }

  function dreadTurtleMuzzlePoint(ally, row, side) {
    const field = refs.field?.getBoundingClientRect();
    const rows = [-40, -24, -8, 8, 24, 40];
    return orientedAllyPoint(ally, side * 20 / (field?.width || 480), rows[row] / (field?.height || 720));
  }

  function drawDreadTurtleMuzzleFlash(point, side, facingAngle = 0) {
    const flash = document.createElement('i');
    flash.className = 'iowa-muzzle-flash dread-turtle-muzzle-flash';
    flash.style.left = percent(point.x);
    flash.style.top = percent(point.y);
    flash.style.setProperty('--dread-turtle-flame-angle', `${(Number(facingAngle) || 0) + (side > 0 ? 0 : Math.PI)}rad`);
    refs.effects.append(flash);
    schedule(() => flash.remove(), 180);
  }

  function dreadTurtleTeleportTrace(ally, point) {
    const trace = document.createElement('div');
    trace.className = 'dread-turtle-jump-trace';
    trace.style.left = percent(point.x);
    trace.style.top = percent(point.y);
    trace.innerHTML = '<div class="ship-topview dread-turtle-topview"><img src="dreadnought-turtle-battle-topview.png" alt="" /></div>';
    refs.effects.append(trace);
    schedule(() => trace.remove(), 620);
  }

  // 거북선 돌진 충격파: 뱃머리 번개 섬광 → 화면 조임 → 전방 파동 → 파동이 닿는 순서대로 피해·밀려남.
  const TURTLE_SHOCKWAVE = {
    dread: { range: .4, speed: .42, push: 12, bowOffset: 50, color: '#ffc66e' },
    assault: { speed: .9, push: 22, bowOffset: 36, color: '#8fe4ff' }
  };

  function turtleFieldSize() {
    const rect = refs.field?.getBoundingClientRect();
    return { width: rect?.width || 480, height: rect?.height || 720 };
  }

  function addTurtleFx(className, point, size = 0) {
    const el = document.createElement('i');
    el.className = className;
    el.style.left = percent(point.x);
    el.style.top = percent(point.y);
    if (size) { el.style.width = `${size}px`; el.style.height = `${size}px`; }
    refs.effects.append(el);
    return el;
  }

  function turtleAnimate(el, frames, duration, options = {}, removeAfter = true) {
    if (!el?.animate) return null;
    const animation = el.animate(frames, { duration, fill: removeAfter ? 'forwards' : 'none', easing: 'ease-out', ...options });
    animation.playbackRate = battleSpeed;
    if (removeAfter) animation.finished.then(() => el.remove(), () => el.remove());
    return animation;
  }

  // 뱃머리 섬광: 날카로운 십자 섬광 + 전방으로 갈라져 뻗는 번개 줄기
  function turtleBowFlash(bow, tone, angle = 0) {
    const flash = addTurtleFx(`turtle-bow-flash ${tone}`, bow);
    turtleAnimate(flash, [
      { transform: `translate(-50%,-50%) rotate(${angle}rad) scale(.2,.6)`, opacity: 1 },
      { transform: `translate(-50%,-50%) rotate(${angle}rad) scale(1.25,1)`, opacity: 1, offset: .25 },
      { transform: `translate(-50%,-50%) rotate(${angle}rad) scale(1.6,.2)`, opacity: 0 }
    ], 300);
    const core = addTurtleFx(`turtle-bow-core ${tone}`, bow);
    turtleAnimate(core, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 }], 260);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const size = 220, half = size / 2;
    svg.setAttribute('class', `turtle-bow-lightning ${tone}`);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.style.left = percent(bow.x);
    svg.style.top = percent(bow.y);
    svg.style.transform = `translate(-50%,-50%) rotate(${angle}rad)`;
    for (let index = 0; index < 7; index += 1) {
      const direction = (-62 + index * 124 / 6 + (Math.random() * 10 - 5)) * Math.PI / 180;
      const length = 52 + Math.random() * 46;
      let x = half, y = half;
      const points = [`${x},${y}`];
      for (let step = 1; step <= 5; step += 1) {
        const jag = direction + (Math.random() - .5) * .9;
        x += Math.sin(jag) * length / 5;
        y -= Math.cos(jag) * length / 5;
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      ['glow', 'bolt'].forEach(kind => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        line.setAttribute('class', kind);
        line.setAttribute('points', points.join(' '));
        svg.append(line);
      });
    }
    refs.effects.append(svg);
    turtleAnimate(svg, [{ opacity: 1 }, { opacity: .25, offset: .2 }, { opacity: 1, offset: .35 }, { opacity: .5, offset: .55 }, { opacity: 0 }], 280, { easing: 'steps(1,end)' });
    for (let index = 0; index < 10; index += 1) {
      const spark = addTurtleFx(`turtle-bow-spark ${tone}`, bow);
      const rotation = angle * 180 / Math.PI + (-80 + index * 160 / 9 + (Math.random() * 12 - 6));
      turtleAnimate(spark, [
        { transform: `rotate(${rotation}deg) translateY(0) scaleY(1.4)`, opacity: 1 },
        { transform: `rotate(${rotation}deg) translateY(${-(54 + Math.random() * 40)}px) scaleY(.4)`, opacity: 0 }
      ], 380, { easing: 'cubic-bezier(.1,.8,.3,1)' });
    }
  }

  // 충돌 순간 화면을 짧게 조였다 풀며 흔든다(멈칫하는 타격감).
  function turtleImpactPunch() {
    if (!refs.viewport || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    refs.viewport.classList.remove('turtle-impact-punch');
    void refs.viewport.offsetWidth;
    refs.viewport.classList.add('turtle-impact-punch');
    setTimeout(() => refs.viewport?.classList.remove('turtle-impact-punch'), 380 / battleSpeed);
  }

  // 돌격 중인 함선은 충격파에 밀리거나 기절하지 않는다(피해는 그대로 받는다).
  function isChargeImmune(target) {
    return Boolean(target?.charging || target?.dreadTurtleManeuvering);
  }
  function turtleShockHit(target, direction, push, color) {
    if (!target?.el) return;
    if (isChargeImmune(target)) { addTurtleFx('turtle-shock-hitburst', pointOf(target)); return; }
    // 보스 중에는 가운데 맞춤을 translate(-50% -50%)로 잡는 것이 있다. 충격파는 그 현재 위치를 기준으로 밀고 돌아와야 한다.
    const baseTranslate = getComputedStyle(target.el).translate;
    const [baseX, baseY] = baseTranslate && baseTranslate !== 'none' ? baseTranslate.split(' ') : ['0px', '0px'];
    turtleAnimate(target.el, [
      { translate: `${baseX} ${baseY}` },
      { translate: `calc(${baseX} + ${direction.x * push}px) calc(${baseY} + ${direction.y * push}px)`, offset: .25 },
      { translate: `${baseX} ${baseY}` }
    ], 420, { easing: 'cubic-bezier(.2,.7,.3,1)' }, false);
    const ring = addTurtleFx('turtle-shock-hitburst', pointOf(target));
    ring.style.setProperty('--turtle-shock-color', color);
    turtleAnimate(ring, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.7)', opacity: 0 }], 360);
  }

  function turtleShockCracks(bow, range) {
    const { width, height } = turtleFieldSize();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'turtle-shock-cracks');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    const startX = bow.x * width, startY = bow.y * height;
    for (let index = 0; index < 5; index += 1) {
      const base = (-38 + index * 19) * Math.PI / 180;
      const length = range * (.45 + Math.random() * .3);
      let x = startX, y = startY;
      const points = [`${x},${y}`];
      for (let step = 1; step <= 6; step += 1) {
        const jag = base + (Math.random() - .5) * .6;
        x += Math.sin(jag) * length / 6;
        y -= Math.cos(jag) * length / 6;
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      line.setAttribute('points', points.join(' '));
      const total = length * 1.2;
      line.style.strokeDasharray = total;
      line.style.strokeDashoffset = total;
      svg.append(line);
      turtleAnimate(line, [{ strokeDashoffset: total, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: .35 }, { strokeDashoffset: 0, opacity: 0 }], 1300, {}, false);
    }
    refs.effects.append(svg);
    schedule(() => svg.remove(), 1350);
  }

  // 중전함 거북선: 금빛 반원 파동 3겹, 사거리 화면 높이 40%, 가까운 적부터 차례로 피해.
  function playDreadTurtleShockwave(destination, unit = null) {
    const config = TURTLE_SHOCKWAVE.dread;
    const { width, height } = turtleFieldSize();
    // 앞쪽 방향: 아군 거북선은 위(-y), 아레나 상대 거북선은 아래(+y)로 돌격한다.
    const forward = unit?.isArenaShip ? 1 : -1;
    const bow = { x: destination.x, y: destination.y + forward * config.bowOffset / height };
    const range = config.range * height;
    const travel = range / config.speed;
    turtleBowFlash(bow, 'gold');
    turtleImpactPunch();
    for (let index = 0; index < 3; index += 1) {
      const layers = index === 0 ? ['turtle-shock-wave haze', 'turtle-shock-wave gold'] : ['turtle-shock-wave gold'];
      layers.forEach(className => {
        const wave = addTurtleFx(className, bow, range * 2);
        turtleAnimate(wave, [
          { transform: 'translate(-50%,-50%) scale(.06)', opacity: 1 },
          { opacity: 1, offset: .7 },
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }
        ], travel, { delay: index * 110, easing: 'cubic-bezier(.2,.6,.4,1)' });
      });
    }
    turtleShockCracks(bow, range);
    const shockTargets = hostileTargetsFor(unit);
    shockTargets.forEach(target => {
      const point = pointOf(target);
      const dx = (point.x - bow.x) * width;
      const dy = (point.y - bow.y) * height;
      const distance = Math.hypot(dx, dy) || 1;
      const reach = target.kind === 'boss' ? 60 : 0;
      if (forward * dy < 0 || Math.abs(dx) > forward * dy + reach || distance > range + reach) return;
      schedule(() => {
        if (!state || state.status !== 'combat' || target.dead) return;
        shooterDamage(target, DREAD_TURTLE_CHARGE.shockHits, unit);
        turtleShockHit(target, { x: dx / distance, y: dy / distance }, config.push, config.color);
      }, Math.max(0, distance - reach) / config.speed * .8);
    });
  }

  // 돌격 거북선: 청백색 쐐기 충격파 3발이 진행 방향으로 뻗는다.
  function playAssaultTurtleShockwave(to, forward) {
    const config = TURTLE_SHOCKWAVE.assault;
    const { width, height } = turtleFieldSize();
    const angle = Math.atan2(forward.y * height, forward.x * width) + Math.PI / 2;
    const pixelForward = Math.hypot(forward.x * width, forward.y * height) || 1;
    const bow = { x: to.x + forward.x * config.bowOffset / pixelForward, y: to.y + forward.y * config.bowOffset / pixelForward };
    const range = Math.max(78, height * ASSAULT_TURTLE_CHARGE.ramLength);
    const travel = range / config.speed;
    turtleBowFlash(bow, 'blue', angle);
    turtleImpactPunch();
    const cone = addTurtleFx('turtle-shock-cone', bow, range * 2);
    turtleAnimate(cone, [
      { transform: `translate(-50%,-50%) rotate(${angle}rad)`, opacity: 0 },
      { opacity: 1, offset: .2 },
      { transform: `translate(-50%,-50%) rotate(${angle}rad)`, opacity: 0 }
    ], travel + 160);
    for (let index = 0; index < 3; index += 1) {
      const chevron = addTurtleFx('turtle-shock-chevron', bow);
      turtleAnimate(chevron, [
        { transform: `translate(-50%,-50%) rotate(${angle}rad) translateY(0) scaleX(.35)`, opacity: 1 },
        { opacity: 1, offset: .75 },
        { transform: `translate(-50%,-50%) rotate(${angle}rad) translateY(${-range}px) scaleX(${(range * 2 / 120 * .95).toFixed(2)})`, opacity: 0 }
      ], travel, { delay: index * 70, easing: 'linear' });
    }
    return { bow, speed: config.speed };
  }

  function addTurtleStunStars(target) {
    if (!target?.el) return;
    target.el.querySelector(':scope > .turtle-stun-stars')?.remove();
    const stars = document.createElement('i');
    stars.className = 'turtle-stun-stars';
    stars.innerHTML = '<b></b><b></b><b></b>';
    target.el.append(stars);
    schedule(() => stars.remove(), ASSAULT_TURTLE_CHARGE.ramStun);
  }

  function createDreadTurtleChargeSilhouette(ally) {
    const point = pointOf(ally);
    [0, 90, 180].forEach(delay => schedule(() => {
      if (!state || state.status !== 'combat') return;
      const echo = document.createElement('div');
      echo.className = 'dread-turtle-charge-afterimage';
      echo.innerHTML = '<img src="dreadnought-turtle-battle-topview.png" alt="" />';
      echo.style.left = percent(point.x);
      echo.style.top = percent(point.y);
      refs.effects.append(echo);
      schedule(() => echo.remove(), DREAD_TURTLE_CHARGE.arrivalEchoDuration);
    }, delay));
  }

  function fireTurtleShipBombardment(ally) {
    const targets = shooterTargetsFor(ally);
    if (!targets.length) return false;
    const turnRight = Boolean(ally.nextTurtleBombardSide);
    const turnClass = `turtle-ship-turn-${turnRight ? 'right' : 'left'}`;
    ally.nextTurtleBombardSide = !turnRight;
    ally.charging = true;
    const turnDuration = TURTLE_SHIP_BOMBARDMENT.turnDuration / (ally.turtleShipStars >= 5 ? 2 : 1);
    ally.el?.style.setProperty('--turtle-turn-duration', `${turnDuration}ms`);
    ally.el?.classList.add('turtle-ship-bombarding', turnClass);
    announce(`${ally.ship.name} · ${turnRight ? '우현' : '좌현'} 미사일 폭격`, 'friendly');
    schedule(() => launchTurtleShipBombardment(ally), turnDuration);
    const barrageDuration = (TURTLE_SHIP_BOMBARDMENT.salvos - 1) * TURTLE_SHIP_BOMBARDMENT.interval;
    schedule(() => {
      ally.el?.classList.remove(turnClass);
    }, turnDuration + barrageDuration);
    schedule(() => {
      ally.charging = false;
      ally.energy = 0;
      updateBattlecruiserEnergy(ally);
      ally.el?.classList.remove('turtle-ship-bombarding');
    }, turnDuration + barrageDuration + turnDuration);
    return true;
  }

  function launchTurtleShipBombardment(ally) {
    for (let salvo = 0; salvo < TURTLE_SHIP_BOMBARDMENT.salvos; salvo += 1) {
      schedule(() => {
        if (!state || state.status !== 'combat' || ally.dead) return;
        const targets = shooterTargetsFor(ally);
        if (!targets.length) return;
        for (let missile = 0; missile < TURTLE_SHIP_BOMBARDMENT.missilesPerSalvo; missile += 1) {
          const target = targets[Math.floor(Math.random() * targets.length)];
          launchTurtleShipMissile(ally, turtleShipBarrageMuzzle(ally, missile, salvo), target, TURTLE_SHIP_BOMBARDMENT.hits, TURTLE_SHIP_BOMBARDMENT.travel);
        }
      }, salvo * TURTLE_SHIP_BOMBARDMENT.interval);
    }
  }

  function launchTurtleShipMissile(ally, from, target, damage, travel) {
    if (!target || target.dead) return;
    const to = pointOf(target);
    const missile = document.createElement('i');
    missile.className = 'fx-missile turtle-ship-missile';
    positionProjectile(missile, from, to);
    refs.effects.append(missile);
    schedule(() => missile.remove(), travel + 150);
    schedule(() => {
      if (!state || state.status !== 'combat') return;
      const impact = target.dead ? to : pointOf(target);
      if (ally.turtleShipStars >= 3) {
        const field = refs.field.getBoundingClientRect();
        const nearby = hostileTargetsFor(ally).filter(candidate => candidate !== target && !candidate.dead &&
          Math.hypot((candidate.x - impact.x) * field.width, (candidate.y - impact.y) * field.height) <= TURTLE_SHIP_MISSILE.splashRadius);
        nearby.forEach(candidate => shooterDamage(candidate, Math.round(damage * TURTLE_SHIP_MISSILE.splashRatio), null, 'missile'));
      }
      shooterDamage(target, damage, null, 'missile');
      createExplosion(impact, 'missile');
    }, travel);
  }

  function turtleShipBarrageMuzzle(ally, missile, salvo) {
    const ports = [
      { x: -.075, y: -.075 }, { x: -.037, y: -.11 }, { x: 0, y: -.13 },
      { x: .037, y: -.11 }, { x: .075, y: -.075 }
    ];
    const port = ports[missile % ports.length];
    const sweep = ((salvo % 3) - 1) * .012;
    return orientedAllyPoint(ally, port.x + sweep, port.y);
  }

  function fireAtlasElectric(ally) {
    const primary = shooterTargetFor(ally);
    if (!primary) return false;
    const sequence = [primary];
    let source = primary;
    for (let chain = 0; chain < ATLAS_ELECTRIC.chains; chain += 1) {
      const next = inRangeTargetsFor(ally)
        .filter(target => !sequence.includes(target))
        .sort((a, b) => Math.hypot(a.x - source.x, a.y - source.y) - Math.hypot(b.x - source.x, b.y - source.y))[0];
      if (!next) break;
      sequence.push(next);
      source = next;
    }
    sequence.forEach((target, index) => {
      const from = index === 0 ? orientedAllyPoint(ally, 0, -.04) : pointOf(sequence[index - 1]);
      const to = pointOf(target);
      drawAtlasElectric(from, to);
      schedule(() => {
        if (!target.dead) {
          const hits = Math.max(1, Math.round(ATLAS_ELECTRIC.hits * Math.pow(.5, index)));
          shooterDamage(target, hits);
          target.el?.classList.add('atlas-electrified');
          schedule(() => target.el?.classList.remove('atlas-electrified'), 420);
        }
      }, ATLAS_ELECTRIC.travel);
    });
    return true;
  }

  function drawAtlasElectric(from, to) {
    drawElectricStrike(from, to, Math.random() < .5 ? 1 : 2, 1000);
  }

  function fireAtlasMainBattery(ally) {
    const target = shooterTargetFor(ally);
    if (!target) return false;
    activateAtlasDamageBoost();
    announce(`${ally.ship.name} · 전 함대 데미지 증가 10%`, 'friendly');
    const enhanced = ally.atlasStars >= 3;
    const shots = enhanced ? ATLAS_PLASMA.enhancedShots : ATLAS_PLASMA.shots;
    const hits = enhanced ? ATLAS_PLASMA.enhancedHits : ATLAS_PLASMA.hits;
    for (let index = 0; index < shots; index += 1) {
      schedule(() => launchAtlasPlasma(ally, target, hits), index * ATLAS_PLASMA.interval);
    }
    return true;
  }

  function launchAtlasPlasma(ally, target, hits = ATLAS_PLASMA.hits) {
    if (!target || target.dead || !state || state.status !== 'combat') return;
    const from = orientedAllyPoint(ally, 0, -.04);
    const to = pointOf(target);
    const plasma = document.createElement('i');
    plasma.className = 'fx-orb atlas-plasma';
    positionProjectile(plasma, from, to);
    refs.effects.append(plasma);
    schedule(() => plasma.remove(), ATLAS_PLASMA.travel + 150);
    schedule(() => dealAtlasPlasmaBlast(to, target, hits), ATLAS_PLASMA.travel);
  }

  function dealAtlasPlasmaBlast(point, primary, hits = ATLAS_PLASMA.hits) {
    const targets = hostileTargetsFor(ally)
      .filter(target => target.kind === 'boss' || target.deployed)
      .filter(target => Math.hypot(target.x - point.x, target.y - point.y) <= ATLAS_PLASMA.radius);
    if (primary && !primary.dead && !targets.includes(primary)) targets.unshift(primary);
    targets.forEach(target => shooterDamage(target, hits));
    const effect = document.createElement('i');
    effect.className = 'fx-explosion atlas-plasma';
    effect.style.left = percent(point.x);
    effect.style.top = percent(point.y);
    refs.effects.append(effect);
    schedule(() => effect.remove(), 480);
  }

  function activateAtlasDamageBoost() {
    if (!state) return;
    state.damageBoost = ATLAS_PLASMA.buffDuration;
    state.allies.filter(ally => !ally.dead).forEach(ally => ally.el?.classList.add('atlas-damage-boost'));
  }

  function fireAssaultTurtleCharge(ally) {
    const targets = shooterTargetsFor(ally);
    if (!targets.length) return false;
    const origin = pointOf(ally);
    const bossCharge = Boolean(state.boss && !state.boss.dead && !state.boss.machineAirborne);
    const chargeTarget = bossCharge ? state.boss : targets[0];
    const destination = assaultTurtleChargeDestination(origin, pointOf(chargeTarget), bossCharge, ally.isArenaShip);
    playTurtleChargeSound();
    ally.charging = true;
    ally.assaultTurtleBarrageDamage = 0;
    ally.assaultTurtleUltimateActive = ally.assaultTurtleStars >= 5;
    ally.el.classList.add('assault-turtle-charging');
    if (ally.assaultTurtleUltimateActive) cleanseTankStatuses(ally);
    activateAssaultTurtleShield(ally);
    createAssaultTurtleChargeSilhouettes(ally, origin, destination);
    announce(`${ally.ship.name} · 돌격 개시`, 'friendly');
    moveAlly(ally, destination);
    sweepAssaultTurtleRam(ally, origin, destination);
    schedule(() => {
      if (!state || state.status !== 'combat' || ally.dead) return;
      if (ally.assaultTurtleUltimateActive) cleanseTankStatuses(ally);
      dealAssaultTurtleRam(ally, origin, destination);
    }, ASSAULT_TURTLE_CHARGE.travel);
    schedule(() => launchAssaultTurtleBarrage(ally), ASSAULT_TURTLE_CHARGE.travel);
    schedule(() => disableAssaultTurtleShield(ally), tacticalShieldDuration(ASSAULT_TURTLE_CHARGE.shieldDuration));
    schedule(() => {
      if (!state || state.status !== 'combat' || ally.dead) return;
      if (ally.assaultTurtleUltimateActive) detonateAssaultTurtleReturn(ally);
      teleportAlly(ally, origin);
      ally.charging = false;
      ally.assaultTurtleUltimateActive = false;
      ally.energy = 0;
      updateBattlecruiserEnergy(ally);
      ally.el?.classList.remove('assault-turtle-charging');
    }, ASSAULT_TURTLE_CHARGE.travel + ASSAULT_TURTLE_BARRAGE.duration + ASSAULT_TURTLE_CHARGE.returnDelay);
    return true;
  }

  function assaultTurtleChargeDestination(origin, target, bossCharge = false, mirrored = false) {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const distance = Math.hypot(dx, dy) || 1;
    const stop = bossCharge ? .022 : .045;
    const travel = Math.max(ASSAULT_TURTLE_CHARGE.minTravel, distance - stop);
    // 아레나 상대 돌격 거북선은 세로 범위를 진영 대칭으로 쓴다(아군 .14~.76, 상대 .24~.86).
    const minY = mirrored ? .24 : .14;
    const maxY = mirrored ? .86 : .76;
    return {
      x: Math.max(.1, Math.min(.9, origin.x + dx / distance * travel)),
      y: Math.max(minY, Math.min(maxY, origin.y + dy / distance * travel))
    };
  }

  function launchAssaultTurtleBarrage(ally) {
    const step = ASSAULT_TURTLE_BARRAGE.duration / (ASSAULT_TURTLE_BARRAGE.shots - 1);
    for (let index = 0; index < ASSAULT_TURTLE_BARRAGE.shots; index += 1) {
      schedule(() => {
        if (!state || state.status !== 'combat' || ally.dead) return;
        const targets = shooterTargetsFor(ally);
        if (!targets.length) return;
        const target = targets[index % targets.length];
        launchAssaultTurtleMissile(ally, assaultTurtleBarrageMuzzle(ally, index), target, ASSAULT_TURTLE_BARRAGE.hits, ASSAULT_TURTLE_BARRAGE.travel, true);
      }, Math.round(index * step));
    }
  }

  function launchAssaultTurtleMissile(ally, from, target, damage, travel, barrage = false) {
    if (!target || target.dead) return;
    const to = pointOf(target);
    const missile = document.createElement('i');
    missile.className = 'fx-missile assault-turtle-missile';
    positionProjectile(missile, from, to);
    refs.effects.append(missile);
    schedule(() => missile.remove(), travel + 150);
    schedule(() => {
      if (!state || state.status !== 'combat') return;
      const impact = target.dead ? to : pointOf(target);
      const field = refs.field.getBoundingClientRect();
      const nearby = ally.assaultTurtleStars >= 3 ? hostileTargetsFor(ally).filter(candidate => candidate !== target && !candidate.dead &&
        Math.hypot((candidate.x - impact.x) * field.width, (candidate.y - impact.y) * field.height) <= ASSAULT_TURTLE_MISSILE.splashRadius * ASSAULT_TURTLE_MISSILE.enhancedRadiusRatio) : [];
      [target, ...nearby].forEach(candidate => {
        if (!candidate || candidate.dead) return;
        const before = candidate.hp;
        shooterDamage(candidate, damage, null, 'missile');
        if (barrage) ally.assaultTurtleBarrageDamage += Math.max(0, before - candidate.hp);
      });
      createExplosion(impact, 'missile');
    }, travel);
  }

  function detonateAssaultTurtleReturn(ally) {
    const point = pointOf(ally);
    const field = refs.field.getBoundingClientRect();
    const damage = Math.round(ally.assaultTurtleBarrageDamage * ASSAULT_TURTLE_CHARGE.returnBlastRatio);
    createExplosion(point, 'assault-turtle-return');
    if (damage <= 0) return;
    hostileTargetsFor(ally).filter(target => !target.dead &&
      Math.hypot((target.x - point.x) * field.width, (target.y - point.y) * field.height) <= ASSAULT_TURTLE_CHARGE.returnBlastRadius)
      .forEach(target => shooterDamage(target, damage, ally, 'explosion'));
  }

  function assaultTurtleBarrageMuzzle(ally, index) {
    const ports = [
      { x: -.075, y: -.06 }, { x: .075, y: -.06 },
      { x: -.09, y: .015 }, { x: .09, y: .015 },
      { x: -.05, y: -.145 }, { x: .05, y: -.145 }
    ];
    const port = ports[index % ports.length];
    return orientedAllyPoint(ally, port.x, port.y);
  }

  function moveAlly(ally, point) {
    ally.x = point.x;
    ally.y = point.y;
    ally.el.style.left = percent(point.x);
    ally.el.style.top = percent(point.y);
  }

  function teleportAlly(ally, point) {
    ally.el.classList.add('assault-turtle-teleporting');
    moveAlly(ally, point);
    schedule(() => ally.el?.classList.remove('assault-turtle-teleporting'), 90);
  }

  // 돌진 중 항로 판정: 거북선 머리가 지나가는 동안 항로 폭 안의 적에게 매번 충돌 피해를 준다(한 번만 맞음).
  function sweepAssaultTurtleRam(ally, from, to) {
    const { width: fieldWidth, height: fieldHeight } = turtleFieldSize();
    const hit = new Set();
    ally.assaultTurtleSwept = hit;
    const dx = to.x - from.x, dy = to.y - from.y;
    const steps = Math.max(1, Math.round(ASSAULT_TURTLE_CHARGE.travel / 40));
    for (let step = 0; step <= steps; step += 1) {
      schedule(() => {
        if (!state || state.status !== 'combat' || ally.dead) return;
        const progress = step / steps;
        const headX = from.x + dx * progress, headY = from.y + dy * progress;
        hostileTargetsFor(ally).forEach(target => {
          if (!target || target.dead || hit.has(target) || !(target.kind === 'boss' || target.deployed)) return;
          const point = pointOf(target);
          const distance = Math.hypot((point.x - headX) * fieldWidth, (point.y - headY) * fieldHeight);
          if (distance > ASSAULT_TURTLE_CHARGE.pathRadius) return;
          hit.add(target);
          shooterDamage(target, ASSAULT_TURTLE_CHARGE.ramDamage, ally);
          applyAssaultTurtleRamStun(target);
          if (!target.dead) addTurtleStunStars(target);
        });
      }, Math.round(step * ASSAULT_TURTLE_CHARGE.travel / steps));
    }
  }

  function dealAssaultTurtleRam(ally, from, to) {
    playTurtleShockSound();
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const directionLength = Math.hypot(dx, dy) || 1;
    const forward = { x: dx / directionLength, y: dy / directionLength };
    const shock = playAssaultTurtleShockwave(to, forward);
    const { width: fieldWidth, height: fieldHeight } = turtleFieldSize();
    const hitTargets = new Set();
    // 지나온 항로의 적은 즉시, 전방 부채꼴의 적은 쐐기 충격파가 닿는 순서대로 맞는다.
    const hitTarget = (target, delayed = false) => {
      if (!target || target.dead || hitTargets.has(target) || ally.assaultTurtleSwept?.has(target)) return;
      hitTargets.add(target);
      const point = pointOf(target);
      const px = (point.x - shock.bow.x) * fieldWidth;
      const py = (point.y - shock.bow.y) * fieldHeight;
      const distance = Math.hypot(px, py) || 1;
      const delay = delayed ? Math.max(0, distance - (target.kind === 'boss' ? 60 : 0)) / shock.speed : 0;
      schedule(() => {
        if (!state || state.status !== 'combat' || target.dead) return;
        shooterDamage(target, ASSAULT_TURTLE_CHARGE.ramDamage, ally);
        applyAssaultTurtleRamStun(target);
        if (target.dead) return;
        turtleShockHit(target, { x: px / distance, y: py / distance }, TURTLE_SHOCKWAVE.assault.push, TURTLE_SHOCKWAVE.assault.color);
        addTurtleStunStars(target);
      }, delay);
    };
    // 충돌 지점까지 지나온 항로도 충파 폭발 범위로 판정한다.
    hostileTargetsFor(ally)
      .filter(target => target.kind === 'boss' || target.deployed)
      .forEach(target => {
        const point = pointOf(target);
        const pathX = point.x - from.x;
        const pathY = point.y - from.y;
        const projection = Math.max(0, Math.min(1, (pathX * dx + pathY * dy) / (directionLength * directionLength)));
        const closestX = from.x + projection * dx;
        const closestY = from.y + projection * dy;
        if (Math.hypot(point.x - closestX, point.y - closestY) <= .065) hitTarget(target);
      });
    hostileTargetsFor(ally)
      .filter(target => target.kind === 'boss' || target.deployed)
      .forEach(target => {
      const point = pointOf(target);
      const offsetX = point.x - to.x;
      const offsetY = point.y - to.y;
      const targetDistance = Math.hypot(offsetX, offsetY);
      if (targetDistance > ASSAULT_TURTLE_CHARGE.ramLength) return;
      const angle = targetDistance ? Math.acos(Math.max(-1, Math.min(1, (offsetX * forward.x + offsetY * forward.y) / targetDistance))) : 0;
      if (angle > ASSAULT_TURTLE_CHARGE.ramAngle / 2) return;
      hitTarget(target, true);
    });
  }

  function createAssaultTurtleChargeSilhouettes(ally, from, to) {
    const fieldRect = refs.field?.getBoundingClientRect();
    const fieldWidth = fieldRect?.width || 480;
    const fieldHeight = fieldRect?.height || 620;
    for (let index = 0; index < 3; index += 1) {
      const silhouette = document.createElement('div');
      silhouette.className = 'assault-turtle-charge-silhouette';
      silhouette.style.left = percent(from.x);
      silhouette.style.top = percent(from.y);
      silhouette.style.setProperty('--charge-x', `${(to.x - from.x) * fieldWidth}px`);
      silhouette.style.setProperty('--charge-y', `${(to.y - from.y) * fieldHeight}px`);
      silhouette.style.setProperty('--charge-facing-angle', `${Math.atan2((to.y - from.y) * fieldHeight, (to.x - from.x) * fieldWidth) + Math.PI / 2}rad`);
      silhouette.style.setProperty('--silhouette-delay', `${index * 70}ms`);
      silhouette.innerHTML = topViewMarkup(ally.ship);
      refs.effects.append(silhouette);
      schedule(() => silhouette.remove(), ASSAULT_TURTLE_CHARGE.travel + 180 + index * 70);
    }
  }

  function applyAssaultTurtleRamStun(target) {
    if (isChargeImmune(target)) return;
    target.stun = Math.max(Number(target.stun) || 0, ASSAULT_TURTLE_CHARGE.ramStun);
    target.assaultTurtleStunnedUntil = performance.now() + ASSAULT_TURTLE_CHARGE.ramStun;
    target.el?.classList.add('assault-turtle-stunned');
    schedule(() => {
      if (performance.now() >= Number(target.assaultTurtleStunnedUntil || 0)) target.el?.classList.remove('assault-turtle-stunned');
    }, ASSAULT_TURTLE_CHARGE.ramStun + 40);
  }

  function activateAssaultTurtleShield(ally) {
    if (ally.isArenaShip) { ally.chargeShieldActive = true; setArenaEnemyShield(ally, 2000); return; }
    ally.shield = 2000;
    ally.maxShield = 2000;
    clearFireDust(ally);
    ally.chargeShieldActive = true;
    ally.shieldEl?.remove();
    const shield = document.createElement('div');
    shield.className = 'ally-shield assault-plasma-shield';
    shield.innerHTML = '<em>AQUA AEGIS 2,000</em>';
    ally.el.prepend(shield);
    ally.shieldEl = shield;
    addAssaultTurtleShieldGauge(ally);
    ally.el.classList.add('assault-turtle-shield-pulse');
  }

  function disableAssaultTurtleShield(ally) {
    if (!ally?.chargeShieldActive) return;
    if (ally.isArenaShip) { ally.chargeShieldActive = false; setArenaEnemyShield(ally, 0); return; }
    ally.chargeShieldActive = false;
    ally.shield = 0;
    ally.maxShield = 0;
    clearAssaultTurtleShieldGauge(ally);
    ally.el?.classList.remove('assault-turtle-shield-pulse');
    if (!ally.shieldEl) return;
    ally.shieldEl.classList.add('broken');
    const shield = ally.shieldEl;
    ally.shieldEl = null;
    schedule(() => shield.remove(), 420);
  }

  function addAssaultTurtleShieldGauge(ally) {
    clearAssaultTurtleShieldGauge(ally);
    const health = ally.el?.querySelector('.ally-health');
    if (!health) return;
    const gauge = document.createElement('span');
    gauge.className = 'assault-turtle-shield-gauge';
    gauge.innerHTML = '<i></i><em></em>';
    health.append(gauge);
    ally.assaultTurtleShieldGauge = gauge;
    updateAssaultTurtleShieldGauge(ally);
  }

  function updateAssaultTurtleShieldGauge(ally) {
    if (!ally?.assaultTurtleShieldGauge) return;
    const ratio = ally.maxShield ? Math.max(0, ally.shield / ally.maxShield * 100) : 0;
    const bar = ally.assaultTurtleShieldGauge.querySelector('i');
    const label = ally.assaultTurtleShieldGauge.querySelector('em');
    if (bar) bar.style.width = `${ratio}%`;
    if (label) label.textContent = formatNumber(Math.ceil(Math.max(0, ally.shield)));
  }

  function clearAssaultTurtleShieldGauge(ally) {
    ally?.assaultTurtleShieldGauge?.remove();
    if (ally) ally.assaultTurtleShieldGauge = null;
  }

  function battlecruiserMuzzlePoints(ally) {
    if (ally?.isStarCruiser) {
      return [orientedAllyPoint(ally, -.06, -.012), orientedAllyPoint(ally, .06, -.012)];
    }
    return [orientedAllyPoint(ally, -.02, -.092), orientedAllyPoint(ally, .02, -.092)];
  }

  function drawBattlecruiserBeam(from, to) {
    const effect = document.createElement('i');
    effect.className = 'fx-line battlecruiser-laser';
    positionLine(effect, from, to);
    refs.effects.append(effect);
    schedule(() => effect.remove(), 230);
  }

  function launchPhotonShell(from, to) {
    launchPlasmaCannonShot(from, to, BATTLECRUISER_MAIN_BATTERY.travel, 'star-cruiser-photon');
  }

  function launchPlasmaCannonShot(from, to, travel, variant = '') {
    const shot = document.createElement('i');
    shot.className = `fx-plasma-cannon-shot ${variant}`;
    const rect = refs.field.getBoundingClientRect();
    shot.style.left = percent(from.x);
    shot.style.top = percent(from.y);
    shot.style.setProperty('--dx', `${(to.x - from.x) * rect.width}px`);
    shot.style.setProperty('--dy', `${(to.y - from.y) * rect.height}px`);
    shot.style.setProperty('--plasma-angle', `${Math.atan2(to.y - from.y, to.x - from.x)}rad`);
    shot.style.setProperty('--plasma-travel', `${travel}ms`);
    refs.effects.append(shot);
    [0, .34, .68].forEach((progress, index) => {
      schedule(() => createPlasmaCannonTrail({ x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress }, Math.atan2(to.y - from.y, to.x - from.x), variant), index * travel * .34);
    });
    schedule(() => shot.remove(), travel + 90);
  }

  function createPlasmaCannonTrail(point, angle, variant) {
    if (!state || state.status !== 'combat') return;
    const trail = document.createElement('i');
    trail.className = `fx-plasma-cannon-shot plasma-cannon-trail ${variant}`;
    trail.style.left = percent(point.x);
    trail.style.top = percent(point.y);
    trail.style.setProperty('--plasma-angle', `${angle}rad`);
    refs.effects.append(trail);
    schedule(() => trail.remove(), 520);
  }

  function createPlasmaCannonImpact(point, boss = false) {
    if (!point || !refs.effects) return;
    const impact = document.createElement('i');
    impact.className = `fx-plasma-cannon-impact${boss ? ' boss-impact' : ''}`;
    impact.style.left = percent(point.x);
    impact.style.top = percent(point.y);
    refs.effects.append(impact);
    schedule(() => impact.remove(), 540);
  }

  function launchPhotonCharge(point) {
    const charge = document.createElement('i');
    charge.className = 'fx-photon-charge';
    charge.style.left = percent(point.x);
    charge.style.top = percent(point.y);
    refs.effects.append(charge);
    schedule(() => charge.remove(), BATTLECRUISER_MAIN_BATTERY.charge + 40);
  }

  function updateBattlecruiserEnergy(ally) {
    if (!ally.energyBar) return;
    const energy = Math.round(Math.max(0, Math.min(ally.maxEnergy, ally.energy)));
    ally.energyBar.style.width = `${energy}%`;
    if (ally.energyLabel) {
      ally.energyLabel.textContent = ally.nimitzOverload ? '과부하' : `${energy} / ${ally.maxEnergy}`;
      ally.energyLabel.classList.toggle('energy-overload', Boolean(ally.nimitzOverload));
    }
  }

  function enemyAttack(enemy) {
    const target = monsterTargetFor(enemy);
    if (!target) return;
    if (enemyArchetype(enemy) === 'jipgemon') {
      enemy.el.classList.add('claw-attacking');
      drawMonsterClaw(target);
      schedule(() => {
        enemy.el?.classList.remove('claw-attacking');
        if (target.isCelestialShield) {
          hitCelestialShield(target, pointOf(target), enemy, enemy.attackPower);
          return;
        }
        if (!target.dead) dealAllyDamage(target, enemy.attackPower, enemy);
      }, 180);
      return;
    }
    enemy.el.classList.add('projectile-recoil');
    schedule(() => enemy.el?.classList.remove('projectile-recoil'), 260);
    if (enemyArchetype(enemy) === 'dokchimmon') {
      enemyProjectile(enemy, target, 'monster-acid', enemy.attackPower, () => applyMonsterCorrosion(target, enemy.attackPower));
      return;
    }
    enemyProjectile(enemy, target, 'monster-spike', enemy.attackPower);
  }

  let monsterClawEffectIndex = 0;

  function drawMonsterClaw(target) {
    const effect = document.createElement('img');
    effect.className = 'fx-monster-claw';
    effect.src = 'claw-attack.png';
    effect.alt = '';
    const positions = [
      { x: -20, y: -12 },
      { x: 0, y: 10 },
      { x: 20, y: -12 }
    ];
    const position = positions[monsterClawEffectIndex++ % positions.length];
    effect.style.left = `calc(${percent(target.x)} + ${position.x}px)`;
    effect.style.top = `calc(${percent(target.y)} + ${position.y}px)`;
    refs.effects.append(effect);
    schedule(() => effect.remove(), 360);
  }

  function applyMonsterCorrosion(target, damage = 5) {
    if (!target || target.dead) return;
    if (state?.allies?.includes(target) && isAllyStatusImmune(target)) return;
    target.corrosionStacks = Math.min(5, Number(target.corrosionStacks || 0));
    if (target.corrosionStacks >= 5) return;
    target.corrosionStacks += 1;
    target.corrosionGeneration = Number(target.corrosionGeneration || 0);
    const corrosionGeneration = target.corrosionGeneration;
    target.el?.classList.add('monster-corroding');
    if (target.el) target.el.dataset.corrosionStacks = String(target.corrosionStacks);
    for (let tick = 1; tick <= 5; tick += 1) {
      schedule(() => {
        if (target.corrosionGeneration === corrosionGeneration) dealAllyDamage(target, damage);
      }, tick * 1000);
    }
    schedule(() => {
      if (target.corrosionGeneration !== corrosionGeneration) return;
      target.corrosionStacks = Math.max(0, Number(target.corrosionStacks || 0) - 1);
      if (target.el) target.el.dataset.corrosionStacks = String(target.corrosionStacks);
      if (!target.corrosionStacks) target.el?.classList.remove('monster-corroding');
    }, 5080);
  }

  function cleanseOneAllyStatus(target) {
    if (!target || target.dead) return false;
    if (Number(target.corrosionStacks || 0) > 0 || target.el?.classList.contains('monster-corroding')) {
      target.corrosionGeneration = Number(target.corrosionGeneration || 0) + 1;
      target.corrosionStacks = 0;
      if (target.el) {
        target.el.dataset.corrosionStacks = '0';
        target.el.classList.remove('monster-corroding');
      }
      return true;
    }
    if (Number(target.stun || 0) > 0) {
      target.stun = 0;
      target.el?.classList.remove('stunned', 'hammer-stunned', 'nemesis-net-active');
      return true;
    }
    return false;
  }

  function enemyProjectile(source, target, kind, damage = 1, onImpact = null, origin = null, extraClass = '') {
    if (!target || target.dead || !state || state.status !== 'combat') return;
    if(source?.kind==='boss'&&extraClass!=='oort-final-wing-spike'&&['spike','monster-spike','ancient-bone-spike'].includes(kind))playBossFireSound();
    const sourcePoint = origin || pointOf(source);
    const targetPoint = pointOf(target);
    const projectile = document.createElement('i');
    projectile.className = `fx-enemy${kind === 'corrosion' || kind === 'monster-acid' ? ' corrosion' : ''}${kind === 'suicide' ? ' suicide' : ''}${kind === 'monster-spike' ? ' monster-spike' : ''}${kind === 'monster-acid' ? ' monster-acid' : ''}${kind === 'oort-slime' ? ' oort-slime' : ''}${kind === 'flameball' ? ' flameball' : ''}${kind === 'ancient-bone-spike' ? ' ancient-bone-spike' : ''}${kind === 'plasma-bug' ? ' plasma-bug' : ''}${extraClass ? ` ${extraClass}` : ''}`;
    const baseTravel = kind === 'flameball' ? 705 : kind === 'plasma-bug' ? 520 : 470;
    positionProjectile(projectile, sourcePoint, targetPoint);
    projectile.style.animationDuration = `${baseTravel}ms`;
    refs.effects.append(projectile);
    schedule(() => {
      projectile.remove();
      resolveEnemyProjectileHit(source, target, kind, damage, onImpact, targetPoint);
    }, baseTravel);
  }

  // 적 탄환 명중 처리(천상의 보호막·요격기·항모 보호막·일반 피해). 직선 탄환과 독성마수 포물선 독침이 함께 쓴다.
  // 일반 명중이면 true를 돌려준다.
  function resolveEnemyProjectileHit(source, target, kind, damage, onImpact, targetPoint, withExplosion = true) {
    if (target.isCelestialShield) {
      hitCelestialShield(target, targetPoint, source, damage);
      return false;
    }
    if (target.kind === 'interceptor') {
      dealCarrierInterceptorDamage(target, 75);
      createExplosion(targetPoint, kind === 'corrosion' ? 'acid' : 'enemy');
      return false;
    }
    if (target.isCarrier && target.shield > 0) {
      dealAllyDamage(target, damage, source);
      createCarrierShieldImpact(targetPoint);
      return false;
    }
    dealAllyDamage(target, damage, source);
    onImpact?.();
    if (withExplosion) createExplosion(targetPoint, kind === 'plasma-bug' ? 'plasma-bug' : kind === 'corrosion' || kind === 'monster-acid' || kind === 'oort-slime' ? 'acid' : kind === 'flameball' ? 'flame' : 'enemy');
    return true;
  }

  // 방패선 최종기술 '가시방패': 보호막이 받은 피해를 공격한 적에게 그대로 되돌려준다.
  function hitCelestialShield(guard, point, attacker, damage) {
    createCelestialShieldImpact(point);
    if (!guard?.reflect || !attacker || attacker.dead || !state || state.status !== 'combat') return;
    if (!(state.enemies?.includes(attacker) || attacker === state.boss || state.midBosses?.includes(attacker))) return;
    const amount = Math.max(1, Math.round(Number(damage) || 0));
    const thorn = document.createElement('i');
    thorn.className = 'fx-celestial-thorn';
    positionProjectile(thorn, point, pointOf(attacker));
    const fieldRect = refs.field.getBoundingClientRect(), to = pointOf(attacker);
    thorn.style.width = `${Math.hypot((to.x - point.x) * fieldRect.width, (to.y - point.y) * fieldRect.height)}px`;
    refs.effects.append(thorn);
    schedule(() => thorn.remove(), 260);
    schedule(() => shooterDamage(attacker, amount, guard, 'shield'), 140);
  }

  function createCelestialShieldImpact(point) {
    const impact = document.createElement('i');
    impact.className = 'fx-celestial-shield-impact';
    impact.style.left = percent(point.x + (Math.random() - .5) * .07);
    impact.style.top = percent(point.y + (Math.random() - .5) * .11);
    refs.effects.append(impact);
    schedule(() => impact.remove(), 420);
  }

  function drawFriendlyShot(ally, target, profile, delay) {
    schedule(() => {
      if (!state || state.status !== 'combat' || ally.dead || target.dead) return;
      if (profile.fx === 'laser') playLaserZapSound();
      const from = orientedAllyPoint(ally, 0, -.045);
      const to = pointOf(target);
      let effect;
      if (profile.fx === 'electric') {
        drawElectricStrike(from, to, Math.random() < .5 ? 1 : 2);
        schedule(() => createExplosion(to, profile.fx), profile.travel);
        return;
      }
      if (profile.fx === 'laser' || profile.fx === 'cannon') {
        effect = document.createElement('i');
        effect.className = `fx-line ${profile.fx}`;
        positionLine(effect, from, to);
      } else {
        effect = document.createElement('i');
        effect.className = profile.fx === 'plasma' ? 'fx-orb' : 'fx-missile';
        positionProjectile(effect, from, to);
      }
      refs.effects.append(effect);
      schedule(() => effect.remove(), Math.max(340, profile.travel + 140));
      schedule(() => createExplosion(to, profile.fx), profile.travel);
    }, delay);
  }

  function drawElectricStrike(from, to, variant = 1, duration = 120, soundPlayer = playElectricWeaponSound) {
    if (!refs.effects || !refs.field) return;
    soundPlayer?.();
    const rect = refs.field.getBoundingClientRect();
    const dx = (to.x - from.x) * rect.width;
    const dy = (to.y - from.y) * rect.height;
    const strike = document.createElement('i');
    strike.className = `electric-strike${duration > 120 ? ' atlas-electric-strike' : ''}`;
    strike.style.left = percent(from.x);
    strike.style.top = percent(from.y);
    strike.style.height = `${Math.max(24, Math.hypot(dx, dy))}px`;
    strike.style.setProperty('--electric-angle', `${Math.atan2(dy, dx) + Math.PI / 2}rad`);
    strike.style.backgroundImage = `url("electric-strike-${variant}.png")`;
    refs.effects.append(strike);
    schedule(() => strike.remove(), duration);
  }

  // 함포 개발 13단계 '폭렬탄': 함포 공격이 명중하면 폭발 범위(반경 56px) 안의 다른 적에게 그 공격 피해의 50%를 준다.
  const EXPLOSIVE_SHELL = { ratio: .5, radius: 56, fxGap: 150 };
  function applyExplosiveShellSplash(target, packets, source, attackType) {
    if (attackType === 'cannon-splash' || attackType === 'shield' || attackType === 'melt' || attackType === 'thunder' || !(Number(state?.tacticalResearch?.cannonTree?.explosiveShell) > 0)) return;
    const ship = source?.owner?.ship || source?.ship || source;
    if (!ship?.type || ship.type === 'frigate') return;
    if (!(window.ArenaCore?.weaponFields(ship, attackType) || []).includes('cannon')) return;
    const splash = Math.round(packets * EXPLOSIVE_SHELL.ratio);
    if (splash <= 0) return;
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480, height = field?.height || 720;
    const center = pointOf(target);
    const now = realPerformance.now();
    if (now - Number(source.explosiveShellFxAt || 0) >= EXPLOSIVE_SHELL.fxGap) {
      source.explosiveShellFxAt = now;
      createExplosion(center, 'cannon-splash');
    }
    livingEnemyTargets()
      .filter(enemy => enemy !== target && !enemy.dead && Math.hypot((enemy.x - center.x) * width, (enemy.y - center.y) * height) <= EXPLOSIVE_SHELL.radius)
      .forEach(enemy => shooterDamage(enemy, splash, source, 'cannon-splash'));
  }

  // 레이저 개발 13단계 '용융 레이저포': 레이저 공격에 피격된 대상은 1초마다 그 공격 피해의 33%를 3초간 추가로 받는다.
  // 3초 안에 다시 피격되면 남은 시간이 3초로 다시 채워진다. 녹아내리는 연출(melting-target)을 함께 보여준다.
  const MELTING_LASER = { ratio: .33, ticks: 3, tickDelay: 1000 };
  function applyMeltingLaser(target, packets, source, attackType) {
    if (attackType !== 'laser' || !target || target.dead || source?.isArenaShip || isPiercingShot(source, attackType)) return;
    if (!(Number(state?.tacticalResearch?.laserTree?.meltingLaser) > 0)) return;
    target.meltingPackets = Math.max(1, Math.round(packets * MELTING_LASER.ratio));
    target.meltingSource = source;
    target.meltingTicksLeft = MELTING_LASER.ticks;
    target.el?.classList.add('melting-target');
    if (!target.meltingRunning) scheduleMeltingTick(target);
  }
  function scheduleMeltingTick(target) {
    target.meltingRunning = true;
    schedule(() => {
      if (target.dead || target.meltingTicksLeft <= 0) {
        target.meltingRunning = false;
        target.el?.classList.remove('melting-target');
        return;
      }
      target.meltingTicksLeft -= 1;
      dealEnemyDamage(target, target.meltingPackets, target.meltingSource, 'melt');
      scheduleMeltingTick(target);
    }, MELTING_LASER.tickDelay);
  }

  // 전기 개발 '뇌절': 전격 무기에 피격된 대상에서 가까운 적 3명에게 각각 줄기를 뻗는다. 줄기마다 피해의 50%를 주고 감전시킨다.
  // 같은 적은 한 번만 맞고, 피격 대상 자신은 제외한다. 줄기에 맞은 적도 감전될 수 있다.
  const THUNDER_CASCADE = { ratio: .5, count: 3, travel: 110, stun: 800 };
  function applyThunderCascade(target, packets, source, attackType) {
    if (attackType !== 'electric' || !target || target.dead || !source || source.isArenaShip) return;
    if (!(Number(state?.tacticalResearch?.electricTree?.thunderCascade) > 0)) return;
    const sequence = livingEnemyTargets()
      .filter(enemy => enemy !== target && !enemy.dead)
      .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
      .slice(0, THUNDER_CASCADE.count);
    const damage = Math.max(1, Math.round(packets * THUNDER_CASCADE.ratio));
    sequence.forEach((enemy, index) => {
      drawAtlasElectric(pointOf(target), pointOf(enemy));
      schedule(() => {
        if (enemy.dead) return;
        shooterDamage(enemy, damage, source, 'thunder');
        if (enemy.dead) return;
        applyThunderShock(enemy);
      }, THUNDER_CASCADE.travel);
    });
  }
  function applyThunderShock(enemy) {
    enemy.stun = Math.max(Number(enemy.stun) || 0, THUNDER_CASCADE.stun);
    enemy.thunderShockUntil = performance.now() + THUNDER_CASCADE.stun;
    enemy.el?.classList.add('stunned', 'atlas-electrified');
    schedule(() => {
      if (performance.now() < Number(enemy.thunderShockUntil || 0)) return;
      enemy.el?.classList.remove('atlas-electrified');
      if (Number(enemy.stun || 0) <= 0) enemy.el?.classList.remove('stunned');
    }, THUNDER_CASCADE.stun + 50);
  }

  // 관통레이저 판별: 관통 공격이거나, 레이저 공격 중 무기에 '관통'이 있고 '레이저포'가 없는 함선의 공격이다.
  function isPiercingShot(source, attackType) {
    if (attackType === 'piercing') return true;
    if (attackType !== 'laser') return false;
    const ship = source?.owner?.ship || source?.ship || source;
    const weapon = String(ship?.profile?.[1] || '');
    return weapon.includes('관통') && !weapon.includes('레이저포');
  }
  // 관통레이저 개발 13단계 '폭발레이저': 관통레이저에 피해를 입은 대상이 폭발하여 주변 적에게 그 피해의 50%를 스플래시로 준다.
  const EXPLODING_LASER = { ratio: .5, radius: 56, fxGap: 150 };
  function applyExplodingLaserSplash(target, packets, source, attackType) {
    if (attackType === 'cannon-splash' || attackType === 'shield' || attackType === 'melt' || !isPiercingShot(source, attackType)) return;
    if (!(Number(state?.tacticalResearch?.piercingTree?.explosiveLaser) > 0)) return;
    const splash = Math.round(packets * EXPLODING_LASER.ratio);
    if (splash <= 0) return;
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480, height = field?.height || 720;
    const center = pointOf(target);
    const now = realPerformance.now();
    if (source && now - Number(source.explodingLaserFxAt || 0) >= EXPLODING_LASER.fxGap) {
      source.explodingLaserFxAt = now;
      createExplosion(center, 'cannon-splash');
    }
    livingEnemyTargets()
      .filter(enemy => enemy !== target && !enemy.dead && Math.hypot((enemy.x - center.x) * width, (enemy.y - center.y) * height) <= EXPLODING_LASER.radius)
      .forEach(enemy => shooterDamage(enemy, splash, source, 'cannon-splash'));
  }

  // 쏘는 쪽에 따라 피해 함수를 고른다. 아레나 상대 함선이 쏘면 아군에게 피해를 주고, 그 밖에는 기존 적 피해 함수를 쓴다.
  function shooterDamage(target, packets, source = null, attackType = 'normal') {
    // 발사자를 명시하지 않으면 현재 발사자(activeDamageSource)를 쓴다. 상대 함선이 쏘는 중이면 아군에게 피해를 준다.
    const shooter = source || activeDamageSource;
    // 아레나 상대 함선의 피해도 아군과 같이 함선 강화 배율을 곱한다(연구 보너스는 상대에게 적용하지 않음).
    if (shooter?.isArenaShip) return dealAllyDamage(target, packets * combatStatFactor(shooter), shooter);
    return dealEnemyDamage(target, packets, source, attackType);
  }
  // 함선 종류별 피해 감소(아군·아레나 상대 공통): 중전함 10%, 전투순양함 3%, 구축함 0%.
  const SHIP_TYPE_DAMAGE_REDUCTION = { dreadnought: .10, battlecruiser: .03, destroyer: 0 };
  function shipDamageReduction(unit) {
    return SHIP_TYPE_DAMAGE_REDUCTION[unit?.ship?.type || unit?.shipType] || 0;
  }

  // 아레나 상대 함선의 방어막: 체력 옆 막대에 표시하고, 수치를 바꿀 때 막대도 같이 바꾼다.
  function setArenaEnemyShield(enemy, amount) {
    enemy.enemyShield = Math.max(0, Number(amount) || 0);
    enemy.enemyShieldMax = Math.max(1, enemy.enemyShield);
    updateArenaEnemyShieldBar(enemy);
  }
  function updateArenaEnemyShieldBar(enemy) {
    const bar = enemy.el?.querySelector('.enemy-shield-bar i');
    if (bar) bar.style.width = `${Math.max(0, (Number(enemy.enemyShield) || 0) / Math.max(1, Number(enemy.enemyShieldMax) || 1) * 100)}%`;
  }
  // 발사자 기준 아군 목록: 아군은 아군 함선, 아레나 상대 함선은 상대 함선이다(보호·회복·방패 대상).
  function friendliesOf(unit) {
    if (!unit?.isArenaShip) return state.allies.filter(candidate => !candidate.dead);
    return state.enemies.filter(candidate => candidate.isArenaShip && !candidate.dead);
  }

  function dealEnemyDamage(target, packets, source = null, attackType = 'normal') {
    if (!state || state.status !== 'combat' || !target || target.dead) return;
    // 아레나 상대 함선의 면역·회피(탱크·앙헬라·니미츠·야마토의 면역, 도저의 회피 기동)
    if (target.isArenaShip) {
      packets = packets * (1 - shipDamageReduction(target));
      const now = performance.now();
      if (['tankImmuneUntil', 'angelaImmuneUntil', 'nimitzImmuneUntil', 'yamatoImmuneUntil'].some(key => Number(target[key] || 0) > now)) {
        showUnitDamage(target, '0');
        return;
      }
      if (Number(target.dozerEvasionUntil || 0) > now) {
        const evasionChance = target.dozerStars >= 3 ? DOZER_EVASION.enhancedChance : DOZER_EVASION.chance;
        if (Math.random() < evasionChance) {
          showUnitDamage(target, 'MISS');
          return;
        }
      }
    }
    if (target.variant === 'machine-beast' && target.machineAirborne) return;
    if (target.variant === 'blackbeard' && state.bounty?.pirate !== 'red' && state.bounty?.stage >= BLACKBEARD_EVASION.fromStage) {
      if (!target.evasion && target.hp <= target.maxHp * BLACKBEARD_EVASION.hpRatio) {
        target.evasion = true;
        announce('검은수염 · 회피 기동 가동', 'boss');
      }
      if (target.evasion && Math.random() < BLACKBEARD_EVASION.chance) {
        showUnitDamage(target, 'MISS');
        return;
      }
    }
    if (target.variant?.startsWith('kepler-alien-') && performance.now() < Number(target.enemyImmuneUntil || 0)) {
      showUnitDamage(target, 'BLOCK');
      return;
    }
    source ||= activeDamageSource;
    const weaknessMultiplier = source?.isSuPanokseon && Number(target.weakExposedUntil) > performance.now() ? 2 : 1;
    const plasmaBugMissileMultiplier = target.monsterType === 'plasma-bug' && attackType === 'missile' ? 2 : 1;
    const pandoraDespairMultiplier = source?.isPandora && source.pandoraDespairActive && source.pandoraStars < 5 ? 2 : 1;
    // 폭렬탄 스플래시(cannon-splash)는 이미 계산이 끝난 피해의 50%라서 배율·연구 보너스를 다시 곱하지 않는다.
    const fixedPackets = attackType === 'shield' || attackType === 'cannon-splash' || attackType === 'melt' || attackType === 'thunder';
    const basePackets = fixedPackets ? packets : packets * weaknessMultiplier * plasmaBugMissileMultiplier * pandoraDespairMultiplier * (state.damageBoost > 0 ? 1.1 : 1);
    const statFactor = attackType === 'cannon-splash' || attackType === 'melt' || attackType === 'thunder' ? 1 : combatStatFactor(source);
    const researchDamage = fixedPackets ? 0 : tacticalWeaponBonus(source,attackType).damage;
    const scaledPackets = basePackets * statFactor * (1+researchDamage) + (source?.starDamageRemainder || 0);
    const roundedPackets = Math.round(scaledPackets);
    if (source && (statFactor !== 1 || researchDamage)) source.starDamageRemainder = scaledPackets - roundedPackets;
    const boostedPackets = Math.max(1, roundedPackets);
    const absorbed = Math.min(Math.max(0, Number(target.enemyShield) || 0), boostedPackets);
    if (absorbed > 0) {
      target.enemyShield = Math.max(0, target.enemyShield - absorbed);
      updateArenaEnemyShieldBar(target);
      if (target.enemyShield <= 0 && performance.now() >= Number(target.enemyImmuneUntil || 0)) {
        target.el?.classList.remove('kepler-alien-shielded');
        if (target.variant === 'kepler-alien-angela') target.el?.classList.remove('angel-wing-blessing');
        target.el?.querySelector('.kepler-alien-shield')?.remove();
      }
    }
    const hpPackets = boostedPackets - absorbed;
    let dealt = 0;
    dealt = Math.max(0, Math.min(hpPackets, target.hp));
    target.hp -= dealt;
    if (!dealt && !absorbed) return;
    flashTarget(target);
    showUnitDamage(target, dealt || `${formatNumber(absorbed)} SHIELD`);
    applyExplosiveShellSplash(target, boostedPackets, source, attackType);
    applyMeltingLaser(target, boostedPackets, source, attackType);
    applyExplodingLaserSplash(target, boostedPackets, source, attackType);
    applyThunderCascade(target, boostedPackets, source, attackType);
    if (target.kind === 'boss' && dealt >= Math.max(1, target.maxHp) * .02) shakeBattlefield();
    if (target.kind === 'boss') {
      updateBossHud(target);
      updateHud();
      if (target.variant === 'ancient-beast') {
        if (isAncientBeastPlasmaWaveGate()) {
          const crossed = Math.min(7, Math.floor((target.maxHp - Math.max(30000, target.hp)) / (target.maxHp * .1)));
          while ((target.plasmaWaves || 0) < crossed) {
            target.plasmaWaves = (target.plasmaWaves || 0) + 1;
            spawnAncientPlasmaBugs(target, PLASMA_BUG.count);
          }
        }
        const retreatThreshold = isOortPlasmaBugGate() ? 30000 : isMagentaTasOperation() && Number(state.operation?.gate) === 5 ? 10000 : target.maxHp * .5;
        if (target.hp <= retreatThreshold) {
          retreatAncientBeast(target);
          return;
        }
      }
      if (target.hp <= 0) destroyBoss(target);
      return;
    }
    target.healthBar.style.width = `${Math.max(0, target.hp / Math.max(1, target.maxHp) * 100)}%`;
    if (target.kind === 'pirate') {
      if (target.hp <= 0) destroyPirate(target);
      return;
    }
    if (target.hp <= 0) destroyNormalEnemy(target);
  }

  function dealAllyDamage(ally, packets, source = null) {
    if (!state || state.status !== 'combat' || !ally || ally.dead) return;
    const now = performance.now();
    if (ally.isVaryag && ally.varyagLastStandUntil > now) {
      showUnitDamage(ally, '0');
      return;
    }
    if (Number(ally.tankImmuneUntil || 0) > now || Number(ally.angelaImmuneUntil || 0) > now || Number(ally.nimitzImmuneUntil || 0) > now || Number(ally.yamatoImmuneUntil || 0) > now) {
      showUnitDamage(ally, '0');
      return;
    }
    if (Number(ally.dozerEvasionUntil || 0) > now) {
      const enhancedChance = ally.dozerStars >= 3 ? DOZER_EVASION.enhancedChance : DOZER_EVASION.chance;
      const decoyBonus = ally.dozerStars >= 5 && Number(ally.dozerDecoyUntil || 0) > now ? DOZER_EVASION.decoyBonus : 0;
      if (Math.random() < Math.min(1, enhancedChance + decoyBonus)) {
        showUnitDamage(ally, 'MISS');
        return;
      }
    }
    // Mars tutorial gates 2–5 halve damage from bosses, including scripted attacks.
    const tutorialDamageFactor = source?.kind === 'boss' ? tutorialEnemyFactor(state.operation) : 1;
    const enemyAttackFactor = source && !source.isArenaShip && !String(source.id || "").startsWith("ally") ? ENEMY_ATTACK_BALANCE : 1;
    packets = Math.max(0, Math.round(Number(packets) * tutorialDamageFactor * enemyAttackFactor));
    const fireDustMultiplier = ally.fireDustActive && source?.kind === 'boss' && source.variant === 'flame-beast' ? 1.5 : 1;
    const tankReduction = Number(ally.tankReducedFrom || 0) <= now && Number(ally.tankReducedUntil || 0) > now ? Number(ally.tankReductionRatio || 1) : 1;
    const nemesisReduction = ally.nemesisNetActive ? (ally.nemesisStars >= 5 ? .8 : .9) : 1;
    const packetDamage = nemesisReduction * fireDustMultiplier * tankReduction * (ally.assaultTurtleUltimateActive ? .5 : 1) * (1 - shipDamageReduction(ally));
    const shieldDamageFactor=(1-Math.min(.9,ally.tacticalDefense?.reduction||0))/(1+(ally.tacticalDefense?.shield||0));
    if (ally.isVaryag && ally.varyagStars >= 5 && !ally.varyagLastStandUsed && packets * packetDamage >= ally.hp + ally.shield) {
      ally.varyagLastStandUsed = true;
      ally.varyagLastStandUntil = now + VARYAG_LAST_STAND;
      ally.hp = 1;
      ally.shield = 0;
      ally.shieldEl?.remove();
      ally.shieldEl = null;
      ally.healthBar.style.width = `${100 / ally.maxHp}%`;
      ally.el?.classList.add('varyag-last-stand');
      flashTarget(ally);
      announce(`${ally.ship.name} · 용맹`, 'friendly');
      schedule(() => {
        ally.varyagLastStandUntil = 0;
        ally.el?.classList.remove('varyag-last-stand');
        if (!ally.dead && state.status === 'combat') retreatAlly(ally);
      }, VARYAG_LAST_STAND);
      return;
    }
    if (ally.isYamato && ally.yamatoStars >= 5 && !ally.yamatoLastStandUsed && packets * packetDamage >= ally.hp + ally.shield) {
      showUnitDamage(ally, 'LAST STAND');
      flashTarget(ally);
      triggerYamatoLastStand(ally);
      return;
    }
    let received = 0;
    for (let index = 0; index < packets; index += 1) {
      if (ally.shield > 0) { ally.shield -= packetDamage*shieldDamageFactor; received += packetDamage*shieldDamageFactor; }
      else if(ally.tacticalFighterGuard>0){const blocked=Math.min(packetDamage,ally.tacticalFighterGuard);ally.tacticalFighterGuard-=blocked;ally.hp-=packetDamage-blocked;received+=packetDamage;}
      else { ally.hp -= packetDamage; received += packetDamage; }
    }
    const shieldLabel = ally.shieldEl?.querySelector('em');
    if (shieldLabel) shieldLabel.textContent = ally.shieldEl?.classList.contains('planet-destroyer-defense-shield') ? `SPACE ${formatNumber(Math.max(0, ally.shield))}` : ally.shieldEl?.classList.contains('dread-turtle-gwimyeon-shield') ? `GWIMYEON ${formatNumber(Math.max(0, ally.shield))}` : ally.shieldEl?.classList.contains('colossus-reinforced') ? `AEGIS ${formatNumber(Math.max(0, ally.shield))}` : ally.shieldEl?.classList.contains('nimitz-overdrive-shield') ? `OVERDRIVE ${formatNumber(Math.max(0, ally.shield))}` : ally.shieldEl?.classList.contains('assault-plasma-shield') ? `AQUA AEGIS ${formatNumber(Math.max(0, ally.shield))}` : ally.shieldEl?.classList.contains('ironfist-defense-shield') ? `IRON SHIELD ${formatNumber(Math.max(0, ally.shield))}` : `PLASMA ${formatNumber(Math.max(0, ally.shield))}`;
    updateColossusShieldGauge(ally);
    updateDreadTurtleShieldGauge(ally);
    updateAssaultTurtleShieldGauge(ally);
    flashTarget(ally);
    showUnitDamage(ally, Number(received.toFixed(1)));
    if (ally.shield <= 0 && (ally.shieldEl || ally.angelaShieldActive)) {
      ally.chargeShieldActive = false;
      const depletedShield = ally.shieldEl;
      if (depletedShield?.classList.contains('ironfist-defense-shield')) {
        ally.maxShield = 0;
        ally.ironFistShieldEl = null;
      }
      if (depletedShield) {
        depletedShield.classList.add('broken');
        schedule(() => depletedShield.remove(), 420);
      }
      ally.shieldEl = null;
      ally.gwimyeonShieldActive = false;
      ally.dreadTurtleFearEnabled = false;
      ally.el?.classList.remove('dread-turtle-gwimyeon-active');
      clearDreadTurtleShieldVisual(ally);
      ally.angelaShieldActive = false;
      ally.el?.classList.remove('angel-wing-blessing');
      clearColossusShieldGauge(ally);
      clearDreadTurtleShieldGauge(ally);
      clearNimitzShieldGauge(ally);
      clearCarrierShieldGauge(ally);
      clearAssaultTurtleShieldGauge(ally);
      ally.el?.classList.remove('nimitz-shield-pulse');
      ally.el?.classList.remove('assault-turtle-shield-pulse');
      ally.el?.classList.remove('science-drone-shielded');
    }
    ally.healthBar.style.width = `${Math.max(0, ally.hp / ally.maxHp * 100)}%`;
    if (ally.hp <= 0 && ally.isGarudaWingman) {
      ally.dead = true;
      ally.el?.classList.add('retreating');
      announce('우파가루다 파괴', 'danger');
      schedule(() => ally.el?.remove(), 460);
    } else if (ally.hp <= 0) retreatAlly(ally);
    else if (ally.isPlanetDestroyer && ally.planetDestroyerStars >= 3) counterPlanetDestroyerAttack(ally, source);
  }

  function retreatAlly(ally) {
    if (!ally || ally.dead) return;
    ally.dead = true;
    ally.charging = false;
    ally.el?.classList.remove('kddx-chain-charging', 'kddx-chain-firing', 'kddx-redeploying');
    focusBattleAudio('retreat');
    ally.el?.classList.add('retreating');
    announce(`${ally.ship.name} 퇴각`, 'danger');
    if (ally.isKddx && ally.kddxStars >= 5 && state?.status === 'combat') {
      const wait = 10000 + ally.kddxRetreatCount * 4000;
      ally.kddxRetreatCount += 1;
      ally.kddxReturnPending = true;
      schedule(() => {
        if (state?.status !== 'combat' || !ally.kddxReturnPending) return;
        ally.kddxReturnPending = false;
        ally.dead = false;
        ally.hp = Math.max(1, Math.round(ally.maxHp * .1));
        ally.shield = 0;
        ally.stun = 0;
        ally.energy = 0;
        ally.nextShot = 220;
        ally.rechargePause = 0;
        ally.charging = true;
        ally.healthBar.style.width = `${ally.hp / ally.maxHp * 100}%`;
        updateBattlecruiserEnergy(ally);
        moveAlly(ally, { x: ally.homeX, y: Math.min(.94, ally.homeY + .16) });
        ally.el?.classList.add('kddx-redeploying');
        ally.el?.classList.remove('retreating');
        announce(`${ally.ship.name} · 임전무퇴 재출격`, 'friendly');
        schedule(() => {
          if (ally.dead || state?.status !== 'combat') return;
          moveAlly(ally, { x: ally.homeX, y: ally.homeY });
        }, 40);
        schedule(() => {
          if (ally.dead || state?.status !== 'combat') return;
          ally.charging = false;
          ally.el?.classList.remove('kddx-redeploying');
        }, 960);
      }, wait);
    }
    if (!state?.allies?.some(candidate => !candidate.dead || candidate.kddxReturnPending)) finishBattle(false, '모든 아군 함선이 퇴각했습니다.');
  }

  // 보스 출현: 화면 가운데에 경고 줄무늬 띠와 "WARNING", 보스 이름이 지나가고 화면 가장자리가 붉게 맥동합니다(터치는 막지 않음).
  function showBossWarning(message = '') {
    if (!refs.viewport || state?.arenaMatch) return;
    playBossWarningSiren();
    refs.viewport.querySelector('.boss-warning')?.remove();
    refs.battleAnnouncement?.classList.remove('show');
    const name = String(message).replace(/\s*출현\s*$/, '').trim();
    const layer = document.createElement('div');
    layer.className = 'boss-warning';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = `<div class="boss-warning-band"><i class="boss-warning-stripes"></i><strong>WARNING</strong><small>${escapeHtml(name || '보스 출현')}</small><i class="boss-warning-stripes bottom"></i></div>`;
    refs.viewport.append(layer);
    setTimeout(() => layer.remove(), 2100 / battleSpeed);
  }

  // 중간보스 처치 순간 잠깐(실제 0.65초) 전투 시계를 30%로 늦춰 무게감을 줍니다. 끝나면 원래 배속으로 돌아갑니다.
  function bossKillSlowMotion() {
    if (!state || state.status !== 'combat' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setBattleClockSpeed(battleSpeed * .3);
    setTimeout(() => { if (state) syncBattleSpeed(); else setBattleClockSpeed(1); }, 650);
  }

  // 보스 체력 막대: 50% 이하 주황, 25% 이하 붉게 깜빡임. 막대 폭이 바뀔 때마다 자동으로 단계를 맞춥니다.
  function watchBossBarPhase(bar) {
    if (!bar || typeof MutationObserver !== 'function') return;
    const sync = () => {
      const ratio = parseFloat(bar.style.width);
      bar.classList.toggle('phase-mid', ratio <= 50 && ratio > 25);
      bar.classList.toggle('phase-low', ratio <= 25 && ratio > 0);
    };
    new MutationObserver(sync).observe(bar, { attributes: true, attributeFilter: ['style'] });
    sync();
  }

  // 처치 보상감: 처치한 몬스터에서 빛 조각이 나와 상단 GATE 진행 막대로 빨려 들어가고, 도착하면 막대가 번쩍입니다.
  // 화면이 어지럽지 않도록 동시에 8개까지만 날립니다.
  let activeKillOrbs = 0;
  function flyKillOrb(unit) {
    if (activeKillOrbs >= 8 || !refs.viewport || !refs.battleGateProgress || !unit?.el || typeof Element.prototype.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const viewportRect = refs.viewport.getBoundingClientRect(), unitRect = unit.el.getBoundingClientRect(), barRect = refs.battleGateProgress.getBoundingClientRect();
    if (!unitRect.width || !barRect.height) return;
    const startX = unitRect.left + unitRect.width / 2 - viewportRect.left, startY = unitRect.top + unitRect.height / 2 - viewportRect.top;
    const dx = barRect.right - viewportRect.left - startX, dy = barRect.top + barRect.height / 2 - viewportRect.top - startY;
    const orb = document.createElement('i');
    orb.className = 'kill-orb';
    orb.style.left = `${startX}px`;
    orb.style.top = `${startY}px`;
    refs.viewport.append(orb);
    activeKillOrbs += 1;
    const flight = orb.animate([
      { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * .12}px), calc(-50% + ${dy * .12 + 16}px)) scale(1.15)`, opacity: 1, offset: .28 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.45)`, opacity: .9 }
    ], { duration: 560, delay: 120, easing: 'cubic-bezier(.5,0,.8,.45)', fill: 'forwards' });
    flight.playbackRate = battleSpeed;
    flight.finished.then(pulseGateProgress, () => {}).finally(() => { orb.remove(); activeKillOrbs = Math.max(0, activeKillOrbs - 1); });
  }
  function pulseGateProgress() {
    const hud = refs.battleGateProgressHud;
    if (!hud) return;
    hud.classList.remove('gate-pulse');
    void hud.offsetWidth;
    hud.classList.add('gate-pulse');
  }

  function destroyNormalEnemy(enemy) {
    if (enemy.dead) return;
    if (enemy.isArenaShip) { retreatArenaShip(enemy); return; }
    enemy.dead = true;
    window.addMissionProgress?.('daily', 'sweep', 1);
    window.addMissionProgress?.('weekly', 'destroy-500', 1);
    if (enemy.monsterType === 'plasma-bug') clearPlasmaBugFx(enemy);
    playMonsterDeathSound(enemy);
    enemy.el.classList.remove('attacking');
    enemy.el.classList.add('destroyed');
    if (enemy.monsterType !== 'plasma-bug') state.kills += 1;
    if (enemy.countsForGate) state.magentaBaseKills = Number(state.magentaBaseKills || 0) + 1;
    if (enemy.countsForGate !== false) flyKillOrb(enemy);
    if (!playDeathFx(enemy, 'small')) createExplosion(pointOf(enemy), 'enemy');
    schedule(() => enemy.el.remove(), 360);
    updateHud(true);
    checkBossThreshold();
  }

  function destroyPirate(pirate) {
    if (!pirate || pirate.dead) return;
    pirate.dead = true;
    pirate.el?.classList.add('destroyed');
    if (!playDeathFx(pirate, pirate.isGoldenPirate ? 'large' : 'small')) createExplosion(pointOf(pirate), pirate.isGoldenPirate ? 'golden-pirate' : 'space-pirate');
    const balances = window.gameResources || (window.gameResources = { gold: 0, thorium: 0, lionToken: 0 });
    if (pirate.isGoldenPirate) {
      if (Math.random() < .5) {
        const thorium = SPACE_PIRATE.goldenThoriumMin + Math.floor(Math.random() * (SPACE_PIRATE.goldenThoriumMax - SPACE_PIRATE.goldenThoriumMin + 1));
        balances.thorium = (Number(balances.thorium) || 0) + thorium;
        announce(`황금 우주해적 격파 · 토륨 +${thorium}`, 'friendly');
      } else {
        balances.lionToken = (Number(balances.lionToken) || 0) + 1;
        window.recordLionTokensEarned?.(1);
        announce('황금 우주해적 격파 · 사자증표 +1', 'friendly');
      }
    } else {
      const thorium = SPACE_PIRATE.thoriumMin + Math.floor(Math.random() * (SPACE_PIRATE.thoriumMax - SPACE_PIRATE.thoriumMin + 1));
      balances.thorium = (Number(balances.thorium) || 0) + thorium;
      announce(`우주해적선 격파 · 토륨 +${thorium}`, 'friendly');
    }
    try { localStorage.setItem('starfleet-game-resources-v1', JSON.stringify(balances)); } catch {}
    window.updateGameResourceHud?.();
    window.dispatchEvent(new Event('game-resources-updated'));
    schedule(() => pirate.el?.remove(), 420);
  }

  function checkBossThreshold() {
    if (!state || state.status !== 'combat') return;
    if (isKeplerSecretBaseOperation()) {
      if (!state.keplerAlienFleetSpawned) spawnKeplerAlienFleet();
      const fleet = [state.boss, ...(state.midBosses || [])].filter(ship => ship?.variant?.startsWith('kepler-alien-') && !ship.dead);
      if (state.keplerAlienFleetSpawned && fleet.length === 0) finishBattle(true);
      return;
    }
    if (isKeplerOperation() && ['kepler-orbit', 'kepler-atmosphere'].includes(String(state.operation?.region || '').toLowerCase())) {
      const gate = Number(state.operation?.gate);
      const region = String(state.operation?.region || '').toLowerCase();
      const normalsCleared = state.kills >= state.normalTotal && state.enemies.every(enemy => enemy.dead);
      if (gate === 5 && region === 'kepler-orbit') {
        if (!state.machineBossSpawned && state.kills >= Math.ceil(state.normalTotal * .9)) {
          // 대기권 5관문 보스는 등장 순간 한 번 전투를 멈추고 연출을 띄운 뒤 등장한다.
          if (region === 'kepler-atmosphere' && !state.keplerAtmosphereBossIntroSent) {
            state.keplerAtmosphereBossIntroSent = true;
            state.paused = true;
            window.dispatchEvent(new CustomEvent('kepler-boss-spawn-intro', { detail: { operation: state.operation } }));
          } else if (!state.paused) {
            state.machineBossSpawned = true;
            spawnBoss('machine-beast');
          }
        }
        if (normalsCleared && state.keplerMachineBossDefeated && !state.boss) finishBattle(true);
        return;
      }
      if (gate === 10) {
        // 외계 함대 등장 직전에 한 번 전투를 멈추고 연출(시나리오)을 띄운다. 연출이 끝나면 전투가 재개되며 함대가 등장한다.
        if (normalsCleared && !state.keplerAlienFleetSpawned && !state.keplerBossIntroSent && region === 'kepler-orbit') {
          state.keplerBossIntroSent = true;
          state.paused = true;
          window.dispatchEvent(new CustomEvent('kepler-boss-intro', { detail: { operation: state.operation } }));
        } else if (normalsCleared && !state.keplerAlienFleetSpawned && !state.paused) {
          spawnKeplerAlienFleet();
          // 대기권 10관문은 외계 함대가 등장한 뒤 한 번 전투를 멈추고 아이라의 연출을 띄운다.
          if (region === 'kepler-atmosphere' && !state.keplerAtmosphereAyraIntroSent) {
            state.keplerAtmosphereAyraIntroSent = true;
            state.paused = true;
            window.dispatchEvent(new CustomEvent('kepler-atmosphere-boss-spawned', { detail: { operation: state.operation } }));
          }
        }
        const fleet = [state.boss, ...(state.midBosses || [])].filter(ship => ship?.variant?.startsWith('kepler-alien-') && !ship.dead);
        if (state.keplerAlienFleetSpawned && normalsCleared && fleet.length === 0) finishBattle(true);
        return;
      }
    }
    if (isMagentaNearOperation()) {
      const baseKills = Number(state.magentaBaseKills || 0);
      if (!state.magentaOverlordSpawned && baseKills >= Math.ceil(state.normalTotal * .5)) {
        state.magentaOverlordSpawned = true;
        spawnBoss();
      }
      if (baseKills >= state.normalTotal && state.magentaOverlordDefeated) finishBattle(true);
      return;
    }
    if (isMidMonsterOperation()) {
      // 타스 10관문: 보스 등장 직전(일반 적 80% 처치)에 알려 함장의 대사를 띄울 수 있게 한다.
      if (isMagentaTasOperation() && Number(state.operation?.gate) === 10 && !state.bossOmenSent && Number(state.magentaBaseKills || 0) >= Math.ceil(state.normalTotal * .8)) {
        state.bossOmenSent = true;
        window.dispatchEvent(new CustomEvent('battle-boss-omen', { detail: { operation: state.operation } }));
      }
      // 마젠타 대기권 원시랩터는 10초, 기존 중형 몬스터는 15초 후 등장한다.
      const tasGateTenNormalsCleared = !isMagentaTasOperation() || Number(state.operation?.gate) !== 10
        || (Number(state.magentaBaseKills || 0) >= state.normalTotal && state.enemies.every(enemy => enemy.dead));
      if (!state.midBossPending && !state.midBossDefeated && !hasActiveMidMonster() && state.elapsed >= 15 && tasGateTenNormalsCleared) spawnBoss();
      if (isOortAncientBeastGate()) return;
      if (isMachineBeastGate()) {
        const normalEnemiesCleared = state.magentaBaseKills >= state.normalTotal && state.enemies.every(enemy => enemy.dead);
        if (normalEnemiesCleared && state.midBossDefeated && !hasActiveMidMonster() && !state.machineBossSpawned) {
          state.machineBossSpawned = true;
          spawnBoss('machine-beast');
        }
        // 대기권 5관문: 기계마수를 격파하고 일반 적을 모두 처치하면 끝난다(남은 중형 몬스터는 정리한다).
        // 일반 적 처치 수를 모두 채우고 기계마수를 격파했다면, 화면에 남은 중형 몬스터는 정리하고 끝낸다.
        if (region === 'kepler-atmosphere' && state.kills >= state.normalTotal && state.keplerAtmosphereMachineBossDefeated) {
          state.enemies.filter(enemy => !enemy.dead).forEach(enemy => { enemy.dead = true; enemy.el?.remove(); });
          state.midBosses = [];
          finishBattle(true);
        }
        return;
      }
      if (isMagentaAtmosphereOperation() && Number(state.operation?.gate) === 5) {
        const normalEnemiesCleared = state.magentaBaseKills >= state.normalTotal && state.enemies.every(enemy => enemy.dead);
        if (normalEnemiesCleared && state.midBossDefeated && !hasActiveMidMonster() && !state.atmosphereBossSpawned) {
          state.atmosphereBossSpawned = true;
          spawnBoss('four-wing-beast');
        }
        if (normalEnemiesCleared && state.atmosphereBossDefeated && !hasActiveMidMonster()) finishBattle(true);
        return;
      }
      // 오르트 5관문: 중형몹(랩터)과 일반 적을 모두 처치하면 붉은 대군주가 등장하고, 대군주 격파로 관문을 통과한다.
      if (isOortOperation() && Number(state.operation?.gate) === 5) {
        if (state.kills >= state.normalTotal && state.midBossDefeated && !hasActiveMidMonster() && !state.oortOverlordSpawned) {
          state.oortOverlordSpawned = true;
          spawnBoss('red-overlord');
        }
        return;
      }
      // 중형 몬스터와 일반 적을 모두 처치해야 관문을 통과한다.
      if (isMagentaTasOperation()) {
        // 타스 관문은 고정된 적 생성 시간이 지난 뒤 모든 적과 보스가
        // 사라졌는데도 중형 보스 플래그만 남는 경우가 있어 상태를 복구한다.
        const allNormalEnemiesGone = state.elapsed >= ENEMY_WAVE.baseDuration / 1000 + 2
          && state.enemies.every(enemy => enemy.dead)
          && !hasActiveMidMonster()
          && !state.midBossPending;
        if (allNormalEnemiesGone) state.midBossDefeated = true;
        if (state.magentaBaseKills >= state.normalTotal && state.midBossDefeated && !hasActiveMidMonster() && state.enemies.every(enemy => enemy.dead)) finishBattle(true);
      } else if (state.kills >= state.normalTotal && state.midBossDefeated && !hasActiveMidMonster()) finishBattle(true);
      return;
    }
    if (isBossGate()) {
      // 보스 등장 직전(일반 적 80% 처치) 시나리오가 함장 대사 등을 띄울 수 있도록 알린다.
      if (!state.boss && !state.bossOmenSent && state.kills >= Math.ceil(state.normalTotal * .8)) {
        state.bossOmenSent = true;
        window.dispatchEvent(new CustomEvent('battle-boss-omen', { detail: { operation: state.operation } }));
      }
      if (!state.boss && state.kills >= Math.ceil(state.normalTotal * .9)) spawnBoss();
      return;
    }
    if (state.kills >= state.normalTotal) finishBattle(true);
  }

  function isMidMonsterOperation() {
    const region = String(state?.operation?.region || '').toLowerCase();
    const gate = Number(state?.operation?.gate) || 0;
    if (isKeplerSecretBaseOperation()) return false;
    if (isKeplerOperation() && region === 'kepler-orbit' && [5, 10].includes(gate)) return false;
    // 케플러 대기권 10관문은 중형몹 없이 관문 보스 흐름으로 진행한다.
    // 중형몹 플래그가 남으면 15초 후 랩터를 다시 소환하거나 승리 조건을 막는다.
    if (isKeplerOperation() && region === 'kepler-atmosphere' && gate === 10) return false;
    if (isKeplerOperation() && gate >= 1 && gate <= 10) return true;
    if (isMagentaNearOperation() && gate === 10) return false;
    if (isMagentaTasOperation() && gate === 5) return false;
    if (isMagentaAtmosphereOperation() && gate >= 1 && gate <= 10) return true;
    return isMagentaTasOperation() || (region === 'titan' && gate >= 16 && gate !== 20) || (['oort', 'oort-cloud', 'oortcloud'].includes(region) && ![10, 15, 20].includes(gate));
  }

  function spawnKeplerAlienFleet() {
    if (!state || state.status !== 'combat' || state.keplerAlienFleetSpawned) return;
    state.keplerAlienFleetSpawned = true;
    const region = String(state.operation?.region || '').toLowerCase();
    const gate = Number(state.operation?.gate) || 1;
    const atmosphere = region === 'kepler-atmosphere';
    const secretBase = region === 'kepler-base';
    const lineup = secretBase
      ? gate <= 4 ? ['starcruiser', 'escort', 'escort']
        : gate === 5 ? ['angela', 'starcruiser', 'starcruiser']
          : gate <= 9 ? ['starcruiser', 'starcruiser', 'escort']
            : ['carrier']
      : atmosphere ? ['angela', 'starcruiser', 'escort'] : ['angela', 'escort', 'escort'];
    const total = lineup.length;
    state.keplerAlienFleetSize = total;
    const fleet = [];
    for (let index = 0; index < total; index += 1) {
      const role = lineup[index];
      const angela = role === 'angela';
      const starcruiser = role === 'starcruiser';
      const carrier = role === 'carrier';
      const sourceShip = angela
        ? { type: 'battlecruiser', rarity: 'L', enhancementStars: 5 }
        : starcruiser
        ? { name: '스타 크루저', type: 'battlecruiser', rarity: 'SSR', enhancementStars: 3 }
        : carrier ? { name: '외계 우주항모', type: 'carrier', rarity: 'L', enhancementStars: 5 }
          : { name: '블레이드', type: 'destroyer', rarity: 'SR', enhancementStars: 0 };
      const hp = carrier ? 200000 : angela ? Math.floor(7900 * combatStatFactor(sourceShip) * 3) : starcruiser ? Math.floor(25000 * combatStatFactor(sourceShip)) : 25000;
      const ship = {
        id: angela ? 'kepler-alien-angela' : `${carrier ? 'kepler-alien-carrier' : starcruiser ? 'kepler-alien-starcruiser' : 'kepler-alien-escort'}-${index}`,
        kind: 'boss',
        variant: angela ? 'kepler-alien-angela' : carrier ? 'kepler-alien-carrier' : starcruiser ? 'kepler-alien-starcruiser' : 'kepler-alien-escort',
        name: angela ? '외계 앙헬라' : carrier ? '외계 우주항모' : starcruiser ? '외계 스타크루저' : '외계 호위함',
        ship: sourceShip,
        damageSource: sourceShip,
        hp,
        maxHp: hp,
        attackPower: carrier ? 0 : angela ? 1050 : starcruiser ? Math.round(BATTLECRUISER_LASER.starCruiserHits * combatStatFactor(sourceShip)) : Math.round(BLADE_LASER.hits * combatStatFactor(sourceShip)),
        x: carrier ? .68 : [.5, .24, .76][index],
        y: -.26,
        entryStartY: -.26,
        entryTargetY: carrier ? .33 : .17 + (angela ? 0 : .025),
        entryDuration: 1500,
        entryTime: 1500 + index * 180,
        nextAttack: angela ? 2100 : starcruiser ? 680 : Infinity,
        nextFighterLaunch: carrier ? 0 : Infinity,
        nextShieldbreaker: carrier ? 5000 : Infinity,
        fightersLaunched: 0,
        nextShieldSkill: angela ? 9000 : Infinity,
        nextBladeLaser: role === 'escort' ? 5000 : Infinity,
        nextBladeVolley: role === 'escort' ? 10000 : Infinity,
        nextPhotonBattery: starcruiser ? 100000 : Infinity,
        nextLaserSide: 0,
        starCruiserMuzzleIndex: 0,
        enemyShield: 0,
        enemyImmuneUntil: 0,
        dead: false,
        stun: 0,
        requiredForGate: true
      };
      const element = document.createElement('div');
      element.className = `boss-unit kepler-alien-vessel ${angela ? 'kepler-alien-angela' : carrier ? 'kepler-alien-carrier' : starcruiser ? 'kepler-alien-starcruiser' : 'kepler-alien-escort'}`;
      element.style.left = percent(ship.x);
      // Main boss uses the CSS entrance position; an inline negative top would
      // override `.entered` and keep Angela above the viewport.
      if (!angela && !carrier) element.style.top = percent(ship.y);
      element.innerHTML = angela
        ? '<img class="boss-sprite" src="kepler-alien-angela.png" alt="외계 앙헬라" /><span>ANGELA</span>'
        : carrier
        ? '<img class="boss-sprite" src="kepler-alien-carrier.png" alt="외계 우주항모" /><span>ALIEN CARRIER</span>'
        : starcruiser
        ? '<img class="boss-sprite" src="star-cruiser-battle-topview-20261007.png" alt="외계 스타크루저" /><span>ALIEN STAR CRUISER</span>'
        : '<img class="boss-sprite" src="kepler-alien-escort.png" alt="외계 호위함" /><span>ALIEN ESCORT</span>';
      ship.el = element;
      fleet.push(ship);
      refs.enemyLayer.append(element);
      requestAnimationFrame(() => element.classList.add('entered'));
    }
    state.boss = fleet[0];
    state.midBosses.push(...fleet.slice(1));
    refs.battleBossHud.hidden = false;
    updateBossHud(state.boss);
    updateHud(true);
    focusBattleAudio('boss');
    const regionLabel = secretBase ? '비밀기지' : atmosphere ? '대기권' : '행성권';
    announce(`케플러 ${regionLabel} ${gate}관문 · ${carrierLineupLabel(lineup)} 접근`, 'boss');
  }

  function carrierLineupLabel(lineup) {
    const labels = { angela: '외계 앙헬라', starcruiser: '외계 스타크루저', escort: '외계 호위함', carrier: '외계 우주항모' };
    return lineup.map(role => labels[role] || role).join(' · ');
  }

  function isMidMonsterBoss(boss) {
    const variant=String(boss?.variant||'').toLowerCase();
    if (variant.startsWith('kepler-alien-')) return false;
    if (variant === 'machine-beast' || variant === 'four-wing-beast') return false;
    return Boolean(boss&&(boss.isMidMonster===true||boss.midMonster===true||boss.category==='mid-monster'||['raptor','primitive-raptor','blue-raptor','mechanical-beast','mech-beast'].includes(variant)||isMidMonsterOperation()));
  }

  function hasActiveMidMonster() {
    return Boolean((state?.boss && !state.boss.dead) || state?.midBosses?.some(monster => monster && !monster.dead));
  }

  function isBossGate() {
    const tasAncientBeastGate = isMagentaTasOperation() && Number(state?.operation?.gate) === 5;
    return tasAncientBeastGate || (!isMagentaNearOperation() && !isMagentaTasOperation() && Math.max(1, Number(state?.operation?.gate) || 1) % 5 === 0);
  }

  function spawnBoss(requestedVariant = '') {
    if (!state || state.boss || state.status !== 'combat') return;
    const gate = Number(state.operation?.gate);
    const tasArmsGate = isMagentaTasOperation() && gate === 10;
    const tasArmSequenceIndex = Number(state.tasArmSequenceIndex) || 0;
    const tasRightArm = tasArmsGate && tasArmSequenceIndex % 2 === 0;
    const tasLongArm = tasArmsGate && tasArmSequenceIndex % 2 === 1;
    const magentaPair = isMagentaNearOperation() && gate === 10;
    const tasAncientBeast = isMagentaTasOperation() && gate === 5;
    const greenOverlord = isMagentaTasOperation() && !tasAncientBeast && !tasArmsGate;
    const toxicBeast = isMagentaNearOperation() && gate === 5;
    const titanGasimon = state.operation?.region === 'titan' && [5, 15].includes(gate);
    const giantGasimon = (state.operation?.region === 'mars' && gate === 5) || titanGasimon;
    const giantDokchimmon = state.operation?.region === 'mars' && Number(state.operation?.gate) === 10;
    const oortRedOverlord = requestedVariant === 'red-overlord' && isOortOperation() && gate === 5;
    const redOverlord = (state.operation?.region === 'titan' && gate === 10) || oortRedOverlord || (isMagentaNearOperation() && !toxicBeast && !magentaPair);
    const flameBeast = (state.operation?.region === 'titan' && gate === 20) || magentaPair;
    const ancientBeast = isOortAncientBeastGate() || tasAncientBeast;
    const oortFinalBoss = isOortFinalBossGate();
    const machineBeast = requestedVariant === 'machine-beast' && isMachineBeastGate();
    const keplerMachineBeast = machineBeast && isKeplerOperation() && String(state.operation?.region || '').toLowerCase() === 'kepler-orbit';
    const keplerAtmosphereMachineBeast = machineBeast && isKeplerOperation() && String(state.operation?.region || '').toLowerCase() === 'kepler-atmosphere';
    const fourWingBeast = requestedVariant === 'four-wing-beast' && isMagentaAtmosphereOperation() && gate === 5;
    const raptor = isMidMonsterOperation() && !oortRedOverlord && !greenOverlord && !tasArmsGate && !fourWingBeast && !machineBeast;
    const primitiveRaptor = raptor && (isMagentaAtmosphereOperation() || isKeplerOperation());
    const raptorGrowth = normalEnemyGrowth(state.operation).multiplier * (isKeplerOperation() ? 1.8 : 1);
    const raptorStrength = primitiveRaptor ? 2 : 1;
    const giantGasimonHp = titanGasimon ? 10000 : 5000;
    const giantGasimonAttack = titanGasimon ? 50 : 20;
    const giantGasimonShots = titanGasimon ? 4 : 2;
    const giantGasimonInterval = titanGasimon ? 2000 : 3000;
    const boss = {
      id: 'boss',
      kind: 'boss',
      variant: tasRightArm ? 'tas-right-arm' : tasLongArm ? 'tas-long-arm' : greenOverlord ? 'green-overlord' : machineBeast ? 'machine-beast' : fourWingBeast ? 'four-wing-beast' : magentaPair ? 'flame-beast' : toxicBeast ? 'toxic-beast' : oortFinalBoss ? 'oort-final-boss' : ancientBeast ? 'ancient-beast' : primitiveRaptor ? 'primitive-raptor' : raptor ? 'raptor' : flameBeast ? 'flame-beast' : redOverlord ? 'red-overlord' : giantGasimon ? 'giant-gasimon' : giantDokchimmon ? 'giant-dokchimmon' : 'standard',
      hp: machineBeast ? (keplerAtmosphereMachineBeast ? 160000 : keplerMachineBeast ? 140000 : 120000) : fourWingBeast ? 35000 : tasRightArm ? 30000 : tasLongArm ? 40000 : greenOverlord ? 70000 : magentaPair ? 50000 : toxicBeast ? 100000 : oortFinalBoss ? 90000 : ancientBeast ? 100000 : raptor ? Math.round(2000 * raptorGrowth * raptorStrength) : flameBeast ? 30000 : redOverlord ? (oortRedOverlord ? 30000 : 20000) : giantGasimon ? giantGasimonHp : giantDokchimmon ? 10000 : 10000,
      maxHp: machineBeast ? (keplerAtmosphereMachineBeast ? 160000 : keplerMachineBeast ? 140000 : 120000) : fourWingBeast ? 35000 : tasRightArm ? 30000 : tasLongArm ? 40000 : greenOverlord ? 70000 : magentaPair ? 50000 : toxicBeast ? 100000 : oortFinalBoss ? 90000 : ancientBeast ? 100000 : raptor ? Math.round(2000 * raptorGrowth * raptorStrength) : flameBeast ? 30000 : redOverlord ? (oortRedOverlord ? 30000 : 20000) : giantGasimon ? giantGasimonHp : giantDokchimmon ? 10000 : 10000,
      x: tasRightArm ? .8 : tasLongArm ? .2 : magentaPair ? .34 : .5,
      y: tasRightArm ? .38 : tasLongArm ? .48 : -.23,
      entryStartY: -.23,
      entryTargetY: .17,
      entryDuration: 1150,
      entryTime: tasArmsGate ? 0 : 1150,
      dead: false,
      stun: 0,
      speed: ENEMY_PROFILES.gasimon.speed * 2,
      attackPower: machineBeast || fourWingBeast ? 300 : magentaPair || toxicBeast ? 200 : oortFinalBoss ? 160 : ancientBeast ? 100 : raptor ? Math.round(20 * raptorGrowth * raptorStrength) : giantGasimon ? giantGasimonAttack : giantDokchimmon ? 5 : 100,
      attackInterval: giantGasimonInterval,
      shotCount: giantGasimonShots,
      nextAttack: machineBeast || fourWingBeast ? 1000 : oortFinalBoss ? 1000 : ancientBeast ? 3000 : raptor || giantGasimon || giantDokchimmon || flameBeast ? (raptor ? 2500 : titanGasimon ? 2000 : 3000) : 120,
      nextBurst: raptor || giantGasimon ? Infinity : giantDokchimmon ? 5000 : 2800,
      nextWingAttack: oortFinalBoss ? 8000 : Infinity,
      nextTailAttack: oortFinalBoss ? 12000 : Infinity,
      nextPlasmaBug: oortFinalBoss ? 3000 : Infinity,
      nextSummon: redOverlord || greenOverlord ? 3000 : Infinity,
      nextFireDust: flameBeast ? 1000 : Infinity,
      nextEscort: ancientBeast ? (isMagentaTasOperation() && Number(state?.operation?.gate) === 5 ? 7500 : 15000) : Infinity,
      nextToxicShot: toxicBeast ? 2000 : Infinity,
      nextPoisonBreath: toxicBeast ? 5000 : Infinity,
      fourWingNetCooldown: 9000,
      fourWingChargeTimer: 0,
      fourWingVolleyRemaining: 0,
      fourWingVolleyCooldown: 0,
      machineFlightCooldown: 10000,
      machineFlightTimer: 0,
      machineAirborne: false,
      toxicBreathWindup: false,
      toxicBreathCharge: 0,
      plasmaWaves: 0,
      lifetime: 0,
      berserk: false,
      requiredForGate: isMagentaNearOperation() || tasArmsGate || fourWingBeast,
      armPhase: tasRightArm ? 'right-wait' : tasLongArm ? 'long-wait' : '',
      armTimer: tasLongArm ? 3500 : tasRightArm ? 2700 : 0
    };
    const tutorialHpFactor = tutorialEnemyFactor(state.operation);
    if (tutorialHpFactor < 1) {
      boss.hp = Math.max(1, Math.round(boss.hp * tutorialHpFactor));
      boss.maxHp = boss.hp;
    }
    const element = document.createElement('div');
    element.className = `boss-unit${tasRightArm ? ' tas-right-arm' : tasLongArm ? ' tas-long-arm' : greenOverlord ? ' boss-green-overlord' : machineBeast ? ' boss-machine-beast' : fourWingBeast ? ' boss-four-wing' : toxicBeast ? ' boss-toxic-beast' : oortFinalBoss ? ' boss-oort-final' : ancientBeast ? ' boss-ancient-beast' : raptor ? ` boss-mid-raptor${primitiveRaptor ? ' boss-primitive-raptor' : ''}` : flameBeast ? ' boss-flame-beast' : redOverlord ? ' boss-red-overlord' : giantGasimon ? ' boss-giant-gasimon' : giantDokchimmon ? ' boss-giant-dokchimmon' : ''}`;
    element.innerHTML = tasRightArm
      ? '<img class="boss-sprite" src="enemy-right-arm.png" alt="오른팔" />'
      : tasLongArm
      ? '<img class="boss-sprite" src="enemy-long-arm.png" alt="긴팔" /><i class="tas-long-arm-comet comet-a"></i><i class="tas-long-arm-comet comet-b"></i><i class="tas-long-arm-comet comet-c"></i><i class="tas-long-arm-comet comet-d"></i>'
      : greenOverlord
      ? '<img class="boss-sprite" src="enemy-green-overlord.png" alt="초록대군주" />'
      : machineBeast
      ? '<img class="boss-sprite" src="enemy-machine-beast.png" alt="기계마수" />'
      : fourWingBeast
      ? '<img class="boss-sprite" src="enemy-four-wing-beast.png" alt="4익마수" />'
      : oortFinalBoss
      ? '<img class="boss-sprite" src="oort-final-boss.png" alt="오르트구름 최종 보스" /><i class="oort-final-wing left"></i><i class="oort-final-wing right"></i><i class="oort-final-tail"></i><i class="oort-final-head"></i>'
      : ancientBeast
      ? '<img class="boss-sprite" src="enemy-ancient-beast.png" alt="고대 괴수" />'
      : raptor
      ? `<img class="boss-sprite" src="${primitiveRaptor ? 'enemy-primitive-raptor.png' : 'enemy-raptor.png'}" alt="${primitiveRaptor ? '원시랩터' : '중형 몬스터'}" />`
      : flameBeast
        ? '<img class="boss-sprite" src="enemy-flame-beast.png" alt="화염마수" /><i class="flame-beast-wing left"></i><i class="flame-beast-wing right"></i><i class="flame-beast-head"></i>'
      : redOverlord
        ? '<img class="boss-sprite" src="enemy-red-overlord.png" alt="붉은 대군주" />'
      : giantGasimon
      ? '<img class="boss-sprite" src="enemy-gasimon.png" alt="거대 가시몬" />'
      : giantDokchimmon
        ? '<img class="boss-sprite" src="enemy-dokchimmon.png" alt="거대 독침몬" />'
      : toxicBeast
        ? '<img class="boss-sprite" src="enemy-toxic-beast.png" alt="독성마수" /><i class="toxic-beast-head"></i><i class="toxic-beast-tail"></i>'
      : '<i class="boss-clamp clamp-a"></i><i class="boss-clamp clamp-b"></i><span class="boss-core"></span><b>Ω</b>';
    boss.el = element;
    if (magentaPair) element.style.left = percent(boss.x);
    state.boss = boss;
    refs.enemyLayer.append(element);
    if (fourWingBeast) castFourWingElectricNet(boss);
    if (magentaPair) {
      const secondary = {
        ...boss,
        id: 'magenta-toxic-beast',
        variant: 'toxic-beast',
        hp: 50000,
        maxHp: 50000,
        attackPower: 200,
        x: .66,
        nextAttack: 3000,
        nextFireDust: Infinity,
        nextToxicShot: 2000,
        nextPoisonBreath: 5000,
        toxicBreathWindup: false,
        toxicBreathCharge: 0,
        el: document.createElement('div')
      };
      secondary.el.className = 'boss-unit boss-toxic-beast magenta-pair-secondary';
      secondary.el.style.left = percent(secondary.x);
      secondary.el.innerHTML = '<img class="boss-sprite" src="enemy-toxic-beast.png" alt="독성마수" /><i class="toxic-beast-head"></i><i class="toxic-beast-tail"></i>';
      state.midBosses.push(secondary);
      state.magentaBossesRemaining = 2;
      refs.enemyLayer.append(secondary.el);
      requestAnimationFrame(() => secondary.el.classList.add('entered'));
    } else if (isMagentaNearOperation()) {
      state.magentaBossesRemaining = 1;
    }
    if (raptor && isOortOperation() && gate >= 11) {
      const secondary = { ...boss, id: 'mid-boss-2', x: .68, y: boss.y, dead: false, el: element.cloneNode(true) };
      secondary.el.classList.add('mid-boss-secondary');
      secondary.el.querySelector('.boss-sprite')?.setAttribute('alt', '중형 몬스터');
      state.midBosses.push(secondary);
      refs.enemyLayer.append(secondary.el);
      requestAnimationFrame(() => secondary.el.classList.add('entered'));
    }
    refs.battleBossHud.hidden = raptor && !ancientBeast;
    updateHud(true);
    if (!raptor || ancientBeast) updateBossHud();
    requestAnimationFrame(() => element.classList.add('entered'));
    if (!state.arenaMatch && !isKeplerOperation() && Number(state.operation?.gate) > 0 && Number(state.operation.gate) % 10 === 0) window.setBattleBossMusic?.(true);
    focusBattleAudio('boss');
    if(isOortColonyGate())playBossRoarSound();
    announce(tasRightArm ? '마젠타 위성 타스 · 오른팔 출현' : tasLongArm ? '마젠타 위성 타스 · 긴팔 출현' : greenOverlord ? '마젠타 위성 타스 · 초록대군주 출현' : machineBeast ? (keplerMachineBeast ? '케플러 행성권 5관문 · 기계마수 출현' : '마젠타 대기권 10관문 · 기계마수 출현') : fourWingBeast ? '마젠타 대기권 5관문 · 4익마수 출현' : magentaPair ? '마젠타 관문 10 · 화염마수와 독성마수 동시 출현' : toxicBeast ? '마젠타 인근 · 독성마수 출현' : oortFinalBoss ? '오르트구름 최종 보스 출현' : ancientBeast ? '고대 괴수 출현' : primitiveRaptor ? '원시랩터 출현' : raptor ? '중형 몬스터 출현' : flameBeast ? '화염마수 출현' : redOverlord ? '붉은 대군주 출현' : giantGasimon ? '거대 가시몬 출현' : giantDokchimmon ? '거대 독침몬 출현' : 'BOSS SIGNAL DETECTED', 'boss');
    showBossWarning(refs.battleAnnouncement?.textContent || "");
  }

  function destroyBoss(target = state.boss) {
    const boss = target;
    if (!boss || boss.dead) return;
    if (boss.variant === 'tas-long-arm') setTasSniperTarget(null);
    boss.toxicMouthGlow?.remove();
    boss.dead = true;
    const keplerAlien = boss.variant?.startsWith('kepler-alien-');
    if (!keplerAlien && boss.variant !== 'blackbeard') window.addMissionProgress?.('weekly', 'boss-5', 1);
    if (!keplerAlien && !String(boss.variant || '').startsWith('tas-')) setTimeout(bossKillSlowMotion, 0);
    focusBattleAudio(keplerAlien ? 'retreat' : 'boss');
    if (!keplerAlien) {
      if(isMidMonsterBoss(boss))playMidBossKillSound();
      else if(!isOortAncientBeastGate())playBossKillSound();
    }
    if (boss.variant === 'tas-right-arm' || boss.variant === 'tas-long-arm') {
      const defeated = boss.variant === 'tas-right-arm' ? '오른팔' : '긴팔';
      const nextIndex = (Number(state.tasArmSequenceIndex) || 0) + 1;
      const generation = state.generation;
      state.tasArmSequenceIndex = nextIndex;
      state.midBossPending = true;
      refs.battleBossHud.hidden = true;
      boss.el?.classList.remove('tas-right-arm-swipe', 'tas-long-arm-raising', 'tas-long-arm-holding', 'tas-long-arm-swinging', 'tas-long-arm-returning');
      boss.el?.classList.add('tas-arm-retreating');
      announce(`${defeated} 퇴각 · 다음 팔 출현 준비`, 'friendly');
      schedule(() => {
        boss.el?.remove();
        if (state?.boss === boss) state.boss = null;
        if (!state || state.generation !== generation || state.status !== 'combat') return;
        if (nextIndex >= 4) {
          state.midBossPending = false;
          state.midBossDefeated = true;
          refs.battleBossHud.hidden = true;
          updateHud(true);
          checkBossThreshold();
          return;
        }
        schedule(() => {
          if (!state || state.generation !== generation || state.status !== 'combat') return;
          state.midBossPending = false;
          spawnBoss();
        }, 2050);
      }, 950);
      return;
    }
    if (boss.variant === 'machine-beast' && isKeplerOperation() && ['kepler-orbit', 'kepler-atmosphere'].includes(String(state.operation?.region || '').toLowerCase()) && Number(state.operation?.gate) === 5) {
      if (state.boss === boss) state.boss = null;
      const atmosphereBoss = String(state.operation?.region || '').toLowerCase() === 'kepler-atmosphere';
      if (atmosphereBoss) state.keplerAtmosphereMachineBossDefeated = true;
      else state.keplerMachineBossDefeated = true;
      refs.battleBossHud.hidden = true;
      boss.el?.classList.add('destroyed');
      if (!playDeathFx(boss, 'large')) createExplosion(pointOf(boss), 'boss');
      schedule(() => boss.el?.remove(), 1050);
      announce(`${atmosphereBoss ? '케플러 대기권' : '케플러 행성권'} 5관문 · 기계마수 격파`, 'friendly');
      updateHud(true);
      checkBossThreshold();
      return;
    }
    if (keplerAlien) {
      if (state.boss === boss) state.boss = null;
      state.midBosses = state.midBosses.filter(ship => ship !== boss);
      boss.el?.classList.add('alien-retreating');
      schedule(() => boss.el?.remove(), 780);
      const remaining = [state.boss, ...state.midBosses].filter(ship => ship?.variant?.startsWith('kepler-alien-') && !ship.dead).length;
      announce(remaining ? `${boss.name} 퇴각 · 외계 함선 ${remaining}척 잔존` : '외계 앙헬라 함대 퇴각 완료', 'friendly');
      refs.battleBossHud.hidden = remaining === 0;
      updateHud(true);
      updateBossHud();
      checkBossThreshold();
      return;
    }
    if (boss.variant === 'raptor' || boss.variant === 'primitive-raptor' || boss.variant === 'green-overlord' || boss.variant === 'four-wing-beast') {
      if (state.boss === boss) state.boss = null;
      else state.midBosses = state.midBosses.filter(monster => monster !== boss);
      if (boss.variant === 'four-wing-beast') state.atmosphereBossDefeated = true;
      state.midBossDefeated = !hasActiveMidMonster();
      refs.battleBossHud.hidden = true;
      boss.el.classList.add('destroyed');
      if (!playDeathFx(boss, 'large')) createExplosion(pointOf(boss), 'boss');
      schedule(() => boss.el?.remove(), 420);
      announce(boss.variant === 'green-overlord' ? '초록대군주 격파 · 남은 몬스터를 섬멸하십시오' : boss.variant === 'four-wing-beast' ? '4익마수 격파 · 관문 통과' : boss.variant === 'primitive-raptor' ? '원시랩터 격파' : '중형 몬스터 격파', 'friendly');
      updateHud(true);
      checkBossThreshold();
      return;
    }
    if (boss.requiredForGate) {
      if (state.magentaBossesRemaining > 0) state.magentaBossesRemaining -= 1;
      state.magentaOverlordDefeated = state.magentaBossesRemaining <= 0;
      if (state.boss === boss) {
        const nextBoss = state.midBosses.find(monster => monster !== boss && monster.requiredForGate && !monster.dead) || null;
        state.midBosses = state.midBosses.filter(monster => monster !== boss && monster !== nextBoss);
        state.boss = nextBoss;
      } else {
        state.midBosses = state.midBosses.filter(monster => monster !== boss);
      }
      refs.battleBossHud.hidden = !state.boss;
      boss.el.classList.add('destroyed');
      const center = pointOf(boss);
      if (!playDeathFx(boss, 'boss')) for (let index = 0; index < 12; index += 1) {
        schedule(() => createExplosion({ x: center.x + (Math.random() - .5) * .16, y: center.y + (Math.random() - .5) * .12 }, 'boss'), index * 75);
      }
      schedule(() => boss.el?.remove(), 1000);
      const defeatedName = boss.variant === 'toxic-beast' ? '독성마수' : boss.variant === 'flame-beast' ? '화염마수' : '붉은 대군주';
      const remainingBosses = state.magentaBossesRemaining;
      announce(remainingBosses > 0 ? `${defeatedName} 격파 · 남은 보스 ${remainingBosses}기` : `${defeatedName} 격파 · 남은 일반 몬스터를 섬멸하십시오`, 'friendly');
      updateHud(true);
      if (state.boss) updateBossHud();
      schedule(() => checkBossThreshold(), 1000);
      return;
    }
    state.status = 'resolving';
    cancelAnimationFrame(frameHandle);
    frameHandle = 0;
    refs.battleForfeit.disabled = true;
    refs.frigateSkill.disabled = true;
    boss.el.classList.add('destroyed');
    const center = pointOf(boss);
    if (!playDeathFx(boss, 'boss')) for (let index = 0; index < 12; index += 1) {
      schedule(() => createExplosion({ x: center.x + (Math.random() - .5) * .16, y: center.y + (Math.random() - .5) * .12 }, 'boss'), index * 75);
    }
    // 보스 사망 효과(전장 섬광·거대 화염)가 보이도록 결과 화면을 조금 늦게 띄웁니다.
    schedule(() => finishBattle(true), 1700);
  }

  function retreatAncientBeast(boss) {
    if (!state || !boss || boss.retreating) return;
    boss.retreating = true;
    boss.dead = true;
    if(isOortAncientBeastGate() || (isMagentaTasOperation() && Number(state.operation?.gate) === 5)){focusBattleAudio('boss');playBossRoarSound();}
    state.status = 'resolving';
    state.enemies.filter(enemy => enemy.monsterType === 'plasma-bug' && !enemy.dead).forEach(enemy => {
      enemy.dead = true;
      clearPlasmaBugFx(enemy);
      enemy.el?.classList.add('destroyed');
      schedule(() => enemy.el?.remove(), 420);
    });
    boss.el?.classList.add('ancient-beast-retreating');
    announce('고대 괴수 퇴각 · 작전 성공', 'friendly');
    schedule(() => {
      if (state?.boss === boss) state.boss = null;
      refs.battleBossHud.hidden = true;
      finishBattle(true, '고대 괴수가 깊은 군락지로 퇴각했습니다.');
    }, 1250);
  }

  function configureFrigateButton() {
    const frigate = state.frigate;
    if (!frigate) {
      refs.frigateShipName.textContent = '프리깃 미편성';
      refs.frigateSkillName.textContent = '프리깃 슬롯에서 편성';
      refs.frigateShipVisual.textContent = 'F';
      refs.frigateCooldown.textContent = '—';
      refs.frigateCooldown.hidden = false;
      refs.frigateSkill.disabled = true;
      refs.frigateSkill.classList.remove('ready', 'cooling-down');
      return;
    }
    const skill = frigateSkillFor(frigate);
    refs.frigateShipName.textContent = `프리깃 · ${frigate.name}`;
    refs.frigateSkillName.textContent = skill.name;
    refs.frigateShipVisual.innerHTML = frigateCodexMarkup(frigate);
    refs.frigateSkill.style.setProperty('--rarity-color', RARITY_COLORS[frigate.rarity] || RARITY_COLORS.R);
    updateFrigateButton();
  }

  // 리틀보이 최종기술 Fat Man: 충전 횟수와 1회 사용 뒤 짧은 대기시간
  const FAT_MAN = { charges: 2, gap: 3 };
  function updateFrigateButton() {
    if (!state?.frigate) return configureFrigateButton();
    const ready = state.status === 'combat' && state.frigateCooldown <= 0 && !state.paused;
    refs.frigateCooldown.textContent = state.frigateCooldown <= 0 ? 'READY' : String(Math.ceil(state.frigateCooldown));
    // Fat Man: 남은 출격 횟수 표시(대기 중이 끝나면 다시 2회)
    const fatMan = state.frigate.name === '리틀보이' && tacticalFrigateBonus(state.frigate).final;
    let charges = refs.frigateSkill.querySelector('.frigate-charges');
    if (fatMan) {
      if (!charges) { charges = document.createElement('span'); charges.className = 'frigate-charges'; refs.frigateSkill.append(charges); }
      const left = state.frigateCharges > 0 ? state.frigateCharges : (state.frigateCooldown <= 0 ? FAT_MAN.charges : 0);
      charges.textContent = `FAT MAN ×${left}`;
    } else charges?.remove();
    refs.frigateCooldown.hidden = ready;
    refs.frigateSkill.disabled = !ready;
    refs.frigateSkill.classList.toggle('ready', ready);
    refs.frigateSkill.classList.toggle('cooling-down', !ready);
  }

  function launchFrigateSkill() {
    if (!state?.frigate || state.status !== 'combat' || state.frigateCooldown > 0 || state.paused) return;
    const frigate = state.frigate;
    window.addMissionProgress?.('daily', 'sortie', 1);
    const previousDamageSource = activeDamageSource;
    activeDamageSource = frigate;
    try {
    const research=tacticalFrigateBonus(frigate);
    // 과학드론: 기본 1가지 무작위 전술. 보조기술 '전술 확장' 서로 다른 2가지 동시 시전·효과 +20%,
    // 최종기술 '최적화' 모든 전술(3가지) 동시 시전·효과 +20% 추가(합계 +40%).
    const scienceDrone = frigate.name === '과학 드론' || frigate.name === '과학드론';
    const sciencePicks = scienceDrone ? [...SCIENCE_DRONE_SKILLS].sort(() => Math.random() - .5).slice(0, research.final ? SCIENCE_DRONE_SKILLS.length : research.assist ? 2 : 1) : [];
    const scienceBoost = scienceDrone ? 1 + (research.assist ? .2 : 0) + (research.final ? .2 : 0) : 1;
    const baseSkill = scienceDrone ? sciencePicks[0] : frigateSkillFor(frigate);
    const skill={...baseSkill},timingScale=Math.max(.1,1-(Number(research.timeReduction)||0)),durationScale=1+(Number(research.durationBonus)||0);
    skill.timingScale=timingScale;
    ['delay','entry','exit'].forEach(key=>{if(Number.isFinite(Number(skill[key])))skill[key]=Math.max(1,Math.round(Number(skill[key])*timingScale));});
    if(Number.isFinite(Number(skill.duration)))skill.duration=Math.max(1,Math.round(Number(skill.duration)*durationScale));
    if(Number.isFinite(Number(skill.stun)))skill.stun=Math.max(1,Math.round(Number(skill.stun)*durationScale));
    if(skill.kind==='repair')skill.repairRatio*=research.power;
    if(skill.kind==='celestial-shield')skill.duration=tacticalShieldDuration(skill.duration*research.power);
    if(skill.kind==='celestial-shield'){if(research.assist)skill.duration=Math.round(skill.duration*1.3);if(research.final)skill.reflect=true;}
    if(skill.kind==='emp')skill.stun*=research.power;
    if(skill.kind==='radiation')skill.ratio*=research.power;
    if(skill.kind==='self-destruct'||skill.kind==='nuclear'||skill.kind==='shield')skill.amount*=research.power;
    if(skill.kind==='lepanto-strike'){skill.cannonDamage*=research.power;skill.missileDamage*=research.power;}
    // 레판토 보조기술 'Ship of the Line': 포격시간 50% 증가 / 최종기술 'Victory': 공격속도·공격력 30% 증가.
    if(skill.kind==='lepanto-strike'){
      if(research.assist)skill.duration=Math.round(skill.duration*1.5);
      if(research.final){skill.cannonDamage*=1.3;skill.missileDamage*=1.3;skill.cannonInterval=Math.round(skill.cannonInterval/1.3);skill.missileInterval=Math.round(skill.missileInterval/1.3);}
    }
    // 과학드론 전술 효과 강화(보조·최종)와 동시 시전할 추가 전술 준비
    const boostScienceSkill=s=>{if(s.kind==='emp')s.stun*=scienceBoost;if(s.kind==='radiation')s.ratio*=scienceBoost;if(s.kind==='shield')s.amount*=scienceBoost;return s;};
    if(scienceDrone)boostScienceSkill(skill);
    const extraScienceSkills=sciencePicks.slice(1).map(base=>{
      const s={...base,timingScale};
      if(Number.isFinite(Number(s.delay)))s.delay=Math.max(1,Math.round(Number(s.delay)*timingScale));
      if(Number.isFinite(Number(s.duration)))s.duration=Math.max(1,Math.round(Number(s.duration)*durationScale));
      if(Number.isFinite(Number(s.stun)))s.stun=Math.max(1,Math.round(Number(s.stun)*durationScale));
      if(s.kind==='emp')s.stun*=research.power;
      if(s.kind==='radiation')s.ratio*=research.power;
      if(s.kind==='shield')s.amount*=research.power;
      return boostScienceSkill(s);
    });
    // 수리 드론(건설드론) 보조기술 '회복': 수리 시 모든 상태이상 해제 + 3초 면역 / 최종기술 '수리기능 향상': 수리 회복량 2배.
    if(skill.kind==='repair'){skill.cleanseAll=!!research.assist;if(research.final)skill.repairRatio*=2;}
    // 포작선 보조기술 '추가폭발': 자폭 5회 / 최종기술 '죽음의 무도': 폭발하는 동안 모든 적을 포작선 쪽으로 끌어당김.
    if(skill.kind==='self-destruct'){if(research.assist)skill.explosions=5;skill.deathDance=!!research.final;}
    // 리틀보이 보조기술 '전술핵 강화'(보조 5/5): 핵폭발 피해 2배.
    if(skill.kind==='nuclear'&&research.assist)skill.amount*=2;
    // 리틀보이 최종기술 'Fat Man'(최종 5/5): 출격 2회 충전. 1회 사용 뒤 3초 대기 후 남은 1회는 원할 때 사용, 2회 모두 쓰면 재사용 대기 시작 → 끝나면 다시 2회.
    const fatMan=skill.kind==='nuclear'&&research.final;
    if(fatMan){
      if(!(state.frigateCharges>0))state.frigateCharges=FAT_MAN.charges;
      state.frigateCharges-=1;
      state.frigateCooldown=state.frigateCharges>0?FAT_MAN.gap:Math.max(0,30-research.cooldown);
    }else state.frigateCooldown = Math.max(0,30-research.cooldown);
    updateFrigateButton();
    const scienceNames = [skill, ...extraScienceSkills].map(entry => entry.name).join(' + ');
    if (scienceDrone) refs.frigateSkillName.textContent = scienceNames;
    if (skill.kind === 'repair') {
      announce(`${frigate.name} · ${skill.name}`, 'friendly');
      launchConstructionDroneRepair(skill);
      return;
    }
    if (skill.kind === 'self-destruct') {
      announce(`${frigate.name} · ${skill.name}`, 'friendly');
      launchPojakseonSelfDestruct(frigate, skill);
      return;
    }
    if (skill.kind === 'lepanto-strike') {
      announce(`${frigate.name} · ${skill.name}`, 'friendly');
      launchLepantoStrike(frigate, skill);
      return;
    }
    if (skill.kind === 'celestial-shield') {
      announce(`${frigate.name} · ${skill.name}${research.assist ? ' · 전장사수' : ''}${skill.reflect ? ' · 가시방패' : ''}`, 'friendly');
      launchCelestialShield(frigate, skill);
      return;
    }
    const flyby = document.createElement('div');
    flyby.className = 'frigate-flyby';
    flyby.style.setProperty('--rarity-color', RARITY_COLORS[frigate.rarity] || RARITY_COLORS.R);
    flyby.innerHTML = topViewMarkup(frigate);
    refs.effects.append(flyby);
    const activationDelay = skill.delay || Math.round(950*timingScale);
    if (skill.kind === 'nuclear') {
      armNuclearStrike(skill);
      const nukeName = fatMan && state.frigateCharges <= 0 ? 'Fat Man' : research.assist ? `${skill.name} · 전술핵 강화` : skill.name;
      announce(`${frigate.name} · ${nukeName} — 3초 후 폭발`, 'friendly');
    } else {
      announce(`${frigate.name} · ${scienceDrone && extraScienceSkills.length ? `${research.final ? '최적화' : '전술 확장'} · ${scienceNames}` : skill.name}`, 'friendly');
      schedule(() => { applyFrigateSkill(skill); extraScienceSkills.forEach(entry => applyFrigateSkill(entry)); }, activationDelay);
    }
    schedule(() => flyby.remove(), skill.kind === 'nuclear' ? activationDelay + Math.round(650*timingScale) : Math.round(2500*timingScale));
    } finally { activeDamageSource = previousDamageSource; }
  }

  function activeCelestialShieldTarget() {
    const guard = state?.celestialShield;
    const now = performance.now();
    if (!guard || guard.dead || now < guard.activeAt || now >= guard.expiresAt) return null;
    return guard;
  }

  function hostileAllyTargets() {
    const guard = activeCelestialShieldTarget();
    return guard ? [guard] : [...(state?.allies || []).filter(ally => !ally.dead), ...(state?.garudaWingmen || []).filter(ally => !ally.dead)];
  }

  function launchCelestialShield(frigate, skill) {
    const existing = state.celestialShield;
    existing?.el?.remove();
    const majorEnemy = (state.boss && !state.boss.dead ? state.boss : null)
      || state.midBosses?.find(monster => !monster.dead)
      || null;
    const enemies = livingEnemyTargets();
    const anchor = majorEnemy || (enemies.length ? {
      x: enemies.reduce((sum, enemy) => sum + enemy.x, 0) / enemies.length,
      y: enemies.reduce((sum, enemy) => sum + enemy.y, 0) / enemies.length
    } : { x: .5, y: .3 });
    const shieldPosition = {
      x: Math.max(.12, Math.min(.88, anchor.x)),
      y: Math.max(.2, Math.min(.72, anchor.y + (majorEnemy ? .14 : .1)))
    };
    const entryDuration = Math.round(2400*(skill.timingScale||1));
    const exitDuration = Math.round(2400*(skill.timingScale||1));
    const activeAt = performance.now() + entryDuration;
    const guard = {
      kind: 'celestial-shield',
      isCelestialShield: true,
      x: shieldPosition.x,
      y: shieldPosition.y,
      dead: false,
      activeAt,
      expiresAt: activeAt + skill.duration,
      reflect: Boolean(skill.reflect)
    };
    const ship = document.createElement('div');
    ship.className = 'fx-celestial-shield-ship';
    ship.style.transitionDuration = `${entryDuration}ms, ${entryDuration}ms, 200ms, ${entryDuration}ms`;
    ship.style.left = '112%';
    ship.style.top = '67%';
    ship.innerHTML = `${topViewMarkup(frigate)}<i class="fx-celestial-shield-oval${skill.reflect ? ' thorned' : ''}" aria-hidden="true"></i>`;
    guard.el = ship;
    state.celestialShield = guard;
    refs.effects.append(ship);
    requestAnimationFrame(() => {
      ship.classList.add('entered');
      ship.style.left = percent(guard.x);
      ship.style.top = percent(guard.y);
    });
    schedule(() => {
      if (state?.celestialShield !== guard) return;
      guard.dead = true;
      state.celestialShield = null;
      ship.querySelector('.fx-celestial-shield-oval')?.remove();
      ship.classList.add('leaving');
      ship.style.left = '-18%';
      ship.style.top = '52%';
      schedule(() => ship.remove(), exitDuration);
      announce(`${frigate.name} · 천상의 보호막 해제`, 'friendly');
    }, entryDuration + skill.duration);
  }

  function launchLepantoStrike(frigate, skill) {
    // Match the visible cannon burst (13px × 4.38) and missile explosion (112px).
    const splashRadius = { cannon: 28.5, missile: 56 };
    const hitWithSplash = (target, damage, kind) => {
      const impact = pointOf(target);
      const field = refs.field.getBoundingClientRect();
      const nearby = livingEnemyTargets().filter(candidate => candidate !== target && !candidate.dead &&
        Math.hypot((candidate.x - impact.x) * field.width, (candidate.y - impact.y) * field.height) <= splashRadius[kind]);
      shooterDamage(target, damage, null, kind);
      nearby.forEach(candidate => shooterDamage(candidate, Math.round(damage * .2), null, kind));
      createExplosion(impact, kind);
    };
    const formation = [
      { start: { x: .5, y: 1.16 }, end: { x: .3, y: .52 } },
      { start: { x: -.14, y: .58 }, end: { x: .5, y: .52 } },
      { start: { x: 1.14, y: .58 }, end: { x: .7, y: .52 } }
    ];
    const units = formation.map((slot, index) => {
      const ship = document.createElement('div');
      ship.className = 'fx-lepanto-strike-ship';
      ship.style.transitionDuration = `${skill.entry}ms, ${skill.entry}ms, 240ms, 340ms`;
      ship.style.left = percent(slot.start.x);
      ship.style.top = percent(slot.start.y);
      ship.innerHTML = topViewMarkup(frigate);
      refs.effects.append(ship);
      const unit = { el: ship, x: slot.end.x, y: slot.end.y, index };
      requestAnimationFrame(() => {
        ship.classList.add('entered');
        ship.style.left = percent(unit.x);
        ship.style.top = percent(unit.y);
      });
      return unit;
    });
    const fireCannon = unit => {
      const targets = livingEnemyTargets();
      const target = targets[Math.floor(Math.random() * targets.length)];
      if (!target || target.dead) return;
      const from = { x: unit.x, y: unit.y - .074 };
      drawIowaMuzzleFlash(from, 'lepanto-cannon', Math.PI / 2);
      schedule(() => {
        if (!target.dead) {
          hitWithSplash(target, skill.cannonDamage, 'cannon');
        }
      }, 240);
    };
    const fireMissile = unit => {
      const targets = livingEnemyTargets();
      const target = targets[Math.floor(Math.random() * targets.length)];
      if (!target || target.dead) return;
      const from = { x: unit.x + (unit.index === 1 ? 0 : unit.index === 0 ? -.026 : .026), y: unit.y - .035 };
      const missile = document.createElement('i');
      missile.className = 'fx-missile lepanto-missile';
      positionProjectile(missile, from, pointOf(target));
      missile.style.animationDuration = '.42s';
      refs.effects.append(missile);
      schedule(() => {
        missile.remove();
        if (!target.dead) {
          hitWithSplash(target, skill.missileDamage, 'missile');
        }
      }, 420);
    };
    schedule(() => {
      for (let elapsed = 0; elapsed < skill.duration; elapsed += skill.cannonInterval) {
        schedule(() => units.forEach(fireCannon), elapsed);
      }
      for (let elapsed = 0; elapsed < skill.duration; elapsed += skill.missileInterval) {
        schedule(() => units.forEach(fireMissile), elapsed);
      }
    }, skill.entry);
    schedule(() => {
      units.forEach(unit => {
        unit.el.classList.add('leaving');
        unit.el.style.left = percent(unit.x);
        unit.el.style.top = '116%';
      });
      schedule(() => units.forEach(unit => unit.el.remove()), skill.exit);
    }, skill.entry + skill.duration);
  }

  function applyFrigateSkill(skill) {
    if (!state || state.status !== 'combat') return;
    if (skill.kind === 'nuclear') {
      detonateNuclearStrike(skill.amount);
      return;
    }
    const wave = document.createElement('i');
    wave.className = `frigate-wave skill-${skill.kind}`;
    refs.effects.append(wave);
    schedule(() => wave.remove(), 1100);
    if (skill.kind === 'shield') {
      if (skill.target === 'single') {
        installScienceDroneShield(skill.amount);
        return;
      }
      state.allies.filter(ally => !ally.dead).forEach(ally => addShield(ally, skill.amount));
      return;
    }
    if (skill.kind === 'repair') {
      state.allies.filter(ally => !ally.dead).forEach(ally => {
        ally.hp = Math.min(ally.maxHp, ally.hp + skill.amount);
        ally.healthBar.style.width = `${ally.hp / ally.maxHp * 100}%`;
      });
      return;
    }
    if (skill.kind === 'emp') {
      livingEnemyTargets().forEach(target => applyScienceDroneEmp(target, skill.stun));
      return;
    }
    if (skill.kind === 'radiation') {
      applyScienceDroneRadiation(skill);
      return;
    }
    distributeMicroDamage(skill.amount, skill.kind === 'torpedo');
  }

  function installScienceDroneShield(amount) {
    const allies = state.allies.filter(ally => !ally.dead);
    if (!allies.length) return;
    const target = allies.reduce((weakest, ally) => ally.hp / Math.max(1, ally.maxHp) < weakest.hp / Math.max(1, weakest.maxHp) ? ally : weakest);
    target.shield = amount;
    target.maxShield = Math.max(Number(target.maxShield) || 0, amount);
    target.shieldEl?.remove();
    const shield = document.createElement('div');
    shield.className = 'ally-shield science-drone-shield';
    target.el.prepend(shield);
    target.shieldEl = shield;
    target.el.classList.add('science-drone-shielded');
    announce(`${target.ship.name} · 과학 방어막 ${formatNumber(amount)}`, 'friendly');
  }

  function applyScienceDroneEmp(target, duration) {
    if (!target || target.dead) return;
    const hasEnergy = Number(target.energy) > 0;
    const hasShield = Number(target.shield) > 0;
    target.energy = 0;
    target.shield = 0;
    if (target.shieldEl) {
      target.shieldEl.remove();
      target.shieldEl = null;
    }
    target.el?.classList.remove('science-drone-shielded');
    if (hasEnergy && hasShield) return;
    target.stun = Math.max(Number(target.stun) || 0, duration);
    target.el?.classList.add('stunned', 'science-drone-emp-stunned');
    schedule(() => {
      if (target.dead) return;
      target.el?.classList.remove('science-drone-emp-stunned');
      if (Number(target.stun) <= 0) target.el?.classList.remove('stunned');
    }, duration + 80);
  }

  function applyScienceDroneRadiation(skill) {
    const pool = livingEnemyTargets().slice();
    const sources = [];
    while (pool.length && sources.length < skill.targets) sources.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    sources.forEach(source => {
      if (!source?.el) return;
      source.el.classList.add('radiation-marked', 'science-radiation-marked');
      source.scienceRadiationUntil = Math.max(Number(source.scienceRadiationUntil) || 0, performance.now() + skill.duration);
      createScienceDroneRadiationVisual(source, skill.duration);
      createExplosion(pointOf(source), 'radiation');
      schedule(() => {
        if (performance.now() >= Number(source.scienceRadiationUntil) || source.dead) source.el?.classList.remove('science-radiation-marked', 'radiation-marked');
      }, skill.duration + 80);
      for (let elapsed = skill.tick; elapsed <= skill.duration; elapsed += skill.tick) {
        schedule(() => {
          if (!state || state.status !== 'combat' || source.dead) return;
          const origin = pointOf(source);
          const rect = refs.field?.getBoundingClientRect();
          const width = rect?.width || 480;
          const height = rect?.height || 720;
          livingEnemyTargets().forEach(target => {
            const distance = Math.hypot((target.x - origin.x) * width, (target.y - origin.y) * height);
            if (target !== source && distance > skill.radius) return;
            const ratio = target.kind === 'boss' ? .02 : skill.ratio;
            const damage = Math.ceil(Math.max(1, Number(target.maxHp) || Number(target.hp) || 1) * ratio);
            target.el?.classList.add('science-radiation-marked');
            target.scienceRadiationUntil = Math.max(Number(target.scienceRadiationUntil) || 0, performance.now() + skill.tick + 60);
            schedule(() => {
              if (performance.now() >= Number(target.scienceRadiationUntil) || target.dead) target.el?.classList.remove('science-radiation-marked');
            }, skill.tick + 100);
            shooterDamage(target, damage);
          });
          createExplosion(origin, 'radiation');
        }, elapsed);
      }
    });
  }

  function createScienceDroneRadiationVisual(target, duration) {
    if (!target?.el) return;
    target.radiationVisual?.remove();
    const cloud = document.createElement('i');
    cloud.className = 'fx-science-radiation-cloud';
    target.el.append(cloud);
    target.radiationVisual = cloud;
    schedule(() => {
      if (target.radiationVisual !== cloud) return;
      cloud.classList.add('dispersing');
      schedule(() => {
        if (target.radiationVisual === cloud) target.radiationVisual = null;
        cloud.remove();
      }, 440);
    }, duration);
  }

  function pojakseonDetonationPoint() {
    const targets = livingEnemyTargets();
    if (!targets.length) return { x: .5, y: .36 };
    const average = targets.reduce((sum, target) => ({ x: sum.x + target.x, y: sum.y + target.y }), { x: 0, y: 0 });
    return {
      x: Math.max(.14, Math.min(.86, average.x / targets.length)),
      y: Math.max(.16, Math.min(.62, average.y / targets.length))
    };
  }

  function pullEnemyTowardPoint(target, center, distance = 26) {
    if (!target || target.dead) return;
    const rect = refs.field?.getBoundingClientRect();
    const width = rect?.width || 480;
    const height = rect?.height || 720;
    const dx = (center.x - target.x) * width;
    const dy = (center.y - target.y) * height;
    const length = Math.hypot(dx, dy);
    if (length < 4) return;
    const pull = Math.min(distance, Math.max(0, length - 8));
    target.x = Math.max(.03, Math.min(.97, target.x + dx / length * pull / width));
    target.y = Math.max(.03, Math.min(1.05, target.y + dy / length * pull / height));
    if (target.el) {
      target.el.style.left = percent(target.x);
      target.el.style.top = percent(target.y);
      target.el.classList.add('pojakseon-pulled');
      schedule(() => target.el?.classList.remove('pojakseon-pulled'), 260);
    }
  }

  function launchPojakseonSelfDestruct(frigate, skill) {
    const point = pojakseonDetonationPoint();
    const runner = document.createElement('div');
    runner.className = 'fx-pojakseon-run';
    runner.style.transitionDuration = `${skill.entry}ms, ${skill.entry}ms, 200ms, 200ms`;
    runner.style.setProperty('--rarity-color', RARITY_COLORS[frigate.rarity] || RARITY_COLORS.R);
    // 리틀보이와 같은 우측 출격 지점에서 진입한다.
    runner.style.left = 'calc(100% + 110px)';
    runner.style.top = '63%';
    runner.innerHTML = topViewMarkup(frigate);
    const rect = refs.field?.getBoundingClientRect();
    const start = { x: 1.12, y: .63 };
    const travelAngle = Math.atan2((point.y - start.y) * (rect?.height || 720), (point.x - start.x) * (rect?.width || 480)) + Math.PI / 2;
    runner.style.setProperty('--pojakseon-angle', `${travelAngle}rad`);
    refs.effects.append(runner);
    requestAnimationFrame(() => {
      runner.classList.add('entered');
      runner.style.left = percent(point.x);
      runner.style.top = percent(point.y);
    });
    const detonate = index => schedule(() => {
      // 마지막 폭발에서는 전투 상태와 관계없이 포작선을 반드시 지운다.
      const last = index === skill.explosions - 1;
      if (!state || state.status !== 'combat') { if (last) runner.remove(); return; }
      createExplosion(point, 'pojakseon');
      playPojakseonExplosionSound();
      livingEnemyTargets().forEach(target => {
        shooterDamage(target, skill.amount);
        pullEnemyTowardPoint(target, point);
      });
      runner.classList.add('detonating');
      announce(`포작선 폭발 ${index + 1}/${skill.explosions}`, 'friendly');
      if (last) runner.remove();
    }, skill.entry + index * skill.interval);
    for (let index = 0; index < skill.explosions; index += 1) detonate(index);
    // 예비: 전투가 일시 정지되어 예약된 폭발이 실행되지 않아도 시간이 지나면 포작선을 지운다.
    setTimeout(() => runner.remove(), skill.entry + skill.explosions * skill.interval + 1000);
    // 최종기술 '죽음의 무도': 첫 폭발부터 마지막 폭발까지 모든 적을 포작선(폭발 지점) 쪽으로 계속 끌어당긴다.
    if (skill.deathDance) {
      const start = skill.entry, end = skill.entry + (skill.explosions - 1) * skill.interval + 300;
      schedule(() => {
        if (!state || state.status !== 'combat') return;
        const vortex = document.createElement('i');
        vortex.className = 'fx-pojakseon-vortex';
        vortex.style.left = percent(point.x);
        vortex.style.top = percent(point.y);
        refs.effects.append(vortex);
        schedule(() => vortex.remove(), end - start);
        announce('포작선 · 죽음의 무도', 'friendly');
      }, start);
      for (let time = start; time <= end; time += POJAKSEON_DEATH_DANCE.tick) {
        schedule(() => {
          if (!state || state.status !== 'combat') return;
          livingEnemyTargets().forEach(target => pullEnemyTowardPoint(target, point, POJAKSEON_DEATH_DANCE.pull));
        }, time);
      }
    }
  }
  const POJAKSEON_DEATH_DANCE = { tick: 100, pull: 9 };

  function setConstructionDroneFacing(drone, from, to) {
    const rect = refs.field?.getBoundingClientRect();
    const dx = (to.x - from.x) * (rect?.width || 480);
    const dy = (to.y - from.y) * (rect?.height || 720);
    drone.style.setProperty('--construction-drone-angle', `${Math.atan2(dy, dx) + Math.PI / 2}rad`);
  }

  function createConstructionRepairPulse(target, index) {
    if (!target || target.dead) return;
    const pulse = document.createElement('i');
    pulse.className = 'fx-construction-repair-pulse';
    const repairPoint = constructionDroneRepairPoint(target, index);
    pulse.style.left = percent(repairPoint.x + (index - 1) * .012);
    pulse.style.top = percent(repairPoint.y - .016 - index * .01);
    refs.effects.append(pulse);
    schedule(() => pulse.remove(), 720);
  }

  function constructionDroneRepairPoint(target, index = 0) {
    const side = target.x < .5 ? 1 : -1;
    const vertical = index % 2 ? .038 : -.038;
    return {
      x: Math.max(.06, Math.min(.94, target.x + side * .075)),
      y: Math.max(.1, Math.min(.9, target.y + vertical))
    };
  }

  const REPAIR_DRONE_IMMUNITY = 3000;
  function launchConstructionDroneRepair(skill) {
    if (!state || state.status !== 'combat') return;
    const timingScale=Math.max(.1,Number(skill.timingScale)||1),travelDuration=Math.round(CONSTRUCTION_DRONE_REPAIR.travel*timingScale),exitDuration=Math.round(CONSTRUCTION_DRONE_REPAIR.exit*timingScale),repairDuration=CONSTRUCTION_DRONE_REPAIR.repair;
    // 보조기술 '회복'이 있으면 내구도가 가득 차도 상태이상이 걸린 함선을 찾아간다.
    const targets = state.allies
      .filter(ally => !ally.dead && (ally.hp < ally.maxHp || (skill.cleanseAll && allyHasStatus(ally))))
      .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp);
    const drone = document.createElement('i');
    const entryPoint = { x: .5, y: 1.14 };
    drone.className = 'fx-construction-drone';
    drone.style.transitionDuration = `${travelDuration}ms, ${travelDuration}ms, 250ms, 220ms`;
    drone.style.left = percent(entryPoint.x);
    drone.style.top = percent(entryPoint.y);
    const firstTargetPoint = targets.length ? constructionDroneRepairPoint(targets[0]) : entryPoint;
    setConstructionDroneFacing(drone, entryPoint, firstTargetPoint);
    refs.effects.append(drone);
    requestAnimationFrame(() => {
      drone.classList.add('entered');
      drone.style.left = percent(firstTargetPoint.x);
      drone.style.top = percent(firstTargetPoint.y);
    });

    let lastPoint = entryPoint;
    let timeline = 0;
    targets.forEach(target => {
      const fromPoint = lastPoint;
      const taskStart = timeline;
      schedule(() => {
        if (target.dead) return;
        const repairPoint = constructionDroneRepairPoint(target, targets.indexOf(target));
        setConstructionDroneFacing(drone, fromPoint, repairPoint);
        drone.style.left = percent(repairPoint.x);
        drone.style.top = percent(repairPoint.y);
      }, taskStart);
      schedule(() => {
        if (target.dead) return;
        drone.classList.add('repairing');
        if (skill.cleanseAll) {
          // 보조기술 '회복': 모든 상태이상 해제 + 3초간 상태이상 면역
          cleanseAllAllyStatuses(target);
          target.repairDroneImmuneUntil = performance.now() + REPAIR_DRONE_IMMUNITY;
          target.el?.classList.add('repair-drone-immune');
          schedule(() => { if (performance.now() >= Number(target.repairDroneImmuneUntil || 0)) target.el?.classList.remove('repair-drone-immune'); }, REPAIR_DRONE_IMMUNITY + 40);
        } else cleanseOneAllyStatus(target);
        for (let pulse = 0; pulse < CONSTRUCTION_DRONE_REPAIR.pulses; pulse += 1) {
          schedule(() => {
            if (target.dead) return;
            repairAlly(target, target.maxHp * (skill.repairRatio || 0) / CONSTRUCTION_DRONE_REPAIR.pulses);
            createConstructionRepairPulse(target, pulse);
          }, pulse * (repairDuration / CONSTRUCTION_DRONE_REPAIR.pulses));
        }
      }, taskStart + travelDuration);
      schedule(() => drone.classList.remove('repairing'), taskStart + travelDuration + repairDuration);
      lastPoint = constructionDroneRepairPoint(target, targets.indexOf(target));
      timeline += travelDuration + repairDuration;
    });

    const exitPoint = { x: .5, y: 1.14 };
    schedule(() => {
      drone.classList.remove('repairing');
      setConstructionDroneFacing(drone, lastPoint, exitPoint);
      drone.style.left = percent(exitPoint.x);
      drone.style.top = percent(exitPoint.y);
    }, timeline);
    schedule(() => drone.classList.add('exiting'), timeline + exitDuration - Math.round(220*timingScale));
    schedule(() => drone.remove(), timeline + exitDuration + Math.round(60*timingScale));
  }

  // 리틀보이 핵폭탄: ① 투하(폭탄이 작아지며 낙하, 조준 원이 좁혀지고 마지막 1초 경고) → ② 섬광·실루엣 → ③ 화구
  // → ④ 충격파(닿는 순서대로 피해·튕겨남, 강한 흔들림) → ⑤ 연기 소용돌이·불씨·주황 여운
  const NUCLEAR_STRIKE = { point: { x: .5, y: .29 }, radius: .39, shockTravel: 700, push: 18 };

  function armNuclearStrike(skill) {
    if (!refs.effects) return;
    const point = NUCLEAR_STRIKE.point;
    const delay = skill.delay || 3000;
    const marker = document.createElement('i');
    marker.className = 'nuclear-target-marker';
    marker.style.left = percent(point.x);
    marker.style.top = percent(point.y);
    refs.effects.append(marker);
    // 리틀보이가 화면 위쪽 가운데를 지날 때 폭탄을 떨어뜨린다.
    const release = Math.min(Math.round(1000 * (skill.timingScale || 1)), Math.max(0, delay - 900));
    schedule(() => {
      if (!state || state.status !== 'combat') return;
      const bomb = document.createElement('i');
      bomb.className = 'nuclear-bomb';
      bomb.style.left = percent(point.x + .03);
      bomb.style.top = percent(point.y - .07);
      bomb.style.setProperty('--nuke-fall', `${delay - release}ms`);
      refs.effects.append(bomb);
      turtleAnimate(bomb, [
        { left: percent(point.x + .03), top: percent(point.y - .07), transform: 'translate(-50%,-50%) rotate(20deg) scale(1)' },
        { left: percent(point.x), top: percent(point.y), transform: 'translate(-50%,-50%) rotate(0deg) scale(.22)' }
      ], delay - release, { easing: 'cubic-bezier(.45,0,.9,.6)' });
    }, release);
    schedule(() => marker.classList.add('final'), Math.max(0, delay - 1000));
    schedule(() => {
      marker.remove();
      applyFrigateSkill(skill);
    }, delay);
  }

  function detonateNuclearStrike(amount) {
    if (!state || state.status !== 'combat') return;
    const point = NUCLEAR_STRIKE.point;
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480, height = field?.height || 720;
    playNuclearExplosionSound();
    // ② 섬광: 화면 전체가 하얗게 타오르고 함선·적이 잠깐 검은 실루엣이 된다.
    const flash = document.createElement('i');
    flash.className = 'nuclear-flash';
    flash.style.setProperty('--nuke-x', percent(point.x));
    flash.style.setProperty('--nuke-y', percent(point.y));
    (refs.viewport || refs.effects).append(flash);
    turtleAnimate(flash, [{ opacity: 1 }, { opacity: 1, offset: .25 }, { opacity: 0 }], 650);
    refs.viewport?.classList.add('nuclear-silhouette');
    schedule(() => refs.viewport?.classList.remove('nuclear-silhouette'), 170);
    // ③ 화구: 흰색 → 노랑 → 주황으로 식어 가는 거대한 불덩이
    const fireball = document.createElement('i');
    fireball.className = 'nuclear-fireball';
    fireball.style.left = percent(point.x);
    fireball.style.top = percent(point.y);
    refs.effects.append(fireball);
    turtleAnimate(fireball, [
      { transform: 'translate(-50%,-50%) scale(.08)', opacity: 1, filter: 'brightness(2.2) saturate(.2)' },
      { transform: 'translate(-50%,-50%) scale(.85)', opacity: 1, filter: 'brightness(1.4) saturate(.8)', offset: .3 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: .85, filter: 'brightness(1) saturate(1.2) hue-rotate(-12deg)', offset: .6 },
      { transform: 'translate(-50%,-50%) scale(1.08)', opacity: 0, filter: 'brightness(.7) saturate(1.3) hue-rotate(-20deg)' }
    ], 1500, { easing: 'cubic-bezier(.15,.8,.3,1)' });
    // ④ 충격파: 기존 불꽃 고리 그림 + 얇고 밝은 고리가 반경 끝까지 퍼진다.
    const reach = NUCLEAR_STRIKE.radius * Math.max(width, height);
    const ring = document.createElement('i');
    ring.className = 'nuclear-explosion';
    ring.style.left = percent(point.x);
    ring.style.top = percent(point.y);
    ring.style.width = `${reach * 2}px`;
    ring.style.height = `${reach * 2 * .6}px`;
    ring.style.margin = `${-reach * .6}px 0 0 ${-reach}px`;
    refs.effects.append(ring);
    schedule(() => ring.remove(), 1450);
    const shock = document.createElement('i');
    shock.className = 'nuclear-shockwave';
    shock.style.left = percent(point.x);
    shock.style.top = percent(point.y);
    shock.style.width = shock.style.height = `${reach * 2}px`;
    refs.effects.append(shock);
    turtleAnimate(shock, [
      { transform: 'translate(-50%,-50%) scale(.05)', opacity: 1 },
      { opacity: 1, offset: .75 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }
    ], NUCLEAR_STRIKE.shockTravel, { delay: 60, easing: 'cubic-bezier(.2,.65,.35,1)' });
    nuclearShake();
    // 피해: 반경(.39) 안의 적이 충격파가 닿는 순서대로 맞고 바깥으로 튕겨 난다.
    livingEnemyTargets().forEach(target => {
      const dx = target.x - point.x, dy = target.y - point.y;
      if (Math.hypot(dx, dy) > NUCLEAR_STRIKE.radius) return;
      const px = dx * width, py = dy * height;
      const distance = Math.hypot(px, py) || 1;
      schedule(() => {
        if (!state || state.status !== 'combat' || target.dead) return;
        shooterDamage(target, amount);
        if (!target.dead) turtleShockHit(target, { x: px / distance, y: py / distance }, NUCLEAR_STRIKE.push, '#ffb347');
      }, 60 + Math.min(1, distance / reach) * NUCLEAR_STRIKE.shockTravel * .8);
    });
    // ⑤ 잔해: 연기 소용돌이, 떠다니는 불씨, 화면 전체 주황 여운
    schedule(() => {
      if (!refs.effects) return;
      const smoke = document.createElement('i');
      smoke.className = 'nuclear-smoke';
      smoke.style.left = percent(point.x);
      smoke.style.top = percent(point.y);
      smoke.style.width = smoke.style.height = `${reach * 1.3}px`;
      refs.effects.append(smoke);
      turtleAnimate(smoke, [
        { transform: 'translate(-50%,-50%) rotate(0deg) scale(.4)', opacity: 0 },
        { opacity: .9, offset: .2 },
        { transform: 'translate(-50%,-50%) rotate(70deg) scale(1.15)', opacity: 0 }
      ], 2600, { easing: 'ease-out' });
      for (let index = 0; index < 18; index += 1) {
        const ember = document.createElement('i');
        ember.className = 'nuclear-ember';
        ember.style.left = percent(point.x);
        ember.style.top = percent(point.y);
        refs.effects.append(ember);
        const angle = index / 18 * Math.PI * 2 + Math.random() * .3;
        const far = reach * (.25 + Math.random() * .55);
        turtleAnimate(ember, [
          { transform: 'translate(-50%,-50%)', opacity: 0 },
          { opacity: 1, offset: .15 },
          { transform: `translate(calc(-50% + ${(Math.cos(angle) * far).toFixed(0)}px), calc(-50% + ${(Math.sin(angle) * far - 20).toFixed(0)}px))`, opacity: 0 }
        ], 1800 + Math.random() * 900, { easing: 'cubic-bezier(.1,.7,.3,1)' });
      }
    }, 250);
    const afterglow = document.createElement('i');
    afterglow.className = 'nuclear-afterglow';
    (refs.viewport || refs.effects).append(afterglow);
    turtleAnimate(afterglow, [{ opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: 0 }], 2600);
  }

  function nuclearShake() {
    if (!refs.viewport || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    refs.viewport.classList.remove('nuclear-shake');
    void refs.viewport.offsetWidth;
    refs.viewport.classList.add('nuclear-shake');
    setTimeout(() => refs.viewport?.classList.remove('nuclear-shake'), 700 / battleSpeed);
  }

  function distributeMicroDamage(totalPackets, bossFocused = false) {
    const targets = livingEnemyTargets();
    if (!targets.length) return;
    const allocations = new Map();
    for (let index = 0; index < totalPackets; index += 1) {
      let target;
      if (state.boss && !state.boss.dead && !state.boss.machineAirborne && (bossFocused || Math.random() < .72)) target = state.boss;
      else target = targets[Math.floor(Math.random() * targets.length)];
      if (!target || target.dead) continue;
      allocations.set(target, (allocations.get(target) || 0) + 1);
    }
    allocations.forEach((packets, target) => shooterDamage(target, packets));
  }

  function addShield(ally, amount) {
    ally.maxShield = Math.max(ally.maxShield, amount);
    ally.shield = Math.min(ally.maxShield + amount, ally.shield + amount);
    clearFireDust(ally);
    if (!ally.shieldEl || !ally.shieldEl.isConnected) {
      ally.shieldEl = document.createElement('div');
      ally.shieldEl.className = 'ally-shield reinforced';
      ally.el.prepend(ally.shieldEl);
    }
  }

  function finishBattle(victory, reason = '') {
    if (!state || state.status === 'ended') return;
    if (victory && !state.arenaMatch && !state.bounty) {
      // 다함급 전술: 중전함·전투순양함·구축함·프리깃을 모두 출격시킨 전투를 완료하면 +1
      const types = new Set((state.allies || []).map(ally => ally.ship?.type).filter(Boolean));
      if (state.frigate) types.add('frigate');
      if (['dreadnought', 'battlecruiser', 'destroyer', 'frigate'].every(type => types.has(type))) window.addMissionProgress?.('weekly', 'fleet-8', 1);
    }
    if (state.arenaMatch) {
      if (!victory) playBattleLoseSound();
      if (state.arenaLive) { state.arenaMatch.result.win = victory; state.arenaMatch.result.time = state.elapsed; }
      finishArenaBattle(Boolean(reason));
      return;
    }
    state.status = 'ended';
    if (!victory) playBattleLoseSound();
    state.colossusShieldThrows?.forEach(throwing => throwing.el.remove());
    state.colossusShieldThrows = [];
    state.pegasusLances?.forEach(lance => lance.el.remove());
    state.pegasusLances = [];
    state.angelaSwords?.forEach(sword => sword.el.remove());
    state.angelaSwords = [];
    state.paused = false;
    updateHud(true);
    cancelAnimationFrame(frameHandle);
    frameHandle = 0;
    refs.forfeitConfirm.hidden = true;
    refs.battleForfeit.disabled = true;
    refs.frigateSkill.disabled = true;
    refs.frigateSkill.classList.remove('ready');

    refs.battleResult.hidden = false;
    refs.battleSkip.hidden = true;
    syncBattleSpeed();
    refs.battleResult.classList.toggle('victory', victory);
    refs.battleResult.classList.toggle('defeat', !victory);
    refs.battleResultKicker.textContent = victory ? 'OPERATION COMPLETE' : 'OPERATION FAILED';
    refs.battleResultTitle.textContent = victory ? '승리' : '패배';
    refs.battleResultActions.replaceChildren();

    if (state.bounty) { renderBountyResult(victory, reason); return; }
    if (victory) {
      const stars = battleStars();
      const firstClear = window.isBattleGateFirstClear?.() ?? true;
      const rewards = calculateRewards(stars, firstClear);
      refs.battleResultStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      refs.battleResultCopy.textContent = firstClear
        ? '적 지휘 개체를 격파하고 작전 구역을 확보했습니다.'
        : '재전투 완료 · 관문 클리어 보상은 최초 1회만 지급됩니다.';
      refs.battleRewards.innerHTML = `<span>골드 <b>${formatNumber(rewards.gold)}</b></span><span>토륨 <b>${formatNumber(rewards.thorium)}</b></span>`;
      if (!state.resultCommitted) {
        state.resultCommitted = true;
        grantRewards(rewards);
        window.completeBattleOperation?.({ victory: true, stars, ...rewards });
      }
      addResultButton('다음 관문', () => window.advanceBattleStage?.());
      addResultButton('돌아가기', () => window.returnToBattleMap?.());
    } else {
      refs.battleResultStars.textContent = '☆☆☆';
      refs.battleResultCopy.textContent = reason || '보스 격파 전에 아군 전력이 모두 이탈했습니다.';
      refs.battleRewards.innerHTML = '<span>획득 보상 <b>없음</b></span>';
      addResultButton('재도전', () => window.retryCurrentBattle?.());
      addResultButton('함교로 복귀', () => window.show?.('home'));
    }
  }

  // ── 현상수배 보스: 우주해적 검은수염 (일반 적 없이 보스 한 척, 제한시간 안에 격파) ──
    function spawnBlackbeard() {
    if (!state?.bounty || state.boss || state.status !== 'combat') return;
    const bounty = state.bounty;
    const boss = {
      id: 'boss',
      kind: 'boss',
      variant: 'blackbeard',
      name: bounty.name,
      hp: bounty.hp,
      maxHp: bounty.hp,
      x: .5,
      y: -.23,
      entryStartY: -.23,
      entryTargetY: bounty.pirate === 'red' ? .27 : .17,
      entryDuration: 1150,
      entryTime: 1150,
      dead: false,
      stun: 0,
      speed: ENEMY_PROFILES.gasimon.speed * 2,
      attackPower: bounty.damage,
      nextAttack: 2200,
      nextBroadside: 6000,
      lifetime: 0,
      berserk: false,
      requiredForGate: false
    };
    const element = document.createElement('div');
    element.className = `boss-unit boss-blackbeard${bounty.pirate === 'red' ? ' boss-redbeard' : ''}`;
    element.innerHTML = `<img class="boss-sprite" src="${bounty.image || 'blackbeard.webp'}" alt="${bounty.name}" onerror="this.onerror=null;this.src='blackbeard.webp'" />`;
    boss.el = element;
    state.boss = boss;
    refs.enemyLayer.append(element);
    refs.battleBossHud.hidden = false;
    updateHud(true);
    updateBossHud();
    requestAnimationFrame(() => element.classList.add('entered'));
    window.setBattleBossMusic?.(true);
    focusBattleAudio('boss');
    announce(`${bounty.name} 출현`, 'boss');
    showBossWarning(refs.battleAnnouncement?.textContent || '');
  }

  // 검은수염은 공격 능력이 없다. 3단계부터 내구 50% 이하에서 회피 기동(회피율 10%)을 가동한다.
  const BLACKBEARD_EVASION = { fromStage: 3, hpRatio: .5, chance: .1 };
  // 붉은수염: 내구가 정해진 비율 아래로 떨어질 때마다 플레이어 함대 쪽으로 2초간 돌진해 모든 함선에 피해를 주고,
  // 2초간 후진해 제자리로 돌아간다. 1단계는 한 번 다가온 뒤 물러나지 않고 2초마다 계속 공격한다.
  const REDBEARD = {
    1: { thresholds: [.5], damage: 100, stay: true },
    2: { thresholds: [.7, .3], damage: 1000 },
    3: { thresholds: [.8, .6, .4, .2], damage: 2000 },
    4: { thresholds: [.9, .8, .7, .6, .5, .4, .3, .2, .1], damage: 3000 }
  };
  const REDBEARD_MOVE = 2000, REDBEARD_CHARGE_Y = .56;

  const REDBEARD_TAUNTS = ['감히 발바롯사를 건드리다니', '함선을 갈가리 찢어주마!', '도망치지 마라!'];
  // 칼날을 휘두른 붉은 궤적, 맞은 함선의 흔들림, 말풍선
  function redbeardStrikeFx(boss) {
    const origin = pointOf(boss);
    const arc = document.createElement('i');
    arc.className = 'fx-redbeard-arc';
    arc.style.left = percent(origin.x);
    arc.style.top = percent(origin.y + .1);
    refs.effects.append(arc);
    schedule(() => arc.remove(), 520);
    state.allies.filter(ally => !ally.dead).forEach(ally => {
      const point = pointOf(ally);
      const slash = document.createElement('i');
      slash.className = 'fx-redbeard-slash';
      slash.style.left = percent(point.x);
      slash.style.top = percent(point.y);
      refs.effects.append(slash);
      schedule(() => slash.remove(), 480);
      ally.el?.classList.remove('redbeard-hit');
      void ally.el?.offsetWidth;
      ally.el?.classList.add('redbeard-hit');
      schedule(() => ally.el?.classList.remove('redbeard-hit'), 520);
    });
    const bubble = document.createElement('div');
    bubble.className = 'redbeard-speech';
    bubble.textContent = REDBEARD_TAUNTS[Math.floor(Math.random() * REDBEARD_TAUNTS.length)];
    bubble.style.left = percent(Math.min(.78, Math.max(.22, origin.x)));
    bubble.style.top = percent(Math.max(.08, origin.y - .2));
    refs.effects.append(bubble);
    schedule(() => bubble.remove(), 1700);
  }

  function redbeardStrike(boss, spec) {
    state.allies.filter(ally => !ally.dead).forEach(ally => dealAllyDamage(ally, spec.damage, boss));
    shakeBattlefield();
    redbeardStrikeFx(boss);
    boss.el?.classList.add('redbeard-strike');
    schedule(() => boss.el?.classList.remove('redbeard-strike'), 260);
  }

  function updateBlackbeardAttack(boss, dt) {
    boss.lifetime += dt;
    if (state.bounty?.pirate !== 'red') return;
    const spec = REDBEARD[state.bounty.stage];
    if (!spec) return;
    if (boss.entryTime > 0) { boss.el.style.top = percent(boss.y); return; }
    boss.homeY ??= boss.entryTargetY;
    boss.meleeIndex ??= 0;
    boss.meleePending ??= 0;
    const ratio = boss.hp / Math.max(1, boss.maxHp);
    while (boss.meleeIndex < spec.thresholds.length && ratio <= spec.thresholds[boss.meleeIndex]) { boss.meleeIndex += 1; boss.meleePending += 1; }
    if (!boss.melee && boss.meleePending > 0) {
      boss.meleePending -= 1;
      boss.melee = { phase: 'advance', t: 0 };
      announce('붉은수염 · 돌격', 'boss');
    }
    const melee = boss.melee;
    if (melee) {
      melee.t += dt;
      const ease = value => 1 - Math.pow(1 - Math.min(1, value), 2);
      if (melee.phase === 'advance') {
        boss.y = boss.homeY + (REDBEARD_CHARGE_Y - boss.homeY) * ease(melee.t / REDBEARD_MOVE);
        if (melee.t >= REDBEARD_MOVE) {
          redbeardStrike(boss, spec);
          melee.phase = spec.stay ? 'hold' : 'retreat';
          melee.t = 0;
        }
      } else if (melee.phase === 'hold') {
        boss.y = REDBEARD_CHARGE_Y;
        if (melee.t >= 2000) { melee.t -= 2000; redbeardStrike(boss, spec); }
      } else {
        boss.y = REDBEARD_CHARGE_Y + (boss.homeY - REDBEARD_CHARGE_Y) * ease(melee.t / REDBEARD_MOVE);
        if (melee.t >= REDBEARD_MOVE) { boss.y = boss.homeY; boss.melee = null; }
      }
    }
    boss.el.style.top = percent(boss.y);
  }

  function renderBountyResult(victory, reason) {
    const bounty = state.bounty;
    const outcome = window.UnionCommand?.bountyFinish?.(bounty.pirate, bounty.stage, victory) || { reward: 0, next: false };
    refs.battleResultKicker.textContent = victory ? 'BOUNTY COMPLETE' : 'BOUNTY FAILED';
    refs.battleResultTitle.textContent = victory ? '현상수배 완료' : '임무 실패';
    refs.battleResultStars.textContent = victory ? 'WANTED' : '☆☆☆';
    if (victory) {
      refs.battleResultCopy.textContent = `${bounty.name} 격파 · ${state.elapsed.toFixed(1)}초`;
      if (outcome.reward > 0) {
        grantRewards({ gold: outcome.gold || 0, thorium: outcome.reward });
        refs.battleRewards.innerHTML = `<span>토륨 <b>${formatNumber(outcome.reward)}</b></span>${outcome.gold ? `<span>골드 <b>${formatNumber(outcome.gold)}</b></span>` : ''}`;
      } else {
        refs.battleRewards.innerHTML = '<span>보상 <b>오늘 이미 수령</b></span>';
      }
    } else {
      refs.battleResultCopy.textContent = reason || '검은수염을 격파하지 못했습니다.';
      refs.battleRewards.innerHTML = '<span>획득 보상 <b>없음</b></span>';
      addResultButton('재도전', () => window.UnionCommand?.bountyStart?.(bounty.pirate, bounty.stage));
    }
    addResultButton('현상수배로 돌아가기', () => window.UnionCommand?.bountyReturn?.());
  }

  function battleStars() {
    const living = state.allies.filter(ally => !ally.dead).length;
    return living >= 3 ? 3 : living === 2 ? 2 : 1;
  }

  function calculateRewards(stars, firstClear = true) {
    if (!firstClear) return { gold: 0, thorium: 0 };
    const gate = state.operation.gate;
    const chapter = Math.max(1, Number(state.operation.chapter) || 1);
    const regionOrder = {
      1: ['mars', 'titan', 'oort'],
      2: ['magenta-near', 'magenta-tas', 'magenta-atmosphere'],
      3: ['kepler-orbit', 'kepler-atmosphere', 'kepler-base']
    }[chapter] || [];
    const regionIndex = Math.max(0, regionOrder.indexOf(state.operation.region));
    const isEarlyMarsGate = chapter === 1 && state.operation.region === 'mars' && gate >= 1 && gate <= 10;
    const progressionGold = isEarlyMarsGate ? 0 : 100 + (chapter - 1) * 120 + regionIndex * 60 + Math.floor((gate - 1) / 5) * 60;
    const varianceGold = isEarlyMarsGate ? 0 : ((gate + regionIndex + chapter) % 5) * 20;
    const fullGold = 360 + gate * 40 + progressionGold + varianceGold;
    let fullThorium = 0;
    if (state.operation.chapter === 1 && state.operation.region === 'mars' && gate >= 1 && gate <= 10) {
      fullThorium = 100;
    } else {
      fullThorium = gate % 10 === 0 ? 100 : gate % 5 === 0 ? 50 : 0;
    }
    const multiplier = stars === 3 ? 1 : stars === 2 ? .5 : .2;
    return { gold: Math.round(fullGold * multiplier), thorium: Math.round(fullThorium * multiplier) };
  }

  function grantRewards(rewards) {
    const balances = window.gameResources || (window.gameResources = { gold: 0, thorium: 0 });
    balances.gold += rewards.gold;
    balances.thorium += rewards.thorium;
    try { localStorage.setItem('starfleet-game-resources-v1', JSON.stringify(balances)); } catch {}
    window.updateGameResourceHud?.();
  }

  function addResultButton(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    const variant = label === '다음 관문' ? 'gold' : label === '함교로 복귀' ? 'red' : 'cyan';
    const palette = {
      cyan: { border: '#71e9ff', background: 'linear-gradient(135deg,#155d78,#092332)', color: '#e8fcff', glow: '#2ccfff' },
      gold: { border: '#ffd35c', background: 'linear-gradient(135deg,#735113,#2e210b)', color: '#fff4b5', glow: '#ffb72c' },
      red: { border: '#ff647b', background: 'linear-gradient(135deg,#64182a,#2e0b16)', color: '#ffe6eb', glow: '#ff3752' }
    }[variant];
    const styles = {
      height: '52px', border: `1px solid ${palette.border}`, borderRadius: '5px 12px 5px 12px',
      background: palette.background, color: palette.color, fontSize: '14px', fontWeight: '1000',
      letterSpacing: '.08em', textShadow: `0 0 7px ${palette.glow}`, boxShadow: `inset 0 0 16px ${palette.glow}36,0 0 14px ${palette.glow}42`
    };
    Object.entries(styles).forEach(([property, value]) => button.style.setProperty(property.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`), value, 'important'));
    button.addEventListener('click', () => {
      refs.battleResult.hidden = true;
      handler();
    });
    refs.battleResultActions.append(button);
  }

  // 시나리오 연출 중 전투를 멈추거나 재개한다(재개 시 시간 점프를 막기 위해 프레임 시계를 맞춘다).
  // 연합 파견 장면 등에서 전투용 탑뷰 그림 주소가 필요할 때 쓴다(탑뷰 그림이 없는 함선은 null).
  window.getShipTopviewImage = ship => {
    try {
      const match = String(topViewMarkup(ship) || '').match(/<img[^>]+src="([^"]+)"/);
      return match ? match[1] : null;
    } catch { return null; }
  };
  window.setBattleHold = hold => {
    if (!state || state.status !== 'combat') return;
    state.paused = !!hold;
    if (!hold) {
      state.lastFrame = performance.now();
      // 일반 적을 모두 처리한 뒤 연출로 멈춘 경우, 재개 직후 다음 단계(보스·외계 함대 등장)를 바로 확인한다.
      // 처치 이벤트가 없으면 이 확인이 실행되지 않아 전투가 멈춘 것처럼 보이기 때문이다.
      checkBossThreshold();
    }
  };

  function openForfeitConfirmation() {
    if (!state || state.status === 'ended') return;
    if (state.status === 'ready') {
      window.show?.('collection');
      return;
    }
    state.paused = true;
    refs.forfeitConfirm.hidden = false;
    refs.forfeitConfirm.querySelector('[data-forfeit="no"]')?.focus();
  }

  function openBattleMap() {
    if (state?.arenaMatch) {
      if (state.status === 'ready') window.cancelArenaBattle?.(state.arenaMatch);
      else if (state.status === 'ended') window.returnFromArenaBattle?.();
      return;
    }
    if (!state || state.status !== 'ready') return;
    if (typeof window.returnToBattleMap === 'function') window.returnToBattleMap();
    else window.show?.('map');
  }

  function closeForfeitConfirmation() {
    if (!state) return;
    refs.forfeitConfirm.hidden = true;
    state.paused = false;
    state.lastFrame = performance.now();
    if (state.status === 'combat') updateFrigateButton();
  }

  function selectWeapon(key) {
    if (!WEAPONS[key]) return;
    selectedWeapon = key;
    document.querySelectorAll('.weapon-selector [data-weapon]').forEach(button => {
      const selected = button.dataset.weapon === key;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    if (state?.status === 'combat') announce(`${WEAPONS[key].label} 무장 전환`, 'friendly');
  }

  function updateHud(force = false) {
    if (!state) return;
    const gateKills = isMagentaOperation() ? Number(state.magentaBaseKills || 0) : state.kills;
    const normalRatio = Math.min(1, gateKills / Math.max(1, state.normalTotal));
    const bossActive = Boolean(state.boss && !state.boss.dead);
    let progress = normalRatio;
    if (isBossGate()) {
      const progressBossActive = bossActive && (!isMachineBeastGate() || state.boss.variant === 'machine-beast');
      // 케플러 5관문의 기계마수를 이미 격파했다면 보스 몫도 채운다(격파 후 90%에서 멈추지 않도록).
      const kepler5MachineDefeated = Number(state.operation?.gate) === 5 && ((String(state.operation?.region || '').toLowerCase() === 'kepler-atmosphere' && state.keplerAtmosphereMachineBossDefeated) || (String(state.operation?.region || '').toLowerCase() === 'kepler-orbit' && state.keplerMachineBossDefeated));
      const bossRatio = progressBossActive ? Math.max(0, 1 - state.boss.hp / Math.max(1, state.boss.maxHp)) : (kepler5MachineDefeated || state.status === 'resolving' || state.status === 'ended' ? 1 : 0);
      progress = Math.min(1, normalRatio * .9 + bossRatio * .1);
    }
    const progressPercent = Math.round(progress * 100);
    if (refs.battleGateProgress) refs.battleGateProgress.style.width = `${progressPercent}%`;
    if (refs.battleGateProgressLabel) refs.battleGateProgressLabel.textContent = `${progressPercent}%`;
    if (refs.battleGateProgressHud) refs.battleGateProgressHud.hidden = Boolean(state.bounty || (state.boss && !state.boss.dead));
    if (force || state.status === 'combat') {
      const seconds = state.bounty ? Math.max(0, Math.ceil(state.bounty.limit - state.elapsed)) : Math.floor(state.elapsed);
      refs.battleClock.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
  }


  function updateBossHud(target = state?.boss) {
    const active = [state?.boss, ...(state?.midBosses || [])].filter(boss => boss && !boss.dead && boss.requiredForGate);
    const displayBoss = boss => {
      const ratio = Math.max(0, boss.hp / Math.max(1, boss.maxHp) * 100);
      return { ratio, hp: `${formatNumber(Math.max(0, boss.hp))} / ${formatNumber(boss.maxHp)}` };
    };
    if (isKeplerOperation() && ['kepler-orbit', 'kepler-atmosphere', 'kepler-base'].includes(String(state?.operation?.region || '').toLowerCase()) && state.keplerAlienFleetSpawned) {
      // 함재기는 체력바에 표시하지 않는다(우주항모와 호위함만 표시).
      const livingFleet = [state.boss, ...(state.midBosses || [])].filter(ship => ship?.variant?.startsWith('kepler-alien-') && ship.variant !== 'kepler-alien-fighter' && !ship.dead);
      if (!livingFleet.length) {
        refs.battleBossRowSecondary.hidden = true;
        refs.battleBossName.textContent = '외계 함대';
        refs.battleBossBar.style.width = '0%';
        refs.battleBossHp.textContent = '격파';
        return;
      }
      const primary = livingFleet.find(ship => ship.variant === 'kepler-alien-angela') || livingFleet[0];
      const primaryDisplay = displayBoss(primary);
      refs.battleBossName.textContent = primary.name;
      refs.battleBossBar.style.width = `${primaryDisplay.ratio}%`;
      refs.battleBossHp.textContent = primaryDisplay.hp;
      const escorts = livingFleet.filter(ship => ship !== primary);
      if (escorts.length) {
        const hp = escorts.reduce((sum, ship) => sum + ship.hp, 0);
        const maxHp = escorts.reduce((sum, ship) => sum + ship.maxHp, 0);
        const escortNames = [...new Set(escorts.map(ship => ship.name.replace('외계 ', '')))];
        refs.battleBossNameSecondary.textContent = escortNames.length === 1
          ? `${escorts[0].name} · ${escorts.length}척`
          : escortNames.map(name => `외계 ${name}`).join(' + ');
        refs.battleBossBarSecondary.style.width = `${Math.max(0, hp / Math.max(1, maxHp) * 100)}%`;
        refs.battleBossHpSecondary.textContent = `${formatNumber(hp)} / ${formatNumber(maxHp)}`;
        refs.battleBossRowSecondary.hidden = false;
      } else refs.battleBossRowSecondary.hidden = true;
      return;
    }
    const magentaPair = isMagentaNearOperation() && Number(state?.operation?.gate) === 10 && active.some(boss => boss.variant === 'toxic-beast') && active.some(boss => boss.variant === 'flame-beast');
    if (magentaPair) {
      const flame = active.find(boss => boss.variant === 'flame-beast');
      const toxic = active.find(boss => boss.variant === 'toxic-beast');
      const flameDisplay = displayBoss(flame);
      const toxicDisplay = displayBoss(toxic);
      refs.battleBossName.textContent = '화염마수';
      refs.battleBossBar.style.width = `${flameDisplay.ratio}%`;
      refs.battleBossHp.textContent = flameDisplay.hp;
      refs.battleBossNameSecondary.textContent = '독성마수';
      refs.battleBossBarSecondary.style.width = `${toxicDisplay.ratio}%`;
      refs.battleBossHpSecondary.textContent = toxicDisplay.hp;
      refs.battleBossRowSecondary.hidden = false;
      return;
    }
    refs.battleBossRowSecondary.hidden = true;
    if (!target || target.dead) return;
    const display = displayBoss(target);
    refs.battleBossName.textContent = target.variant === 'blackbeard' ? target.name : target.variant === 'tas-right-arm' ? '오른팔' : target.variant === 'tas-long-arm' ? '긴팔' : target.variant === 'toxic-beast' ? '독성마수' : target.variant === 'machine-beast' ? '기계마수' : target.variant === 'four-wing-beast' ? '4익마수' : target.variant === 'flame-beast' ? '화염마수' : target.variant === 'kepler-alien-angela' ? '외계 앙헬라' : target.variant === 'kepler-alien-escort' ? '외계 호위함' : 'BOSS';
    refs.battleBossBar.style.width = `${display.ratio}%`;
    refs.battleBossHp.textContent = display.hp;
  }

  function announce(message, tone = '') {
    if (!refs.battleAnnouncement) return;
    clearTimeout(announceTimer);
    refs.battleAnnouncement.textContent = message;
    refs.battleAnnouncement.dataset.tone = tone;
    refs.battleAnnouncement.classList.remove('show');
    void refs.battleAnnouncement.offsetWidth;
    refs.battleAnnouncement.classList.add('show');
    announceTimer = setTimeout(() => refs.battleAnnouncement?.classList.remove('show'), 2050);
  }

  // 데미지 숫자: 최근 평균 피해보다 확실히 큰 공격일수록 크고 따뜻한 색으로 튀어 오릅니다
  // (1.6배 이상 노랑, 2.5배 이상 주황). 진행도에 따라 피해량이 커져도 "평소보다 센 한 방"만 눈에 띕니다.
  // 한꺼번에 숫자가 너무 많으면 작은 숫자는 건너뛰어 화면이 지저분해지지 않게 합니다.
  let activeDamageLabels = 0, recentDamageAverage = 0;
  function showUnitDamage(target, amount = 1) {
    const numeric = typeof amount === 'number';
    let tier = '';
    if (numeric) {
      if (!recentDamageAverage) recentDamageAverage = amount;
      tier = amount >= recentDamageAverage * 2.5 ? ' dmg-huge' : amount >= recentDamageAverage * 1.6 ? ' dmg-big' : '';
      recentDamageAverage = recentDamageAverage * .92 + amount * .08;
    }
    if (numeric && !tier && activeDamageLabels >= 18) return;
    activeDamageLabels += 1;
    const point = pointOf(target);
    const label = document.createElement('i');
    label.className = `damage-one${tier}${numeric ? '' : ' dmg-note'}`;
    label.textContent = numeric ? formatNumber(amount) : String(amount);
    setTimeout(() => { activeDamageLabels = Math.max(0, activeDamageLabels - 1); }, 620);
    label.style.left = percent(point.x + (Math.random() - .5) * .02);
    label.style.top = percent(point.y - .025);
    refs.effects.append(label);
    schedule(() => label.remove(), 620);
  }

  // 보스에게 큰 피해를 줄 때 전장을 살짝(2px) 흔듭니다. 0.25초에 한 번까지만.
  let lastShakeAt = 0;
  function shakeBattlefield() {
    const now = realPerformance.now();
    if (now - lastShakeAt < 250 || !refs.viewport) return;
    lastShakeAt = now;
    refs.viewport.classList.remove('hit-shake');
    void refs.viewport.offsetWidth;
    refs.viewport.classList.add('hit-shake');
    setTimeout(() => refs.viewport?.classList.remove('hit-shake'), 200);
  }

  function flashTarget(target) {
    target.el?.classList.add('hit');
    schedule(() => target.el?.classList.remove('hit'), 100);
  }

  function dealPlasmaSplash(source, amount) {
    if (!state || state.status !== 'combat' || !source) return;
    const origin = pointOf(source);
    const nearby = livingEnemyTargets()
      .filter(candidate => candidate !== source && !candidate.dead && (candidate.kind === 'boss' || candidate.deployed))
      .filter(candidate => Math.hypot(candidate.x - origin.x, candidate.y - origin.y) <= .18)
      .sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y))
      .slice(0, 3);
    nearby.forEach((target, index) => schedule(() => {
      shooterDamage(target, amount);
      createExplosion(pointOf(target), 'plasma-splash');
    }, index * 42));
  }

  // 몬스터 사망 효과(monster-death-fx.js): 몸체가 갈라지고 파편·체액·화염이 터집니다.
  // tier: 'small'(일반) | 'large'(중간보스·대형) | 'boss'(관문 보스). 효과를 못 쓰면 false 를 돌려줘 기존 폭발로 대신합니다.
  function deathPalette(unit) {
    const name = `${unit?.monsterType || ''} ${unit?.variant || ''} ${unit?.el?.className || ''}`.toLowerCase();
    if (/toxic|dokchim|gasimon|acid|poison/.test(name)) return { color: '#b8ff5a', goo: '#7dff3a' };
    if (/plasma/.test(name)) return { color: '#d79bff', goo: '#b65bff' };
    if (/flame|fire|red-overlord/.test(name)) return { color: '#ff9a2e', goo: '#ffb347' };
    if (/blue|ice/.test(name)) return { color: '#7fe3ff', goo: '#4fc3ff' };
    if (/machine|mech|pirate|kepler-alien/.test(name)) return { color: '#ffd27a', goo: '#9aa6b4' };
    return { color: '#ff8a3c', goo: '#ff4a6a' };
  }
  function playDeathFx(unit, tier = 'small') {
    if (!window.playMonsterDeath || !unit?.el || !refs.effects || !state) return false;
    const rect = unit.el.getBoundingClientRect();
    if (!rect.width) return false;
    const image = unit.el.querySelector('img.enemy-sprite, img')?.getAttribute('src') || '';
    const size = Math.max(24, Math.round(Math.max(rect.width, rect.height)));
    const finalTier = tier === 'small' && size >= 96 ? 'large' : tier;
    const point = pointOf(unit), palette = deathPalette(unit);
    window.playMonsterDeath({ layer: refs.effects, x: percent(point.x), y: percent(point.y), size, tier: finalTier, image, color: palette.color, goo: palette.goo, shakeTarget: refs.viewport });
    // 그림이 있으면 효과가 몸체를 대신 그리므로 원래 몬스터는 바로 숨깁니다.
    if (image) unit.el.style.visibility = 'hidden';
    return true;
  }

  function createExplosion(point, kind = '') {
    if (!refs.effects || !state || state.status === 'ended' && kind !== 'boss') return;
    const effect = document.createElement('i');
    const missileCinematic = kind === 'missile' || kind === 'pojakseon';
    if(kind==='missile')playMissileImpactSound();
    const cannonImpact = kind === 'cannon';
    effect.className = `fx-explosion ${kind}${missileCinematic ? ' missile-cinematic' : ''}${cannonImpact ? ' cannon-impact' : ''}`;
    if (missileCinematic) effect.innerHTML = '<i></i><i></i><i></i>';
    effect.style.left = percent(point.x);
    effect.style.top = percent(point.y);
    refs.effects.append(effect);
    schedule(() => effect.remove(), missileCinematic ? 1100 : cannonImpact ? 410 : 430);
  }

  function positionProjectile(element, from, to) {
    const rect = refs.field.getBoundingClientRect();
    element.style.left = percent(from.x);
    element.style.top = percent(from.y);
    element.style.setProperty('--dx', `${(to.x - from.x) * rect.width}px`);
    element.style.setProperty('--dy', `${(to.y - from.y) * rect.height}px`);
    if (element.classList.contains('fx-missile')) {
      playMissileLaunchSound();
      element.style.setProperty('--missile-angle', `${Math.atan2(to.y - from.y, to.x - from.x) + Math.PI / 2}rad`);
    } else {
      element.style.transform = `rotate(${Math.atan2(to.y - from.y, to.x - from.x)}rad)`;
    }
  }

  function positionLine(element, from, to) {
    const rect = refs.field.getBoundingClientRect();
    const dx = (to.x - from.x) * rect.width;
    const dy = (to.y - from.y) * rect.height;
    element.style.left = percent(from.x);
    element.style.top = percent(from.y);
    element.style.width = `${Math.hypot(dx, dy)}px`;
    element.style.setProperty('--angle', `rotate(${Math.atan2(dy, dx)}rad)`);
  }

  function pointOf(unit) {
    return { x: Number(unit.x) || .5, y: Number(unit.y) || .5 };
  }

  // 일반 몬스터는 상단 바 뒤(전투판 위쪽 바깥)에서 내려오므로, 화면 안으로 들어와 보이기 시작한 뒤에만 조준합니다.
  // (예전에는 보이지 않는 곳에서 처치돼 전투와 사망 효과가 잘 보이지 않았음)
  const ENEMY_VISIBLE_TOP_Y = .05;
  function livingEnemyTargets() {
    const normal = state.enemies.filter(enemy => !enemy.dead && enemy.deployed && (enemy.monsterType === 'plasma-bug' || enemy.y >= ENEMY_VISIBLE_TOP_Y));
    if (state.boss && !state.boss.dead && !state.boss.machineAirborne) normal.push(state.boss);
    state.midBosses?.forEach(monster => { if (!monster.dead) normal.push(monster); });
    state.pirates?.forEach(pirate => { if (!pirate.dead && !pirate.escaped) normal.push(pirate); });
    return normal;
  }

  function alliedTargetsInRange(ally) {
    if (!ally) return [];
    const origin = pointOf(ally);
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    return livingEnemyTargets().filter(target => {
      if (!(target.kind === 'boss' || target.deployed)) return false;
      return Math.hypot((target.x - origin.x) * width / height, target.y - origin.y) <= ALLY_ATTACK_RANGE_RATIO;
    });
  }

  // 쏘는 쪽 기준 사거리 안 목표: 아군은 적(몬스터), 아레나 상대 함선은 아군을 고른다.
  function inRangeTargetsFor(unit) {
    if (!unit?.isArenaShip) return alliedTargetsInRange(unit);
    const origin = pointOf(unit);
    const field = refs.field?.getBoundingClientRect();
    const width = field?.width || 480;
    const height = field?.height || 720;
    return state.allies.filter(ally => !ally.dead && Math.hypot((ally.x - origin.x) * width / height, ally.y - origin.y) <= ALLY_ATTACK_RANGE_RATIO);
  }

  function randomLivingAlly() {
    const living = hostileAllyTargets();
    return living[Math.floor(Math.random() * living.length)] || null;
  }

  // 발사자 기준 피해 대상 전체: 아군은 적(몬스터·보스 등), 아레나 상대 함선은 아군.
  function hostileTargetsFor(unit) {
    if (!unit?.isArenaShip) return livingEnemyTargets();
    return state.allies.filter(ally => !ally.dead);
  }

  function monsterTargetFor(enemy) {
    const celestialShield = activeCelestialShieldTarget();
    if (celestialShield) {
      enemy.target = celestialShield;
      enemy.targetForced = true;
      return celestialShield;
    }
    const forced = enemy?.forcedTarget;
    if (forced && !forced.dead && Number(enemy.forcedTargetUntil) > performance.now()) {
      enemy.target = forced;
      enemy.targetForced = true;
      return forced;
    }
    if (enemy?.targetForced) {
      enemy.target = null;
      enemy.targetForced = false;
    }
    if (enemy?.target && !enemy.target.dead) return enemy.target;
    const living = hostileAllyTargets();
    if (!living.length) return null;
    const preferred = enemyArchetype(enemy) === 'dokchimmon'
      ? living.filter(ally => ally.ship?.type === 'destroyer')
      : living;
    const candidates = preferred.length ? preferred : living;
    enemy.target = candidates[Math.floor(Math.random() * candidates.length)] || null;
    enemy.approachOffset = enemy.monsterType === 'plasma-bug' ? 0 : (Math.random() - .5) * (enemyArchetype(enemy) === 'jipgemon' ? .055 : .15);
    return enemy.target;
  }

  function hostileTargetFor(enemy) {
    const celestialShield = activeCelestialShieldTarget();
    if (celestialShield) return celestialShield;
    const forced = enemy?.forcedTarget;
    if (forced && !forced.dead && Number(enemy.forcedTargetUntil) > performance.now()) return forced;
    if (enemy) {
      enemy.forcedTarget = null;
      enemy.forcedTargetUntil = 0;
    }
    const interceptors = state.interceptors?.filter(unit => !unit.dead) || [];
    if (interceptors.length && Math.random() < .28) return interceptors[Math.floor(Math.random() * interceptors.length)];
    return randomLivingAlly();
  }

  function frigateSkillFor(frigate) {
    return FRIGATE_SKILLS[frigate?.name] || { name: '정밀 포격', kind: 'barrage', amount: 650 };
  }

  function frigateCodexMarkup(frigate) {
    const image = FRIGATE_CODEX_IMAGES[frigate?.name] || frigate?.image;
    if (!image) return '<span>F</span>';
    return `<img class="frigate-codex-preview" src="${escapeHtml(image)}" alt="${escapeHtml(frigate?.name || '프리깃')}" />`;
  }

  function topViewMarkup(ship) {
    const type = TYPE_LABELS[ship?.type] ? ship.type : 'destroyer';
    const variant = Math.abs(hashCode(`${ship?.type || ''}:${ship?.name || ''}`)) % 6;
    const color = RARITY_COLORS[ship?.rarity] || RARITY_COLORS.R;
    const battlecruiserFx = type === 'battlecruiser' ? '<span class="battlecruiser-fx" aria-hidden="true"><i class="bc-thruster"></i></span>' : '';
    const turtleThrusterFx = '<span class="battlecruiser-fx turtle-twin-thrusters" aria-hidden="true"><i class="bc-thruster"></i><i class="bc-thruster"></i></span>';
    const suPanokseonThrusterFx = '<span class="battlecruiser-fx supanokseon-twin-thrusters" aria-hidden="true"><i class="bc-thruster"></i><i class="bc-thruster"></i></span>';
    const pegasusThrusterFx = '<span class="battlecruiser-fx pegasus-twin-thrusters" aria-hidden="true"><i class="bc-thruster"></i><i class="bc-thruster"></i></span>';
    const carrierThrusterFx = '<span class="battlecruiser-fx carrier-thrusters" aria-hidden="true"><i class="bc-thruster"></i><i class="bc-thruster"></i><i class="bc-thruster"></i></span>';
    const hyperionThrusterFx = '<span class="battlecruiser-fx hyperion-quad-thrusters" aria-hidden="true"><i class="bc-thruster"></i><i class="bc-thruster"></i><i class="bc-thruster"></i><i class="bc-thruster"></i></span>';
    const furyThrusterFx = '<span class="battlecruiser-fx fury-twin-thrusters" aria-hidden="true"><i class="bc-thruster"></i><i class="bc-thruster"></i></span>';
    if (type === 'frigate') {
      const image = FRIGATE_BATTLE_IMAGES[ship?.name] || ship?.battleImage;
      if (image) return `<div class="ship-topview frigate-battle-topview${ship?.name === '방패선' ? ' bangpaeseon-battle-topview' : ''}${ship?.name === '포작선' ? ' pojakseon-battle-topview' : ''}${ship?.name === '과학 드론' || ship?.name === '과학드론' ? ' science-drone-battle-topview' : ''}" style="--rarity-color:${color}"><img src="${escapeHtml(image)}" alt="${escapeHtml(ship?.name || '프리깃')}" /></div>`;
    }
    if (ship?.name === '돌격 거북선') {
      return `<div class="ship-topview assault-turtle-topview" style="--rarity-color:${color}"><img src="assault-turtle-battle-topview.png" alt="" />${turtleThrusterFx}</div>`;
    }
    if (ship?.type === 'battlecruiser' && ship?.name === '거북선') {
      return `<div class="ship-topview turtle-ship-topview" style="--rarity-color:${color}"><img src="turtle-ship-battle-topview.png" alt="" />${turtleThrusterFx}</div>`;
    }
    if (ship?.name === '아틀라스') {
      return `<div class="ship-topview atlas-topview" style="--rarity-color:${color}"><img src="atlas-battle-topview.png" alt="" /><span class="atlas-fx" aria-hidden="true"><i class="atlas-thruster"></i></span></div>`;
    }
    if (ship?.name === 'KDDX') {
      return `<div class="ship-topview kddx-topview" style="--rarity-color:${color}"><img src="kddx-battle-topview.png" alt="" />${turtleThrusterFx}</div>`;
    }
    if (ship?.name === '페가수스') {
      return `<div class="ship-topview pegasus-topview" style="--rarity-color:${color}"><img src="pegasus-battle-topview.png?v=20260921-2" alt="" />${pegasusThrusterFx}</div>`;
    }
    if (ship?.name === '행성파괴자') {
      return `<div class="ship-topview planet-destroyer-topview" style="--rarity-color:${color}"><img src="planet-destroyer-battle-topview.png" alt="" /></div>`;
    }
    if (ship?.name === '판도라') {
      return `<div class="ship-topview pandora-topview" style="--rarity-color:${color}"><img src="pandora-battle-topview.png" alt="" /></div>`;
    }
    if (ship?.name === '바랴그') {
      return `<div class="ship-topview varyag-topview" style="--rarity-color:${color}"><img src="varyag-battle-topview.png" alt="" />${turtleThrusterFx}</div>`;
    }
    if (ship?.name === '가루다') {
      return `<div class="ship-topview garuda-topview" style="--rarity-color:${color}"><img src="garuda-codex.png" alt="" /></div>`;
    }
    if (ship?.name === '데이모스') {
      return `<div class="ship-topview deimos-topview" style="--rarity-color:${color}"><img src="deimos-battle-topview.png?v=20260921-2" alt="" /><span class="battlecruiser-fx deimos-star-thruster" aria-hidden="true"><i class="bc-thruster"></i></span></div>`;
    }
    if (ship?.name === '우라노스') {
      return `<div class="ship-topview uranus-topview" style="--rarity-color:${color}"><img src="uranus-battle-topview.png" alt="" /></div>`;
    }
    if (ship?.name === '스피어') {
      return `<div class="ship-topview spear-topview" style="--rarity-color:${color}"><img src="spear-battle-topview.png" alt="" /></div>`;
    }
    if (ship?.name === '블레이드') {
      return `<div class="ship-topview blade-topview" style="--rarity-color:${color}"><img src="blade-battle-topview.png" alt="" /></div>`;
    }
    if (ship?.name === '오메가') {
      return `<div class="ship-topview omega-topview" style="--rarity-color:${color}"><img src="omega-battle-topview.png" alt="" /></div>`;
    }
    if (ship?.name === '수 판옥선') {
      return `<div class="ship-topview supanokseon-topview" style="--rarity-color:${color}"><img src="supanokseon-battle-topview.png" alt="" />${suPanokseonThrusterFx}</div>`;
    }
    if (ship?.name === '콜로서스') {
      return `<div class="ship-topview colossus-topview" style="--rarity-color:${color}"><img src="colossus-battle-topview.png" alt="" />${turtleThrusterFx}</div>`;
    }
    if (ship?.name === '니미츠') {
      return `<div class="ship-topview nimitz-topview" style="--rarity-color:${color}"><img src="nimitz-battle-topview.png" alt="" />${turtleThrusterFx}</div>`;
    }
    if (ship?.name === '앙헬라') {
      return `<div class="ship-topview angela-topview" style="--rarity-color:${color}"><img src="angela-battle-topview.png" alt="" /></div>`;
    }
    if (ship?.name === '탱크') {
      return `<div class="ship-topview tank-topview" style="--rarity-color:${color}"><img src="tank-battle-topview.png" alt="" /></div>`;
    }
    if (ship?.name === '도저') {
      return `<div class="ship-topview dozer-topview" style="--rarity-color:${color}"><img src="dozer-battle-topview.png" alt="" />${turtleThrusterFx}</div>`;
    }
    if (ship?.name === '우주항모') {
      return `<div class="ship-topview carrier-topview" style="--rarity-color:${color}"><img src="carrier-battle-topview.png" alt="" />${carrierThrusterFx}</div>`;
    }
    if (ship?.name === '배스천') {
      return `<div class="ship-topview bastion-topview" style="--rarity-color:${color}"><img src="bastion-battle-topview.png" alt="" />${turtleThrusterFx}</div>`;
    }
    if (ship?.name === '해머') {
      return `<div class="ship-topview hammer-topview" style="--rarity-color:${color}"><img src="hammer-battle-topview.png" alt="" />${turtleThrusterFx}</div>`;
    }
    if (ship?.type === 'dreadnought' && ship?.name === '거북선') {
      return `<div class="ship-topview dread-turtle-topview" style="--rarity-color:${color}"><img src="dreadnought-turtle-battle-topview.png" alt="" />${turtleThrusterFx}</div>`;
    }
    if (ship?.name === '네메시스') {
      return `<div class="ship-topview nemesis-topview" style="--rarity-color:${color}"><img src="nemesis-battle-topview.png" alt="" />${turtleThrusterFx}</div>`;
    }
    if (ship?.name === '아이기스') {
      return `<div class="ship-topview aegis-topview" style="--rarity-color:${color}"><img src="aegis-battle-topview.png" alt="" />${turtleThrusterFx}</div>`;
    }
    if (ship?.name === '리틀보이') {
      return `<div class="ship-topview littleboy-topview" style="--rarity-color:${color}"><img src="littleboy-battle-topview.png" alt="" /></div>`;
    }
    if (ship?.name === '아이오와') {
      return `<div class="ship-topview iowa-topview" style="--rarity-color:${color}"><img src="iowa-battle-topview.png" alt="" /></div>`;
    }
    if (ship?.name === '헬리오스') {
      return `<div class="ship-topview helios-topview" style="--rarity-color:${color}"><img src="helios-battle-topview.png" alt="" /></div>`;
    }
    if (ship?.name === '히페리온') {
      return `<div class="ship-topview hyperion-topview" style="--rarity-color:${color}"><img src="hyperion-battle-topview.png" alt="" />${hyperionThrusterFx}</div>`;
    }
    if (ship?.name === '아포칼립스') {
      return `<div class="ship-topview apocalypse-topview" style="--rarity-color:${color}"><img src="apocalypse-battle-topview.png" alt="" />${turtleThrusterFx}</div>`;
    }
    if (ship?.name === '마젤란') {
      return `<div class="ship-topview magellan-topview" style="--rarity-color:${color}"><img src="magellan-battle-topview.png" alt="" />${turtleThrusterFx}</div>`;
    }
    if (ship?.name === '아이언피스트') {
      return `<div class="ship-topview ironfist-topview" style="--rarity-color:${color}"><img src="ironfist-battle-topview.png" alt="" />${battlecruiserFx}</div>`;
    }
    if (ship?.name === '퓨리') {
      return `<div class="ship-topview fury-topview" style="--rarity-color:${color}"><img src="fury-battle-topview.png" alt="" />${furyThrusterFx}</div>`;
    }
    if (ship?.name === '브라운베스') {
      return `<div class="ship-topview brown-bess-topview" style="--rarity-color:${color}"><img src="brown-bess-battle-topview.png?v=20260924-2" alt="" /><span class="battlecruiser-fx brown-bess-twin-thrusters" aria-hidden="true"><i class="bc-thruster"></i><i class="bc-thruster"></i></span></div>`;
    }
    if (ship?.name === '야마토') {
      return `<div class="ship-topview yamato-topview" style="--rarity-color:${color}"><img src="yamato-battle-topview.png" alt="" />${battlecruiserFx}</div>`;
    }
    if (ship?.name === '스타 크루저') {
      return `<div class="ship-topview star-cruiser-topview" style="--rarity-color:${color}"><img src="star-cruiser-battle-topview-20261007.png" alt="" />${battlecruiserFx}</div>`;
    }
    return `<div class="ship-topview type-${type} variant-${variant}" style="--rarity-color:${color}"><i class="wing wing-a"></i><i class="wing wing-b"></i><i class="hull"></i><i class="rail rail-a"></i><i class="rail rail-b"></i><i class="core"></i><i class="engine"></i>${battlecruiserFx}</div>`;
  }

  function diamondPosition(index, total) {
    const progress = (index + .65) / total;
    const radius = Math.sqrt(progress);
    const angle = index * 2.399963229728653;
    const rawX = Math.cos(angle);
    const rawY = Math.sin(angle);
    const diamondScale = Math.abs(rawX) + Math.abs(rawY) || 1;
    return {
      x: .5 + rawX / diamondScale * .42 * radius,
      y: .29 + rawY / diamondScale * .22 * radius
    };
  }

  function schedule(callback, delay) {
    const token = generation;
    const damageSource = activeDamageSource;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (token !== generation) return;
      withDamageSource(damageSource, callback);
    }, (Number(delay) || 0) / battleSpeed);
    timers.add(timer);
    return timer;
  }

  function stopRuntime() {
    if (frameHandle) cancelAnimationFrame(frameHandle);
    frameHandle = 0;
    clearInterval(arenaPlaybackTimer);
    arenaPlaybackTimer = 0;
    timers.forEach(timer => clearTimeout(timer));
    timers.clear();
    clearTimeout(announceTimer);
  }

  function percent(value) { return `${Math.max(-.2, Math.min(1.2, value)) * 100}%`; }
  function randomInteger(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function formatNumber(value) { return Number(value || 0).toLocaleString('ko-KR'); }
  function hashCode(value) { let hash = 0; for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash) + value.charCodeAt(index); return hash | 0; }
  function toKey(id) { return id.replace(/-([a-z])/g, (_, char) => char.toUpperCase()); }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
})();
