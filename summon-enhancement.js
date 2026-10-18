window.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelector('.summon-tabs');
  const weaponPool = document.getElementById('weapon-pool');
  if (!tabs || !weaponPool || document.getElementById('captain-pool')) return;
  const weaponImage = weaponPool.querySelector('.weapon-art img');
  if (weaponImage) weaponImage.remove();
  const weaponTitle = weaponPool.querySelector(':scope > b');
  if (weaponTitle) weaponTitle.textContent = '전술 무기 연구';

  const tacticalWeaponStorageKey = 'starfleet-tactical-weapon-research-v1';
  let tacticalWeaponState = {};
  try { tacticalWeaponState = JSON.parse(localStorage.getItem(tacticalWeaponStorageKey) || '{}') || {}; } catch { tacticalWeaponState = {}; }
  let researchJournal = Math.max(0, Math.floor(Number(tacticalWeaponState.researchJournal) || 0));
  // 프리깃 개발 비용: 연구일지 = 단계 묶음 기본값(1~4단계 1, 5~8단계 2, … 21~24단계 6, 25~28단계 7) + 지금까지 개발한 횟수.
  // Frigate Charging·Persistence·Expedition 계열은 개발마다 연구 코어 1개를 추가로 소모한다.
  const FRIGATE_CORE_NODES = ['firepower2', 'frigateCharging2', 'frigateCharging3', 'frigatePersistence', 'frigatePersistence2', 'frigateExpedition'];
  const frigateDevelopmentCost = (node, level, stage) => ({ journal: Math.ceil(Math.max(1, stage) / 4) + level, core: FRIGATE_CORE_NODES.includes(node?.key) ? 1 : 0 });
  let researchCore = Math.max(0, Math.floor(Number(tacticalWeaponState.researchCore) || 0));
  const tacticalFields = [
    ['cannon', '함포', '⚓', '포신 합금'],
    ['missile', '미사일', '◈', '유도 회로'],
    ['electric', '전기', 'ϟ', '전도 코어'],
    ['laser', '레이저포', '⌁', '광학 렌즈'],
    ['piercing', '관통레이저', '╫', '집속 결정'],
    ['carrier', '함재기', '✈', '비행 제어칩'],
    ['defense', '방어모듈', '⬡', '차폐 합금'],
    ['frigate', '프리깃', '⌬', '지원 프로토콜']
  ];
  const tacticalBadge = (id, fallback, context) => {
    if (id === 'cannon') return '<svg class="tactical-weapon-icon tactical-cannon-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 10.5h17.5l5-2.5v6l-5-2.5H4z"/><path d="M7 13.5h13l3 7H9z"/><path d="M5 23h22"/><circle cx="11" cy="23" r="2.2"/><circle cx="22" cy="23" r="2.2"/></svg>';
    if (id === 'missile') return '<svg class="tactical-weapon-icon tactical-missile-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3c4.6 4.8 6.1 10.1 5.3 18.2H10.7C9.9 13.1 11.4 7.8 16 3Z"/><path d="M10.7 16 7 21.5V26l4.7-3.4m9.6-6.6 3.7 5.5V26l-4.7-3.4M13 21.2 12.2 28 16 25l3.8 3-.8-6.8"/><circle cx="16" cy="12" r="2.1"/></svg>';
    if (id === 'laser') {
      const gradientId = `tactical-laser-gradient-${context}`;
      return `<svg class="tactical-weapon-icon tactical-laser-icon" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".38" stop-color="#8eeeff"/><stop offset="1" stop-color="#7660ff"/></linearGradient></defs><path class="laser-rail" d="M11 4 9 27m12-23 2 23"/><path class="laser-beam" d="M16 3 19.1 17 16 29l-3.1-12Z" style="fill:url(#${gradientId})"/></svg>`;
    }
    return fallback;
  };
  const saveTacticalState = () => { try { localStorage.setItem(tacticalWeaponStorageKey, JSON.stringify(tacticalWeaponState)); } catch {} window.dispatchEvent(new Event('commander-research-updated')); };
  const tacticalProgress = (id) => {
    const saved = tacticalWeaponState[id] || {};
    return { materials: Math.max(0, Number(saved.materials) || 0), level: Math.max(0, Number(saved.level) || 0) };
  };
  const dedicatedCoreCount = id => Math.max(0, Math.floor(Number(tacticalWeaponState[id]?.materials) || 0));
  const coreInventoryMarkup = id => {
    const dedicated = dedicatedCoreCount(id), universal = researchCore;
    return `<span class="core-inventory-line"><img src="icons/research-core.png" alt="연구코어"/><strong>연구코어</strong><span>전용 <b>${dedicated.toLocaleString('ko-KR')}</b></span><i>/</i><span>범용 <b>${universal.toLocaleString('ko-KR')}</b></span><i>/</i><span>사용 가능 <b>${(dedicated+universal).toLocaleString('ko-KR')}</b></span></span>`;
  };
  const developmentResetCost = id => Math.min(Number.MAX_SAFE_INTEGER, 100 * (2 ** Math.max(0, Math.floor(Number(tacticalWeaponState.developmentResetCounts?.[id]) || 0))));
  const developmentResetButton = id => `<button type="button" class="tactical-tech-reset cannon-tech-reset" data-tech-reset="${id}" title="이 분야의 개발 단계 초기화">초기화 · <b>${developmentResetCost(id).toLocaleString('ko-KR')}</b> 골드</button>`;
  const resetDevelopment = (id, modal, render) => {
    const cost=developmentResetCost(id);
    const refund=developmentSpend(id);
    let balances=window.gameResources;
    if(!balances){try{balances={gold:0,thorium:0,...(JSON.parse(localStorage.getItem('starfleet-game-resources-v1')||'{}')||{})};}catch{balances={gold:0,thorium:0};}window.gameResources=balances;}
    try{const saved=JSON.parse(localStorage.getItem('starfleet-game-resources-v1')||'null');if(saved&&typeof saved==='object')Object.assign(balances,saved);}catch{}
    const gold=Math.max(0,Math.floor(Number(balances.gold)||0));
    if(gold<cost){notice(`개발 초기화에는 골드 ${cost.toLocaleString('ko-KR')}개가 필요합니다.`);return;}
    if(!window.confirm(`${id==='cannon'?'함포':tacticalFields.find(([field])=>field===id)?.[1]||id} 개발을 초기화할까요?\n개발 단계와 적용 보너스를 초기화하고 연구일지 ${refund.journal.toLocaleString('ko-KR')}개와 범용 연구코어 ${refund.core.toLocaleString('ko-KR')}개를 반환합니다.\n비용: 골드 ${cost.toLocaleString('ko-KR')}`))return;
    balances.gold=gold-cost;window.gameResources=balances;
    researchJournal+=refund.journal;researchCore+=refund.core;saveResearchCurrency();
    try{localStorage.setItem('starfleet-game-resources-v1',JSON.stringify(balances));}catch{}
    tacticalWeaponState.developmentResetCounts={...(tacticalWeaponState.developmentResetCounts||{}),[id]:Math.max(0,Math.floor(Number(tacticalWeaponState.developmentResetCounts?.[id])||0))+1};
    if(id==='cannon'){
      tacticalWeaponState.cannonTree={};
      tacticalWeaponState.cannonBonuses=cannonBonusesFromLevels({});
    }else{
      tacticalWeaponState[`${id}Tree`]={};
      tacticalWeaponState[id]={...(tacticalWeaponState[id]||{}),level:0};
    }
    saveTacticalState();window.updateGameResourceHud?.();window.dispatchEvent(new Event('game-resources-updated'));
    if(id==='frigate')window.dispatchEvent(new CustomEvent('tactical-research-updated',{detail:{field:id,level:0}}));
    renderTacticalWeaponResearch();render();
  };
  const consumeCores = (id, amount) => {
    const dedicated = dedicatedCoreCount(id), fromDedicated = Math.min(dedicated, amount), fromUniversal = amount-fromDedicated;
    if (fromUniversal > researchCore) return false;
    if (fromDedicated) tacticalWeaponState[id] = { ...(tacticalWeaponState[id] || {}), materials: dedicated-fromDedicated };
    researchCore -= fromUniversal; saveResearchCurrency();
    return true;
  };
  const saveResearchCurrency = () => {
    tacticalWeaponState.researchJournal = researchJournal;
    tacticalWeaponState.researchCore = researchCore;
  };
  const firstTechName = id => id === 'defense' ? '내구강화' : id === 'frigate' ? '프리깃 사용 개방' : '화력';
  const cannonTreeNodes=[
    {key:'firepower1',label:'화력 I',max:5,x:50,y:1335,parents:[]},
    {key:'reload1',label:'장전',max:10,x:28,y:1235,parents:['firepower1']},
    {key:'shell1',label:'포탄강화 I',max:10,x:72,y:1235,parents:['firepower1']},
    {key:'rapidFire',label:'속사',max:10,x:28,y:1135,parents:['reload1']},
    {key:'shell2',label:'포탄강화 II',max:10,x:72,y:1135,parents:['shell1']},
    {key:'reload2',label:'재장전',max:10,x:28,y:1035,parents:['rapidFire']},
    {key:'shell3',label:'포탄강화 III',max:10,x:72,y:1035,parents:['shell2']},
    {key:'firepower2',label:'화력 II',max:5,x:50,y:935,parents:['reload2','shell3']},
    // 6~8단계: 장전 II·속사 II·재장전 II / 포탄개량 I~III → 9단계 화력 III
    {key:'loadII',label:'장전 II',max:10,x:28,y:835,parents:['firepower2']},
    {key:'shellUpgrade1',label:'포탄개량 I',max:10,x:72,y:835,parents:['firepower2']},
    {key:'rapidII',label:'속사 II',max:10,x:28,y:735,parents:['loadII']},
    {key:'shellUpgrade2',label:'포탄개량 II',max:10,x:72,y:735,parents:['shellUpgrade1']},
    {key:'reloadII',label:'재장전 II',max:10,x:28,y:635,parents:['rapidII']},
    {key:'shellUpgrade3',label:'포탄개량 III',max:10,x:72,y:635,parents:['shellUpgrade2']},
    {key:'firepower3',label:'화력 III',max:5,x:50,y:535,parents:['reloadII','shellUpgrade3']},
    // 10~12단계: 장전 III·속사 III·재장전 III / 장약강화 I~III → 13단계 폭렬탄
    {key:'loadIII',label:'장전 III',max:10,x:28,y:435,parents:['firepower3']},
    {key:'charge1',label:'장약강화 I',max:10,x:72,y:435,parents:['firepower3']},
    {key:'rapidIII',label:'속사 III',max:10,x:28,y:335,parents:['loadIII']},
    {key:'charge2',label:'장약강화 II',max:10,x:72,y:335,parents:['charge1']},
    {key:'reloadIII',label:'재장전 III',max:10,x:28,y:235,parents:['rapidIII']},
    {key:'charge3',label:'장약강화 III',max:10,x:72,y:235,parents:['charge2']},
    {key:'explosiveShell',label:'폭렬탄',max:1,x:50,y:135,parents:['reloadIII','charge3']}
  ];
  const cannonDevelopmentStage={
    firepower1:1,reload1:2,shell1:2,
    rapidFire:3,shell2:3,
    reload2:4,shell3:4,firepower2:5,
    loadII:6,shellUpgrade1:6,rapidII:7,shellUpgrade2:7,reloadII:8,shellUpgrade3:8,firepower3:9,
    loadIII:10,charge1:10,rapidIII:11,charge2:11,reloadIII:12,charge3:12,explosiveShell:13
  };
  // 연구일지 = 단계 + 개발 횟수, 화력 II·III는 연구 코어 1개 추가. 폭렬탄은 연구일지 130·연구 코어 10.
  const cannonDevelopmentCost=(node,level)=>node.key==='explosiveShell'?{journal:130,core:10}:({journal:(cannonDevelopmentStage[node.key]||6)+level,core:node.key==='firepower2'||node.key==='firepower3'?1:0});
  const CANNON_SPEED_KEYS=['reload1','rapidFire','reload2','loadII','rapidII','reloadII','loadIII','rapidIII','reloadIII'];
  const CANNON_DAMAGE_KEYS=['shell1','shell2','shell3','shellUpgrade1','shellUpgrade2','shellUpgrade3','charge1','charge2','charge3'];
  const cannonDevelopmentDetail={
    firepower1:'개발 1회마다 공격속도와 데미지가 각각 0.2% 증가합니다.',
    firepower2:'개발 1회마다 공격속도와 데미지가 각각 0.2% 증가합니다.',
    firepower3:'개발 1회마다 공격속도와 데미지가 각각 0.2% 증가합니다.',
    ...Object.fromEntries(CANNON_SPEED_KEYS.map(key=>[key,'개발 1회마다 공격속도가 0.1% 증가합니다.'])),
    ...Object.fromEntries(CANNON_DAMAGE_KEYS.map(key=>[key,'개발 1회마다 데미지가 0.1% 증가합니다.'])),
    explosiveShell:'함포 공격이 스플래시 효과를 가집니다. 폭발 범위 안의 적에게 공격력의 50% 피해를 줍니다.'
  };
  const cannonBonusesFromLevels=levels=>{
    const level=key=>{const node=cannonTreeNodes.find(entry=>entry.key===key);return Math.max(0,Math.min(node?.max||0,Math.floor(Number(levels[key])||0)));};
    const firepower=level('firepower1')+level('firepower2')+level('firepower3');
    return {
      attackSpeed:(2*firepower+CANNON_SPEED_KEYS.reduce((sum,key)=>sum+level(key),0))/10,
      damage:(2*firepower+CANNON_DAMAGE_KEYS.reduce((sum,key)=>sum+level(key),0))/10,
      explosiveShell:level('explosiveShell')>0
    };
  };
  if(tacticalWeaponState.cannonTree||tacticalWeaponState.cannonBonuses){
    tacticalWeaponState.cannonBonuses=cannonBonusesFromLevels(tacticalWeaponState.cannonTree||{});
    saveTacticalState();
  }
  const openCannonTechTree=(name,icon)=>{
    const modal=document.createElement('div');modal.className='tactical-tech-overlay cannon-tech-overlay';modal.setAttribute('role','presentation');
    let selectedNode=cannonTreeNodes[0]?.key||'firepower1';
    const state=()=>{const saved=tacticalWeaponState.cannonTree||{};return Object.fromEntries(cannonTreeNodes.map(node=>[node.key,Math.max(0,Math.min(node.max,Math.floor(Number(saved[node.key])||0)))]));};
    const isUnlocked=(node,levels)=>node.parents.length===0||node.parents.every(parent=>{const parentNode=cannonTreeNodes.find(entry=>entry.key===parent);return parentNode&&levels[parent]>=parentNode.max;});
    const render=()=>{
      const dialogScroll=modal.querySelector('.tactical-tech-dialog')?.scrollTop;
      const previousScroll=modal.querySelector('.cannon-tech-tree')?.scrollTop;
      const levels=state(),connectors=[];
      cannonTreeNodes.forEach(node=>node.parents.forEach(parent=>{const source=cannonTreeNodes.find(entry=>entry.key===parent);if(source)connectors.push(`<path class="${levels[parent]>=source.max?'active-connector':'pending-connector'}" d="M ${source.x} ${source.y-26} L ${node.x} ${node.y+26}"/>`);}));
      const nodes=cannonTreeNodes.map(node=>{
        const level=levels[node.key],unlocked=isUnlocked(node,levels),status=level>=node.max?'complete':unlocked?'available':'locked';
        return `<button type="button" class="cannon-tech-node ${status}${selectedNode===node.key?' selected':''}" data-cannon-node="${node.key}" style="--node-x:${node.x}%;--node-y:${node.y}px" aria-pressed="${selectedNode===node.key}"><small>${status==='complete'?'개발 완료':status==='available'?'개발 가능':'선행 개발 필요'}</small><b>${node.label}</b><span>${level}/${node.max}</span></button>`;
      }).join('');
      const selected=cannonTreeNodes.find(node=>node.key===selectedNode),selectedLevel=selected?levels[selected.key]:0,developmentCost=selected?cannonDevelopmentCost(selected,selectedLevel):{journal:0,core:0},dedicatedCores=dedicatedCoreCount('cannon'),totalCores=dedicatedCores+researchCore,canDevelop=!!selected&&isUnlocked(selected,levels)&&selectedLevel<selected.max&&researchJournal>=developmentCost.journal&&totalCores>=developmentCost.core;
      const selectedComplete=selectedLevel>=selected.max,selectedUnlocked=isUnlocked(selected,levels);
      const detail=cannonDevelopmentDetail[selected.key]||'세부 개발 효과는 추후 설정됩니다.';
      const actionLabel=selectedComplete?'개발 완료':!selectedUnlocked?'선행 기술 개발 완료 후 개방':!canDevelop?'연구 자원 부족':`${selected.label} 개발`;
      const actionCostMarkup=selectedComplete?'<em class="cannon-tech-action-cost spent">최대 개발</em>':`<em class="cannon-tech-action-cost"><span><b class="journal-cost-icon">▤</b>연구일지 ${developmentCost.journal}</span>${developmentCost.core?`<span><img src="icons/research-core.png" alt=""/>전용/범용 코어 ${developmentCost.core}</span>`:''}</em>`;
      const cumulative=cumulativeResearchText('cannon',cannonTreeNodes,levels,selected);
      modal.innerHTML=`<section class="tactical-tech-dialog cannon-tech-dialog" role="dialog" aria-modal="true" aria-label="함포 개발 테크트리"><header><div><small>TACTICAL ARMAMENTS · DEVELOPMENT</small><h2><i>${tacticalBadge('cannon',icon,'cannon-tree')}</i>${name} 개발</h2></div><button type="button" class="tactical-tech-close" aria-label="닫기">×</button></header><div class="cannon-tech-resources" aria-label="보유 연구 자원"><span class="journal-inventory-line"><img src="icons/research-journal.png" alt="연구일지"/><strong>연구일지</strong><b>${researchJournal.toLocaleString('ko-KR')}</b></span><span class="core-inventory-line"><img src="icons/research-core.png" alt="연구코어"/><strong>연구코어</strong><span>전용 <b>${dedicatedCores.toLocaleString('ko-KR')}</b></span><i>/</i><span>범용 <b>${researchCore.toLocaleString('ko-KR')}</b></span><i>/</i><span>사용 가능 <b>${totalCores.toLocaleString('ko-KR')}</b></span></span>${developmentResetButton('cannon')}</div><div class="cannon-tech-tree" style="--tech-tree-height:1370px" aria-label="함포 개발 계통도"><svg viewBox="0 0 100 1370" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="cannon-tree-arrow" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto"><path d="M0 5 L2.5 0 L5 5"/></marker></defs>${connectors.join('')}</svg>${nodes}</div><div class="cannon-tech-detail" aria-live="polite"><small>${selectedComplete?'DEVELOPMENT COMPLETE':selectedUnlocked?'DEVELOPMENT BRIEF':'RESEARCH LOCKED'}</small><div><strong>${selected.label}</strong><span>${selectedLevel}/${selected.max}</span></div><p>${detail}</p><b class="tech-cumulative">${cumulative}</b></div><button type="button" class="cannon-tech-action" ${canDevelop?'':'disabled'}><span>${actionLabel}</span>${actionCostMarkup}</button></section>`;
      // 개발 버튼을 누르면 창이 다시 그려지므로, 누르기 전 스크롤 위치로 되돌린다(창이 위로 튀지 않게).
      const dialog=modal.querySelector('.tactical-tech-dialog');if(dialog&&dialogScroll!==undefined)dialog.scrollTop=dialogScroll;
      const tree=modal.querySelector('.cannon-tech-tree');
      tree.scrollTop=previousScroll===undefined?tree.scrollHeight-tree.clientHeight:previousScroll;
      modal.querySelector('.tactical-tech-close').onclick=()=>modal.remove();
      modal.onclick=event=>{if(event.target===modal)modal.remove();};
      modal.querySelector('[data-tech-reset]')?.addEventListener('click',()=>resetDevelopment('cannon',modal,render));
      modal.querySelectorAll('[data-cannon-node]').forEach(button=>button.onclick=()=>{selectedNode=button.dataset.cannonNode;render();});
      modal.querySelector('.cannon-tech-action').onclick=()=>{
        if(!canDevelop)return;
        const next={...levels,[selected.key]:selectedLevel+1};
        researchJournal-=developmentCost.journal;if(developmentCost.core&&!consumeCores('cannon',developmentCost.core))return;saveResearchCurrency();
        tacticalWeaponState.cannonTree=next;
        tacticalWeaponState.cannonBonuses=cannonBonusesFromLevels(next);
        saveTacticalState();renderTacticalWeaponResearch();
        window.addMissionProgress?.('daily','research',1);window.addMissionProgress?.('weekly','research-50',1);
        notice(`함포 · ${selected.label} ${next[selected.key]}/${selected.max} 개발`);render();
      };
    };
    document.body.append(modal);render();
  };
  const branchedWeaponTrees={
    missile:{
      // 기준선 y=1535(1단계). 단계마다 100px씩 위로 올라가며 최종 관통탄은 13단계(y=335).
      details:{
        firepower2:'개발 1회마다 공격속도와 피해량이 각각 0.2% 상승합니다.',
        firepower3:'개발 1회마다 공격속도와 피해량이 각각 0.2% 상승합니다.',
        piercingShell:'미사일이 목표를 1회 관통합니다. 관통한 뒤쪽의 대상에게도 피해를 줍니다.'
      },
      nodes:[
        {key:'firepower1',label:'화력 I',max:5,x:50,y:1535,parents:[]},
        {key:'turret',label:'터렛',max:10,x:28,y:1435,parents:['firepower1']},
        {key:'warhead1',label:'탄두강화1',max:10,x:72,y:1435,parents:['firepower1']},
        {key:'vls',label:'VLS',max:10,x:28,y:1335,parents:['turret']},
        {key:'warhead2',label:'탄두강화2',max:10,x:72,y:1335,parents:['warhead1']},
        {key:'universalLauncher',label:'범용런처',max:10,x:28,y:1235,parents:['vls']},
        {key:'warhead3',label:'탄두강화3',max:10,x:72,y:1235,parents:['warhead2']},
        {key:'firepower2',label:'화력 II',max:5,x:50,y:1135,parents:['universalLauncher','warhead3']},
        {key:'turret2',label:'터렛2',max:10,x:28,y:1035,parents:['firepower2']},
        {key:'warheadImprove1',label:'탄두개량1',max:10,x:72,y:1035,parents:['firepower2']},
        {key:'vls2',label:'VLS2',max:10,x:28,y:935,parents:['turret2']},
        {key:'warheadImprove2',label:'탄두개량2',max:10,x:72,y:935,parents:['warheadImprove1']},
        {key:'universalLauncher2',label:'범용런처2',max:10,x:28,y:835,parents:['vls2']},
        {key:'warheadImprove3',label:'탄두개량3',max:10,x:72,y:835,parents:['warheadImprove2']},
        {key:'firepower3',label:'화력 III',max:5,x:50,y:735,parents:['universalLauncher2','warheadImprove3']},
        {key:'turret3',label:'터렛3',max:10,x:28,y:635,parents:['firepower3']},
        {key:'newWarhead1',label:'신소재탄두1',max:10,x:72,y:635,parents:['firepower3']},
        {key:'vls3',label:'VLS3',max:10,x:28,y:535,parents:['turret3']},
        {key:'newWarhead2',label:'신소재탄두2',max:10,x:72,y:535,parents:['newWarhead1']},
        {key:'universalLauncher3',label:'범용런처3',max:10,x:28,y:435,parents:['vls3']},
        {key:'newWarhead3',label:'신소재탄두3',max:10,x:72,y:435,parents:['newWarhead2']},
        {key:'piercingShell',label:'관통탄',max:1,x:50,y:335,parents:['universalLauncher3','newWarhead3']}
      ]
    },
    electric:{
      nodes:[
        {key:'firepower1',label:'화력 I',max:5,x:50,y:1535,parents:[]},
        {key:'powerSupply1',label:'전력공급1',max:10,x:28,y:1435,parents:['firepower1']},
        {key:'coil1',label:'코일강화1',max:10,x:72,y:1435,parents:['firepower1']},
        {key:'powerSupply2',label:'전력공급2',max:10,x:28,y:1335,parents:['powerSupply1']},
        {key:'coil2',label:'코일강화2',max:10,x:72,y:1335,parents:['coil1']},
        {key:'powerSupply3',label:'전력공급3',max:10,x:28,y:1235,parents:['powerSupply2']},
        {key:'coil3',label:'코일강화3',max:10,x:72,y:1235,parents:['coil2']},
        {key:'firepower2',label:'화력 II',max:5,x:50,y:1135,parents:['powerSupply3','coil3']},
        {key:'wireExpansion1',label:'전선증설1',max:10,x:28,y:1035,parents:['firepower2']},
        {key:'coilImprove1',label:'코일개량1',max:10,x:72,y:1035,parents:['firepower2']},
        {key:'wireExpansion2',label:'전선증설2',max:10,x:28,y:935,parents:['wireExpansion1']},
        {key:'coilImprove2',label:'코일개량2',max:10,x:72,y:935,parents:['coilImprove1']},
        {key:'wireExpansion3',label:'전선증설3',max:10,x:28,y:835,parents:['wireExpansion2']},
        {key:'coilImprove3',label:'코일개량3',max:10,x:72,y:835,parents:['coilImprove2']},
        {key:'firepower3',label:'화력 III',max:5,x:50,y:735,parents:['wireExpansion3','coilImprove3']},
        {key:'wireImprove1',label:'전선개량1',max:10,x:28,y:635,parents:['firepower3']},
        {key:'newCoil1',label:'신소재 코일1',max:10,x:72,y:635,parents:['firepower3']},
        {key:'wireImprove2',label:'전선개량2',max:10,x:28,y:535,parents:['wireImprove1']},
        {key:'newCoil2',label:'신소재 코일2',max:10,x:72,y:535,parents:['newCoil1']},
        {key:'wireImprove3',label:'전선개량3',max:10,x:28,y:435,parents:['wireImprove2']},
        {key:'newCoil3',label:'신소재 코일3',max:10,x:72,y:435,parents:['newCoil2']},
        {key:'thunderCascade',label:'뇌절',max:1,x:50,y:335,parents:['wireImprove3','newCoil3']}
      ],
      details:{
        firepower2:'개발 1회마다 공격속도와 피해량이 각각 0.2% 상승합니다.',
        firepower3:'개발 1회마다 공격속도와 피해량이 각각 0.2% 상승합니다.',
        thunderCascade:'전격 무기에 피격된 대상에서 시작해 가장 가까운 적으로 3번 전이합니다. 전이마다 피해의 50%를 주고 감전시킵니다. 같은 적은 한 번만 맞습니다.'
      }
    },
    laser:{
      // 기준선 y=1535(1단계). 단계마다 100px씩 위로 올라가며 최종 용융 레이저포는 13단계(y=335).
      details:{
        highEfficiency2:'개발 1회마다 공격속도와 피해량이 각각 0.2% 상승합니다.',
        highEfficiency3:'개발 1회마다 공격속도와 피해량이 각각 0.2% 상승합니다.',
        meltingLaser:'레이저포에 피격당한 대상은 1초마다 33%의 피해를 3초간 추가로 받습니다. 3초 안에 다시 피격되면 지속 시간이 3초로 다시 채워집니다.'
      },
      nodes:[
        {key:'highEfficiency1',label:'고효율1',max:5,x:50,y:1535,parents:[]},
        {key:'converter',label:'변환기',max:10,x:28,y:1435,parents:['highEfficiency1']},
        {key:'outputBoost1',label:'출력증강1',max:10,x:72,y:1435,parents:['highEfficiency1']},
        {key:'focusingDevice',label:'집속장치',max:10,x:28,y:1335,parents:['converter']},
        {key:'outputBoost2',label:'출력증강2',max:10,x:72,y:1335,parents:['outputBoost1']},
        {key:'controlDevice',label:'제어장치',max:10,x:28,y:1235,parents:['focusingDevice']},
        {key:'outputBoost3',label:'출력증강3',max:10,x:72,y:1235,parents:['outputBoost2']},
        {key:'highEfficiency2',label:'고효율2',max:5,x:50,y:1135,parents:['controlDevice','outputBoost3']},
        {key:'converter2',label:'변환기2',max:10,x:28,y:1035,parents:['highEfficiency2']},
        {key:'outputImprove1',label:'출력강화1',max:10,x:72,y:1035,parents:['highEfficiency2']},
        {key:'focusingDevice2',label:'집속장치2',max:10,x:28,y:935,parents:['converter2']},
        {key:'outputImprove2',label:'출력강화2',max:10,x:72,y:935,parents:['outputImprove1']},
        {key:'controlDevice2',label:'제어장치2',max:10,x:28,y:835,parents:['focusingDevice2']},
        {key:'outputImprove3',label:'출력강화3',max:10,x:72,y:835,parents:['outputImprove2']},
        {key:'highEfficiency3',label:'고효율3',max:5,x:50,y:735,parents:['controlDevice2','outputImprove3']},
        {key:'converter3',label:'변환기3',max:10,x:28,y:635,parents:['highEfficiency3']},
        {key:'highOutput1',label:'고출력1',max:10,x:72,y:635,parents:['highEfficiency3']},
        {key:'focusingDevice3',label:'집속장치3',max:10,x:28,y:535,parents:['converter3']},
        {key:'highOutput2',label:'고출력2',max:10,x:72,y:535,parents:['highOutput1']},
        {key:'controlDevice3',label:'제어장치3',max:10,x:28,y:435,parents:['focusingDevice3']},
        {key:'highOutput3',label:'고출력3',max:10,x:72,y:435,parents:['highOutput2']},
        {key:'meltingLaser',label:'용융 레이저포',max:1,x:50,y:335,parents:['controlDevice3','highOutput3']}
      ]
    },
    piercing:{
      // 기준선 y=1535(1단계). 단계마다 100px씩 위로 올라가며 최종 폭발레이저는 13단계(y=335).
      details:{
        highEfficiency2:'개발 1회마다 공격속도와 피해량이 각각 0.2% 상승합니다.',
        highEfficiency3:'개발 1회마다 공격속도와 피해량이 각각 0.2% 상승합니다.',
        explosiveLaser:'관통레이저에 피해를 입을 때마다 대상이 폭발하여 주변 적에게 스플래시 데미지 50%를 줍니다.'
      },
      nodes:[
        {key:'highEfficiency1',label:'고효율1',max:5,x:50,y:1535,parents:[]},
        {key:'converter',label:'변환기',max:10,x:28,y:1435,parents:['highEfficiency1']},
        {key:'outputBoost1',label:'출력증강1',max:10,x:72,y:1435,parents:['highEfficiency1']},
        {key:'focusingDevice',label:'집속장치',max:10,x:28,y:1335,parents:['converter']},
        {key:'outputBoost2',label:'출력증강2',max:10,x:72,y:1335,parents:['outputBoost1']},
        {key:'controlDevice',label:'제어장치',max:10,x:28,y:1235,parents:['focusingDevice']},
        {key:'outputBoost3',label:'출력증강3',max:10,x:72,y:1235,parents:['outputBoost2']},
        {key:'highEfficiency2',label:'고효율2',max:5,x:50,y:1135,parents:['controlDevice','outputBoost3']},
        {key:'converter2',label:'변환기2',max:10,x:28,y:1035,parents:['highEfficiency2']},
        {key:'outputImprove1',label:'출력강화1',max:10,x:72,y:1035,parents:['highEfficiency2']},
        {key:'focusingDevice2',label:'집속장치2',max:10,x:28,y:935,parents:['converter2']},
        {key:'outputImprove2',label:'출력강화2',max:10,x:72,y:935,parents:['outputImprove1']},
        {key:'controlDevice2',label:'제어장치2',max:10,x:28,y:835,parents:['focusingDevice2']},
        {key:'outputImprove3',label:'출력강화3',max:10,x:72,y:835,parents:['outputImprove2']},
        {key:'highEfficiency3',label:'고효율3',max:5,x:50,y:735,parents:['controlDevice2','outputImprove3']},
        {key:'converter3',label:'변환기3',max:10,x:28,y:635,parents:['highEfficiency3']},
        {key:'highOutput1',label:'고출력1',max:10,x:72,y:635,parents:['highEfficiency3']},
        {key:'focusingDevice3',label:'집속장치3',max:10,x:28,y:535,parents:['converter3']},
        {key:'highOutput2',label:'고출력2',max:10,x:72,y:535,parents:['highOutput1']},
        {key:'controlDevice3',label:'제어장치3',max:10,x:28,y:435,parents:['focusingDevice3']},
        {key:'highOutput3',label:'고출력3',max:10,x:72,y:435,parents:['highOutput2']},
        {key:'explosiveLaser',label:'폭발레이저',max:1,x:50,y:335,parents:['controlDevice3','highOutput3']}
      ]
    },
    carrier:{
      details:{
        firepower1:'개발 1회마다 함재기 내구도와 피해량이 각각 0.2% 증가합니다.',
        hull1:'개발 1회마다 함재기 내구도가 0.1% 상승합니다.',
        hull2:'개발 1회마다 함재기 내구도가 0.1% 상승합니다.',
        hull3:'개발 1회마다 함재기 내구도가 0.1% 상승합니다.',
        weapon1:'개발 1회마다 함재기 피해량이 0.1% 상승합니다.',
        weapon2:'개발 1회마다 함재기 피해량이 0.1% 상승합니다.',
        weapon3:'개발 1회마다 함재기 피해량이 0.1% 상승합니다.',
        firepower2:'5회 개발을 완료하면 전투에서 운용하는 함재기 1대가 추가됩니다.',
        carrierImprovement2:'개발 1회마다 함재기 내구도와 피해량이 각각 0.2% 증가합니다.',
        hull4:'개발 1회마다 함재기 내구도가 0.1% 상승합니다.',hull5:'개발 1회마다 함재기 내구도가 0.1% 상승합니다.',hull6:'개발 1회마다 함재기 내구도가 0.1% 상승합니다.',
        newWeapon1:'개발 1회마다 함재기 피해량이 0.1% 상승합니다.',newWeapon2:'개발 1회마다 함재기 피해량이 0.1% 상승합니다.',newWeapon3:'개발 1회마다 함재기 피해량이 0.1% 상승합니다.',
        carrierImprovement3:'개발 1회마다 함재기 내구도와 피해량이 각각 0.2% 증가합니다.',
        hull7:'개발 1회마다 함재기 내구도가 0.1% 상승합니다.',hull8:'개발 1회마다 함재기 내구도가 0.1% 상승합니다.',hull9:'개발 1회마다 함재기 내구도가 0.1% 상승합니다.',
        weaponImprove1:'개발 1회마다 함재기 피해량이 0.1% 상승합니다.',weaponImprove2:'개발 1회마다 함재기 피해량이 0.1% 상승합니다.',weaponImprove3:'개발 1회마다 함재기 피해량이 0.1% 상승합니다.',
        doubleTarget:'함재기가 공격할 때 대상 가까이의 적 1기도 함께 공격하여, 그 피해의 50%를 줍니다.'
      },
      nodes:[
        {key:'firepower1',label:'함재기 개량1',max:5,x:50,y:1535,parents:[]},
        {key:'hull1',label:'동체강화',max:10,x:28,y:1435,parents:['firepower1']},
        {key:'weapon1',label:'무기개량1',max:10,x:72,y:1435,parents:['firepower1']},
        {key:'hull2',label:'엔진강화',max:10,x:28,y:1335,parents:['hull1']},
        {key:'weapon2',label:'무기개량2',max:10,x:72,y:1335,parents:['weapon1']},
        {key:'hull3',label:'장갑강화',max:10,x:28,y:1235,parents:['hull2']},
        {key:'weapon3',label:'무기개량3',max:10,x:72,y:1235,parents:['weapon2']},
        {key:'firepower2',label:'함재기 증편',max:5,x:50,y:1135,parents:['hull3','weapon3'],parentLevels:{hull3:1,weapon3:1},parentsMode:'all'},
        {key:'carrierImprovement2',label:'함재기 개량2',max:5,x:50,y:1035,parents:['firepower2'],parentLevels:{firepower2:5}},
        {key:'hull4',label:'동체강화2',max:10,x:28,y:935,parents:['carrierImprovement2']},
        {key:'newWeapon1',label:'신무기 개량1',max:10,x:72,y:935,parents:['carrierImprovement2']},
        {key:'hull5',label:'엔진강화2',max:10,x:28,y:835,parents:['hull4']},
        {key:'newWeapon2',label:'신무기 개량2',max:10,x:72,y:835,parents:['newWeapon1']},
        {key:'hull6',label:'장갑강화2',max:10,x:28,y:735,parents:['hull5']},
        {key:'newWeapon3',label:'신무기 개량3',max:10,x:72,y:735,parents:['newWeapon2']},
        {key:'carrierImprovement3',label:'함재기 개량3',max:5,x:50,y:635,parents:['hull6','newWeapon3'],parentsMode:'all'},
        {key:'hull7',label:'동체강화3',max:10,x:28,y:535,parents:['carrierImprovement3']},
        {key:'weaponImprove1',label:'무기강화1',max:10,x:72,y:535,parents:['carrierImprovement3']},
        {key:'hull8',label:'엔진강화3',max:10,x:28,y:435,parents:['hull7']},
        {key:'weaponImprove2',label:'무기강화2',max:10,x:72,y:435,parents:['weaponImprove1']},
        {key:'hull9',label:'장갑강화3',max:10,x:28,y:335,parents:['hull8']},
        {key:'weaponImprove3',label:'무기강화3',max:10,x:72,y:335,parents:['weaponImprove2']},
        {key:'doubleTarget',label:'더블 타겟',max:1,x:50,y:235,parents:['hull9','weaponImprove3']}
      ]
    },
    frigate:{
      details:{
        firepower1:'프리깃 편성을 개방하는 단계입니다.',
        constructionDrone:'개발 1회마다 건설드론의 수리 회복량이 0.2% 증가합니다.',
        scienceDrone:'개발 1회마다 과학드론의 각 기능 효과가 0.2% 증가합니다.',
        shieldShip:'개발 1회마다 방패선의 보호막 지속시간이 0.2% 증가합니다.',
        littleBoy:'개발 1회마다 리틀보이의 전술핵 피해량이 1% 증가합니다.',
        bombardShip:'개발 1회마다 포작선의 피해량이 1% 증가합니다.',
        lepanto:'개발 1회마다 레판토의 무기 피해량이 0.2% 증가합니다.',
        firepower2:'개발 1회마다 프리깃 재사용시간이 0.2초 감소합니다.',
        constructionDrone2:'개발 1회마다 건설드론의 수리 회복량이 0.2% 증가합니다.',scienceDrone2:'개발 1회마다 과학드론의 각 기능 효과가 0.2% 증가합니다.',shieldShip2:'개발 1회마다 방패선의 보호막 지속시간이 0.2% 증가합니다.',
        littleBoy2:'개발 1회마다 리틀보이의 전술핵 피해량이 1% 증가합니다.',bombardShip2:'개발 1회마다 포작선의 피해량이 1% 증가합니다.',lepanto2:'개발 1회마다 레판토의 무기 피해량이 0.2% 증가합니다.',
        frigateCharging2:'개발 1회마다 프리깃 재사용시간이 0.3초 감소합니다.',
        constructionDrone3:'개발 1회마다 건설드론의 수리 회복량이 0.2% 증가합니다.',scienceDrone3:'개발 1회마다 과학드론의 각 기능 효과가 0.2% 증가합니다.',shieldShip3:'개발 1회마다 방패선의 보호막 지속시간이 0.2% 증가합니다.',
        littleBoy3:'개발 1회마다 리틀보이의 전술핵 피해량이 1% 증가합니다.',bombardShip3:'개발 1회마다 포작선의 피해량이 1% 증가합니다.',lepanto3:'개발 1회마다 레판토의 무기 피해량이 0.2% 증가합니다.',
        frigateExpedition:'개발 1회마다 프리깃 이동 및 효과 발동 시간이 1% 감소합니다.',
        constructionDroneAssist:'5회 개발 완료 시 건설드론 보조기술 "회복"(수리 시 모든 상태이상 해제 + 3초 상태이상 면역)이 개방됩니다.',scienceDroneAssist:'5회 개발 완료 시 과학드론 보조기술 "전술 확장"(2가지 전술 동시 시전, 효과 20% 상승)이 개방됩니다.',shieldShipAssist:'5회 개발 완료 시 방패선 보조기술 "전장사수"(방패선 지속시간 30% 증가)가 개방됩니다.',
        littleBoyAssist:'5회 개발 완료 시 리틀보이 보조기술 "전술핵 강화"(핵폭발 피해 2배)가 개방됩니다.',bombardShipAssist:'5회 개발 완료 시 포작선 보조기술 "추가폭발"(자폭 5회)이 개방됩니다.',lepantoAssist:'5회 개발 완료 시 레판토 보조기술 "Ship of the Line"(포격시간 50% 증가)이 개방됩니다.',
        frigatePersistence:'개발 1회마다 프리깃 효과 지속시간이 1% 증가합니다.',
        constructionDrone4:'개발 1회마다 건설드론의 수리 회복량이 0.2% 증가합니다.',scienceDrone4:'개발 1회마다 과학드론의 각 기능 효과가 0.2% 증가합니다.',shieldShip4:'개발 1회마다 방패선의 보호막 지속시간이 0.2% 증가합니다.',
        littleBoy4:'개발 1회마다 리틀보이의 전술핵 피해량이 1% 증가합니다.',bombardShip4:'개발 1회마다 포작선의 피해량이 1% 증가합니다.',lepanto4:'개발 1회마다 레판토의 무기 피해량이 0.2% 증가합니다.',
        frigatePersistence2:'개발 1회마다 프리깃 효과 지속시간이 1% 증가합니다.',
        constructionDrone5:'개발 1회마다 건설드론의 수리 회복량이 0.2% 증가합니다.',scienceDrone5:'개발 1회마다 과학드론의 각 기능 효과가 0.2% 증가합니다.',shieldShip5:'개발 1회마다 방패선의 보호막 지속시간이 0.2% 증가합니다.',
        littleBoy5:'개발 1회마다 리틀보이의 전술핵 피해량이 1% 증가합니다.',bombardShip5:'개발 1회마다 포작선의 피해량이 1% 증가합니다.',lepanto5:'개발 1회마다 레판토의 무기 피해량이 0.2% 증가합니다.',
        frigateCharging3:'개발 1회마다 프리깃 재사용시간이 0.4초 감소합니다.',
        constructionDroneFinal:'5회 개발 완료 시 건설드론 최종기술 "수리기능 향상"(수리 회복량 2배)이 개방됩니다.',scienceDroneFinal:'5회 개발 완료 시 과학드론 최종기술 "최적화"(모든 전술 동시 시전, 효과 20% 추가 상승)가 개방됩니다.',shieldShipFinal:'5회 개발 완료 시 방패선 최종기술 "가시방패"(방패선을 공격한 적에게 받은 피해 반사)가 개방됩니다.',
        littleBoyFinal:'5회 개발 완료 시 리틀보이 최종기술 "Fat Man"(출격 2회 충전, 모두 사용하면 재사용 대기)이 개방됩니다.',bombardShipFinal:'5회 개발 완료 시 포작선 최종기술 "죽음의 무도"(폭발하는 동안 모든 적을 포작선 쪽으로 끌어당김)가 개방됩니다.',lepantoFinal:'5회 개발 완료 시 레판토 최종기술 "Victory"(공격속도·공격력 30% 증가)가 개방됩니다.'
      },
      nodes:[
        {key:'firepower1',label:'프리깃 사용 개방',max:1,x:50,y:2735,parents:[]},
        {key:'constructionDrone',label:'건설드론',max:5,x:28,y:2635,parents:['firepower1']},{key:'littleBoy',label:'리틀보이',max:5,x:72,y:2635,parents:['firepower1']},
        {key:'scienceDrone',label:'과학드론',max:5,x:28,y:2535,parents:['constructionDrone'],parentLevels:{constructionDrone:1}},{key:'bombardShip',label:'포작선',max:5,x:72,y:2535,parents:['littleBoy'],parentLevels:{littleBoy:1101}},
        {key:'shieldShip',label:'방패선',max:5,x:28,y:2435,parents:['scienceDrone'],parentLevels:{scienceDrone:1}},{key:'lepanto',label:'레판토',max:5,x:72,y:2435,parents:['bombardShip'],parentLevels:{bombardShip:1}},
        {key:'firepower2',label:'Frigate Charging',max:10,x:50,y:2335,parents:['shieldShip','lepanto'],parentLevels:{shieldShip:1,lepanto:1},parentsMode:'all'},
        {key:'constructionDrone2',label:'건설드론 II',max:5,x:28,y:2235,parents:['firepower2'],parentLevels:{firepower2:1}},{key:'littleBoy2',label:'리틀보이 II',max:5,x:72,y:2235,parents:['firepower2'],parentLevels:{firepower2:1}},
        {key:'scienceDrone2',label:'과학드론 II',max:5,x:28,y:2135,parents:['constructionDrone2'],parentLevels:{constructionDrone2:1}},{key:'bombardShip2',label:'포작선 II',max:5,x:72,y:2135,parents:['littleBoy2'],parentLevels:{littleBoy2:1}},
        {key:'shieldShip2',label:'방패선 II',max:5,x:28,y:2035,parents:['scienceDrone2'],parentLevels:{scienceDrone2:1}},{key:'lepanto2',label:'레판토 II',max:5,x:72,y:2035,parents:['bombardShip2'],parentLevels:{bombardShip2:1}},
        {key:'frigateCharging2',label:'Frigate Charging II',max:10,x:50,y:1935,parents:['shieldShip2','lepanto2'],parentLevels:{shieldShip2:1,lepanto2:1},parentsMode:'all'},
        {key:'constructionDrone3',label:'건설드론 III',max:5,x:28,y:1835,parents:['frigateCharging2'],parentLevels:{frigateCharging2:1}},{key:'littleBoy3',label:'리틀보이 III',max:5,x:72,y:1835,parents:['frigateCharging2'],parentLevels:{frigateCharging2:1}},
        {key:'scienceDrone3',label:'과학드론 III',max:5,x:28,y:1735,parents:['constructionDrone3'],parentLevels:{constructionDrone3:1}},{key:'bombardShip3',label:'포작선 III',max:5,x:72,y:1735,parents:['littleBoy3'],parentLevels:{littleBoy3:1}},
        {key:'shieldShip3',label:'방패선 III',max:5,x:28,y:1635,parents:['scienceDrone3'],parentLevels:{scienceDrone3:1}},{key:'lepanto3',label:'레판토 III',max:5,x:72,y:1635,parents:['bombardShip3'],parentLevels:{bombardShip3:1}},
        {key:'frigateExpedition',label:'Frigate Expedition',max:10,x:50,y:1535,parents:['shieldShip3','lepanto3'],parentLevels:{shieldShip3:1,lepanto3:1},parentsMode:'all'},
        {key:'constructionDroneAssist',label:'건설드론 보조',max:5,x:28,y:1435,parents:['frigateExpedition'],parentLevels:{frigateExpedition:1}},{key:'littleBoyAssist',label:'리틀보이 보조',max:5,x:72,y:1435,parents:['frigateExpedition'],parentLevels:{frigateExpedition:1}},
        {key:'scienceDroneAssist',label:'과학드론 보조',max:5,x:28,y:1335,parents:['constructionDroneAssist'],parentLevels:{constructionDroneAssist:5}},{key:'bombardShipAssist',label:'포작선 보조',max:5,x:72,y:1335,parents:['littleBoyAssist'],parentLevels:{littleBoyAssist:5}},
        {key:'shieldShipAssist',label:'방패선 보조',max:5,x:28,y:1235,parents:['scienceDroneAssist'],parentLevels:{scienceDroneAssist:5}},{key:'lepantoAssist',label:'레판토 보조',max:5,x:72,y:1235,parents:['bombardShipAssist'],parentLevels:{bombardShipAssist:5}},
        {key:'frigatePersistence',label:'Frigate Persistence',max:10,x:50,y:1135,parents:['shieldShipAssist','lepantoAssist'],parentLevels:{shieldShipAssist:5,lepantoAssist:5},parentsMode:'all'},
        // 18~25단계: IV·V 단계(개발 내용은 같은 이름의 앞 단계와 동일) · Frigate Persistence II · Frigate Charging III
        {key:'constructionDrone4',label:'건설드론 IV',max:5,x:28,y:1035,parents:['frigatePersistence'],parentLevels:{frigatePersistence:1}},{key:'littleBoy4',label:'리틀보이 IV',max:5,x:72,y:1035,parents:['frigatePersistence'],parentLevels:{frigatePersistence:1}},
        {key:'scienceDrone4',label:'과학드론 IV',max:5,x:28,y:935,parents:['constructionDrone4'],parentLevels:{constructionDrone4:1}},{key:'bombardShip4',label:'포작선 IV',max:5,x:72,y:935,parents:['littleBoy4'],parentLevels:{littleBoy4:1}},
        {key:'shieldShip4',label:'방패선 IV',max:5,x:28,y:835,parents:['scienceDrone4'],parentLevels:{scienceDrone4:1}},{key:'lepanto4',label:'레판토 IV',max:5,x:72,y:835,parents:['bombardShip4'],parentLevels:{bombardShip4:1}},
        {key:'frigatePersistence2',label:'Frigate Persistence II',max:10,x:50,y:735,parents:['shieldShip4','lepanto4'],parentLevels:{shieldShip4:1,lepanto4:1},parentsMode:'all'},
        {key:'constructionDrone5',label:'건설드론 V',max:5,x:28,y:635,parents:['frigatePersistence2'],parentLevels:{frigatePersistence2:1}},{key:'littleBoy5',label:'리틀보이 V',max:5,x:72,y:635,parents:['frigatePersistence2'],parentLevels:{frigatePersistence2:1}},
        {key:'scienceDrone5',label:'과학드론 V',max:5,x:28,y:535,parents:['constructionDrone5'],parentLevels:{constructionDrone5:1}},{key:'bombardShip5',label:'포작선 V',max:5,x:72,y:535,parents:['littleBoy5'],parentLevels:{littleBoy5:1}},
        {key:'shieldShip5',label:'방패선 V',max:5,x:28,y:435,parents:['scienceDrone5'],parentLevels:{scienceDrone5:1}},{key:'lepanto5',label:'레판토 V',max:5,x:72,y:435,parents:['bombardShip5'],parentLevels:{bombardShip5:1}},
        {key:'frigateCharging3',label:'Frigate Charging III',max:10,x:50,y:335,parents:['shieldShip5','lepanto5'],parentLevels:{shieldShip5:1,lepanto5:1},parentsMode:'all'},
        // 26~28단계: 최종 연구(각 5/5 완료 시 해당 프리깃 최종기술 개방). 보조 단계와 같이 앞 노드 5회 완료 후 다음 노드 개방.
        {key:'constructionDroneFinal',label:'건설드론 최종',max:5,x:28,y:235,parents:['frigateCharging3'],parentLevels:{frigateCharging3:1}},{key:'littleBoyFinal',label:'리틀보이 최종',max:5,x:72,y:235,parents:['frigateCharging3'],parentLevels:{frigateCharging3:1}},
        {key:'scienceDroneFinal',label:'과학드론 최종',max:5,x:28,y:135,parents:['constructionDroneFinal'],parentLevels:{constructionDroneFinal:5}},{key:'bombardShipFinal',label:'포작선 최종',max:5,x:72,y:135,parents:['littleBoyFinal'],parentLevels:{littleBoyFinal:5}},
        {key:'shieldShipFinal',label:'방패선 최종',max:5,x:28,y:35,parents:['scienceDroneFinal'],parentLevels:{scienceDroneFinal:5}},{key:'lepantoFinal',label:'레판토 최종',max:5,x:72,y:35,parents:['bombardShipFinal'],parentLevels:{bombardShipFinal:5}}
      ]
    },
    defense:{
      details:{
        durability1:'개발 1회마다 방어막 총량이 0.1% 증가합니다.',durability2:'개발 1회마다 방어막 총량이 0.1% 증가합니다.',durability3:'개발 1회마다 방어막 총량이 0.1% 증가합니다.',durability4:'개발 1회마다 방어막 총량이 0.1% 증가합니다.',durability5:'개발 1회마다 방어막 총량이 0.1% 증가합니다.',
        duration1:'개발 1회마다 방어막 지속시간이 0.1% 증가합니다.',duration2:'개발 1회마다 방어막 지속시간이 0.1% 증가합니다.',duration3:'개발 1회마다 방어막 지속시간이 0.1% 증가합니다.',duration4:'개발 1회마다 방어막 지속시간이 0.1% 증가합니다.',duration5:'개발 1회마다 방어막 지속시간이 0.1% 증가합니다.',
        reduction1:'개발 1회마다 방어막 피해 감소가 0.1% 증가합니다.',reduction2:'개발 1회마다 방어막 피해 감소가 0.1% 증가합니다.',reduction3:'개발 1회마다 방어막 피해 감소가 0.1% 증가합니다.',reduction4:'개발 1회마다 방어막 피해 감소가 0.1% 증가합니다.',reduction5:'개발 1회마다 방어막 피해 감소가 0.1% 증가합니다.',
        materialDevelopment:'개발 1회마다 방어막 총량과 피해 감소가 각각 0.1% 상승합니다. 매 개발마다 연구코어 1개가 추가로 소모됩니다.',
        ...Object.fromEntries(Array.from({length:5},(_,i)=>[`materialDurability${i+1}`,`개발 1회마다 방어막 총량이 0.1% 증가합니다.`])),
        ...Object.fromEntries(Array.from({length:5},(_,i)=>[`materialDuration${i+1}`,`개발 1회마다 방어막 지속시간이 0.1% 증가합니다.`])),
        ...Object.fromEntries(Array.from({length:5},(_,i)=>[`materialReinforcement${i+1}`,`개발 1회마다 방어막 피해 감소가 0.1% 증가합니다.`]))
      },
      nodes:[
        {key:'durability1',label:'내구성1',max:10,x:19,y:1035,parents:[]},
        {key:'duration1',label:'지속시간1',max:10,x:50,y:1035,parents:[]},
        {key:'reduction1',label:'피해감소1',max:10,x:81,y:1035,parents:[]},
        {key:'durability2',label:'내구성2',max:10,x:19,y:935,parents:['durability1']},
        {key:'duration2',label:'지속시간2',max:10,x:50,y:935,parents:['duration1']},
        {key:'reduction2',label:'피해감소2',max:10,x:81,y:935,parents:['reduction1']},
        {key:'durability3',label:'내구성3',max:10,x:19,y:835,parents:['durability2']},
        {key:'duration3',label:'지속시간3',max:10,x:50,y:835,parents:['duration2']},
        {key:'reduction3',label:'피해감소3',max:10,x:81,y:835,parents:['reduction2']},
        {key:'durability4',label:'내구성4',max:10,x:19,y:735,parents:['durability3']},
        {key:'duration4',label:'지속시간4',max:10,x:50,y:735,parents:['duration3']},
        {key:'reduction4',label:'피해감소4',max:10,x:81,y:735,parents:['reduction3']},
        {key:'durability5',label:'내구성5',max:10,x:19,y:635,parents:['durability4']},
        {key:'duration5',label:'지속시간5',max:10,x:50,y:635,parents:['duration4']},
        {key:'reduction5',label:'피해감소5',max:10,x:81,y:635,parents:['reduction4']},
        {key:'materialDevelopment',label:'신소재 개발',max:10,x:50,y:535,parents:['durability5','duration5','reduction5'],parentLevels:{durability5:1,duration5:1,reduction5:1},parentsMode:'all'},
        {key:'materialDurability1',label:'신소재 내구성1',max:10,x:19,y:435,parents:['materialDevelopment']},
        {key:'materialDuration1',label:'신소재 지속1',max:10,x:50,y:435,parents:['materialDevelopment']},
        {key:'materialReinforcement1',label:'신소재 강화1',max:10,x:81,y:435,parents:['materialDevelopment']},
        {key:'materialDurability2',label:'신소재 내구성2',max:10,x:19,y:335,parents:['materialDurability1']},
        {key:'materialDuration2',label:'신소재 지속2',max:10,x:50,y:335,parents:['materialDuration1']},
        {key:'materialReinforcement2',label:'신소재 강화2',max:10,x:81,y:335,parents:['materialReinforcement1']},
        {key:'materialDurability3',label:'신소재 내구성3',max:10,x:19,y:235,parents:['materialDurability2']},
        {key:'materialDuration3',label:'신소재 지속3',max:10,x:50,y:235,parents:['materialDuration2']},
        {key:'materialReinforcement3',label:'신소재 강화3',max:10,x:81,y:235,parents:['materialReinforcement2']},
        {key:'materialDurability4',label:'신소재 내구성4',max:10,x:19,y:135,parents:['materialDurability3']},
        {key:'materialDuration4',label:'신소재 지속4',max:10,x:50,y:135,parents:['materialDuration3']},
        {key:'materialReinforcement4',label:'신소재 강화4',max:10,x:81,y:135,parents:['materialReinforcement3']},
        {key:'materialDurability5',label:'신소재 내구성5',max:10,x:19,y:35,parents:['materialDurability4']},
        {key:'materialDuration5',label:'신소재 지속5',max:10,x:50,y:35,parents:['materialDuration4']},
        {key:'materialReinforcement5',label:'신소재 강화5',max:10,x:81,y:35,parents:['materialReinforcement4']}
      ]
    }
  };
  const developmentSpend=id=>{
    const nodes=id==='cannon'?cannonTreeNodes:branchedWeaponTrees[id]?.nodes||[];
    const saved=id==='cannon'?tacticalWeaponState.cannonTree||{}:tacticalWeaponState[`${id}Tree`]||{};
    const levels=Object.fromEntries(nodes.map(node=>[node.key,Math.max(0,Math.min(node.max,Math.floor(Number(saved[node.key])||0)))]));
    if(id!=='cannon'&&!Object.values(levels).some(value=>value>0)&&Math.max(0,Number(tacticalWeaponState[id]?.level)||0)>0){const root=nodes[0];if(root)levels[root.key]=Math.min(root.max,Math.floor(Number(tacticalWeaponState[id].level)||0));}
    let journal=0,core=0;
    nodes.forEach(node=>{
      const level=levels[node.key]||0;
      for(let spentLevel=0;spentLevel<level;spentLevel+=1){
        if(id==='cannon'){
          const amount=cannonDevelopmentCost(node,spentLevel);journal+=amount.journal;core+=amount.core;
        }else{
          const baseY=id==='defense'?1035:id==='carrier'?1535:id==='frigate'?2735:(id==='missile'||id==='laser'||id==='piercing'||id==='electric')?1535:535,maxStage=id==='defense'?11:id==='carrier'?14:id==='frigate'?28:(id==='missile'||id==='laser'||id==='piercing'||id==='electric')?13:5;
          const stage=Math.max(1,Math.min(maxStage,Math.round((baseY-node.y)/100)+1));
          if(['piercingShell','meltingLaser','explosiveLaser','doubleTarget','thunderCascade'].includes(node.key)){journal+=130;core+=10;continue;}
          if(id==='frigate'){const amount=frigateDevelopmentCost(node,spentLevel,stage);journal+=amount.journal;core+=amount.core;continue;}
          journal+=stage+spentLevel;
          if(id==='defense'&&node.key==='materialDevelopment'||id!=='defense'&&(stage===5||node.key==='highEfficiency3'))core+=1;
        }
      }
    });
    if(id==='defense'){
      const legacy=saved;
      ['durability6','duration6','reduction6'].forEach(key=>{
        const level=Math.max(0,Math.min(10,Math.floor(Number(legacy[key])||0)));
        for(let spentLevel=0;spentLevel<level;spentLevel+=1){journal+=6+spentLevel;if(spentLevel===0)core+=1;}
      });
    }
    return {journal,core};
  };
  const cumulativeResearchText=(id,nodes,levels,selected)=>{
    const level=key=>Math.max(0,Number(levels[key])||0),sum=keys=>keys.reduce((total,key)=>total+level(key),0),percent=value=>`${(value*100).toFixed(1).replace(/\.0$/,'')}%`;
    if(id==='cannon'){
      const bonus=cannonBonusesFromLevels(levels);
      return `현재 누적 효과 · 공격속도 +${bonus.attackSpeed.toFixed(1)}% / 피해량 +${bonus.damage.toFixed(1)}%${bonus.explosiveShell?' / 폭렬탄 적용(스플래시 50%)':''}`;
    }
    if(['missile','electric','laser','piercing'].includes(id)){
      const roots=sum(id==='laser'||id==='piercing'?['highEfficiency1','highEfficiency2','highEfficiency3']:id==='missile'||id==='electric'?['firepower1','firepower2','firepower3']:['firepower1','firepower2'])*.002;
      const left=id==='missile'?['turret','vls','universalLauncher','turret2','vls2','universalLauncher2','turret3','vls3','universalLauncher3']:id==='electric'?['powerSupply1','powerSupply2','powerSupply3','wireExpansion1','wireExpansion2','wireExpansion3','wireImprove1','wireImprove2','wireImprove3']:['converter','focusingDevice','controlDevice','converter2','focusingDevice2','controlDevice2','converter3','focusingDevice3','controlDevice3'];
      const right=id==='missile'?['warhead1','warhead2','warhead3','warheadImprove1','warheadImprove2','warheadImprove3','newWarhead1','newWarhead2','newWarhead3']:id==='electric'?['coil1','coil2','coil3','coilImprove1','coilImprove2','coilImprove3','newCoil1','newCoil2','newCoil3']:['outputBoost1','outputBoost2','outputBoost3','outputImprove1','outputImprove2','outputImprove3','highOutput1','highOutput2','highOutput3'];
      return `현재 누적 효과 · 공격속도 +${percent(roots+sum(left)*.001)} / 피해량 +${percent(roots+sum(right)*.001)}`;
    }
    if(id==='carrier'){
      const hull=level('firepower1')*.002+(level('carrierImprovement2')+level('carrierImprovement3'))*.002+sum(['hull1','hull2','hull3','hull4','hull5','hull6','hull7','hull8','hull9'])*.001;
      const damage=level('firepower1')*.002+(level('carrierImprovement2')+level('carrierImprovement3'))*.002+sum(['weapon1','weapon2','weapon3','newWeapon1','newWeapon2','newWeapon3','weaponImprove1','weaponImprove2','weaponImprove3'])*.001;
      if(selected.key==='firepower2')return `함재기 증편 · ${level('firepower2')}/5${level('firepower2')>=5?' · 운용 함재기 +1대':''}`;
      return `현재 누적 효과 · 함재기 내구도 +${percent(hull)} / 피해량 +${percent(damage)}`;
    }
    if(id==='defense'){
      const legacy=Object.keys(levels);
      const shield=sum([...legacy.filter(key=>key.startsWith('durability')), ...legacy.filter(key=>key.startsWith('materialDurability')),'materialDevelopment'])*.001;
      const duration=sum(legacy.filter(key=>key.startsWith('duration')))+sum(legacy.filter(key=>key.startsWith('materialDuration')));
      const reduction=sum(legacy.filter(key=>key.startsWith('reduction')))+sum(legacy.filter(key=>key.startsWith('materialReinforcement')))+level('materialDevelopment');
      const group=selected.key==='materialDevelopment'||selected.key.startsWith('materialReinforcement')||selected.key.startsWith('reduction')?'reduction':selected.key.startsWith('materialDuration')||selected.key.startsWith('duration')?'duration':'durability';
      const names={durability:'방어막 총량',duration:'방어막 지속시간',reduction:'피해 감소'};
      return `현재 누적 효과 · ${names[group]} +${percent(group==='durability'?shield:group==='duration'?duration*.001:reduction*.001)}`;
    }
    if(id==='frigate'){
      const groups=[
        {keys:['constructionDrone','constructionDrone2','constructionDrone3','constructionDrone4','constructionDrone5'],label:'건설드론 회복량',rate:.002},
        {keys:['scienceDrone','scienceDrone2','scienceDrone3','scienceDrone4','scienceDrone5'],label:'과학드론 효과',rate:.002},
        {keys:['shieldShip','shieldShip2','shieldShip3','shieldShip4','shieldShip5'],label:'방패선 보호막 지속시간',rate:.002},
        {keys:['littleBoy','littleBoy2','littleBoy3','littleBoy4','littleBoy5'],label:'리틀보이 피해량',rate:.01},
        {keys:['bombardShip','bombardShip2','bombardShip3','bombardShip4','bombardShip5'],label:'포작선 피해량',rate:.01},
        {keys:['lepanto','lepanto2','lepanto3','lepanto4','lepanto5'],label:'레판토 피해량',rate:.002}
      ];
      const group=groups.find(entry=>entry.keys.includes(selected.key));
      if(group)return `현재 누적 효과 · ${group.label} +${percent(sum(group.keys)*group.rate)}`;
      if(['firepower2','frigateCharging2','frigateCharging3'].includes(selected.key))return `현재 누적 효과 · 프리깃 재사용시간 ${(sum(['firepower2'])*.2+sum(['frigateCharging2'])*.3+sum(['frigateCharging3'])*.4).toFixed(1)}초 감소`;
      if(selected.key==='frigateExpedition')return `현재 누적 효과 · 프리깃 이동·효과 발동시간 ${percent(sum(['frigateExpedition'])*.01)} 감소`;
      if(selected.key==='frigatePersistence'||selected.key==='frigatePersistence2')return `현재 누적 효과 · 프리깃 효과 지속시간 +${percent(sum(['frigatePersistence','frigatePersistence2'])*.01)}`;
      if(selected.key.endsWith('Assist'))return `보조기술 개발 · ${level(selected.key)}/5${level(selected.key)>=5?' · 보조기술 개방':''}`;
      if(selected.key.endsWith('Final'))return `최종기술 개발 · ${level(selected.key)}/5${level(selected.key)>=5?' · 최종기술 개방':''}`;
      return '현재 누적 효과 · 프리깃 편성 개방';
    }
    return '';
  };
  window.getCommanderResearchSummary=()=>tacticalFields.flatMap(([id,name,icon])=>{
    const nodes=id==='cannon'?cannonTreeNodes:(branchedWeaponTrees[id]?.nodes||[]);
    const levels=tacticalWeaponState[`${id}Tree`]||{};
    const badge=tacticalBadge(id,icon,'commander-profile');
    const developed=nodes.filter(node=>Number(levels[node.key])>0).map(node=>({id,name,icon,badge,stage:Math.round(((id==='defense'?1035:id==='carrier'?1535:id==='frigate'?2735:(id==='missile'||id==='laser'||id==='piercing'||id==='electric')?1535:535)-node.y)/100)+1,node:node.label}));
    if(!developed.length&&Number(tacticalWeaponState[id]?.level)>0)developed.push({id,name,icon,badge,stage:1,node:name});
    return developed;
  }).sort((a,b)=>b.stage-a.stage);
  const openBranchedWeaponTree=(id,name,icon)=>{
    const config=branchedWeaponTrees[id];if(!config)return;
    const nodes=config.nodes,treeKey=`${id}Tree`,modal=document.createElement('div');
    modal.className=`tactical-tech-overlay cannon-tech-overlay${id==='defense'?' three-branch-tech-overlay':''}`;modal.setAttribute('role','presentation');
    let selectedNode=nodes[0]?.key||'firepower1';
    const state=()=>{
      const saved=tacticalWeaponState[treeKey]||{};
      const result=Object.fromEntries(nodes.map(node=>[node.key,Math.max(0,Math.min(node.max,Math.floor(Number(saved[node.key])||0)))]));
      if(id==='defense')['durability6','duration6','reduction6'].forEach(key=>{result[key]=Math.max(0,Math.min(10,Math.floor(Number(saved[key])||0)));});
      if(!Object.values(saved).some(value=>Number(value)>0)&&Math.max(0,Number(tacticalWeaponState[id]?.level)||0)>0)result.firepower1=Math.min(5,Math.floor(Number(tacticalWeaponState[id].level)||0));
      return result;
    };
    const parentIsReady=(node,parent,levels)=>{const parentNode=nodes.find(entry=>entry.key===parent),required=id==='frigate'?(node.parentLevels?.[parent]??1):parentNode?.max;return !!parentNode&&levels[parent]>=required;};
    const isUnlocked=(node,levels)=>node.parents.length===0||(node.parentsMode==='any'?node.parents.some(parent=>parentIsReady(node,parent,levels)):node.parents.every(parent=>parentIsReady(node,parent,levels)));
    const render=()=>{
      const dialogScroll=modal.querySelector('.tactical-tech-dialog')?.scrollTop;
      const previousScroll=modal.querySelector('.cannon-tech-tree')?.scrollTop,levels=state(),connectors=[],treeHeight=id==='defense'?1070:id==='carrier'?1570:id==='frigate'?2770:(id==='missile'||id==='laser'||id==='piercing'||id==='electric')?1570:570,treeBaseY=id==='defense'?1035:id==='carrier'?1535:id==='frigate'?2735:(id==='missile'||id==='laser'||id==='piercing'||id==='electric')?1535:535;
      nodes.forEach(node=>node.parents.forEach(parent=>{const source=nodes.find(entry=>entry.key===parent);if(source)connectors.push(`<path class="${parentIsReady(node,parent,levels)?'active-connector':'pending-connector'}" d="M ${source.x} ${source.y-26} L ${node.x} ${node.y+26}"/>`);}));
      const futureUnlocked=id==='frigate'&&levels.firepower2>=1;
      if(config.future==='single')connectors.push(`<path d="M 50 109 L 50 47" class="future-connector${futureUnlocked?' active-connector':''}"/>`);else if(config.future)['28','72'].forEach(x=>connectors.push(`<path d="M 50 109 L ${x} 47" class="future-connector${futureUnlocked?' active-connector':''}"/>`));
      const nodeMarkup=nodes.map(node=>{const level=levels[node.key],unlocked=isUnlocked(node,levels),status=level>=node.max?'complete':unlocked?'available':'locked';return `<button type="button" class="cannon-tech-node ${status}${selectedNode===node.key?' selected':''}" data-branch-node="${node.key}" style="--node-x:${node.x}%;--node-y:${node.y}px" aria-pressed="${selectedNode===node.key}"><small>${status==='complete'?'개발 완료':status==='available'?'개발 가능':'선행 개발 필요'}</small><b>${node.label}</b><span>${level}/${node.max}</span></button>`;}).join('');
      const selected=nodes.find(node=>node.key===selectedNode),selectedLevel=selected?levels[selected.key]:0,totalCores=dedicatedCoreCount(id)+researchCore,developmentStage=selected?Math.max(1,Math.min(id==='defense'?11:id==='carrier'?14:id==='frigate'?28:(id==='missile'||id==='laser'||id==='piercing'||id==='electric')?13:5,Math.round((treeBaseY-selected.y)/100)+1)):1,developmentCost=id==='frigate'?frigateDevelopmentCost(selected,selectedLevel,developmentStage):['piercingShell','meltingLaser','explosiveLaser','doubleTarget','thunderCascade'].includes(selected?.key)?{journal:130,core:10}:{journal:developmentStage+selectedLevel,core:id==='defense'?(selected?.key==='materialDevelopment'?1:0):(developmentStage===5||selected?.key==='highEfficiency3'?1:0)},canDevelop=!!selected&&isUnlocked(selected,levels)&&selectedLevel<selected.max&&researchJournal>=developmentCost.journal&&totalCores>=developmentCost.core,complete=selectedLevel>=selected.max,unlocked=selected?isUnlocked(selected,levels):false;
      const actionLabel=complete?'개발 완료':!unlocked?(id==='frigate'?'선행 기술 개발 후 개방':'선행 기술 개발 완료 후 개방'):!canDevelop?'연구 재료 부족':`${selected.label} 개발`;
      const futureMarkup=config.future==='single'?`<div class="cannon-tech-future${futureUnlocked?' unlocked':''}" style="--node-x:50%;--node-y:35px"><small>${futureUnlocked?'OPEN':'NEXT'}</small><b>후속 연구${futureUnlocked?' 개방':''}</b></div>`:config.future?['28','72'].map(x=>`<div class="cannon-tech-future${futureUnlocked?' unlocked':''}" style="--node-x:${x}%;--node-y:35px"><small>${futureUnlocked?'OPEN':'NEXT'}</small><b>후속 연구${futureUnlocked?' 개방':''}</b></div>`).join(''):'';
      const isFirstStage=selected===nodes[0],isFinalStage=selected===nodes[nodes.length-1];
      const detail=config.details?.[selected.key]||(isFirstStage?'개발 1회마다 공격속도와 피해량이 각각 0.2% 상승합니다.':isFinalStage?'개발 1회마다 공격속도와 피해량이 각각 0.2% 상승합니다.':selected.x===28?'개발 1회마다 공격속도가 0.1% 상승합니다.':'개발 1회마다 피해량이 0.1% 상승합니다.');
      const cumulative=cumulativeResearchText(id,nodes,levels,selected);
      const developmentCostMarkup=complete?'<em class="cannon-tech-action-cost spent">최대 개발</em>':`<em class="cannon-tech-action-cost"><span><img src="icons/research-journal.png" alt=""/>연구일지 ${developmentCost.journal}</span>${developmentCost.core?`<span><img src="icons/research-core.png" alt=""/>전용/범용 코어 ${developmentCost.core}</span>`:''}</em>`;
      const resourceMarkup=`${id==='defense'?'':`<span class="journal-inventory-line"><img src="icons/research-journal.png" alt="연구일지"/><strong>연구일지</strong><b>${researchJournal.toLocaleString('ko-KR')}</b></span>`}${coreInventoryMarkup(id)}${developmentResetButton(id)}`;
      modal.innerHTML=`<section class="tactical-tech-dialog cannon-tech-dialog" role="dialog" aria-modal="true" aria-label="${name} 개발 테크트리"><header><div><small>TACTICAL ARMAMENTS · DEVELOPMENT</small><h2><i>${tacticalBadge(id,icon,`${id}-tree`)}</i>${name} 개발</h2></div><button type="button" class="tactical-tech-close" aria-label="닫기">×</button></header><div class="cannon-tech-resources" aria-label="보유 연구 자원">${resourceMarkup}</div><div class="cannon-tech-tree" aria-label="${name} 개발 계통도" style="--tech-tree-height:${treeHeight}px"><svg viewBox="0 0 100 ${treeHeight}" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="cannon-tree-arrow" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto"><path d="M0 5 L2.5 0 L5 5"/></marker></defs>${connectors.join('')}</svg>${nodeMarkup}${futureMarkup}</div><div class="cannon-tech-detail" aria-live="polite"><small>${complete?'DEVELOPMENT COMPLETE':unlocked?'DEVELOPMENT BRIEF':'RESEARCH LOCKED'}</small><div><strong>${selected.label}</strong><span>${selectedLevel}/${selected.max}</span></div><p>${detail}</p><b class="tech-cumulative">${cumulative}</b></div><button type="button" class="cannon-tech-action" ${canDevelop?'':'disabled'}><span>${actionLabel}</span>${developmentCostMarkup}</button></section>`;
      const dialog=modal.querySelector('.tactical-tech-dialog');if(dialog&&dialogScroll!==undefined)dialog.scrollTop=dialogScroll;
      const tree=modal.querySelector('.cannon-tech-tree');tree.scrollTop=previousScroll===undefined?tree.scrollHeight-tree.clientHeight:previousScroll;
      modal.querySelector('.tactical-tech-close').onclick=()=>modal.remove();modal.onclick=event=>{if(event.target===modal)modal.remove();};modal.querySelector('[data-tech-reset]')?.addEventListener('click',()=>resetDevelopment(id,modal,render));
      modal.querySelectorAll('[data-branch-node]').forEach(button=>button.onclick=()=>{selectedNode=button.dataset.branchNode;render();});
      modal.querySelector('.cannon-tech-action').onclick=()=>{if(!canDevelop)return;if(developmentCost.core&&!consumeCores(id,developmentCost.core))return;const next={...levels,[selected.key]:selectedLevel+1};tacticalWeaponState[treeKey]=next;if(id==='frigate')tacticalWeaponState.frigate={...(tacticalWeaponState.frigate||{}),level:Math.max(Number(tacticalWeaponState.frigate?.level)||0,Number(next.firepower1)||0)};researchJournal-=developmentCost.journal;saveResearchCurrency();saveTacticalState();renderTacticalWeaponResearch();window.addMissionProgress?.('daily','research',1);window.addMissionProgress?.('weekly','research-50',1);if(id==='frigate')window.dispatchEvent(new CustomEvent('tactical-research-updated',{detail:{field:id,level:tacticalWeaponState.frigate.level}}));notice(`${name} · ${selected.label} ${next[selected.key]}/${selected.max} 개발`);render();};
    };
    document.body.append(modal);render();
  };
  const openTechTree = id => {
    const field=tacticalFields.find(([fieldId])=>fieldId===id);if(!field)return;
    const [,name,icon]=field;if(id==='cannon'){openCannonTechTree(name,icon);return;}const progress=tacticalProgress(id),modal=document.createElement('div');
    if(branchedWeaponTrees[id]){openBranchedWeaponTree(id,name,icon);return;}
    let selectedStage=null;
    modal.className='tactical-tech-overlay';modal.setAttribute('role','presentation');
    const stageName=stage=>stage===0?firstTechName(id):`${stage+1}단계 개발`;
    const stageMarkup=Array.from({length:progress.level+2},(_,index)=>progress.level+1-index).map(stage=>{
      const status=stage<progress.level?'complete':stage===progress.level?'available':'locked';
      const node=`<button type="button" class="tactical-tech-node ${status}" data-tech-stage="${stage}" ${status==='available'?'':'disabled'}><small>${status==='complete'?'개발 완료':status==='available'?'개발 가능':'다음 단계'}</small><b>${stageName(stage)}</b>${status==='available'?'<span>선택</span>':''}</button>`;
      return `${stage<progress.level+1?'<div class="tactical-tech-arrow" aria-hidden="true">↑</div>':''}${node}`;
    }).join('');
    modal.innerHTML=`<section class="tactical-tech-dialog" role="dialog" aria-modal="true" aria-label="${name} 테크트리"><header><div><small>TACTICAL DEVELOPMENT TREE</small><h2><i>${tacticalBadge(id,icon,'tree')}</i>${name}</h2></div><button type="button" class="tactical-tech-close" aria-label="닫기">×</button></header><div class="tactical-tech-status"><span>연구 재료 <b>${progress.materials}</b></span><span>연구일지 <b>${researchJournal}</b></span><span>범용연구코어 <b>${researchCore}</b></span></div><div class="tactical-tech-tree">${stageMarkup}</div><p class="tactical-tech-effect">기술 효과와 후속 단계 내용은 추후 설정됩니다.</p><button type="button" class="tactical-tech-develop" disabled>개발 실행</button></section>`;
    document.body.append(modal);
    const develop=modal.querySelector('.tactical-tech-develop'),close=()=>modal.remove();
    modal.querySelector('.tactical-tech-close').onclick=close;modal.onclick=event=>{if(event.target===modal)close();};
    modal.querySelectorAll('[data-tech-stage]').forEach(node=>node.onclick=()=>{
      modal.querySelectorAll('[data-tech-stage]').forEach(entry=>entry.classList.remove('selected'));
      node.classList.add('selected');selectedStage=Number(node.dataset.techStage);
      develop.disabled=progress.materials<1;
    });
    develop.onclick=()=>{
      if(selectedStage!==progress.level||progress.materials<1)return;
      const techName=stageName(selectedStage);
      tacticalWeaponState[id]={materials:progress.materials-1,level:progress.level+1};saveTacticalState();close();renderTacticalWeaponResearch();
      window.addMissionProgress?.('daily','research',1);window.addMissionProgress?.('weekly','research-50',1);
      notice(`${name} · ${techName} 개발 완료`);openTechTree(id);
    };
  };
  let researchSession={journal:0,core:0,failed:false};
  const performWeaponResearch = count => {
    const personnel=Math.max(0,Math.floor(Number(window.getExplorationLootInventory?.().researchStaff)||0)),requiredGold=count===10?9000:1000;
    let balances=window.gameResources;
    if(!balances){try{balances={gold:0,thorium:0,...(JSON.parse(localStorage.getItem('starfleet-game-resources-v1')||'{}')||{})};}catch{balances={gold:0,thorium:0};}window.gameResources=balances;}
    if(!window.__inventoryBalancesHydrated){try{const saved=JSON.parse(localStorage.getItem('starfleet-game-resources-v1')||'null');if(saved&&typeof saved==='object')Object.assign(balances,saved);}catch{}window.__inventoryBalancesHydrated=true;}
    if(personnel<count||Math.max(0,Number(balances.gold)||0)<requiredGold){notice(`연구인력 ${count}개와 골드 ${requiredGold.toLocaleString('ko-KR')}가 필요합니다.`);return false;}
    if(!window.consumeExplorationLootBatch?.([{itemId:'researchStaff',amount:count}])){notice(`연구인력 ${count}개가 필요합니다.`);return false;}
    balances.gold=Math.max(0,Number(balances.gold)||0)-requiredGold;
    try{localStorage.setItem('starfleet-game-resources-v1',JSON.stringify(balances));}catch{}
    let coreDrops=0;
    for(let index=0;index<count;index+=1){
      const [id]=tacticalFields[Math.floor(Math.random()*tacticalFields.length)],progress=tacticalProgress(id);
      tacticalWeaponState[id]={...progress,materials:progress.materials+1};
      if(Math.random()<.01)coreDrops+=1;
    }
    const journalDrop=count===10?Math.floor(Math.random()*11)+5:(Math.random()<.5?1:0);
    const failed=count===1&&journalDrop===0;
    researchJournal+=journalDrop;researchCore+=coreDrops;researchSession.journal+=journalDrop;researchSession.core+=coreDrops;researchSession.failed=failed;
    saveResearchCurrency();saveTacticalState();renderTacticalWeaponResearch();window.addMissionProgress?.('daily','research',1);window.addMissionProgress?.('weekly','research-50',count);
    window.dispatchEvent(new CustomEvent('weapon-research-completed',{detail:{count,journalDrop,coreDrops}}));
    return {journalDrop,coreDrops,failed};
  };
  const updateResearchResultText = popup => {
    const summary=popup.querySelector('.tactical-research-result-summary');
    summary.textContent=`연구일지 ${researchSession.journal}개 획득${researchSession.core?`, 범용연구코어 ${researchSession.core}개 획득`:''}`;
  };
  const openResearchResult = count => {
    document.getElementById('tactical-research-result-overlay')?.remove();
    const popup=document.createElement('div');popup.id='tactical-research-result-overlay';popup.className='tactical-research-result-overlay';
    const requiredGold=count===10?9000:1000;
    const costMarkup=`<em class="tactical-result-repeat-cost"><span data-cost-resource="personnel"><img src="icons/research-personnel-20261002.png" alt="연구인력"/>${count}</span><span data-cost-resource="gold"><img src="gold-resource-icon.svg" alt="골드"/>${requiredGold.toLocaleString('ko-KR')}</span></em>`;
    popup.innerHTML=`<section class="tactical-research-result" role="dialog" aria-modal="true" aria-label="전술무기 연구 결과"><div class="tactical-research-animation"><img src="tactical-research-chip.png" alt=""/><i class="research-circuit-node node-one"></i><i class="research-circuit-node node-two"></i><i class="research-circuit-node node-three"></i><i class="research-circuit-node node-four"></i><i class="research-circuit-node node-five"></i><b class="research-circuit-core"></b></div><div class="tactical-research-result-copy" hidden><h2>연구성공</h2><p class="tactical-research-result-summary"></p><div class="tactical-research-result-actions"><button type="button" class="tactical-research-again"><span>${count}회 연구</span>${costMarkup}</button><button type="button" class="tactical-research-finish">확인</button></div></div></section>`;
    document.body.append(popup);updateResearchResultText(popup);
    const animation=popup.querySelector('.tactical-research-animation'),copy=popup.querySelector('.tactical-research-result-copy');
    const applyOutcome=()=>{const failed=researchSession.failed;animation.classList.toggle('failed',failed);animation.classList.toggle('success',!failed);copy.classList.toggle('failed',failed);const label=failed?'연구 실패':'연구성공';copy.querySelector('h2').textContent=label;animation.querySelector('.research-circuit-core').textContent=failed?'':label;};
    requestAnimationFrame(()=>animation.classList.add('scanning'));
    const successTimer=setTimeout(()=>{if(!popup.isConnected)return;applyOutcome();copy.hidden=false;},2000);
    const againButton=popup.querySelector('.tactical-research-again');let shortageTimer;
    againButton.onclick=()=>{
      const personnel=Math.max(0,Math.floor(Number(window.getExplorationLootInventory?.().researchStaff)||0));
      const gold=Math.max(0,Number(window.gameResources?.gold)||0),goldCost=count===10?9000:1000;
      const missingPersonnel=Math.max(0,count-personnel),missingGold=Math.max(0,goldCost-gold);
      againButton.querySelector('[data-cost-resource="personnel"]').classList.toggle('insufficient',missingPersonnel>0);
      againButton.querySelector('[data-cost-resource="gold"]').classList.toggle('insufficient',missingGold>0);
      if(missingPersonnel||missingGold){
        let warning=againButton.querySelector('.tactical-result-shortage');if(!warning){warning=document.createElement('span');warning.className='tactical-result-shortage';againButton.append(warning);}
        warning.textContent=[missingPersonnel?`연구인력 ${missingPersonnel}개 부족`:null,missingGold?`골드 ${missingGold.toLocaleString('ko-KR')} 부족`:null].filter(Boolean).join(' · ');
        warning.hidden=false;clearTimeout(shortageTimer);shortageTimer=setTimeout(()=>{warning.hidden=true;},2200);return;
      }
      const warning=againButton.querySelector('.tactical-result-shortage');if(warning)warning.hidden=true;
      const result=performWeaponResearch(count);if(!result)return;playWeaponSearchSound();updateResearchResultText(popup);applyOutcome();
    };
    popup.querySelector('.tactical-research-finish').onclick=()=>{clearTimeout(successTimer);popup.remove();};
    popup.onclick=event=>{if(event.target===popup){clearTimeout(successTimer);popup.remove();}};
  };
  const playWeaponSearchSound = () => {
    const audio = window.createGameAudio('sound/weapon_search.wav');
    audio.preload = 'auto';
    audio.volume = .72;
    audio.play().catch(() => {});
  };
  const beginWeaponResearch = count => {
    researchSession={journal:0,core:0,failed:false};
    const result=performWeaponResearch(count);if(!result)return;
    playWeaponSearchSound();
    openResearchResult(count);
  };
  const renderTacticalWeaponResearch = () => {
    weaponPool.innerHTML = `<div class="tactical-research-head"><div class="tactical-research-heading"><small>TACTICAL ARSENAL</small><b>전술무기 연구</b></div><div class="tactical-research-inventory"><span class="journal-count"><img src="icons/research-journal.png" alt=""/><em>연구일지</em><b>${researchJournal.toLocaleString('ko-KR')}</b></span><span class="core-count"><img src="icons/research-core.png" alt=""/><em>범용연구코어</em><b>${researchCore.toLocaleString('ko-KR')}</b></span></div></div><div class="tactical-research-grid">${tacticalFields.map(([id, name, icon]) => {
      const progress = tacticalProgress(id);
      return `<article class="tactical-field" data-tactical-field="${id}"><header><i>${tacticalBadge(id,icon,'field')}</i><div><b>${name}</b></div><button type="button" data-tactical-develop="${id}">개발</button></header></article>`;
    }).join('')}</div><div class="tactical-research-actions"><button type="button" data-tactical-pull="1"><span>1회 연구</span><em class="tactical-pull-cost"><span><img src="icons/research-personnel-20261002.png" alt="연구인력"/>1</span><span><img src="gold-resource-icon.svg" alt="골드"/>1,000</span></em></button><button type="button" data-tactical-pull="10"><span>10회 연구</span><em class="tactical-pull-cost"><span><img src="icons/research-personnel-20261002.png" alt="연구인력"/>10</span><span><img src="gold-resource-icon.svg" alt="골드"/>9,000</span></em></button></div>`;
    weaponPool.querySelectorAll('.research-coming-soon,.weapon-research-coming-soon').forEach(message=>message.remove());
    weaponPool.querySelectorAll('[data-tactical-pull]').forEach(button=>button.onclick=()=>beginWeaponResearch(Number(button.dataset.tacticalPull)||1));
    weaponPool.querySelectorAll('[data-tactical-develop]').forEach(button=>button.onclick=()=>openTechTree(button.dataset.tacticalDevelop));
  };
  renderTacticalWeaponResearch();
  window.syncTacticalResearchInventory = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('starfleet-tactical-weapon-research-v1') || '{}');
      tacticalWeaponState = saved && typeof saved === 'object' ? saved : {};
      researchJournal = Math.max(0, Math.floor(Number(tacticalWeaponState.researchJournal) || 0));
      researchCore = Math.max(0, Math.floor(Number(tacticalWeaponState.researchCore) || 0));
      renderTacticalWeaponResearch();
    } catch (error) {
      console.warn('전술무기 연구 자원 동기화 실패', error);
    }
  };

  tabs.insertAdjacentHTML('beforeend', `<button class="research-tab research-tab-captain" data-research="captain" aria-pressed="false" aria-label="함장 훈련, 업데이트 예정" disabled><span class="research-tab-badge" aria-hidden="true"><span class="research-badge-orbit"></span><svg viewBox="0 0 48 48"><path d="M24 5 38 11v12c0 10-5.8 16.6-14 21-8.2-4.4-14-11-14-21V11Z"/><path d="m24 13 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2-4.5-4.4 6.2-.9Z"/></svg></span><span class="research-tab-copy"><small>COMMAND LINK</small><strong>함장 훈련</strong></span></button>`);
  weaponPool.insertAdjacentHTML('afterend', `<div id="captain-pool" class="summon-pool hidden"><div class="summon-art captain-art"><div class="captain-avatar">★</div><i>✦</i><i>✦</i></div><div class="captain-coming-soon"><small>COMMANDER TRAINING</small><b>함장 훈련</b><strong>업데이트 예정</strong><p>함장 육성 및 고유 전술 시스템을 준비 중입니다.</p></div></div>`);

  window.summonTab = (kind) => {
    ['ship', 'weapon', 'captain'].forEach((type) => document.getElementById(`${type}-pool`).classList.toggle('hidden', type !== kind));
    document.querySelectorAll('.summon-tabs button').forEach((button) => {
      const selected = button.dataset.research === kind;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  };
  window.summonCard = (kind) => notice(`${kind} 연구 완료!`);
  const rateNote=document.querySelector('.rate-note');
  if(rateNote){
    const probabilityButton=document.createElement('button');probabilityButton.type='button';probabilityButton.className='probability-button';probabilityButton.textContent='?';probabilityButton.setAttribute('aria-label','등급별 등장 확률 보기');rateNote.replaceWith(probabilityButton);
    probabilityButton.onclick=()=>{
      let popup=document.getElementById('probability-popup');
      if(!popup){popup=document.createElement('div');popup.id='probability-popup';popup.className='probability-popup';popup.innerHTML='<div class="probability-backdrop"></div><article><button type="button" class="probability-close" aria-label="확률 팝업 닫기">×</button><h3>함선 신호 · 보급품 확률</h3><div class="probability-list"><b class="prob-L">L급 함선 <span>0.5%</span></b><b class="prob-SSR">SSR급 함선 <span>3.4%</span></b><b class="prob-SR">SR급 함선 <span>20%</span></b><b class="prob-R">R급 함선 <span>45%</span></b><b class="prob-item">금고 <span>12%</span></b><b class="prob-item">토륨 상자 <span>10%</span></b><b class="prob-item">연구자료 가방 <span>2%</span></b><b class="prob-item">탐색트론 / 연구인력 <span>5% (각 2.5%)</span></b><b class="prob-item">함선골조 (무기별 5종) <span>2%</span></b><b class="prob-item">태양티끌 <span>0.1%</span></b></div><small>합계 100% · 보급품은 물자창고에 보관됩니다</small></article>';document.body.append(popup);popup.querySelector('.probability-backdrop').onclick=()=>popup.remove();popup.querySelector('.probability-close').onclick=()=>popup.remove();}
      const rect=probabilityButton.getBoundingClientRect(),popupWidth=Math.min(340,window.innerWidth-16);
      popup.querySelector('article').style.left=`${Math.max(8,Math.min(window.innerWidth-popupWidth-8,rect.right-popupWidth))}px`;
      popup.querySelector('article').style.top=`${Math.max(8,Math.min(window.innerHeight-300,rect.top-260))}px`;
      popup.hidden=false;
    };
  }
});
