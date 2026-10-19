(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArenaCore=api;})(typeof window==='object'?window:globalThis,()=>{
  'use strict';
  const DAY=86400000,OFFSET=9*3600000;
  const GROUPS=[['Iron',3,'#8c9fa8'],['Bronze',3,'#cd8b55'],['Silver',3,'#c3d5e5'],['Gold',5,'#f7cb59'],['Diamond',5,'#63cfff'],['Platinum',5,'#d4bfff'],['HERO',5,'#ef80ef'],['LEGEND',1,'#ffcf82']];
  // 등급 1단계(예: 아이언 3→2→1)마다 필요한 점수. 히어로·레전드는 순위 규칙으로 정한다.
  const GROUP_POINTS={Iron:50,Bronze:50,Silver:100,Gold:150,Diamond:200,Platinum:250};
  const TIER_STARTS=[];
  {let accumulated=0;GROUPS.forEach(([group,count])=>{if(!GROUP_POINTS[group])return;for(let division=count;division>0;division--){TIER_STARTS.push(accumulated);accumulated+=GROUP_POINTS[group];}});}
  const indexForScore=score=>{const value=Math.max(0,Number(score)||0);let index=0;while(index<TIER_STARTS.length-1&&value>=TIER_STARTS[index+1])index+=1;return index;};
  const TIERS=[];
  GROUPS.forEach(([group,count,color])=>{for(let division=count;division>0;division--)TIERS.push({group,division,color,label:group==='LEGEND'?group:`${group} ${division}`,index:TIERS.length,min:TIERS.length<24?TIER_STARTS[TIERS.length]:group==='LEGEND'?6000:4800,cap:group==='HERO'?division:group==='LEGEND'?1:null});});
  const day=now=>Math.floor((now+OFFSET)/DAY);
  const isWednesday=d=>new Date(d*DAY).getUTCDay()===3;
  const clone=o=>JSON.parse(JSON.stringify(o));
  // 함종 상성(프리깃 제외): 중전함 < 전투순양함 < 구축함. 상위 함종은 하위 함종에 기본 공격 피해 +10%, 반대로 맞으면 -10%.
  const TYPE_BEATS={dreadnought:"destroyer",battlecruiser:"dreadnought",destroyer:"battlecruiser"},TYPE_EDGE=.1;
  // 상성은 연구 보너스와 같은 줄에 더해진다(+10% / -10%). 연구 공격력 보너스는 이미 u.dps에 들어 있으므로, 상성 배율은 (1+연구+상성)/(1+연구)로 적용한다.
  const typeBonus=(a,b)=>{if(TYPE_BEATS[a?.type]===b?.type)return TYPE_EDGE;if(TYPE_BEATS[b?.type]===a?.type)return -TYPE_EDGE;return 0;};
  const edgeScale=(u,target)=>{const r=Number(u.dev?.damage)||0;return (1+r+typeBonus(u,target))/(1+r);};
  const sorted=players=>[...players].sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
  // 히어로: 3600점부터, 200점 구간마다 HERO 5 → 4 → 3 → 2 → 1 (3600~3799 HERO 5 … 4400~4599 HERO 1).
  // 레전드: 4600점 이상. 순위 제한과 레전드 보유자 저장은 두지 않는다(추후 다시 정한다).
  const HERO_MIN=3600,LEGEND_MIN=4600;
  function standings(players){
    const rows=sorted(players);
    return rows.map((p,i)=>{
      let index=indexForScore(p.score);
      if(p.score>=LEGEND_MIN)index=29;
      else if(p.score>=HERO_MIN)index=Math.min(28,24+Math.floor((p.score-HERO_MIN)/200));
      return {...p,rank:i+1,tier:TIERS[index]};
    });
  }
  // 일일 보상 (등급 인덱스 구간): [시작, 끝, 골드, 토륨]. 히어로 5·4(24~25)와 3·2·1(26~28)은 구간을 나눴다.
  const DAILY_REWARDS=[[0,2,10000,200],[3,5,15000,220],[6,8,20000,250],[9,13,25000,280],[14,18,30000,300],[19,23,35000,350],[24,25,40000,400],[26,28,50000,500],[29,29,70000,800]];
  // 주간 보상 = 일일 보상의 2배. 상위 7명 SSR 교환권 추가는 정산에서 처리한다.
  // 시즌 보상 = 일일 보상의 3배 (다이아 이상). 플래티넘 이상 SSR 교환권 1장, 히어로 이상 증표 1개, 레전드 증표 3개.
  function rewards(index,weekly=false){
    const row=DAILY_REWARDS.find(([from,to])=>index>=from&&index<=to)||DAILY_REWARDS[0];
    const multiplier=weekly?2:1;
    return {gold:row[2]*multiplier,thorium:row[3]*multiplier,lionToken:0};
  }
  // 시즌 보상은 시즌 중 모든 주간 보상을 받은 경우에만 지급한다(seasonWeekMissed가 없어야 함).
  function seasonRewards(index,state={}){
    if(index<14||state.seasonWeekMissed)return null;
    const daily=rewards(index);
    return {gold:daily.gold*3,thorium:daily.thorium*3,ssrShipTicket:index>=19?1:0,lionToken:index===29?3:index>=24?1:0};
  }
  function delta(score,enemy,win){if(win===null)return 0;const expected=1/(1+10**((enemy-score)/400));return win?Math.max(15,Math.min(45,Math.round(60*(1-expected)))):-Math.max(10,Math.min(30,Math.round(40*expected)));}
  function random(seed){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
  // 전투력: 주력 3척의 체력×공격력 합. 프리깃은 제외한다.
  function deckPower(deck=[]){const power=deck.slice(0,3).reduce((sum,s)=>sum+(Number(s?.hp)||0)*(Number(s?.dps)||0),0);return power||1;}
  function chooseOpponent(players,selfId,rng=Math.random){
    const rows=standings(players),me=rows.find(p=>p.id===selfId),others=rows.filter(p=>p.id!==selfId&&p.deck?.slice(0,3).every(Boolean));
    if(!me||!others.length)return null;
    let pool=others.filter(p=>p.tier.label===me.tier.label);
    if(!pool.length)pool=others.filter(p=>p.tier.group===me.tier.group);
    if(!pool.length){const distance=Math.min(...others.map(p=>Math.abs(p.score-me.score)));pool=others.filter(p=>Math.abs(p.score-me.score)<=distance+100);}
    // 전투력 우선: 같은 등급(없으면 인접 등급)에서 전투력 차이가 15% 이내인 상대를 고른다. 없으면 전투력이 가장 가까운 3명 중에서 고른다.
    const myPower=deckPower(me.deck);
    const adjacent=others.filter(p=>Math.abs(p.tier.index-me.tier.index)<=1);
    // 같은 등급에 비슷한 상대가 없으면 인접 등급까지 넓혀서 찾는다.
    const near=p=>Math.abs(deckPower(p.deck)/myPower-1)<=.15;
    const sameTier=pool.filter(near),closeAdjacent=adjacent.filter(near);
    const close=sameTier.length?sameTier:closeAdjacent;
    const candidates=close.length?close:[...(adjacent.length?adjacent:pool)].sort((a,b)=>Math.abs(deckPower(a.deck)-myPower)-Math.abs(deckPower(b.deck)-myPower)).slice(0,3);
    const pick=candidates[Math.floor(rng()*candidates.length)];
    if(!pick)return null;
    // 전투력 차이가 ±20%를 넘으면, 가장 가까운 봇 덱의 공격력을 조정해 우리 전투력에 맞춘 상대를 즉석에서 만든다.
    if(Math.abs(deckPower(pick.deck)/myPower-1)<=.2)return pick;
    return dynamicOpponent(pick,myPower,rng);
  }
  // 즉석 상대: 봇 덱 구성과 강화 단계는 그대로 두고, 3척의 공격력(dps)만 목표 전투력에 맞춘다(전투력 = 체력 × 공격력 합).
  function dynamicOpponent(template,targetPower,rng=Math.random){
    const k=targetPower/deckPower(template.deck);
    return {...template,id:'dyn-'+Math.floor(rng()*1e9).toString(36),name:'유령함대',dynamic:true,
      deck:template.deck.map((ship,index)=>index<3&&ship?{...ship,dps:(Number(ship.dps)||0)*k}:ship)};
  }
  const level=(tree,key)=>Math.max(0,Math.floor(Number(tree?.[key])||0));
  const total=(tree,keys)=>keys.reduce((n,key)=>n+level(tree,key),0);
  function weaponFields(ship,attackType='normal'){
    if(ship?.type==='frigate')return ['frigate'];
    const explicit={cannon:'cannon',missile:'missile',laser:'laser',electric:'electric',piercing:'piercing',fighter:'carrier',carrier:'carrier'}[attackType];
    if(explicit)return [explicit];
    const weapon=String(ship?.profile?.[1]||'');
    const fields=weapon.split('·').map(part=>part.includes('관통')?'piercing':part.includes('함재기')?'carrier':part.includes('미사일')?'missile':part.includes('전기')?'electric':part.includes('레이저')?'laser':part.includes('함포')?'cannon':null).filter(Boolean);
    return [...new Set(fields.length?fields:['cannon'])];
  }
  function weaponBonus(ship,research={},attackType='normal'){
    const fields=weaponFields(ship,attackType);
    const bonuses=fields.map(field=>{
      const tree=research[field+'Tree']||{};
      if(field==='cannon')return {
        damage:(Number(research.cannonBonuses?.damage) || (2*total(tree,['firepower1','firepower2','firepower3'])+total(tree,['shell1','shell2','shell3','shellUpgrade1','shellUpgrade2','shellUpgrade3','charge1','charge2','charge3']))/10)/100,
        speed:(Number(research.cannonBonuses?.attackSpeed) || (2*total(tree,['firepower1','firepower2','firepower3'])+total(tree,['reload1','rapidFire','reload2','loadII','rapidII','reloadII','loadIII','rapidIII','reloadIII']))/10)/100
      };
      if(field==='carrier')return {damage:(level(tree,'firepower1')+level(tree,'carrierImprovement2'))*.002+total(tree,['weapon1','weapon2','weapon3','newWeapon1','newWeapon2','newWeapon3'])*.001,speed:0};
      if(field==='frigate')return {damage:0,speed:0};
      const roots=total(tree,['firepower1','firepower2','highEfficiency1','highEfficiency2'])*.002;
      const left=field==='missile'?['turret','vls','universalLauncher']:field==='electric'?['powerSupply1','powerSupply2','powerSupply3']:['converter','focusingDevice','controlDevice'];
      const right=field==='missile'?['warhead1','warhead2','warhead3']:field==='electric'?['coil1','coil2','coil3']:['outputBoost1','outputBoost2','outputBoost3'];
      return {damage:roots+total(tree,right)*.001,speed:roots+total(tree,left)*.001};
    });
    return {damage:bonuses.reduce((sum,bonus)=>sum+bonus.damage,0)/bonuses.length,speed:bonuses.reduce((sum,bonus)=>sum+bonus.speed,0)/bonuses.length};
  }
  function frigateBonus(ship,research={}){
    const tree=research.frigateTree||{};
    const key={'건설드론':'constructionDrone','과학 드론':'scienceDrone','과학드론':'scienceDrone','방패선':'shieldShip','리틀보이':'littleBoy','포작선':'bombardShip','레판토':'lepanto'}[ship?.name];
    const rate=(key==='littleBoy'||key==='bombardShip')?.01:.002;
    // 같은 이름의 I~V 단계 개발 횟수를 합산한다. 재사용시간: Charging 0.2초·II 0.3초·III 0.4초, 지속시간: Persistence·II 각 1%.
    const tiers=key?[key,key+'2',key+'3',key+'4',key+'5'].reduce((sum,node)=>sum+level(tree,node),0):0;
    return {power:key?1+tiers*rate:1,cooldown:Math.max(0,level(tree,'firepower2')*.2+level(tree,'frigateCharging2')*.3+level(tree,'frigateCharging3')*.4),timeReduction:Math.min(.9,level(tree,'frigateExpedition')*.01),durationBonus:Math.max(0,(level(tree,'frigatePersistence')+level(tree,'frigatePersistence2'))*.01),assist:!!key&&level(tree,key+'Assist')>=5,final:!!key&&level(tree,key+'Final')>=5,tree};
  }
  function development(ship,research={}){
    const weapon=weaponBonus(ship,research),carrier=research.carrierTree||{},defense=research.defenseTree||{};
    const fields=weaponFields(ship),levels=[...fields,ship?.type==='frigate'?'frigate':null,'defense'].filter(Boolean).reduce((sum,field)=>sum+Object.values(research[field+'Tree']||{}).reduce((n,value)=>n+Math.max(0,Number(value)||0),0),0);
    const mergedMaterial=level(defense,'materialDevelopment');
    return {damage:weapon.damage,speed:weapon.speed,hull:0,carrierHull:(level(carrier,'firepower1')+level(carrier,'carrierImprovement2'))*.002+total(carrier,['hull1','hull2','hull3','hull4','hull5','hull6'])*.001,carrierFighters:level(carrier,'firepower2')>=5?1:0,levels,shield:(total(defense,Array.from({length:6},(_,i)=>'durability'+(i+1)))+total(defense,Array.from({length:5},(_,i)=>'materialDurability'+(i+1)))+mergedMaterial)*.001,shieldDuration:(total(defense,Array.from({length:6},(_,i)=>'duration'+(i+1)))+total(defense,Array.from({length:5},(_,i)=>'materialDuration'+(i+1))))*.001,reduction:(total(defense,Array.from({length:6},(_,i)=>'reduction'+(i+1)))+total(defense,Array.from({length:5},(_,i)=>'materialReinforcement'+(i+1)))+mergedMaterial)*.001,frigate:clone(research.frigateTree||{})};
  }
  function stats(ship,base,research){
    const dev=development(ship,research),stars=ship.enhancementStars??ship.stars??0;
    return {...clone(ship),enhancementStars:stars,hp:Math.max(1,Math.round(base.hp||1000)),dps:Math.max(0,base.dps||0)*(1+dev.damage),skillStars:base.skillStars||stars,factor:base.factor||1,dev};
  }
  function simulate(attack,defense,seed){
    const rng=random(seed),teams=[attack,defense].map((deck,side)=>deck.slice(0,3).map((s,slot)=>({...clone(s),side,slot,maxHp:s.hp,hp:s.hp,shield:0,shieldUntil:0,fighterGuard:Math.max(0,300*(s.name==='우주항모'?6:s.name==='니미츠'?5:s.name==='콜로서스'?4:s.name==='배스천'?3:s.name==='해머'?2:0)*(Number(s.dev?.carrierHull)||0)),stun:0,energy:0,next:slot*.16,core:7+slot,nextSupport:10}))),events=[],frames=[];
    const frigates=[attack[3],defense[3]],frigateResearch=frigates.map(f=>f?frigateBonus(f,{frigateTree:f.dev.frigate}):{timeReduction:0}),supportAt=frigateResearch.map(bonus=>10*(1-bonus.timeReduction)),fatManCharges=[0,0];
    const alive=side=>teams[side].filter(u=>u.hp>0);
    const target=side=>{const a=alive(side);return a.find(u=>u.slot===0)&&rng()<.7?a.find(u=>u.slot===0):a[Math.floor(rng()*a.length)];};
    const damageTaken=[0,0];
    // 가시방패(배틀 엔진 규칙): 보호막이 활성인 동안 받는 피해를 공격자에게 그대로 되돌린다. 반사 피해는 다시 반사되지 않는다.
    const hurt=(u,n,src=null,reflect=true)=>{if(!u)return;const shieldFactor=1-Math.max(0,Math.min(.5,Number(u.dev?.reduction)||0)),absorbed=Math.min(n,u.shield/shieldFactor);u.shield=Math.max(0,u.shield-absorbed*shieldFactor);const escortAbsorbed=Math.min(n-absorbed,u.fighterGuard);u.fighterGuard-=escortAbsorbed;u.hp=Math.max(0,u.hp-(n-absorbed-escortAbsorbed));damageTaken[u.side]+=n;if(reflect&&src&&src.hp>0&&u.thornsUntil>time)hurt(src,n,null,false);};
    let time=0,nextFrame=0;
    for(;time<=120&&alive(0).length&&alive(1).length;time+=.05){
      const pending=[];
      teams.flat().forEach(u=>{
        if(u.hp<=0)return;if(u.shieldUntil<=time)u.shield=0;if(u.stun>time){u.next+=.05;u.core+=.05;return;}
        if(time>=u.next){u.next=time+1/(1+(Number(u.dev?.speed)||0));const enemy=target(1-u.side);if(enemy)pending.push(()=>{const dealt=u.dps*(.9+rng()*.2)*edgeScale(u,enemy);hurt(enemy,dealt,u);events.push({time,side:u.side,slot:u.slot,to:enemy.slot,type:'shot',weapon:u.profile?.[1]});});}
        u.energy=Math.min(100,100*(1-(u.core-time)/10));
        if(time>=u.core){u.core=time+10;u.energy=0;const enemy=target(1-u.side),skill=u.profile?.[4]||'';if(!enemy)return;
          pending.push(()=>{
            if(/수리|수복/.test(skill)){const friend=alive(u.side).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(friend)friend.hp=Math.min(friend.maxHp,friend.hp+friend.maxHp*.18*u.factor);}
            else if(/보호|방패|석화/.test(skill))alive(u.side).forEach(friend=>{friend.shield=friend.maxHp*.15*(1+u.dev.shield);friend.shieldUntil=time+5*(1+u.dev.shieldDuration);});
            else if(/그물/.test(skill)){if(!(enemy.statusImmuneUntil>time))enemy.stun=time+3;hurt(enemy,u.dps*2*edgeScale(u,enemy),u);}
            else {const multi=/광역|난사|초신성|번개|포화|다련장/.test(skill);(multi?alive(1-u.side):[enemy]).forEach(v=>hurt(v,u.dps*(multi?1.8:4)*(u.skillStars>=5?1.2:1)*edgeScale(u,v),u));if(/기절/.test(skill)&&!(enemy.statusImmuneUntil>time))enemy.stun=time+1.5;}
            events.push({time,side:u.side,slot:u.slot,to:enemy.slot,type:'core',text:skill.split(' · ')[0]});
          });
        }
      });
      [0,1].forEach(side=>{const f=frigates[side];if(!f||time<supportAt[side]||!alive(side).length)return;const frigate=frigateBonus(f,{frigateTree:f.dev.frigate});const fatMan=f.name==='리틀보이'&&frigate.final;fatManCharges[side]=fatMan?(fatManCharges[side]>0?fatManCharges[side]:2)-1:0;supportAt[side]=time+(fatMan&&fatManCharges[side]>0?3:Math.max(.1,(20-frigate.cooldown)*(1-frigate.timeReduction)));pending.push(()=>{
        const friends=alive(side),foes=alive(1-side),boost=f.factor*frigate.power;
        if(/건설|과학/.test(f.name))friends.forEach(u=>u.hp=Math.min(u.maxHp,u.hp+u.maxHp*.08*boost*(/건설/.test(f.name)&&frigate.final?2:1)*(/과학/.test(f.name)?1+(frigate.assist?.2:0)+(frigate.final?.2:0):1)));if(/건설/.test(f.name)&&frigate.assist)friends.forEach(u=>{u.stun=0;u.statusImmuneUntil=time+3;});
        else if(/방패/.test(f.name))friends.forEach(u=>{u.shield=u.maxHp*.25*f.factor*(1+u.dev.shield);u.shieldUntil=time+5*frigate.power*(1+u.dev.shieldDuration)*(1+frigate.durationBonus)*(frigate.assist?1.3:1);if(frigate.final)u.thornsUntil=u.shieldUntil;});
        else foes.forEach(u=>hurt(u,(f.name==='리틀보이'?1000*(frigate.assist?2:1):f.name==='포작선'?500*(frigate.assist?5/3:1):350*(f.name==='레판토'?(frigate.assist?1.5:1)*(frigate.final?1.69:1):1))*boost));
        events.push({time,side,slot:3,to:0,type:'support',text:f.name});
      });});
      pending.forEach(fn=>fn());
      if(time+.001>=nextFrame){frames.push({time,teams:teams.map(team=>team.map(u=>({hp:u.hp,maxHp:u.maxHp,shield:u.shield,energy:u.energy,stunned:u.stun>time})))});nextFrame+=.5;}
    }
    const ratio=teams.map(team=>team.reduce((n,u)=>n+u.hp/u.maxHp,0));
    let win=ratio[0]===ratio[1]?null:ratio[0]>ratio[1];
    // 무승부 타이브레이커: 남은 체력 비율이 같으면(예: 양측 동시 전멸) 받은 피해가 적은 쪽이 승리한다.
    if(win===null&&damageTaken[0]!==damageTaken[1])win=damageTaken[0]<damageTaken[1];
    frames.push({time,teams:teams.map(team=>team.map(u=>({hp:u.hp,maxHp:u.maxHp,shield:u.shield,energy:u.energy})))});
    return {win,time,frames,events,seed};
  }
  return {typeBonus,TIERS,TIER_STARTS,indexForScore,GROUPS,DAY,OFFSET,day,isWednesday,standings,rewards,seasonRewards,delta,random,chooseOpponent,weaponFields,weaponBonus,frigateBonus,development,stats,simulate,clone};
});
