(()=>{
  'use strict';
  // 기본적으로 튜토리얼을 진행합니다. 개발 중 건너뛰려면 주소 뒤에 ?tutorial=0 을 붙이세요.
  if(new URLSearchParams(location.search).get('tutorial')==='0')return;
  const KEY='starfleet-eva9-tutorial-v1';
  const FARAH_KEY='starfleet-farah-tutorial-v1';
  const MAIL_KEY='starfleet-captain-mail-v1';
  const LOOT_KEY='starfleet-exploration-loot-v1';
  const RESOURCE_KEY='starfleet-game-resources-v1';
  const PROFILE_KEY='starfleet-commander-profile-v1';
  const SUPPORT_MAIL='eva9-research-support-v1';
  const COMPLETION_MAIL='eva9-research-completion-v1';
  const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}};
  const count=value=>Math.max(0,Math.floor(Number(value)||0));
  let state={step:'',mailId:'',dialogueCollapsed:false,...(read(KEY)||{})};
  let panel,chip;
  const active=()=>!!state.step&&state.step!=='complete';
  const farahFinished=()=>read(FARAH_KEY)?.step==='complete'&&count(read('planet-campaign-v1')?.mars)>=5;
  const playerName=()=>{const profile=read(PROFILE_KEY)||{};return [profile.character,profile.lastName].filter(Boolean).join(' ')||'신임';};
  const mailList=()=>Array.isArray(read(MAIL_KEY))?read(MAIL_KEY):[];
  const unclaimed=mail=>mail&&!mail.claimedAt&&Object.values(mail.rewards||{}).some(value=>count(value)>0);
  const pendingIds=()=>mailList().filter(unclaimed).map(mail=>mail.id);
  const pendingMail=()=>mailList().find(mail=>mail.id===state.mailId&&unclaimed(mail))||mailList().find(mail=>mail.id==='farah-mars-5-congratulations-v1'&&unclaimed(mail))||mailList().find(mail=>mail.id==='welcome-gift-2026-01'&&unclaimed(mail))||mailList().find(unclaimed);
  const inventory=()=>({...(read(LOOT_KEY)||{}),...(window.getExplorationLootInventory?.()||{})});
  const resources=()=>({...(read(RESOURCE_KEY)||{}),...(window.gameResources||{})});
  const ensureMailSupplies=()=>{
    const available=pendingMail(),loot=inventory(),balance=resources(),rewards=available?.rewards||{};
    const shortage={scoutTron:Math.max(0,10-count(loot.scoutTron)-count(rewards.scoutTron)),researchStaff:Math.max(0,10-count(loot.researchStaff)-count(rewards.researchStaff)),gold:Math.max(0,1000-count(balance.gold)-count(rewards.gold))};
    if(Object.values(shortage).some(Boolean)&&!mailList().some(mail=>mail.id===SUPPORT_MAIL)){
      const support={scoutTron:Math.max(0,10-count(loot.scoutTron)),researchStaff:Math.max(0,10-count(loot.researchStaff)),gold:Math.max(0,1000-count(balance.gold))};
      window.deliverCaptainMail?.({id:SUPPORT_MAIL,title:'EVA-9 · 연구실 실습 보급',sender:'EVA-9 · 연구실 운영관',body:'전함 탐색과 전술무기 연구 실습에 필요한 부족분을 보급합니다.',rewards:support});
    }
    const selected=mailList().find(mail=>mail.id===SUPPORT_MAIL&&unclaimed(mail))||pendingMail();
    state.mailId=selected?.id||'';save();
    return selected;
  };
  const lines={
    intro:()=>({title:'EVA-9 · 연구실 안내',body:pendingMail()?`안녕하세요, ${playerName()} 함장님. 연구실 관련 안내를 해드리겠습니다. 먼저 메일을 확인하고 보급품을 수령하세요.`:`안녕하세요, ${playerName()} 함장님. 보급품은 이미 수령하셨군요. 연구실 관련 안내를 해드리겠습니다.`,action:pendingMail()?'메일 확인하기':'연구실 안내 시작'}),
    profileOpen:()=>({title:'함장 프로필',body:'화면의 함장 프로필 사진을 누르세요.'}),
    mailOpen:()=>({title:'메일함',body:'함장 프로필에서 메일 버튼을 선택하세요.'}),
    mailSelect:()=>({title:'보급 메일 확인',body:pendingIds().length>1?`보급품이 첨부된 메일을 모두 열어 수령하세요. 남은 메일은 ${pendingIds().length}통입니다.`:'보급품이 첨부된 메일을 열어 주세요.'}),
    mailClaim:()=>({title:'보급품 수령',body:'메일에 첨부된 보급품을 모두 수령하세요.'}),
    mailNext:()=>({title:'다음 메일 확인',body:`수령하지 않은 보급 메일이 ${pendingIds().length}통 더 있습니다. [메일 목록으로] 버튼을 눌러주세요.`}),
    labPrompt:()=>({title:'연구실로 이동',body:'연구실로 이동하겠습니다.',action:'연구실로 이동'}),
    explore10a:()=>({title:'전함 탐색',body:'함대가 강해지기 위해선 함선이 많이 필요합니다. 탐색드론을 보내서 함선을 찾게 할 수 있습니다.',action:'다음'}),
    explore10:()=>({title:'전함 탐색',body:'보급받은 드론으로 10회 탐색을 하겠습니다.'}),
    exploreConfirm:()=>({title:'탐색 확인',body:'탐색드론 10대를 보내는 것을 확정해 주세요.'}),
    exploreResult:()=>({title:'탐색 결과 확인',body:'발견한 함선과 보급품을 확인하세요. 마지막 결과까지 본 뒤 돌아가기를 누르세요.'}),
    weaponTab:()=>({title:'전술무기 연구',body:'이번에는 전술무기연구를 알려드리겠습니다. 연구실의 무기 연구 탭을 누르세요.'}),
    weapon10:()=>({title:'10회 연구',body:'연구인력 10명을 투입하여 전술무기를 10회 연구해 보세요.'}),
    weaponResult:()=>({title:'연구 결과',body:'획득한 연구자료를 확인한 뒤 확인 버튼을 누르세요.'}),
    frigateOpen:()=>{const r=researchCounts();return {title:'프리깃 사용 개방',body:`연구에는 인력과 자원이 필요하죠. 연구를 통해 확보한 연구자료와 연구코어로 우리 함대의 무기와 방어체계를 강화할 수 있습니다. 현재 연구일지 ${r.journal}개, 범용연구코어 ${r.core}개를 가지고 있어요.`,action:'다음'};},
    frigateOpenDev:()=>({title:'프리깃 사용 개방',body:'먼저 중요한 전력인 프리깃 함선 사용을 개방 하겠습니다. 프리깃 칸의 [개발] 버튼을 누르세요.'}),
    frigateNode:()=>({title:'개발 항목 선택',body:'계통도에서 「프리깃 사용 개방」을 선택하세요.'}),
    frigateDevelop:()=>({title:'프리깃 개발',body:'「프리깃 사용 개방 개발」 버튼을 눌러 편성 슬롯을 여세요.'}),
    frigateClose:()=>({title:'개발 완료',body:'개발 창의 × 버튼을 눌러 연구실로 돌아가세요.'}),
    fleetNav:()=>({title:'함대관리로 이동',body:'이제 함대에 프리깃 함선을 증원할 수 있습니다. 아래 함대관리 버튼을 누르세요.'}),
    frigateSlot:()=>({title:'프리깃 슬롯',body:'편성 화면에서 프리깃 슬롯을 누르세요.'}),
    littleBoy:()=>({title:'리틀보이 출전',body:'엔지니어 Farah에게 받으신 리틀보이를 출전시키겠습니다. 목록에서 리틀보이를 선택하세요.'}),
    final:()=>({title:'연구실 안내 완료',body:'연구실은 함대 전력을 강화하는 데 핵심적인 역할을 하고 있습니다. 또 뵙겠습니다, 함장님.',action:'안내 완료'})
  };
  const setStep=step=>{state.step=step;save();paint();};
  // 연구일지와 범용연구코어 보유량 (연구실 저장값을 그대로 읽습니다)
  const researchCounts=()=>{try{const r=JSON.parse(localStorage.getItem('starfleet-tactical-weapon-research-v1')||'{}')||{};return {journal:Math.max(0,Math.floor(Number(r.researchJournal)||0)),core:Math.max(0,Math.floor(Number(r.researchCore)||0))};}catch{return {journal:0,core:0};}};
  const deliverCompletionGift=()=>window.deliverCaptainMail?.({id:COMPLETION_MAIL,title:'EVA-9 · 연구실 교육 완료 선물',sender:'EVA-9 · 연구실 운영관',body:'전함 탐색과 전술무기 연구 교육을 완료하셨습니다. 다음 함대 개발에 필요한 보급품을 보내드립니다.',rewards:{gold:2000,thorium:100,scoutTron:10,researchStaff:10}});
  const finish=()=>{deliverCompletionGift();setStep('complete');window.notice?.('EVA-9 연구실 튜토리얼을 마쳤습니다. 선물이 메일함에 도착했습니다.');window.dispatchEvent(new Event('eva9-tutorial-completed'));};
  const paint=()=>{
    if(!panel)return;
    const line=lines[state.step]?.();panel.hidden=!line;
    panel.classList.toggle('dialogue-collapsed',!!line&&!!state.dialogueCollapsed);
    chip.hidden=!line||!state.dialogueCollapsed;
    document.body.dataset.evaStep=line?state.step:'';
    if(!line)return;
    panel.dataset.step=state.step;
    document.querySelectorAll('[data-mail-open]').forEach(row=>row.classList.toggle('eva-mail-target',state.step==='mailSelect'&&pendingIds().includes(row.dataset.mailOpen)));
    panel.querySelector('[data-eva-title]').textContent=line.title;
    panel.querySelector('[data-eva-body]').textContent=line.body;
    const action=panel.querySelector('[data-eva-action]');action.hidden=!line.action;action.textContent=line.action||'';
    const toggle=panel.querySelector('[data-eva-portrait-toggle]');toggle.textContent='대화창 내리기';toggle.setAttribute('aria-expanded',String(!state.dialogueCollapsed));
  };
  const start=()=>{
    if(state.step||!farahFinished())return;
    ensureMailSupplies();
    window.show?.('home');
    setStep('intro');
  };
  const nextAfterMail=()=>{window.closeCaptainProfile?.();setStep('labPrompt');};
  const doAction=()=>{
    if(state.step==='intro'){
      if(ensureMailSupplies())setStep('profileOpen');else setStep('labPrompt');
    }else if(state.step==='labPrompt'){
      window.closeCaptainProfile?.();
      if(window.openResearchLab?.()!==false){window.summonTab?.('ship');setStep('explore10a');}
    }else if(state.step==='explore10a')setStep('explore10');
    else if(state.step==='frigateOpen')setStep('frigateOpenDev');
    else if(state.step==='final')finish();
  };
  const allowClick=target=>{
    if(target.closest('.eva9-tutorial,.eva9-tutorial-chip'))return true;
    if(state.step==='profileOpen')return !!target.closest('.captain-profile-open');
    if(state.step==='mailOpen')return !!target.closest('.captain-profile-mail-button');
    if(state.step==='mailSelect'){const row=target.closest('[data-mail-open]');return !!row&&pendingIds().includes(row.dataset.mailOpen);}
    if(state.step==='mailClaim')return !!target.closest('.captain-mail-claim');
    if(state.step==='mailNext')return !!target.closest('[data-mail-back]');
    if(state.step==='explore10')return !!target.closest('#ship-pool .summon-action.ten');
    if(state.step==='exploreConfirm')return !!target.closest('.ship-explore-confirm');
    if(state.step==='exploreResult')return !!target.closest('.ship-exploration-card-wrap,.ship-explore-return');
    if(state.step==='weaponTab')return !!target.closest('.research-tab[data-research="weapon"]');
    if(state.step==='weapon10')return !!target.closest('[data-tactical-pull="10"]');
    if(state.step==='weaponResult')return !!target.closest('.tactical-research-finish');
    if(state.step==='frigateOpenDev')return !!target.closest('[data-tactical-develop="frigate"]');
    if(state.step==='frigateNode')return !!target.closest('[data-branch-node="firepower1"]');
    if(state.step==='frigateDevelop')return !!target.closest('.tactical-tech-overlay .cannon-tech-action');
    if(state.step==='frigateClose')return !!target.closest('.tactical-tech-overlay .tactical-tech-close');
    if(state.step==='fleetNav')return !!target.closest('.fixed-nav [data-screen="collection"]');
    if(state.step==='frigateSlot')return !!target.closest('#collection [data-fleet-slot="3"]');
    if(state.step==='littleBoy')return !!target.closest('#collection .fleet-ship-choice[data-ship-name="리틀보이"]');
    return false;
  };
  const previousAllowsScreen=window.tutorialAllowsScreen;
  window.tutorialAllowsScreen=id=>{
    if(previousAllowsScreen&&!previousAllowsScreen(id))return false;
    if(!active())return true;
    if(['intro','profileOpen','mailOpen','mailSelect','mailClaim','mailNext','labPrompt'].includes(state.step))return id==='home'||id==='summon'&&state.step==='labPrompt';
    if(['fleetNav','frigateSlot','littleBoy','final'].includes(state.step))return id==='collection'||id==='summon'&&state.step==='fleetNav';
    return id==='summon';
  };
  document.addEventListener('click',event=>{
    if(!active()||allowClick(event.target))return;
    event.preventDefault();event.stopImmediatePropagation();window.notice?.('EVA-9의 현재 안내 단계를 먼저 완료해 주세요.');
  },true);
  document.addEventListener('click',event=>{
    if(!active())return;
    const target=event.target;
    if(state.step==='profileOpen'&&target.closest('.captain-profile-open'))setStep('mailOpen');
    else if(state.step==='mailOpen'&&target.closest('.captain-profile-mail-button'))setStep('mailSelect');
    else if(state.step==='mailNext'&&target.closest('[data-mail-back]'))setStep('mailSelect');
    else if(state.step==='explore10'&&target.closest('#ship-pool .summon-action.ten'))setStep('exploreConfirm');
    else if(state.step==='exploreResult'&&target.closest('.ship-explore-return'))setStep('weaponTab');
    else if(state.step==='weaponTab'&&target.closest('.research-tab[data-research="weapon"]'))setStep('weapon10');
    else if(state.step==='weaponResult'&&target.closest('.tactical-research-finish'))setStep('frigateOpen');
    else if(state.step==='frigateOpenDev'&&target.closest('[data-tactical-develop="frigate"]'))setStep('frigateNode');
    else if(state.step==='frigateNode'&&target.closest('[data-branch-node="firepower1"]'))setStep('frigateDevelop');
    else if(state.step==='frigateClose'&&target.closest('.tactical-tech-overlay .tactical-tech-close'))setStep('fleetNav');
    else if(state.step==='frigateSlot'&&target.closest('#collection [data-fleet-slot="3"]'))setStep('littleBoy');
  });
  window.addEventListener('captain-mail-opened',event=>{if(state.step==='mailSelect'&&pendingIds().includes(event.detail?.id)){state.mailId=event.detail.id;setStep('mailClaim');}});
  window.addEventListener('captain-mail-claimed',event=>{if(state.step==='mailClaim'&&event.detail?.id===state.mailId){if(pendingIds().length)setStep('mailNext');else nextAfterMail();}});
  window.addEventListener('ship-exploration-completed',event=>{if(state.step==='exploreConfirm'&&Number(event.detail?.count)===10)setStep('exploreResult');});
  // 10회 연구 단계에서는 [10회 연구] 버튼에 광택 효과를 줘서 찾기 쉽게 합니다.
  let shineTarget=null;
  setInterval(()=>{
    const target=state.step==='weapon10'?document.querySelector('[data-tactical-pull="10"]'):null;
    if(target===shineTarget)return;
    shineTarget?.classList.remove('eva9-shine');
    shineTarget=target;
    target?.classList.add('eva9-shine');
  },400);
  window.addEventListener('weapon-research-completed',event=>{if(state.step==='weapon10'&&Number(event.detail?.count)===10)setStep('weaponResult');});
  window.addEventListener('tactical-research-updated',event=>{if(state.step==='frigateDevelop'&&event.detail?.field==='frigate'&&Number(event.detail?.level)>=1)setStep('frigateClose');});
  window.addEventListener('game-screen-changed',event=>{if(state.step==='fleetNav'&&event.detail?.screen==='collection')setStep('frigateSlot');});
  window.addEventListener('fleet-slot-assigned',event=>{if(state.step==='littleBoy'&&event.detail?.slot===3&&event.detail?.ship==='리틀보이')setStep('final');});
  window.addEventListener('farah-tutorial-completed',()=>setTimeout(start,0));
  window.addEventListener('campaign-gate-cleared',()=>setTimeout(start,0));
  window.addEventListener('DOMContentLoaded',()=>{
    panel=document.createElement('aside');panel.className='eva9-tutorial';panel.hidden=true;panel.setAttribute('aria-label','EVA-9 연구실 튜토리얼');
    panel.innerHTML='<img src="eva9-tutorial-bust.png" alt="EVA-9 흉상"/><div class="eva9-dialogue"><div class="eva9-dialogue-head"><small>SYNTHETIC OPERATOR · EVA-9</small><button type="button" data-eva-portrait-toggle aria-expanded="true">대화창 내리기</button></div><strong data-eva-title></strong><p data-eva-body></p><div class="eva9-actions"><button type="button" data-eva-action hidden></button></div></div>';
    chip=document.createElement('button');chip.type='button';chip.className='eva9-tutorial-chip';chip.textContent='튜토리얼 보기';chip.hidden=true;chip.setAttribute('aria-label','EVA-9 튜토리얼 보기');
    document.body.append(panel,chip);
    panel.querySelector('[data-eva-action]').onclick=doAction;
    panel.querySelector('[data-eva-portrait-toggle]').onclick=()=>{state.dialogueCollapsed=true;save();paint();};
    chip.onclick=()=>{state.dialogueCollapsed=false;save();paint();};
    if(state.step==='exploreConfirm')state.step='explore10';
    if(state.step==='exploreResult')state.step='weaponTab';
    if(state.step==='weaponResult')state.step='frigateOpen';
    if(['frigateNode','frigateDevelop','frigateClose'].includes(state.step))state.step='frigateOpen';
    if(['mailOpen','mailSelect','mailClaim','mailNext'].includes(state.step)){
      const mail=pendingMail();state.mailId=mail?.id||'';state.step=mail?'profileOpen':'labPrompt';
    }
    if(state.step==='littleBoy')state.step=window.getFleetAssignments?.()[3]?.name==='리틀보이'?'final':'frigateSlot';
    save();paint();
    if(state.step==='complete')deliverCompletionGift();
    setTimeout(()=>{
      if(!state.step){start();return;}
      if(!active())return;
      if(['explore10a','explore10','weaponTab','weapon10','frigateOpen','frigateOpenDev'].includes(state.step))window.openResearchLab?.();
      if(['frigateSlot','littleBoy','final'].includes(state.step))window.openFleetManagement?.();
    },120);
  });
})();

