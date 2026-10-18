window.addEventListener('DOMContentLoaded', () => {
  const home = document.getElementById('home');
  if (!home || document.getElementById('ship-detail')) return;
  home.insertAdjacentHTML('afterend', `
    <section id="ship-detail" class="screen ship-detail-screen">
      <button class="detail-back" onclick="show('home')">← 함교</button>
      <div class="detail-heading"><span>FLAGSHIP DOSSIER</span><h1>제1 기함 <em>(DreadNought)</em></h1></div>
      <div class="ship-portrait"><div class="portrait-grid"></div><img src="arcadia-galaxy-art.png" alt="제1 기함" /></div>
      <div class="ship-status"><b>전투력 1,280</b><span>READY FOR DEPLOYMENT</span></div>
      <div class="ship-specs">
        <div><span>함종</span><b>DreadNought</b></div>
        <div><span>내구도</span><b>6,800</b></div>
        <div><span>주무장</span><b>이온 레일캐논 × 3</b></div>
        <div><span>보조무장</span><b>유도 미사일 × 12</b></div>
        <div><span>방어 체계</span><b>중장갑 방벽</b></div>
        <div><span>추진 계통</span><b>이중 핵융합 엔진</b></div>
      </div>
    </section>`);
  const platform = document.querySelector('.flagship-platform');
  if (platform) { platform.setAttribute('role', 'button'); platform.tabIndex = 0; platform.addEventListener('click', () => show('ship-detail')); }
});
