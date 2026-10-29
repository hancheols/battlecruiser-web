// 만 14세 이상 확인: 처음 실행할 때 버튼으로 확인을 받는다. 확인 전에는 게임 화면을 쓰거나 서버에 계정을 만들 수 없다(cloud-sync.js 가 'age-confirmed' 를 기다린다).
// 확인 결과는 이 기기(localStorage)에만 저장하고 서버로 보내지 않는다. "미만"을 고른 경우에는 아무 것도 저장하지 않는다.
(() => {
  'use strict';
  const KEY = 'starfleet-age-confirmed-v1';
  const readConfirmed = () => { try { return !!JSON.parse(localStorage.getItem(KEY) || 'null')?.confirmedAt; } catch (_) { return false; } };
  window.isAgeConfirmed = readConfirmed;
  if (readConfirmed()) return;

  const style = document.createElement('style');
  style.textContent = `
    dialog.age-gate{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;border:0;display:grid;place-items:center;padding:20px;overflow:auto;background:radial-gradient(ellipse at 50% 30%,#10243a 0,#050b14 70%);color:#e6f2fa;font-family:var(--font-body,"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif)}
    dialog.age-gate:not([open]){display:none}
    .age-gate-card{width:min(440px,100%);padding:26px 22px 22px;border:1px solid #638aa570;border-radius:6px 16px 6px 16px;background:linear-gradient(160deg,#16334b,#0a1626);box-shadow:0 18px 60px #000a,inset 0 1px #ffffff14;text-align:center}
    .age-gate small{display:block;letter-spacing:.14em;font-size:10px;color:#b9a26a}
    .age-gate h2{margin:8px 0 12px;font-size:22px;line-height:1.35}
    .age-gate p{margin:0 0 10px;font-size:14px;line-height:1.65;color:#c3d4df}
    .age-gate p a{color:#e6c36f}
    .age-gate-actions{display:grid;gap:10px;margin-top:18px}
    .age-gate button{min-height:48px;border-radius:12px;font:inherit;font-size:15px;font-weight:700;cursor:pointer}
    .age-gate .age-yes{border:1px solid #e6c36f;background:linear-gradient(180deg,#8c6b2c,#4d3a16);color:#fff3d0}
    .age-gate .age-no{border:1px solid #638aa570;background:transparent;color:#c3d4df;font-weight:500}
  `;
  document.head.append(style);

  // <dialog> 를 모달로 열면 다른 화면(소개 영상, 안내 창 등)이 어떤 z-index 를 써도 항상 맨 위에 보인다.
  const gate = document.createElement('dialog');
  gate.className = 'age-gate';
  gate.setAttribute('aria-labelledby', 'age-gate-title');
  gate.addEventListener('cancel', event => event.preventDefault());   // Esc 로 닫을 수 없다

  const ask = () => {
    gate.innerHTML = `<div class="age-gate-card"><small>BATTLECRUISER</small><h2 id="age-gate-title">연령 확인</h2><p>「전투 순양함」은 <strong>만 14세 이상</strong>만 이용할 수 있습니다.</p><p>계속하면 <a href="terms.html" target="_blank" rel="noopener">서비스 이용약관</a>과 <a href="privacy.html" target="_blank" rel="noopener">개인정보 처리방침</a>을 확인한 것으로 봅니다.</p><div class="age-gate-actions"><button type="button" class="age-yes">만 14세 이상입니다</button><button type="button" class="age-no">만 14세 미만입니다</button></div></div>`;
    gate.querySelector('.age-yes').onclick = confirm;
    gate.querySelector('.age-no').onclick = blocked;
    gate.querySelector('.age-yes').focus();
  };
  const blocked = () => {
    gate.innerHTML = `<div class="age-gate-card"><small>BATTLECRUISER</small><h2 id="age-gate-title">이용할 수 없습니다</h2><p>만 14세 미만은 「전투 순양함」을 이용할 수 없습니다.<br>이 기기에는 어떤 정보도 저장하지 않았습니다.</p><div class="age-gate-actions"><button type="button" class="age-no">돌아가기</button></div></div>`;
    gate.querySelector('.age-no').onclick = ask;
    gate.querySelector('.age-no').focus();
  };
  const confirm = () => {
    try { localStorage.setItem(KEY, JSON.stringify({ confirmedAt: new Date().toISOString(), version: 1 })); } catch (_) {}
    gate.close();
    gate.remove();
    style.remove();
    window.dispatchEvent(new CustomEvent('age-confirmed'));
  };

  const show = () => { document.body.append(gate); gate.showModal(); ask(); };
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
})();
