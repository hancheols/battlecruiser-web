(() => {
  'use strict';
  const paths={
    music:'M9 18V5l11-2v13M9 8l11-2M9 18c0 2-6 3-6 0s6-3 6 0Zm11-2c0 2-6 3-6 0s6-3 6 0Z',
    effects:'M4 9h4l5-4v14l-5-4H4V9Zm12-1c3 2 3 6 0 8m3-11c5 4 5 10 0 14',
    account:'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 20v-2a7 7 0 0 1 14 0v2M16 10h5m-2-2 2 2-2 2',
    language:'M3 5h12M9 3v2m-4 0c0 6 4 9 8 11M13 5c0 5-4 10-10 12m11 3 4-11 4 11m-6-4h4',
    info:'M12 8h.01M12 11v6M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z'
  };
  const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.info}"/></svg>`;
  window.openCaptainSettings=(host,onBack)=>{
    const api=window.gamePreferences;
    const t=(ko,en)=>api.get().language==='en'?en:ko;
    const viewStack=['settings'];
    const row=(view,name,description,symbol=view)=>`<button type="button" class="captain-setting-row" data-settings-view="${view}"><i>${icon(symbol)}</i><span><b>${name}</b><small>${description}</small></span><em aria-hidden="true">›</em></button>`;
    const status=message=>{const node=host.querySelector('.captain-setting-status');if(node)node.textContent=message;};
    const save=patch=>{const persisted=api.update(patch);if(!persisted)status(t('이번 실행에 적용했습니다. 기기 저장 공간을 사용할 수 없습니다.','Applied for this session. Device storage is unavailable.'));return persisted;};
    function mount(view='settings'){
      const state=api.get();
      const titles={settings:t('설정','Settings'),sound:t('소리','Sound'),account:t('계정연동','Account linking'),language:t('언어선택','Language'),info:t('정보','Information'),privacy:t('개인정보 처리방침','Privacy policy'),terms:t('서비스 이용약관','Terms of service'),google:'Google',apple:'Apple',guest:t('게스트 계정','Guest account')};
      let content='';
      if(view==='settings'){
        content=`<p class="captain-setting-intro">${t('함장의 플레이 환경을 설정하세요.','Customize your command experience.')}</p><div class="captain-settings-list">${row('sound',titles.sound,`${t('배경음악','Music')} ${state.music.enabled?'ON':'OFF'} · ${Math.round(state.music.volume*100)}% / ${t('효과음','Effects')} ${state.effects.enabled?'ON':'OFF'} · ${Math.round(state.effects.volume*100)}%`)}${row('account',titles.account,t('현재 기기 · 게스트 플레이','This device · Guest play'))}${row('language',titles.language,state.language==='ko'?'한국어':'English')}${row('info',titles.info,t('플레이어 ID · 버전 · 정책 및 약관','Player ID · Version · Policies'))}</div>`;
      }else if(view==='sound'){
        const audioControl=(key,label)=>`<div class="captain-audio-row"><span>${label}</span><label class="captain-audio-toggle" aria-label="${label} ${t('켜기 또는 끄기','on or off')}"><input type="checkbox" role="switch" data-audio-enabled="${key}" ${state[key].enabled?'checked':''}/><i aria-hidden="true"></i><b data-audio-state="${key}">${state[key].enabled?'ON':'OFF'}</b></label></div>`;
        content=`<div class="captain-audio-list">${audioControl('music',t('배경음악','Background music'))}${audioControl('effects',t('효과음','Sound effects'))}</div>`;
      }else if(view==='account'){
        content=`<div class="captain-account-state"><span class="captain-status-dot"></span><b>${t('게스트로 플레이 중','Playing as guest')}</b></div><p class="captain-setting-note">${t('진행 정보는 이 브라우저에 저장되고 서버에도 자동으로 백업됩니다. 구글 계정을 연결하면 기기를 바꿔도 이어서 플레이할 수 있습니다. Apple 연동은 준비 중입니다.','Progress is saved in this browser and backed up to the server automatically. Link a Google account to continue on another device. Apple linking is coming soon.')}</p><div class="captain-settings-list">${['google','apple','guest'].map(provider=>row(provider,titles[provider],state.accountProvider===provider?t('선택한 계정 방식','Preferred method'):t('계정 방식 보기','View sign-in method'),'account')).join('')}</div>`;
      }else if(view==='google'){
        content=`<div class="captain-setting-hero"><i>${icon('account')}</i><span>Google</span></div><div class="captain-google-slot" data-google-slot><p class="captain-setting-note">${t('불러오는 중...','Loading...')}</p></div>`;
      }else if(['google','apple','guest'].includes(view)){
        content=`<div class="captain-setting-hero"><i>${icon('account')}</i><span>${titles[view]}</span></div><p class="captain-setting-note">${view==='guest'?t('현재 기기에 진행 정보를 저장합니다. 브라우저 데이터를 삭제하면 진행 정보를 잃을 수 있습니다.','Progress is stored on this device. Clearing browser data can remove your progress.'):t(`${titles[view]} 계정연동은 아직 제공되지 않습니다. 이 선택은 선호 방식만 저장하며 로그인이나 클라우드 저장을 수행하지 않습니다.`,`${titles[view]} linking is not available yet. This saves your preference only; it does not sign you in or enable cloud saves.`)}</p><button type="button" class="captain-save" data-account-choice="${view}">${t('이 계정 방식 선택','Choose this method')}</button>`;
      }else if(view==='language'){
        content=`<div class="captain-language-options" role="radiogroup" aria-label="${titles.language}">${[['ko','한국어','KOREAN'],['en','English','ENGLISH']].map(([code,label,subtitle])=>`<label class="captain-language-choice"><input type="radio" name="captain-language" value="${code}" ${state.language===code?'checked':''}/><span><b>${label}</b><small>${subtitle}</small></span></label>`).join('')}</div><p class="captain-setting-note">${t('설정 메뉴 언어가 즉시 변경됩니다. 현재 게임 본문은 한국어로 제공됩니다.','The settings menu language changes immediately. Game content is currently available in Korean.')}</p>`;
      }else if(view==='info'){
        content=`<div class="captain-player-record"><label for="captain-player-id">${t('플레이어 ID','Player ID')}</label><input id="captain-player-id" readonly value="${api.playerId}"/><button type="button" data-copy-player>${t('ID 복사','Copy ID')}</button><small>${t('현재 브라우저에서 생성된 기기 ID입니다.','A local player ID generated in this browser.')}</small></div><div class="captain-version"><span>${t('버전','Version')}</span><b>${api.version}</b></div><div class="captain-settings-list">${row('privacy',titles.privacy,t('문서 상태 보기','View document status'),'info')}${row('terms',titles.terms,t('문서 상태 보기','View document status'),'info')}</div>`;
      }else{
        content=`<div class="captain-setting-hero"><i>${icon('info')}</i><span>${t('공식 문서 준비 중','DOCUMENT PENDING')}</span></div><p class="captain-setting-note">${t(`${titles[view]} 공식 문서는 아직 등록되지 않았습니다. 게시된 문서가 준비되면 이 메뉴에서 확인할 수 있습니다.`, `The official ${view==='privacy'?'privacy policy':'terms of service'} has not been published yet. It will be available here when provided.`)}</p>`;
      }
      const goBack=()=>{if(viewStack.length>1){viewStack.pop();mount(viewStack[viewStack.length-1]);}else onBack();};
      host.dataset.settingsActive='true';
      host.innerHTML=`<section class="captain-select-dialog captain-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="captain-select-title"><header><div><small>COMMAND SYSTEM · PREFERENCES</small><h2 id="captain-select-title">${titles[view]}</h2></div><button type="button" data-captain-close aria-label="${t('닫기','Close')}">×</button></header>${content}<p class="captain-setting-status" role="status" aria-live="polite"></p></section>`;
      host.querySelectorAll('[data-settings-view]').forEach(button=>button.onclick=()=>{viewStack.push(button.dataset.settingsView);mount(button.dataset.settingsView);});
      host.querySelector('[data-captain-close]').onclick=event=>{event.stopPropagation();goBack();};
      host.querySelectorAll('[data-audio-enabled]').forEach(input=>input.addEventListener('change',event=>{
        const key=event.currentTarget.dataset.audioEnabled;
        save({[key]:{enabled:event.target.checked}});
        host.querySelector(`[data-audio-state="${key}"]`).textContent=event.target.checked?'ON':'OFF';
      }));
      host.querySelector('[data-preview-sound]')?.addEventListener('click',()=>{
        const sound=window.createGameAudio('sound/ui_button_click.ogg');sound.volume=.24;sound.play().catch(()=>status(t('소리를 재생할 수 없습니다.','Unable to play sound.')));
      });
      host.querySelector('[data-account-choice]')?.addEventListener('click',event=>{
        if(save({accountProvider:event.currentTarget.dataset.accountChoice}))status(t('계정 방식을 저장했습니다. 현재 로그인 상태는 게스트입니다.','Preference saved. You are still playing as a guest.'));
      });
      host.querySelectorAll('[name="captain-language"]').forEach(input=>input.addEventListener('change',()=>{
        const persisted=save({language:input.value});mount('language');host.querySelector('[name="captain-language"]:checked')?.focus();
        if(!persisted)status(t('이번 실행에만 적용되었습니다.','Applied for this session only.'));
      }));
      host.querySelector('[data-copy-player]')?.addEventListener('click',async()=>{
        try{await navigator.clipboard.writeText(api.playerId);status(t('플레이어 ID를 복사했습니다.','Player ID copied.'));}
        catch{const input=host.querySelector('#captain-player-id');if(input){input.focus();input.select();status(t('선택된 ID를 복사해주세요.','Copy the selected ID.'));}}
      });
      if(view==='google')setupGoogle();
      host.querySelector('[data-captain-close]').focus();
    }
    // 구글 연동: 버튼(GIS)이 준 토큰을 서버로 보내 지금 게스트 계정에 연결한다. 이미 다른 계정에 연결된 구글 계정이면 전환할지 묻는다.
    async function setupGoogle(){
      const slot=host.querySelector('[data-google-slot]');
      if(!slot)return;
      const note=text=>`<p class="captain-setting-note">${text}</p>`;
      const account=window.cloudAccount;
      if(!account){slot.innerHTML=note(t('이 환경에서는 계정 연동을 사용할 수 없습니다.','Account linking is unavailable here.'));return;}
      const [cfg,info]=await Promise.all([account.config(),account.info()]);
      if(!host.contains(slot))return;
      const linked=(info.identities||[]).find(item=>item.provider==='google');
      if(linked){
        slot.innerHTML=`<div class="captain-account-state"><span class="captain-status-dot"></span><b>${t('구글 계정 연결됨','Google account linked')}</b></div>${note(`${linked.email} · ${t('진행 정보가 이 계정에 자동으로 백업됩니다. 다른 기기에서 같은 구글 계정으로 연결하면 이어서 플레이할 수 있습니다.','Your progress is backed up to this account. Link the same Google account on another device to continue.')}`)}`;
        return;
      }
      if(!cfg.googleClientId){slot.innerHTML=note(t('구글 계정 연동은 준비 중입니다.','Google linking is coming soon.'));return;}
      slot.innerHTML=note(t('구글 계정을 연결하면 기기를 바꾸거나 브라우저 데이터를 지워도 진행 정보를 되찾을 수 있습니다.','Link a Google account to recover your progress after switching devices or clearing browser data.'))+'<div class="captain-google-button" data-google-button></div>';
      const onCredential=async credential=>{
        status(t('확인하는 중입니다...','Checking...'));
        const result=await account.link(credential);
        if(result.status==='linked'||result.status==='already'){mount('google');status(t('구글 계정을 연결했습니다.','Google account linked.'));return;}
        if(result.status==='exists'){
          slot.innerHTML=note(`${result.email||''} · ${t('이 구글 계정에는 이미 저장된 진행 정보가 있습니다. 전환하면 이 기기의 현재 진행 정보는 저장된 정보로 대체됩니다.','This Google account already has saved progress. Switching replaces the progress on this device with the saved progress.')}`)+`<div class="captain-google-choices"><button type="button" class="captain-save" data-google-switch>${t('저장된 계정으로 전환','Switch to saved account')}</button><button type="button" data-google-cancel>${t('취소','Cancel')}</button></div>`;
          slot.querySelector('[data-google-cancel]').onclick=()=>mount('google');
          slot.querySelector('[data-google-switch]').onclick=async()=>{
            status(t('전환하는 중입니다...','Switching...'));
            const done=await account.switchTo(credential);
            if(done.status==='switched')location.reload();
            else status(t('전환하지 못했습니다. 잠시 뒤 다시 시도해 주세요.','Could not switch. Please try again later.'));
          };
          return;
        }
        status(result.httpStatus===429?t('요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.','Too many requests. Please try again later.'):t('연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.','Could not link. Please try again later.'));
      };
      try{
        const google=await account.loadGsi();
        google.accounts.id.initialize({client_id:cfg.googleClientId,callback:response=>onCredential(response.credential)});
        google.accounts.id.renderButton(slot.querySelector('[data-google-button]'),{theme:'outline',size:'large',text:'continue_with',shape:'pill',locale:api.get().language==='en'?'en':'ko'});
      }catch(error){status(t('구글 로그인 도구를 불러오지 못했습니다. 네트워크를 확인해 주세요.','Could not load Google sign-in. Check your network.'));}
    }
    mount();
  };
})();
