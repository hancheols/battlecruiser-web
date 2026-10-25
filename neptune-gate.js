(()=>{
  'use strict';
  // 챕터 5 넵튠 게이트 1관문 출격 시나리오: 제독 대화 → [전투 개시] → 함대가 게이트로 진입 → 백색섬광 → 전투.
  const PROFILE_KEY='starfleet-commander-profile-v1';
  const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
  const captain=()=>{const p=read(PROFILE_KEY)||{};return {name:[p.character,p.lastName].filter(Boolean).join(' ')||'함장',image:p.character==='Donna'?'captain-donna-scenario-bust.png':'captain-jake-scenario-bust.png'};};
  const LINES=['준비는 다 된건가?','저 게이트로 들어가면 한동안 나올 수 없을거야.','그만한 각오가 되어있다면 시작하게.'];
  const FLEET=['ironfist-battle-topview.png','lionheart-battle-topview.png','fury-battle-topview.png','magellan-battle-topview.png','ironfist-battle-topview.png'];
  let layer=null,busy=false;
  const reduce=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function close(){layer?.remove();layer=null;busy=false;}

  function warp(onBattle){
    const stage=layer.querySelector('.nep-stage'),portal=stage.querySelector('.nep-portal'),flash=layer.querySelector('.nep-flash');
    layer.querySelector('.mars-scenario').hidden=true;
    const rect=portal.getBoundingClientRect(),hx=rect.left+rect.width*.516,hy=rect.top+rect.height*.297;
    portal.classList.add('is-open');
    const W=window.innerWidth,H=window.innerHeight,spots=[[.5,.78],[.3,.86],[.7,.86],[.14,.95],[.86,.95]];
    const ships=FLEET.map((src,i)=>{
      const el=document.createElement('img');el.src=src;el.alt='';el.className='nep-ship';
      const w=i===1?64:46;el.style.width=w+'px';el.style.left=(spots[i][0]*W-w/2)+'px';el.style.top=(spots[i][1]*H)+'px';
      stage.append(el);return {el,w,x:spots[i][0]*W-w/2,y:spots[i][1]*H};
    });
    const dur=reduce()?900:3200;
    ships.forEach((s,i)=>{
      const dx=hx-(s.x+s.w/2),dy=hy-s.y-s.w*1.4;
      s.el.animate([
        {transform:'translate(0,0) scale(1)',opacity:1,offset:0},
        {transform:`translate(${dx*.18}px,${dy*.28}px) scale(.92)`,opacity:1,offset:.3},
        {transform:`translate(${dx}px,${dy}px) scale(.18)`,opacity:.9,offset:.88},
        {transform:`translate(${dx}px,${dy}px) scale(.05)`,opacity:0,offset:1}
      ],{duration:dur-i*120,delay:i*160,easing:'cubic-bezier(.45,.05,.55,.95)',fill:'forwards'});
    });
    const flashAt=dur+400;
    setTimeout(()=>{flash.classList.add('on');},flashAt);
    setTimeout(()=>{
      window.__neptuneShout=true;
      try{onBattle?.();}catch(error){console.error(error);}
      // 전투 화면이 준비되는 동안 섬광을 유지했다가 서서히 걷는다.
      setTimeout(()=>{flash.classList.add('off');},650);
      setTimeout(close,1700);
    },flashAt+700);
  }

  window.playNeptuneGateIntro=onBattle=>{
    if(busy)return;busy=true;
    layer=document.createElement('div');layer.className='nep-gate-layer';
    layer.innerHTML='<div class="nep-stage"><i class="nep-stars"></i><div class="nep-portal"><img src="tapao-gate-portal-v2.webp" alt=""/><i></i></div></div>'
      +'<div class="mars-scenario nep-scenario" data-speaker="han" role="dialog" aria-modal="true" aria-label="넵튠 게이트 출격"><div class="mars-scenario-card"><img class="mars-scenario-portrait" src="han-seong-min-bust.png" alt=""/><div class="mars-scenario-dialogue"><small class="mars-scenario-kicker">SUPER NEPTUNE · NEPTUNE GATE / DEPARTURE</small><strong class="mars-scenario-name">한성민 제독</strong><p class="mars-scenario-text"></p><div class="mars-scenario-actions"><button type="button" class="mars-scenario-next nep-back" hidden>돌아가기</button><button type="button" class="mars-scenario-next nep-next">다음</button></div></div></div></div>'
      +'<div class="nep-flash"></div>';
    document.body.append(layer);
    const text=layer.querySelector('.mars-scenario-text'),next=layer.querySelector('.nep-next'),back=layer.querySelector('.nep-back');
    let index=0;
    const paint=()=>{
      text.textContent=LINES[index];
      const last=index===LINES.length-1;
      next.textContent=last?'전투 개시':'다음';back.hidden=!last;
    };
    next.onclick=()=>{
      if(index<LINES.length-1){index++;paint();return;}
      next.disabled=true;back.hidden=true;warp(onBattle);
    };
    back.onclick=close;
    paint();
  };

  // 전투가 시작되면 함장이 외친다.
  window.addEventListener('tutorial-battle-started',event=>{
    const op=event.detail?.operation;
    if(!window.__neptuneShout||Number(op?.chapter)!==5||op?.region!=='neptune-gate'||Number(op?.gate)!==1)return;
    window.__neptuneShout=false;
    const c=captain(),toast=document.createElement('div');
    toast.className='scenario-battle-toast';toast.setAttribute('role','status');
    toast.innerHTML=`<img src="${c.image}" alt=""/><div><b></b><p></p></div>`;
    toast.querySelector('b').textContent=c.name;toast.querySelector('p').textContent='지금이다! 포문을 열고 발포!';
    (document.querySelector('#battle .battle-viewport')||document.body).append(toast);
    setTimeout(()=>toast.classList.add('is-leaving'),3200);setTimeout(()=>toast.remove(),3700);
  });
  // 전투 화면이 열릴 때 자동으로 전투를 개시한다.
  window.addEventListener('game-screen-changed',event=>{
    if(!window.__neptuneShout||event.detail?.screen!=='battle')return;
    setTimeout(()=>{const start=document.getElementById('battle-start');if(start&&!start.hidden)start.click();},500);
  });
})();
