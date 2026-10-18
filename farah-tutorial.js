(()=>{
  'use strict';
  // 기본적으로 튜토리얼을 진행합니다. 개발 중 건너뛰려면 주소 뒤에 ?tutorial=0 을 붙이세요.
  if(new URLSearchParams(location.search).get('tutorial')==='0')return;
  const KEY='starfleet-farah-tutorial-v1',SHIPS={1:'아틀라스',2:'우라노스',3:'리틀보이',4:'스타 크루저'};
  const COLLAPSED_KEY='starfleet-farah-dialogue-collapsed-v1';
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{return {};}};
  let state={grants:{},step:'',...read()};state.grants=state.grants||{};
  let dialogueCollapsed=false;
  try{dialogueCollapsed=localStorage.getItem(COLLAPSED_KEY)==='true';}catch{}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}};
  const active=()=>!!state.step&&state.step!=='complete';
  // 하단 버튼을 눌러야 하는 단계: 함대관리·함교 메뉴, 출격, 전투 개시
  const TOP_STEP=/^(fleetNav|home[1-5]|sortie[1-5]|prep[1-5]|combat[1-5])$/;
  // 눌러야 할 버튼 위치 (깜빡이는 테두리로 강조)
  const targetFor=()=>{
    const step=state.step;
    if(step==='fleetNav')return '.fixed-nav button[data-screen="collection"]';
    if(step==='chooseSlot')return '#collection [data-fleet-slot="1"]';
    if(step==='chooseShip')return '#collection .fleet-ship-choice[data-ship-name="스타 크루저"]';
    if(/^home[1-5]$/.test(step))return '.fixed-nav button[data-screen="home"]';
    if(/^sortie[1-5]$/.test(step))return '#home .deck-launch';
    if(/^prep[1-5]$/.test(step))return '#battle-start';
    return '';
  };
  let highlighted=null;
  const highlight=()=>{
    const selector=active()?targetFor():'';
    const el=selector?document.querySelector(selector):null;
    if(el===highlighted)return;
    highlighted?.classList.remove('farah-target-pulse');
    highlighted=el;
    el?.classList.add('farah-target-pulse');
  };
  setInterval(highlight,400);
  const profileReady=()=>{try{const p=JSON.parse(localStorage.getItem('starfleet-commander-profile-v1')||'{}');return !!(p.character&&p.lastName?.trim());}catch{return false;}};
  let panel,reveal,chip,currentMood='';
  if(state.step&&state.version!==2){
    const old=state.step,map={welcome:'reveal',formation:'fleetNav',formationReady:'chooseSlot',start:'sortie1',gate1:'gate1Won',start2:'home2',gate2:'gate2Won',start3:'home3',gate3:'gate3Won',start4:'home4',enhance:'enhance',enhanced:'home5',mail:'final',labShip:'complete',explore:'complete',weapon:'complete',done:'complete'};
    state.step=map[old]||old;state.version=2;save();
  }
  const lines={
    profile:{mood:'confident',title:'새 함장과의 만남',body:'어? 새로 배치된 함장이야? 반가워! 나는 Farah 라고 해, 너는?'},
    intro:{mood:'confident',title:'첫 함선 · 스타 크루저',body:'너의 첫 함선이야, 멋진 녀석이지! 마침 화성에서 무슨일이 난 것 같던데, 가서 준비하자.',action:'좋아, 준비하자'},
    fleetNav:{mood:'focused',title:'함대관리로 이동',body:'아래 함대관리 버튼을 눌러 편성 화면으로 가자.'},
    chooseSlot:{mood:'focused',title:'좌익 편성',body:'좌익 슬롯을 눌러 스타 크루저를 배치해 줘.'},
    chooseShip:{mood:'focused',title:'스타 크루저 선택',body:'함선 목록에서 스타 크루저 카드를 선택해 좌익에 배치하자.'},
    gate1Won:{mood:'confident',title:'첫 승리',body:'잘했어! 아틀라스도 1대 보급됐어. 먼저 함대관리로 돌아가자.',action:'함대관리로 이동'},
    branch:{mood:'confident',title:'튜토리얼을 더 진행할까?',body:'이제 직접 둘러봐도 되고, 내가 화성 5관문과 함선 강화까지 계속 안내해도 돼.',action:'튜토리얼 계속',secondary:'괜찮아'},
    gate2Won:{mood:'confident',title:'2관문 완료',body:'우라노스가 합류했어. 함대관리에서 새 함선을 확인하고 다음 관문도 진행하자.',action:'함대관리로 이동'},
    gate3Won:{mood:'confident',title:'3관문 완료',body:'리틀보이를 받았어. 함대관리에서 확인한 다음 화성 4관문으로 가자.',action:'함대관리로 이동'},
    gate4Won:{mood:'confident',title:'4관문 완료',body:'스타 크루저를 한 대 더 받았어. 이제 함대관리에서 강화해 보자.',action:'함대관리로 이동'},
    enhance:{mood:'focused',title:'스타 크루저 강화',body:'격납고를 열고 스타 크루저를 선택한 뒤 강화를 완료해 줘. 같은 함선 한 대를 재료로 쓸 수 있어.'},
    final:{mood:'confident',title:'화성 기초 작전 완료',body:'수고했어, 여기 분위기가 살벌하네... 몸조심하고, 임무성공 축하 선물이 왔을거야, 메일 꼭 확인해봐. 나중에 보자고!',action:'고마워, Farah'}
  };
  for(let gate=1;gate<=5;gate++){
    lines[`home${gate}`]={mood:'focused',title:`화성 ${gate}관문 준비`,body:'아래 함교 버튼을 눌러 돌아가자.'};
    lines[`sortie${gate}`]={mood:'focused',title:`화성 ${gate}관문 출격`,body:'함교의 전선 출격 버튼을 눌러 다음 관문으로 이동해 줘.'};
    lines[`prep${gate}`]={mood:'focused',title:`화성 ${gate}관문 · 전투 준비`,body:'중앙의 전투개시 버튼을 눌러 줘. 전투는 함선이 자동으로 진행해.'};
    lines[`combat${gate}`]={mood:'focused',title:`화성 ${gate}관문 · 교전 중`,body:'함대가 교전 중이야. 전투 결과가 나올 때까지 지켜보자.'};
  }
  window.tutorialAllowsScreen=id=>{
    if(!active())return true;
    if(/^prep[1-5]$|^combat[1-5]$|^gate[1-4]Won$/.test(state.step))return id==='battle';
    if(['chooseSlot','chooseShip','branch','enhance','fleetTransit2','fleetTransit3'].includes(state.step))return id==='collection';
    if(/^home[1-5]$/.test(state.step))return id==='home';
    if(/^sortie[1-5]$/.test(state.step))return id==='home'||id==='map'||id==='battle';
    if(state.step==='fleetNav')return id==='collection';
    return id==='home';
  };
  window.tutorialAllowsGate=(chapter,region,gate)=>!active()||Number(chapter)===1&&region==='mars'&&['sortie','prep','combat'].some(prefix=>state.step===`${prefix}${gate}`);
  const paint=()=>{
    if(!panel||!reveal)return;
    document.body.classList.toggle('farah-profile-active',state.step==='profile');
    reveal.hidden=state.step!=='reveal';const line=lines[state.step];panel.hidden=!line;
    panel.classList.toggle('farah-collapsed',!!line&&dialogueCollapsed);
    // 눌러야 할 버튼이 화면 하단(함교·함대관리 메뉴, 출격·전투 버튼)에 있으면 패널을 상단으로 올려 버튼을 가리지 않게 합니다.
    panel.classList.toggle('farah-top',TOP_STEP.test(state.step));
    chip.hidden=!line||!dialogueCollapsed;
    if(!line)return;
    panel.dataset.step=state.step;
    const portrait=panel.querySelector('img');
    if(currentMood&&currentMood!==line.mood){portrait.classList.remove('farah-expression-change');void portrait.offsetWidth;portrait.src=`farah-nadir-${line.mood}.png`;portrait.classList.add('farah-expression-change');}
    else portrait.src=`farah-nadir-${line.mood}.png`;
    currentMood=line.mood;
    const portraitButton=panel.querySelector('[data-farah-portrait-toggle]');
    portraitButton.textContent='대화창 내리기';
    portraitButton.setAttribute('aria-expanded',String(!dialogueCollapsed));
    panel.querySelector('[data-farah-title]').textContent=line.title;
    panel.querySelector('[data-farah-body]').textContent=line.body;
    for(const [selector,label] of [['[data-farah-action]',line.action],['[data-farah-secondary]',line.secondary]]){const button=panel.querySelector(selector);button.hidden=!label;button.textContent=label||'';}
  };
  const setStep=step=>{state.step=step;state.version=2;save();paint();};
  const finish=()=>{const reachedMarsFive=state.step==='final';setStep('complete');window.notice?.('파라의 튜토리얼을 마쳤습니다.');if(reachedMarsFive){window.show?.('home');window.dispatchEvent(new Event('farah-tutorial-completed'));}};
  const grantGateShip=gate=>{
    const name=SHIPS[gate];if(!name||state.grants[gate])return true;
    const before=Number(window.getFleetCatalog?.().find(ship=>ship.name===name)?.copies)||0;
    window.acquireFleetShip?.(name);
    const after=Number(window.getFleetCatalog?.().find(ship=>ship.name===name)?.copies)||0;
    if(after<=before){window.notice?.(`${name} 보급을 저장하지 못했습니다.`);return false;}
    state.grants[gate]=true;save();return true;
  };
  const skipRemainingTutorial=()=>{
    // EVA-9 later requires Little Boy in the frigate slot. Skipping Farah must
    // preserve the same ship entitlement without granting duplicates on reload.
    if(!grantGateShip(2)||!grantGateShip(3))return;
    finish();
  };
  const deliverFinalGift=()=>window.deliverCaptainMail?.({id:'farah-mars-5-congratulations-v1',title:'화성 5관문 · 임무 성공 축하 선물',sender:'파라 나디르 · 수석 정비사',body:'첫 다섯 관문을 멋지게 돌파했어! 보급품을 챙기고 다음 출격도 조심해.',rewards:{gold:500,thorium:100,scoutTron:10,researchStaff:10}});
  const openFleet=next=>{setStep(next);window.openFleetManagement?.();};
  const doAction=()=>{
    if(state.step==='intro')setStep('fleetNav');
    else if(state.step==='gate1Won')openFleet('branch');
    else if(state.step==='branch')setStep('home2');
    else if(state.step==='gate2Won')openFleet('fleetTransit2');
    else if(state.step==='gate3Won')openFleet('fleetTransit3');
    else if(state.step==='gate4Won')openFleet('enhance');
    else if(state.step==='final')finish();
  };
  const allowClick=target=>{
    if(target.closest('.farah-tutorial,.farah-tutorial-chip,.farah-ship-reveal'))return true;
    const nav=target.closest('.fixed-nav button[data-screen]');
    if(state.step==='profile')return !!target.closest('.captain-select-overlay form')&&!target.closest('[data-captain-close]');
    if(state.step==='fleetNav')return nav?.dataset.screen==='collection';
    if(state.step==='chooseSlot')return !!target.closest('#collection [data-fleet-slot="1"]');
    if(state.step==='chooseShip')return !!target.closest('#collection .fleet-ship-choice[data-ship-name="스타 크루저"]');
    if(/^home[1-5]$/.test(state.step))return nav?.dataset.screen==='home';
    if(/^sortie[1-5]$/.test(state.step))return !!target.closest('#home .deck-launch');
    if(/^prep[1-5]$/.test(state.step))return !!target.closest('#battle-start');
    if(/^combat[1-5]$/.test(state.step))return !!target.closest('.battle-controls')||!!target.closest('#battle-result button')&&target.closest('#battle-result button').textContent.trim()==='재도전';
    // 성급 강화 연출(.ascend-overlay)은 아무 곳이나 눌러서 건너뛰거나 닫을 수 있어야 합니다.
    if(state.step==='enhance')return !!target.closest('#collection,#ship-detail-modal,.ship-upgrade-modal,.ship-enhancement-modal,.owned-library-sheet,#bulk-enhancement-result,.ascend-overlay');
    return false;
  };
  document.addEventListener('click',event=>{if(!active()||allowClick(event.target))return;event.preventDefault();event.stopImmediatePropagation();window.notice?.('파라의 현재 안내 단계를 먼저 완료해 주세요.');},true);
  document.addEventListener('keydown',event=>{if(state.step==='profile'&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();}},true);
  document.addEventListener('click',event=>{if(state.step==='chooseSlot'&&event.target.closest('#collection [data-fleet-slot="1"]'))setTimeout(()=>setStep('chooseShip'),0);});
  window.addEventListener('game-screen-changed',event=>{
    const screen=event.detail?.screen;
    if(state.step==='fleetNav'&&screen==='collection')setStep('chooseSlot');
    else if(state.step==='fleetTransit2'&&screen==='collection')setStep('home3');
    else if(state.step==='fleetTransit3'&&screen==='collection')setStep('home4');
    else if(/^home[1-5]$/.test(state.step)&&screen==='home')setStep(state.step.replace('home','sortie'));
    else if(/^sortie[1-5]$/.test(state.step)&&screen==='battle')setStep(state.step.replace('sortie','prep'));
  });
  window.addEventListener('fleet-slot-assigned',event=>{if(state.step==='chooseShip'&&event.detail?.slot===1&&event.detail?.ship==='스타 크루저')setStep(`home${Number(state.resumeGate)||1}`);});
  window.addEventListener('tutorial-battle-started',event=>{const gate=Number(event.detail?.operation?.gate);if(state.step===`prep${gate}`)setStep(`combat${gate}`);});
  window.addEventListener('campaign-gate-cleared',event=>{
    const {chapter,region,gate}=event.detail||{};
    if(chapter!==1||region!=='mars'||gate<1||gate>5||state.step!==`combat${gate}`)return;
    if(gate<=4&&!grantGateShip(gate))return;
    if(gate===5)deliverFinalGift();
    setTimeout(()=>setStep(gate===5?'final':`gate${gate}Won`),500);
  });
  window.addEventListener('fleet-enhancement-completed',event=>{
    if(state.step==='enhance'&&event.detail?.ship==='스타 크루저'){
      if((window.getFleetAssignments?.()||[]).some(Boolean))setStep('home5');
      else{state.resumeGate=5;setStep('chooseSlot');}
      setTimeout(()=>{const modal=document.querySelector('#ship-detail-modal');if(modal)modal.hidden=true;},0);
    }
  });
  window.addEventListener('captain-profile-created',()=>{window.closeCaptainProfile?.();setStep('reveal');});
  window.addEventListener('DOMContentLoaded',()=>{
    panel=document.createElement('aside');panel.className='farah-tutorial';panel.hidden=true;panel.setAttribute('aria-label','파라 나디르 튜토리얼');
    panel.innerHTML='<img src="farah-nadir-confident.png" alt="웃는 파라 나디르"/><div class="farah-dialogue"><div class="farah-dialogue-head"><small>CHIEF MECHANIC · FARAH NADIR</small><button type="button" data-farah-portrait-toggle aria-expanded="true">대화창 내리기</button></div><strong data-farah-title></strong><p data-farah-body></p><div class="farah-actions"><button type="button" data-farah-action hidden></button><button type="button" data-farah-secondary hidden></button></div></div>';
    chip=document.createElement('button');chip.type='button';chip.className='farah-tutorial-chip';chip.textContent='튜토리얼 보기';chip.hidden=true;chip.setAttribute('aria-label','파라 튜토리얼 보기');
    reveal=document.createElement('div');reveal.className='farah-ship-reveal';reveal.hidden=true;
    reveal.innerHTML='<div class="farah-ship-reveal-card" role="dialog" aria-modal="true" aria-labelledby="farah-ship-title"><small>FIRST FLEET ACQUIRED</small><div class="farah-reveal-art"><img src="battlecruiser-ship-art.png" alt="스타 크루저"/></div><h2 id="farah-ship-title">스타 크루저 획득</h2><p>첫 함선 · 0성</p><button type="button" data-farah-reveal-continue>함선 확인</button></div>';
    document.body.append(panel,chip,reveal);
    panel.querySelector('[data-farah-action]').onclick=doAction;
    panel.querySelector('[data-farah-secondary]').onclick=skipRemainingTutorial;
    panel.querySelector('[data-farah-portrait-toggle]').onclick=()=>{dialogueCollapsed=true;try{localStorage.setItem(COLLAPSED_KEY,'true');}catch{}paint();};
    chip.onclick=()=>{dialogueCollapsed=false;try{localStorage.setItem(COLLAPSED_KEY,'false');}catch{}paint();};
    reveal.querySelector('[data-farah-reveal-continue]').onclick=()=>setStep('intro');
    const image=window.getFleetCatalog?.().find(ship=>ship.name==='스타 크루저')?.image;if(image)reveal.querySelector('img').src=image;
    if(!state.step){state.step=profileReady()?'reveal':'profile';state.version=2;}
    if(/^prep[1-5]$|^combat[1-5]$/.test(state.step))state.step=`sortie${Number(state.step.match(/[1-5]/)?.[0])||1}`;
    if(state.step==='gate1Won')state.step='branch';
    if(state.step==='gate2Won')state.step='fleetTransit2';
    if(state.step==='gate3Won')state.step='fleetTransit3';
    if(state.step==='gate4Won')state.step='enhance';
    if(/^home[1-5]$/.test(state.step))state.step=state.step.replace('home','sortie');
    if(/^sortie[1-5]$/.test(state.step)&&!(window.getFleetAssignments?.()||[]).some(Boolean)){state.resumeGate=Number(state.step.match(/[1-5]/)?.[0])||1;state.step='chooseSlot';}
    if(state.step==='chooseShip'&&document.querySelector('#collection .formation-panel')?.hidden)state.step='chooseSlot';
    if(state.step==='profile'&&profileReady())state.step='reveal';
    save();paint();
    if(state.step==='complete'&&state.grants[1]&&(!state.grants[2]||!state.grants[3]))skipRemainingTutorial();
    if(['chooseSlot','branch','enhance','fleetTransit2','fleetTransit3'].includes(state.step))setTimeout(()=>window.openFleetManagement?.(),80);
  });
})();
