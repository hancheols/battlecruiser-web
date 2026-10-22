(() => {
  'use strict';
  const KEY='starfleet-preferences-v1', ID_KEY='starfleet-player-id-v1';
  const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
  const clamp=value=>Math.min(1,Math.max(0,Number(value)||0));
  const saved=read(KEY)||{};
  const channel=(value,volume)=>({enabled:value?.enabled!==false,volume:Number.isFinite(value?.volume)?clamp(value.volume):volume});
  let state={music:channel(saved.music,.65),effects:channel(saved.effects,1),language:saved.language==='en'?'en':'ko',accountProvider:['guest','google','apple'].includes(saved.accountProvider)?saved.accountProvider:'guest'};
  let playerId=read(ID_KEY);
  if(typeof playerId!=='string'||!/^SF-[A-F0-9-]{32,36}$/.test(playerId)){
    playerId='SF-'+(crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('')).toUpperCase();
    try{localStorage.setItem(ID_KEY,JSON.stringify(playerId));}catch{}
  }
  const volumeProperty=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'volume');
  const mutedProperty=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'muted');
  const voices=new Set();
  const register=(audio,group,initialVolume=1,initialMuted=false)=>{
    let baseVolume=initialVolume,baseMuted=initialMuted;
    const apply=()=>{
      const preference=state[group];
      volumeProperty.set.call(audio,baseVolume*preference.volume);
      mutedProperty.set.call(audio,baseMuted||!preference.enabled);
    };
    // Engine reads/writes retain the original per-sound mix and priority ducking.
    Object.defineProperties(audio,{
      volume:{configurable:true,get:()=>baseVolume,set:value=>{baseVolume=clamp(value);apply();}},
      muted:{configurable:true,get:()=>baseMuted,set:value=>{baseMuted=Boolean(value);apply();}}
    });
    const clone=audio.cloneNode.bind(audio);
    audio.cloneNode=deep=>register(clone(deep),group,baseVolume,baseMuted);
    audio.applyGameVolume=apply;
    voices.add(new WeakRef(audio));apply();
    return audio;
  };
  window.createGameAudio=(source,group='effects')=>register(new Audio(source),group==='music'?'music':'effects');
  window.gamePreferences={
    playerId,version:'개발 프로토타입 · 2026.10.03',
    get:()=>JSON.parse(JSON.stringify(state)),
    update(patch){
      if(patch.music)state.music=channel({...state.music,...patch.music},.65);
      if(patch.effects)state.effects=channel({...state.effects,...patch.effects},1);
      if(['ko','en'].includes(patch.language))state.language=patch.language;
      if(['guest','google','apple'].includes(patch.accountProvider))state.accountProvider=patch.accountProvider;
      let persisted=true;
      try{localStorage.setItem(KEY,JSON.stringify(state));}catch{persisted=false;}
      for(const ref of voices){const audio=ref.deref();if(audio)audio.applyGameVolume();else voices.delete(ref);}
      window.dispatchEvent(new CustomEvent('game-preferences-changed',{detail:this.get()}));
      return persisted;
    }
  };
  const music=window.createGameAudio('sound/battlecruiser_mainBGM.mp3','music');
  music.preload='none';music.loop=true;music.volume=.35;
  const battleMusic=window.createGameAudio('sound/battle_bgm.mp3','music');
  battleMusic.preload='auto';battleMusic.loop=true;battleMusic.volume=.42;
  const battleBossMusic=window.createGameAudio('sound/battle_boss_bgm.mp3','music');
  battleBossMusic.preload='auto';battleBossMusic.loop=true;battleBossMusic.volume=.48;
  let unlocked=false;
  let bossBattleMusic=false;
  const syncMusic=()=>{
    const battleScreen=document.querySelector('.screen.active')?.id==='battle';
    const selectedMusic=battleScreen?(bossBattleMusic?battleBossMusic:battleMusic):music;
    [music,battleMusic,battleBossMusic].forEach(track=>{if(track!==selectedMusic)track.pause();});
    if(!unlocked||window.__introActive||document.hidden||!state.music.enabled||state.music.volume===0){selectedMusic.pause();return;}
    selectedMusic.play().catch(()=>{});
  };
  window.setBattleBossMusic=enabled=>{bossBattleMusic=Boolean(enabled);syncMusic();};
  const unlock=()=>{unlocked=true;syncMusic();};
  document.addEventListener('pointerdown',unlock,{once:true});
  document.addEventListener('keydown',unlock,{once:true});
  document.addEventListener('visibilitychange',syncMusic);
  window.addEventListener('game-preferences-changed',syncMusic);
  window.addEventListener('game-screen-changed',syncMusic);
  window.addEventListener('intro-finished',syncMusic);
})();
