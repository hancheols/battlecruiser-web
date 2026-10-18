window.addEventListener('DOMContentLoaded', () => {
  const deck = document.getElementById('command-deck');
  const planet = deck?.querySelector('.flagship-platform');
  if (!deck || !planet) return;
  const scene = document.createElement('div');
  scene.className = 'bridge-environment';
  scene.innerHTML = `<div class="bridge-scene">
    <img class="bridge-interior" src="bridge-hologram-interior-v3.png" alt="원형 홀로그램 발판이 있는 함교"/>
    <div class="bridge-window-flashes" aria-hidden="true">
      <i style="--x:36%;--y:19%;--period:2.4s;--delay:-.8s"></i>
      <i style="--x:58%;--y:22%;--period:2.8s;--delay:-1.9s"></i>
      <i style="--x:45%;--y:29%;--period:2.2s;--delay:-1.4s"></i>
      <i style="--x:65%;--y:27%;--period:2.6s;--delay:-.3s"></i>
    </div>
    <div class="bridge-crew-observer" aria-hidden="true"><i></i><img class="crew-pose active" src="crew-observer.png" alt="" /><img class="crew-pose" src="crew-observer-alt.png" alt="" /></div>
    <div class="bridge-holo-volume" aria-hidden="true">
      <div class="holo-projection-beam"></div><div class="holo-floor-light"></div>
      <div class="holo-map-plane">
        <div class="holo-grid"></div>
        <svg class="holo-gate-route" viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="50" rx="38" ry="30"/><line x1="50" y1="50" x2="50" y2="20"/></svg>
        <div class="holo-gate-nodes"></div><i class="holo-route-center"></i>
      </div>
      <div class="holo-region-object"><img class="holo-region-image" src="holo-mars-map.png" alt="화성"/></div>
      <img class="holo-satellite satellite-near" src="hologram-sun-decoration.png" alt=""/>
      <div class="holo-scan-line"></div>
    </div>
  </div><div class="bridge-vignette"></div>
  <div class="bridge-map-label"><small>TACTICAL STAR CHART</small><b></b><span>현재 작전지역</span></div>`;
  deck.prepend(scene);
  planet.hidden = true;
  planet.classList.add('bridge-operation-source');
  const caption = deck.querySelector('.deck-caption');
  const regionImages = {
    mars: ['holo-mars-map.png', '화성', 10],
    titan: ['holo-titan-map.png', '타이탄', 20],
    oort: ['holo-oort-map.png', '오르트구름', 20],
    'magenta-near': ['magenta-hologram-planet.png', '마젠타 행성', 10],
    'magenta-tas': ['magenta-hologram-planet.png', '마젠타 행성', 10],
    'magenta-atmosphere': ['magenta-hologram-planet.png', '마젠타 행성', 10]
  };
  const romanToNumber = numeral => [...numeral].reduce((total, letter, index, letters) => {
    const value = { I: 1, V: 5, X: 10 }[letter] || 0;
    return total + (value < ({ I: 1, V: 5, X: 10 }[letters[index + 1]] || 0) ? -value : value);
  }, 0);
  const gateNodes = scene.querySelector('.holo-gate-nodes');
  const activeRoute = scene.querySelector('.holo-gate-route line');
  const sync = () => {
    const operation = planet.dataset.operation || 'mars';
    const region = operation.includes(':') ? operation.slice(operation.indexOf(':') + 1) : operation;
    const chapterMap = operation.startsWith('chapter2:')
      ? ['magenta-hologram-planet.png', '마젠타 행성 작전지도', 10]
      : operation.startsWith('chapter3:')
        ? ['kepler-planet-map.png', '케플러 행성 작전지도', 10]
        : operation.startsWith('chapter4:')
          ? ['tapao-thong-planet-map.png', '타파오 통 행성 작전지도', 10]
          : operation.startsWith('chapter5:')
            ? ['super-neptune-planet-map.png', '수퍼 넵튠 작전지도', 10]
            : null;
    const [source, imageName, gateCount] = chapterMap || regionImages[region] || ['hologram-sun-decoration.png', '태양계', 10];
    const image = scene.querySelector('.holo-region-image');
    if (image.getAttribute('src') !== source) image.setAttribute('src', source);
    image.alt = imageName;
    scene.querySelector('.bridge-scene').dataset.region = region;

    const location = caption?.querySelector('b')?.textContent || '화성 · I 관문';
    const gateMatch = location.match(/([IVX]+)\s*관문/);
    const currentGate = gateMatch ? romanToNumber(gateMatch[1]) : 0;
    const firstGate = currentGate > 10 ? 11 : 1;
    const visibleGates = Math.min(10, gateCount - firstGate + 1);
    const nodes = [];
    for (let index = 0; index < visibleGates; index += 1) {
      const gate = firstGate + index;
      const angle = -Math.PI / 2 + index * Math.PI * 2 / visibleGates;
      const x = 50 + Math.cos(angle) * 38;
      const y = 50 + Math.sin(angle) * 30;
      const node = document.createElement('i');
      node.className = `holo-gate-node${gate < currentGate || !currentGate ? ' completed' : ''}${gate === currentGate ? ' current' : ''}`;
      node.style.left = `${x}%`;
      node.style.top = `${y}%`;
      node.title = `${gate}관문`;
      nodes.push(node);
      if (gate === currentGate) {
        activeRoute.setAttribute('x2', x.toFixed(2));
        activeRoute.setAttribute('y2', y.toFixed(2));
      }
    }
    gateNodes.replaceChildren(...nodes);
    scene.querySelector('.holo-gate-route').classList.toggle('all-cleared', !currentGate);
    scene.querySelector('.bridge-map-label b').textContent = location;
    scene.querySelector('.bridge-map-label span').textContent = currentGate
      ? `현재 관문 ${String(currentGate).padStart(2, '0')} / ${String(gateCount).padStart(2, '0')}`
      : '모든 관문 클리어';
  };
  const observer = new MutationObserver(sync);
  observer.observe(planet, {attributes:true,attributeFilter:['data-operation'],childList:true});
  if (caption) observer.observe(caption, {childList:true,subtree:true,characterData:true});
  sync();

  const crewObserver = scene.querySelector('.bridge-crew-observer');
  const crewPoses = [...crewObserver.querySelectorAll('.crew-pose')];
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let activePose = 0;
    const changePose = () => {
      const nextPose = (activePose + 1) % crewPoses.length;
      crewPoses[nextPose].classList.add('active');
      crewPoses[activePose].classList.remove('active');
      activePose = nextPose;
      window.setTimeout(changePose, 2600 + Math.random() * 4300);
    };
    window.setTimeout(changePose, 3200 + Math.random() * 3600);
  }
});
