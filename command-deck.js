const explorationLootCatalog={
  ssrShipTicket:{name:'SSR 함선 선택 교환권',icon:'🎫',image:'icons/ssr-ship-ticket.svg?v=3',category:'resource',detail:'원하는 SSR 등급 함선 1척과 교환할 수 있는 교환권'},
  goldVault:{name:'금고',icon:'▣',image:'icons/vault.png',category:'resource',detail:'사용하면 확률에 따라 골드를 획득합니다'},
  frameTicket:{name:'함선골조 교환권',icon:'🎟',image:'icons/frame-ticket.svg',category:'resource',detail:'함선 골조 5종 중 하나를 골라 획득하는 보급권'},
  thoriumBox:{name:'토륨 상자',icon:'🔷',image:'icons/thorium-box.png',category:'resource',detail:'사용하면 확률에 따라 토륨을 획득합니다'},
  researchBag:{name:'연구자료 가방',icon:'▤',image:'icons/research-data-bag.png',category:'resource',detail:'사용하면 연구일지 1~5개와 10% 확률로 분야가 지정된 전용 연구코어 1개를 획득합니다. 연구일지는 수량이 많을수록 확률이 낮습니다'},
  scoutTron:{name:'탐색드론',icon:'◉',image:'icons/scout-drone.png?v=20260929-2',category:'resource',detail:'탐색 보조 장비'},
  precisionScout:{name:'정밀탐색드론',icon:'◉',image:'icons/scout-drone.png?v=20260929-2',category:'resource',detail:'파라가 개량한 정밀 탐색 장비'},
  researchStaff:{name:'연구인력',icon:'♙',image:'icons/research-personnel-20261002.png',category:'resource',detail:'연구 지원 인력'},
  solarDust:{name:'태양티끌',icon:'☼',image:'icons/solar-dust.png',category:'other',detail:'용도 미지정 태양계 물질'},
  frameCannon:{name:'함포 골조',weapon:'함포',icon:'⚓',image:'icons/ship-frame.png',category:'frame',detail:'무기종류: 함포'},
  frameMissile:{name:'미사일 골조',weapon:'미사일',icon:'🚀',image:'icons/ship-frame.png',category:'frame',detail:'무기종류: 미사일'},
  frameLaser:{name:'레이저포 골조',weapon:'레이저포',icon:'⌁',image:'icons/ship-frame.png',category:'frame',detail:'무기종류: 레이저포'},
  framePiercing:{name:'관통레이저 골조',weapon:'관통레이저',icon:'╫',image:'icons/ship-frame.png',category:'frame',detail:'무기종류: 관통레이저'},
  frameCarrier:{name:'함재기 골조',weapon:'함재기',icon:'✈️',image:'icons/ship-frame.png',category:'frame',detail:'무기종류: 함재기'}
};
const explorationLootStorageKey='starfleet-exploration-loot-v1';
const gameResourceStorageKey='starfleet-game-resources-v1';
const readExplorationLoot=()=>{try{return JSON.parse(localStorage.getItem(explorationLootStorageKey)||'{}')||{};}catch{return {};}};
window.getExplorationLootInventory=()=>({...readExplorationLoot()});
window.grantExplorationLoot=(itemId,amount=1)=>{if(!explorationLootCatalog[itemId])return false;const state=readExplorationLoot();state[itemId]=Math.max(0,Math.floor(Number(state[itemId])||0))+Math.max(1,Math.floor(Number(amount)||1));try{localStorage.setItem(explorationLootStorageKey,JSON.stringify(state));window.dispatchEvent(new Event('game-resources-updated'));return true;}catch{return false;}};
window.consumeExplorationLootBatch=entries=>{const state=readExplorationLoot(),costs={};(entries||[]).forEach(({itemId,amount=1})=>{costs[itemId]=(costs[itemId]||0)+Math.max(1,Math.floor(Number(amount)||1));});if(Object.entries(costs).some(([itemId,cost])=>!explorationLootCatalog[itemId]||Math.max(0,Number(state[itemId])||0)<cost))return false;Object.entries(costs).forEach(([itemId,cost])=>{state[itemId]=Math.max(0,Number(state[itemId])||0)-cost;});try{localStorage.setItem(explorationLootStorageKey,JSON.stringify(state));window.dispatchEvent(new Event('game-resources-updated'));return true;}catch{return false;}};
window.consumeExplorationLoot=(itemId,amount=1)=>window.consumeExplorationLootBatch([{itemId,amount}]);
window.grantResearchTestResources=()=>{
  if(!window.grantExplorationLoot('researchStaff',10))return false;
  let balances=window.gameResources;
  if(!balances||typeof balances!=='object')balances={gold:0,thorium:0};
  if(!window.__inventoryBalancesHydrated){try{const saved=JSON.parse(localStorage.getItem(gameResourceStorageKey)||'null');if(saved&&typeof saved==='object')Object.assign(balances,saved);}catch{}window.__inventoryBalancesHydrated=true;}
  balances.gold=Math.max(0,Number(balances.gold)||0)+1000;
  window.gameResources=balances;
  try{localStorage.setItem(gameResourceStorageKey,JSON.stringify(balances));}catch{return false;}
  window.dispatchEvent(new Event('game-resources-updated'));
  window.notice?.('테스트 자원 지급: 연구인력 10개 · 골드 1,000');
  return true;
};
window.addEventListener('DOMContentLoaded', () => {
  initializePlanetCampaign();
  const addOrbitSparkles=()=>{
    document.querySelectorAll('.planet-rotation-scene,.flagship-platform').forEach(host=>{
      if(host.querySelector('.planet-sparkles'))return;
      const layer=document.createElement('div');layer.className='planet-sparkles';layer.setAttribute('aria-hidden','true');
      for(let i=0;i<12;i++){
        const track=document.createElement('i');track.className='spark-orbit';
        track.style.setProperty('--orbit-duration',(65+i*7)+'s');track.style.setProperty('--orbit-delay',(-i*13)+'s');track.style.setProperty('--orbit-radius',(42+(i%4)*3)+'%');
        const dot=document.createElement('b');dot.style.animationDelay=(-i*.7)+'s';track.append(dot);layer.append(track);
      }
      host.append(layer);
    });
  };
  new MutationObserver(addOrbitSparkles).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  addOrbitSparkles();
  initializeFleetFormation();
  const labTitle = document.querySelector('.summon-title');
  if (labTitle) {
    labTitle.querySelector('span')?.remove();
    const heading = labTitle.querySelector('h1');
    if (heading) heading.textContent = '연구실';
    const description = labTitle.querySelector('p');
    if (description) description.textContent = description.textContent.replace('전력 카드를', '전력을');
  }
  const home = document.getElementById('home');
  if (!home || document.getElementById('command-deck')) return;
  const fleetName = document.querySelector('#home .cards .card:first-child b');
  if (fleetName) fleetName.textContent = '제1 기함';
  home.insertAdjacentHTML('beforeend', `
    <div id="command-deck">
      <div class="deck-caption"><span>현재 작전 위치 · 태양계</span><b>화성 · MARS</b></div>
      <button class="deck-shortcut research deck-command-button bridge-service-button" type="button" aria-label="연구실" onclick="openResearchLab()"><span class="deck-command-copy"><b>연구실</b></span><i class="deck-action-badge service-badge research-badge" aria-hidden="true"><svg viewBox="0 0 48 48"><circle class="badge-ring" cx="24" cy="23" r="18"/><ellipse class="badge-mark" cx="24" cy="23" rx="15" ry="6" transform="rotate(-32 24 23)"/><ellipse class="badge-mark" cx="24" cy="23" rx="15" ry="6" transform="rotate(32 24 23)"/><circle class="badge-core" cx="24" cy="23" r="3"/><path class="badge-mark" d="M17 43h14M21 40h6"/></svg></i></button>
      <button class="deck-shortcut hangar deck-command-button bridge-service-button" type="button" aria-label="격납고" title="격납고" onclick="openFleetHangar()"><span class="deck-command-copy"><b>격납고</b></span><i class="deck-action-badge service-badge hangar-badge" aria-hidden="true"><svg viewBox="0 0 48 48"><path class="badge-ring" d="M7 38V15L15 7h18l8 8v23H7Z"/><path class="badge-mark" d="M13 37V19l5-5h12l5 5v18M18 37V23h12v14M11 41h26"/><path class="badge-detail" d="m17 29 7-4 7 4-7 3-7-3Z"/><path class="badge-mark" d="M24 32v4M19 35h10"/></svg></i></button>
      <button class="deck-shortcut store" aria-label="상점" onclick="openAlienShop()"><img class="deck-shop-sign" src="shop-sign.png" alt="상점 SHOP" /><span class="shop-sign-sparkle sparkle-a" aria-hidden="true">✦</span><span class="shop-sign-sparkle sparkle-b" aria-hidden="true">✦</span><span class="shop-sign-sparkle sparkle-c" aria-hidden="true">✦</span></button>
      <button class="deck-shortcut events" type="button" aria-label="이벤트"><i aria-hidden="true"><img class="deck-event-active-icon" src="icons/first-token-event.png" alt="생애 첫 증표" /></i><span>EVENT</span></button>
      <button class="deck-shortcut warehouse deck-command-button bridge-service-button" type="button" aria-label="물자창고" title="물자창고" onclick="openInventory()"><span class="deck-command-copy"><b>물자창고</b></span><i class="deck-action-badge service-badge warehouse-badge" aria-hidden="true"><svg viewBox="0 0 48 48"><path class="badge-mark" d="m8 22 10-5 10 5-10 5-10-5Zm0 0v12l10 5 10-5V22M18 27v12m3-17 10-5 9 5-9 5-10-5Zm7 5 3 1.5 9-4.5V22M31 28v11M6 42h36"/><path class="badge-detail" d="m22 14 9-4 9 4-9 4-9-4Z"/><path class="badge-mark" d="M22 14v4m18-4v4M31 18v4"/></svg></i></button>
      <div class="flagship-platform mars-platform"><div class="mars-globe" role="img" aria-label="천천히 자전하는 붉고 메마른 화성"><div class="mars-surface"></div></div><div class="fleet-tag"><b>화성</b><span>MARS · 붉은 모래 행성</span></div></div>
      <button class="deck-launch" onclick="deployFirstUncleared()"><span>전선 출격</span><b>BATTLE</b><small>첫 미클리어 관문으로 출격</small></button>
      <button class="deck-level deck-command-button ladder-button" type="button" onclick="openLadder()"><i class="deck-action-badge ladder-emblem" aria-hidden="true"><svg viewBox="0 0 48 48"><path class="badge-shell" d="M24 3 40 10l-2 20-14 15L10 30 8 10Z"/><path class="badge-star star-left-top" d="M14 10.5l1.25 2.8 3.05.25-2.3 2 .7 3.05-2.7-1.55-2.7 1.55.7-3.05-2.3-2 3.05-.25Z"/><path class="badge-star star-left-bottom" d="M16 22l1.25 2.8 3.05.25-2.3 2 .7 3.05-2.7-1.55-2.7 1.55.7-3.05-2.3-2 3.05-.25Z"/><path class="badge-star badge-star-center" d="M24 7.5l1.8 4.05 4.45.4-3.35 2.9.95 4.4-3.85-2.25-3.85 2.25.95-4.4-3.35-2.9 4.45-.4Z"/><path class="badge-star star-right-top" d="M34 10.5l1.25 2.8 3.05.25-2.3 2 .7 3.05-2.7-1.55-2.7 1.55.7-3.05-2.3-2 3.05-.25Z"/><path class="badge-star star-right-bottom" d="M32 22l1.25 2.8 3.05.25-2.3 2 .7 3.05-2.7-1.55-2.7 1.55.7-3.05-2.3-2 3.05-.25Z"/></svg></i><span class="deck-command-copy"><small>SEASON 01</small><b>LADDER</b></span></button>
      <button class="deck-mission deck-command-button mission-button" type="button" onclick="openMissionBoard()"><i class="deck-action-badge mission-emblem" aria-hidden="true"><svg viewBox="0 0 48 48"><path class="badge-shell" d="m24 3 17 10v22L24 45 7 35V13Z"/><path class="badge-mark" d="M16 13h16v22H16zM20 19h8M20 24h8M20 29h5"/><circle class="badge-core" cx="33" cy="33" r="6"/><path class="badge-core" d="m30 33 2 2 4-5"/></svg></i><span class="deck-command-copy"><b>MISSION</b></span><em>3 / 7</em></button>
    </div>`);
  const inventoryCategories=[['all','전체'],['resource','자원'],['frame','함선골조'],['special','특수'],['other','기타']];
  const inventoryBalances=()=>{
    if(!window.gameResources)window.gameResources={gold:0,thorium:0};
    if(!Number.isFinite(Number(window.gameResources.lionToken)))window.gameResources.lionToken=0;
    if(!window.__inventoryBalancesHydrated){try{const saved=JSON.parse(localStorage.getItem(gameResourceStorageKey)||'null');if(saved&&typeof saved==='object')Object.assign(window.gameResources,saved);}catch{}window.__inventoryBalancesHydrated=true;}
    return window.gameResources;
  };
  const saveInventoryBalances=()=>{try{localStorage.setItem(gameResourceStorageKey,JSON.stringify(inventoryBalances()));}catch{}window.dispatchEvent(new Event('game-resources-updated'));};
  const inventoryResources=()=>{
    const balances=inventoryBalances();
    const items=[];
    const loot=window.getExplorationLootInventory?.()||{};
    Object.entries(loot).forEach(([id,count])=>{const item=explorationLootCatalog[id],amount=Math.max(0,Math.floor(Number(count)||0));if(!item||!amount)return;if(item.category==='frame'){for(let index=0;index<amount;index+=1)items.push({...item,id,count:1,instanceIndex:index});}else items.push({...item,id,count:amount});});
    Object.entries(balances).forEach(([name,value])=>{if(!['gold','thorium','lionToken'].includes(name)&&Number(value)>0)items.push({category:'other',name,icon:'◇',count:Number(value)});});
    return items;
  };
  const inventoryOverlay=()=>{
    document.getElementById('inventory-overlay')?.remove();
    const overlay=document.createElement('div');overlay.id='inventory-overlay';overlay.className='inventory-overlay';overlay.setAttribute('role','presentation');
    const balances=inventoryBalances();
    overlay.innerHTML=`<section class="inventory-dialog" role="dialog" aria-modal="true" aria-label="물자창고"><header class="inventory-heading"><div class="inventory-heading-title"><small>SUPPLY DEPOT</small><h2>물자창고</h2></div><div class="inventory-resource-badges" aria-label="보유 자원"><span class="inventory-resource-badge gold"><img src="gold-resource-icon.svg" alt=""/>${(Number(balances.gold)||0).toLocaleString('ko-KR')}</span><span class="inventory-resource-badge thorium"><img src="thorium-crystal-icon.png" alt=""/>${(Number(balances.thorium)||0).toLocaleString('ko-KR')}</span><span class="inventory-resource-badge lion-token"><img src="icons/lion-token.png" alt=""/>${(Number(balances.lionToken)||0).toLocaleString('ko-KR')}</span></div><button type="button" class="inventory-close" aria-label="닫기">×</button></header><nav class="inventory-tabs" role="tablist" aria-label="물품 분류">${inventoryCategories.map(([id,label],index)=>`<button type="button" role="tab" data-inventory-tab="${id}" aria-selected="${index===0}">${label}</button>`).join('')}</nav><div class="inventory-grid" role="tabpanel"></div></section>`;
    const grid=overlay.querySelector('.inventory-grid');let items=inventoryResources(),currentCategory='all';
    const refreshResourceBadges=()=>{
      const goldBadge=overlay.querySelector('.inventory-resource-badge.gold'),thoriumBadge=overlay.querySelector('.inventory-resource-badge.thorium'),tokenBadge=overlay.querySelector('.inventory-resource-badge.lion-token');
      if(goldBadge)goldBadge.innerHTML=`<img src="gold-resource-icon.svg" alt=""/>${(Number(balances.gold)||0).toLocaleString('ko-KR')}`;
      if(thoriumBadge)thoriumBadge.innerHTML=`<img src="thorium-crystal-icon.png" alt=""/>${(Number(balances.thorium)||0).toLocaleString('ko-KR')}`;
      if(tokenBadge)tokenBadge.innerHTML=`<img src="icons/lion-token.png" alt=""/>${(Number(balances.lionToken)||0).toLocaleString('ko-KR')}`;
    };
    const showUseReward=(entries,itemId='')=>{
      const popup=document.createElement('div');popup.className='inventory-item-modal-overlay';
      const resultActions=()=>{const remaining=Math.max(0,Math.floor(Number(window.getExplorationLootInventory?.()?.[itemId])||0));return `<div class="inventory-reveal-actions">${remaining?`<button type="button" class="inventory-open-all" aria-label="남은 ${remaining}개 모두 열기">${remaining}개 모두 열기</button>`:''}<button type="button" class="inventory-item-result-close">확인</button></div>`;};
      if(itemId==='researchBag'){
        const journalTotal=entries.find(entry=>entry.rewardType==='journal')?.count||0;
        const coreTotal=entries.filter(entry=>entry.rewardType==='core').reduce((sum,entry)=>sum+Math.max(0,Number(entry.count)||0),0);
        popup.classList.add('inventory-research-bag-reveal-overlay');
        popup.innerHTML=`<section class="inventory-research-bag-reveal" role="dialog" aria-modal="true" aria-label="연구자료 가방 개봉 결과"><div class="inventory-research-bag-scene"><img class="inventory-research-bag-closed" src="icons/research-data-bag.png" alt="닫힌 연구자료 가방"/><img class="inventory-research-bag-open" src="icons/research-data-bag-open.png" alt="열린 연구자료 가방"/><div class="inventory-research-bag-flash" aria-hidden="true"></div><div class="inventory-research-bag-total journal"><img src="icons/research-journal.png" alt="연구일지"/><strong>${Number(journalTotal).toLocaleString('ko-KR')}</strong></div><div class="inventory-research-bag-total core"><img src="icons/research-core.png" alt="연구코어"/><strong>${Number(coreTotal).toLocaleString('ko-KR')}</strong></div></div>${resultActions()}</section>`;
        requestAnimationFrame(()=>popup.classList.add('opening'));
        const audio=window.createGameAudio('sound/chest_unlock_reveal.ogg');audio.preload='auto';audio.volume=.72;audio.load();
        const openingImage=popup.querySelector('.inventory-research-bag-closed');
        const startRevealTiming=()=>{setTimeout(()=>{popup.classList.add('flashing');audio.play().catch(()=>{});},650);setTimeout(()=>popup.classList.add('revealed'),820);};
        if(openingImage.complete)startRevealTiming();else openingImage.addEventListener('load',startRevealTiming,{once:true});
      }else if(itemId==='thoriumBox'){
        const total=entries.find(entry=>entry.name==='획득 토륨 합계')?.count||0;
        popup.classList.add('inventory-thorium-reveal-overlay');
        popup.innerHTML=`<section class="inventory-thorium-reveal" role="dialog" aria-modal="true" aria-label="토륨상자 개봉 결과"><div class="inventory-thorium-scene"><img class="inventory-thorium-closed" src="icons/thorium-box.png" alt="닫힌 토륨상자"/><img class="inventory-thorium-open" src="icons/thorium-box-open.png" alt="열린 토륨상자"/><div class="inventory-thorium-burst" aria-hidden="true"><i style="--angle:0deg;--distance:76px"></i><i style="--angle:45deg;--distance:62px"></i><i style="--angle:90deg;--distance:82px"></i><i style="--angle:135deg;--distance:67px"></i><i style="--angle:180deg;--distance:79px"></i><i style="--angle:225deg;--distance:65px"></i><i style="--angle:270deg;--distance:84px"></i><i style="--angle:315deg;--distance:62px"></i></div><div class="inventory-thorium-total"><img src="thorium-crystal-icon.png" alt="토륨"/><strong>${Number(total).toLocaleString('ko-KR')}</strong></div></div>${resultActions()}</section>`;
        requestAnimationFrame(()=>popup.classList.add('opening'));
        const audio=window.createGameAudio('sound/chest_unlock_reveal.ogg');audio.preload='auto';audio.volume=.72;audio.load();
        const openingImage=popup.querySelector('.inventory-thorium-closed');
        const startRevealTiming=()=>setTimeout(()=>{popup.classList.add('revealed');audio.play().catch(()=>{});},560);
        if(openingImage.complete)startRevealTiming();else openingImage.addEventListener('load',startRevealTiming,{once:true});
      }else if(itemId==='goldVault'){
        const total=entries.find(entry=>entry.name==='획득 골드 합계')?.count||0;
        popup.classList.add('inventory-vault-reveal-overlay');
        popup.innerHTML=`<section class="inventory-vault-reveal" role="dialog" aria-modal="true" aria-label="금고 개봉 결과"><div class="inventory-vault-scene"><img class="inventory-vault-opening" src="icons/vault-opening.gif" alt="금고 문이 열리는 중"/><img class="inventory-vault-final" src="icons/vault-open.png" alt="열린 금고"/><div class="inventory-vault-total"><img src="gold-resource-icon.svg" alt="골드"/><strong>${Number(total).toLocaleString('ko-KR')}</strong></div></div>${resultActions()}</section>`;
        requestAnimationFrame(()=>popup.classList.add('opening'));
        const vaultAudio=window.createGameAudio('sound/chest_unlock_reveal.ogg');vaultAudio.preload='auto';vaultAudio.volume=.72;vaultAudio.load();
        const startRevealTiming=()=>{setTimeout(()=>vaultAudio.play().catch(()=>{}),560);setTimeout(()=>popup.classList.add('revealed'),980);};
        const openingImage=popup.querySelector('.inventory-vault-opening');
        if(openingImage.complete)startRevealTiming();else openingImage.addEventListener('load',startRevealTiming,{once:true});
      }else{
        popup.innerHTML=`<section class="inventory-item-result" role="dialog" aria-modal="true" aria-label="아이템 획득"><small>SUPPLY RECEIVED</small><h3>물자 획득</h3><div class="inventory-item-result-list">${entries.map(entry=>`<div class="inventory-item-result-row"><span class="inventory-item-result-icon">${entry.image?`<img src="${entry.image}" alt=""/>`:entry.icon}</span><b>${entry.name}</b><strong>${entry.suffix?`${entry.count.toLocaleString('ko-KR')} ${entry.suffix}`:`×${entry.count.toLocaleString('ko-KR')}`}</strong></div>`).join('')}</div>${resultActions()}</section>`;
      }
      // 금고·토륨상자: 열리는 연출 뒤 "획득을 축하합니다!" 화면으로 바꿔 구간별 보상을 하나씩 떨어뜨리고,
      // 확인을 누르면 빛 구슬이 물자창고 상단의 골드/토륨 배지로 날아가 수납됩니다.
      const celebrates=itemId==='goldVault'||itemId==='thoriumBox';
      const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      let celebrationTimer=0,celebrated=false;
      const startCelebration=()=>{
        if(!celebrates||celebrated||!popup.isConnected)return;
        celebrated=true;
        const section=popup.querySelector('section'),scene=section.querySelector('.inventory-vault-scene,.inventory-thorium-scene'),actions=section.querySelector('.inventory-reveal-actions');
        const tiers=entries.filter(entry=>entry.suffix==='회'),total=entries.find(entry=>/^획득 .+ 합계$/.test(entry.name));
        const sparks=Array.from({length:9},(_,index)=>`<i style="--x:${8+index*10.5}%;--d:${(index%4)*.35}s;--h:${18+(index*7)%22}px"></i>`).join('');
        const layer=document.createElement('div');layer.className='loot-celebration';layer.setAttribute('role','group');layer.setAttribute('aria-label','획득 축하');
        layer.innerHTML=`<div class="loot-celebration-banner"><span class="loot-celebration-sparks" aria-hidden="true">${sparks}</span><strong class="loot-celebration-title"><span class="loot-title-long">획득을 축하합니다!</span><span class="loot-title-short" aria-hidden="true">획득축하</span></strong></div><div class="loot-celebration-grid">${tiers.map((entry,index)=>`<div class="loot-cell" style="--i:${index}"><span class="loot-cell-icon"><img src="${entry.image}" alt=""/><em>×${Number(entry.count).toLocaleString('ko-KR')}</em></span><b>${entry.name}</b></div>`).join('')}</div>${total?`<div class="loot-celebration-total"><img src="${total.image}" alt=""/><span>${total.name.replace(/^획득 /,'')}</span><strong>${Number(total.count).toLocaleString('ko-KR')}</strong></div>`:''}`;
        if(scene)layer.style.minHeight=`${scene.offsetHeight}px`;
        scene?.after(layer);if(actions)layer.after(actions);
        popup.classList.add('celebrating');
        const finishDelay=reducedMotion?120:tiers.length*120+760;
        celebrationTimer=setTimeout(()=>{
          popup.classList.add('celebrated');
          const audio=window.createGameAudio?.('sound/get.wav');if(audio){audio.volume=.55;audio.play().catch(()=>{});}
        },finishDelay);
      };
      const closeReward=()=>{
        clearTimeout(celebrationTimer);
        const badge=celebrates?overlay.querySelector(`.inventory-resource-badge.${itemId==='goldVault'?'gold':'thorium'}`):null;
        const badgeRect=badge?.getBoundingClientRect();
        if(!badge||reducedMotion||!badgeRect?.width||typeof Element.prototype.animate!=='function'){popup.remove();return;}
        const sources=[...popup.querySelectorAll('.loot-cell-icon')].slice(0,6);
        if(!sources.length)sources.push(popup.querySelector('.inventory-vault-total img,.inventory-thorium-total img')||popup.querySelector('section'));
        const tx=badgeRect.left+badgeRect.width/2,ty=badgeRect.top+badgeRect.height/2;
        const orbs=sources.map((source,index)=>{
          const rect=source.getBoundingClientRect(),orb=document.createElement('span');orb.className='loot-flight-orb';
          const size=Math.max(26,Math.min(48,rect.width*.7));
          Object.assign(orb.style,{left:`${rect.left+rect.width/2-size/2}px`,top:`${rect.top+rect.height/2-size/2}px`,width:`${size}px`,height:`${size}px`});
          document.body.append(orb);
          const dx=tx-(rect.left+rect.width/2),dy=ty-(rect.top+rect.height/2);
          return orb.animate([
            {transform:'translate(0,0) scale(1)',opacity:1},
            {transform:`translate(${dx*.3}px,${dy*.3-40}px) scale(1.1)`,opacity:1,offset:.4},
            {transform:`translate(${dx}px,${dy}px) scale(.35)`,opacity:.2}
          ],{duration:620,delay:index*80,easing:'cubic-bezier(.45,0,.7,.4)',fill:'forwards'}).finished.then(()=>orb.remove());
        });
        popup.classList.add('loot-leaving');setTimeout(()=>popup.remove(),220);
        Promise.all(orbs).then(()=>{badge.classList.remove('loot-received');void badge.offsetWidth;badge.classList.add('loot-received');setTimeout(()=>badge.classList.remove('loot-received'),3700);});
      };
      if(celebrates){
        // 열리는 장면이 끝나고(revealed) 합계가 잠깐 보인 뒤 축하 화면으로 넘어갑니다.
        new MutationObserver((_,observer)=>{if(popup.classList.contains('revealed')){observer.disconnect();celebrationTimer=setTimeout(startCelebration,reducedMotion?200:750);}}).observe(popup,{attributes:true,attributeFilter:['class']});
      }
      overlay.append(popup);popup.querySelector('.inventory-item-result-close').onclick=closeReward;
      popup.querySelector('.inventory-open-all')?.addEventListener('click',()=>{const item=items.find(entry=>entry.id===itemId),remaining=Math.max(0,Math.floor(Number(window.getExplorationLootInventory?.()?.[itemId])||0));if(!item||!remaining){popup.remove();return;}popup.remove();openItemUseConfirm({...item,count:remaining});const confirmPopup=overlay.lastElementChild,input=confirmPopup?.querySelector('#inventory-use-quantity');if(input){input.value=String(remaining);confirmPopup.querySelector('.inventory-item-use-open')?.click();}});
      popup.onclick=event=>{if(event.target===popup)closeReward();};
    };
    const openItemUseConfirm=item=>{
      const popup=document.createElement('div');popup.className='inventory-item-modal-overlay';
      popup.innerHTML=`<section class="inventory-item-use-dialog" role="dialog" aria-modal="true" aria-label="사용 수량 확인"><button type="button" class="inventory-item-use-close" aria-label="닫기">×</button><span class="inventory-item-use-icon">${item.image?`<img src="${item.image}" alt=""/>`:item.icon}</span><small>보유 ${item.count.toLocaleString('ko-KR')}개</small><h3>${item.name}</h3><label for="inventory-use-quantity">사용 수량</label><div class="inventory-item-quantity"><button type="button" data-quantity-step="-1" aria-label="수량 감소">−</button><input id="inventory-use-quantity" type="number" min="1" max="${item.count}" step="1" value="1" inputmode="numeric"/><button type="button" data-quantity-step="1" aria-label="수량 증가">＋</button><button type="button" class="inventory-item-quantity-all" data-quantity-all aria-label="전체 수량 선택">모두</button></div><p class="inventory-item-use-hint">사용하면 획득 물자가 즉시 반영됩니다.</p><div class="inventory-item-use-actions"><button type="button" class="inventory-item-use-cancel">취소</button><button type="button" class="inventory-item-use-open">열기</button></div></section>`;
      overlay.append(popup);
      const input=popup.querySelector('#inventory-use-quantity'),close=()=>popup.remove();
      popup.querySelector('.inventory-item-use-close').onclick=close;popup.querySelector('.inventory-item-use-cancel').onclick=close;popup.onclick=event=>{if(event.target===popup)close();};
      popup.querySelectorAll('[data-quantity-step]').forEach(button=>button.onclick=()=>{const value=Math.max(1,Math.min(item.count,(Number(input.value)||1)+Number(button.dataset.quantityStep)));input.value=String(value);});
      popup.querySelector('[data-quantity-all]').onclick=()=>{input.value=String(item.count);};
      popup.querySelector('.inventory-item-use-open').onclick=()=>{
        const amount=Math.max(1,Math.min(item.count,Math.floor(Number(input.value)||1)));
        if(!window.consumeExplorationLootBatch?.([{itemId:item.id,amount}])){input.value='1';return;}
        const rewards=[];
        if(item.id==='goldVault'){
          const tiers=[500,1000,5000,10000,100000],hits=Object.fromEntries(tiers.map(value=>[value,0]));let total=0;
          for(let index=0;index<amount;index+=1){const roll=Math.random()*100,value=roll<50?500:roll<75?1000:roll<95?5000:roll<99?10000:100000;hits[value]+=1;total+=value;}
          balances.gold=(Number(balances.gold)||0)+total;
          tiers.filter(value=>hits[value]).forEach(value=>rewards.push({name:`골드 ${value.toLocaleString('ko-KR')}`,image:'gold-resource-icon.svg',count:hits[value],suffix:'회'}));
          rewards.push({name:'획득 골드 합계',image:'gold-resource-icon.svg',count:total,suffix:'골드'});
        }else if(item.id==='thoriumBox'){
          const tiers=[5,10,50,75,90,100],hits=Object.fromEntries(tiers.map(value=>[value,0]));let total=0;
          for(let index=0;index<amount;index+=1){const roll=Math.random()*100,value=roll<55?5:roll<80?10:roll<90?50:roll<97?75:roll<99?90:100;hits[value]+=1;total+=value;}
          balances.thorium=(Number(balances.thorium)||0)+total;
          tiers.filter(value=>hits[value]).forEach(value=>rewards.push({name:`토륨 ${value}`,image:'thorium-crystal-icon.png',count:hits[value],suffix:'회'}));
          rewards.push({name:'획득 토륨 합계',image:'thorium-crystal-icon.png',count:total,suffix:'토륨'});
        }else if(item.id==='researchBag'){
          const key='starfleet-tactical-weapon-research-v1';let state={};try{state=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}
          const coreFields=[['cannon','함포'],['missile','미사일'],['electric','전기'],['laser','레이저포'],['piercing','관통레이저'],['carrier','함재기'],['defense','방어모듈'],['frigate','프리깃']],earned={};let journalTotal=0;
          for(let index=0;index<amount;index+=1){const journalRoll=Math.random()*100,journalAmount=journalRoll<50?1:journalRoll<75?2:journalRoll<90?3:journalRoll<97?4:5; journalTotal+=journalAmount; if(Math.random()*100<10){const field=coreFields[Math.floor(Math.random()*coreFields.length)],old=state[field[0]]||{};state[field[0]]={...old,materials:Math.max(0,Number(old.materials)||0)+1};earned[`${field[1]} 연구코어`]=(earned[`${field[1]} 연구코어`]||0)+1;}}
          state.researchJournal=Math.max(0,Math.floor(Number(state.researchJournal)||0))+journalTotal;
          try{localStorage.setItem(key,JSON.stringify(state));}catch{}
          window.syncTacticalResearchInventory?.();
          rewards.push({name:'연구일지',image:'icons/research-journal.png',count:journalTotal,rewardType:'journal'});
          Object.entries(earned).forEach(([name,count])=>rewards.push({name,image:'icons/research-core.png',count,rewardType:'core'}));
        }
        saveInventoryBalances();popup.remove();items=inventoryResources();renderInventory(currentCategory);refreshResourceBadges();
        showUseReward(rewards,item.id);
      };
    };
    // SSR 함선 선택 교환권: 함선도감처럼 SSR 함선 목록을 띄우고, 고른 뒤 하단 [선택] → 확인 → 교환.
    // 함선골조 교환권: 골조 5종 중 하나를 고르면 보급권 1개를 소모하고 그 골조를 1개 획득한다.
    const FRAME_CHOICES=['frameCannon','frameMissile','frameLaser','framePiercing','frameCarrier'];
    const openFrameTicketPicker=(item,onDone)=>{
      const popup=document.createElement('div');popup.className='inventory-item-modal-overlay inventory-ticket-overlay';
      popup.innerHTML=`<section class="inventory-ticket-codex" role="dialog" aria-modal="true" aria-label="함선골조 교환권">
        <header class="inventory-ticket-head"><img src="${item.image}" alt=""/><div><small>FRAME SUPPLY · 보유 ${item.count.toLocaleString('ko-KR')}장</small><h3>${item.name}</h3></div><button type="button" class="inventory-ticket-close" aria-label="닫기">×</button></header>
        <div class="codex-list inventory-ticket-list"><div class="codex-list-title">골조 선택 <small>획득할 함선 골조를 고르세요</small></div>
          <div class="codex-card-grid">${FRAME_CHOICES.map(key=>{const f=explorationLootCatalog[key];return `<button type="button" class="codex-ship-card inventory-ticket-card" data-frame-pick="${key}"><span class="ship-portrait"><img src="${f.image}" alt="${f.name}"/></span><b>${f.name}</b><span class="ship-type-attack">${f.detail}</span></button>`;}).join('')}</div></div>
        <footer class="inventory-ticket-foot"><p class="inventory-ticket-picked">선택한 골조 없음</p><button type="button" class="inventory-ticket-select" disabled>획득</button></footer>
      </section>`;
      overlay.append(popup);
      const close=()=>popup.remove();
      let picked=null;
      popup.querySelector('.inventory-ticket-close').onclick=close;popup.onclick=event=>{if(event.target===popup)close();};
      const confirm=popup.querySelector('.inventory-ticket-select');
      popup.querySelectorAll('[data-frame-pick]').forEach(card=>card.onclick=()=>{
        picked=card.dataset.framePick;
        popup.querySelectorAll('[data-frame-pick]').forEach(other=>other.classList.toggle('picked',other===card));
        popup.querySelector('.inventory-ticket-picked').innerHTML=`선택: <b>${explorationLootCatalog[picked].name}</b>`;
        confirm.disabled=false;
      });
      confirm.onclick=()=>{
        if(!picked)return;
        if(!window.consumeExplorationLoot?.('frameTicket',1)){window.notice?.('보급권이 부족합니다.');close();return;}
        window.grantExplorationLoot?.(picked,1);
        window.notice?.(`${explorationLootCatalog[picked].name} 1개를 획득했습니다.`);
        close();
        onDone?.();
      };
    };
    const openShipTicketPicker=item=>{
      const ships=window.getSsrTicketShips?.()||[];
      const types=[['all','ALL','전체'],['dreadnought','DreadNought','중전함'],['battlecruiser','Battlecruiser','전투순양함'],['destroyer','Destroyer','구축함'],['frigate','Frigate','프리깃']].filter(([id])=>id==='all'||ships.some(ship=>ship.type===id));
      const popup=document.createElement('div');popup.className='inventory-item-modal-overlay inventory-ticket-overlay';
      popup.innerHTML=`<section class="inventory-ticket-codex" role="dialog" aria-modal="true" aria-label="SSR 함선 선택 교환권">
        <header class="inventory-ticket-head"><img src="${item.image}" alt=""/><div><small>SSR SHIP SELECT · 보유 ${item.count.toLocaleString('ko-KR')}장</small><h3>${item.name}</h3></div><button type="button" class="inventory-ticket-close" aria-label="닫기">×</button></header>
        <div class="codex-categories inventory-ticket-tabs">${types.map(([id,label,ko])=>`<button type="button" data-ticket-type="${id}"><b>${label}</b><small>${ko}</small></button>`).join('')}</div>
        <div class="codex-list inventory-ticket-list"><div class="codex-list-title">SSR 함선 목록 <small>교환할 함선을 고르세요</small></div><div class="codex-card-grid"></div></div>
        <footer class="inventory-ticket-foot"><p class="inventory-ticket-picked">선택한 함선 없음</p><button type="button" class="inventory-ticket-select" disabled>선택</button></footer>
      </section>`;
      overlay.append(popup);
      const grid=popup.querySelector('.codex-card-grid'),pickedLabel=popup.querySelector('.inventory-ticket-picked'),selectButton=popup.querySelector('.inventory-ticket-select');
      let selected=null;
      const close=()=>popup.remove();
      popup.querySelector('.inventory-ticket-close').onclick=close;popup.onclick=event=>{if(event.target===popup)close();};
      const renderType=type=>{
        popup.querySelectorAll('[data-ticket-type]').forEach(tab=>tab.classList.toggle('selected',tab.dataset.ticketType===type));
        const shown=ships.filter(ship=>type==='all'||ship.type===type);
        grid.innerHTML=shown.map(ship=>`<button type="button" class="codex-ship-card rarity-card-SSR inventory-ticket-card${selected&&selected.type===ship.type&&selected.name===ship.name?' picked':''}" data-ticket-ship="${ships.indexOf(ship)}" aria-pressed="${selected===ship}"><span class="ship-portrait"><img src="${ship.image}" alt="${ship.name}"/></span><span class="rarity-badge rarity-SSR">SSR</span><b>${ship.name}</b><span class="ship-type-attack">${ship.typeName} · ${ship.profile?.[1]||'장착 무기'}</span></button>`).join('');
        grid.querySelectorAll('[data-ticket-ship]').forEach(card=>card.onclick=()=>{
          selected=ships[Number(card.dataset.ticketShip)];
          grid.querySelectorAll('[data-ticket-ship]').forEach(other=>{const on=other===card;other.classList.toggle('picked',on);other.setAttribute('aria-pressed',String(on));});
          pickedLabel.innerHTML=`선택: <b>${selected.name}</b> <small>${selected.typeName}</small>`;
          selectButton.disabled=false;
        });
      };
      popup.querySelectorAll('[data-ticket-type]').forEach(tab=>tab.onclick=()=>renderType(tab.dataset.ticketType));
      renderType('all');
      // [선택] → 교환 확인
      selectButton.onclick=()=>{
        if(!selected)return;
        const confirmBox=document.createElement('div');confirmBox.className='inventory-ticket-confirm';
        confirmBox.innerHTML=`<div role="alertdialog" aria-modal="true" aria-label="교환 확인"><img src="${selected.image}" alt=""/><p><b>${selected.name}</b> (${selected.typeName})<br>이 함선으로 교환할까요?</p><small>교환권 1장이 사용되며 되돌릴 수 없습니다.</small><div class="inventory-item-use-actions"><button type="button" class="inventory-item-use-cancel">취소</button><button type="button" class="inventory-item-use-open">교환</button></div></div>`;
        popup.querySelector('section').append(confirmBox);
        confirmBox.querySelector('.inventory-item-use-cancel').onclick=()=>confirmBox.remove();
        confirmBox.querySelector('.inventory-item-use-open').onclick=()=>{
          if(!window.consumeExplorationLootBatch?.([{itemId:item.id,amount:1}])){confirmBox.remove();return;}
          const ship=window.redeemSsrShipTicket?.(selected);
          if(!ship){window.grantExplorationLoot?.(item.id,1);confirmBox.remove();return;}
          items=inventoryResources();renderInventory(currentCategory);
          const section=popup.querySelector('section');section.className='inventory-item-use-dialog inventory-ticket-dialog is-result';
          section.innerHTML=`<small>SSR SHIP EXCHANGE</small><h3>교환 완료</h3><span class="inventory-ticket-result"><img src="${ship.image}" alt=""/></span><b class="inventory-ticket-result-name">${ship.name}</b><p>${selected.typeName||''} · SSR 함선을 획득했습니다.</p><div class="inventory-item-use-actions"><button type="button" class="inventory-item-use-open">확인</button></div>`;
          section.querySelector('.inventory-item-use-open').onclick=close;
          try{const audio=window.createGameAudio?.('sound/SSR_get.mp3');if(audio){audio.volume=.6;audio.play().catch(()=>{});}}catch{}
        };
      };
    };
    const renderInventory=category=>{
      currentCategory=category;
      const shown=items.filter(item=>category==='all'||item.category===category);
      const slotCount=Math.max(16,Math.ceil(shown.length/4)*4);
      grid.innerHTML=Array.from({length:slotCount},(_,index)=>{const item=shown[index];if(!item)return '<div class="inventory-item empty" aria-label="빈 슬롯"></div>';const usable=['goldVault','thoriumBox','researchBag','ssrShipTicket','frameTicket'].includes(item.id),contents=usable?' · 눌러서 수량 선택':'',label=item.category==='frame'?`무기종류: ${item.weapon}`:item.name;return `<button type="button" class="inventory-item ${usable?'inventory-item-usable':''}" data-inventory-item="${item.id||''}" title="${item.detail||item.name}${contents}" ${usable?'aria-label="'+item.name+' 사용 수량 선택"':''}><span class="inventory-item-icon">${item.image?`<img src="${item.image}" alt=""/>`:item.icon}</span><b>${item.count.toLocaleString('ko-KR')}</b><small>${label}</small></button>`;}).join('');
      overlay.querySelectorAll('[data-inventory-tab]').forEach(tab=>{const active=tab.dataset.inventoryTab===category;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));});
      grid.querySelectorAll('.inventory-item-usable').forEach(button=>button.onclick=()=>{const item=items.find(entry=>entry.id===button.dataset.inventoryItem);if(!item)return;if(item.id==='ssrShipTicket')openShipTicketPicker(item);else if(item.id==='frameTicket')openFrameTicketPicker(item,()=>{items=inventoryResources();renderInventory(currentCategory);refreshResourceBadges();});else openItemUseConfirm(item);});
    };
    overlay.querySelectorAll('[data-inventory-tab]').forEach(tab=>tab.onclick=()=>renderInventory(tab.dataset.inventoryTab));
    const onResourcesUpdated=()=>refreshResourceBadges();window.addEventListener('game-resources-updated',onResourcesUpdated);
    const closeInventory=()=>{window.removeEventListener('game-resources-updated',onResourcesUpdated);overlay.remove();};
    overlay.querySelector('.inventory-close').onclick=closeInventory;overlay.onclick=event=>{if(event.target===overlay)closeInventory();};
    renderInventory('all');document.body.append(overlay);
  };
  window.openInventory=inventoryOverlay;
  window.updateOperationLocation?.();
  // Run after the legacy four-menu initializer.
  setTimeout(() => {
    const nav = document.querySelector('.fixed-nav');
    if (!nav) return;
    // 하단 메뉴 아이콘(콘솔 계기판 스타일): 선 + 반투명 면을 겹친 2톤 그림. 색은 currentColor 를 따릅니다.
    const icons = [
      // 우주지도: 띠가 있는 행성과 고리, 작은 별
      '<circle cx="24" cy="24" r="10" fill="currentColor" fill-opacity=".2"/><path d="M15.4 20.2c4.6 1.5 12.6 1.5 17.2 0M14.6 26.4c5.4 1.8 13.4 1.8 18.8 0" stroke-width="1.4" opacity=".75"/><ellipse cx="24" cy="24" rx="20" ry="6.4" transform="rotate(-24 24 24)"/><path d="M8 6.5v5M5.5 9h5" stroke-width="1.6"/><circle cx="40.5" cy="40" r="1.6" fill="currentColor" stroke="none"/>',
      // 지구연합: 경위선이 있는 지구와 양쪽 날개 휘장
      '<circle cx="24" cy="20" r="11" fill="currentColor" fill-opacity=".18"/><ellipse cx="24" cy="20" rx="4.6" ry="11" stroke-width="1.5"/><path d="M13.6 16.2h20.8M13.6 23.8h20.8" stroke-width="1.5"/><path d="M11.5 29.5C7 28.6 4.4 25.4 3.8 21c2.6 1.6 5 2.2 7.6 2.2M36.5 29.5c4.5-.9 7.1-4.1 7.7-8.5-2.6 1.6-5 2.2-7.6 2.2"/><path d="M16.5 37h15M20.5 42h7"/>',
      // 함교: 레이더 마스트가 달린 전함 함교 탑
      '<path d="M5.5 34h37l-4.6 7.5H10.1Z" fill="currentColor" fill-opacity=".2"/><path d="M13.5 34l2.2-8.5h16.6l2.2 8.5"/><path d="M18.8 25.5l1.6-7h7.2l1.6 7" fill="currentColor" fill-opacity=".22"/><path d="M21.6 22h4.8" stroke-width="1.6"/><path d="M24 18.5V7.5M19.5 11h9" stroke-width="1.6"/><path d="M24 7.5l5-2.6" stroke-width="1.6"/><circle cx="24" cy="6" r="1.5" fill="currentColor" stroke="none"/>',
      // 함대관리: 쐐기 대형으로 나는 함선 셋과 추진 궤적
      '<path d="M24 4.5l6.4 15.8L24 17.2l-6.4 3.1Z" fill="currentColor" fill-opacity=".24"/><path d="M12 20.5l5.6 14L12 31.7l-5.6 2.8Z" fill="currentColor" fill-opacity=".24"/><path d="M36 20.5l5.6 14L36 31.7l-5.6 2.8Z" fill="currentColor" fill-opacity=".24"/><path d="M24 21.5v5.5M12 35.5v6M36 35.5v6" stroke-width="1.6" opacity=".7"/>',
      // 연구실: 육각 틀 안의 원자 궤도
      '<path d="M24 3.8l17.4 10v20.4L24 44.2 6.6 34.2V13.8Z" stroke-width="1.4" opacity=".55"/><ellipse cx="24" cy="24" rx="13.5" ry="5" transform="rotate(-35 24 24)" fill="currentColor" fill-opacity=".1"/><ellipse cx="24" cy="24" rx="13.5" ry="5" transform="rotate(35 24 24)"/><ellipse cx="24" cy="24" rx="13.5" ry="5" transform="rotate(90 24 24)"/><circle cx="24" cy="24" r="3.2" fill="currentColor" stroke="none"/>'
    ];
    const menus = [['map','우주지도'],['earth-union','지구연합'],['home','함교'],['collection','함대관리'],['summon','연구실']];
    if (!document.getElementById('earth-union')) home.insertAdjacentHTML('afterend', '<section id="earth-union" class="screen"><div class="union-panel"><h1>지구연합</h1><p>EARTH UNION COMMAND</p><div class="union-emblem">⊕</div><h2>인류의 별들을 하나로</h2><p>연합 임무와 외교 기능을 준비 중입니다.</p></div></section>');
    nav.setAttribute('aria-label','주 메뉴');
    nav.innerHTML = menus.map(([id,label],index) => `<button type="button" data-screen="${id}" aria-label="${label}"><span class="menu-badge"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[index]}</svg></span><strong class="menu-label">${label}</strong></button>`).join('');
    const originalShow = window.show;
    window.show = id => {
      if (window.tutorialAllowsScreen && !window.tutorialAllowsScreen(id)) {
        window.notice?.('파라의 튜토리얼을 먼저 진행해 주세요.');
        return false;
      }
      if(id==='summon'){
        let progress={};try{progress=JSON.parse(localStorage.getItem('planet-campaign-v1')||'{}')||{};}catch{}
        if((Number(progress.mars)||0)<5){window.notice?.('연구실은 화성 5관문 클리어 후 개방됩니다.');return false;}
      }
      originalShow(id);
      window.dispatchEvent(new CustomEvent('game-screen-changed',{detail:{screen:id}}));
      nav.querySelectorAll('button').forEach(button => {
        const active = button.dataset.screen === id;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
      });
    };
    nav.querySelectorAll('button').forEach(button => button.onclick = () => {
      if (button.dataset.screen === 'map') window.openPlanetMenu();
      else if (button.dataset.screen === 'collection') window.openFleetManagement?.();
      else window.show(button.dataset.screen);
    });
    window.openResearchLab = () => {
      let progress={};try{progress=JSON.parse(localStorage.getItem('planet-campaign-v1')||'{}')||{};}catch{}
      if((Number(progress.mars)||0)<5){window.notice?.('연구실은 화성 5관문 클리어 후 개방됩니다.');return false;}
      window.show('summon');return true;
    };
    window.show(document.querySelector('.screen.active')?.id || 'home');
  }, 0);
});

function initializeFleetFormation(){
  const screen=document.getElementById('collection');if(!screen)return;
  if(!document.getElementById('ship-detail-modal')){const modal=document.createElement('div');modal.id='ship-detail-modal';modal.hidden=true;modal.innerHTML='<div class="ship-detail-backdrop"></div><article class="ship-detail-card"><button class="ship-detail-close" aria-label="상세정보 닫기">×</button><div class="ship-detail-image"></div><h2></h2><p class="ship-detail-class"></p><div class="ship-detail-stats"></div></article>';document.body.append(modal);modal.querySelector('.ship-detail-backdrop').onclick=()=>{modal.hidden=true;};modal.querySelector('.ship-detail-close').onclick=()=>{modal.hidden=true;};}
  const modal=document.getElementById('ship-detail-modal');
  if(!modal.querySelector('.ship-detail-rarity')){const badge=document.createElement('span');badge.className='ship-detail-rarity rarity-badge';modal.querySelector('.ship-detail-card').append(badge);}
  const fleetShips={
    dreadnought:[
      ['아틀라스','대형 함포 · 방어 980','dreadnought-codex.png','R'],
      ['우주항모','주포 4문 · 방어 860','carrier-codex.png','L'],
      ['니미츠','함재기 전개 · 내구 8,000','dreadnought-nimitz-codex.png','L'],
      ['앙헬라','천사의 날개 · 내구 7,900','dreadnought-angela-codex.png','L'],
      ['탱크','석화 · 내구 4,500','dreadnought-tank-codex.png','SSR'],
      ['거북선','전방 충격파 · 귀면방패 · 내구 4,400','dreadnought-turtle-ship-codex.png','SSR'],
      ['콜로서스','전투기 편대 · 아군 보호막 2,250','dreadnought-colossus-codex.png?v=2','SSR'],
      ['배스천','중장갑 · 방어 880','bastion-codex.png','SR'],
      ['도저','회피기동 · 내구 2,000','dozer-codex.png','SR'],
      ['네메시스','관통레이저 · 내구 2,200','dreadnought-nemesis-codex.png','SR'],
      ['해머','중화기 돌격 · 방어 840','dreadnought-hammer-codex.png?v=20260919-1','R'],
      ['아이기스','공성 지원 · 방어 810','aegis-codex.png','R']
    ],
    battlecruiser:[
      ['야마토','전집중! · 내구 2,900','yamato-codex.png','L'],
      ['퓨리','미사일 포화 · 내구 1,250','fury-codex.png','SR'],
      ['브라운베스','저격 레이저 · 내구 2,500','brown-bess-codex.png','SSR'],
      ['돌격 거북선','중장갑 돌격 · 전투력 1,240','battlecruiser-assault-turtle-ship-codex.png','L'],
      ['거북선','중장갑 돌격 · 전투력 1,150','battlecruiser-turtle-ship-codex.png','SSR'],
      ['마젤란','주포 전투 · 전투력 1,090','battlecruiser-magellan-codex.png','SR'],
      ['스타 크루저','전투력 1,280 · 다목적','star-cruiser-codex-20261007.png','SR'],
      ['아포칼립스','중화기 전투 · 전투력 1,020','battlecruiser-apocalypse-codex.png','R'],
      ['아이오와','함대 포격 · 전투력 980','battlecruiser-iowa-codex.png?v=2','R'],
      ['헬리오스','전투력 1,040 · 항모 지원','battlecruiser-helios-codex.png','R'],
      ['아이언피스트','철권 · 내구 2,700','ironfist-codex.png','SSR'],
      ['히페리온','중장거리 포격 · 전투력 1,180','hyperion-codex.png?v=20260915-19','L']
    ],
    destroyer:[
      ['바랴그','자폭드론 편대 · 내구 5,300','varyag-codex.png','L'],
      ['행성파괴자','초신성 · 관통 레이저 · 내구 6,000','destroyer-planet-destroyer-codex.png','L'],
      ['수 판옥선','수군 화포 · 내구 6,000','destroyer-su-panokseon-codex.png','L'],
      ['스피어','레이저포 난사 · 내구 800','destroyer-codex.png','R'],
      ['우라노스','집중포화 · 내구 800','destroyer-uranus-codex.png','R'],
      ['블레이드','관통 레이저 · 내구 800','destroyer-blade-codex.png','R'],
      ['데이모스','드래곤 브레스 · 내구 1,000','destroyer-deimos-codex.png?v=2','SR'],
      ['오메가','중형 포격 · 공격 590','destroyer-omega-codex.png','SR'],
      ['페가수스','추적 관통 레이저 · 내구 2,000','destroyer-pegasus-codex.png','SSR'],
      ['판도라','뇌격미사일 · 내구 2,000','destroyer-pandora-codex.png','SSR'],
      ['KDDX','전술 함포 · 공격 600','destroyer-kddx-codex.png','SSR'],
      ['가루다','날개 미사일 · 2발 / 2초 · 각 250','garuda-codex.png','SR']
    ],
    frigate:[
      ['방패선','방호 전개 · 방어 720','frigate-bangpaeseon-codex.png','L'],
      ['레판토','전술 돌격 · 공격 590','frigate-lepanto-codex.png','SSR'],
      ['포작선','자폭 시퀀스 · 폭발 500 × 3','frigate-pojagseon-codex.png','SR'],
      ['과학 드론','과학 탐사 · 범위 6','frigate-science-drone-codex.png?v=2','SR'],
      ['건설드론','전장 건설 · 지원 460','frigate-construction-drone-codex.png','R'],
      ['리틀보이','경량 요격 · 회피 18','frigate-littleboy-codex.png?v=3','R']
    ]
  };
  // 전투 엔진의 기본 내구도·일반공격 설정을 격납고에서도 그대로 표시한다.
  // DPS는 주포/광역 추가 대상/이동 시간을 제외한 일반공격의 이론상 초당 피해량이다.
  const combatProfiles={
    'dreadnought:아틀라스':[1300,'전기',45,'전기 90 · 2초 간격','플라즈마 4발 · 각 400'],
    'dreadnought:우주항모':[4500,'함재기',1000,'요격기 6기 · 각 55 / 0.33초','과부하 전개 · 보호막 회복'],
    'dreadnought:니미츠':[8000,'함재기',1500,'함재기 5기 · 각 300 / 1초','전면공세 · 함재기 25기'],
    'dreadnought:앙헬라':[7900,'함포',412,'함포 350 × 2발 · 1.5초 재장전','천사의 날개 : 아군 면역 1초 · 보호막 500 (강화 시 면역 2초 · 보호막 1000)'],
    'dreadnought:탱크':[4500,'전기',125,'전기 초탄 250 · 2초 간격 · 최대 5기 전이','석화 · 1초 무적 → 3초 피해 50% 감소 · 5초 도발'],
    'dreadnought:거북선':[4000,'함포',1200,'좌우 12문 · 각 200 / 2초','돌격/귀면방패'],
    'dreadnought:콜로서스':[4500,'함재기',440,'함재기 4기 · 각 150 / 약 1.36초','보호막 전개 · 아군 보호'],
    'dreadnought:배스천':[2300,'함재기',136,'함재기 3기 · 각 150 / 약 3.3초','전방 포격 · 자가수리 · 도발'],
    'dreadnought:도저':[1900,'함포',207,'함포 135 × 4문 · 2초 재장전','회피강화 · 회피율 50% · 디코이 · 적 3기 도발 / 회피율 +20%'],
    'dreadnought:네메시스':[2200,'관통 레이저',200,'관통 레이저 2문 · 각 100 / 0.5초 · 3초 발사 후 3초 재장전','전기그물 1개 · 5초 제압 · 피해 10% 감소'],
    'dreadnought:해머':[1100,'함재기',158,'함재기 2기 · 각 150 / 3.3초 · 주포 100 / 1.5초','자폭드론 5기 · 각 400'],
    'dreadnought:아이기스':[1350,'함포',100,'함포 50 · 0.5초 간격','수리 드론 4기 · 개별 대상 수리'],
    'battlecruiser:야마토':[5900,'함포',400,'함포 400 × 2발 · 1.5초 재장전','전집중! · 관통레이저 / 미사일 / 함포',[{stars:3,label:'좌우 미사일 300 × 2발'}]],
    'battlecruiser:퓨리':[1250,'미사일',200,'좌우 미사일 각 100 · 1초 간격','다련장미사일 · 6연속 포격 · 광역 기절'],
    'battlecruiser:브라운베스':[2500,'레이저포',600,'레이저 300 × 3발 · 1.5초 간격','저격 2,500'],
    'battlecruiser:돌격 거북선':[7000,'미사일',1212,'미사일 400 · 0.33초 간격','돌격 후 미사일 난사'],
    'battlecruiser:거북선':[3300,'미사일',757,'미사일 250 · 0.33초 간격','미사일 포화'],
    'battlecruiser:마젤란':[1000,'함포',200,'함포 100 · 0.5초 간격','광역 주포 500 · 3초 지속'],
    'battlecruiser:스타 크루저':[1800,'레이저포',294,'레이저 200 · 약 0.68초 간격','광자포 1,000'],
    'battlecruiser:아포칼립스':[900,'레이저포',220,'레이저 110 · 0.5초 간격','중화기 포격 220 × 4발'],
    'battlecruiser:아이오와':[1100,'함포',100,'함포 50 · 0.5초 간격','토마호크 미사일 500'],
    'battlecruiser:헬리오스':[1000,'레이저포',125,'굴절레이저 100 · 0.8초 간격 / 연쇄 2회','강화 굴절레이저 200 × 5발'],
    'battlecruiser:아이언피스트':[2700,'함포',606,'함포 200 · 0.33초 간격','철권 · 함포 500 × 3발 + 미사일 250 × 10발'],
    'battlecruiser:히페리온':[9000,'레이저포',909,'레이저 300 · 0.33초 간격','함선 도약 · 최대출력'],
    'destroyer:바랴그':[5300,'미사일',500,'스플래시 미사일 200 × 3발 · 1.2초 간격','자폭드론 6기 · 기당 범위 피해 500'],
    'destroyer:행성파괴자':[6000,'레이저포',761,'레이저 350 × 5발 + 함재기 3기','초신성 · 광선 범위 2,000 피해 × 5회'],
    'destroyer:수 판옥선':[6000,'함포',1000,'함포 300 · 0.3초 간격','선측 포격 10발 · 비격진천뢰 5발'],
    'destroyer:스피어':[800,'레이저포',100,'레이저 100 · 1초 간격','레이저 100 × 10발 난사'],
    'destroyer:우라노스':[800,'함포',180,'함포 90 · 0.5초 간격','집중포화 900 × 3회'],
    'destroyer:블레이드':[800,'관통 레이저',60,'관통 레이저 100 / 1초 · 3초 발사 / 2초 재장전','삼중 관통레이저 · 5초'],
    'destroyer:데이모스':[1000,'함포',200,'함포 100 · 0.5초 간격','샷건포 300 × 3회 · 넉백 충격파'],
    'destroyer:오메가':[1100,'관통 레이저',540,'관통 레이저 3문 · 각 150 / 0.5초 · 3초 발사 후 2초 쿨다운','집중타격 2500'],
    'destroyer:페가수스':[2000,'관통 레이저',606,'관통 레이저 2문 · 각 100 / 0.33초 · 4초 발사 후 3초 재장전 · 목표를 추적하며, 처치되면 가까운 새 목표로 자동 전환','멸절 · 종료 후 2초 행동불능'],
    'destroyer:판도라':[2000,'미사일 · 함포 · 레이저포 · 전기 · 관통레이저',533,'1초 순환 · 미사일 300 × 2 / 레이저포 500 / 함포 250 × 2','뇌격미사일 · 2초 충전 → 미사일 500 × 2 → 1초 뒤 지름 90px 전기 300 · 전격 1.5초'],
    'destroyer:KDDX':[2000,'레이저포',300,'레이저 450 · 1.5초 간격','연쇄번개 · 1초 충전 후 가까운 적 우선 · 1,500 범위 피해와 전이 범위 피해 · 피해 대상 3초 기절 및 초당 내구도 2% 감전'],
    'destroyer:가루다':[1000,'미사일',250,'양쪽 날개 끝에서 미사일 2발 · 각 250 피해 · 2초 간격 · 가까운 적 우선','수호자 · 미사일 9발 동시 발사'],
    'frigate:방패선':[null,'지원',null,'일반공격 없음','천상의 보호막 · 5초'],
    'frigate:레판토':[null,'함포',null,'소환 후 5초간 함포 100 / 0.5초, 미사일 150 / 1초','전열 포격 · 소환형'],
    'frigate:포작선':[null,'자폭',null,'일반공격 없음','자폭 500 × 3회'],
    'frigate:과학 드론':[null,'지원',null,'일반공격 없음','무작위 전술 시전'],
    'frigate:건설드론':[null,'지원',null,'일반공격 없음','긴급 수복 · 최대 내구도 8%'],
    'frigate:리틀보이':[null,'폭탄',null,'일반공격 없음','핵폭탄 투하 1000']
  };
  const availableFleetShips=Object.entries(fleetShips).flatMap(([type,ships])=>ships.map(([name,,image,rarity])=>{
    const profile=combatProfiles[`${type}:${name}`];
    return {name,baseRarity:rarity,stats:profile?`내구 ${profile[0]??'—'} · DPS ${profile[2]??'—'}`:'—',image,rarity,type,profile};
  }));
  const breakthroughStorageKey='starfleet-ship-breakthrough-v1';let breakthroughState={};try{breakthroughState=JSON.parse(localStorage.getItem(breakthroughStorageKey)||'{}')||{};}catch{breakthroughState={};}
  const breakthroughOrder=['R','SR','SSR','L'],nextRarity=rarity=>breakthroughOrder[Math.min(breakthroughOrder.length-1,Math.max(0,breakthroughOrder.indexOf(rarity)+1))];
  const saveBreakthroughState=()=>{try{localStorage.setItem(breakthroughStorageKey,JSON.stringify(breakthroughState));}catch{}};
  // 보유 함선 목록을 새 저장 슬롯으로 초기화한다. 모든 함선은 기본 0척 보유로 시작한다.
  const enhancementStorageKey='starfleet-ship-enhancement-v6';
  let enhancementState={};
  try{enhancementState=JSON.parse(localStorage.getItem(enhancementStorageKey)||'{}')||{};}catch{enhancementState={};}
  const shipKey=ship=>`${ship.type}:${ship.frameId||ship.name}:${ship.isFrame?ship.rarity:''}`;
  if(enhancementState['destroyer:플레아데스:']){const legacy=enhancementState['destroyer:플레아데스:'],garuda=enhancementState['destroyer:가루다:'];if(!garuda)enhancementState['destroyer:가루다:']=legacy;else if(Array.isArray(legacy.variants)&&Array.isArray(garuda.variants))garuda.variants.push(...legacy.variants);delete enhancementState['destroyer:플레아데스:'];try{localStorage.setItem(enhancementStorageKey,JSON.stringify(enhancementState));}catch{}}
  const enhancementConfig={maxStars:5,copyCost:1,statRateByRarity:{R:.2,SR:.2,SSR:.3,L:.4}};
  const maxStarsFor=(ship,rarityOverride)=>{const rarity=rarityOverride||ship?.rarity;if(rarity==='R')return 3;if(ship?.baseRarity==='R'&&rarity==='SR')return 1;return enhancementConfig.maxStars;};
  const normalizedVariants=ship=>{const entry=enhancementState[shipKey(ship)]||{},baseRarity=ship?.rarity||'R',grouped=new Map(),add=(item,fallbackRarity)=>{const rarity=item.rarity||fallbackRarity,stars=Math.min(maxStarsFor(ship,rarity),Math.max(0,Math.floor(Number(item.stars)||0))),copies=Math.max(0,Math.floor(Number(item.copies)||0));if(!copies)return;const key=`${ship?.type||''}|${ship?.name||''}|${rarity}|${stars}`,current=grouped.get(key);grouped.set(key,{stars,copies:(current?.copies||0)+copies,rarity});};if(Array.isArray(entry.variants))entry.variants.forEach(item=>add(item,baseRarity));else add({stars:entry.stars,copies:entry.copies},baseRarity);return [...grouped.values()];};
  // 연합 임무에 파견된 함선은 보유 수에서 빼서, 함대관리·전투·아레나가 쓰지 못하게 한다(union-command.js가 집계).
  const shipVariants=ship=>normalizedVariants(ship).map(item=>({...item,copies:Math.max(0,item.copies-(window.shipReservedCopies?.(ship.type,ship.name,item.rarity,item.stars)||0))})).filter(item=>item.copies>0);
  const shipProgress=(ship,starsOverride,rarityOverride)=>{const variants=shipVariants(ship).filter(item=>!rarityOverride||item.rarity===rarityOverride);if(Number.isFinite(Number(starsOverride))){const selected=variants.find(item=>item.stars===Number(starsOverride));return selected||{stars:Number(starsOverride)||0,copies:0,rarity:rarityOverride||ship.rarity};}const selected=variants.reduce((best,item)=>item.stars>best.stars?item:best,{stars:0,copies:0,rarity:rarityOverride||ship.rarity});return {stars:selected.stars,copies:variants.reduce((sum,item)=>sum+item.copies,0),rarity:selected.rarity};};
  const starterShipGrantKey='starfleet-starter-ship-0star-v1';
  if(localStorage.getItem(starterShipGrantKey)!=='granted'){
    const starter=availableFleetShips.find(ship=>ship.type==='battlecruiser'&&ship.name==='스타 크루저');
    if(starter){
      const previous=localStorage.getItem(enhancementStorageKey),variants=normalizedVariants(starter).map(item=>({...item}));
      const base=variants.find(item=>item.stars===0&&item.rarity===starter.rarity);
      if(!base||base.copies<1){
        if(base)base.copies=1;else variants.push({stars:0,copies:1,rarity:starter.rarity});
        enhancementState[shipKey(starter)]={variants};
      }
      try{localStorage.setItem(enhancementStorageKey,JSON.stringify(enhancementState));localStorage.setItem(starterShipGrantKey,'granted');}
      catch{if(previous===null)localStorage.removeItem(enhancementStorageKey);else localStorage.setItem(enhancementStorageKey,previous);}
    }
  }
  const saveShipProgress=()=>{try{localStorage.setItem(enhancementStorageKey,JSON.stringify(enhancementState));}catch{}window.dispatchEvent(new Event('fleet-ownership-updated'));};
  const starMarkup=(ship,detail=false,starsOverride,rarityOverride)=>{const count=shipProgress(ship,starsOverride,rarityOverride).stars;return count?`<span class="ship-enhancement-stars${detail?' detail-stars':''}" aria-label="강화 ${count}성">${'★'.repeat(Math.min(count,10))}${count>10?`<em>+${count-10}</em>`:''}</span>`:'';};
  const enhancedStat=(value,stars,rarity='R',breakthrough=false)=>value===null||value===undefined?null:Math.floor(value*(1+stars*(enhancementConfig.statRateByRarity[rarity]||.2)+(breakthrough?.5:0)));
  const weaponLabels=(profile,stars)=>[profile?.[1]||'—',...((profile?.[5]||[]).filter(entry=>stars>=entry.stars).map(entry=>entry.label))].join(' · ');
  const normalAttackDescription=(ship,stars,profile)=>ship?.type==='destroyer'&&ship.name==='바랴그'?`반경 48px 스플래시 미사일 200 × ${stars>=5?5:3}발 · ${stars>=3?'약 0.92':'1.2'}초 간격`:ship?.type==='destroyer'&&ship.name==='오메가'?`관통 레이저 3문 · 각 150 / 0.5초 · 재장전 ${stars>=3?'1':'2'}초`:ship?.type==='destroyer'&&ship.name==='KDDX'?`레이저 450 · ${stars>=3?'약 1.15':'1.5'}초 간격`:ship?.type==='destroyer'&&ship.name==='가루다'?`양쪽 날개 끝에서 미사일 2발 · 각 250 피해 · 2초 간격 · 가까운 적 우선`:profile?.[3]||'—';
  const shipSkillNames={
    'destroyer:KDDX':{aux:'속전속결',ultimate:'임전무퇴'},
    'destroyer:가루다':{aux:'탄두강화',ultimate:'우파가루다'},
    'dreadnought:니미츠':{aux:'전면공세 지원',ultimate:'함재기 폭주'},
    'dreadnought:앙헬라':{aux:'천사의 날개 강화',ultimate:'징벌의 칼'},
    'dreadnought:콜로서스':{aux:'보호막 강화',ultimate:'응징의 방패'},
    'dreadnought:배스천':{aux:'자가수리 강화',ultimate:'함재기 증원'},
    'dreadnought:거북선':{aux:'방패강화',ultimate:'귀면강화'},
    'dreadnought:아이기스':{aux:'4드론'},
    'dreadnought:아틀라스':{aux:'플라즈마 강화'},
    'dreadnought:해머':{aux:'5드론'},
    'dreadnought:도저':{aux:'회피강화',ultimate:'디코이'},
    'dreadnought:탱크':{aux:'암석화',ultimate:'전격강화'},
    'dreadnought:네메시스':{aux:'추가 전기그물',ultimate:'복수'},
    'battlecruiser:퓨리':{aux:'미사일 강화',ultimate:'다련장 심화'},
    'battlecruiser:헬리오스':{aux:'강화 굴절레이저 강화'},
    'battlecruiser:아포칼립스':{aux:'포격 강화'},
    'battlecruiser:스타 크루저':{aux:'중광자포',ultimate:'3연광자포'},
    'battlecruiser:브라운베스':{aux:'목표포착',ultimate:'더블타겟'},
    'battlecruiser:아이오와':{aux:'강화 토마호크',ultimate:'지휘'},
    'battlecruiser:마젤란':{aux:'주포 강화',ultimate:'지휘'},
    'battlecruiser:아이언피스트':{aux:'철권TT',ultimate:'철방패'},
    'battlecruiser:야마토':{aux:'미사일',ultimate:'최후의 저항'},
    'battlecruiser:히페리온':{aux:'최대출력'},
    'battlecruiser:거북선':{aux:'확산탄',ultimate:'쾌속'},
    'battlecruiser:돌격 거북선':{aux:'일휘소탕',ultimate:'혈염산하'},
    'destroyer:블레이드':{aux:'보조레이저'},
    'destroyer:스피어':{aux:'폭발레이저'},
    'destroyer:우라노스':{aux:'투샷'},
    'destroyer:판도라':{aux:'절망',ultimate:'희망'},
    'destroyer:행성파괴자':{aux:'우주방어',ultimate:'멸종'},
    'destroyer:페가수스':{aux:'히포크레네',ultimate:'벨레로폰의 창'},
    'destroyer:수 판옥선':{aux:'도탄포',ultimate:'초신속'},
    'frigate:리틀보이':{aux:'전술핵 강화',ultimate:'Fat Man'},
    'frigate:건설드론':{aux:'회복',ultimate:'수리기능 향상'},
    'frigate:포작선':{aux:'추가폭발',ultimate:'죽음의 무도'},
    'frigate:방패선':{aux:'전장사수',ultimate:'가시방패'},
    'frigate:레판토':{aux:'Ship of the Line',ultimate:'Victory'},
    'frigate:과학 드론':{aux:'전술 확장',ultimate:'최적화'},
    'destroyer:데이모스':{aux:'샷건강화',ultimate:'드래곤 브레스'},
    'destroyer:바랴그':{aux:'투지',ultimate:'용맹'},
    'destroyer:오메가':{aux:'신속장전',ultimate:'폭렬레이저'}
  };
  // 함선 상세 카드의 보조기술·최종기술 설명. 형식은 '이름 : 설명'이고, 값은 battle-engine.js 실제 수치에서 가져왔다.
  // 여기 없는 기술은 '설명 준비 중'으로 표시된다.
  const SKILL_INFO={
    'battlecruiser:돌격 거북선':{aux:'일휘소탕 : 돌격거북선 미사일 공격이 범위 피해로 변경 및 폭발 반경 30% 증가. 범위내 모든 적에게 100% 데미지.',ultimate:'혈염산하 : 돌격 후 귀환할 때 폭발 데미지 추가.'},
    'battlecruiser:거북선':{aux:'확산탄 : 미사일 폭발 반경 내의 대상에 50% 추가피해',ultimate:'쾌속 : 미사일 발사 속도 10% 증가 · 포격 선회 시간 절반'},
    'battlecruiser:퓨리':{aux:'미사일 강화 : 미사일과 다련장 포격 피해 50% 증가',ultimate:'다련장 심화 : 다련장 포격 피해 50% 추가 증가'},
    'battlecruiser:헬리오스':{aux:'강화 굴절레이저 강화 : 굴절레이저 1발 피해 200 → 400'},
    'battlecruiser:아포칼립스':{aux:'포격 강화 : 포격 횟수 4회 → 8회'},
    'battlecruiser:스타 크루저':{aux:'중광자포 : 광자포가 스플래시 데미지로 변경',ultimate:'3연광자포 : 주포를 3발 연속 발사'},
    'battlecruiser:브라운베스':{aux:'목표포착 : 저격 후 행동불능 시간 1초 → 2초',ultimate:'더블타겟 : 저격 시 가장 강한 적 2기를 동시에 저격'},
    'battlecruiser:아이오와':{aux:'강화 토마호크 : 토마호크 피해 500 → 700',ultimate:'지휘 : 아군 함대 공격속도 50% 증가 (3초)'},
    'battlecruiser:마젤란':{aux:'주포 강화 : 집중포화 피해 500 → 700',ultimate:'지휘 : 아군 함대 공격속도 50% 증가 (3초) · 집중포화 맞은 적 2초 기절'},
    'battlecruiser:아이언피스트':{aux:'철권TT : 주포 6연발, 발사 간격 0.5초',ultimate:'철방패 : 자신에게 최대 내구도 30% 보호막 (5초)'},
    'battlecruiser:야마토':{aux:'미사일 : 좌우 미사일 발사 추가',ultimate:'최후의 저항 : 치명적 피해를 입었을 때 전장에 10초간 남아서 공격.'},
    'battlecruiser:히페리온':{aux:'최대출력 : 집중 사격 지속시간 1.5배'},
    'dreadnought:앙헬라':{aux:'천사의 날개 강화 : 아군 면역 2초 · 보호막 1000',ultimate:'징벌의 칼 : 날개 효과 동안 뱃머리에서 레이저포를 1초마다 발사, 관통한 적에게 1000 피해'},
    'dreadnought:니미츠':{aux:'전면공세 지원 : 발동 시 자신이 1초간 피해 면역',ultimate:'함재기 폭주 : 함재기 공격력 50% 증가'},
    'dreadnought:콜로서스':{aux:'보호막 강화 : 아군 전체에 최대 내구도 52.5% 보호막',ultimate:'응징의 방패 : 깨지고 남은 보호막을 적에게 던져 피해 (최대 3회 타격)'},
    'dreadnought:배스천':{aux:'자가수리 강화 : 전투기 수리량 5% → 10%',ultimate:'함재기 증원 : 전투기 2차 편대가 추가로 출격'},
    'dreadnought:거북선':{aux:'방패강화 : 아군 전체에 보호막 (보호막량 20% 증가)',ultimate:'귀면강화 : 돌격 시 적에게 1초간 공포'},
    'dreadnought:아이기스':{aux:'4드론 : 수리 드론을 4기 동시에 출격 (기본 1기)'},
    'dreadnought:아틀라스':{aux:'플라즈마 강화 : 플라즈마 2발 → 4발, 피해 300 → 400'},
    'dreadnought:해머':{aux:'5드론 : 드론 5기 출격, 드론 피해 300 → 400'},
    'dreadnought:도저':{aux:'회피강화 : 회피 확률 30% → 50%',ultimate:'디코이 : 가까운 적 3기를 끌어들이고 회피 확률 20% 추가'},
    'dreadnought:탱크':{aux:'암석화 : 무적 시간 1초 → 2초 · 무적 후 3초간 받는 피해 50% → 60% 감소',ultimate:'전격강화 : 전격 공격을 맞힌 적을 0.5초 기절'},
    'dreadnought:네메시스':{aux:'추가 전기그물 : 전기그물 2개 동시 발사',ultimate:'복수 : 전기그물 3개 발사, 그물 유지 중에도 관통레이저 계속 발사'},
    'destroyer:KDDX':{aux:'속전속결 : 레이저 발사 간격 23% 단축',ultimate:'임전무퇴 : 피해가 쌓이면 잠시 후퇴 후 복귀 (후퇴 대기 10초, 회수마다 4초 추가)'},
    'destroyer:가루다':{aux:'탄두강화 : 가루다 미사일 피해 20% 증가',ultimate:'우파가루다 : 수호자 발동시 전투를 돕는 우파가루다를 소환.'},
    'destroyer:오메가':{aux:'신속장전 : 일반공격 장전시간 50% 감소',ultimate:'폭렬레이저 : 집중타격 종료 후 대상 주변 좁은 범위에 폭발 피해 1,000'},
    'destroyer:페가수스':{aux:'히포크레네 : 멸절 후 2초 행동불능 동안 초당 최대 내구도 5% 회복',ultimate:'벨레로폰의 창 : 5초마다 함수 방향으로 은빛 창 관통 · 관통 피해 1,000 / 스침 피해 300'},
    'destroyer:행성파괴자':{aux:'우주방어 : 초신성 사용 즉시 내구도 10% 보호막 · 피격 시 적에게 일반 레이저 피해로 반격',ultimate:'멸종 : 초신성 마지막 타격이 모든 적에게 적용 · 전체 화면 붉은 플래시 1초'},
    'destroyer:데이모스':{aux:'샷건강화 : 샷건포 피해범위와 피해량 30% 증가',ultimate:'드래곤 브레스 : 샷건포 피해를 입은 적이 3초간 불타며, 0.5초마다 샷건포 피해의 5% 추가 피해'},
    'destroyer:수 판옥선':{aux:'도탄포 : 일반·핵심 함포 명중 시 근처 적 1기에게 동일 피해',ultimate:'초신속 : 선회시간 50% 감소 · 좌측/우측 연속 포격 후 제자리'},
    'destroyer:판도라':{aux:'절망 : 핵심기술 발동 시 남은 내구도 50% 소모 · 모든 피해 100% 증가',ultimate:'희망 : 절망 비활성화 · 충전 중 선수 관통레이저 1,000/초 · 발사 중 방향 고정'},
    'destroyer:바랴그':{aux:'투지 : 공격속도 30% 증가 · 자폭드론 2기 추가',ultimate:'용맹 : 선측 미사일 좌우 각 1발 추가 · 치명 피해 후 10초 공격하고 퇴각'},
    'destroyer:블레이드':{aux:'보조레이저 : 관통레이저 1줄기를 피해 50%로 추가 발사'},
    'destroyer:스피어':{aux:'폭발레이저 : 레이저 명중 지점 주변에 폭발 피해'},
    'destroyer:우라노스':{aux:'투샷 : 함포를 한 번에 2발 발사'},
    'frigate:리틀보이':{aux:'전술핵 강화 : 핵폭발 피해 2배',ultimate:'Fat Man : 출격 2회 충전 · 1회 사용 뒤 3초 대기 · 2회 모두 쓰면 재사용 대기'},
    'frigate:건설드론':{aux:'회복 : 수리 시 모든 상태이상 해제 · 3초 상태이상 면역',ultimate:'수리기능 향상 : 수리 회복량 2배'},
    'frigate:포작선':{aux:'추가폭발 : 자폭 5회',ultimate:'죽음의 무도 : 폭발하는 동안 모든 적을 포작선 쪽으로 끌어당김'},
    'frigate:방패선':{aux:'전장사수 : 방패선 지속시간 30% 증가',ultimate:'가시방패 : 보호막이 받은 피해를 공격한 적에게 되돌려줌'},
    'frigate:레판토':{aux:'Ship of the Line : 포격시간 50% 증가',ultimate:'Victory : 공격속도·공격력 30% 증가'},
    'frigate:과학 드론':{aux:'전술 확장 : 서로 다른 전술 2가지 동시 시전 · 효과 20% 증가',ultimate:'최적화 : 모든 전술 동시 시전 · 효과 20% 추가 증가'}
  };
  const coreSkillDescription=(ship,stars,profile)=>{
    if(ship?.type==='destroyer'&&ship?.name==='가루다')return '수호자';
    if(ship?.type==='destroyer'&&ship?.name==='판도라')return '뇌격미사일';
    if(ship?.type==='destroyer'&&ship?.name==='행성파괴자')return `초신성 · 광선 범위 2,000 피해 × 5회${stars>=5?' · 마지막 타격은 모든 적에게 피해 · 붉은 플래시 1초':''}`;
    if(ship?.type==='destroyer'&&ship?.name==='수 판옥선')return stars>=5?'초신속 · 좌측 포격/비격진천뢰 → 우측 포격/비격진천뢰 → 제자리 · 선회시간 50% 감소 · 함포 도탄':`선측 포격 10발 · 비격진천뢰 5발${stars>=3?' · 함포 명중 시 근처 적 1기에게 동일 피해 도탄':''}`;
    if(ship?.type==='destroyer'&&ship?.name==='바랴그')return `자폭드론 ${stars>=3?8:6}기`;
    if(ship?.type==='destroyer'&&ship?.name==='블레이드'&&stars>=3)return '보조레이저 · 일반 관통레이저와 함께 피해 50% 관통레이저 1줄기 추가 발사';
    if(ship?.type==='destroyer'&&ship?.name==='스피어'&&stars>=3)return '폭발레이저 · 레이저포 난사 10발이 폭발 범위 공격으로 변경';
    if(ship?.type==='destroyer'&&ship?.name==='우라노스'&&stars>=3)return '투샷 · 일반공격 함포를 한 번에 2발 발사';
    if(ship?.type==='battlecruiser'&&ship?.name==='야마토'&&stars>=5)return '최후의 저항 · 치명 피해 시 5초 무적 · 충전 여부와 무관하게 전집중! 사용 후 퇴각';
    if(ship?.type==='battlecruiser'&&ship?.name==='야마토'&&stars>=3)return '미사일 · 일반공격에 좌우 미사일 300 피해 × 2발 추가';
    if(ship?.type==='battlecruiser'&&ship?.name==='아이언피스트'&&stars>=5)return '철방패 · 철권 발동 시 최대 내구도의 30% 보호막 · 상태이상 면역 5초';
    if(ship?.type==='battlecruiser'&&ship?.name==='아이언피스트'&&stars>=3)return '철권TT · 함포 500 × 6발 · 0.5초 간격';
    if(ship?.type==='battlecruiser'&&ship?.name==='아이오와'&&stars>=5)return '지휘 · 광역 토마호크 700 · 적 2초 기절 · 아군 공속 +50% (3초)';
    if(ship?.type==='battlecruiser'&&ship?.name==='아이오와'&&stars>=3)return '강화 토마호크 · 광역 피해 700';
    if(ship?.type==='battlecruiser'&&ship?.name==='마젤란'&&stars>=5)return '지휘 · 광역 주포 700 · 적 2초 기절 · 아군 공속 +50% (3초)';
    if(ship?.type==='battlecruiser'&&ship?.name==='마젤란'&&stars>=3)return '주포 강화 · 광역 주포 700';
    if(ship?.type==='battlecruiser'&&ship?.name==='브라운베스'&&stars>=5)return '더블타겟 · 적 2기 저격 · 저격 중 에너지 재충전';
    if(ship?.type==='battlecruiser'&&ship?.name==='브라운베스'&&stars>=3)return '목표포착 · 대상 이동불가 · 명중 후 2초 기절';
    if(ship?.type==='battlecruiser'&&ship?.name==='스타 크루저'&&stars>=5)return '3연광자포 · 범위 공격 1,000 × 3회 · 발사 중 재충전 없음';
    if(ship?.type==='battlecruiser'&&ship?.name==='스타 크루저'&&stars>=3)return '중광자포 · 범위 공격 1,000';
    if(ship?.type==='battlecruiser'&&ship?.name==='헬리오스'&&stars>=3)return '강화 굴절레이저 400 × 5발';
    if(ship?.type==='battlecruiser'&&ship?.name==='아포칼립스'&&stars>=3)return '강화 포격 330 × 8발';
    if(ship?.type==='dreadnought'&&ship?.name==='탱크'&&stars>=3)return '암석화 · 2초 무적 → 3초 피해 60% 감소 · 5초 도발';
    if(ship?.type==='dreadnought'&&ship?.name==='네메시스'){
      const count=stars>=5?3:stars>=3?2:1;
      return `전기그물 ${count}개 · 5초 제압 · 피해 ${stars>=5?20:10}% 감소${stars>=5?' · 공격/충전 지속':''}`;
    }
    if(ship?.type==='battlecruiser'&&ship?.name==='퓨리'&&stars>=5)return '다련장미사일 · 피해량/범위 50% 증가';
    if(ship?.type==='battlecruiser'&&ship?.name==='퓨리'&&stars>=3)return '미사일 강화 · 미사일 피해량 50% 증가';
    if(ship?.type==='battlecruiser'&&ship?.name==='거북선'&&stars>=5)return '미사일 폭격 · 주변 적 50% 피해 · 공격속도 +10% · 선회/복귀 각 1초';
    if(ship?.type==='battlecruiser'&&ship?.name==='거북선'&&stars>=3)return '미사일 폭격 · 주변 적 50% 피해';
    if(ship?.type==='battlecruiser'&&ship?.name==='돌격 거북선'&&stars>=5)return '돌격 · 상태이상 제거 · 피해 50% 감소 · 복귀 폭발(난사 총 피해 50%)';
    if(ship?.type==='battlecruiser'&&ship?.name==='돌격 거북선'&&stars>=3)return '돌격 후 광역 미사일 난사';
    return profile?.[4]||'—';
  };
  const retainedSkillStars=(ship,stars,rarity)=>{
    const rarityOrder=['R','SR','SSR','L'];
    if(ship?.baseRarity&&rarityOrder.indexOf(rarity)>rarityOrder.indexOf(ship.baseRarity))return Math.max(stars,5);
    if(ship?.type==='dreadnought'&&ship.name==='탱크'&&rarity==='L')return Math.max(stars,5);
    if(ship?.type==='dreadnought'&&ship.name==='네메시스'&&(rarity==='SSR'||rarity==='L'))return Math.max(stars,5);
    if(ship?.type==='battlecruiser'&&ship.name==='퓨리'&&rarity!==ship.baseRarity)return Math.max(stars,5);
    if(ship?.type==='battlecruiser'&&ship.name==='거북선'&&rarity==='L')return Math.max(stars,5);
    return stars;
  };
  const skillAdjustedDps=(ship,dps,stars)=>{
    if(dps===null)return null;
    if(ship?.type==='destroyer'&&ship.name==='KDDX'&&stars>=3)return Math.floor(dps*1.3);
    if(ship?.type==='destroyer'&&ship.name==='오메가'&&stars>=3)return Math.floor(dps*1.25);
    if(ship?.type==='destroyer'&&ship.name==='바랴그')return Math.floor(dps*(stars>=3?1.3:1)*(stars>=5?5/3:1));
    return ship?.type==='battlecruiser'&&ship.name==='거북선'&&stars>=5?Math.floor(dps*1.1):dps;
  };
  const skillStateMarkup=(ship,stars,slot,rarity)=>{
    const names=shipSkillNames[`${ship.type}:${ship.name}`]||{};
    if(ship?.type==='frigate'){
      // 프리깃은 별등급 대신 프리깃 개발(무기연구)로 기술을 연다: 보조기술 = '○○ 보조' 5/5, 최종기술 = '○○ 최종' 5/5.
      const key={'건설드론':'constructionDrone','과학 드론':'scienceDrone','과학드론':'scienceDrone','방패선':'shieldShip','리틀보이':'littleBoy','포작선':'bombardShip','레판토':'lepanto'}[ship.name];
      let tree={};try{tree=JSON.parse(localStorage.getItem('starfleet-tactical-weapon-research-v1')||'{}')?.frigateTree||{};}catch{}
      const node=key&&(slot==='ultimate'?`${key}Final`:slot==='aux'?`${key}Assist`:'');
      // 효과가 정해진 프리깃 기술(나머지는 개방 표시만)
      const named={shieldShip:{aux:'전장사수 · 방패선 지속시간 30% 증가',ultimate:'가시방패 · 방패선을 공격한 적에게 피해 반사'},lepanto:{aux:'Ship of the Line · 포격시간 50% 증가',ultimate:'Victory · 공격속도·공격력 30% 증가'},scienceDrone:{aux:'전술 확장 · 2가지 전술 동시 시전, 효과 20% 상승',ultimate:'최적화 · 모든 전술 동시 시전, 효과 20% 추가 상승'},bombardShip:{aux:'추가폭발 · 자폭 5회',ultimate:'죽음의 무도 · 폭발하는 동안 모든 적을 끌어당김'},constructionDrone:{aux:'회복 · 수리 시 모든 상태이상 해제 + 3초 상태이상 면역',ultimate:'수리기능 향상 · 수리 회복량 2배'},littleBoy:{aux:'전술핵 강화 · 핵폭발 피해 2배',ultimate:'Fat Man · 출격 2회 충전 (모두 사용 시 재사용 대기)'}}[key]?.[slot];
      if(node&&Number(tree[node])>=5)return `<span class="skill-state unlocked">${named||`${slot==='ultimate'?'최종기술':'보조기술'} 개방`}</span>`;
      return `<span class="skill-state locked">${named?`${named.split(' · ')[0]} · `:''}프리깃 연구 필요${node?` · ${ship.name} ${slot==='ultimate'?'최종':'보조'} 5/5`:''}</span>`;
    }
    if(slot==='ultimate'&&rarity==='R')return '없음';
    if(ship?.type==='destroyer'&&ship.name==='가루다'){
      if(slot==='aux'&&stars>=3)return '<span class="skill-state unlocked">탄두강화</span>';
      if(slot==='ultimate'&&stars>=5)return '<span class="skill-state unlocked">우파가루다</span>';
    }
    if(ship?.type==='destroyer'&&ship.name==='오메가'){
      if(slot==='aux'&&stars>=3)return '<span class="skill-state unlocked">신속장전 · 일반공격 장전시간 50% 감소</span>';
      if(slot==='ultimate'&&stars>=5)return '<span class="skill-state unlocked">폭렬레이저 · 집중타격 종료 후 대상 주변 좁은 범위에 폭발 피해 1,000</span>';
    }
    if(ship?.type==='destroyer'&&ship.name==='페가수스'){
      if(slot==='aux'&&stars>=3)return '<span class="skill-state unlocked">히포크레네 · 멸절 후 2초 행동불능 동안 초당 최대 내구도 5% 회복</span>';
      if(slot==='ultimate'&&stars>=5)return '<span class="skill-state unlocked">벨레로폰의 창 · 5초마다 함수 방향으로 은빛 창 관통 · 관통 피해 1,000 / 스침 피해 300</span>';
    }
    if(ship?.type==='destroyer'&&ship.name==='행성파괴자'){
      if(slot==='aux'&&stars>=3)return '<span class="skill-state unlocked">우주방어 · 초신성 사용 즉시 내구도 10% 보호막 · 피격 시 적에게 일반 레이저 피해로 반격</span>';
      if(slot==='ultimate'&&stars>=5)return '<span class="skill-state unlocked">멸종 · 초신성 마지막 타격이 모든 적에게 적용 · 전체 화면 붉은 플래시 1초</span>';
    }
    if(ship?.type==='destroyer'&&ship.name==='데이모스'){
      if(slot==='aux'&&stars>=3)return '<span class="skill-state unlocked">샷건강화 · 샷건포의 피해범위와 피해량 +30%</span>';
      if(slot==='ultimate'&&stars>=5)return '<span class="skill-state unlocked">드래곤 브레스 · 샷건포 피해를 입은 적이 3초간 불타며, 0.5초마다 샷건포 피해의 5% 추가 피해</span>';
    }
    if(ship?.type==='destroyer'&&ship.name==='수 판옥선'){
      if(slot==='aux'&&stars>=3)return '<span class="skill-state unlocked">도탄포 · 일반/핵심 함포 명중 시 근처 적 1기에게 동일 피해</span>';
      if(slot==='ultimate'&&stars>=5)return '<span class="skill-state unlocked">초신속 · 선회시간 50% 감소 · 좌측/우측 연속 포격 후 제자리</span>';
    }
    if(ship?.type==='destroyer'&&ship.name==='판도라'){
      if(slot==='aux'&&stars>=5)return '<span class="skill-state locked">절망 · 희망 개방으로 비활성화</span>';
      if(slot==='aux'&&stars>=3)return '<span class="skill-state unlocked">절망 · 핵심기술 발동 시 남은 내구도 50% 소모 · 모든 피해 +100%</span>';
      if(slot==='ultimate'&&stars>=5)return '<span class="skill-state unlocked">희망 · 절망 비활성화 · 충전 중 선수 관통레이저 1,000/초 · 발사 중 방향 고정</span>';
    }
    if(ship?.type==='destroyer'&&ship.name==='바랴그'){
      if(slot==='aux'&&stars>=3)return '<span class="skill-state unlocked">투지 · 공격속도 +30% · 자폭드론 2기 추가</span>';
      if(slot==='ultimate'&&stars>=5)return '<span class="skill-state unlocked">용맹 · 선측 미사일 좌우 각 1발 추가 · 치명 피해 후 10초 공격하고 퇴각</span>';
    }
    const required=slot==='aux'?3:5,name=names[slot]|| (slot==='aux'?'보조기술':'최종기술');
    return `<span class="skill-state ${stars>=required?'unlocked':'locked'}">${name}</span>`;
  };
  const skillTitleOnly=value=>{
    if(typeof value!=='string')return value;
    const match=value.match(/^(<span\b[^>]*>)([\s\S]*?)(<\/span>)$/);
    if(match)return `${match[1]}${match[2].split(' · ')[0]}${match[3]}`;
    return value.split(' · ')[0];
  };
  const skillRequirementMarkup=(stars,slot,rarity,ship=null)=>{
    if(ship?.type==='frigate')return '';
    if(slot==='ultimate'&&rarity==='R')return '';
    const required=slot==='aux'?3:5;
    const inactive=ship?.type==='destroyer'&&ship.name==='판도라'&&slot==='aux'&&stars>=5;
    return `<small class="skill-requirement ${stars>=required&&!inactive?'unlocked':'locked'}">${inactive?'비활성화':stars>=required?'개방':`${required}성 강화 필요`}</small>`;
  };
  if(!modal.querySelector('.owned-detail-nav'))modal.insertAdjacentHTML('beforeend','<button type="button" class="owned-detail-nav owned-detail-prev" aria-label="이전 함선">〈</button><button type="button" class="owned-detail-nav owned-detail-next" aria-label="다음 함선">〉</button>');
  let ownedDetailOrder=[],ownedDetailIndex=-1,codexDetailOrder=[],codexDetailIndex=-1;
  const typeLabels={dreadnought:'DreadNought',battlecruiser:'Battlecruiser',destroyer:'Destroyer',frigate:'Frigate'};
  const typeDisplayLabels={dreadnought:'중전함',battlecruiser:'전투순양함',destroyer:'구축함',frigate:'프리깃'};
  const openShipDetailCard=(card,ownedIndex=-1,slideDirection=0)=>{
    const image=card.querySelector('img'),name=card.dataset.shipName||card.querySelector('.owned-ship-name')?.firstChild?.textContent?.trim()||card.querySelector('b')?.textContent||'미확인 함선',codexType=card.dataset.shipType||card.closest('.codex-list')?.dataset.codexType||'dreadnought',type=typeLabels[codexType]||'DreadNought',rarity=card.querySelector('.rarity-badge')?.textContent||'R';
    const codexList=card.closest('.codex-list');
    if(codexList){codexDetailOrder=[...codexList.querySelectorAll('.codex-ship-card')];codexDetailIndex=codexDetailOrder.indexOf(card);ownedDetailIndex=-1;}else if(ownedIndex>=0){codexDetailOrder=[];codexDetailIndex=-1;}else{codexDetailOrder=[];codexDetailIndex=-1;ownedDetailIndex=-1;}
    const ship=ownedCatalogShips.find(candidate=>candidate.type===codexType&&candidate.name===name&&(!card.dataset.frameId||(candidate.frameId===card.dataset.frameId)));
    modal.querySelector('.ship-enhancement-dialog')?.setAttribute('hidden','');
    const detailCard=modal.querySelector('.ship-detail-card');detailCard.classList.remove('carrier-detail','rarity-detail-L','rarity-detail-SSR','rarity-detail-SR','rarity-detail-R','codex-slide-from-left','codex-slide-from-right');detailCard.classList.add(`rarity-detail-${rarity}`);if(name==='우주항모'||rarity==='L')detailCard.classList.add('carrier-detail');if(slideDirection)detailCard.classList.add(slideDirection>0?'codex-slide-from-right':'codex-slide-from-left');
    const variantStars=card.dataset.enhancementStars===''?undefined:Number(card.dataset.enhancementStars),progress=ship?shipProgress(ship,variantStars,rarity):{stars:0,copies:0,rarity};
    modal.querySelector('.ship-detail-image').innerHTML=image?`<img src="${image.src}" alt="${name}"/>${ship?starMarkup(ship,true,variantStars,rarity):''}`:'<span>✦</span>';modal.querySelector('h2').innerHTML=`<span class="ship-detail-name">${name}</span><small>${typeDisplayLabels[codexType]||'함선'}</small>`;modal.querySelector('.ship-detail-class').textContent='';
    // 상세 카드에는 현재 강화 단계가 반영된 최종 전투 수치만 표시한다.
    const profile=ship?.profile;
    const promoted=ship?rarity!==ship.baseRarity:false,durability=enhancedStat(profile?.[0],progress.stars,rarity,promoted),dps=enhancedStat(profile?.[2],progress.stars,rarity,promoted);
    const detailShip={name,type:codexType,baseRarity:ship?.baseRarity},skillStars=retainedSkillStars(detailShip,progress.stars,rarity);
    const actualLabels=['무기 종류','내구도','DPS','핵심기술',`보조기술${skillRequirementMarkup(skillStars,'aux',rarity,detailShip)}`,`최종기술${skillRequirementMarkup(skillStars,'ultimate',rarity,detailShip)}`];
    const actualValues=profile?[weaponLabels(profile,progress.stars),durability===null?'—':durability.toLocaleString('ko-KR'),dps===null?'—':skillAdjustedDps(detailShip,dps,skillStars).toLocaleString('ko-KR'),skillTitleOnly(coreSkillDescription(detailShip,skillStars,profile)),skillTitleOnly(skillStateMarkup(detailShip,skillStars,'aux',rarity)),skillTitleOnly(skillStateMarkup(detailShip,skillStars,'ultimate',rarity))]:['—','—','—','—','—','—'];
    // 기술 칸(핵심·보조·최종)을 누르면 그 기술의 설명을 작은 팝업으로 띄운다.
    const plainSkillText=html=>String(html??'').replace(/<[^>]+>/g,'').trim();
    const skillTitles=['핵심기술','보조기술','최종기술'];
    const skillInfo=SKILL_INFO[`${codexType}:${name}`]||{};const skillDetailText=(slot,fallbackName)=>skillInfo[slot]||`${fallbackName} : 설명 준비 중입니다.`;const skillDetails=profile?[plainSkillText(coreSkillDescription(detailShip,skillStars,profile)),skillDetailText('aux',plainSkillText(skillStateMarkup(detailShip,skillStars,'aux',rarity))),skillDetailText('ultimate',plainSkillText(skillStateMarkup(detailShip,skillStars,'ultimate',rarity)))]:['','',''];
    const skillRequirements=[plainSkillText(skillRequirementMarkup(skillStars,'aux',rarity,detailShip)),plainSkillText(skillRequirementMarkup(skillStars,'ultimate',rarity,detailShip))];
    const statsBox=modal.querySelector('.ship-detail-stats');
    statsBox.innerHTML=actualLabels.map((label,i)=>`<div${i>=3?' class="skill-detail-row" role="button" tabindex="0" data-skill-index="'+(i-3)+'"':''}><b>${label}</b><span>${actualValues[i]}</span></div>`).join('');
    statsBox.onclick=event=>{
      const row=event.target.closest('.skill-detail-row');
      if(!row)return;
      event.stopPropagation();
      const index=Number(row.dataset.skillIndex);
      const requirement=index>0?skillRequirements[index-1]:'';
      showSkillDetailPopup(row,skillTitles[index],skillDetails[index]||'설명 준비 중입니다.',requirement);
    };
    let synthesis=modal.querySelector('.ship-synthesis');
    if(!synthesis){synthesis=document.createElement('div');synthesis.className='ship-synthesis';modal.querySelector('.ship-detail-stats').after(synthesis);}
    if(ship){const cappedByOrigin=ship.baseRarity==='R'&&rarity==='SR',canBreakthrough=progress.stars>=maxStarsFor(ship,rarity)&&rarity!=='L'&&!cappedByOrigin,isMaxed=progress.stars>=maxStarsFor(ship,rarity)&&(rarity==='L'||cappedByOrigin);synthesis.innerHTML=`<button type="button" class="${canBreakthrough?'ship-breakthrough-button':''}" ${isMaxed?'disabled':''}>${canBreakthrough?'돌파':isMaxed?'최고등급':'함선 강화'}</button>`;synthesis.querySelector('button').onclick=event=>{event.preventDefault();event.stopPropagation();if(!isMaxed)openShipEnhancement(ship,card,ownedIndex,variantStars,canBreakthrough?'breakthrough':'enhance',rarity);};}else synthesis.innerHTML='';
    const badge=modal.querySelector('.ship-detail-rarity');badge.textContent=rarity;badge.dataset.rarity=rarity;badge.className=`ship-detail-rarity rarity-badge rarity-${rarity}`;
    ownedDetailIndex=ownedIndex;modal.classList.toggle('owned-detail-mode',ownedIndex>=0);modal.classList.toggle('codex-detail-mode',Boolean(codexList));modal.hidden=false;
  };
  window.openFleetShipDetailByName=(type,name)=>{
    const ship=availableFleetShips.find(item=>item.type===type&&item.name===name);
    if(!ship)return false;
    const card=document.createElement('div');card.dataset.shipType=ship.type;card.dataset.shipName=ship.name;
    const portrait=document.createElement('img');portrait.src=ship.image;portrait.alt=ship.name;card.append(portrait);
    const badge=document.createElement('span');badge.className='rarity-badge';badge.textContent=ship.rarity;card.append(badge);
    openShipDetailCard(card);return true;
  };
  const openOwnedDetailAt=(index,direction=0)=>{if(!ownedDetailOrder.length)return;const nextIndex=(index+ownedDetailOrder.length)%ownedDetailOrder.length,card=screen.querySelector(`.owned-ship-choice[data-owned-index="${nextIndex}"]`);if(card)openShipDetailCard(card,nextIndex,direction);};
  const openCodexDetailAt=(index,direction=0)=>{if(!codexDetailOrder.length)return;const nextIndex=(index+codexDetailOrder.length)%codexDetailOrder.length,card=codexDetailOrder[nextIndex];if(card?.isConnected)openShipDetailCard(card,-1,direction);};
  const stepShipDetail=direction=>{if(modal.classList.contains('codex-detail-mode'))openCodexDetailAt(codexDetailIndex+direction,direction);else openOwnedDetailAt(ownedDetailIndex+direction,direction);};
  modal.querySelector('.owned-detail-prev').onclick=()=>stepShipDetail(-1);
  modal.querySelector('.owned-detail-next').onclick=()=>stepShipDetail(1);
  let detailSwipeStart=null;modal.querySelector('.ship-detail-card').addEventListener('pointerdown',event=>{if(modal.classList.contains('codex-detail-mode')&&!event.target.closest('.owned-detail-nav'))detailSwipeStart={x:event.clientX,y:event.clientY};});modal.querySelector('.ship-detail-card').addEventListener('pointerup',event=>{if(!detailSwipeStart)return;const dx=event.clientX-detailSwipeStart.x,dy=event.clientY-detailSwipeStart.y;detailSwipeStart=null;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.2)stepShipDetail(dx<0?1:-1);});
  screen.addEventListener('click',e=>{const card=e.target.closest('.codex-ship-card');if(!card)return;if(card.classList.contains('fleet-ship-choice')&&!card.classList.contains('owned-ship-choice')){if(card.disabled)return;const pickerPanel=card.closest('.formation-panel'),slotIndex=Number(pickerPanel?.dataset.pickerSlot),catalogShip=availableFleetShips.find(candidate=>candidate.name===card.dataset.shipName&&candidate.type===card.dataset.shipType);if(!pickerPanel?.classList.contains('fleet-ship-picker-popup')||!Number.isInteger(slotIndex)||slotIndex<0||slotIndex>3||!catalogShip)return;const selectedShip={...catalogShip,rarity:card.dataset.variantRarity||catalogShip.rarity,enhancementStars:Number(card.dataset.enhancementStars)||0};if(assignFleetShip(slotIndex,selectedShip))pickerPanel.hidden=true;return;}openShipDetailCard(card,card.classList.contains('owned-ship-choice')?Number(card.dataset.ownedIndex):-1);});
  const oldCards=screen.querySelector('.collection-grid');
  screen.innerHTML='<header class="fleet-heading"><small>TACTICAL FORMATION</small><h1>함대관리</h1></header><div class="formation-power-spacer" aria-hidden="true"></div><div class="formation-stage" aria-label="삼각편대와 프리깃 슬롯"></div><div class="formation-actions"><button type="button" data-panel="hangar">격납고</button></div><div class="formation-panel" hidden><header><h2></h2><button type="button" aria-label="패널 닫기">×</button></header><div class="formation-panel-body"></div></div>';
  const stage=screen.querySelector('.formation-stage');
  // 패널 그림(fleet-formation-board-v5.png) 위의 홀로그램 효과 층: 회전 광택·주황 램프·숨쉬기·주사선 (fleet-formation-board.css)
  stage.insertAdjacentHTML('afterbegin','<div class="board-fx" aria-hidden="true"><i class="board-glow"></i><i class="board-sweep"></i><i class="board-scanlines"></i>'+[[8,2.6],[17,1.2],[83,1.2],[92,2.6],[3,14.5],[2.5,27],[1.2,35],[97,14.5],[97.5,27],[98.8,35],[1.8,90],[98.2,90]].map(([x,y],i)=>'<b class="board-lamp" style="left:'+x+'%;top:'+y+'%;--lamp-delay:'+(-(i*1.37)%4).toFixed(2)+'s;--lamp-speed:'+(2.6+(i%4)*.55).toFixed(2)+'s"></b>').join('')+'</div>');
  stage.prepend(screen.querySelector('.fleet-heading'));
  stage.append(screen.querySelector('.formation-actions'));
  stage.setAttribute('aria-label','Fleet formation panel · four ship slots');
  const hangarButton=screen.querySelector('[data-panel="hangar"]');
  hangarButton.classList.add('fleet-hangar-button');
  hangarButton.setAttribute('aria-label','격납고 · 보유 함선과 함선 도감');hangarButton.title='격납고';
  hangarButton.innerHTML='<span class="fleet-hangar-copy"><b>격납고</b><small>HANGAR</small></span>';
  ['DreadNouht','BattleCruiser','Destroyer','Frigate'].forEach((name,i)=>{stage.insertAdjacentHTML('beforeend',`<div class="formation-slot slot-${i}" data-fleet-slot="${i}" data-slot-role="${name}" aria-label="${name} slot"><div class="hologram-mount"></div><div class="hologram-base" aria-hidden="true"><span>＋</span><span class="hologram-ticker"></span><span class="empty-hologram">함선 배치</span></div><span class="pedestal-label" aria-hidden="true"></span>${i===3?'<span class="frigate-slot-lock" aria-hidden="true">🔒</span><span class="frigate-slot-warning" role="status" hidden></span>':''}</div>`);});
  let power=1280,timer;
  window.getFleetPower=()=>power;
  window.setFleetPower=value=>{
    const next=Number(value);if(!Number.isFinite(next)||next<0)return;const rounded=Math.round(next),delta=rounded-power;if(!delta)return;
    power=rounded;const box=screen.querySelector('.formation-power'),text=screen.querySelector('.formation-power-delta'),powerValue=screen.querySelector('.formation-power-value');
    if(!box||!text||!powerValue)return;
    powerValue.textContent=power.toLocaleString('ko-KR');
    clearTimeout(timer);box.classList.remove('power-up','power-down');void box.offsetWidth;box.classList.add(delta>0?'power-up':'power-down');
    text.textContent=(delta>0?'+':'−')+Math.abs(delta).toLocaleString('ko-KR');timer=setTimeout(()=>{box.classList.remove('power-up','power-down');text.textContent='';},1800);
  };
  const fleetAssignments=Array(4).fill(null),fleetTypeNames={dreadnought:'중전함',battlecruiser:'전투순양함',destroyer:'구축함',frigate:'프리깃'},rarityColors={L:'#ff526d',SSR:'#ffd45b',SR:'#c883ff',R:'#69d8ff'},rarityOrder={L:4,SSR:3,SR:2,R:1},fleetTypeOrder={dreadnought:0,battlecruiser:1,destroyer:2,frigate:3};
  const fleetFormationStorageKey='starfleet-fleet-formation-v1';
  function saveFleetAssignments(){try{localStorage.setItem(fleetFormationStorageKey,JSON.stringify(fleetAssignments.map(ship=>ship?{type:ship.type,name:ship.name,rarity:ship.rarity,enhancementStars:ship.enhancementStars}:null)));}catch{}}
  const isFrigateUnlocked=()=>{try{const saved=JSON.parse(localStorage.getItem('starfleet-tactical-weapon-research-v1')||'{}')||{};return Math.max(Number(saved.frigate?.level)||0,Number(saved.frigateTree?.firepower1)||0)>=1;}catch{return false;}};
  const showFrigateLockWarning=()=>{const slot=stage.querySelector('[data-fleet-slot="3"]'),warning=slot?.querySelector('.frigate-slot-warning');if(!slot||!warning)return;warning.textContent='무기연구-프리깃 개발 필요';warning.hidden=false;clearTimeout(slot.frigateWarningTimer);slot.frigateWarningTimer=setTimeout(()=>{warning.hidden=true;},1800);};
  const syncFrigateSlotLock=()=>{const slot=stage.querySelector('[data-fleet-slot="3"]'),locked=!isFrigateUnlocked(),role=slot?.dataset.slotRole||'Frigate';if(!slot)return;slot.classList.toggle('frigate-locked',locked);if(locked&&fleetAssignments[3]?.type==='frigate'){fleetAssignments[3]=null;renderFleetSlot(3);saveFleetAssignments();}else slot.setAttribute('aria-label',locked?`${role} slot · locked · frigate research required`:slot.classList.contains('occupied')?`${role} slot · ${fleetAssignments[3]?.name} assigned`:`${role} slot · empty`);};
  window.addEventListener('tactical-research-updated',event=>{if(event.detail?.field==='frigate')syncFrigateSlotLock();});
  window.getFleetAssignments=()=>fleetAssignments.map(ship=>{if(!ship)return null;let progress=shipProgress(ship,ship.enhancementStars,ship.rarity);if(progress.copies<1)progress=shipProgress(ship,undefined,ship.rarity);ship.enhancementStars=progress.stars;return {...ship,enhancementStars:progress.stars};});
  window.getFleetCatalog=()=>availableFleetShips.map(ship=>({...ship,enhancementStars:shipProgress(ship).stars,copies:shipProgress(ship).copies}));
  window.getOwnedShipVariants=()=>availableFleetShips.flatMap(ship=>shipVariants(ship).map(item=>({type:ship.type,name:ship.name,image:ship.image,weapon:ship.profile?.[1]||'',rarity:item.rarity,stars:item.stars,copies:item.copies})));
  // 임무 파견 직후 호출: 파견된 함선을 함대 편성 슬롯에서 빼고 저장한다.
  window.refreshFleetAfterReservation=()=>{let changed=false;fleetAssignments.forEach((ship,index)=>{if(!ship)return;let progress=shipProgress(ship,ship.enhancementStars,ship.rarity);if(progress.copies<1)progress=shipProgress(ship,undefined,ship.rarity);if(progress.copies<1){fleetAssignments[index]=null;renderFleetSlot(index);changed=true;}});if(changed)saveFleetAssignments();};
  window.getOwnedFleetVariants=()=>availableFleetShips.flatMap(ship=>shipVariants(ship).filter(variant=>variant.copies>0).map(variant=>({...ship,...variant})));
  // Share the fleet-management enhancement rules with the independent PvP simulator.
  // 아레나 가동률: 페가수스 관통 레이저는 4초 발사 후 3초 재장전(주기 7초)이라 DPS를 57%로 계산한다. 코덱스 표시와 PvE는 변하지 않는다.
  const arenaDpsUptime=ship=>ship?.type==='destroyer'&&ship.name==='페가수스'?4/7:1;
  window.getArenaShipBaseStats=ship=>{
    const stars=Number(ship.enhancementStars??ship.stars)||0,rarity=ship.rarity||'R';
    const promoted=rarity!==ship.baseRarity,skillStars=retainedSkillStars(ship,stars,rarity);
    return {hp:2*enhancedStat(ship.profile?.[0],stars,rarity,promoted),dps:arenaDpsUptime(ship)*skillAdjustedDps(ship,enhancedStat(ship.profile?.[2],stars,rarity,promoted)||0,skillStars),skillStars,factor:enhancedStat(1000,stars,rarity,promoted)/1000};
  };
  const adjustVariantCopies=(ship,stars,delta,rarityOverride)=>{const variants=shipVariants(ship),index=variants.findIndex(item=>item.stars===stars&&(!rarityOverride||item.rarity===rarityOverride));if(index<0&&delta<0)return false;if(index<0)variants.push({stars,copies:delta,rarity:rarityOverride||ship.rarity});else variants[index].copies+=delta;const cleaned=variants.filter(item=>item.copies>0),base=ship.rarity;enhancementState[shipKey(ship)]={variants:cleaned.map(item=>({...item,stars:Math.min(maxStarsFor(ship,item.rarity||base),item.stars),rarity:item.rarity||base}))};return true;};
  const materialRequirement=(nextStars,rarity)=>rarity==='R'?1:(nextStars===3||nextStars===5?2:1);
  const materialStarRequirement=(nextStars,targetRarity,currentStars)=>targetRarity==='R'?currentStars:(nextStars===1?0:1);
  const sameShip=(a,b)=>a.name===b.name&&a.type===b.type&&a.rarity===b.rarity&&!a.isFrame&&!b.isFrame;
  const sameMaterialOption=(a,b)=>{
    if(!a||!b)return false;
    if(a.inventoryItemId||b.inventoryItemId)return Boolean(a.inventoryItemId&&b.inventoryItemId&&a.inventoryItemId===b.inventoryItemId&&a.rarity===b.rarity);
    return Boolean(a.ship&&b.ship&&shipKey(a.ship)===shipKey(b.ship)&&a.stars===b.stars&&a.rarity===b.rarity);
  };
  const needsIdenticalOneStar=(nextStars,rarity)=>rarity!=='R'&&(nextStars===3||nextStars===5);
  const isIdenticalOneStarMaterial=(target,item,rarity)=>!item.inventoryItemId&&item.stars===1&&item.rarity===rarity&&sameShip(target,item.ship);
  const sameFrame=(a,b)=>a.isFrame&&b.isFrame&&a.frameId===b.frameId&&a.rarity===b.rarity;
  const weaponTypesFor=ship=>ship?.type==='destroyer'&&ship.name==='판도라'?['미사일','함포','레이저포','전기','관통레이저']:String(ship?.profile?.[1]||'').split('·').map(value=>value.replace(/\s/g,'')).filter(Boolean);
  const sharesWeaponType=(left,right)=>weaponTypesFor(left).some(weapon=>weaponTypesFor(right).includes(weapon));
  const compatibleFrame=(target,candidate)=>candidate.isFrame&&candidate.rarity===target.rarity&&candidate.type===target.type&&sharesWeaponType(target,candidate);
  const compatibleSameTierShip=(target,candidate,targetRarity,nextStars)=>targetRarity==='SR'&&nextStars>=2&&!candidate.isFrame&&candidate.name!==target.name&&candidate.type===target.type&&(candidate.profile?.[1]===target.profile?.[1])&&shipVariants(candidate).some(item=>item.rarity===targetRarity);
  const materialOptions=(target,currentStars,nextStars,targetRarity=target.rarity)=>{
    const requiredStars=materialStarRequirement(nextStars,targetRarity,currentStars);
    const weapons=weaponTypesFor(target);
    const frameOptions=['R','SR','SSR'].includes(targetRarity)?Object.entries(window.getExplorationLootInventory?.()||{}).flatMap(([itemId,count])=>{
      const item=explorationLootCatalog[itemId],amount=Math.max(0,Math.floor(Number(count)||0));
      if(!item||item.category!=='frame'||!amount||!weapons.includes(String(item.weapon||'').replace(/\s/g,'')))return [];
      return [{ship:{name:item.name,frameLabel:`무기종류: ${item.weapon} · 함선골조`,type:target.type,frameId:itemId,isFrame:true,rarity:targetRarity,image:item.image,profile:[null,item.weapon]},stars:requiredStars,copies:amount,rarity:targetRarity,inventoryItemId:itemId}];
    }):[];
    return [...ownedCatalogShips.flatMap(candidate=>{
      const frameCandidate=candidate.isFrame&&compatibleFrame(target,candidate);
      const pandoraPair=(target.name==='판도라'||candidate.name==='판도라')&&!candidate.isFrame&&candidate.name!==target.name&&sharesWeaponType(target,candidate);
      const allowed=targetRarity==='R'?(sameShip(target,candidate)||frameCandidate):(sameShip(target,candidate)||compatibleSameTierShip(target,candidate,targetRarity,nextStars)||pandoraPair||frameCandidate);
      if(!allowed)return [];
      const entry=shipVariants(candidate).find(item=>item.stars===requiredStars&&item.rarity===targetRarity);if(!entry)return [];
      const isCurrentVariant=shipKey(candidate)===shipKey(target)&&requiredStars===currentStars;
      const available=Math.max(0,entry.copies-(isCurrentVariant?1:0));
      return available?[{ship:candidate,stars:requiredStars,copies:available,rarity:entry.rarity}]:[];
    }),...frameOptions];
  };
  const breakthroughOptions=(target,currentStars,currentRarity)=>ownedCatalogShips.flatMap(candidate=>{const allowed=sameShip(target,candidate)&&candidate.rarity===target.rarity;if(!allowed)return [];const entry=shipVariants(candidate).find(item=>item.stars===currentStars&&item.rarity===currentRarity);if(!entry)return [];const available=Math.max(0,entry.copies-(shipKey(candidate)===shipKey(target)?1:0));return available?[{ship:candidate,stars:currentStars,copies:available,rarity:entry.rarity}]:[];});
  const performBreakthrough=(target,currentStars,currentRarity,material)=>{const promotedRarity=nextRarity(currentRarity);if(!material||promotedRarity===currentRarity||currentRarity==='L')return false;adjustVariantCopies(material.ship,material.stars,-1,material.rarity);adjustVariantCopies(target,currentStars,-1,currentRarity);adjustVariantCopies(target,0,1,promotedRarity);if(target.name==='가루다')syncGarudaFleetVariant(currentStars,0,currentRarity,promotedRarity);saveShipProgress();window.notice?.(`${target.name} ${promotedRarity}급 돌파 완료`);return true;};
  window.combineFleetShips=(shipOrName,starsOverride,selectedMaterials,rarityOverride)=>{
    const ship=typeof shipOrName==='string'?availableFleetShips.find(candidate=>candidate.name===shipOrName):shipOrName,targetRarity=rarityOverride||ship?.rarity,targetStars=Number.isFinite(Number(starsOverride))?Number(starsOverride):shipProgress(ship,undefined,targetRarity).stars,nextStars=targetStars+1;
    if(!ship?.type||!ship?.name||targetStars>=maxStarsFor(ship,targetRarity))return false;
    const required=materialRequirement(nextStars,targetRarity),options=materialOptions(ship,targetStars,nextStars,targetRarity);
    const chosen=Array.isArray(selectedMaterials)?selectedMaterials:(()=>{const picks=[],mandatory=needsIdenticalOneStar(nextStars,targetRarity)?options.find(item=>isIdenticalOneStarMaterial(ship,item,targetRarity)):null;if(mandatory)picks.push(mandatory);for(const option of options){while(picks.length<required&&picks.filter(item=>item===option).length<option.copies)picks.push(option);if(picks.length===required)break;}return picks;})();
    if(chosen.length!==required)return false;
    if(needsIdenticalOneStar(nextStars,targetRarity)&&!chosen.some(item=>isIdenticalOneStarMaterial(ship,item,targetRarity)))return false;
    const materialCounts=new Map();
    for(const item of chosen){
      const option=options.find(candidate=>sameMaterialOption(candidate,item));
      if(!option)return false;
      const key=option.inventoryItemId?`inventory:${option.inventoryItemId}`:`ship:${shipKey(option.ship)}:${option.rarity}:${option.stars}`;
      const used=(materialCounts.get(key)||0)+1;if(used>option.copies)return false;materialCounts.set(key,used);
    }
    const frameCosts=chosen.filter(item=>item.inventoryItemId).map(item=>({itemId:item.inventoryItemId,amount:1}));
    if(frameCosts.length&&!window.consumeExplorationLootBatch?.(frameCosts))return false;
    adjustVariantCopies(ship,targetStars,-1,targetRarity);chosen.forEach(item=>{if(!item.inventoryItemId)adjustVariantCopies(item.ship,item.stars,-1,item.rarity);});adjustVariantCopies(ship,nextStars,1,targetRarity);if(ship.name==='가루다')syncGarudaFleetVariant(targetStars,nextStars,targetRarity,targetRarity);saveShipProgress();window.dispatchEvent(new CustomEvent('fleet-enhancement-completed',{detail:{ship:ship.name,stars:nextStars}}));window.notice?.(`${ship.name} 강화 완료 · ★ ${nextStars}`);return true;
  };
  const openShipEnhancement=(ship,card,ownedIndex,variantStars,mode='enhance',currentRarity=ship.rarity)=>{
    const breakthrough=mode==='breakthrough',progress=shipProgress(ship,variantStars,currentRarity),currentStars=progress.stars,maxStars=maxStarsFor(ship,currentRarity),isMax=currentStars>=maxStars,nextStars=breakthrough?currentStars:Math.min(maxStars,currentStars+1),promotedRarity=breakthrough?nextRarity(currentRarity):currentRarity,required=breakthrough?1:materialRequirement(nextStars,currentRarity),options=breakthrough?breakthroughOptions(ship,currentStars,currentRarity):(isMax?[]:materialOptions(ship,currentStars,nextStars,currentRarity));let selected=[];
    let dialog=modal.querySelector('.ship-enhancement-dialog');if(!dialog){dialog=document.createElement('section');dialog.className='ship-enhancement-dialog';modal.querySelector('.ship-detail-card').append(dialog);}
    const rate=Math.round((enhancementConfig.statRateByRarity[currentRarity]||.2)*100),image=ship.image;
    const statRows=(stars,after=false)=>{const displayRarity=after?promotedRarity:currentRarity,promoted=displayRarity!==ship.baseRarity,bonus=after?(breakthrough||currentRarity!==ship.baseRarity):currentRarity!==ship.baseRarity,durability=enhancedStat(ship.profile?.[0],stars,displayRarity,bonus),dps=enhancedStat(ship.profile?.[2],stars,displayRarity,bonus),skillStars=retainedSkillStars(ship,stars,displayRarity),featured=ship.type==='frigate'||ship.type==='destroyer'&&(['판도라','바랴그','가루다'].includes(ship.name)),skill=featured?coreSkillDescription(ship,skillStars,ship.profile):ship.profile?.[4]||'없음',aux=featured?skillStateMarkup(ship,skillStars,'aux',displayRarity):stars>=3||promoted?'개방':'3성 달성 시 개방',ultimate=featured?skillStateMarkup(ship,skillStars,'ultimate',displayRarity):displayRarity==='R'?'없음':stars>=5||promoted?'개방':'5성 달성 시 개방';return `<div><b>무기 종류</b><span class="${after?'enhancement-next':''}">${weaponLabels(ship.profile,skillStars)}</span></div><div><b>내구도</b><span class="${after?'enhancement-next':''}">${durability===null?'—':durability.toLocaleString('ko-KR')}</span></div><div><b>DPS</b><span class="${after?'enhancement-next':''}">${dps===null?'—':skillAdjustedDps(ship,dps,skillStars).toLocaleString('ko-KR')}</span></div><div><b>핵심기술</b><span class="${after?'enhancement-next':''}">${skillTitleOnly(skill)}</span></div><div><b>보조기술</b><span class="${after?'enhancement-next':''}">${skillTitleOnly(aux)}</span></div><div><b>최종기술</b><span class="${after?'enhancement-next':''}">${skillTitleOnly(ultimate)}</span></div>`;};
    const optionLabel=item=>item.ship.isFrame?item.ship.frameLabel:item.ship.name;
    const optionWithStars=item=>item.ship.isFrame?`${item.rarity}급 · ${optionLabel(item)}`:`${item.rarity}급 · ${optionLabel(item)} · ${item.stars}성`;
    const render=()=>{
      const identicalRequired=!breakthrough&&needsIdenticalOneStar(nextStars,currentRarity),hasIdentical=!identicalRequired||selected.some(item=>isIdenticalOneStarMaterial(ship,item,currentRarity));
      const enough=selected.length>=required&&hasIdentical&&(breakthrough||!isMax);
      dialog.innerHTML=`<h3 class="enhancement-title${breakthrough?' breakthrough-title':''}">${breakthrough?'돌파':'함선 강화'}</h3><div class="enhancement-preview-row"><div class="enhancement-preview current"><div class="enhancement-portrait"><img src="${image}" alt="${ship.name}"/>${starMarkup(ship,true,variantStars,currentRarity)}</div><b>${ship.name}</b></div><div class="enhancement-arrow">＋</div><div class="enhancement-material-slots">${Array.from({length:required},(_,slot)=>{const item=selected[slot];return `<button type="button" class="enhancement-material-slot${item?' filled':''}" data-material-slot="${slot}">${item?`<img src="${item.ship.image}" alt="${optionWithStars(item)}"/><b>${optionWithStars(item)}</b><small>강화재료</small>`:'<span>함선 선택</span>'}</button>`}).join('')}</div></div><div class="enhancement-status-grid"><section><h4>현재</h4>${statRows(currentStars)}</section><section><h4>${breakthrough?'돌파 후 +50%':`강화 후 +${rate}%`}</h4>${statRows(nextStars,true)}</section></div><div class="enhancement-material-list"><small>선택 가능한 강화재료${identicalRequired?' · 동일 함선 1성 1척 필수':''}</small>${options.length?options.map((item,optionIndex)=>{const used=selected.filter(selectedItem=>sameMaterialOption(selectedItem,item)).length;return `<button type="button" class="enhancement-material-option${used?' selected':''}" data-material-option="${optionIndex}" ${used>=item.copies&&!used?'disabled':''}><img src="${item.ship.image}" alt="${optionWithStars(item)}"/><span>${optionWithStars(item)}</span><em>${used}/${item.copies}</em></button>`}).join(''):'<p>사용 가능한 강화재료가 없습니다.</p>'}</div><div class="ship-enhancement-actions"><button type="button" class="ship-enhancement-confirm" ${enough?'':'disabled'}>${breakthrough?(enough?'돌파 실행':'재료를 선택하세요'):(isMax?'최대 강화 완료':enough?'강화 실행':identicalRequired&&!hasIdentical?'동일 함선 1성 필수':'재료를 선택하세요')}</button><button type="button" class="ship-enhancement-cancel">취소</button></div>`;
      dialog.hidden=false;
      dialog.querySelectorAll('.enhancement-material-option').forEach(button=>button.onclick=()=>{const item=options[Number(button.dataset.materialOption)];if(!item)return;const selectedIndices=selected.map((selectedItem,index)=>sameMaterialOption(selectedItem,item)?index:-1).filter(index=>index>=0),used=selectedIndices.length;if(used<item.copies&&selected.length<required)selected.push(item);else if(used)selected.splice(selectedIndices[selectedIndices.length-1],1);render();});
      dialog.querySelectorAll('.enhancement-material-slot.filled').forEach(button=>button.onclick=()=>{selected.splice(Number(button.dataset.materialSlot),1);render();});
      dialog.querySelector('.ship-enhancement-cancel').onclick=event=>{event.preventDefault();event.stopPropagation();dialog.hidden=true;};
      dialog.querySelector('.ship-enhancement-confirm').onclick=event=>{event.preventDefault();event.stopPropagation();if(!enough)return;const completed=breakthrough?performBreakthrough(ship,currentStars,currentRarity,selected[0]):window.combineFleetShips(ship,variantStars,selected,currentRarity);if(!completed)return;if(breakthrough){card.dataset.enhancementStars='0';card.dataset.variantRarity=promotedRarity;const badge=card.querySelector('.rarity-badge');if(badge){badge.textContent=promotedRarity;badge.className=`rarity-badge rarity-${promotedRarity}`;}}else{card.dataset.enhancementStars=String(nextStars);card.dataset.variantRarity=currentRarity;}dialog.hidden=true;const sheet=screen.querySelector('.owned-library-sheet');if(sheet)renderOwnedLibrary(sheet);openShipDetailCard(card,ownedIndex);window.refreshFleetSlotStars?.();
        // SSR·L급 별승급과 SSR→L 돌파는 전용 연출을 함선 정보 화면 위에 띄웁니다.
        const ascends=breakthrough?(currentRarity==='SSR'&&promotedRarity==='L')||(currentRarity==='SR'&&promotedRarity==='SSR'):['SR','SSR','L'].includes(currentRarity);
        if(ascends&&window.playShipAscension){
          const bonus=currentRarity!==ship.baseRarity,durabilityAt=stars=>enhancedStat(ship.profile?.[0],stars,currentRarity,bonus);
          const dpsAt=stars=>{const value=enhancedStat(ship.profile?.[2],stars,currentRarity,bonus);return value===null?null:skillAdjustedDps(ship,value,retainedSkillStars(ship,stars,currentRarity));};
          window.playShipAscension({mode:breakthrough?'breakthrough':'star',name:ship.name,image,rarity:currentRarity,toRarity:promotedRarity,fromStars:currentStars,toStars:nextStars,maxStars,rate,stats:breakthrough?[]:[{label:'내구도',from:durabilityAt(currentStars),to:durabilityAt(nextStars)},{label:'DPS',from:dpsAt(currentStars),to:dpsAt(nextStars)}]});
        }
      };
    };
    render();
  };
  const cardClass=ship=>`${ship.name==='우주항모'?' carrier-card':''}${ship.name==='히페리온'?' hyperion-card':''}${ship.name==='콜로서스'?' colossus-card':''}${ship.name==='페가수스'?' pegasus-card':''}${ship.name==='과학 드론'?' science-drone-card':''}${ship.name==='리틀보이'?' littleboy-card':''}`;
  const sortedFleetShips=(mode='rarity')=>[...availableFleetShips].sort((a,b)=>mode==='type'?(fleetTypeOrder[a.type]-fleetTypeOrder[b.type])||(rarityOrder[b.rarity]-rarityOrder[a.rarity])||a.name.localeCompare(b.name,'ko'):(rarityOrder[b.rarity]-rarityOrder[a.rarity])||a.name.localeCompare(b.name,'ko')||(fleetTypeOrder[a.type]-fleetTypeOrder[b.type]));
  const sortedOwnedShips=(mode='rarity')=>[...ownedCatalogShips].sort((a,b)=>mode==='type'?(fleetTypeOrder[a.type]-fleetTypeOrder[b.type])||(rarityOrder[b.rarity]-rarityOrder[a.rarity])||(a.frameLabel||a.name).localeCompare(b.frameLabel||b.name,'ko'):(rarityOrder[b.rarity]-rarityOrder[a.rarity])||(a.frameLabel||a.name).localeCompare(b.frameLabel||b.name,'ko')||(fleetTypeOrder[a.type]-fleetTypeOrder[b.type]));
  const showBulkEnhancementResults=(promotions,targetStars)=>{
    document.getElementById('bulk-enhancement-result')?.remove();
    const total=promotions.reduce((sum,item)=>sum+item.count,0);
    const overlay=document.createElement('div');
    overlay.id='bulk-enhancement-result';
    overlay.className='one-star-enhancement-result';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-label','일괄 강화 결과');
    // 등급별로 묶어서 L → SSR → SR → R 순으로 보여 준다.
    const groupedRarities=[...new Set(promotions.map(item=>item.rarity))].sort((a,b)=>(rarityOrder[b]||0)-(rarityOrder[a]||0));
    const groupMarkup=groupedRarities.map(rarity=>{const items=promotions.filter(item=>item.rarity===rarity);const groupCount=items.reduce((sum,item)=>sum+item.count,0);return `<section class="one-star-result-group"><h3 class="one-star-result-rarity rarity-${rarity}">${rarity}급 <small>${groupCount}척</small></h3><div class="one-star-enhancement-result-grid">${items.map(({ship,count})=>`<div class="one-star-enhancement-result-item"><span class="one-star-enhancement-result-image">${ship.image?`<img src="${ship.image}" alt="${ship.name}"/>`:'<i>✦</i>'}<b aria-label="${targetStars}성">${'★'.repeat(targetStars)}</b></span><strong>${ship.name}</strong><small>${rarity} · ${targetStars}성 ×${count}</small></div>`).join('')}</div></section>`;}).join('');
    overlay.innerHTML=`<section class="one-star-enhancement-result-panel"><h2>★ 일괄 강화 완료</h2><p>${total}척의 함선이 ${targetStars}성으로 강화되었습니다.</p>${groupMarkup}<small class="one-star-enhancement-result-hint">화면을 누르면 닫힙니다</small></section>`;
    overlay.addEventListener('click',()=>overlay.remove());
    document.body.append(overlay);
  };
  const showBulkButtonNotice=(button,message)=>{
    if(!button)return;
    document.getElementById('owned-bulk-button-notice')?.remove();
    const rect=button.getBoundingClientRect(),notice=document.createElement('span');
    notice.id='owned-bulk-button-notice';notice.className='owned-bulk-no-material';notice.textContent=message;
    notice.style.left=`${rect.left+rect.width/2}px`;notice.style.top=`${Math.max(8,rect.top-7)}px`;
    document.body.append(notice);setTimeout(()=>notice.remove(),1000);
  };
  const promoteAllZeroStarShips=sheet=>{
    const promotions=[];
    ownedCatalogShips.filter(ship=>!ship.isFrame).forEach(ship=>{
      shipVariants(ship).filter(variant=>variant.stars===0&&variant.copies>=2).forEach(variant=>{
        const pairs=Math.floor(variant.copies/2),rarity=variant.rarity||ship.rarity;
        if(!pairs||maxStarsFor(ship,rarity)<1)return;
        adjustVariantCopies(ship,0,-pairs*2,rarity);
        adjustVariantCopies(ship,1,pairs,rarity);
        promotions.push({ship,rarity,count:pairs});
      });
    });
    if(!promotions.length){showBulkButtonNotice(sheet.querySelector('.owned-one-star-enhance'),'모두 완료');return;}
    saveShipProgress();
    renderOwnedLibrary(sheet);
    showBulkEnhancementResults(promotions,1);
  };
  window.runOneStarBulkEnhancement=()=>{const sheet=screen.querySelector('.owned-library-sheet');if(sheet)promoteAllZeroStarShips(sheet);};
  const promoteRShipsOneStep=sheet=>{
    const rShips=ownedCatalogShips.filter(ship=>!ship.isFrame&&ship.rarity==='R');
    const showNoMaterialNotice=()=>showBulkButtonNotice(sheet.querySelector('.owned-r-two-star-enhance'),'재료 없음');
    let sourceStars=-1;
    for(let stars=0;stars<=3;stars++){
      if(rShips.some(ship=>maxStarsFor(ship,'R')>=stars&&shipVariants(ship).some(variant=>(variant.rarity||ship.rarity)==='R'&&variant.stars===stars&&variant.copies>=2))){sourceStars=stars;break;}
    }
    if(sourceStars<0){showNoMaterialNotice();return;}
    const promotions=[];
    rShips.forEach(ship=>{
      const variant=shipVariants(ship).find(item=>(item.rarity||ship.rarity)==='R'&&item.stars===sourceStars&&item.copies>=2);
      if(!variant)return;
      const pairs=Math.floor(variant.copies/2);
      if(sourceStars<3){
        const targetStars=sourceStars+1;
        if(maxStarsFor(ship,'R')<targetStars)return;
        adjustVariantCopies(ship,sourceStars,-pairs*2,'R');
        adjustVariantCopies(ship,targetStars,pairs,'R');
        promotions.push({ship,rarity:'R',count:pairs});
      }else{
        adjustVariantCopies(ship,3,-pairs*2,'R');
        adjustVariantCopies(ship,0,pairs,'SR');
        promotions.push({ship,rarity:'SR',count:pairs});
      }
    });
    if(!promotions.length){window.notice?.('강화 가능한 R급 함선이 없습니다.');return;}
    const targetStars=sourceStars===3?0:sourceStars+1;
    const total=promotions.reduce((sum,item)=>sum+item.count,0);
    saveShipProgress();
    renderOwnedLibrary(sheet);
    showBulkEnhancementResults(promotions,targetStars);
    const title=sourceStars===3?'R급 3성 돌파':`R급 ${sourceStars}성 → ${targetStars}성 강화`;
    const heading=document.querySelector('#bulk-enhancement-result .one-star-enhancement-result-panel h2');
    const description=document.querySelector('#bulk-enhancement-result .one-star-enhancement-result-panel>p');
    if(heading)heading.textContent=`${title} 완료`;
    if(description)description.textContent=sourceStars===3?`${total}척을 SR급 0성으로 돌파했습니다.`:`${total}척의 함선을 ${targetStars}성으로 강화했습니다.`;
  };
  window.runRTwoStarBulkEnhancement=()=>{const sheet=screen.querySelector('.owned-library-sheet');if(sheet)promoteRShipsOneStep(sheet);};
  const fleetShipKey=ship=>ship?`${ship.type||''}:${ship.name||''}`:'';
  function syncGarudaFleetVariant(fromStars,toStars,fromRarity,toRarity){fleetAssignments.forEach(assigned=>{if(assigned?.type==='destroyer'&&assigned.name==='가루다'&&assigned.rarity===fromRarity&&Number(assigned.enhancementStars||0)===fromStars){assigned.enhancementStars=toStars;assigned.rarity=toRarity;}});}
  const renderFleetSlot=index=>{
    const slot=stage.querySelector(`[data-fleet-slot="${Number(index)}"]`),ship=fleetAssignments[index];if(!slot)return;
    const mount=slot.querySelector('.hologram-mount'),base=slot.querySelector('.hologram-base'),ticker=base.querySelector('.hologram-ticker'),pedestalLabel=slot.querySelector('.pedestal-label');mount.replaceChildren();
    if(ship?.image){const image=document.createElement('img');image.src=ship.image;image.alt=ship.name||'편성 함선';mount.append(image);}
    const shipType=ship?(fleetTypeNames[ship.type]||'함선'):'';const label=ship?`${shipType} ${ship.name}`:'';ticker.textContent=label;pedestalLabel.className=`pedestal-label${ship?` rarity-label-${ship.rarity||'R'}`:''}`;pedestalLabel.innerHTML=ship?`<small>${shipType}</small><b>${ship.name}</b>`:'';slot.dataset.shipLabel=label;slot.style.setProperty('--ship-rarity-color',rarityColors[ship?.rarity]||'#69d8ff');base.style.setProperty('--ship-rarity-color',rarityColors[ship?.rarity]||'#69d8ff');base.className=`hologram-base${ship?` pedestal-${ship.rarity||'R'}`:''}`;
    // 별등급(A안): 함선 이름 바로 위에 최대 별 칸을 모두 보여주고, 강화한 만큼 금빛으로 채웁니다. 최대 성이면 빛납니다.
    // 프리깃은 별등급이 없으므로 별 줄을 만들지 않습니다.
    slot.querySelector('.slot-star-row')?.remove();
    // 편성된 별 단계가 강화로 소진됐으면 getFleetAssignments 와 같이 보유한 최고 단계로 표시합니다.
    if(ship&&ship.type!=='frigate'){let progress=shipProgress(ship,ship.enhancementStars,ship.rarity);if(progress.copies<1)progress=shipProgress(ship,undefined,ship.rarity);const stars=progress.stars,maxStars=maxStarsFor(ship,ship.rarity),row=document.createElement('span');row.className=`slot-star-row${stars>=maxStars?' is-max':''}`;row.setAttribute('aria-label',`${stars}성 / 최대 ${maxStars}성`);row.innerHTML=Array.from({length:maxStars},(_,star)=>`<i class="${star<stars?'on':''}" aria-hidden="true">★</i>`).join('');pedestalLabel.append(row);}
    slot.classList.toggle('occupied',!!ship);slot.draggable=!!ship;
    if(Number(index)===3)slot.classList.toggle('frigate-locked',!isFrigateUnlocked());
    slot.setAttribute('aria-label',Number(index)===3&&!isFrigateUnlocked()?`${slot.dataset.slotRole} slot · locked · frigate research required`:ship?`${slot.dataset.slotRole} slot · ${ship.name} assigned`:`${slot.dataset.slotRole} slot · empty`);
  };
  // 강화·돌파 후나 함대관리 화면에 들어올 때 슬롯의 별 줄을 최신 상태로 다시 그립니다.
  const refreshFleetSlots=()=>fleetAssignments.forEach((_,index)=>renderFleetSlot(index));
  window.refreshFleetSlotStars=refreshFleetSlots;
  window.addEventListener('fleet-enhancement-completed',refreshFleetSlots);
  window.addEventListener('game-screen-changed',event=>{if(event.detail?.screen==='collection')refreshFleetSlots();});
  const assignFleetShip=(index,ship)=>{
    if(Number(index)===3&&ship&&!isFrigateUnlocked())return false;
    if(Number(index)===3&&ship&&ship.type!=='frigate')return false;
    if(ship&&fleetAssignments.some((assigned,assignedIndex)=>assignedIndex!==index&&fleetShipKey(assigned)===fleetShipKey(ship)))return false;
    fleetAssignments[index]=ship?{...ship}:null;renderFleetSlot(index);saveFleetAssignments();
    window.dispatchEvent(new CustomEvent('fleet-slot-assigned',{detail:{slot:Number(index),ship:ship?.name||null}}));
    return true;
  };
  try{
    const saved=JSON.parse(localStorage.getItem(fleetFormationStorageKey)||'[]');
    if(Array.isArray(saved))saved.slice(0,4).forEach((entry,index)=>{
      if(!entry||index===3&&!isFrigateUnlocked())return;
      const catalog=availableFleetShips.find(ship=>ship.type===entry.type&&ship.name===entry.name);
      const variant=catalog&&shipVariants(catalog).find(item=>item.copies>0&&item.rarity===entry.rarity&&item.stars===entry.enhancementStars)||catalog&&shipVariants(catalog).find(item=>item.copies>0);
      if(catalog&&variant)assignFleetShip(index,{...catalog,rarity:variant.rarity,enhancementStars:variant.stars});
    });
  }catch{}
  window.setFleetSlot=(index,imageUrl,name)=>{const slotIndex=Number(index);if(!Number.isInteger(slotIndex)||slotIndex<0||slotIndex>3)return;assignFleetShip(slotIndex,imageUrl?{name:name||'편성 함선',image:imageUrl}:null);};
  window.acquireFleetShip=(ship,imageUrl)=>{
    const resolved=typeof ship==='string'?availableFleetShips.find(candidate=>candidate.name===ship)||{name:ship,image:imageUrl}:ship;
    if(!resolved)return false;
    if(resolved.isFrame||availableFleetShips.some(candidate=>fleetShipKey(candidate)===fleetShipKey(resolved))){const variants=shipVariants(resolved),base=variants.find(item=>item.stars===0);if(base)base.copies+=1;else variants.push({stars:0,copies:1});enhancementState[shipKey(resolved)]={variants};saveShipProgress();}
    if(resolved.isFrame)return false;
    const firstEmpty=fleetAssignments.findIndex((candidate,index)=>!candidate&&(index!==3||resolved?.type==='frigate'));if(firstEmpty<0||fleetAssignments.some(candidate=>fleetShipKey(candidate)===fleetShipKey(resolved)))return false;
    return assignFleetShip(firstEmpty,resolved);
  };
  window.addEventListener('fleet-ship-acquired',event=>window.acquireFleetShip(event.detail));
  const legacySummonCard=window.summonCard;
  const shipDiscoveryStorageKey='starfleet-discovered-ships-v2';
  let discoveredShips={};
  try{discoveredShips=JSON.parse(localStorage.getItem(shipDiscoveryStorageKey)||'{}')||{};}catch{discoveredShips={};}
  const saveDiscoveredShips=()=>{try{localStorage.setItem(shipDiscoveryStorageKey,JSON.stringify(discoveredShips));}catch{}};
  const firstTokenEventKey='starfleet-first-token-event-v1';
  window.purchaseFirstTokenEvent=()=>{
    if(localStorage.getItem(firstTokenEventKey)==='claimed')return {ok:false,reason:'이미 구매한 이벤트입니다.'};
    const turtle=availableFleetShips.find(ship=>ship.type==='battlecruiser'&&ship.name==='거북선');
    if(!turtle)return {ok:false,reason:'보상 함선을 찾지 못했습니다.'};
    let savedResources={};try{savedResources=JSON.parse(localStorage.getItem(gameResourceStorageKey)||'{}')||{};}catch{}
    const resources={...(window.gameResources||{}),...savedResources},tokens=Math.max(0,Math.floor(Number(resources.lionToken)||0));
    if(tokens<1)return {ok:false,reason:'사자증표가 부족합니다.'};
    const loot=readExplorationLoot(),variants=shipVariants(turtle).map(item=>({...item}));
    const base=variants.find(item=>item.stars===0&&item.rarity===turtle.rarity);
    if(base)base.copies+=1;else variants.push({stars:0,copies:1,rarity:turtle.rarity});
    const nextEnhancement={...enhancementState,[shipKey(turtle)]:{variants}};
    const nextDiscovery={...discoveredShips,[shipKey(turtle)]:true};
    const nextResources={...resources,lionToken:tokens-1};
    const nextLoot={...loot,scoutTron:(Number(loot.scoutTron)||0)+10,researchStaff:(Number(loot.researchStaff)||0)+10,frameMissile:(Number(loot.frameMissile)||0)+1};
    const entries=[[gameResourceStorageKey,nextResources],[explorationLootStorageKey,nextLoot],[enhancementStorageKey,nextEnhancement],[shipDiscoveryStorageKey,nextDiscovery],[firstTokenEventKey,'claimed']];
    const previous=entries.map(([key])=>[key,localStorage.getItem(key)]);
    try{for(const [key,value] of entries)localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value));}
    catch{for(const [key,value] of previous){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}}return {ok:false,reason:'저장에 실패했습니다. 다시 시도해 주세요.'};}
    enhancementState=nextEnhancement;discoveredShips=nextDiscovery;window.gameResources={...(window.gameResources||{}),...nextResources};
    window.dispatchEvent(new Event('game-resources-updated'));
    window.notice?.('생애 첫 증표 구매 완료 · 거북선과 보급품을 획득했습니다.');
    return {ok:true};
  };
  // 증표 연계 패키지: 생애 첫 증표를 구매해야 '한번에 3성까지!'가 열리고, 그 패키지를 구매해야 '달리자 5성까지!'가 열린다.
  // 두 패키지 모두 사자증표 5개, 계정당 1회이며 보상은 같다(1성 배틀크루저 거북선 1대, 미사일 함선골조 1개, 골드 100000).
  const tokenPacks={
    'token-pack-1':{key:'starfleet-token-pack-1-v1',requires:firstTokenEventKey,title:'한번에 3성까지!'},
    'token-pack-2':{key:'starfleet-token-pack-2-v1',requires:'starfleet-token-pack-1-v1',title:'달리자 5성까지!'}
  };
  const TOKEN_PACK_PRICE=5;
  const TOKEN_PACK_GOLD=100000;
  window.purchaseTokenPack=packId=>{
    const pack=tokenPacks[packId];
    if(!pack)return {ok:false,reason:'알 수 없는 패키지입니다.'};
    if(localStorage.getItem(pack.key)==='claimed')return {ok:false,reason:'이미 구매한 패키지입니다.'};
    if(localStorage.getItem(pack.requires)!=='claimed')return {ok:false,reason:'선행 패키지를 먼저 구매해야 합니다.'};
    const turtle=availableFleetShips.find(ship=>ship.type==='battlecruiser'&&ship.name==='거북선');
    if(!turtle)return {ok:false,reason:'보상 함선을 찾지 못했습니다.'};
    let savedResources={};try{savedResources=JSON.parse(localStorage.getItem(gameResourceStorageKey)||'{}')||{};}catch{}
    const resources={...(window.gameResources||{}),...savedResources},tokens=Math.max(0,Math.floor(Number(resources.lionToken)||0));
    if(tokens<TOKEN_PACK_PRICE)return {ok:false,reason:'사자증표가 부족합니다.'};
    const loot=readExplorationLoot(),variants=shipVariants(turtle).map(item=>({...item}));
    const oneStar=variants.find(item=>item.stars===1&&item.rarity===turtle.rarity);
    if(oneStar)oneStar.copies+=1;else variants.push({stars:1,copies:1,rarity:turtle.rarity});
    const nextEnhancement={...enhancementState,[shipKey(turtle)]:{variants}};
    const nextDiscovery={...discoveredShips,[shipKey(turtle)]:true};
    const packThorium=packId==='token-pack-1'?333:packId==='token-pack-2'?555:0;
    const nextResources={...resources,lionToken:tokens-TOKEN_PACK_PRICE,gold:(Number(resources.gold)||0)+TOKEN_PACK_GOLD,...(packThorium?{thorium:(Number(resources.thorium)||0)+packThorium}:{})};
    const nextLoot={...loot,frameMissile:(Number(loot.frameMissile)||0)+1};
    const entries=[[gameResourceStorageKey,nextResources],[explorationLootStorageKey,nextLoot],[enhancementStorageKey,nextEnhancement],[shipDiscoveryStorageKey,nextDiscovery],[pack.key,'claimed']];
    const previous=entries.map(([key])=>[key,localStorage.getItem(key)]);
    try{for(const [key,value] of entries)localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value));}
    catch{for(const [key,value] of previous){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}}return {ok:false,reason:'저장에 실패했습니다. 다시 시도해 주세요.'};}
    enhancementState=nextEnhancement;discoveredShips=nextDiscovery;window.gameResources={...(window.gameResources||{}),...nextResources};
    window.dispatchEvent(new Event('game-resources-updated'));
    window.notice?.(`${pack.title} 구매 완료 · 1성 거북선과 보급품을 획득했습니다.`);
    return {ok:true};
  };
  // 확신의 L급!! 패키지: 정밀탐색드론 50개, 사자증표 50개(정가 100의 50% 할인). 계정당 1회.
  window.purchasePrecisionPack=()=>{
    const packKey='starfleet-precision-pack-v1';
    if(localStorage.getItem(packKey)==='claimed')return {ok:false,reason:'이미 구매한 패키지입니다.'};
    // 할인은 처음 열린 시점부터 24시간 동안 증표 50개, 그 뒤에는 정가 증표 100개로 구매할 수 있다.
    const startKey='starfleet-precision-pack-start-v1';
    let startAt=Number(localStorage.getItem(startKey));
    if(!startAt){startAt=Date.now();localStorage.setItem(startKey,String(startAt));}
    const price=Date.now()-startAt<24*60*60*1000?50:100;
    let savedResources={};try{savedResources=JSON.parse(localStorage.getItem(gameResourceStorageKey)||'{}')||{};}catch{}
    const resources={...(window.gameResources||{}),...savedResources},tokens=Math.max(0,Math.floor(Number(resources.lionToken)||0));
    if(tokens<price)return {ok:false,reason:'사자증표가 부족합니다.'};
    const loot=readExplorationLoot();
    const nextResources={...resources,lionToken:tokens-price};
    const nextLoot={...loot,precisionScout:(Number(loot.precisionScout)||0)+50};
    const entries=[[gameResourceStorageKey,nextResources],[explorationLootStorageKey,nextLoot],[packKey,'claimed']];
    const previous=entries.map(([key])=>[key,localStorage.getItem(key)]);
    try{for(const [key,value] of entries)localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value));}
    catch{for(const [key,value] of previous){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}}return {ok:false,reason:'저장에 실패했습니다. 다시 시도해 주세요.'};}
    window.gameResources={...(window.gameResources||{}),...nextResources};
    window.dispatchEvent(new Event('game-resources-updated'));
    window.notice?.('확신의 L급!! 구매 완료 · 정밀탐색드론 50개를 획득했습니다.');
    return {ok:true};
  };
  if(discoveredShips['destroyer:플레아데스:']){discoveredShips['destroyer:가루다:']=true;delete discoveredShips['destroyer:플레아데스:'];saveDiscoveredShips();}
  const shipSearchCost=count=>count===10?10:1;
  // 전함 탐색 1회는 매일 1회 무료(정밀탐색 제외)
  const freeSearchKey='starfleet-free-scout-day-v1';
  const todayFreeKey=()=>{const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;};
  // 1회 무료 탐색은 루카에게 탐색드론을 받은 뒤부터 쓸 수 있습니다.
  const freeSearchAvailable=count=>count===1&&!precisionSearch.type&&localStorage.getItem('starfleet-luca-drone-v1')==='1'&&localStorage.getItem(freeSearchKey)!==todayFreeKey();
  const markFreeSearchUsed=()=>{try{localStorage.setItem(freeSearchKey,todayFreeKey());}catch{}};
  const searchCostFor=count=>freeSearchAvailable(count)?0:shipSearchCost(count);
  const explorationUnavailableShips=new Set(['우주항모','히페리온']);
  const explorationShips=availableFleetShips.filter(ship=>!explorationUnavailableShips.has(ship.name));
  // SSR 함선 교환권: 교환 가능한 SSR 함선 목록과 교환 처리(함선 탐색과 같은 방식으로 보유·도감 등록)
  // Membership Service: L급 함선 목록과 지급(이름으로 찾아 획득 처리)
  window.getLClassShips=()=>availableFleetShips.filter(ship=>ship.rarity==='L'&&!ship.isFrame);
  window.grantMembershipShip=name=>{const ship=availableFleetShips.find(candidate=>candidate.rarity==='L'&&candidate.name===name);if(!ship)return false;window.acquireFleetShip(ship);return true;};
  window.getSsrTicketShips=()=>availableFleetShips.filter(ship=>ship.rarity==='SSR'&&!ship.isFrame).map(ship=>({...ship,typeName:fleetTypeNames[ship.type]||ship.type}));
  window.redeemSsrShipTicket=ship=>{
    const resolved=availableFleetShips.find(candidate=>candidate.rarity==='SSR'&&fleetShipKey(candidate)===fleetShipKey(ship));
    if(!resolved)return false;
    discoveredShips[shipKey(resolved)]=true;saveDiscoveredShips();
    window.acquireFleetShip(resolved);
    window.refreshFleetSlotStars?.();
    return resolved;
  };
  // 정밀탐색: 선택한 함종만 뽑고, 정밀탐색드론을 소모한다(탐색이 끝나면 기본 탐색으로 되돌린다).
  const precisionSearch={type:null,itemId:'scoutTron'};
  const activeExplorationShips=()=>explorationShips.filter(ship=>(!precisionSearch.type||ship.type===precisionSearch.type)&&(ship.type!=='frigate'||!discoveredShips[shipKey(ship)]));
  const precisionSearchTypes=[['dreadnought','중전함'],['battlecruiser','전투순양함'],['destroyer','구축함']];
  const precisionTypeTiles=[
    {type:'dreadnought',label:'중전함',ship:'니미츠',image:'dreadnought-nimitz-codex.png'},
    {type:'battlecruiser',label:'전투순양함',ship:'돌격 거북선',image:'battlecruiser-assault-turtle-ship-codex.png'},
    {type:'destroyer',label:'구축함',ship:'수 판옥선',image:'destroyer-su-panokseon-codex.png'}
  ];
  const openPrecisionSearch=()=>{
    document.querySelector('.precision-search-popup')?.remove();
    const popup=document.createElement('section');
    popup.className='precision-search-popup';
    popup.setAttribute('role','dialog');popup.setAttribute('aria-modal','true');popup.setAttribute('aria-label','정밀탐색');
    popup.innerHTML=`<div class="precision-search-card">
      <button type="button" class="precision-search-x" aria-label="닫기">×</button>
      <header><small>PRECISION SCOUT</small><h2>정밀탐색</h2><p>탐색할 함종을 선택하세요. 선택한 함종 중에서만 뽑힙니다.</p></header>
      <div class="precision-search-types">${precisionTypeTiles.map(tile=>`<button type="button" class="precision-search-type" data-type="${tile.type}" style="--tile-image:url('${tile.image}')"><span class="pst-name">${tile.label}</span></button>`).join('')}</div>
      <div class="precision-search-actions">
        <button type="button" class="precision-search-badge" data-count="1"><span>1회</span><span class="pst-search">탐색</span><img class="precision-drone-badge" src="icons/precision-scout-drone.webp" alt=""/></button>
        <button type="button" class="precision-search-badge ten" data-count="10"><span>10회</span><span class="pst-search">탐색</span><img class="precision-drone-badge" src="icons/precision-scout-drone.webp" alt=""/></button>
      </div>
      <button type="button" class="precision-help" aria-label="정밀탐색 확률 보기">?</button>
      <div class="precision-rate-info" hidden><div class="precision-rate-card"><h3>정밀탐색 확률</h3>
        <ul><li><span>L급 함선</span><b>2%</b></li><li><span>SSR급 함선</span><b>7%</b></li><li><span>SR급 함선</span><b>35%</b></li><li><span>R급 함선</span><b>45%</b></li><li><span>함선골조</span><b>10%</b></li><li><span>태양티끌</span><b>1%</b></li></ul>
        <button type="button" class="precision-rate-close">확인</button></div></div>
    </div>`;
    document.body.append(popup);
    let selected=null;
    const markSelected=()=>popup.querySelectorAll('.precision-search-type').forEach(button=>button.classList.toggle('selected',button.dataset.type===selected));
    popup.querySelectorAll('.precision-search-type').forEach(button=>button.onclick=()=>{selected=button.dataset.type;markSelected();});
    popup.querySelectorAll('.precision-search-badge').forEach(button=>button.onclick=()=>{
      if(!selected){window.notice?.('탐색할 함종을 먼저 선택하세요.');return;}
      popup.remove();
      openShipExploreConfirmation(Number(button.dataset.count));
      // 확인 창을 연 뒤에 설정해야 창을 여는 과정의 초기화에 지워지지 않는다.
      precisionSearch.type=selected;precisionSearch.itemId='precisionScout';
    });
    const rateInfo=popup.querySelector('.precision-rate-info');
    popup.querySelector('.precision-help').onclick=()=>{rateInfo.hidden=false;};
    popup.querySelector('.precision-rate-close').onclick=()=>{rateInfo.hidden=true;};
    popup.querySelector('.precision-search-x').onclick=()=>popup.remove();
    popup.onclick=event=>{if(event.target===popup)popup.remove();};
  };
  document.getElementById('precision-search-button')?.addEventListener('click',openPrecisionSearch);
  const ssrGuaranteeShips=explorationShips.filter(ship=>ship.rarity==='SSR');
  const ssrGuaranteeStorageKey='starfleet-ssr-guarantee-v1';
  let ssrGuaranteeState={selectedShipKey:shipKey(ssrGuaranteeShips[0]),draws:0};
  try{
    const saved=JSON.parse(localStorage.getItem(ssrGuaranteeStorageKey)||'{}');
    if(ssrGuaranteeShips.some(ship=>shipKey(ship)===saved.selectedShipKey))ssrGuaranteeState.selectedShipKey=saved.selectedShipKey;
    ssrGuaranteeState.draws=Math.max(0,Math.floor(Number(saved.draws)||0))%50;
  }catch{}
  const selectedSsrGuaranteeShip=()=>ssrGuaranteeShips.find(ship=>shipKey(ship)===ssrGuaranteeState.selectedShipKey)||ssrGuaranteeShips[0];
  const saveSsrGuarantee=()=>{try{localStorage.setItem(ssrGuaranteeStorageKey,JSON.stringify(ssrGuaranteeState));}catch{}};
  let ssrGuaranteePanel=null;
  const renderSsrGuaranteePanel=()=>{
    if(!ssrGuaranteePanel)return;
    const ship=selectedSsrGuaranteeShip();
    const remainingDraws=50-ssrGuaranteeState.draws;
    ssrGuaranteePanel.innerHTML=`<div class="ssr-guarantee-spark-layer" aria-hidden="true"><i><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b></i></div><button type="button" class="ssr-guarantee-selected" aria-label="확정 획득 함선 선택: ${ship.name}"><span class="ssr-guarantee-image"><img src="${ship.image}" alt="${ship.name}"/><i>SSR</i></span></button><span class="ssr-guarantee-countdown" aria-label="확정 획득까지 ${remainingDraws}회 남음">확정까지 <b>${remainingDraws}</b>회</span>`;
    ssrGuaranteePanel.querySelector('.ssr-guarantee-selected').onclick=openSsrGuaranteePicker;
  };
  const openSsrGuaranteePicker=()=>{
    document.querySelector('.ssr-guarantee-picker-overlay')?.remove();
    const overlay=document.createElement('div');overlay.className='ssr-guarantee-picker-overlay';
    overlay.innerHTML=`<section class="ssr-guarantee-picker" role="dialog" aria-modal="true" aria-label="SSR 확정 함선 선택"><header><div><small>SELECT TARGET · SSR</small><h2>확정 획득 함선 선택</h2></div><button type="button" class="ssr-guarantee-picker-close" aria-label="닫기">×</button></header><p>이미지를 누르면 50번째 탐색의 목표 함선으로 지정됩니다.</p><div class="ssr-guarantee-carousel"><button type="button" class="ssr-guarantee-arrow previous" aria-label="이전 함선 3개">‹</button><div class="ssr-guarantee-track">${ssrGuaranteeShips.map(ship=>`<button type="button" class="ssr-guarantee-option${shipKey(ship)===ssrGuaranteeState.selectedShipKey?' selected':''}" data-ssr-key="${shipKey(ship)}" aria-label="${ship.name} 선택"><span class="ssr-guarantee-option-image"><img src="${ship.image}" alt=""/></span><b>${ship.name}</b><small>${typeDisplayLabels[ship.type]||'함선'}</small></button>`).join('')}</div><button type="button" class="ssr-guarantee-arrow next" aria-label="다음 함선 3개">›</button></div><div class="ssr-guarantee-picker-footer">좌우로 밀어 다른 SSR 함선을 확인하세요</div></section>`;
    document.body.append(overlay);
    const close=()=>overlay.remove(),track=overlay.querySelector('.ssr-guarantee-track');
    overlay.querySelector('.ssr-guarantee-picker-close').onclick=close;
    overlay.onclick=event=>{if(event.target===overlay)close();};
    overlay.querySelector('.ssr-guarantee-arrow.previous').onclick=()=>track.scrollBy({left:-track.clientWidth,behavior:'smooth'});
    overlay.querySelector('.ssr-guarantee-arrow.next').onclick=()=>track.scrollBy({left:track.clientWidth,behavior:'smooth'});
    const originals=[...track.querySelectorAll('.ssr-guarantee-option')];
    track.addEventListener('click',event=>{const button=event.target.closest('.ssr-guarantee-option');if(!button||!track.contains(button))return;ssrGuaranteeState.selectedShipKey=button.dataset.ssrKey;saveSsrGuarantee();renderSsrGuaranteePanel();close();});
    if(originals.length>1){
      const makeClones=()=>originals.map(option=>{const clone=option.cloneNode(true);clone.classList.remove('selected');clone.setAttribute('aria-hidden','true');clone.tabIndex=-1;return clone;});
      const before=document.createDocumentFragment(),after=document.createDocumentFragment();makeClones().forEach(option=>before.append(option));makeClones().forEach(option=>after.append(option));
      track.prepend(before);track.append(after);
      requestAnimationFrame(()=>{
        const first=originals[0],last=originals[originals.length-1],afterFirst=track.children[originals.length*2];
        const trackRect=track.getBoundingClientRect(),firstRect=first.getBoundingClientRect(),afterRect=afterFirst.getBoundingClientRect();
        const cycleStart=firstRect.left-trackRect.left+track.scrollLeft,cycleWidth=afterRect.left-firstRect.left;
        const selected=originals.find(option=>option.dataset.ssrKey===ssrGuaranteeState.selectedShipKey)||first;
        track.scrollLeft+=selected.getBoundingClientRect().left-trackRect.left-track.clientWidth/3;
        let normalizeTimer=0;
        const normalizeLoop=()=>{const position=track.scrollLeft;if(position<cycleStart-1)track.scrollLeft=position+cycleWidth;else if(position>=cycleStart+cycleWidth-1)track.scrollLeft=position-cycleWidth;};
        track.addEventListener('scroll',()=>{clearTimeout(normalizeTimer);normalizeTimer=setTimeout(normalizeLoop,180);},{passive:true});
        track.addEventListener('scrollend',normalizeLoop,{passive:true});
      });
    }
    overlay.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
    overlay.querySelector('.ssr-guarantee-picker-close').focus();
  };
  const frameRewardIds=['frameCarrier','frameCannon','frameMissile','frameLaser','framePiercing'];
  const ownedCatalogShips=[...availableFleetShips];
  // 정밀탐색: L 2%, SSR 7%, SR 35%, R 45%, 함선골조 10%, 태양티끌 1% = 총 100%. 함선·함선골조·태양티끌만 나온다.
  const drawPrecisionReward=()=>{
    const roll=Math.random()*100,available=activeExplorationShips();
    if(roll>=99)return {kind:'item',itemId:'solarDust',item:{...explorationLootCatalog.solarDust,id:'solarDust'},count:1};
    if(roll>=89){const itemId=frameRewardIds[Math.floor(Math.random()*frameRewardIds.length)];return {kind:'item',itemId,item:{...explorationLootCatalog[itemId],id:itemId},count:1};}
    const rarity=roll<2?'L':roll<9?'SSR':roll<44?'SR':'R';
    const pool=available.filter(ship=>ship.rarity===rarity),ship=pool[Math.floor(Math.random()*pool.length)]||available[Math.floor(Math.random()*available.length)]||explorationShips[0];
    return {kind:'ship',ship};
  };
  const drawExplorationReward=()=>{
    if(precisionSearch.type)return drawPrecisionReward();
    // L 0.5%, SSR 3.4%, SR 20%, R 45%, 금고 12%, 토륨 상자 10%, 연구자료 가방 2%, 탐색드론/연구인력 5%, 함선골조 2%, 태양티끌 0.1% = 총 100%.
    const roll=Math.random()*100,available=activeExplorationShips();
    let rarity=null,itemId=null;
    if(roll<.5)rarity='L';
    else if(roll<3.9)rarity='SSR';
    else if(roll<23.9)rarity='SR';
    else if(roll<68.9)rarity='R';
    else if(roll<80.9)itemId='goldVault';
    else if(roll<90.9)itemId='thoriumBox';
    else if(roll<92.9)itemId='researchBag';
    else if(roll<97.9)itemId=Math.random()<.5?'scoutTron':'researchStaff';
    else if(roll<99.9)itemId=frameRewardIds[Math.floor(Math.random()*frameRewardIds.length)];
    else itemId='solarDust';
    if(itemId){const item=explorationLootCatalog[itemId];return {kind:'item',itemId,item:{...item,id:itemId},count:1};}
    const pool=available.filter(ship=>ship.rarity===rarity),ship=pool[Math.floor(Math.random()*pool.length)]||available[Math.floor(Math.random()*available.length)]||explorationShips[0];
    return {kind:'ship',ship};
  };
  const explorationPool=document.getElementById('ship-pool');
  if(explorationPool){
    explorationPool.querySelector(':scope > b')?.remove();
    explorationPool.querySelector(':scope > small')?.remove();
    explorationPool.querySelectorAll('.ship-exploration-coming-soon,.research-coming-soon').forEach(message=>message.remove());
    explorationPool.querySelectorAll('.summon-actions .summon-action:not(.precision-search)').forEach((button)=>{const amount=button.classList.contains('ten')?10:1;const cost=button.querySelector('em');if(cost){cost.classList.add('scout-drone-cost');cost.innerHTML=`<img src="icons/scout-drone.png?v=20260929-2" alt="탐색드론"/>${button.classList.contains('ten')||!freeSearchAvailable(1)?amount:'무료'}`;}});
    ssrGuaranteePanel=document.createElement('section');ssrGuaranteePanel.className='ssr-guarantee-panel';
    explorationPool.querySelector('.summon-actions')?.insertAdjacentElement('afterend',ssrGuaranteePanel);
    renderSsrGuaranteePanel();
  }
  const clearResearchUpdateNotice=panel=>{
    if(!panel)return;
    const clear=()=>{
      panel.querySelectorAll('.ship-exploration-coming-soon,.research-coming-soon,.weapon-research-coming-soon').forEach(node=>node.remove());
      panel.querySelectorAll('*').forEach(node=>{if(!node.children.length&&/업데이트\s*예정/.test(node.textContent||''))node.remove();});
      [...panel.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE&&/업데이트\s*예정/.test(node.textContent||'')).forEach(node=>node.remove());
    };
    clear();
    if(!panel.dataset.noticeCleanupObserver){new MutationObserver(clear).observe(panel,{childList:true,subtree:true});panel.dataset.noticeCleanupObserver='true';}
  };
  clearResearchUpdateNotice(explorationPool);
  clearResearchUpdateNotice(document.getElementById('weapon-pool'));
  const removeShipExploreOverlay=()=>{ssrDiscoveryAudio.pause();legendDiscoveryAudio.pause();document.getElementById('ship-exploration-overlay')?.remove();};
  const playShipExplorationSound=()=>{const audio=window.createGameAudio('sound/ship_search.ogg');audio.preload='auto';audio.volume=.72;audio.play().catch(()=>{});};
  const acquisitionDropSound=window.createGameAudio('sound/get.wav');
  acquisitionDropSound.preload='auto';
  acquisitionDropSound.volume=.48;
  const ssrDiscoveryAudio=window.createGameAudio('sound/SSR_get.mp3');
  ssrDiscoveryAudio.preload='auto';
  ssrDiscoveryAudio.volume=.72;
  const playSsrDiscoverySound=()=>{try{ssrDiscoveryAudio.currentTime=0;ssrDiscoveryAudio.play().catch(()=>{});}catch{}};
  const legendDiscoveryAudio=window.createGameAudio('sound/Legend_get_with_crowd.ogg');
  legendDiscoveryAudio.preload='auto';
  legendDiscoveryAudio.volume=.72;
  const playLegendDiscoverySound=()=>{try{legendDiscoveryAudio.currentTime=0;legendDiscoveryAudio.play().catch(()=>{});}catch{}};
  const playAcquisitionDropSound=()=>{
    const audio=acquisitionDropSound.cloneNode();
    audio.volume=acquisitionDropSound.volume;
    audio.play().catch(()=>{});
  };
  const openShipExploreConfirmation=count=>{
    removeShipExploreOverlay();
    const cost=searchCostFor(count),overlay=document.createElement('section');
    overlay.id='ship-exploration-overlay';overlay.className='ship-exploration-overlay exploration-confirm-overlay';
    overlay.innerHTML=`<div class="ship-exploration-confirm" role="dialog" aria-modal="true" aria-label="함선 탐색 확인"><small>FLEET SIGNAL EXPLORATION</small><h2>${count}회 탐색 하시겠습니까?</h2><p>함선 신호와 보급 물자를 탐색합니다.</p><div><button type="button" class="ship-explore-cancel">아니오</button><button type="button" class="ship-explore-confirm">예 <em><img src="icons/scout-drone.png?v=20260929-2" alt="탐색드론"/>${cost}</em></button></div></div>`;
    document.body.append(overlay);
    overlay.querySelector('.ship-explore-cancel').onclick=()=>overlay.remove();
    overlay.querySelector('.ship-explore-confirm').onclick=()=>startShipExploration(count);
  };
  const startShipExploration=(count,skipSignal=false)=>{
    const cost=searchCostFor(count),freeUsed=cost===0;
    if(cost>0&&!window.consumeExplorationLootBatch?.([{itemId:precisionSearch.itemId,amount:cost}])){
      const activeOverlay=document.getElementById('ship-exploration-overlay');
      let shortage=activeOverlay?.querySelector('.ship-explore-shortage');
      if(shortage){shortage.textContent=`탐색드론 ${cost}개가 필요합니다. 보유량을 확인해주세요.`;shortage.hidden=false;}
      const confirmation=document.querySelector('#ship-exploration-overlay .ship-explore-confirm');
      if(confirmation&&!shortage){
        shortage=document.createElement('p');
        shortage.className='ship-explore-shortage';
        shortage.setAttribute('role','status');
        shortage.textContent=`탐색드론 ${cost}개가 필요합니다. 현재 보유량을 확인해주세요.`;
        confirmation.closest('.ship-exploration-confirm')?.insertBefore(shortage,confirmation.parentElement);
      }else if(confirmation){
        shortage.textContent=`탐색드론 ${cost}개가 필요합니다. 현재 보유량을 확인해주세요.`;
        shortage.hidden=false;
      }else if(!shortage){
        window.notice?.(`탐색드론 ${cost}개가 필요합니다.`);
      }
      return false;
    }
    removeShipExploreOverlay();
    if(freeUsed)markFreeSearchUsed();
    const draws=Array.from({length:count},()=>{
      const guaranteed=ssrGuaranteeState.draws===49;
      const draw=guaranteed?{kind:'ship',ship:selectedSsrGuaranteeShip(),guaranteed:true}:drawExplorationReward();
      ssrGuaranteeState.draws=(ssrGuaranteeState.draws+1)%50;
      if(draw.kind==='item')window.grantExplorationLoot(draw.itemId,draw.count);
      else{const key=shipKey(draw.ship);draw.firstDiscovery=!discoveredShips[key];discoveredShips[key]=true;window.acquireFleetShip(draw.ship);}
      return draw;
    });
    saveSsrGuarantee();renderSsrGuaranteePanel();
    saveDiscoveredShips();
    window.dispatchEvent(new CustomEvent('ship-exploration-completed',{detail:{count}}));
    const overlay=document.createElement('section');
    overlay.id='ship-exploration-overlay';overlay.className='ship-exploration-overlay ship-exploration-reveal';
    overlay.innerHTML=`<div class="ship-exploration-window"><div class="ship-exploration-stack" ${count===10?'':'hidden'} aria-hidden="true"><div class="ship-exploration-stack-cards"></div></div><div class="acquisition-special-fx" aria-hidden="true"><i></i></div><div class="ship-exploration-signal" aria-live="polite">신호 수신중<span>...</span></div><div class="ship-exploration-card-wrap" hidden><button type="button" class="ship-exploration-nav previous" aria-label="이전 카드">‹</button><article class="ship-exploration-card ship-detail-card acquisition-detail-card"></article><button type="button" class="ship-exploration-nav next" aria-label="다음 카드">›</button></div><div class="ship-exploration-counter" hidden></div><div class="ship-exploration-actions" hidden><p class="ship-explore-shortage" role="status" hidden></p><button type="button" class="ship-explore-again">${count}회 탐색</button><button type="button" class="ship-explore-return">돌아가기</button></div></div>`;
    document.body.append(overlay);
    if(!skipSignal)playShipExplorationSound();
    const explorationWindow=overlay.querySelector('.ship-exploration-window'),signal=overlay.querySelector('.ship-exploration-signal'),stack=overlay.querySelector('.ship-exploration-stack'),stackCards=overlay.querySelector('.ship-exploration-stack-cards'),specialFx=overlay.querySelector('.acquisition-special-fx'),wrap=overlay.querySelector('.ship-exploration-card-wrap'),card=overlay.querySelector('.ship-exploration-card'),counter=overlay.querySelector('.ship-exploration-counter'),previous=overlay.querySelector('.previous'),next=overlay.querySelector('.next'),actions=overlay.querySelector('.ship-exploration-actions');
    card.addEventListener('animationstart',event=>{if(event.animationName==='acquisition-front-drop'&&!['SSR','L'].includes(card.dataset.rarity))playAcquisitionDropSound();});
    stackCards.addEventListener('animationstart',event=>{if(event.animationName==='acquisition-stack-drop'&&event.target.classList.contains('acquisition-back-card'))playAcquisitionDropSound();});
    const detailMarkup=(draw,starsOverride)=>{
      if(draw.kind==='item')return `<div class="acquisition-item-icon-wrap">${draw.item.image?`<img class="acquisition-item-icon" src="${draw.item.image}" alt="${draw.item.name}"/>`:`<span class="acquisition-item-icon-fallback" aria-hidden="true">${draw.item.icon}</span>`}</div><h2 class="acquisition-item-name">${draw.item.name}</h2>`;
      const ship=draw.ship,rarity=ship.rarity||'R',codexType=ship.type||'dreadnought',type=typeLabels[codexType]||'DreadNought',progress=shipProgress(ship,starsOverride),profile=ship.profile;
      const promoted=rarity!==ship.baseRarity,durability=enhancedStat(profile?.[0],progress.stars,rarity,promoted),dps=enhancedStat(profile?.[2],progress.stars,rarity,promoted),skillStars=retainedSkillStars(ship,progress.stars,rarity),labels=['무기 종류','내구도','DPS','핵심기술',`보조기술${skillRequirementMarkup(skillStars,'aux',rarity,ship)}`,`최종기술${skillRequirementMarkup(skillStars,'ultimate',rarity,ship)}`];
      const values=profile?[weaponLabels(profile,progress.stars),durability===null?'—':durability.toLocaleString('ko-KR'),dps===null?'—':skillAdjustedDps(ship,dps,skillStars).toLocaleString('ko-KR'),skillTitleOnly(coreSkillDescription(ship,skillStars,profile)),skillTitleOnly(skillStateMarkup(ship,skillStars,'aux',rarity)),skillTitleOnly(skillStateMarkup(ship,skillStars,'ultimate',rarity))]:['—','—','—','—','—','—'];
      // 상세화면 카드와 같은 내부 구조를 공유한다. 획득 화면에서는 강화 별과 조작 버튼만 숨긴다.
      return `<span class="ship-detail-rarity rarity-badge rarity-${rarity}" data-rarity="${rarity}">${rarity}</span>${draw.guaranteed?'<span class="ship-guaranteed-tag">50회 확정 획득</span>':''}<div class="ship-detail-image"><img src="${ship.image}" alt="${ship.name}"/></div><h2><span class="ship-detail-name">${ship.name}</span><small>${typeDisplayLabels[codexType]||'함선'}</small></h2><p class="ship-detail-class"></p><div class="ship-detail-stats">${labels.map((label,i)=>`<div><b>${label}</b><span>${values[i]}</span></div>`).join('')}</div>`;
    };
    if(count===10){
      // 뒤쪽 카드도 동일한 상세정보 카드 구조를 사용해 첫 카드 뒤에 층층이 쌓는다.
      stackCards.innerHTML=draws.slice(1).map((draw,stackIndex)=>`<article class="ship-exploration-card ship-detail-card acquisition-detail-card acquisition-back-card ${draw.kind==='ship'?`rarity-detail-${draw.ship.rarity||'R'}`:'acquisition-item-card'}" style="--stack-index:${stackIndex}">${detailMarkup(draw)}</article>`).join('');
    }
    let index=0,specialFxTimer=null,ssrWindowFx=null,ssrWhiteFlash=null,lWhiteFlash=null,acqCine=null,acqCineTimers=[];
    const reveal=indexToShow=>{
      clearTimeout(specialFxTimer);
      ssrDiscoveryAudio.pause();
      legendDiscoveryAudio.pause();
      ssrWindowFx?.remove();ssrWindowFx=null;
      ssrWhiteFlash?.remove();ssrWhiteFlash=null;
      lWhiteFlash?.remove();lWhiteFlash=null;
      acqCineTimers.forEach(clearTimeout);acqCineTimers=[];acqCine?.remove();acqCine=null;explorationWindow.classList.remove('acq-cine-shake');
      const previousIndex=index;
      index=Math.max(0,Math.min(draws.length-1,indexToShow));
      const draw=draws[index],isShip=draw.kind==='ship',ship=isShip?draw.ship:null,rarity=isShip?(ship.rarity||'R'):null;
      wrap.classList.remove('rarity-reveal-L','rarity-reveal-SSR');
      card.className=`ship-exploration-card ship-detail-card acquisition-detail-card ${isShip?`rarity-detail-${rarity}`:'acquisition-item-card'} ${index>=previousIndex?'slide-from-right':'slide-from-left'} ${index===0?'card-drop-reveal':'card-linked-reveal'}`;
      if(isShip&&(ship.name==='우주항모'||rarity==='L'))card.classList.add('carrier-detail');
      if(isShip){card.dataset.shipName=ship.name;card.dataset.shipType=ship.type;card.dataset.rarity=rarity;if(ship.frameId)card.dataset.frameId=ship.frameId;else delete card.dataset.frameId;}
      else{delete card.dataset.shipName;delete card.dataset.shipType;delete card.dataset.rarity;delete card.dataset.frameId;}
      card.innerHTML=detailMarkup(draw);
      stackCards.querySelectorAll('.acquisition-back-card').forEach((layer,layerIndex)=>layer.classList.toggle('layer-consumed',layerIndex<index));
      specialFx.className='acquisition-special-fx';
      specialFx.innerHTML='<i></i>';
      // SSR·L 획득 연출: ① 예고(신호가 금빛으로, L은 붉은빛으로 반전) → ② 공개(실루엣 → 빛줄기로 색 공개) → ③ 각인("SSR"/"LEGENDARY")
      // 연출이 끝나면 카드가 떨어지고 광택·NEW 도장이 붙는다. 연출 중 화면을 누르면 바로 카드로 건너뛴다.
      if(rarity==='L'||rarity==='SSR'){
        const isL=rarity==='L';
        card.classList.add('cine-hold');
        acqCine=document.createElement('div');
        acqCine.className=`acq-cine ${isL?'acq-cine-l':'acq-cine-ssr'}`;
        acqCine.setAttribute('aria-hidden','true');
        acqCine.innerHTML=`<i class="acq-cine-rays"></i>${isL?`<i class="acq-cine-warp">${Array.from({length:36},(_,i)=>`<b style="--a:${i*10+Math.round(Math.random()*6)}deg;animation-delay:-${(Math.random()*.55).toFixed(2)}s"></b>`).join('')}</i>`:''}<div class="acq-cine-signal"><span><i></i><i></i><i></i><em></em></span><b>신호 수신중</b></div><div class="acq-cine-ship"><span class="acq-cine-aura"></span><img class="acq-cine-sil" src="${ship.image}" alt=""/><img class="acq-cine-col" src="${ship.image}" alt=""/><span class="acq-cine-sweep"></span></div><strong class="acq-cine-stamp">${isL?'LEGENDARY':'SSR'}</strong><div class="acq-cine-fx"></div><i class="acq-cine-flash"></i>`;
        explorationWindow.append(acqCine);
        const cine=acqCine,signalBox=cine.querySelector('.acq-cine-signal'),fxBox=cine.querySelector('.acq-cine-fx');
        const at=(ms,fn)=>acqCineTimers.push(setTimeout(()=>{if(cine.isConnected)fn();},ms));
        const setSignal=(color,pulse)=>{signalBox.style.setProperty('--sig',color);signalBox.style.setProperty('--pulse',pulse);};
        const settle=()=>{
          if(!cine.isConnected||cine.classList.contains('settled'))return;
          acqCineTimers.forEach(clearTimeout);acqCineTimers=[];
          cine.classList.add('settled');
          card.classList.remove('cine-hold');
          card.classList.add(isL?'acq-foil-l':'acq-foil-ssr');
          requestAnimationFrame(()=>card.classList.add('revealed'));
          if(draw.firstDiscovery&&!card.querySelector('.acq-new-stamp'))card.insertAdjacentHTML('beforeend','<span class="acq-new-stamp" aria-label="새로 발견한 함선">NEW</span>');
          if(isL)for(let i=0;i<14;i++){const ember=document.createElement('i');ember.className='acq-cine-ember';ember.style.left=`${10+Math.random()*80}%`;ember.style.top=`${30+Math.random()*50}%`;ember.style.animationDelay=`${(Math.random()*2).toFixed(2)}s`;ember.style.animationDuration=`${(2.2+Math.random()*1.8).toFixed(2)}s`;fxBox.append(ember);}
        };
        cine.addEventListener('click',settle);
        // ① 예고
        setSignal('#9fe8ff','.9s');
        at(430,()=>setSignal('#ffe28a','.6s'));
        at(860,()=>setSignal('#ffd25e',isL?'.42s':'.35s'));
        const glitchAt=1290,flashAt=isL?1940:1290;
        if(isL)at(glitchAt,()=>{signalBox.classList.add('glitch');setSignal('#ff4d6d','.25s');});
        // 섬광 → ② 공개
        at(flashAt,()=>{(isL?playLegendDiscoverySound:playSsrDiscoverySound)();cine.classList.add('stage-reveal');});
        const sweepAt=flashAt+(isL?1350:850);
        at(sweepAt,()=>cine.classList.add('stage-sweep'));
        if(isL)at(sweepAt,()=>{explorationWindow.classList.remove('acq-cine-shake');void explorationWindow.offsetWidth;explorationWindow.classList.add('acq-cine-shake');});
        // ③ 각인 → 카드
        const stampAt=sweepAt+(isL?420:620);
        at(stampAt,()=>{
          cine.classList.add('stage-stamp');
          for(let i=0;i<(isL?26:16);i++){const spark=document.createElement('i');spark.className='acq-cine-spark';const angle=Math.random()*Math.PI*2,distance=(isL?190:150)*(.5+Math.random()*.6);spark.style.setProperty('--x',`${Math.round(Math.cos(angle)*distance)}px`);spark.style.setProperty('--y',`${Math.round(Math.sin(angle)*distance)}px`);fxBox.append(spark);}
        });
        at(stampAt+900,settle);
      }
      if(rarity==='SR')card.classList.add('rarity-flash');
      if(!card.classList.contains('cine-hold'))requestAnimationFrame(()=>card.classList.add('revealed'));
      counter.textContent=`${index+1} / ${draws.length}`;
      previous.disabled=index===0;next.disabled=index===draws.length-1;
      actions.hidden=index!==draws.length-1;
    };
    previous.onclick=()=>reveal(index-1);
    next.onclick=()=>reveal(index+1);
    let cardSwipe=null;
    wrap.addEventListener('pointerdown',event=>{
      if(!event.target.closest('.ship-exploration-card')||wrap.hidden||event.pointerType==='mouse')return;
      cardSwipe={id:event.pointerId,x:event.clientX,y:event.clientY};
    });
    overlay.addEventListener('pointerup',event=>{
      if(!cardSwipe||event.pointerId!==cardSwipe.id)return;
      const dx=event.clientX-cardSwipe.x,dy=event.clientY-cardSwipe.y;
      cardSwipe=null;
      if(Math.abs(dx)<42||Math.abs(dx)<Math.abs(dy)*1.2)return;
      event.preventDefault();
      reveal(index+(dx<0?1:-1));
    });
    overlay.addEventListener('pointercancel',()=>{cardSwipe=null;});
    // 처음 탐색하는 사람을 위해 "왼쪽으로 넘기기" 안내를 한 번만 보여 줍니다. 카드를 한 번 누르거나 8초가 지나면 사라집니다.
    if(draws.length>1){
      const HINT_KEY='starfleet-card-swipe-hint-v1';
      let seen=false;try{seen=localStorage.getItem(HINT_KEY)==='1';}catch{}
      if(!seen){
        const hint=document.createElement('div');
        hint.className='card-swipe-hint';
        hint.setAttribute('aria-hidden','true');
        hint.innerHTML='<span class="card-swipe-track"><span class="card-swipe-hand">👆</span></span><b>카드를 왼쪽으로 넘기세요</b><small>넘기면 다음 함선이 나옵니다</small>';
        overlay.querySelector('.ship-exploration-window')?.append(hint);
        const dismiss=()=>{hint.remove();clearTimeout(hintTimer);try{localStorage.setItem(HINT_KEY,'1');}catch{}};
        const hintTimer=setTimeout(dismiss,8000);
        wrap.addEventListener('pointerdown',dismiss,{once:true});
      }
    }
    overlay.querySelector('.ship-explore-again').onclick=()=>startShipExploration(count,true);
    overlay.querySelector('.ship-explore-return').onclick=removeShipExploreOverlay;
    const beginReveal=()=>{if(!overlay.isConnected)return;signal.remove();const revealMain=()=>{wrap.hidden=false;counter.hidden=false;if(count===10){stack.hidden=false;stack.classList.add('stack-active');}reveal(0);};revealMain();};
    // 첫 카드가 SSR·L이면 자체 예고 연출이 있으므로 일반 신호 단계를 짧게 줄인다.
    const firstRank=draws[0]?.kind==='ship'?(draws[0].ship.rarity||'R'):'';
    if(skipSignal)requestAnimationFrame(beginReveal);else setTimeout(beginReveal,['SSR','L'].includes(firstRank)?1200:3000);
  };
  window.summonCard=kind=>{
    if(!String(kind).includes('전함'))return legacySummonCard?.(kind);
    precisionSearch.type=null;precisionSearch.itemId='scoutTron';
    openShipExploreConfirmation(String(kind).includes('10회')?10:1);
  };
  let draggedSlot=null;
  stage.addEventListener('dragstart',event=>{const slot=event.target.closest('.formation-slot');if(!slot?.classList.contains('occupied'))return;draggedSlot=Number(slot.dataset.fleetSlot);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(draggedSlot));slot.classList.add('dragging');});
  stage.addEventListener('dragend',event=>{event.target.closest('.formation-slot')?.classList.remove('dragging');stage.querySelectorAll('.drag-over').forEach(slot=>slot.classList.remove('drag-over'));draggedSlot=null;});
  stage.addEventListener('dragover',event=>{const slot=event.target.closest('.formation-slot');if(draggedSlot===null||!slot)return;event.preventDefault();event.dataTransfer.dropEffect='move';stage.querySelectorAll('.drag-over').forEach(item=>item.classList.toggle('drag-over',item===slot));});
  stage.addEventListener('drop',event=>{const target=event.target.closest('.formation-slot');if(!target||draggedSlot===null)return;event.preventDefault();const targetIndex=Number(target.dataset.fleetSlot),sourceShip=fleetAssignments[draggedSlot],targetShip=fleetAssignments[targetIndex],valid=(index,ship)=>index!==3||!ship||ship.type==='frigate'&&isFrigateUnlocked();if(targetIndex===3&&!isFrigateUnlocked())showFrigateLockWarning();else if(targetIndex!==draggedSlot&&valid(targetIndex,sourceShip)&&valid(draggedSlot,targetShip)){[fleetAssignments[draggedSlot],fleetAssignments[targetIndex]]=[targetShip,sourceShip];renderFleetSlot(draggedSlot);renderFleetSlot(targetIndex);saveFleetAssignments();}target.classList.remove('drag-over');});
  const panel=screen.querySelector('.formation-panel'),body=panel.querySelector('.formation-panel-body'),panelHeader=panel.querySelector('header'),closePanelButton=panel.querySelector('button[aria-label="패널 닫기"]');
  const clearSlotButton=document.createElement('button');clearSlotButton.type='button';clearSlotButton.className='slot-clear-button';clearSlotButton.textContent='슬롯 비우기';clearSlotButton.hidden=true;panelHeader.insertBefore(clearSlotButton,closePanelButton);
  window.openFleetManagement=()=>{panel.hidden=true;clearSlotButton.hidden=true;modal.hidden=true;screen.scrollTop=0;if(typeof window.show==='function')window.show('collection');syncFrigateSlotLock();};
  closePanelButton.onclick=()=>{panel.hidden=true;};
  let fleetPickerSortMode='rarity';
  const openShipPicker=slotIndex=>{
    if(Number(slotIndex)===3&&!isFrigateUnlocked()){showFrigateLockWarning();return;}
    const slot=stage.querySelector(`[data-fleet-slot="${slotIndex}"]`),role=slot?.dataset.slotRole||'함대';
    panel.dataset.pickerSlot=String(slotIndex);panel.hidden=false;panel.classList.remove('fleet-codex-popup','fleet-hangar-popup');panel.classList.add('fleet-ship-picker-popup');panel.querySelector('h2').textContent=`${role} · 함선 선택`;clearSlotButton.hidden=!fleetAssignments[slotIndex];
    clearSlotButton.onclick=()=>{assignFleetShip(slotIndex,null);panel.hidden=true;};
    const renderChoices=()=>{
      const ships=sortedFleetShips(fleetPickerSortMode).flatMap(ship=>shipVariants(ship).filter(variant=>variant.copies>0).map(variant=>({...ship,rarity:variant.rarity||ship.rarity,enhancementStars:variant.stars,variantRarity:variant.rarity||ship.rarity,variantCopies:variant.copies}))).filter(ship=>slotIndex===3?ship.type==='frigate':ship.type!=='frigate');
      const sortLabel=fleetPickerSortMode==='rarity'?'등급순 · 이름순':'함종별 · 등급순';
      body.innerHTML=`<div class="fleet-picker-toolbar"><p class="fleet-picker-note">편성할 함선을 선택하세요.</p><button type="button" class="fleet-picker-sort-toggle" aria-label="함선 목록 정렬 방식 변경" aria-pressed="${fleetPickerSortMode==='type'}">${sortLabel}<span aria-hidden="true">⇄</span></button></div><div class="fleet-ship-picker">${ships.map(ship=>{const assignedIndex=fleetAssignments.findIndex(candidate=>fleetShipKey(candidate)===fleetShipKey(ship)),isCurrent=assignedIndex===slotIndex,isAssigned=assignedIndex!==-1;return `<button type="button" class="codex-ship-card fleet-ship-choice${cardClass(ship)} rarity-card-${ship.rarity}${isCurrent?' current-choice':''}${isAssigned&&!isCurrent?' assigned-choice':''}" data-ship-name="${ship.name}" data-ship-type="${ship.type}" data-variant-rarity="${ship.variantRarity}" data-enhancement-stars="${ship.enhancementStars}" ${isAssigned?'disabled':''}><span class="ship-portrait">${ship.image?`<img src="${ship.image}" alt=""/>`:'<i>✦</i>'}${starMarkup(ship,false,ship.enhancementStars,ship.variantRarity)}</span><span class="rarity-badge rarity-${ship.rarity}">${ship.rarity}</span><b>${ship.name}</b><span class="ship-type-attack">${fleetTypeNames[ship.type]||'함선'} · ${ship.profile?.[1]||'장착 무기'}</span>${isCurrent?'<em class="ship-choice-state">✓ 선택됨</em>':isAssigned?'<em class="ship-choice-state">편성됨</em>':''}</button>`;}).join('')}</div>`;
      body.querySelector('.fleet-picker-sort-toggle').onclick=()=>{fleetPickerSortMode=fleetPickerSortMode==='rarity'?'type':'rarity';renderChoices();};
    };
    renderChoices();
  };
  stage.addEventListener('click',event=>{const slot=event.target.closest('.formation-slot');if(!slot||draggedSlot!==null)return;if(Number(slot.dataset.fleetSlot)===3&&!isFrigateUnlocked()){syncFrigateSlotLock();showFrigateLockWarning();return;}openShipPicker(Number(slot.dataset.fleetSlot));});
  let ownedSortMode='rarity';
  const renderOwnedLibrary=sheet=>{
    const ships=sortedOwnedShips(ownedSortMode).flatMap(ship=>shipVariants(ship).map(variant=>({...ship,rarity:variant.rarity||ship.rarity,variantRarity:variant.rarity||ship.rarity,enhancementStars:variant.stars,variantCopies:variant.copies}))).filter(ship=>ship.variantCopies>0);ownedDetailOrder=ships;
    sheet.className='hangar-library-sheet owned-library-sheet';
    const sortLabel=ownedSortMode==='rarity'?'등급순 · 이름순':'함종별 · 등급순';
    sheet.innerHTML=`<div class="owned-library-summary"><b>보유 함선 ${ships.length}종</b><button type="button" class="owned-one-star-enhance" aria-label="0성 동일 함선 일괄 1성 강화"><span class="owned-one-star-badge" aria-hidden="true">★</span> 일괄 강화</button><button type="button" class="owned-r-two-star-enhance" aria-label="R급 성급별 일괄 강화 및 돌파">R급 일괄</button><button type="button" class="owned-sort-toggle" aria-label="함선 목록 정렬 방식 변경" aria-pressed="${ownedSortMode==='type'}">${sortLabel}<span aria-hidden="true">⇄</span></button></div>${ships.length?`<div class="fleet-ship-picker owned-ship-grid">${ships.map((ship,index)=>{const copies=ship.variantCopies,variantStars=ship.enhancementStars;return `<button type="button" class="codex-ship-card fleet-ship-choice owned-ship-choice${cardClass(ship)} rarity-card-${ship.rarity}" data-owned-index="${index}" data-ship-name="${ship.name}" data-frame-id="${ship.frameId||''}" data-ship-type="${ship.type}" data-enhancement-stars="${variantStars}" data-variant-rarity="${ship.variantRarity}" aria-label="${fleetTypeNames[ship.type]||'함선'} ${ship.name}, ${variantStars}성, ${copies}척 보유, ${ship.rarity} 등급 상세보기"><span class="ship-portrait">${ship.image?`<img src="${ship.image}" alt="${ship.name}"/>`:'<i>✦</i>'}${starMarkup(ship,false,variantStars,ship.variantRarity)}</span><span class="rarity-badge rarity-${ship.rarity}">${ship.rarity}</span><b class="owned-ship-name">${ship.name}${copies>1?`<em class="owned-ship-count" aria-label="${copies}척 보유">×${copies}</em>`:''}</b><span class="ship-type-attack">${ship.frameLabel||`${fleetTypeNames[ship.type]||'함선'} · ${ship.profile?.[1]||'장착 무기'}`}</span></button>`;}).join('')}</div>`:'<p class="owned-library-empty">보유한 함선이 없습니다.<br>전함 탐색에서 함선을 획득하세요.</p>'}`;
    sheet.querySelector('.owned-sort-toggle').onclick=()=>{ownedSortMode=ownedSortMode==='rarity'?'type':'rarity';renderOwnedLibrary(sheet);};
    sheet.querySelector('.owned-one-star-enhance').onclick=()=>promoteAllZeroStarShips(sheet);
    sheet.querySelector('.owned-r-two-star-enhance').onclick=()=>promoteRShipsOneStep(sheet);
  };
  const renderCodexLibrary=sheet=>{
    const categories=[['dreadnought','DreadNought','중전함'],['battlecruiser','Battlecruiser','전투순양함'],['destroyer','Destroyer','구축함'],['frigate','Frigate','프리깃']];
    sheet.className='hangar-library-sheet codex-library-sheet';
    sheet.innerHTML=`<div class="codex-categories">${categories.map(([id,label,ko])=>`<button type="button" data-codex-type="${id}"><b>${label}</b><small>${ko}</small></button>`).join('')}</div><div class="codex-list" hidden></div>`;
    const list=sheet.querySelector('.codex-list');
    sheet.querySelectorAll('[data-codex-type]').forEach(category=>category.onclick=()=>{
      sheet.querySelectorAll('[data-codex-type]').forEach(tab=>tab.classList.toggle('selected',tab===category));
      const data=[...(fleetShips[category.dataset.codexType]||[])];const codexRarityOrder={L:0,SSR:1,SR:2,R:3};data.sort((a,b)=>(codexRarityOrder[a[3]]??99)-(codexRarityOrder[b[3]]??99)||a[0].localeCompare(b[0],'ko'));
      list.dataset.codexType=category.dataset.codexType;list.className=`codex-list ${category.dataset.codexType}`;list.hidden=false;list.innerHTML=`<div class="codex-list-title">${category.querySelector('b').textContent} 함선 목록</div><div class="codex-card-grid">${data.map(([name,stats,img,rarity])=>{const ship=availableFleetShips.find(candidate=>candidate.type===category.dataset.codexType&&candidate.name===name);return `<article class="codex-ship-card rarity-card-${rarity}${name==='우주항모'?' carrier-card':''}${name==='히페리온'?' hyperion-card':''}${name==='콜로서스'?' colossus-card':''}${name==='아르카디아'?' arcadia-card':''}${name==='페가수스'?' pegasus-card':''}${name==='과학 드론'?' science-drone-card':''}${name==='리틀보이'?' littleboy-card':''}" data-ship-type="${category.dataset.codexType}"><span class="ship-portrait">${img?`<img src="${img}" alt="${name}"/>`:'<div class="codex-card-placeholder">✦</div>'}${ship?starMarkup(ship):''}</span><span class="rarity-badge rarity-${rarity}">${rarity}</span><b>${name}</b><span class="ship-type-attack">${fleetTypeNames[category.dataset.codexType]} · ${ship?.profile?.[1]||'장착 무기'}</span></article>`;}).join('')}</div>`;
      list.querySelectorAll('.codex-ship-card').forEach(card=>{if(!explorationUnavailableShips.has(card.querySelector('b')?.textContent||''))return;card.classList.add('coming-soon');card.insertAdjacentHTML('beforeend','<em class="ship-coming-soon">업데이트 예정</em>');});
    });
    sheet.querySelector('[data-codex-type]')?.click();
  };
  const openHangarLibrary=(initialTab='owned')=>{
    panel.hidden=false;clearSlotButton.hidden=true;panel.classList.remove('fleet-ship-picker-popup');panel.classList.add('fleet-codex-popup','fleet-hangar-popup');panel.querySelector('h2').textContent='격납고';
    body.innerHTML='<div class="hangar-library-tabs" role="tablist" aria-label="격납고 메뉴"><button type="button" role="tab" data-hangar-tab="owned"><b>보유 함선</b><small>OWNED FLEET</small></button><button type="button" role="tab" data-hangar-tab="codex"><b>함선 도감</b><small>SHIP CODEX</small></button></div><section class="hangar-library-sheet"></section>';
    const sheet=body.querySelector('.hangar-library-sheet'),tabs=[...body.querySelectorAll('[data-hangar-tab]')];
    const selectTab=tabName=>{tabs.forEach(tab=>{const selected=tab.dataset.hangarTab===tabName;tab.classList.toggle('selected',selected);tab.setAttribute('aria-selected',String(selected));});if(tabName==='codex')renderCodexLibrary(sheet);else renderOwnedLibrary(sheet);};
    tabs.forEach(tab=>tab.onclick=()=>selectTab(tab.dataset.hangarTab));selectTab(initialTab);
  };
  screen.querySelectorAll('[data-panel="hangar"]').forEach(button=>button.onclick=()=>openHangarLibrary('owned'));
  syncFrigateSlotLock();
  window.openFleetHangar=()=>{if(typeof window.show==='function')window.show('collection');setTimeout(()=>openHangarLibrary('owned'),0);};
}

function initializePlanetCampaign() {
  const map = document.getElementById('map');
  if (!map) return;
  const regions = {mars:{name:'화성',en:'MARS',count:10},titan:{name:'타이탄 위성',en:'TITAN',count:20},oort:{name:'오르트구름',en:'OORT CLOUD',count:20}};
  const magentaRegions = {
    'magenta-near':{name:'마젠타 행성 인근',en:'MAGENTA ORBIT',count:10},
    'magenta-tas':{name:'마젠타 위성 타스',en:'TAS MOON',count:10},
    'magenta-atmosphere':{name:'마젠타 대기권',en:'MAGENTA ATMOSPHERE',count:10}
  };
  let progress = {mars:0,titan:0,oort:0};
  let ratings = {};
  let magentaProgress = {'magenta-near':0,'magenta-tas':0,'magenta-atmosphere':0};
  let magentaRatings = {};
  const keplerRegions = {
    'kepler-orbit':{name:'케플러 행성권',en:'KEPLER ORBIT',count:10,image:'kepler-planet.jpg'},
    'kepler-atmosphere':{name:'케플러 대기권',en:'KEPLER ATMOSPHERE',count:10,image:'kepler-planet.jpg'},
    'kepler-base':{name:'케플러 비밀기지',en:'KEPLER SECRET BASE',count:10,image:'kepler-planet.jpg'}
  };
  let keplerProgress = {'kepler-orbit':0,'kepler-atmosphere':0,'kepler-base':0};
  let keplerRatings = {};
  try { ratings = JSON.parse(localStorage.getItem('planet-campaign-stars-v1') || '{}') || {}; } catch (_) {}
  try { magentaRatings = JSON.parse(localStorage.getItem('magenta-campaign-stars-v1') || '{}') || {}; } catch (_) {}
  try {
    const saved=JSON.parse(localStorage.getItem('kepler-campaign-v1')||'0');
    if(saved&&typeof saved==='object')for(const key of Object.keys(keplerRegions))keplerProgress[key]=Math.max(0,Math.min(10,Number(saved[key])||0));
    else keplerProgress['kepler-orbit']=Math.max(0,Math.min(10,Number(saved)||0));
  } catch (_) {}
  try {
    keplerRatings = JSON.parse(localStorage.getItem('kepler-campaign-stars-v1') || '{}') || {};
    for(let gateNumber=1;gateNumber<=10;gateNumber++)if(keplerRatings[String(gateNumber)]!=null&&keplerRatings['kepler-orbit-'+gateNumber]==null)keplerRatings['kepler-orbit-'+gateNumber]=keplerRatings[String(gateNumber)];
  } catch (_) {}
  const roman = n => { let result=''; for(const [value,letter] of [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']])while(n>=value){result+=letter;n-=value;}return result; };
  const starRewardKey='starfleet-operation-star-rewards-v1';
  const regionStars=(ratingMap,key,count)=>Array.from({length:count},(_,index)=>Math.max(0,Math.min(3,Number(ratingMap[key+'-'+(index+1)])||0))).reduce((sum,value)=>sum+value,0);
  const starRewardButton=(stars,count)=>`<button type="button" class="magenta-star-progress region-star-claim" aria-label="작전지역 별점 ${stars}/${count*3} · 별점 보상 확인"><img class="operation-star-badge" src="operation-star-badge.png" alt="" aria-hidden="true"/><strong>${stars} <small>/ ${count*3}</small></strong></button>`;
  function openStarRewards(chapter,key){
    const list=chapter===3?keplerRegions:chapter===2?magentaRegions:regions;
    const ratingMap=chapter===3?keplerRatings:chapter===2?magentaRatings:ratings;
    const area=list[key],stars=regionStars(ratingMap,key,area.count),maximum=area.count*3;
    const claimId=`${chapter}:${key}`;
    let claimed={};try{claimed=JSON.parse(localStorage.getItem(starRewardKey)||'{}')||{};}catch(_){}
    document.querySelector('.operation-star-reward-overlay')?.remove();
    const overlay=document.createElement('div');overlay.className='operation-star-reward-overlay';
    overlay.innerHTML=`<section class="operation-star-reward-dialog" role="dialog" aria-modal="true" aria-label="${area.name} 별점 보상"><button type="button" class="operation-star-reward-close" aria-label="닫기">×</button><small>OPERATION STAR REWARDS</small><h2>${area.name} · 별점 보상</h2><p>획득 별점 <b>${stars} / ${maximum}</b></p><div class="operation-star-reward-list"></div></section>`;
    const close=()=>overlay.remove();overlay.onclick=event=>{if(event.target===overlay)close();};overlay.querySelector('.operation-star-reward-close').onclick=close;
    const renderRewards=()=>{
      overlay.querySelector('.operation-star-reward-list').innerHTML=[1,2,3].map(tier=>{
        const needed=area.count*tier,scale=area.count/10,gold=[1000,2500,5000][tier-1]*scale,thorium=[20,50,200][tier-1]*scale;
        const received=!!claimed[`${claimId}:${tier}`],available=stars>=needed;
        return `<div class="operation-star-reward-row"><span class="operation-star-reward-copy"><b>★ ${needed}</b><small><span class="operation-star-resource"><i class="mission-resource-icon gold" role="img" aria-label="골드"></i>${gold.toLocaleString('ko-KR')}</span><span class="operation-star-resource"><i class="mission-resource-icon thorium" role="img" aria-label="토륨"></i>${thorium.toLocaleString('ko-KR')}</span></small></span><button type="button" data-star-tier="${tier}" ${received||!available?'disabled':''}>${received?'수령 완료':available?'보상 수령':'별점 부족'}</button></div>`;
      }).join('');
      overlay.querySelectorAll('[data-star-tier]').forEach(button=>button.onclick=()=>{
        const tier=Number(button.dataset.starTier),needed=area.count*tier,id=`${claimId}:${tier}`;
        if(claimed[id]||stars<needed)return;
        const scale=area.count/10,gold=[1000,2500,5000][tier-1]*scale,thorium=[20,50,200][tier-1]*scale;
        const balances=window.gameResources||{};
        if(!window.__inventoryBalancesHydrated){try{Object.assign(balances,JSON.parse(localStorage.getItem(gameResourceStorageKey)||'{}')||{});}catch(_){}window.__inventoryBalancesHydrated=true;}
        const previous={gold:Number(balances.gold)||0,thorium:Number(balances.thorium)||0};
        balances.gold=previous.gold+gold;balances.thorium=previous.thorium+thorium;
        try{localStorage.setItem(gameResourceStorageKey,JSON.stringify(balances));claimed[id]=true;localStorage.setItem(starRewardKey,JSON.stringify(claimed));}catch(_){balances.gold=previous.gold;balances.thorium=previous.thorium;delete claimed[id];try{localStorage.setItem(gameResourceStorageKey,JSON.stringify(balances));}catch(_){}window.notice?.('보상 저장에 실패했습니다. 다시 시도해 주세요.');return;}
        window.gameResources=balances;window.updateGameResourceHud?.();window.dispatchEvent(new Event('game-resources-updated'));
        // 메일 보상처럼 골드·토륨 아이콘이 물자창고로 날아가는 연출 (목록을 다시 그리기 전에 출발 위치를 잡습니다)
        const resourceIcons=button.closest('.operation-star-reward-row')?.querySelectorAll('.operation-star-resource .mission-resource-icon')||[];
        const flights=[...resourceIcons].map(icon=>{const isGold=icon.classList.contains('gold');return {src:isGold?'gold-resource-icon.svg':'thorium-crystal-icon.png',amount:`+${(isGold?gold:thorium).toLocaleString('ko-KR')}`,rect:icon.getBoundingClientRect()};});
        window.animateRewardsToWarehouse?.(flights);
        window.notice?.(`${area.name} 별점 보상: 골드 ${gold.toLocaleString('ko-KR')} · 토륨 ${thorium.toLocaleString('ko-KR')}`);renderRewards();
      });
    };
    renderRewards();document.body.append(overlay);
  }
  try { const saved = JSON.parse(localStorage.getItem('planet-campaign-v1') || '{}'); for (const key in regions) progress[key] = Math.max(0,Math.min(regions[key].count,Number(saved[key]) || 0)); } catch (_) {}
  try { const saved = JSON.parse(localStorage.getItem('magenta-campaign-v1') || '{}'); for (const key in magentaRegions) magentaProgress[key] = Math.max(0,Math.min(10,Number(saved[key]) || 0)); } catch (_) {}
  let region = null, gate = 1, running = null;
  let magentaRegion = 'magenta-near', magentaGate = 1;
  let keplerRegion = 'kepler-orbit', keplerGate = 1;
  const solarArt = `<svg viewBox="0 0 480 260" role="img" aria-label="태양과 행성들의 궤도를 표현한 태양계"><defs><radialGradient id="solarSun"><stop stop-color="#fff5b5"/><stop offset=".5" stop-color="#ffcb4a"/><stop offset="1" stop-color="#e85b19"/></radialGradient></defs><g fill="none" stroke="#91b8e5" opacity=".3">${[55,85,120,155,195,230].map(r=>`<ellipse cx="240" cy="130" rx="${r}" ry="${r*.47}"/>`).join('')}</g><circle cx="240" cy="130" r="29" fill="url(#solarSun)"/>${[[191,118,4,'#baa090'],[302,108,7,'#dfac67'],[143,157,9,'#5297de'],[364,173,7,'#cb6338'],[78,86,16,'#caa87e'],[431,104,13,'#d6c390']].map(([x,y,r,c])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('')}<ellipse cx="431" cy="104" rx="23" ry="5" fill="none" stroke="#e5cfa8" stroke-width="3" transform="rotate(-20 431 104)"/></svg>`;
  map.innerHTML = `<header class="campaign-heading"><small>SOLAR SYSTEM · EXPEDITION</small><h1>행성계</h1><p>작전 지역과 관문을 선택하세요</p></header><div class="campaign-art solar">${solarArt}<div class="region-world"></div><div class="region-caption">태양계 <small>SOLAR SYSTEM</small></div></div><div class="region-tabs">${Object.entries(regions).map(([k,r])=>`<button type="button" data-region="${k}">${r.name}<small>${r.count}개 관문</small></button>`).join('')}</div><div class="campaign-status">지역을 선택하면 관문이 표시됩니다.</div><div class="gate-grid" aria-label="관문 선택"></div><button type="button" class="campaign-battle" disabled><span class="combat-symbol">⚔</span><span><b>전선 출격</b><small>작전 지역을 선택하세요</small></span><span>›</span></button>`;
  const art = map.querySelector('.campaign-art'), status = map.querySelector('.campaign-status'), grid = map.querySelector('.gate-grid'), launch = map.querySelector('.campaign-battle');
  map.querySelector('.region-tabs').remove();
  art.innerHTML = `<img class="solar-map-image" src="solar-system-chapter.jpg" alt="태양과 행성들이 늘어선 태양계 작전 지도"/>${Object.entries(regions).map(([key,r])=>`<button class="planet-hit hit-${key}" data-target="${key}" aria-label="${r.name} 작전 지역" aria-expanded="false"><span class="target-ring"></span></button>`).join('')}<small class="map-scale-note">작전 지도 · 거리와 크기는 실제 비율이 아닙니다</small>`;
  const popup = document.createElement('div');popup.className='region-popup';popup.hidden=true;
  popup.innerHTML='<button type="button" class="popup-name" aria-expanded="false"></button><button type="button" class="popup-close" aria-label="지역 팝업 닫기">×</button><div class="popup-details" hidden></div>';
  art.append(popup);
  const details=popup.querySelector('.popup-details'),nameButton=popup.querySelector('.popup-name');
  details.append(status,grid,launch);
  const gateWrap=document.createElement('div');gateWrap.className='gate-wrap';grid.before(gateWrap);gateWrap.append(grid);
  const lockLayer=document.createElement('div');lockLayer.className='gate-lock-layer';lockLayer.hidden=true;lockLayer.setAttribute('role','status');
  lockLayer.innerHTML='<svg viewBox="0 0 64 72" aria-hidden="true"><path class="lock-shackle" d="M18 32V20a14 14 0 0 1 28 0v12"/><rect x="10" y="30" width="44" height="34" rx="7"/><circle cx="32" cy="44" r="3"/><path d="M32 47v7"/></svg><b></b><small></small>';
  gateWrap.append(lockLayer);
  let unlockSeen={};try{unlockSeen=JSON.parse(localStorage.getItem('planet-unlock-seen-v1')||'{}')||{};}catch(_){}
  let unlockTimer;
  let expanded=false;
  map.querySelector('.campaign-heading p').textContent='화성·토성 옆 타이탄·외곽 구름의 표식을 눌러 탐색하세요';
  const chapterPicker = document.createElement('div');
  chapterPicker.className='chapter-picker';
  chapterPicker.innerHTML=`<button type="button" class="chapter-card chapter-solar"><img src="solar-system-chapter.jpg" alt="태양과 행성들이 늘어선 태양계 이미지"/><span class="chapter-copy"><small>CHAP 1.</small><b>태양계</b><em>SOLAR SYSTEM · 50개 관문</em></span><span class="chapter-arrow">›</span></button><button type="button" class="chapter-card chapter-galaxy"><img src="galaxy-lobby-background.png" alt="은하와 별들"/><span class="chapter-copy"><small>GALAXY</small><b>은하계</b><em>미탐사 영역 · 준비 중</em></span><span class="chapter-arrow">◇</span></button>`;
  const chapterBack=document.createElement('button');chapterBack.type='button';chapterBack.className='chapter-back';chapterBack.setAttribute('aria-label','행성계 메뉴로 돌아가기');chapterBack.title='행성계 메뉴로 돌아가기';chapterBack.innerHTML='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m13 7-9 9 9 9M5 16h14a8 8 0 0 1 8 8"/></svg>';chapterBack.hidden=true;
  art.before(chapterPicker,chapterBack);
  const galaxyPanel=document.createElement('div');galaxyPanel.className='galaxy-preview';galaxyPanel.hidden=true;galaxyPanel.innerHTML='<h2>은하계</h2><p>새로운 성계의 항로를 탐색 중입니다.</p><small>은하계 작전은 준비 중입니다.</small>';art.after(galaxyPanel);
  const chapterHeading=map.querySelector('.campaign-heading');
  function renderMagenta(){
    const selected=magentaRegions[magentaRegion],cleared=magentaProgress[magentaRegion];
    const totalStars=regionStars(magentaRatings,magentaRegion,selected.count);
    const regionEntries=Object.entries(magentaRegions);
    galaxyPanel.innerHTML=`<div class="magenta-map">
      <div class="magenta-scene">
        <img src="magenta-planet.jpg" alt="마젠타 행성과 주변 우주"/><span class="magenta-map-grid" aria-hidden="true"></span><span class="magenta-orbit orbit-outer" aria-hidden="true"></span><span class="magenta-orbit orbit-inner" aria-hidden="true"></span><span class="magenta-starlight" aria-hidden="true"><i style="--star-start:12deg;--star-radius:213px;--star-delay:-1s"></i><i style="--star-start:96deg;--star-radius:186px;--star-delay:-5s"></i><i style="--star-start:184deg;--star-radius:226.5px;--star-delay:-9s"></i><i style="--star-start:274deg;--star-radius:198px;--star-delay:-13s"></i><i style="--star-start:42deg;--star-radius:162px;--star-delay:-17s"></i></span><span class="magenta-tas-moon" aria-hidden="true"></span>
        <div class="magenta-sector-pins" aria-label="마젠타 작전지역">${regionEntries.map(([key,r],index)=>{const locked=index>0&&magentaProgress[regionEntries[index-1][0]]<magentaRegions[regionEntries[index-1][0]].count;return `<button type="button" class="magenta-pin pin-${index+1}${key===magentaRegion?' selected':''}${locked?' locked':''}" data-magenta-region="${key}" aria-pressed="${key===magentaRegion}" ${locked?'disabled':''}><i aria-hidden="true">${locked?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="4" y="10" width="16" height="11" rx="2"/></svg>':''}</i><span><small>0${index+1} · ${r.en}</small><b>${r.name}</b></span></button>`;}).join('')}</div>
      </div>
      <div class="magenta-route-panel"><div class="magenta-route-heading"><span><small>선택 작전지역 · ${selected.en}</small><b>${selected.name}</b></span><strong>${cleared} <small>/ 10 완료</small></strong></div>
        <div class="magenta-route" aria-label="${selected.name} 관문 선택">${Array.from({length:10},(_,i)=>{const n=i+1,locked=n>cleared+1,stars=Math.max(0,Math.min(3,Number(magentaRatings[magentaRegion+'-'+n])||0));return `<button type="button" data-magenta-gate="${n}" class="magenta-gate${n===magentaGate&&!locked?' selected':''}${n<=cleared?' cleared':''}" ${locked?'disabled':''} aria-label="${selected.name} ${n}관문 ${locked?'잠김':n<=cleared?'완료':'도전 가능'}" aria-pressed="${n===magentaGate&&!locked}"><span>${String(n).padStart(2,'0')}</span><small>${locked?'잠김':n<=cleared?(stars?'★'.repeat(stars):'완료'):'도전'}</small></button>`;}).join('')}</div>
        <div class="magenta-route-footer">${starRewardButton(totalStars,selected.count)}<button type="button" class="magenta-deploy">전선 출격</button></div>
      </div>
    </div>`;
    galaxyPanel.querySelectorAll('[data-magenta-region]').forEach(button=>button.onclick=()=>{magentaRegion=button.dataset.magentaRegion;magentaGate=Math.min(magentaProgress[magentaRegion]+1,10);renderMagenta();});
    galaxyPanel.querySelectorAll('[data-magenta-gate]').forEach(button=>button.onclick=()=>{magentaGate=Number(button.dataset.magentaGate);renderMagenta();});
    galaxyPanel.querySelector('.magenta-deploy').onclick=()=>launchOperation(2,magentaRegion,magentaGate);
    galaxyPanel.querySelector('.region-star-claim').onclick=()=>openStarRewards(2,magentaRegion);
  }
  function renderSolar(){
    const selected=regions[region||'mars'],selectedKey=region||'mars',cleared=progress[selectedKey];
    const totalStars=regionStars(ratings,selectedKey,selected.count);
    const entries=Object.entries(regions);
    let pins=art.querySelector('.solar-region-pins');
    if(!pins){pins=document.createElement('div');pins.className='solar-region-pins';art.append(pins);}
    pins.innerHTML=entries.map(([key,r],index)=>{const requirement=regionRequirement(key),locked=!!requirement;return `<button type="button" class="magenta-pin solar-pin pin-${index+1}${key===selectedKey?' selected':''}${locked?' locked':''}" data-solar-region="${key}" aria-pressed="${key===selectedKey}" ${locked?'disabled':''}><i aria-hidden="true">${locked?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="4" y="10" width="16" height="11" rx="2"/></svg>':''}</i><span><small>0${index+1} · ${r.en}</small><b>${r.name}</b></span></button>`;}).join('');
    galaxyPanel.innerHTML=`<div class="solar-operation-panel">
      <div class="magenta-route-panel solar-route-panel"><div class="magenta-route-heading"><span><small>선택 작전지역 · ${selected.en}</small><b>${selected.name}</b></span><strong>${cleared} <small>/ ${selected.count} 완료</small></strong></div>
        <div class="magenta-route solar-route" aria-label="${selected.name} 관문 선택">${Array.from({length:selected.count},(_,i)=>{const n=i+1,requirement=regionRequirement(selectedKey),locked=!!requirement||n>cleared+1,stars=Math.max(0,Math.min(3,Number(ratings[selectedKey+'-'+n])||0));return `<button type="button" data-solar-gate="${n}" class="magenta-gate${n===gate&&!locked?' selected':''}${n<=cleared?' cleared':''}" ${locked?'disabled':''} aria-label="${selected.name} ${n}관문 ${locked?'잠김':n<=cleared?'완료':'도전 가능'}" aria-pressed="${n===gate&&!locked}"><span>${String(n).padStart(2,'0')}</span><small>${locked?'잠김':n<=cleared?(stars?'★'.repeat(stars):'완료'):'도전'}</small></button>`;}).join('')}</div>
        <div class="magenta-route-footer">${starRewardButton(totalStars,selected.count)}<button type="button" class="magenta-deploy solar-deploy">전선 출격</button></div>
      </div>
    </div>`;
    art.querySelectorAll('[data-solar-region]').forEach(button=>button.onclick=()=>{region=button.dataset.solarRegion;gate=Math.min(progress[region]+1,regions[region].count);renderSolar();});
    galaxyPanel.querySelectorAll('[data-solar-gate]').forEach(button=>button.onclick=()=>{gate=Number(button.dataset.solarGate);renderSolar();});
    galaxyPanel.querySelector('.solar-deploy').onclick=()=>launchOperation(1,selectedKey,gate);
    galaxyPanel.querySelector('.region-star-claim').onclick=()=>openStarRewards(1,selectedKey);
  }
  function renderKepler(){
    const selected=keplerRegions[keplerRegion],cleared=keplerProgress[keplerRegion],regionEntries=Object.entries(keplerRegions);
    const totalStars=regionStars(keplerRatings,keplerRegion,selected.count);
    galaxyPanel.innerHTML=`<div class="kepler-map">
      <div class="magenta-scene kepler-scene">
        <img src="${keplerRegion==='kepler-base'?'kepler-secret-base-background.png':'kepler-planet.jpg'}" alt="케플러 행성과 주변 우주"/><span class="magenta-map-grid" aria-hidden="true"></span><span class="magenta-orbit orbit-outer" aria-hidden="true"></span><span class="magenta-orbit orbit-inner" aria-hidden="true"></span><span class="magenta-starlight" aria-hidden="true"><i style="--star-start:18deg;--star-radius:205px;--star-delay:-2s"></i><i style="--star-start:104deg;--star-radius:180px;--star-delay:-7s"></i><i style="--star-start:196deg;--star-radius:220px;--star-delay:-12s"></i><i style="--star-start:288deg;--star-radius:194px;--star-delay:-18s"></i></span>
        <div class="magenta-map-heading"><small>CHAPTER 03 · KEPLER SECTOR</small><b>케플러 행성</b><em>KEPLER PLANET · FRONTIER OPERATION</em></div>
        <div class="magenta-sector-pins kepler-sector-pins" aria-label="케플러 작전지역">${regionEntries.map(([key,r],index)=>{const locked=index>0&&keplerProgress[regionEntries[index-1][0]]<10;return `<button type="button" class="magenta-pin kepler-region-pin pin-${index+1}${key===keplerRegion?' selected':''}${locked?' locked':''}" data-kepler-region="${key}" aria-pressed="${key===keplerRegion}" ${locked?'disabled':''}><i aria-hidden="true">${locked?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="4" y="10" width="16" height="11" rx="2"/></svg>':''}</i><span><small>0${index+1} · ${r.en}</small><b>${r.name}</b></span></button>`;}).join('')}</div>
      </div>
      <div class="magenta-route-panel kepler-route-panel"><div class="magenta-route-heading"><span><small>선택 작전지역 · ${selected.en}</small><b>${selected.name}</b></span><strong>${cleared} <small>/ 10 완료</small></strong></div>
        <div class="magenta-route kepler-route" aria-label="${selected.name} 관문 선택">${Array.from({length:10},(_,i)=>{const n=i+1,locked=n>cleared+1,stars=Math.max(0,Math.min(3,Number(keplerRatings[keplerRegion+'-'+n])||0));return `<button type="button" data-kepler-gate="${n}" class="magenta-gate${n===keplerGate&&!locked?' selected':''}${n<=cleared?' cleared':''}" ${locked?'disabled':''} aria-label="${selected.name} ${n}관문 ${locked?'잠김':n<=cleared?'완료':'도전 가능'}" aria-pressed="${n===keplerGate&&!locked}"><span>${String(n).padStart(2,'0')}</span><small>${locked?'잠김':n<=cleared?(stars?'★'.repeat(stars):'완료'):'도전'}</small></button>`;}).join('')}</div>
        <div class="magenta-route-footer">${starRewardButton(totalStars,selected.count)}<button type="button" class="magenta-deploy kepler-deploy">전선 출격</button></div>
      </div>
    </div>`;
    const scene=galaxyPanel.querySelector('.kepler-scene');scene.dataset.region=keplerRegion;scene.querySelector('img').alt=selected.name+' 작전지역';
    galaxyPanel.querySelectorAll('[data-kepler-region]').forEach(button=>button.onclick=()=>{keplerRegion=button.dataset.keplerRegion;keplerGate=Math.min(keplerProgress[keplerRegion]+1,10);renderKepler();});
    galaxyPanel.querySelectorAll('[data-kepler-gate]').forEach(button=>button.onclick=()=>{keplerGate=Number(button.dataset.keplerGate);renderKepler();});
    galaxyPanel.querySelector('.kepler-deploy').onclick=()=>launchOperation(3,keplerRegion,keplerGate);
    galaxyPanel.querySelector('.region-star-claim').onclick=()=>openStarRewards(3,keplerRegion);
  }
  function operationFor(chapter,key,number){const r=chapter===3?keplerRegions[key]:chapter===2?magentaRegions[key]:regions[key];return {chapter,region:key,regionName:r.name,regionEn:r.en,gate:number};}
  const chapterOneComplete=()=>Object.keys(regions).every(key=>progress[key]>=regions[key].count);
  const firstUnclearedMagenta=()=>Object.keys(magentaRegions).find(key=>magentaProgress[key]<magentaRegions[key].count);
  const chapterTwoComplete=()=>Object.keys(magentaRegions).every(key=>magentaProgress[key]>=magentaRegions[key].count);
  const firstUnclearedKepler=()=>Object.keys(keplerRegions).find(key=>keplerProgress[key]<keplerRegions[key].count);
  const chapterThreeComplete=()=>Object.keys(keplerRegions).every(key=>keplerProgress[key]>=keplerRegions[key].count);
  const chapterTwoUnlocked=()=>chapterOneComplete()||Object.values(magentaProgress).some(value=>value>0);
  function launchOperation(chapter,key,number){
    if (window.tutorialAllowsGate && !window.tutorialAllowsGate(chapter,key,number)) {
      window.notice?.('파라의 안내에 따라 다음 관문으로 출격해 주세요.');
      return false;
    }
    const list=chapter===3?keplerRegions:chapter===2?magentaRegions:regions,completed=chapter===3?keplerProgress:chapter===2?magentaProgress:progress;
    if(!list[key]||number<1||number>list[key].count||number>completed[key]+1)return;
    if(chapter===1&&regionRequirement(key))return;
    if(chapter===3){const keys=Object.keys(keplerRegions),index=keys.indexOf(key);if(index>0&&keplerProgress[keys[index-1]]<10)return;}
    if(chapter===2){magentaRegion=key;magentaGate=number;}else if(chapter===3){keplerRegion=key;keplerGate=number;}else{region=key;gate=number;}
    running={chapter,region:key,gate:number,complete:false};wave=1;placed=0;
    const operation=operationFor(chapter,key,number);window.battleOperation=operation;window.show('battle');requestAnimationFrame(()=>window.prepareBattle?.(operation));return true;
  }
  window.launchTutorialMarsGate=number=>launchOperation(1,'mars',Number(number));
  function chooseChapter(kind){
    if(kind==='galaxy'&&!chapterTwoUnlocked()){notice('챕터 1의 모든 관문을 완료하면 챕터 2가 개방됩니다.');return;}
    chapterPicker.hidden=kind!==null;chapterBack.hidden=kind===null;art.hidden=kind!=='solar';galaxyPanel.hidden=!['solar','galaxy','kepler','tapao','neptune'].includes(kind);
    chapterHeading.querySelector('h1').textContent=kind==='solar'?'CHAP 1. 태양계':kind==='galaxy'?'CHAP 2. 마젠타 행성':kind==='kepler'?'CHAP 3. 케플러 행성':kind==='tapao'?'CHAP 4. 타파오 통 행성':kind==='neptune'?'CHAP 5. 수퍼 넵튠 행성':'우주지도';
    chapterHeading.querySelector('small').textContent=kind==='solar'?'SOLAR SYSTEM · EXPEDITION':kind==='galaxy'?'MAGENTA PLANET':kind==='kepler'?'KEPLER PLANET':kind==='tapao'?'TAPAO THONG PLANET':kind==='neptune'?'SUPER NEPTUNE PLANET':'CHAPTER SELECT';
    chapterHeading.querySelector('p').textContent=kind==='solar'?'지도 속 작전 지역을 선택하세요':kind==='galaxy'?'작전지역을 선택하고 항로의 관문에 출격하세요':kind==='kepler'?'케플러 항로를 선택하고 관문에 출격하세요':kind?'미탐사 영역':'탐사할 영역을 선택하세요';
    if(kind==='solar'){renderSolar();return;}
    if(kind==='galaxy'){renderMagenta();return;}
    if(kind==='kepler'){const next=Object.keys(keplerRegions).find(key=>keplerProgress[key]<10);keplerRegion=next||'kepler-base';keplerGate=Math.min(keplerProgress[keplerRegion]+1,10);renderKepler();return;}
    if(['galaxy','kepler','tapao','neptune'].includes(kind)){
      const name=kind==='galaxy'?'마젠타 행성':kind==='kepler'?'케플러 행성':kind==='tapao'?'타파오 통 행성':'수퍼 넵튠 행성',image=kind==='galaxy'?'magenta-planet.jpg':kind==='kepler'?'kepler-planet.jpg':kind==='tapao'?'tapao-thong-planet.jpg':'super-neptune-planet.png';
      galaxyPanel.innerHTML=`<div class="galactic-map original-planet-image orbit-${kind}"><img src="${image}" alt="${name}"/></div><h2>${name}</h2>`;
    }
  }
  chapterPicker.querySelector('.chapter-solar').onclick=()=>chooseChapter('solar');
  const galaxyCard=chapterPicker.querySelector('.chapter-galaxy');
  galaxyCard.querySelector('img').src='magenta-planet.jpg';
  galaxyCard.querySelector('img').alt='마젠타 행성';
  galaxyCard.querySelector('.chapter-copy b').textContent='마젠타 행성';
  galaxyCard.querySelector('.chapter-copy small').textContent='CHAP 2.';
  galaxyCard.querySelector('.chapter-copy em').textContent='MAGENTA PLANET · 3개 작전지역 · 30개 관문';
  const keplerCard=galaxyCard.cloneNode(true);keplerCard.classList.remove('chapter-galaxy');keplerCard.classList.add('chapter-kepler');
  const tapaoCard=galaxyCard.cloneNode(true);tapaoCard.classList.remove('chapter-galaxy');tapaoCard.classList.add('chapter-tapao');
  tapaoCard.querySelector('img').src='tapao-thong-planet.jpg';tapaoCard.querySelector('img').alt='타파오 통 행성';tapaoCard.querySelector('.chapter-copy small').textContent='CHAP 4.';tapaoCard.querySelector('.chapter-copy b').textContent='타파오 통 행성';tapaoCard.querySelector('.chapter-copy em').textContent='TAPAO THONG PLANET';tapaoCard.onclick=()=>chooseChapter('tapao');
  keplerCard.querySelector('img').src='kepler-planet.jpg';keplerCard.querySelector('img').alt='케플러 행성';keplerCard.querySelector('.chapter-copy small').textContent='CHAP 3.';keplerCard.querySelector('.chapter-copy b').textContent='케플러 행성';keplerCard.querySelector('.chapter-copy em').textContent='KEPLER PLANET · 30개 관문';chapterPicker.append(keplerCard);keplerCard.onclick=()=>chooseChapter('kepler');
  galaxyPanel.innerHTML='<div class="galactic-map"><img src="milky-way-map.svg" alt="우리 은하 작전 지도"/><button type="button" class="galactic-solar" aria-label="태양계 지도로 이동"><i></i><b>태양계</b></button><span class="galactic-core">은하 중심</span></div><h2>우리 은하</h2><p>태양계 표식을 누르면 태양계 작전 지도로 이동합니다.</p><small>그 외 은하계 작전 지역은 준비 중입니다. · 위치와 크기는 개념도입니다.</small>';
  galaxyPanel.querySelector('.galactic-solar').onclick=()=>chooseChapter('solar');
  const chapterTwoCard=chapterPicker.querySelector('.chapter-galaxy');
  chapterTwoCard.onclick=()=>chooseChapter('galaxy');
  const syncChapterTwoCard=()=>{const unlocked=chapterTwoUnlocked();chapterTwoCard.classList.toggle('locked',!unlocked);chapterTwoCard.setAttribute('aria-disabled',String(!unlocked));chapterTwoCard.querySelector('.chapter-copy em').textContent=unlocked?'MAGENTA PLANET · 3개 작전지역 · 30개 관문':'CHAPTER 1 완료 후 개방';};
  syncChapterTwoCard();
  chapterBack.onclick=()=>chooseChapter(null);
  chapterPicker.append(tapaoCard);
  const neptuneCard=tapaoCard.cloneNode(true);neptuneCard.classList.replace('chapter-tapao','chapter-neptune');
  neptuneCard.querySelector('img').src='super-neptune-planet.png';neptuneCard.querySelector('img').alt='수퍼 넵튠 행성';neptuneCard.querySelector('.chapter-copy small').textContent='CHAP 5.';neptuneCard.querySelector('.chapter-copy b').textContent='수퍼 넵튠 행성';neptuneCard.querySelector('.chapter-copy em').textContent='SUPER NEPTUNE PLANET';neptuneCard.onclick=()=>chooseChapter('neptune');chapterPicker.append(neptuneCard);
  chapterPicker.tabIndex=0;chapterPicker.setAttribute('aria-label','탐사영역 목록 · 위아래로 스크롤');
  window.openPlanetMenu=()=>{chooseChapter(null);window.show('map');};
  chooseChapter(null);
  function selectTarget(key){
    if(region===key&&!popup.hidden){expanded=true;}else{region=key;gate=Math.min(progress[key]+1,regions[key].count);expanded=false;}
    popup.hidden=false;details.hidden=!expanded;nameButton.setAttribute('aria-expanded',String(expanded));
    popup.classList.toggle('expanded',expanded);
    const positions={mars:[71.04,35.95],titan:[82.29,65.95],oort:[50,91.67]};
    const [x,y]=positions[key];
    const width=Math.min(expanded?296:158,art.clientWidth-16);
    const left=Math.max(8,Math.min(art.clientWidth*x/100-width/2,art.clientWidth-width-8));
    popup.style.width=width+'px';popup.style.left=left+'px';popup.style.bottom=(100-y)+'%';popup.style.setProperty('--pointer-x',(art.clientWidth*x/100-left)+'px');
    render();
  }
  art.querySelectorAll('[data-target]').forEach(button=>button.onclick=()=>selectTarget(button.dataset.target));
  function updateRegionMarkers(){
    art.querySelectorAll('[data-target]').forEach(button=>{
      const key=button.dataset.target,reason=regionRequirement(key),complete=progress[key]>=regions[key].count;
      button.classList.toggle('operation-ready',!reason&&!complete);
      button.classList.toggle('operation-locked',!!reason);
      button.classList.toggle('operation-complete',!reason&&complete);
      const label=reason?'작전 잠김':complete?'완료 · 재도전':'작전 가능';
      button.setAttribute('aria-label',`${regions[key].name} · ${label}${reason?' · '+reason:''}`);
      button.title=reason||label;
      let state=button.querySelector('.operation-state');
      if(!state){state=document.createElement('span');state.className='operation-state';button.append(state);}
      state.textContent=label;
      let badge=button.querySelector('.operation-lock');
      if(!badge){badge=document.createElement('span');badge.className='operation-lock';badge.setAttribute('aria-hidden','true');badge.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="4" y="10" width="16" height="12" rx="3"/><path d="M12 14v4"/></svg>';button.append(badge);}
      badge.hidden=!reason;
    });
  }
  updateRegionMarkers();
  nameButton.onclick=()=>selectTarget(region);
  popup.querySelector('.popup-close').onclick=()=>{popup.hidden=true;expanded=false;details.hidden=true;art.querySelectorAll('[data-target]').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-expanded','false');});};
  function render() {
    if (!region) return;
    const r = regions[region], cleared = progress[region], requirement = regionRequirement(region);
    updateRegionMarkers();
    nameButton.innerHTML=`<b>${r.name}</b><small>${r.en}</small>`;
    art.querySelectorAll('[data-target]').forEach(b=>{b.classList.toggle('selected',b.dataset.target===region);b.setAttribute('aria-expanded',String(b.dataset.target===region&&expanded));});
    map.querySelectorAll('[data-region]').forEach(b=>{b.classList.toggle('selected',b.dataset.region===region);b.setAttribute('aria-pressed',String(b.dataset.region===region));});
    status.textContent = `${r.name} · ${cleared} / ${r.count} 클리어 · 이전 관문 클리어 시 다음 관문 해금`;
    grid.innerHTML = Array.from({length:r.count},(_,i)=>{const n=i+1,locked=!!requirement||n>cleared+1,stars=Math.max(0,Math.min(3,Number(ratings[region+'-'+n])||0));return `<button type="button" data-gate="${n}" class="${n<=cleared?'cleared ':''}${n===gate&&!locked?'selected':''}" ${locked?'disabled':''} aria-label="${roman(n)} 관문 ${requirement|| (locked?'잠김':n<=cleared?'클리어 '+(stars?stars+'성':'평가 미기록'):'도전 가능')}" aria-pressed="${n===gate&&!locked}"><b>${roman(n)}</b><small class="gate-stars">${locked?'잠김':n<=cleared?(stars?'★'.repeat(stars)+'☆'.repeat(3-stars):'기록 없음'):'도전'}</small></button>`;}).join('');
    clearTimeout(unlockTimer);lockLayer.classList.remove('unlocking');
    lockLayer.hidden=!requirement;gateWrap.classList.toggle('region-locked',!!requirement);
    lockLayer.querySelector('b').textContent=requirement;
    lockLayer.querySelector('small').textContent='이전 지역의 모든 관문을 완료하세요';
    if(!requirement&&expanded&&!popup.hidden&&!art.hidden&&!unlockSeen[region]){
      unlockSeen[region]=true;try{localStorage.setItem('planet-unlock-seen-v1',JSON.stringify(unlockSeen));}catch(_){}
      lockLayer.hidden=false;lockLayer.querySelector('b').textContent='첫 관문 개방';lockLayer.querySelector('small').textContent='작전을 시작할 수 있습니다';
      void lockLayer.offsetWidth;lockLayer.classList.add('unlocking');
      unlockTimer=setTimeout(()=>{lockLayer.hidden=true;lockLayer.classList.remove('unlocking');},1700);
    }
    launch.disabled=!!requirement;
    launch.querySelector('small').textContent=requirement||`${r.name} · ${roman(gate)} 관문`;
  }
  map.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{region=b.dataset.region;gate=Math.min(progress[region]+1,regions[region].count);render();});
  grid.onclick=e=>{const b=e.target.closest('[data-gate]');if(!b||b.disabled)return;gate=Number(b.dataset.gate);render();};
  launch.onclick=()=>{
    if(!region || regionRequirement(region) || gate>progress[region]+1)return;
    launchOperation(1,region,gate);
  };
  window.completeBattleOperation=result=>{
    if(!running||running.complete||!result?.victory)return false;
    running.complete=true;
    const isMagenta=running.chapter===2,isKepler=running.chapter===3,earned=isKepler?keplerRatings:isMagenta?magentaRatings:ratings,completed=isKepler?keplerProgress:isMagenta?magentaProgress:progress;
    const firstClear=running.gate>(Number(completed[running.region])||0);
    const stars=Math.max(1,Math.min(3,Number(result.stars)||1)),ratingKey=`${running.region}-${running.gate}`;
    earned[ratingKey]=Math.max(Number(earned[ratingKey])||0,stars);
    completed[running.region]=Math.max(completed[running.region],running.gate);
    try{localStorage.setItem(isKepler?'kepler-campaign-v1':isMagenta?'magenta-campaign-v1':'planet-campaign-v1',JSON.stringify(completed));localStorage.setItem(isKepler?'kepler-campaign-stars-v1':isMagenta?'magenta-campaign-stars-v1':'planet-campaign-stars-v1',JSON.stringify(earned));}catch(_){}
     // 전투 결과 화면에서 사용자가 다음 관문/돌아가기를 선택할 때까지
     // 작전 화면을 유지한다. 여기서 지도 화면으로 이동하면 결과 버튼이
     // 사라지므로, 진행도만 저장하고 화면 전환은 각 버튼에 맡긴다.
     if(isMagenta){magentaRegion=running.region;magentaGate=running.gate;}
     else if(isKepler){keplerRegion=running.region;keplerGate=running.gate;}
     else{region=running.region;gate=running.gate;}
     window.updateOperationLocation();
     window.dispatchEvent(new CustomEvent('campaign-gate-cleared',{detail:{chapter:running.chapter||1,region:running.region,gate:running.gate,firstClear}}));
    return true;
  };
  window.isBattleGateFirstClear=()=>{
    if(!running)return false;
    const chapter=running.chapter||1;
    const completed=chapter===3?keplerProgress:chapter===2?magentaProgress:progress;
    return Number(running.gate)>Number(completed[running.region]||0);
  };
  window.retryCurrentBattle=()=>{
    if(!running)return;launchOperation(running.chapter||1,running.region,running.gate);
  };
   window.advanceBattleStage=()=>{
     if(!running)return window.show('map');
     const chapter=running.chapter||1,key=running.region,list=chapter===3?keplerRegions:chapter===2?magentaRegions:regions,completed=chapter===3?keplerProgress:chapter===2?magentaProgress:progress;
     if(running.gate<list[key].count){
       launchOperation(chapter,key,Math.min(running.gate+1,completed[key]+1));
       return;
     }
     const regionKeys=Object.keys(list),nextRegion=regionKeys[regionKeys.indexOf(key)+1];
     if(nextRegion){
       // 작전지역의 마지막 관문을 끝내면 다음 지역의 1번 관문으로 직행한다.
       launchOperation(chapter,nextRegion,1);
       return;
     }
     window.returnToBattleMap();
   };
   window.returnToBattleMap=()=>{
     if(running?.chapter===3){
        keplerRegion=running.region;keplerGate=running.gate;chooseChapter('kepler');
     }else if(running?.chapter===2){
        magentaRegion=running.region;magentaGate=running.gate;
        chooseChapter('galaxy');
     }else{
       region=running?.region||region;gate=running?.gate||gate;chooseChapter('solar');
     }
     window.show('map');
   };
  function regionRequirement(key){
    if(key==='oort'&&(progress.titan<regions.titan.count||progress.mars<regions.mars.count))return '타이탄임무 미완료';
    if(key==='titan'&&progress.mars<regions.mars.count)return '화성임무 미완료';
    return '';
  }
  const firstUncleared=()=>Object.keys(regions).find(key=>progress[key]<regions[key].count);
  window.updateOperationLocation=()=>{
    if(chapterOneComplete()){
      const magentaKey=firstUnclearedMagenta(),keplerKey=chapterTwoComplete()?firstUnclearedKepler():null;
      const nextChapter=chapterTwoComplete()?(chapterThreeComplete()?4:3):2;
      const nextKey=nextChapter===2?magentaKey:nextChapter===3?keplerKey:null;
      const caption=document.querySelector('.deck-caption'),platform=document.querySelector('.flagship-platform'),button=document.querySelector('.deck-launch');
      const chapterImage=nextChapter===2?'magenta-planet.jpg':nextChapter===3?'kepler-planet-map.png':'tapao-thong-planet.jpg';
      const chapterTitle=nextChapter===2?'마젠타 행성':nextChapter===3?'케플러 행성':'타파오 통 행성';
      const chapterCode=nextChapter===2?'MAGENTA PLANET':nextChapter===3?'KEPLER PLANET':'TAPAO THONG PLANET';
      const operationName=nextKey?(nextChapter===2?magentaRegions[nextKey].name:keplerRegions[nextKey].name):chapterTitle;
      const chapterDone=nextChapter===4;
      if(caption){caption.querySelector('span').textContent=`현재 작전 위치 · CHAPTER ${nextChapter}`;caption.querySelector('b').textContent=nextKey?`${operationName} · ${roman((nextChapter===2?magentaProgress:keplerProgress)[nextKey]+1)} 관문`:chapterDone?'다음 작전 챕터 · 준비 중':`${chapterTitle} · 모든 관문 클리어`;}
      if(platform&&platform.dataset.operation!==`chapter${nextChapter}:${nextKey||'complete'}`){
        platform.dataset.operation=`chapter${nextChapter}:${nextKey||'complete'}`;
        platform.innerHTML=`<img class="chapter-platform-image" src="${chapterImage}" alt="${chapterTitle} 챕터 이미지"/><div class="fleet-tag"><b>${operationName}</b><span>${nextKey?chapterCode+' · 현재 작전 지역':chapterDone?chapterCode+' · 작전 준비 중':chapterCode+' · 모든 관문 클리어'}</span></div>`;
      }
      if(button){button.disabled=!nextKey;button.querySelector('small').textContent=nextKey?`${chapterCode} · ${operationName} · GATE ${roman((nextChapter===2?magentaProgress:keplerProgress)[nextKey]+1)}`:chapterDone?'CHAPTER 4 · 준비 중':'ALL CHAPTER OPERATIONS COMPLETE';}
      syncChapterTwoCard();
      return;
    }
    const key=firstUncleared(),caption=document.querySelector('.deck-caption');
    if(!caption)return;
    caption.querySelector('span').textContent='현재 작전 위치 · NEXT OPERATION';
    caption.querySelector('b').textContent=key?`${regions[key].name} · ${roman(progress[key]+1)} 관문`:'태양계 · 모든 관문 클리어';
    const platform=document.querySelector('.flagship-platform');
    if(platform&&platform.dataset.operation!==String(key)){
      platform.dataset.operation=String(key);
      if(key==='mars')platform.innerHTML='<div class="mars-globe" role="img" aria-label="자전하는 화성"><div class="mars-surface"></div></div><div class="fleet-tag"><b>화성</b><span>MARS · 현재 작전 지역</span></div>';
      else if(key==='titan')platform.innerHTML='<div class="rotating-planet titan-operation" role="img" aria-label="자전하는 타이탄"><div class="planet-texture"></div></div><div class="fleet-tag"><b>타이탄 위성</b><span>TITAN · 현재 작전 지역</span></div>';
      else if(key==='oort')platform.innerHTML='<div class="oort-operation" role="img" aria-label="고정된 태양계 바깥을 천천히 시계 방향으로 회전하는 오르트구름"><div class="oort-operation-solar" aria-hidden="true"><i></i><i></i><i></i><b></b></div><div class="oort-operation-cloud"><img src="oort-cloud-transparent.png" alt="" aria-hidden="true"/></div></div><div class="fleet-tag"><b>오르트구름</b><span>OORT CLOUD · 현재 작전 지역</span></div>';
      else platform.innerHTML='<img src="solar-system-map.svg" alt="작전 완료된 태양계"/><div class="fleet-tag"><b>태양계</b><span>모든 관문 클리어</span></div>';
    }
    const button=document.querySelector('.deck-launch');
    if(button){button.disabled=!key;button.querySelector('small').textContent=key?`${regions[key].en} · GATE ${roman(progress[key]+1)}`:'ALL OPERATIONS COMPLETE';}
  };
  window.deployFirstUncleared=()=>{
    if(chapterOneComplete()){
      if(!chapterTwoComplete()){
        const key=firstUnclearedMagenta();launchOperation(2,key,magentaProgress[key]+1);return;
      }
      if(!chapterThreeComplete()){
        const key=firstUnclearedKepler();launchOperation(3,key,keplerProgress[key]+1);return;
      }
      notice('케플러 챕터를 모두 완료했습니다. 다음 챕터는 준비 중입니다.');
      return;
    }
    const key=firstUncleared();
    if(!key){notice('태양계의 모든 관문을 클리어했습니다.');return;}
    region=key;gate=progress[key]+1;chooseChapter('solar');selectTarget(key);
    // selectTarget may preserve an existing selection; always launch the first uncleared gate.
    gate=progress[key]+1;expanded=true;details.hidden=false;popup.classList.add('expanded');render();
    launch.onclick();
  };
}


// 함선 상세 카드의 기술 칸(핵심·보조·최종)을 누르면 그 기술의 설명을 작은 팝업으로 띄운다.
function showSkillDetailPopup(anchor,title,detail,requirement=''){
  document.querySelector('.skill-detail-popup')?.remove();
  const pop=document.createElement('div');
  pop.className='skill-detail-popup';
  pop.setAttribute('role','dialog');
  pop.setAttribute('aria-label',`${title} 설명`);
  pop.innerHTML=`<b>${title}</b><p>${detail}</p>${requirement?`<small>${requirement}</small>`:''}`;
  document.body.append(pop);
  const r=anchor.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight;
  const left=Math.max(8,Math.min(window.innerWidth-w-8,r.left));
  const top=r.bottom+6+h>window.innerHeight?Math.max(8,r.top-h-6):r.bottom+6;
  pop.style.left=`${left}px`;pop.style.top=`${top}px`;
  const close=event=>{if(!pop.contains(event.target)){pop.remove();document.removeEventListener('click',close,true);}};
  setTimeout(()=>document.addEventListener('click',close,true),0);
}
