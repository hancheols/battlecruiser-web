(() => {
  'use strict';
  const PROFILE_KEY='starfleet-commander-profile-v1';
  const TOTAL_KEY='starfleet-lion-token-total-v1';
  const RESOURCE_KEY='starfleet-game-resources-v1';
  const LOOT_KEY='starfleet-exploration-loot-v1';
  const RESEARCH_KEY='starfleet-tactical-weapon-research-v1';
  const MAIL_KEY='starfleet-captain-mail-v1';
  const PRECISION_SCOUT_DRONE_ICON='icons/precision-scout-drone.png';
  window.PRECISION_SCOUT_DRONE_ICON=PRECISION_SCOUT_DRONE_ICON;
  const characters={Jake:'icons/captain-jake-portrait.png',Donna:'icons/captain-donna-portrait.png'};
  const read=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
  const count=value=>Math.max(0,Math.floor(Number(value)||0));
  const format=value=>count(value).toLocaleString('ko-KR');
  let profile=read(PROFILE_KEY)||{};
  let profileLocked=Boolean(characters[profile.character]&&profile.lastName?.trim());
  if(!characters[profile.character])profile.character='Jake';
  if(typeof profile.lastName!=='string')profile.lastName='';
  let total=count(read(TOTAL_KEY)?.earned);
  let hud,overlay;
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const readMails=()=>{const value=read(MAIL_KEY);return Array.isArray(value)?value.filter(mail=>mail&&typeof mail.id==='string'):[];};
  const saveMails=mails=>{try{localStorage.setItem(MAIL_KEY,JSON.stringify(mails));return true;}catch{return false;}};
  const unreadMailCount=()=>readMails().filter(mail=>!mail.readAt).length;
  const mailRewards=mail=>{const source=mail?.rewards&&typeof mail.rewards==='object'?mail.rewards:{};return Object.fromEntries(['gold','thorium','lionToken','scoutTron','researchStaff','ssrShipTicket','frameTicket','frameCannon','frameMissile','frameLaser','framePiercing','frameCarrier','thoriumBox','goldVault','journal','core','precisionScout'].map(key=>[key,count(source[key])]).filter(([,amount])=>amount>0));};
  const rewardLabel=key=>({gold:'골드',thorium:'토륨',lionToken:'사자증표',scoutTron:'탐색드론',researchStaff:'연구인력',ssrShipTicket:'SSR 함선 선택 교환권',frameTicket:'함선골조 교환권',precisionScout:'정밀탐색드론',frameCannon:'함포 골조',frameMissile:'미사일 골조',frameLaser:'레이저포 골조',framePiercing:'관통레이저 골조',frameCarrier:'함재기 골조',thoriumBox:'토륨 상자',goldVault:'금고',journal:'연구일지',core:'범용연구코어'}[key]||key);
  const rewardIcons={gold:'gold-resource-icon.svg',thorium:'thorium-crystal-icon.png',lionToken:'icons/lion-token.png',scoutTron:'icons/scout-drone.png',researchStaff:'icons/research-personnel-20261002.png',ssrShipTicket:'icons/ssr-ship-ticket.svg?v=3',frameTicket:'icons/frame-ticket.svg?v=2',precisionScout:'icons/precision-scout-drone.webp',frameCannon:'icons/ship-frame.png',frameMissile:'icons/ship-frame.png',frameLaser:'icons/ship-frame.png',framePiercing:'icons/ship-frame.png',frameCarrier:'icons/ship-frame.png',thoriumBox:'icons/thorium-box.png',goldVault:'icons/vault.png',journal:'icons/research-journal.png',core:'icons/research-core.png'};
  const rewardMarkup=mail=>{const rewards=mailRewards(mail);return Object.keys(rewards).length?`<section class="captain-mail-reward-panel${mail.claimedAt?' is-claimed':''}" aria-label="첨부 보상"><div class="captain-mail-section-heading"><span>첨부 보급품</span><small>${mail.claimedAt?'수령 완료':'수령 가능'}</small></div><div class="captain-mail-rewards">${Object.entries(rewards).map(([key,amount])=>`<div class="captain-mail-reward"><span class="captain-mail-reward-icon"><img src="${rewardIcons[key]}" alt="" /></span><span class="captain-mail-reward-copy"><b>${rewardLabel(key)}</b><strong>× ${format(amount)}</strong></span></div>`).join('')}</div></section>`:'';};
  // 메일 보상과 같은 "물자창고로 이송" 연출을 별점 보상 등 다른 화면에서도 쓸 수 있게 공개합니다.
  // items: [{src:아이콘 경로, amount:표시 문구, rect:출발 위치(getBoundingClientRect)}]
  window.animateRewardsToWarehouse=items=>animateClaimedRewards(items);
  function animateClaimedRewards(items){
    if(!items.length||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    const destination=document.createElement('div');destination.className='captain-mail-flight-destination';destination.innerHTML='<span aria-hidden="true">▣</span><b>물자창고</b>';
    document.body.append(destination);
    const finish=()=>{destination.classList.add('is-arrived');setTimeout(()=>destination.remove(),650);};
    const target=destination.getBoundingClientRect();
    let remaining=items.length;
    items.forEach((item,index)=>{
      const flight=document.createElement('div');flight.className='captain-mail-reward-flight';
      const icon=document.createElement('img');icon.src=item.src;icon.alt='';
      const amount=document.createElement('span');amount.textContent=item.amount;
      flight.append(icon,amount);document.body.append(flight);
      flight.style.left=`${item.rect.left+item.rect.width/2}px`;
      flight.style.top=`${item.rect.top+item.rect.height/2}px`;
      const dx=target.left+target.width/2-(item.rect.left+item.rect.width/2);
      const dy=target.top+target.height/2-(item.rect.top+item.rect.height/2);
      const animation=flight.animate([
        {transform:'translate(-50%,-50%) scale(.8)',opacity:0},
        {transform:'translate(-50%,-90%) scale(1.2)',opacity:1,offset:.2},
        {transform:`translate(calc(-50% + ${dx*.35}px),calc(-90% + ${dy*.18}px)) scale(1.08)`,opacity:1,offset:.45},
        {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.32)`,opacity:0}
      ],{duration:1050,delay:index*115,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
      animation.finished.catch(()=>{}).then(()=>{flight.remove();if(--remaining===0)finish();});
    });
  }
  window.deliverCaptainMail=mail=>{
    if(!mail||typeof mail!=='object')return false;
    const mails=readMails(),id=String(mail.id||(crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join("-")));
    if(mails.some(entry=>entry.id===id))return false;
    mails.unshift({id,title:String(mail.title||'연합 사령부 공지').slice(0,80),sender:String(mail.sender||'연합 사령부').slice(0,60),body:String(mail.body||'새 소식이 도착했습니다.').slice(0,2000),createdAt:count(mail.createdAt)||Date.now(),rewards:mailRewards(mail),readAt:null,claimedAt:null});
    if(!saveMails(mails))return false;
    window.dispatchEvent(new Event('captain-mail-updated'));
    return true;
  };
  function ensureWelcomeMail(){
    if(readMails().some(mail=>mail.id==='welcome-gift-2026-01'))return;
    window.deliverCaptainMail({id:'welcome-gift-2026-01',title:'함대에 오신 것을 환영합니다',sender:'연합 사령부',body:'지휘관님, 전선에 합류해 주셔서 감사합니다. 아래 보급품을 수령해 함대를 정비하고 작전을 시작하세요.',rewards:{gold:10000,thorium:1000,scoutTron:20,researchStaff:20}});
  }
  const claimMailReward=id=>{
    const mails=readMails(),mail=mails.find(entry=>entry.id===id),rewards=mailRewards(mail||{});
    if(!mail||mail.claimedAt||!Object.keys(rewards).length)return false;
    const resources={...(window.gameResources||{}),...(read(RESOURCE_KEY)||{})};
    const loot={...(read(LOOT_KEY)||{})},research={...(read(RESEARCH_KEY)||{})};
    for(const [key,amount] of Object.entries(rewards)){
      if(key==='gold'||key==='thorium'||key==='lionToken')resources[key]=count(resources[key])+amount;
      else if(key==='journal')research.researchJournal=count(research.researchJournal)+amount;
      else if(key==='core')research.researchCore=count(research.researchCore)+amount;
      else loot[key]=count(loot[key])+amount;
    }
    mail.readAt=mail.readAt||Date.now();mail.claimedAt=Date.now();
    const entries=[[RESOURCE_KEY,resources],[LOOT_KEY,loot],[RESEARCH_KEY,research],[MAIL_KEY,mails]],previous=entries.map(([key])=>[key,localStorage.getItem(key)]);
    try{for(const [key,value] of entries)localStorage.setItem(key,JSON.stringify(value));}
    catch{for(const [key,value] of previous){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}}return false;}
    Object.assign(window.gameResources||(window.gameResources={}),resources);
    window.updateGameResourceHud?.();
    window.dispatchEvent(new Event('game-resources-updated'));
    window.dispatchEvent(new Event('captain-mail-updated'));
    window.dispatchEvent(new CustomEvent('captain-mail-claimed',{detail:{id}}));
    return true;
  };
  function paintMailDetail(id){
    const mails=readMails(),mail=mails.find(entry=>entry.id===id);if(!overlay||!mail)return;
    if(!mail.readAt){mail.readAt=Date.now();saveMails(mails);window.dispatchEvent(new Event('captain-mail-updated'));}
    window.dispatchEvent(new CustomEvent('captain-mail-opened',{detail:{id}}));
    const hasRewards=Object.keys(mailRewards(mail)).length>0;
    overlay.dataset.profileView='mail-detail';
    overlay.innerHTML=`<section class="captain-select-dialog captain-profile-dialog captain-mail-dialog" role="dialog" aria-modal="true" aria-labelledby="captain-mail-title"><header><div><small>COMMANDER INBOX</small><h2 id="captain-mail-title">받은 메일</h2></div><button type="button" data-captain-close aria-label="닫기">×</button></header><article class="captain-mail-detail"><div class="captain-mail-letter-head"><span class="captain-mail-letter-icon" aria-hidden="true">${hasRewards?'✦':'✉'}</span><div><small>${escapeHtml(mail.sender||'연합 사령부')} · ${new Date(mail.createdAt||Date.now()).toLocaleDateString('ko-KR')}</small><h3>${escapeHtml(mail.title)}</h3></div></div><div class="captain-mail-letter-body"><p>${escapeHtml(mail.body).replace(/\n/g,'<br>')}</p></div>${rewardMarkup(mail)}${hasRewards?`<button type="button" class="captain-save captain-mail-claim" data-claim-mail ${mail.claimedAt?'disabled':''}>${mail.claimedAt?'보급품 수령 완료':'보급품 모두 수령'}</button>`:''}<button type="button" class="captain-mail-back" data-mail-back>‹ 메일 목록으로</button></article></section>`;
    overlay.querySelector('[data-mail-back]').onclick=()=>paintDialog('mail');
    overlay.querySelector('[data-claim-mail]')?.addEventListener('click',event=>{
      const items=[...overlay.querySelectorAll('.captain-mail-reward')].map(card=>({src:card.querySelector('img')?.src||'',amount:card.querySelector('strong')?.textContent||'',rect:card.querySelector('.captain-mail-reward-icon')?.getBoundingClientRect()})).filter(item=>item.src&&item.rect);
      if(claimMailReward(id)){paintMailDetail(id);animateClaimedRewards(items);window.notice?.('메일 보급품을 물자창고에 보관했습니다.');}
      else event.currentTarget.textContent='저장 실패 · 다시 시도';
    });
  }
  function mailListMarkup(){
    const mails=readMails();
    const unread=unreadMailCount();
    return `<div class="captain-mail-list"><div class="captain-mail-list-heading"><div><strong>받은 메일</strong><small>연합 사령부에서 보낸 소식과 보급품</small></div><span>${unread?`새 메일 ${format(unread)}건`:'모두 확인함'}</span></div>${mails.length?mails.map(mail=>{const hasRewards=Object.keys(mailRewards(mail)).length>0;const status=mail.claimedAt?'수령 완료':hasRewards?'보급품':'공지';return `<button type="button" class="captain-mail-row${mail.readAt?'':' unread'}" data-mail-open="${escapeHtml(mail.id)}"><span class="captain-mail-row-icon" aria-hidden="true">${hasRewards?'✦':'✉'}</span><span class="captain-mail-row-main"><span class="captain-mail-row-top"><b>${escapeHtml(mail.title)}</b>${!mail.readAt?'<i class="captain-mail-new">!</i>':''}</span><small>${escapeHtml(mail.sender||'연합 사령부')} · ${new Date(mail.createdAt||Date.now()).toLocaleDateString('ko-KR')}</small></span><em class="${mail.claimedAt?'claimed':''}">${status}<span aria-hidden="true">›</span></em></button>`;}).join(''):'<p class="captain-mail-empty">도착한 메일이 없습니다.</p>'}</div>`;
  }
  const persistTotal=()=>{try{localStorage.setItem(TOTAL_KEY,JSON.stringify({earned:total}));}catch{}};
  // Only successful acquisitions count; refunds and spending do not change the lifetime total.
  window.recordLionTokensEarned=amount=>{total+=count(amount);persistTotal();render();};
  const portrait=(character)=>`<span class="captain-portrait"><img src="${characters[character]}" alt="${character} 초상화" /></span>`;
  function render(){
    if(!hud)return;
    const character=profile.character;
    const fullName=`Capt. ${character}${profile.lastName?' '+profile.lastName:''}`;
    hud.querySelector('.captain-portrait img').src=characters[character];
    hud.querySelector('.captain-portrait img').alt=`${character} 초상화`;
    hud.querySelector('.captain-name').textContent=profile.lastName?fullName:`Capt. ${character} · 성 설정`;
    const profileButton=hud.querySelector('.captain-profile-open');
    profileButton.setAttribute('aria-label',`${fullName} · 함장 프로필 열기`);
    profileButton.disabled=false;
    profileButton.classList.remove('is-locked');
    const portraitNode=profileButton.querySelector('.captain-portrait');
    let mailAlert=portraitNode.querySelector('.captain-mail-alert');
    if(unreadMailCount()>0&&!mailAlert){mailAlert=document.createElement('span');mailAlert.className='captain-mail-alert';mailAlert.setAttribute('aria-label','읽지 않은 메일');mailAlert.textContent='!';portraitNode.append(mailAlert);}
    else if(unreadMailCount()===0)mailAlert?.remove();
    const rank={R:1,SR:2,SSR:3,L:4};
    const owned=window.getOwnedFleetVariants?.()||[];
    const best=owned.reduce((a,b)=>!a||(rank[b.rarity]||0)>(rank[a.rarity]||0)||((rank[b.rarity]||0)===(rank[a.rarity]||0)&&count(b.stars)>count(a.stars))?b:a,null);
    const fleet=hud.querySelector('[data-captain-fleet]');
    fleet.textContent=best?.name||'미보유';
    fleet.dataset.rarity=best?.rarity||'';
    fleet.parentElement.title=best?`최고등급 보유 함선 · ${best.name}`:'보유 함선 없음';
    const research=window.getCommanderResearchSummary?.()||[];
    const bestResearch=research[0];
    const weapon=hud.querySelector('[data-captain-weapon]');
    weapon.innerHTML=bestResearch?`<span class="captain-field-badge" title="${bestResearch.name} 연구">${bestResearch.badge||bestResearch.icon}</span><b>${bestResearch.stage}단계</b>`:'<span class="captain-field-none">—</span>';
    weapon.title=bestResearch?`${bestResearch.name} · ${bestResearch.node} ${bestResearch.stage}단계`:'무기 미개발';
    hud.querySelector('[data-captain-total]').textContent=`증표 ${format(total)}`;
    const balances=window.gameResources||{};
    hud.querySelectorAll('[data-captain-balance]').forEach(element=>{element.textContent=format(balances[element.dataset.captainBalance]);});
    const loot=window.getExplorationLootInventory?.()||{};
    hud.querySelectorAll('[data-captain-loot]').forEach(element=>{element.textContent=format(loot[element.dataset.captainLoot]);});
  }
  function close(){const previous=overlay?.opener;overlay?.remove();overlay=null;previous?.focus();window.dispatchEvent(new Event('captain-profile-closed'));}
  function paintDialog(view='profile'){
    if(!overlay)return;
    overlay.dataset.profileView=view;
    delete overlay.dataset.settingsActive;
    if(view==='settings'){window.openCaptainSettings(overlay,()=>paintDialog('profile'));return;}
    const character=profile.character,fullName=`Capt. ${character}${profile.lastName?' '+profile.lastName:''}`;
    if(view==='edit'){
      overlay.innerHTML=`<form class="captain-select-dialog" role="dialog" aria-modal="true" aria-labelledby="captain-select-title"><header><div><small>UNITED STAR FLEET</small><h2 id="captain-select-title">플레이어 네임 변경</h2></div><button type="button" data-captain-close aria-label="닫기">×</button></header><div class="captain-edit-identity">${portrait(character)}<strong>Capt. ${character}</strong></div><label for="captain-last-name">성 (Last name)</label><input id="captain-last-name" name="lastName" maxlength="16" required placeholder="성을 입력하세요" autocomplete="off" /><div class="captain-name-preview" aria-live="polite"></div><p class="captain-input-hint">한글·영문·숫자, 공백·하이픈·작은따옴표 · 최대 16자</p><div class="captain-form-error" role="alert"></div><button class="captain-save" type="submit">변경 저장</button></form>`;
      const input=overlay.querySelector('input');input.value=profile.lastName;
      const preview=()=>{overlay.querySelector('.captain-name-preview').textContent=`Capt. ${character} ${input.value.trim()||'플레이어 네임'}`;};
      preview();input.addEventListener('input',preview);
      overlay.querySelector('form').addEventListener('submit',event=>{
        event.preventDefault();const lastName=input.value.trim().replace(/\s+/g,' ');
        if(!/^[\p{L}\p{N} '-]{1,16}$/u.test(lastName)){overlay.querySelector('.captain-form-error').textContent='성을 1~16자로 입력해주세요.';input.focus();return;}
        const next={character,lastName};
        try{localStorage.setItem(PROFILE_KEY,JSON.stringify(next));}catch{overlay.querySelector('.captain-form-error').textContent='설정을 저장할 수 없습니다. 다시 시도해주세요.';return;}
        profile=next;profileLocked=true;render();paintDialog('profile');
      });
      input.focus();return;
    }
    const resourceCount=count((window.gameResources||{}).lionToken);
    const content=view==='mail'?mailListMarkup()
      :view==='membership'?`<div class="captain-info-view"><span class="captain-info-icon">✦</span><strong>Membership</strong><p class="captain-membership-state">${resourceCount>0?'거래 자격 보유':'사자증표가 있어야 거래할 수 있습니다.'}</p><div class="captain-membership-balance"><img src="icons/lion-token.png" alt="" />사자증표 <b>${format(resourceCount)}개</b></div><button type="button" class="captain-save" data-open-membership>Membership Service 열기</button></div>`
      :`<div class="captain-profile-summary">${portrait(character)}<div><small>COMMANDER DOSSIER</small><div class="captain-edit-name"><strong>${fullName}</strong><button type="button" class="captain-pencil" data-edit-name aria-label="이름 변경">✎</button></div><span>연합 함대 · 함장</span><em class="captain-clearance">UNITED STAR FLEET</em></div></div><div class="captain-profile-stats"><div><small>보유 함선</small><b>${format((window.getOwnedFleetVariants?.()||[]).length)}<em>척</em></b></div><div><small>누적 획득 사자증표</small><b>${format(total)}<em>개</em></b></div></div><div class="captain-profile-actions"><button type="button" data-profile-view="settings"><span>⚙</span><b>설정</b><small>SYSTEM</small></button><button type="button" class="captain-profile-mail-button" data-profile-view="mail" ${unreadMailCount()?`aria-label="메일 · 읽지 않은 메일 ${format(unreadMailCount())}건"`:''}><span>✉</span><b>메일</b><small>INBOX</small>${unreadMailCount()?'<i class="captain-profile-mail-alert" aria-hidden="true">!</i>':''}</button><button type="button" data-profile-view="membership"><span>✦</span><b>Membership</b><small>MEMBER SERVICE</small></button></div>`;
    overlay.innerHTML=`<section class="captain-select-dialog captain-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="captain-select-title"><header><div><small>UNITED STAR FLEET</small><h2 id="captain-select-title">${view==='profile'?'함장 프로필':view==='settings'?'설정':view==='mail'?'메일함':'Membership'}</h2></div><button type="button" data-captain-close aria-label="닫기">×</button></header>${content}</section>`;
    overlay.querySelector('[data-edit-name]')?.addEventListener('click',()=>paintDialog('edit'));
    overlay.querySelectorAll('[data-profile-view]').forEach(button=>button.addEventListener('click',()=>paintDialog(button.dataset.profileView)));
    overlay.querySelectorAll('[data-mail-open]').forEach(button=>button.addEventListener('click',()=>paintMailDetail(button.dataset.mailOpen)));
    overlay.querySelector('[data-open-membership]')?.addEventListener('click',()=>{close();window.openAlienShop?.('featured');setTimeout(()=>document.querySelector('.alien-shop-token-stall')?.scrollIntoView({behavior:'smooth',block:'center'}),80);});
    overlay.querySelector('[data-captain-close]')?.focus();
  }
  function open(){
    if(overlay)return;
    overlay=document.createElement('div');overlay.className='captain-select-overlay';overlay.opener=document.activeElement;
    document.body.append(overlay);
    overlay.addEventListener('click',event=>{
      if(event.target===overlay){
        if(profileLocked&&(overlay.dataset.settingsActive==='true'||overlay.dataset.profileView!=='profile'))paintDialog('profile');
        else close();
        return;
      }
      if(event.target.closest('[data-captain-close]')){
        if(overlay.dataset.settingsActive==='true')return;
        if(overlay.dataset.profileView==='mail-detail'){paintDialog('mail');return;}
        if(profileLocked&&overlay.dataset.profileView!=='profile')paintDialog('profile');
        else close();
      }
    });
    overlay.addEventListener('keydown',event=>{
      if(event.key==='Escape'){
        event.preventDefault();
        if(overlay.dataset.settingsActive==='true')overlay.querySelector('[data-captain-close]')?.click();
        else if(profileLocked&&overlay.dataset.profileView!=='profile')paintDialog('profile');
        else close();
        return;
      }
      if(event.key==='Tab'){
        const controls=[...overlay.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter(node=>node.getClientRects().length);
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    });
    paintDialog(profileLocked?'profile':'setup');
    if(!profileLocked){
      const character=profile.character;
      overlay.innerHTML=`<form class="captain-select-dialog" role="dialog" aria-modal="true" aria-labelledby="captain-select-title"><header><div><small>UNITED STAR FLEET</small><h2 id="captain-select-title">함장 프로필</h2></div><button type="button" data-captain-close aria-label="닫기">×</button></header><p>당신의 함장을 선택하세요.</p><div class="captain-candidates" role="group" aria-label="주인공 선택">${Object.keys(characters).map(name=>`<button type="button" data-character="${name}" aria-pressed="${name===character}">${portrait(name)}<strong>${name}</strong><small>FLEET CAPTAIN</small></button>`).join('')}</div><label for="captain-last-name">플레이어 네임 · 성 (Last name)</label><input id="captain-last-name" name="lastName" maxlength="16" required placeholder="성을 입력하세요" autocomplete="off" /><div class="captain-name-preview" aria-live="polite"></div><p class="captain-input-hint">한글·영문·숫자, 공백·하이픈·작은따옴표 · 최대 16자</p><div class="captain-form-error" role="alert"></div><button class="captain-save" type="submit">함장 설정 완료</button></form>`;
      let selected=character;const input=overlay.querySelector('input');input.value=profile.lastName;
      const preview=()=>{overlay.querySelector('.captain-name-preview').textContent=`Capt. ${selected} ${input.value.trim()||'플레이어 네임'}`;};preview();input.addEventListener('input',preview);
      overlay.addEventListener('click',event=>{const candidate=event.target.closest('[data-character]');if(candidate){selected=candidate.dataset.character;overlay.querySelectorAll('[data-character]').forEach(button=>button.setAttribute('aria-pressed',String(button===candidate)));preview();}});
      overlay.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const lastName=input.value.trim().replace(/\s+/g,' ');if(!/^[\p{L}\p{N} '-]{1,16}$/u.test(lastName)){overlay.querySelector('.captain-form-error').textContent='성을 1~16자로 입력해주세요.';input.focus();return;}const next={character:selected,lastName};try{localStorage.setItem(PROFILE_KEY,JSON.stringify(next));}catch{overlay.querySelector('.captain-form-error').textContent='설정을 저장할 수 없습니다. 다시 시도해주세요.';return;}profile=next;profileLocked=true;render();paintDialog('profile');window.dispatchEvent(new Event('captain-profile-created'));});
      input.focus();
    }
  }
  window.openCaptainMailbox=()=>{if(!overlay)open();if(overlay)paintDialog('mail');};
  window.closeCaptainProfile=close;
  window.addEventListener('DOMContentLoaded',()=>{
    hud=document.querySelector('#persistent-hud .fixed-top');if(!hud)return;
    const balances=window.gameResources||(window.gameResources={gold:0,thorium:0,lionToken:0});
    if(!window.__inventoryBalancesHydrated){Object.assign(balances,read(RESOURCE_KEY)||{});window.__inventoryBalancesHydrated=true;}
    total=Math.max(total,count(balances.lionToken));persistTotal();
    hud.classList.add('captain-hud');
    hud.innerHTML=`<button type="button" class="captain-profile-open" aria-label="함장 프로필">${portrait(profile.character)}<span class="captain-profile-copy"><strong class="captain-name"></strong><span class="captain-credentials"><span class="captain-ship-line" title="보유 최고등급 함선"><span data-captain-fleet></span><span class="captain-weapon-stage" data-captain-weapon></span></span><span class="captain-lifetime" title="누적 획득 사자증표 · 소비해도 유지됩니다"><img src="icons/lion-token.png" alt="" /><b data-captain-total>증표 0</b></span></span></span></button><div class="captain-balances alien-shop-balances" aria-label="보유 자원"><span class="captain-drone-balance" title="탐색드론"><img src="icons/scout-drone.png" alt="탐색드론" /><b data-captain-loot="scoutTron">0</b></span><span class="captain-gold-balance" title="골드"><img src="gold-resource-icon.svg" alt="골드" /><b data-captain-balance="gold">0</b></span><span class="captain-precision-drone-balance" data-item-id="precisionScoutDrone" title="정밀탐색드론 · 추후 함종별 함선 탐색에 사용"><img src="${PRECISION_SCOUT_DRONE_ICON}" alt="정밀탐색드론" /><b>0</b></span><span class="captain-thorium-balance" title="토륨"><img src="thorium-crystal-icon.png" alt="토륨" /><b data-captain-balance="thorium">0</b></span><span class="captain-staff-balance" title="연구인력"><img src="icons/research-personnel-20261002.png" alt="연구인력" /><b data-captain-loot="researchStaff">0</b></span><span class="captain-token-balance" title="사자증표"><img src="icons/lion-token.png" alt="사자증표" /><b data-captain-balance="lionToken">0</b></span></div>`;
    hud.querySelector('.captain-profile-open').addEventListener('click',open);
    ensureWelcomeMail();
    const oldUpdate=window.updateGameResourceHud;
    window.updateGameResourceHud=()=>{oldUpdate?.();render();};
    ['game-resources-updated','fleet-ownership-updated','commander-research-updated','tactical-research-updated'].forEach(event=>window.addEventListener(event,render));
    window.addEventListener('captain-mail-updated',()=>{render();if(overlay?.dataset.profileView==='mail'||overlay?.dataset.profileView==='profile')paintDialog(overlay.dataset.profileView);});
    window.addEventListener('storage',event=>{if(event.key===TOTAL_KEY)total=count(read(TOTAL_KEY)?.earned);render();if(event.key===MAIL_KEY&&(overlay?.dataset.profileView==='mail'||overlay?.dataset.profileView==='profile'))paintDialog(overlay.dataset.profileView);});
    render();
    if(!profileLocked)open();
  });
})();
