// SSR·L급 함선 별승급과 SSR→L 돌파 연출.
// window.playShipAscension(options) 를 부르면 화면 전체 연출을 띄우고, 닫힐 때 끝나는 Promise 를 돌려줍니다.
// options: {mode:'star'|'breakthrough', name, image, rarity, toRarity, fromStars, toStars, maxStars, rate, stats:[{label,from,to}]}
(()=>{
  'use strict';
  const fmt=value=>Math.round(Number(value)||0).toLocaleString('ko-KR');
  const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const playSound=(src,volume)=>{const audio=window.createGameAudio?.(src);if(!audio)return;audio.volume=volume;audio.play().catch(()=>{});};
  // 충전 단계에서 함선으로 빨려 드는 입자와, 폭발 순간 바깥으로 튀는 불꽃을 무작위 배치로 만듭니다.
  const particles=(count,className,maxDelay)=>Array.from({length:count},(_,index)=>{
    const angle=(index/count)*360+Math.random()*14,distance=150+Math.random()*130,size=3+Math.random()*4,delay=Math.random()*maxDelay;
    return `<i class="${className}" style="--a:${angle.toFixed(1)}deg;--r:${distance.toFixed(0)}px;--s:${size.toFixed(1)}px;--d:${delay.toFixed(2)}s;--h:${Math.round(Math.random()*360)}"></i>`;
  }).join('');
  const starRow=(filled,total,newIndex)=>Array.from({length:total},(_,index)=>`<span class="ascend-star${index<filled?' on':''}${index===newIndex?' new':''}" style="--i:${index}">★</span>`).join('');

  window.playShipAscension=options=>new Promise(resolve=>{
    const breakthrough=options.mode==='breakthrough';
    const rarity=breakthrough?options.toRarity:options.rarity;
    const total=Math.max(1,Number(options.maxStars)||5);
    const toStars=Math.min(total,Number(options.toStars)||0);
    const overlay=document.createElement('div');
    overlay.className=`ascend-overlay ${breakthrough?'ascend-break':'ascend-star-up'} rarity-${rarity}`;
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label',breakthrough?`${options.name} ${rarity}급 돌파`:`${options.name} ${toStars}성 강화`);
    const stats=(options.stats||[]).filter(stat=>stat&&stat.from!==null&&stat.to!==null&&stat.from!==undefined);
    overlay.innerHTML=`
      <div class="ascend-bg"></div>
      <div class="ascend-rays" aria-hidden="true"></div>
      <div class="ascend-beams" aria-hidden="true">${breakthrough?Array.from({length:7},(_,index)=>`<i style="--a:${index*51+8}deg;--d:${(index*.05).toFixed(2)}s"></i>`).join(''):''}</div>
      <div class="ascend-charge" aria-hidden="true">${particles(breakthrough?34:22,'ascend-dot',breakthrough?1.1:.5)}</div>
      <div class="ascend-burst" aria-hidden="true">${particles(breakthrough?30:20,'ascend-spark',.08)}</div>
      <div class="ascend-ring" aria-hidden="true"></div><div class="ascend-ring second" aria-hidden="true"></div>
      <div class="ascend-flash" aria-hidden="true"></div>
      <div class="ascend-stage">
        <div class="ascend-ship"><img src="${options.image}" alt="${options.name}"/></div>
        ${breakthrough
          ?`<div class="ascend-badges"><span class="ascend-badge old">${options.rarity}</span><span class="ascend-badge-shard left" aria-hidden="true">${options.rarity}</span><span class="ascend-badge-shard right" aria-hidden="true">${options.rarity}</span><span class="ascend-badge new">${rarity}</span></div>`
          :`<div class="ascend-stars" aria-label="${toStars}성">${starRow(toStars,total,toStars-1)}</div>`}
        <strong class="ascend-title">${breakthrough?`${rarity}급 돌파!`:`★${toStars} 강화 성공`}</strong>
        <b class="ascend-name">${options.name}</b>
        <div class="ascend-stats">${breakthrough
          ?'<span class="ascend-bonus">돌파 보너스 <em>모든 능력치 +50%</em></span>'
          :stats.map((stat,index)=>`<span><small>${stat.label}</small><b data-from="${stat.from}" data-to="${stat.to}">${fmt(stat.from)}</b><em>▲ ${fmt(stat.to-stat.from)}</em></span>`).join('')}</div>
        <small class="ascend-hint">화면을 누르면 닫힙니다</small>
      </div>`;
    document.body.append(overlay);

    const duration=breakthrough?4000:2000;
    const timers=[];let finished=false,counting=0;
    // 능력치 숫자가 이전 값에서 새 값으로 올라가는 카운트업입니다.
    const countUp=()=>{
      const cells=[...overlay.querySelectorAll('.ascend-stats b[data-to]')],start=performance.now(),span=500;
      const tick=now=>{const t=Math.min(1,(now-start)/span),ease=1-Math.pow(1-t,3);cells.forEach(cell=>{const from=Number(cell.dataset.from),to=Number(cell.dataset.to);cell.textContent=fmt(from+(to-from)*ease);});if(t<1)counting=requestAnimationFrame(tick);};
      counting=requestAnimationFrame(tick);
    };
    const finalize=()=>{
      if(finished)return;finished=true;
      timers.forEach(clearTimeout);cancelAnimationFrame(counting);
      overlay.querySelectorAll('.ascend-stats b[data-to]').forEach(cell=>{cell.textContent=fmt(cell.dataset.to);});
      overlay.classList.add('is-final');
    };
    const close=()=>{overlay.classList.add('is-closing');setTimeout(()=>{overlay.remove();resolve();},220);};
    // 연출 중 탭하면 결과 화면으로 건너뛰고, 결과 화면에서 탭하면 닫습니다.
    overlay.addEventListener('click',()=>{if(!finished)finalize();else close();});
    overlay.addEventListener('keydown',event=>{if(event.key==='Escape'||event.key==='Enter'||event.key===' '){event.preventDefault();if(!finished)finalize();else close();}});
    overlay.tabIndex=-1;overlay.focus({preventScroll:true});

    if(reducedMotion()){finalize();return;}
    requestAnimationFrame(()=>overlay.classList.add('is-playing'));
    const burstAt=breakthrough?1800:700;
    timers.push(setTimeout(()=>{overlay.classList.add('is-burst');playSound(breakthrough?'sound/Legend_get.ogg':'sound/get.wav',breakthrough?.75:.6);},burstAt));
    if(!breakthrough)timers.push(setTimeout(countUp,1450));
    timers.push(setTimeout(finalize,duration));
  });
})();
