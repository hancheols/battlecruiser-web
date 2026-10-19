(()=>{
  'use strict';
  // 에바 튜토리얼이 끝난 뒤 처음 함교에 들어오면 루카가 등장해 상점·멤버십을 안내하고,
  // 연구실에서 탐색드론을 받은 뒤 군체지능과 SSR 보장 기능을 EVA-9가 안내합니다.
  const EVA_KEY='starfleet-eva9-tutorial-v1';
  const LUCA_KEY='starfleet-luca-tutorial-v1';
  const LOOT_KEY='starfleet-exploration-loot-v1';
  const DRONE_FLAG='starfleet-luca-drone-v1';
  const PROFILE_KEY='starfleet-commander-profile-v1';
  const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback;}catch{return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
  const isDonna=()=>read(PROFILE_KEY,{}).character==='Donna';
  const meName=()=>isDonna()?'도나':'제이크';
  const callName=()=>isDonna()?'루카 오빠':'루카';

  const SPEAKERS={
    luca:{label:()=>'루카 레예스',image:()=>'luca-reyes-bust.png'},
    me:{label:()=>meName(),image:()=>isDonna()?'captain-donna-scenario-bust.png':'captain-jake-scenario-bust.png'},
    eva:{label:()=>'EVA-9',image:()=>'eva9-tutorial-bust.png'}
  };

  // 루카 대화 (상점 방문 선물, 멤버십 버튼은 누르도록 유도)
  const LUCA_SCRIPT=[
    {who:'luca',text:()=>`야, ${meName()}!`},
    {who:'me',text:()=>`앗, ${callName()}! 여기 와 있었어?`},
    {who:'luca',text:'나도 온 지 얼마 안됐어.'},
    {who:'luca',text:'네가 여기로 배치 받았단 소식을 듣고 왔지.'},
    {who:'me',text:'사관학교 졸업하고 다신 못 볼 줄 알았는데... 정말 반갑다.'},
    {who:'luca',text:'난 여기서 정찰편대를 맡고 있어.'},
    {who:'luca',text:'아, 너 아르카 만나봤어?'},
    {who:'me',text:'이름은 들었는데, 그게 누구야?'},
    {who:'luca',text:'상점에 가보면 볼 수 있어. 물론, 직접 만나는 건 아니지만.'},
    {who:'luca',text:'방문만 해도 선물을 주는 좋은 사람...외계인... 이야',wait:'gift'},
    {who:'me',text:'정말이네! 아르카 장사 수완이 좋구나.'},
    {who:'luca',text:'하루에 한 번씩 와서 선물도 받고 값싸게 살 물건도 있나 살펴봐야 해.'},
    {who:'luca',text:'귀하신 분들은 저기도 가는데 엄청난 물건들을 파는 것 같더라고.',wait:'member'},
    {who:'luca',text:'우리는 들어가는 것 자체가 불가능하지만, 언젠가는 구경해 볼 수 있겠지.',forceHome:true},
    {who:'luca',text:'난 가봐야겠다.'},
    {who:'luca',text:'참, 내가 정찰다니면서 탐색드론을 주워올 때가 있어.'},
    {who:'luca',text:'연구실에 맡겨 놓을 테니 잘 쓰도록 해.'},
    {who:'luca',text:'하루에 한개 정도는 구할 수 있더라고'},
    {who:'me',text:()=>`정말? 고마워 ${callName()}`},
    {who:'luca',text:'그럼 나중에 보자.'}
  ];

  // 연구실 첫 방문 뒤: 탐색드론 안내 → 1회 탐색(무료) → 군체지능·SSR 보장 안내
  const DRONE_SCRIPT=[
    {who:'eva',text:'루카 함장님께서 탐색드론을 맡기고 가셨습니다.'},
    {silent:true,wait:'search'},
    {silent:true,wait:'overlay'},
    {who:'eva',text:'탐색드론은 군체지능 기능이 있어서 탐색을 반복할 때 마다 데이터를 누적합니다.'},
    {who:'eva',text:'그 결과 함장님이 원하시는 함선을 정확히 찾아 낼 수 있게 되죠.'},
    {who:'eva',text:'50회 탐색 할 때 마다 SSR급 함선을 찾도록 프로그램 했습니다.'},
    {who:'eva',text:'원하시는 함선을 미리 지정하시면 받으실 수 있으니 잘 활용하시기 바랍니다.',wait:'guarantee'}
  ];

  let luca=read(LUCA_KEY,{phase:'idle',index:0});
  let run=null;           // {list,index,onDone}
  let panel=null;
  let pulseEl=null;
  let popSeen=false;      // 멤버십 팝업을 열었는지
  let searchDone=false;   // 1회 탐색이 끝났는지
  let summonOpened=false; // 함선 탐색 탭을 열었는지
  const save=()=>write(LUCA_KEY,luca);
  const current=()=>run?.list[run.index];
  const visible=selector=>{const el=document.querySelector(selector);return el&&el.offsetParent!==null?el:null;};
  const evaDone=()=>read(EVA_KEY,{}).step==='complete';
  const homeVisible=()=>{const el=document.querySelector('#home');return !!el&&el.offsetParent!==null;};

  const setPulse=el=>{
    if(el===pulseEl){if(panel&&el)panel.classList.toggle('luca-top',el.getBoundingClientRect().top>innerHeight*0.5);return;}
    pulseEl?.classList.remove('farah-target-pulse','luca-shop-pulse');
    pulseEl=el;
    el?.classList.add('farah-target-pulse');
    // 상점 버튼은 더 크게 빛나도록 추가 효과를 준다.
    if(el?.getAttribute('aria-label')==='상점')el.classList.add('luca-shop-pulse');
    if(panel)panel.classList.toggle('luca-top',!!el&&el.getBoundingClientRect().top>innerHeight*0.5);
  };

  const paint=()=>{
    if(!panel)return;
    const item=current();
    if(!run||!item||item.silent){panel.hidden=true;return;}
    const speaker=SPEAKERS[item.who];
    const src=speaker.image();
    const img=panel.querySelector('img');
    if(img.getAttribute('src')!==src)img.setAttribute('src',src);
    panel.querySelector('[data-name]').textContent=speaker.label();
    panel.querySelector('[data-body]').textContent=typeof item.text==='function'?item.text():item.text;
    panel.querySelector('[data-next]').hidden=!!item.wait;
    panel.hidden=false;
  };

  const finishRun=()=>{const done=run;run=null;setPulse(null);paint();done?.onDone?.();};
  const advance=()=>{
    if(!run)return;
    popSeen=false;summonOpened=false;
    if(run.index<run.list.length-1){
      run.index+=1;
      if(run.list===LUCA_SCRIPT||run.list===DRONE_SCRIPT){luca.index=run.index;save();}
      paint();
    }else finishRun();
  };
  const onNext=()=>{
    const item=current();
    if(item?.forceHome)window.show?.('home');
    advance();
  };

  const startLuca=(index=0)=>{
    luca.phase='luca';luca.index=index;save();
    run={list:LUCA_SCRIPT,index,onDone:()=>{luca.phase='drone_pending';luca.index=0;save();}};
    paint();
  };

  const grantDrone=()=>{const loot=read(LOOT_KEY,{});loot.scoutTron=(Number(loot.scoutTron)||0)+1;write(LOOT_KEY,loot);};
  const startDrone=()=>{
    luca.phase='drone';luca.index=0;save();
    write(DRONE_FLAG,'1');   // 1회 무료 탐색 잠금 해제
    grantDrone();
    run={list:DRONE_SCRIPT,index:0,onDone:()=>{luca.phase='done';save();}};
    paint();
  };

  // 드론 안내 도중 새로고침한 경우 저장된 위치부터 이어서 진행합니다.
  const resumeDrone=()=>{
    const index=Math.min(Math.max(0,Number(luca.index)||0),DRONE_SCRIPT.length-1);
    run={list:DRONE_SCRIPT,index,onDone:()=>{luca.phase='done';save();}};
    paint();
  };

  // 진행 중인 단계의 대기 조건을 확인하고, 눌러야 할 요소를 강조합니다.
  const tick=()=>{
    if(!panel)return;
    if(!run){
      if(luca.phase==='idle'&&evaDone()&&homeVisible())startLuca(0);
      else if(luca.phase==='luca'&&!run)startLuca(luca.index||0);
      setPulse(null);
      return;
    }
    const item=current();
    if(!item){setPulse(null);return;}
    if(item.wait==='gift'){
      // 상점이 열려 있으면 방문 선물 버튼, 아니면 상점 버튼을 강조합니다. 수령하면(버튼이 비활성화되면) 다음으로 넘어갑니다.
      const btn=visible('[data-daily-gift]');
      if(btn&&btn.disabled){advance();return;}
      setPulse(btn||findShopButton());
      return;
    }
    if(item.wait==='member'){
      // 멤버십 서비스 카드를 누르면 다음으로 넘어갑니다(클릭 처리는 아래 리스너).
      setPulse(visible('.alien-shop-membership-card'));
      return;
    }
    if(item.wait==='search'){
      if(searchDone){setPulse(null);advance();return;}
      // 함선 탐색 탭을 한 번 열어 1회 탐색 버튼이 보이게 합니다.
      if(!summonOpened){summonOpened=true;window.summonTab?.('ship');}
      setPulse(visible('#ship-pool .summon-action:not(.ten)'));
      return;
    }
    if(item.wait==='overlay'){
      if(!document.querySelector('#ship-exploration-overlay')){setPulse(null);advance();return;}
      setPulse(null);
      return;
    }
    if(item.wait==='guarantee'){
      setPulse(visible('.ssr-guarantee-selected'));
      return;
    }
    setPulse(null);
  };

  // 상점 버튼 찾기 (함교 상단의 [상점] 버튼)
  const findShopButton=()=>{const button=document.querySelector('button[aria-label="상점"]');return button&&button.offsetParent!==null?button:null;};

  // 1회 무료 탐색 완료 알림
  window.addEventListener('ship-exploration-completed',event=>{
    if(run&&current()?.wait==='search'&&Number(event.detail?.count)===1)searchDone=true;
  });

  // 멤버십 서비스 카드를 누르면 다음 대사로, 확정 획득 상자를 누르면 대화를 끝냅니다.
  document.addEventListener('click',event=>{
    if(!run)return;
    const wait=current()?.wait;
    if(wait==='member'&&event.target.closest('.alien-shop-membership-card'))setTimeout(advance,0);
    else if(wait==='guarantee'&&event.target.closest('.ssr-guarantee-selected'))setTimeout(advance,0);
  },true);

  // 연구실(summon 화면)이 열릴 때 탐색드론 안내를 시작합니다. 어떤 버튼으로 들어가도 화면 이벤트는 동일하게 발생합니다.
  window.addEventListener('game-screen-changed',event=>{
    if(event.detail?.screen!=='summon'||run||!panel)return;
    if(luca.phase==='drone_pending')startDrone();
    else if(luca.phase==='drone')resumeDrone();
  });

  // 연구실을 열 때 탐색드론 안내를 시작합니다.
  const wrapOpenLab=()=>{
    const original=window.openResearchLab;
    if(typeof original!=='function'||original.__lucaWrapped)return;
    const wrapped=function(...args){
      const result=original.apply(this,args);
      if(luca.phase==='drone_pending'&&!run)startDrone();
      else if(luca.phase==='drone'&&!run)resumeDrone();
      return result;
    };
    wrapped.__lucaWrapped=true;
    window.openResearchLab=wrapped;
  };

  window.addEventListener('DOMContentLoaded',()=>{
    panel=document.createElement('aside');
    panel.className='luca-tutorial';
    panel.hidden=true;
    panel.setAttribute('aria-label','루카와 EVA-9 안내');
    panel.innerHTML='<img alt=""/><div class="luca-dialogue"><small data-name></small><p data-body></p><button type="button" data-next>다음</button></div>';
    document.body.append(panel);
    panel.querySelector('[data-next]').onclick=onNext;
    wrapOpenLab();
    if(luca.phase==='luca')startLuca(luca.index||0);
    setInterval(tick,400);
  });
  window.addEventListener('load',wrapOpenLab);
})();
