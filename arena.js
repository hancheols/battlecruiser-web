(() => {
  'use strict';
  const C=window.ArenaCore,KEY='starfleet-async-arena-v1',WAL=KEY+'-transaction',RESOURCE='starfleet-game-resources-v1',SELF='player';
  const roles=['선봉','좌익','우익','프리깃'],fmt=n=>Math.round(n||0).toLocaleString('ko-KR'),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let overlay=null,lastFocus=null,playTimer=0,playing=false,draft=null,busy=false;
  const read=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}};
  function recover(){const tx=read(WAL,null);if(tx){localStorage.setItem(KEY,JSON.stringify(tx.state));localStorage.setItem(RESOURCE,JSON.stringify(tx.resources));localStorage.removeItem(WAL);if(window.gameResources)Object.assign(window.gameResources,tx.resources);}}
  function commit(state,resources){
    if(resources){localStorage.setItem(WAL,JSON.stringify({state,resources}));try{recover();}catch{/* Durable journal will replay on the next operation. */}Object.assign(window.gameResources||(window.gameResources={}),resources);}
    else localStorage.setItem(KEY,JSON.stringify(state));
    if(resources){window.updateGameResourceHud?.();window.dispatchEvent(new Event('game-resources-updated'));}
  }
  const lock=fn=>navigator.locks?navigator.locks.request('starfleet-arena',fn):Promise.resolve().then(fn);
  const research=()=>read('starfleet-tactical-weapon-research-v1',{});
  const ident=s=>s?{name:s.name,type:s.type,rarity:s.rarity,enhancementStars:Number(s.enhancementStars??s.stars)||0}:null;
  const shipKey=s=>s?`${s.type}|${s.name}`:'';
  const owned=()=> (window.getOwnedFleetVariants?.()||[]).filter(s=>!s.isFrame).map(s=>({...s,enhancementStars:Number(s.stars??s.enhancementStars)||0}));
  // 덱은 함선 종류(type|name)로 찾는다. 강화하면 강화 수치가 바뀌어 변형 키가 달라지므로,
  // 같은 함선 중 희귀도가 같은 것을 우선하고 그 안에서 가장 높은 강화 단계를 현재 값으로 사용한다.
  const resolve=deck=>deck.map(ref=>{
    if(!ref)return null;
    const candidates=owned().filter(s=>shipKey(s)===shipKey(ref));
    const sameRarity=candidates.filter(s=>s.rarity===ref.rarity);
    const pool=sameRarity.length?sameRarity:candidates;
    return pool.sort((a,b)=>b.enhancementStars-a.enhancementStars)[0]||null;
  });
  const snapshot=(ships,dev=research())=>ships.map(s=>s?C.stats(s,window.getArenaShipBaseStats(s),dev):null);
  const complete=deck=>deck?.length===4&&deck.slice(0,3).every(s=>s&&s.type!=='frigate')&&(!deck[3]||deck[3].type==='frigate')&&new Set(deck.filter(Boolean).map(shipKey)).size===deck.filter(Boolean).length;
  const frigateUnlocked=()=>Math.max(research().frigate?.level||0,research().frigateTree?.firepower1||0)>=1;
  // 등급 인덱스(0~29). 점수 구간을 TIERS 인덱스로 바꾼 값이다.
  function tierIndexOf(score){return score>=6000?29:score>=4800?24:(C.indexForScore?C.indexForScore(score):Math.min(23,Math.floor(score/200)));}
  // 플레이어 연구 트리 레벨에 계수를 곱한 봇용 연구 상태.
  function scaledResearch(factor){
    const base=research(),out={...base};
    Object.keys(base).filter(k=>/Tree$/.test(k)&&base[k]&&typeof base[k]==='object').forEach(k=>{out[k]=Object.fromEntries(Object.entries(base[k]).map(([n,v])=>[n,typeof v==='number'?Math.round(v*factor):v]));});
    return out;
  }
  function makeBots(){
    const catalog=(window.getFleetCatalog?.()||[]).filter(s=>!s.isFrame),main=catalog.filter(s=>s.type!=='frigate'&&s.profile?.[0]),support=catalog.filter(s=>s.type==='frigate');
    if(main.length<3)throw Error('함선 정보를 불러오는 중입니다. 잠시 후 다시 열어주세요.');
    const names=['NOVA PRIME','청룡 함대','SIRIUS','ORION','RED COMET','은하수','POLARIS','아틀라스','VANGUARD','해오라기','ACE-77','STARBLADE','SOLARIS','NEBULA','이클립스','묵룡'];
    const scores=[6400,...Array.from({length:15},(_,i)=>5950-i*65),...Array.from({length:24},(_,i)=>(C.TIER_STARTS?.[i]??i*200)+10),0,45,110,170];
    // 봇 전투력은 플레이어 편성 수준에 맞춘다. 상위 등급 봇은 플레이어와 같은 수준(계수 1), 하위 등급 봇은 60% 수준이다.
    const top=owned().filter(s=>s.type!=='frigate'&&s.profile?.[0]).sort((a,b)=>b.enhancementStars-a.enhancementStars).slice(0,3);
    const playerStars=top.length?top.reduce((n,s)=>n+s.enhancementStars,0)/top.length:0;
    // 희귀도도 같은 계수로 맞춘다. 플레이어 최고 희귀도 × 계수 이하의 함선만 봇 덱 후보가 된다.
    const RANK={R:1,SR:2,SSR:3,L:4};
    const playerRank=Math.max(1,...top.map(s=>RANK[s.rarity]||1));
    return scores.map((score,i)=>{const f=0.6+0.4*(tierIndexOf(score)/29),rng=C.random(801+i),pool=main.filter(s=>(RANK[s.rarity]||1)<=Math.max(1,Math.round(playerRank*f))),choices=[...pool],stars=Math.min(5,Math.round(playerStars*f));
      // 봇 덱은 중전함·전투순양함·구축함을 하나씩 섞는다(봇마다 시작 함종을 바꿔 전체 분포도 고르게 한다).
      const TYPES=["dreadnought","battlecruiser","destroyer"];
      const ships=Array.from({length:3},(_,k)=>{const want=TYPES[(i+k)%3];let options=choices.filter(s=>s.type===want);if(!options.length)options=choices;const picked=options[Math.floor(rng()*options.length)];choices.splice(choices.indexOf(picked),1);return {...picked,enhancementStars:stars};});
      ships.push(support.length?{...support[i%support.length],enhancementStars:Math.min(3,stars)}:null);
      const dev=scaledResearch(f);
      return {id:'bot-'+i,name:names[i%names.length]+(i>=16?' '+(Math.floor(i/16)+1):''),score,bot:true,tokens:12+Math.floor(score/35)+(i*13)%23,deck:snapshot(ships,dev)};
    });
  }
  function initial(){const deck=(window.getFleetAssignments?.()||[]);while(deck.length<4)deck.push(null);return {version:1,botVersion:4,score:0,wins:0,losses:0,draws:0,tickets:0,freeUsed:0,freeDay:C.day(Date.now()),settledDay:C.day(Date.now()),attack:deck.map(ident),defense:deck.map(ident),defenseSnapshot:complete(deck)?snapshot(deck):null,bots:makeBots(),inbox:[],history:[],pending:null};}
  const playerName=()=>{const p=read('starfleet-commander-profile-v1',{});return p.lastName?`${p.character||''} ${p.lastName}`:'나의 함대';};
  const board=state=>C.standings([{id:SELF,name:playerName(),score:state.score,deck:state.defenseSnapshot},...state.bots]);
  const mine=state=>board(state).find(p=>p.id===SELF);
  // 등급 상승 토륨 보상: 처음 도달한 등급마다 계정당 한 번만 지급한다. 중간 등급을 건너뛰면 지나친 등급도 함께 지급한다. 다이아몬드는 보상 없음.
  const TIER_THORIUM={Bronze:100,Silver:200,Gold:300,Diamond:400,Platinum:500,'HERO 5':1000,'HERO 4':1000,'HERO 3':1000,'HERO 2':1000,'HERO 1':1500,LEGEND:2000};
  // 등급별 축전 문구(게임 내 우편). 보상 토륨은 우편 첨부로 전달되고, 수령 버튼을 눌러야 받는다.
  const TIER_CONGRATS={
    Bronze:'아이언의 굴레를 벗어났다!!! 이제 우리는 브론즈다! 첫 등급 상승을 진심으로 축하한다!',
    Silver:'실버 등급 달성!!! 더 높은 전장의 문이 열렸다. 지금까지의 노력이 빛을 발하고 있다!!',
    Gold:'골드!!! 이 자리까지 오르는 건 쉽지 않았을 텐데 정말 대단하다! 함대의 기세가 무섭다!!',
    Diamond:'다이아몬드 등급 달성!!! 별처럼 빛나는 지휘관이다. 연합 전체가 함께 환호하고 있다!!!',
    Platinum:'플래티넘!!! 최상위권의 실력이다. 전장을 호령하는 지휘관, 진심으로 축하한다!!!',
    'HERO 5':'히어로 등급 진입!!! 영웅의 이름을 얻었다. 오늘 밤은 축배를 들어도 좋다!!!',
    'HERO 4':'히어로 4 달성!!! 한 계단씩 영웅에 가까워지고 있다. 질주는 멈추지 않는다!!!',
    'HERO 3':'히어로 3 달성!!! 전설의 문턱이 눈앞이다. 정말 놀라운 기세다!!!',
    'HERO 2':'히어로 2 달성!!! 정점이 가까워졌다. 모두가 지휘관의 이름을 기억할 것이다!!!',
    'HERO 1':'히어로 1!!! 최고의 영웅 바로 앞이다. 사령부 전원이 기립 박수를 보낸다!!!!',
    LEGEND:'레전드 달성!!!!! 전설이 되었다. 이 순간을 영원히 기억하겠다. 진심으로, 정말로 축하한다!!!!!'
  };
  // 등급 안에서 단계가 오를 때(예: 브론즈 3→2→1)도 해당 등급 축하 토륨의 10%를 단계마다 한 번씩 지급한다. 등급에 처음 들어갈 때는 위의 전액 보상만 준다.
  const STEP_RATE=.1;
  const isStepUp=t=>t.group!=='HERO'&&t.group!=='LEGEND'&&(t.group in TIER_THORIUM)&&C.TIERS.find(x=>x.group===t.group).index!==t.index;
  // 처음 도달한 등급마다 축전(보상 우편)을 한 번만 보낸다. 중간 등급을 건너뛰면 지나친 등급도 모두 보낸다.
  function tierRewardGrant(state){
    const current=mine(state).tier;
    state.tierRewards=state.tierRewards||{};
    const labels=[];
    // 이미 지나온 단계도 아직 받지 않았다면 소급해서 지급한다(단계마다 한 번).
    state.stepRewards=state.stepRewards||{};
    for(const t of C.TIERS){
      if(t.index>current.index)break;
      if(isStepUp(t)&&!state.stepRewards[t.label]){
        state.stepRewards[t.label]=true;
        window.deliverCaptainMail?.({
          id:`tier-step-${t.label.replace(/\s+/g,'')}`,
          title:`등급 단계 상승 · ${t.label} 달성`,
          sender:'연합 사령부 · 축전',
          body:`${t.group} 등급 안에서 한 단계 더 올랐습니다. 꾸준한 승리를 축하하며 ${t.group} 등급 축하 토륨의 10%를 보냅니다.`,
          rewards:{thorium:Math.round(TIER_THORIUM[t.group]*STEP_RATE)}
        });
      }
      const key=t.group==='HERO'?`HERO ${t.division}`:t.group;
      if(!(key in TIER_THORIUM)||state.tierRewards[key])continue;
      state.tierRewards[key]=true;labels.push(key);
      window.deliverCaptainMail?.({
        id:`tier-congrats-${key.replace(/\s+/g,'')}`,
        title:`등급 상승 축하 · ${key} 달성`,
        sender:'연합 사령부 · 축전',
        body:TIER_CONGRATS[key],
        rewards:{thorium:TIER_THORIUM[key]}
      });
    }
    return {labels};
  }
  // 대전한 날(battleDays)만 일일 보상을 준다. 주간 보상은 한 주(수요일 0시 ~ 다음 수요일 0시)에 일일 보상을 5회 이상 받은 경우에만 지급한다.
  // 보상은 게임 내 우편(captain-mail)으로 보내며, 같은 id의 우편은 한 번만 만들어진다.
  function markBattleDay(state,now=Date.now()){
    state.battleDays=[...new Set([...(state.battleDays||[]),C.day(now)])].slice(-40);
  }
  function sendArenaMail(state,{id,title,body,amounts},now){
    if(window.deliverCaptainMail){window.deliverCaptainMail({id,title,sender:'아레나 사령부',body,rewards:amounts,createdAt:now});return;}
    // 우편 시스템이 아직 준비되지 않았다면 보상함에 임시 보관한다.
    state.inbox.push({id,label:title,amounts});
  }
  function settle(state,now=Date.now()){
    const today=C.day(now);if(today>state.freeDay){state.freeDay=today;state.freeUsed=0;}
    if(today>state.settledDay){
      const battleDays=new Set(state.battleDays||[]),info=mine(state),tier=info.tier;
      const daily=C.rewards(tier.index),weekly=C.rewards(tier.index,true);
      const dailyAmounts={gold:0,thorium:0,lionToken:0,ssrShipTicket:0};let dailyCount=0;
      const firstDay=state.settledDay+1;
      for(let d=firstDay;d<today;d++){
        if(battleDays.has(d)){dailyCount++;state.weekDays=(state.weekDays||0)+1;dailyAmounts.gold+=daily.gold;dailyAmounts.thorium+=daily.thorium;}
        // d가 대전한 날이고 다음 날이 수요일이면 주 마감이다.
        if(C.isWednesday(d+1)){
          if((state.weekDays||0)>=5){
            const top=info.rank<=7,amounts={gold:weekly.gold,thorium:weekly.thorium,lionToken:0,ssrShipTicket:top?1:0};
            sendArenaMail(state,{
              id:`arena-weekly-${d+1}`,
              title:'아레나 주간 보상 도착 · 축하합니다!',
              body:`${tier.label} 등급으로 한 주를 함께 달려 주셨습니다. 일일 보상을 5회 이상 받으신 꾸준함에 대한 주간 보상입니다.${top?' 주간 상위 7위 안에 드신 것을 진심으로 축하드리며, SSR 함선 선택 교환권 1장을 추가로 드립니다.':''} 지휘관님의 노고에 감사드립니다.`,
              amounts,
            },now);
          } else state.seasonWeekMissed=true;
          state.weekDays=0;
        }
      }
      if(dailyCount){
        sendArenaMail(state,{
          id:`arena-daily-${firstDay}-${today}`,
          title:'아레나 일일 보상 도착',
          body:`축하합니다! ${tier.label} 등급으로 ${dailyCount}일 동안 아레나 대전에 나서 주셨습니다. 매일 전선에 서 주신 지휘관님께 감사드립니다. 보상을 전달합니다.`,
          amounts:dailyAmounts,
        },now);
      }
      state.settledDay=today;
    }
    return state;
  }
  function state(){recover();let s=read(KEY,null);if(!s)s=initial();const before=JSON.stringify(s);if(s&&(s.botVersion||0)<4){try{const fresh=makeBots();s.bots=s.bots.map((b,i)=>({...b,deck:fresh[i]?.deck||b.deck}));s.botVersion=4;}catch{/* 함선 정보가 아직 없으면 다음 호출에서 다시 시도한다 */}}settle(s);const defense=resolve(s.defense||[]);if(complete(defense))s.defenseSnapshot=snapshot(defense);if(before!==JSON.stringify(s)||!localStorage.getItem(KEY))commit(s);return s;}
  function note(text){const n=overlay?.querySelector('[data-arena-note]');if(n)n.textContent=text;else window.notice?.(text);}
  async function act(fn){if(busy)return;busy=true;try{await lock(fn);}catch(e){note(e.message||'저장할 수 없습니다. 다시 시도해주세요.');}finally{busy=false;}}
  function emblem(tier,small=false){
    const symbols={Iron:'M22 36l14 8 14-8',Bronze:'M20 29l16 9 16-9M20 39l16 9 16-9',Silver:'M20 25l16 9 16-9M20 35l16 9 16-9M20 45l16 9 16-9',Gold:'M18 27l18 10 18-10M18 36l18 10 18-10M18 45l18 10 18-10',Diamond:'M17 29l8-10h22l8 10-19 28-19-28h38M25 19l11 38 11-38',Platinum:'M36 22v31M34 32L17 23l7 21 12 9 12-9 7-21-17 9M27 22l9-6 9 6',HERO:'M36 16l6 14 17 1-13 11 4 16-14-9-14 9 4-16-13-11 17-1Z',LEGEND:'M17 26l10 8 9-18 9 18 10-8-5 25H22Z M23 56h26'};
    return `<svg class="arena-emblem${small?' small':''}" viewBox="0 0 72 80" style="--rank-color:${tier.color}" aria-label="${tier.label}"><path class="crest" d="M36 3 66 19v39L36 77 6 58V19Z"/><path class="inset" d="M36 9 60 23v32L36 70 12 55V23Z"/><path class="sigil" d="${symbols[tier.group]}"/></svg>`;
  }
  const shipCard=(s,slot,click='')=>`<button type="button" class="arena-ship" ${click} ${!click?'disabled':''}><small>${roles[slot]}</small>${s?`<img src="${esc(s.image)}" alt="${esc(s.name)}"/><b>${esc(s.name)}</b><em>${s.rarity} · ${s.enhancementStars??s.stars??0}성</em>`:'<span class="arena-empty">＋</span><b>선택</b>'}</button>`;
  function deckBlock(kind,label,s){const deck=resolve(s[kind]);return `<section class="arena-deck arena-deck-${kind}"><header><div><small>${kind==='defense'?'DEFENSE FLEET · GUARD':'ATTACK FLEET · ASSAULT'}</small><h3>${label}</h3></div><button data-edit-deck="${kind}">등록 / 변경</button></header><div class="arena-ships">${deck.map((ship,i)=>shipCard(ship,i)).join('')}</div>${kind==='defense'?'<p>저장된 방어 함대는 상대의 공격에 자동으로 대응합니다.</p>':''}</section>`;}
  function shell(title,content){const isHome=title==='ARENA',isCombat=title==='함대 교전';overlay.innerHTML=`<article class="arena-panel${isHome?' arena-home':''}${isCombat?' arena-combat-panel':''}" role="dialog" aria-modal="true" aria-label="${esc(isHome?'아레나':title)}"><header class="arena-header">${isHome?'':`<div><small>UNITED STAR FLEET · ASYNC ARENA</small><h2>${title}</h2></div>`}<button data-arena-close aria-label="닫기">×</button></header>${content}<p class="arena-note" data-arena-note role="status"></p></article>`;overlay.querySelector('[data-arena-close]').onclick=()=>playing?note('자동전투가 진행 중입니다.'):draft?(draft=null,render()):close();}
  function render(){
    const s=state(),rows=board(s),me=mine(s),top=rows.slice(0,3),ticketLeft=Math.max(0,5-s.freeUsed),daily=C.rewards(me.tier.index),weekly=C.rewards(me.tier.index,true);
    shell('ARENA',`
      <div class="arena-season"><img src="icons/arena-button.png" alt="Arena"/><div><small>SEASON 01</small><h3>유틀란트 해전</h3></div></div>
      <section class="arena-ranking">
        <div class="arena-podium">${[1,0,2].map(i=>{const p=top[i];return `<div class="place-${i+1}"><span>${i===0?'♛':i+1}</span>${emblem(p.tier)}<button type="button" class="arena-podium-name" data-player-id="${esc(p.id)}">${esc(p.name)}</button><small>${p.tier.label}</small><strong>${fmt(p.score)}</strong></div>`;}).join('')}</div>
        <div class="arena-rank-list">${rows.slice(3).map(p=>`<div class="${p.id===SELF?'is-self':''}"><strong>${p.rank}</strong>${emblem(p.tier,true)}<span><button type="button" class="arena-player-link" data-player-id="${esc(p.id)}">${esc(p.name)}</button></span><em>${fmt(p.score)}</em></div>`).join('')}</div>
      </section>
      <button class="arena-battle-button" data-match><strong>아레나 출전</strong><span>${ticketLeft?'무료 대전 '+ticketLeft+' / 5':'아레나 티켓 1장 사용'}</span></button>
      ${deckBlock('defense','수비 함대',s)}${deckBlock('attack','공격 함대',s)}
      <footer class="arena-status">${emblem(me.tier)}<div><small>현재 등급</small><div class="arena-tier-line"><b>${me.tier.label}</b><button type="button" class="arena-tier-help" data-rules aria-label="등급과 보상 정보">?</button></div><span>${fmt(s.score)}점 · ${me.rank}위</span></div><div><small>대전 기록</small><b>${s.wins}승 ${s.losses}패</b><button type="button" class="arena-ticket-link" data-arena-ticket-shop>티켓 ${s.tickets}장</button></div></footer>
      <p class="arena-settlement">일일: 그날 대전 1회 이상 · 주간: 일일 보상 5회 이상 수령 (수요일 0시 KST 정산)<br>일일 ${rewardText(daily)} / 주간 ${rewardText(weekly)}</p>
      <div class="arena-matchup-entry"><button type="button" class="arena-help-btn" data-matchup-help aria-label="함종 상성 안내">?</button><span>함종 상성 안내</span></div>
      <div class="arena-matchup-help" data-matchup-panel hidden>${matchupHelpHtml()}</div>`);
    overlay.querySelector('[data-match]').onclick=()=>openPreview();
    overlay.querySelectorAll('[data-edit-deck]').forEach(b=>b.onclick=()=>editDeck(b.dataset.editDeck));
    overlay.querySelector('[data-rules]').onclick=rules;
    // 티켓 수량을 누르면 상점의 보급품 탭(아레나 티켓 판매대)으로 이동한다.
    overlay.querySelector('[data-arena-ticket-shop]').onclick=()=>window.openAlienShop?.('supply');
    // 메인 화면 하단 ? 버튼: 함종 상성 안내 팝업
    overlay.querySelector('[data-matchup-help]').onclick=()=>{const panel=overlay.querySelector('[data-matchup-panel]');panel.hidden=!panel.hidden;};
    overlay.querySelector('[data-matchup-panel]').onclick=()=>{overlay.querySelector('[data-matchup-panel]').hidden=true;};
    overlay.querySelectorAll('[data-player-id]').forEach(button=>button.onclick=()=>showPlayerProfile(rows.find(p=>p.id===button.dataset.playerId)));
  }
  function showPlayerProfile(player){
    if(!player)return;
    document.querySelector('.arena-player-popup')?.remove();
    const roster=player.id===SELF?owned():((player.deck||[]).filter(Boolean));
    const rarityRank={R:1,SR:2,SSR:3,L:4};
    const best=[...roster].sort((a,b)=>(rarityRank[b.rarity]||0)-(rarityRank[a.rarity]||0)||(Number(b.enhancementStars??b.stars)||0)-(Number(a.enhancementStars??a.stars)||0))[0];
    const levels=player.id===SELF
      ?Math.max(0,...roster.map(ship=>C.development(ship,research()).levels||0))
      :Math.max(0,...roster.map(ship=>Number(ship.dev?.levels)||0));
    const botIndex=Number(String(player.id).replace('bot-',''))||0;
    const tokenCount=player.id===SELF
      ?Math.max(0,Math.floor(Number((window.gameResources||read(RESOURCE,{})).lionToken)||0))
      :Math.max(0,Math.floor(Number(player.tokens??(12+Math.floor(player.score/35)+(botIndex*13)%23))||0));
    const popup=document.createElement('div');popup.className='arena-player-popup';popup.innerHTML=`<section class="arena-player-card" role="dialog" aria-modal="true" aria-label="함장 정보"><header><small>FLEET CAPTAIN</small><button type="button" aria-label="닫기">×</button></header><h3>${esc(player.name)}</h3><dl><div><dt>최고 등급 함선</dt><dd>${best?`${esc(best.name)} · ${esc(best.rarity||'R')} · ${Number(best.enhancementStars??best.stars)||0}성`:'등록 정보 없음'}</dd></div><div><dt>최고 개발 단계</dt><dd>Lv. ${fmt(levels)}</dd></div><div><dt>사자증표</dt><dd>${fmt(tokenCount)}개</dd></div></dl></section>`;
    const close=()=>{popup.remove();document.removeEventListener('keydown',onKey);};
    const onKey=event=>{if(event.key==='Escape'){event.stopPropagation();close();}};
    popup.addEventListener('click',event=>{if(event.target===popup||event.target.closest('button'))close();});
    document.addEventListener('keydown',onKey);document.body.append(popup);popup.querySelector('button').focus();
  }
  const rewardText=r=>[`${fmt(r.gold)} 골드`,`${fmt(r.thorium)} 토륨`,r.lionToken?`증표 ${r.lionToken}`:'',r.ssrShipTicket?`SSR 교환권 ${r.ssrShipTicket}`:''].filter(Boolean).join(' · ');
  function sub(title,html){shell(title,html);overlay.querySelector('[data-arena-close]').onclick=render;}
  function rules(){sub('등급과 보상',`<p class="arena-explanation">같은 등급 우선 무작위 매칭. 동점 상대 기준 승리 +30 / 패배 −20점, 상대 점수에 따라 +15~45 / −10~30점. 무승부 0점, 최저 0점.<br>HERO는 3,600점부터 200점마다 HERO 5 → 4 → 3 → 2 → 1로 올라갑니다(3,600~3,799 HERO 5, 4,400~4,599 HERO 1). LEGEND는 4,600점 이상입니다.<br>일일 보상: 그날 대전을 1회 이상 해야 지급 (매일 0시 KST 정산). 주간 보상: 일일 보상의 2배, 수요일 0시 기준 한 주에 일일 보상을 5회 이상 받아야 지급되며, 주간 상위 7명에게 SSR 함선 선택 교환권 1장이 추가로 지급됩니다.<br>시즌 보상(시즌 기능 도입 후 지급): 일일 보상의 3배, 다이아 이상. 시즌 중 모든 주간 보상을 받은 경우에만 지급됩니다. 플래티넘 이상 SSR 교환권 1장, 히어로 이상 증표 1개, 레전드 증표 3개.</p><div class="arena-tier-table"><div><b>등급 / 조건</b><b>일일 보상</b><b>주간 보상</b></div>${C.TIERS.map(t=>`<div><span>${emblem(t,true)}<b>${t.label}</b><small>${t.group==='LEGEND'?`${fmt(t.min)}점 이상`:t.group==='HERO'?`${fmt(t.min)} ~ ${fmt(t.min+199)}`:`${fmt(t.min)} ~ ${fmt((C.TIER_STARTS[t.index+1]??t.min+199)-1)}`}</small></span><span>${rewardText(C.rewards(t.index))}</span><span>${rewardText(C.rewards(t.index,true))}</span></div>`).join('')}</div><p class="arena-explanation"><b>함종 상성 (아레나 전용)</b><br>중전함 ▶ 구축함 ▶ 전투순양함 ▶ 중전함 (앞의 함종이 뒤의 함종을 이깁니다). 강한 함종은 상대 함종에게 기본 공격과 스킬 피해가 +10%, 약한 쪽에게 받을 때는 −10%입니다. 연구 공격력 보너스와 더해서 계산합니다. 출전 전에 상대 함대를 미리 확인할 수 있습니다.</p><p class="arena-explanation">보상 가치 기준: 사자증표 1 = 토륨 100 = 골드 100,000.<br>이 리그는 현재 기기에 저장되는 가상 상대 테스트 환경입니다. 실제 이용자 매칭·방어전 수신·서버 시간 정산은 서버 연결 후 제공됩니다.</p>`);if(state().inbox.length){const claim=document.createElement('button');claim.className='arena-save';claim.textContent='도착한 보상 확인';claim.onclick=inbox;overlay.querySelector('.arena-panel').insertBefore(claim,overlay.querySelector('.arena-note'));}}
  function editDeck(kind){draft={kind,slots:C.clone(state()[kind])};paintDeck();}
  function paintDeck(){
    const deck=resolve(draft.slots);shell(draft.kind==='defense'?'방어 덱 편성':'공격 덱 편성',`<p class="arena-explanation">선봉 · 좌익 · 우익에 서로 다른 함선을 선택하세요. 프리깃은 연구 개방 후 선택할 수 있습니다.</p><div class="arena-ships">${deck.map((s,i)=>shipCard(s,i,`data-slot="${i}"`)).join('')}</div><div class="arena-tools"><button data-import>함대관리 편성 불러오기</button><button data-save class="arena-save">편성 저장</button></div><p class="arena-explanation">등급·성급은 보유 변형과 연결됩니다. 방어 덱은 저장 시 개발 수치까지 복사되며, 개발 후 다시 저장하면 갱신됩니다.</p>`);
    overlay.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>pick(Number(b.dataset.slot)));
    overlay.querySelector('[data-import]').onclick=()=>{draft.slots=Array.from({length:4},(_,i)=>ident(window.getFleetAssignments?.()[i]));paintDeck();};
    overlay.querySelector('[data-save]').onclick=()=>act(()=>{const deck=resolve(draft.slots);if(!complete(deck))throw Error('선봉·좌익·우익을 모두 서로 다른 보유 함선으로 편성해주세요.');if(deck[3]&&!frigateUnlocked())throw Error('프리깃 연구가 필요합니다.');const s=state();s[draft.kind]=deck.map(ident);if(draft.kind==='defense')s.defenseSnapshot=snapshot(deck);commit(s);draft=null;render();note('편성을 저장했습니다.');});
  }
  function pick(slot){
    if(slot===3&&!frigateUnlocked()){note('연구실에서 프리깃을 먼저 개발해주세요.');return;}
    const list=owned().filter(s=>slot===3?s.type==='frigate':s.type!=='frigate').sort((a,b)=>({L:4,SSR:3,SR:2,R:1}[b.rarity]-{L:4,SSR:3,SR:2,R:1}[a.rarity])||b.enhancementStars-a.enhancementStars);
    shell(roles[slot]+' 선택',`<div class="arena-picker">${list.map((s,i)=>{const used=draft.slots.some((v,k)=>k!==slot&&shipKey(v)===shipKey(s));return `<button data-choice="${i}" ${used?'disabled':''}><img src="${esc(s.image)}" alt=""/><b>${esc(s.name)}</b><span>${s.rarity} · ${s.enhancementStars}성${used?' · 편성됨':''}</span></button>`;}).join('')||'<p>보유한 함선이 없습니다. 함대관리에서 함선을 확보해주세요.</p>'}</div>${slot===3?'<button data-clear-slot>프리깃 해제</button>':''}`);
    overlay.querySelector('[data-arena-close]').onclick=paintDeck;
    overlay.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{draft.slots[slot]=ident(list[Number(b.dataset.choice)]);paintDeck();});
    overlay.querySelector('[data-clear-slot]')?.addEventListener('click',()=>{draft.slots[slot]=null;paintDeck();});
  }
  // 상대 덱 미리보기: 상대를 먼저 정해 state.preview에 저장하고, 출전 버튼을 눌러야 대전이 시작된다.
  const TYPE_KO={dreadnought:'중전함',battlecruiser:'전투순양함',destroyer:'구축함',frigate:'프리깃'};
  async function openPreview(){
    await act(()=>{
      const s=state();if(s.pending){enterArenaBattle(s.pending);return;}
      if(s.preview)return;
      const fleet=snapshot(resolve(s.attack));
      if(!complete(fleet)||!complete(s.defenseSnapshot))throw Error('공격 덱과 방어 덱을 먼저 등록해주세요.');
      if(resolve(s.attack)[3]&&!frigateUnlocked())throw Error('프리깃 연구를 먼저 개방해주세요.');
      if(s.freeUsed>=5&&s.tickets<1)throw Error('무료 대전을 모두 사용했습니다. 상점에서 아레나 티켓을 구매해주세요.');
      const seed=crypto.getRandomValues(new Uint32Array(1))[0],enemy=C.chooseOpponent([{id:SELF,score:s.score,deck:s.defenseSnapshot},...s.bots],SELF,C.random(seed));
      if(!enemy)throw Error('매칭 가능한 상대가 없습니다.');
      s.preview={seed,enemy:{id:enemy.id,name:enemy.name,score:enemy.score,tier:enemy.tier,deck:enemy.deck}};commit(s);
    });
    const s=state();
    if(s.preview&&!s.pending)showPreview(s);
  }
  // 한 함선이 상대 전열 3척 중 상성 유리·불리가 몇 척인지 센다.
  function matchupCounts(ship,opponents){
    const front=(opponents||[]).slice(0,3).filter(Boolean);
    return {up:front.filter(o=>C.typeBonus(ship,o)>0).length,down:front.filter(o=>C.typeBonus(ship,o)<0).length};
  }
  function matchupBadge(ship,opponents){
    if(!ship||ship.type==='frigate')return '';
    const {up,down}=matchupCounts(ship,opponents);
    if(!up&&!down)return '<span class="arena-matchup neutral">보통</span>';
    return `<span class="arena-matchup-row">${up?`<span class="arena-matchup up" aria-label="유리 ${up}">▲${up}</span>`:''}${down?`<span class="arena-matchup down" aria-label="불리 ${down}">▼${down}</span>`:''}</span>`;
  }
  // ? 버튼 팝업: 함종 상성을 글자와 그림으로 보여준다(중전함 > 구축함 > 전투순양함 > 중전함, 기본 공격·스킬 피해 ±10%).
  function matchupHelpHtml(){
    const node=(label,cls)=>`<span class="arena-help-ship ${cls}">${label}</span>`;
    const edge=(text,cls)=>`<span class="arena-help-edge ${cls}">${text}</span>`;
    return `<div class="arena-help-card" role="dialog" aria-label="함종 상성 안내">
      <b>함종 상성</b>
      <p>유리한 함종에 공격하면 기본 공격과 스킬 피해가 <strong class="up">+10%</strong>, 불리한 함종에 공격당하면 <strong class="down">−10%</strong>입니다.</p>
      <svg class="arena-help-triangle" viewBox="0 0 260 180" role="img" aria-label="함종 상성 삼각형: 중전함은 구축함에, 구축함은 전투순양함에, 전투순양함은 중전함에 유리"><defs><marker id="arena-tri-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#7dffb0"/></marker></defs><path d="M130 33 L192 141" class="tri-edge"/><path d="M192 141 L68 141" class="tri-edge"/><path d="M68 141 L130 33" class="tri-edge"/><path d="M147 62 L174 110" class="tri-arrow" marker-end="url(#arena-tri-arrow)"/><path d="M158 141 L104 141" class="tri-arrow" marker-end="url(#arena-tri-arrow)"/><path d="M85 112 L112 64" class="tri-arrow" marker-end="url(#arena-tri-arrow)"/><text x="182" y="88" class="tri-label">+10%</text><text x="130" y="158" class="tri-label">+10%</text><text x="78" y="88" class="tri-label">+10%</text><g class="tri-node dread"><circle cx="130" cy="33" r="30"/><text x="130" y="37">중전함</text></g><g class="tri-node destroy"><circle cx="192" cy="141" r="30"/><text x="192" y="145">구축함</text></g><g class="tri-node cruiser"><circle cx="68" cy="141" r="30"/><text x="68" y="145">전투순양함</text></g></svg>

      <ul>
        <li><span class="up">▲</span> 중전함 → 구축함</li>
        <li><span class="up">▲</span> 전투순양함 → 중전함</li>
        <li><span class="up">▲</span> 구축함 → 전투순양함</li>
      </ul>
      <small>프리깃은 상성이 없습니다. 화면을 누르면 닫힙니다.</small>
    </div>`;
  }
  function showPreview(s){
    const mine=resolve(s.attack).slice(0,4),theirs=(s.preview.enemy.deck||[]).slice(0,4);
    const card=(u,opponents,side)=>u?`<div class="arena-preview-ship ${side}"><img src="${esc(u.image)}" alt=""/><b>${esc(u.name)}</b><small>${esc(TYPE_KO[u.type]||u.type)} · ${esc(u.rarity)}</small>${u.type==='frigate'?'<span class="arena-matchup neutral">지원</span>':matchupBadge(u,opponents)}</div>`:`<div class="arena-preview-ship ${side} empty">없음</div>`;
    const mainMine=mine.slice(0,3),mainTheirs=theirs.slice(0,3);
    const net=mainMine.filter(Boolean).reduce((n,u)=>{const m=matchupCounts(u,mainTheirs);return n+(m.up>m.down?1:m.down>m.up?-1:0);},0);
    const summary=net>0?`우리 함대가 상성상 유리합니다 (유리 ${net}척 우세)`:net<0?`우리 함대가 상성상 불리합니다 (불리 ${-net}척 우세)`:'상성은 대등합니다';
    sub('아레나 출전 확인',`
      <div class="arena-preview-versus">
        <section><small>우리 함대</small>${mine.slice(0,3).map(u=>card(u,mainTheirs,'mine')).join('')}${card(mine[3],[],'mine frigate')}</section>
        <em>VS</em>
        <section><small>상대 · ${esc(s.preview.enemy.name)}</small>${theirs.slice(0,3).map(u=>card(u,mainMine,'theirs')).join('')}${card(theirs[3],[],'theirs frigate')}</section>
      </div>
      <p class="arena-matchup-summary">${summary}</p>
      <div class="arena-preview-actions"><button type="button" data-preview-cancel>취소</button><button type="button" data-preview-start>출전</button></div>`);
    overlay.querySelector('[data-preview-start]').onclick=()=>startMatch(false);
    overlay.querySelector('[data-preview-cancel]').onclick=async()=>{await act(()=>{const x=state();x.preview=null;commit(x);});render();};
  }
  async function startMatch(practice){await act(()=>{
    const s=state();if(s.pending){enterArenaBattle(s.pending);return;}
    const fleet=practice?s.defenseSnapshot:snapshot(resolve(s.attack));
    if(!complete(fleet)||!complete(s.defenseSnapshot))throw Error('공격 덱과 방어 덱을 먼저 등록해주세요.');
    if(!practice&&resolve(s.attack)[3]&&!frigateUnlocked())throw Error('프리깃 연구를 먼저 개방해주세요.');
    if(!practice&&s.freeUsed>=5&&s.tickets<1)throw Error('무료 대전을 모두 사용했습니다. 상점에서 아레나 티켓을 구매해주세요.');
    const pv=practice?null:s.preview;const seed=pv?pv.seed:crypto.getRandomValues(new Uint32Array(1))[0],enemy=pv?pv.enemy:C.chooseOpponent([{id:SELF,score:s.score,deck:s.defenseSnapshot},...s.bots],SELF,C.random(seed));if(!enemy)throw Error('매칭 가능한 상대가 없습니다.');
    const result=C.simulate(fleet,enemy.deck,seed),match={id:(crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join("-")),enemy:{id:enemy.id,name:enemy.name,score:enemy.score,tier:enemy.tier},fleet,enemyDeck:enemy.deck,result,practice,scoreBefore:s.score,created:Date.now()};
    if(!practice){const ticketUsed=s.freeUsed>=5;if(ticketUsed)s.tickets--;else s.freeUsed++;match.ticketUsed=ticketUsed;s.pending=match;s.preview=null;commit(s);}enterArenaBattle(match);
  });}
  function enterArenaBattle(match){
    draft=null;playing=false;overlay?.remove();overlay=null;window.battleArenaMatch=match;
    window.notice?.('아레나 입장완료');window.show?.('battle');
    requestAnimationFrame(()=>window.prepareBattle?.({arenaMatch:match}));
  }
  window.cancelArenaBattle=async match=>{
    await lock(()=>{const s=state();if(s.pending?.id!==match?.id)return;s.pending=null;if(match.ticketUsed)s.tickets++;else s.freeUsed=Math.max(0,s.freeUsed-1);commit(s);});
    window.battleArenaMatch=null;window.show?.('home');window.openArena?.();
  };
  // 앱을 닫거나 새로고침한 실시간 대전은 패배로 처리한다(이어서 재생하지 않는다).
  function settleAbandonedMatch() {
    const s = read(KEY, null);
    if (!s?.pending) return;
    const match = s.pending;
    const change = C.delta(match.scoreBefore, match.enemy?.score || 0, false);
    s.score = Math.max(0, s.score + change);
    s.losses = (s.losses || 0) + 1;
    markBattleDay(s);
    const bot = (s.bots || []).find(item => item.id === match.enemy?.id);
    if (bot) bot.score = Math.max(0, bot.score - change);
    s.history = [{ id: match.id, date: Date.now(), enemy: match.enemy?.name || '', win: false, delta: change, score: s.score }, ...(s.history || [])].slice(0, 40);
    s.pending = null;
    localStorage.setItem(KEY, JSON.stringify(s));
  }
  window.completeArenaBattle=match=>lock(()=>{
    const s=state(),outcome=match.forfeited?false:match.result.win;
    if(s.pending?.id===match.id){const change=C.delta(match.scoreBefore,match.enemy.score,outcome);s.score=Math.max(0,s.score+change);markBattleDay(s);if(outcome===null)s.draws++;else if(outcome)s.wins++;else s.losses++;const bot=s.bots.find(b=>b.id===match.enemy.id);if(bot)bot.score=Math.max(0,bot.score-change);s.history.unshift({id:match.id,date:Date.now(),enemy:match.enemy.name,win:outcome,delta:change,score:s.score});s.history=s.history.slice(0,40);s.pending=null;const bonus=tierRewardGrant(s);commit(s);if(bonus.labels.length)window.notice?.(`등급 상승 축전이 도착했습니다 · ${bonus.labels.join(', ')}`);}
    const me=mine(s),history=s.history.find(item=>item.id===match.id);return {win:outcome,delta:history?.delta||0,score:s.score,rank:me.rank,tier:me.tier.label};
  });
  window.returnFromArenaBattle=()=>{window.battleArenaMatch=null;window.show?.('home');window.openArena?.();};
  function play(match){
    playing=true;draft=null;let index=0;
    shell('함대 교전',`<div class="arena-versus"><div class="arena-side-tag enemy-tag"><small>상대 함대</small><b>${esc(match.enemy.name)}</b><span>${esc(match.enemy.tier?.label||'ARENA')}</span></div><em>VS</em><div class="arena-side-tag friendly-tag"><small>${match.practice?'방어 테스트':'나의 공격 함대'}</small><b>${esc(playerName())}</b><span>${fmt(match.scoreBefore)}점</span></div></div><p class="arena-auto">AI 자동 전투 <i></i> <span data-clock>00:00</span></p><div class="arena-field"><div class="arena-centerline"><span>ENGAGEMENT ZONE</span></div><div class="arena-combat-team enemy">${match.enemyDeck.slice(0,3).map((s,i)=>unit(s,1,i)).join('')}</div><svg class="arena-trails" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg><div class="arena-combat-team friendly">${match.fleet.slice(0,3).map((s,i)=>unit(s,0,i)).join('')}</div><div class="arena-field-corner enemy-corner">ENEMY FLEET</div><div class="arena-field-corner friendly-corner">YOUR FLEET</div></div><div class="arena-combat-log" aria-live="polite"></div>`);
    const tick=()=>{const frame=match.result.frames[index++];if(!frame){clearInterval(playTimer);playTimer=0;finish(match);return;}
      overlay.querySelector('[data-clock]').textContent=`${Math.floor(frame.time/60).toString().padStart(2,'0')}:${Math.floor(frame.time%60).toString().padStart(2,'0')}`;
      frame.teams.forEach((team,side)=>team.forEach((u,i)=>{const card=overlay.querySelector(`[data-unit="${side}-${i}"]`);card.classList.toggle('destroyed',u.hp<=0);card.classList.toggle('stunned',!!u.stunned);card.querySelector('meter').value=u.hp/u.maxHp;card.querySelector('small').textContent=`${fmt(u.hp)} / ${fmt(u.maxHp)}`;card.querySelector('.arena-energy').style.width=u.energy+'%';}));
      const effects=match.result.events.filter(e=>e.time>frame.time-.5&&e.time<=frame.time);
      overlay.querySelector('.arena-trails').innerHTML=effects.filter(e=>e.slot<3).map(e=>`<line x1="${[50,18,82][e.slot]}" y1="${e.side?25:75}" x2="${[50,18,82][e.to]}" y2="${e.side?75:25}" stroke="${e.side?'#ff8b83':'#7cf5ff'}" stroke-width="${e.type==='core'?1.2:.35}"/>`).join('');
      const log=effects.filter(e=>e.type!=='shot').map(e=>`${e.side?'상대':'아군'} · ${esc(e.text)}`).join('<br>');if(log)overlay.querySelector('.arena-combat-log').innerHTML=log;
    };tick();playTimer=setInterval(tick,125);
  }
  const unit=(s,side,i)=>`<div class="arena-unit slot-${i}" data-unit="${side}-${i}" aria-label="${side?'상대':'아군'} ${esc(s.name)}"><b>${esc(s.name)}</b><img src="${esc(s.image)}" alt=""/><meter min="0" max="1" value="1"></meter><div class="arena-energy-track"><i class="arena-energy"></i></div><small>${fmt(s.hp)} / ${fmt(s.hp)}</small></div>`;
  async function finish(match){
    try{await lock(()=>{let change=0;const s=state();if(!match.practice&&s.pending?.id===match.id){change=C.delta(match.scoreBefore,match.enemy.score,match.result.win);s.score=Math.max(0,s.score+change);markBattleDay(s);if(match.result.win===null)s.draws++;else if(match.result.win)s.wins++;else s.losses++;const bot=s.bots.find(b=>b.id===match.enemy.id);if(bot)bot.score=Math.max(0,bot.score-change);s.history.unshift({id:match.id,date:Date.now(),enemy:match.enemy.name,win:match.result.win,delta:change,score:s.score});s.history=s.history.slice(0,40);s.pending=null;commit(s);}else if(!match.practice){change=s.history.find(h=>h.id===match.id)?.delta||0;}
      playing=false;const me=mine(s),label=match.result.win===null?'DRAW':match.result.win?'VICTORY':'DEFEAT';
      shell(label,`<div class="arena-result ${match.result.win?'victory':''}">${emblem(me.tier)}<h3>${match.practice?'방어 테스트 종료':me.tier.label}</h3><strong>${match.practice?'점수·횟수 변동 없음':`${change>0?'+':''}${change} POINTS`}</strong><p>${esc(match.enemy.name)} · ${Math.ceil(match.result.time)}초 교전</p><p>${match.practice?'':fmt(s.score)+'점 · '+me.rank+'위'}</p><button class="arena-save" data-result-back>아레나로 돌아가기</button></div>`);overlay.querySelector('[data-result-back]').onclick=render;overlay.querySelector('[data-arena-close]').onclick=render;
    });}catch(e){playing=false;note('결과 저장을 다시 시도해주세요. '+e.message);const b=document.createElement('button');b.textContent='결과 저장 재시도';b.onclick=()=>finish(match);overlay.querySelector('.arena-panel').append(b);}
  }
  function inbox(){const s=state();sub('아레나 보상함',`<div class="arena-inbox">${s.inbox.map(r=>`<div><b>${esc(r.label)}</b><p>${rewardText(r.amounts)}</p></div>`).join('')||'<p>도착한 보상이 없습니다. 첫 대전 후 다음 정산 시각부터 보상이 지급됩니다.</p>'}</div>${s.inbox.length?'<button class="arena-save" data-claim>모두 수령</button>':''}`);overlay.querySelector('[data-claim]')?.addEventListener('click',()=>act(()=>{const next=state(),resources={...(window.gameResources||read(RESOURCE,{}))};if(!next.inbox.length)return;const tickets=next.inbox.reduce((n,r)=>n+(Number(r.amounts?.ssrShipTicket)||0),0);next.inbox.forEach(r=>Object.entries(r.amounts).forEach(([k,v])=>{if(k!=='ssrShipTicket')resources[k]=(resources[k]||0)+v;}));next.inbox=[];commit(next,resources);if(tickets)window.grantExplorationLoot?.('ssrShipTicket',tickets);inbox();note('보상을 수령했습니다.');}));}
  function history(){sub('최근 전투',`<div class="arena-history">${state().history.map(h=>`<div><b>${h.win===null?'무승부':h.win?'승리':'패배'} · ${esc(h.enemy)}</b><span>${h.delta>0?'+':''}${h.delta}점</span><small>${new Date(h.date).toLocaleString('ko-KR')} · ${fmt(h.score)}점</small></div>`).join('')||'<p>아직 대전 기록이 없습니다.</p>'}</div>`);}
  function close(){if(playing)return;clearInterval(playTimer);overlay?.remove();overlay=null;draft=null;lastFocus?.focus();}
  // 아레나에 처음 들어올 때 한 번만 에바-9가 안내한다(저장소 표시로 기억한다).
  const ARENA_INTRO_KEY='arena-intro-v1';
  function showArenaIntro(){
    try{if(localStorage.getItem(ARENA_INTRO_KEY))return;}catch{return;}
    if(!overlay)return;
    const box=document.createElement('div');
    box.className='arena-eva-intro';
    box.setAttribute('role','dialog');
    box.style.cssText='position:absolute;left:12px;right:12px;bottom:12px;z-index:5;display:flex;gap:10px;align-items:flex-end;padding:12px;border-radius:12px;background:rgba(8,14,30,.94);border:1px solid rgba(120,200,255,.45);color:#e8f4ff;font-size:14px;line-height:1.5';
    const pages=['아레나 전투는 나노기술로 함선을 복제해 실제 전투와 같은 방식으로 흐르는 가상의 전투입니다.','역사적으로 유명한 해전을 기념해 만들어졌습니다.','이곳에서 실력을 겨루고 순위를 기록하시면 다양한 보상을 받으실 수 있습니다.','함선을 강화하고 아레나 전투에 참여하세요.'];
    let index=0;
    box.innerHTML='<img src="eva9-tutorial-bust.png" alt="EVA-9" style="width:64px;height:auto;flex:0 0 auto"/><div style="flex:1;min-width:0"><small style="letter-spacing:.08em;opacity:.7">SYNTHETIC OPERATOR · EVA-9</small><p data-arena-intro-text style="margin:4px 0 8px"></p><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><small data-arena-intro-count style="opacity:.7"></small><button type="button" data-arena-intro-next style="min-width:84px;min-height:36px;padding:6px 16px;border-radius:8px;border:1px solid rgba(160,220,255,.8);background:linear-gradient(180deg,#2c5fa8,#173a6e);color:#f2faff;font-family:inherit;font-size:14px;font-weight:600;letter-spacing:.02em;box-shadow:0 0 10px rgba(80,170,255,.35);cursor:pointer"></button></div></div>';
    const paint=()=>{box.querySelector('[data-arena-intro-text]').textContent=pages[index];box.querySelector('[data-arena-intro-count]').textContent=`${index+1} / ${pages.length}`;box.querySelector('[data-arena-intro-next]').textContent=index<pages.length-1?'다음':'확인';};
    box.querySelector('[data-arena-intro-next]').onclick=()=>{if(index<pages.length-1){index+=1;paint();return;}try{localStorage.setItem(ARENA_INTRO_KEY,'1');}catch{}box.remove();};
    paint();
    overlay.append(box);
  }
  window.openArena=()=>{if(overlay){overlay.focus();return;}lastFocus=document.activeElement;overlay=document.createElement('div');overlay.className='arena-overlay';document.body.append(overlay);overlay.onclick=e=>{if(e.target===overlay&&!playing)close();};overlay.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!playing){if(draft){draft=null;render();}else close();}}if(e.key==='Tab'){const items=[...overlay.querySelectorAll('button:not(:disabled),input')],first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};try{const s=state();if(s.pending)enterArenaBattle(s.pending);else{render();showArenaIntro();}overlay?.querySelector('button')?.focus();}catch(e){shell('ARENA','');note(e.message);}};
  window.getArenaTickets=()=>{try{return state().tickets;}catch{return 0;}};
  window.purchaseArenaTicket=()=>lock(()=>{const s=state(),resources={...(window.gameResources||read(RESOURCE,{}))};if((resources.thorium||0)<20)return {ok:false,message:'토륨이 부족합니다.'};resources.thorium-=20;s.tickets++;commit(s,resources);return {ok:true,message:'아레나 티켓 1장을 구매했습니다.'};});
  // 오늘 특가 아레나 티켓(골드 구매): 골드가 충분하면 티켓을 지급한다.
  window.purchaseArenaTicketGold=(count,price)=>lock(()=>{const s=state(),resources={...(window.gameResources||read(RESOURCE,{}))};if((resources.gold||0)<price)return {ok:false,message:'골드가 부족합니다.'};resources.gold-=price;s.tickets+=count;commit(s,resources);return {ok:true,message:`아레나 티켓 ${count}장을 구매했습니다.`};});
  window.addEventListener('storage',e=>{if(e.key===KEY&&overlay&&!playing&&!draft)render();});
  setInterval(()=>{if(overlay&&!playing&&!draft&&overlay.querySelector('[data-match]')){try{const saved=read(KEY,null);if(saved&&C.day(Date.now())>saved.freeDay)render();}catch{}}},1000);
  window.addEventListener('DOMContentLoaded',()=>{try{recover();settleAbandonedMatch();if(localStorage.getItem(KEY))state();}catch{}});
})();

