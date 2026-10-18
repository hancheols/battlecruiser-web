// 몬스터 사망 효과.
// window.playMonsterDeath({layer, x, y, size, tier, image, color, goo, shakeTarget})
//   layer: 효과를 붙일 요소(전투 효과 층), x·y: 위치(CSS 값, 예 '42%'), size: 몬스터 크기(px)
//   tier: 'small' | 'large' | 'boss', image: 몬스터 그림 경로, color: 섬광·파편 색, goo: 체액 색
//   shakeTarget: 보스 처치 때 흔들 요소(전투 화면)
// 돌려주는 값: 효과가 끝나기까지 걸리는 시간(ms)
(()=>{
  'use strict';
  const rand=(min,max)=>min+Math.random()*(max-min);
  // 한꺼번에 너무 많은 몬스터가 죽으면 파편 수를 줄여 휴대폰에서 끊기지 않게 합니다.
  let recentDeaths=0;
  const load=()=>{recentDeaths+=1;setTimeout(()=>{recentDeaths=Math.max(0,recentDeaths-1);},400);return recentDeaths;};
  const particles=(cls,count,{dist:[dMin,dMax],size:[zMin,zMax],time:[tMin,tMax]})=>Array.from({length:count},(_,i)=>{
    const angle=(i/count)*360+rand(-18,18);
    return `<i class="${cls}" style="--a:${angle.toFixed(0)}deg;--d:${rand(dMin,dMax).toFixed(0)}px;--z:${rand(zMin,zMax).toFixed(1)}px;--r:${rand(-260,260).toFixed(0)}deg;--t:${rand(tMin,tMax).toFixed(2)}s"></i>`;
  }).join('');

  window.playMonsterDeath=({layer,x,y,size=48,tier='small',image='',color='#ff9a3c',goo='#b6ff5a',shakeTarget=null}={})=>{
    if(!layer)return 0;
    const fx=document.createElement('div');
    fx.className=`mdx mdx-${tier}`;
    fx.style.left=x;fx.style.top=y;
    fx.style.setProperty('--s',`${size}px`);fx.style.setProperty('--c',color);fx.style.setProperty('--goo',goo);
    if(image)fx.style.setProperty('--img',`url("${image}")`);
    const busy=load()>6;
    let html='',duration=600;
    if(tier==='small'){
      // 피격 번쩍임 → 몸체가 좌우로 갈라짐 → 파편·체액이 튐 → 충격파 링
      html=`${image?'<i class="mdx-half l"></i><i class="mdx-half r"></i>':''}<i class="mdx-core"></i><i class="mdx-ring"></i>`
        +particles('mdx-shard',busy?3:7,{dist:[size*.7,size*1.4],size:[6,10],time:[.45,.6]})
        +(busy?'':particles('mdx-goo',6,{dist:[size*.4,size*.9],size:[4,8],time:[.38,.5]}));
      duration=640;
    }else if(tier==='large'){
      // 몸체가 달아오르며 무너짐 → 실사 화염 + 2차 폭발 2번 → 파편·잔불 → 연기
      const off=()=>`${rand(-.35,.35)*size}px`;
      html=`${image?'<i class="mdx-body" style="--t:.32s"></i>':''}<i class="mdx-core"></i><i class="mdx-ring"></i><i class="mdx-ring late"></i>`
        +`<i class="mdx-fire" style="--k:2;--t:.85s;--delay:.06s"></i>`
        +`<i class="mdx-fire alt" style="--k:1;--t:.6s;--delay:.2s;translate:${off()} ${off()}"></i>`
        +`<i class="mdx-fire" style="--k:.9;--t:.6s;--delay:.34s;translate:${off()} ${off()}"></i>`
        +particles('mdx-shard',busy?5:10,{dist:[size*.7,size*1.5],size:[5,9],time:[.5,.7]})
        +particles('mdx-ember',busy?4:9,{dist:[size*.5,size*1.3],size:[3,3],time:[.6,.9]})
        +'<i class="mdx-smoke" style="--t:1s;--delay:.2s"></i>';
      duration=1150;
    }else{
      // 보스: 몸체 곳곳에서 연쇄 폭발하며 떨림 → 전장 섬광·흔들림 → 거대 화염·충격파·파편 → 연기
      const chain=Array.from({length:6},(_,i)=>`<i class="mdx-fire${i%2?' alt':''}" style="--k:.55;--t:.45s;--delay:${(i*.12).toFixed(2)}s;translate:${rand(-.38,.38)*size}px ${rand(-.38,.38)*size}px"></i>`).join('');
      html=`${image?'<i class="mdx-body boss" style="--t:.85s"></i>':''}${chain}`
        +`<i class="mdx-fire" style="--k:2.4;--t:1s;--delay:.82s"></i><i class="mdx-fire alt" style="--k:1.5;--t:.8s;--delay:.95s"></i>`
        +`<i class="mdx-ring" style="animation-delay:.82s;opacity:0;animation-duration:.7s"></i><i class="mdx-ring late" style="animation-delay:.95s;animation-duration:.8s"></i>`
        +particles('mdx-shard',16,{dist:[size*.8,size*1.9],size:[6,12],time:[.7,1]}).replace(/--t:/g,'animation-delay:.82s;--t:')
        +particles('mdx-ember',14,{dist:[size*.6,size*1.6],size:[3,3],time:[.8,1.2]}).replace(/--t:/g,'animation-delay:.85s;--t:')
        +'<i class="mdx-smoke" style="--t:1.4s;--delay:1s"></i>';
      duration=2300;
      setTimeout(()=>{
        if(!fx.isConnected)return;
        const flash=document.createElement('div');flash.className='mdx-screen-flash';
        flash.style.setProperty('--fx',x);flash.style.setProperty('--fy',y);
        layer.append(flash);setTimeout(()=>flash.remove(),600);
        if(shakeTarget){shakeTarget.classList.remove('mdx-shake');void shakeTarget.offsetWidth;shakeTarget.classList.add('mdx-shake');setTimeout(()=>shakeTarget.classList.remove('mdx-shake'),520);}
      },820);
    }
    // 파편·잔불은 처음엔 보이지 않다가 지정 시간에 튀어나오도록 시작 전 투명하게 둡니다.
    fx.innerHTML=html;
    fx.querySelectorAll('.mdx-shard,.mdx-ember').forEach(el=>{if(el.style.animationDelay)el.style.opacity='0';});
    layer.append(fx);
    setTimeout(()=>fx.remove(),duration);
    return duration;
  };
})();
