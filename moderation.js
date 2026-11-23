// 신고·차단: 다른 이용자의 함장 이름·연합 이름·연합 공지를 신고하고, 차단하면 내 화면에서 가린다.
// 차단 목록은 starfleet- 로 시작하는 저장 키라 클라우드 백업에 함께 올라간다. 신고는 서버(/api/report)로 보낸다.
// 기기 저장 모드의 가상 상대(bot-…, 가상 연합)는 다른 이용자가 아니므로 신고·차단 대상에서 뺀다.
(() => {
  const KEY = 'starfleet-blocked-v1';
  const REASONS = [['abuse', '욕설·비방'], ['sexual', '음란·성적 표현'], ['hate', '혐오·차별 표현'], ['impersonation', '운영자 사칭'], ['spam', '광고·도배'], ['other', '기타']];
  const LABEL = { player: '차단한 함장', union: '차단한 연합' };
  const KIND = { player: '함장', union: '연합', message: '메시지' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return { player: { ...(v?.player || {}) }, union: { ...(v?.union || {}) } }; } catch { return { player: {}, union: {} }; } };
  const write = value => { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {} window.dispatchEvent(new Event('moderation-changed')); };
  const toast = message => (window.notice ? window.notice(message) : alert(message));

  // 서버가 만든 번호만 대상: 함장 공개 번호는 16자리 16진수, 연합 id 는 'u-' + 16자리 16진수.
  const canModerate = (type, id) => (type === 'union' ? /^u-[0-9a-f]{16}$/ : type === 'message' ? /^[0-9]{1,15}$/ : /^[0-9a-f]{16}$/).test(String(id || ''));
  const isBlocked = (type, id) => Boolean(id && read()[type]?.[id]);
  const label = (type, id, name) => (isBlocked(type, id) ? LABEL[type] : name);
  const text = (type, id, value) => (isBlocked(type, id) ? '' : value);
  function block(type, id, name) { const v = read(); v[type][id] = String(name || '').slice(0, 40); write(v); toast(`${KIND[type]} '${name}'을(를) 차단했습니다. 이름과 글이 내 화면에서 가려집니다.`); }
  function unblock(type, id) { const v = read(); const name = v[type][id]; delete v[type][id]; write(v); toast(`${KIND[type]} '${name || ''}' 차단을 풀었습니다.`); }

  // 작은 대화 상자(신고·차단 메뉴, 신고서, 차단 목록이 함께 쓴다)
  function sheet(html, onClick) {
    document.querySelector('.mod-sheet')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'mod-sheet';
    wrap.innerHTML = `<section class="mod-card" role="dialog" aria-modal="true">${html}</section>`;
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };
    wrap.addEventListener('click', event => { if (event.target === wrap || event.target.closest('[data-mod-close]')) { close(); return; } onClick?.(event, close, wrap); });
    document.addEventListener('keydown', onKey, true);
    document.body.append(wrap);
    wrap.querySelector('button, textarea, input')?.focus();
    return wrap;
  }

  function openActions({ type, id, name }) {
    if (!canModerate(type, id)) return;
    const blocked = isBlocked(type, id);
    sheet(`<header><small>${type === 'union' ? 'UNION' : 'CAPTAIN'} · SAFETY</small><h3>${esc(blocked ? LABEL[type] : name)}</h3><button type="button" class="mod-x" data-mod-close aria-label="닫기">×</button></header>
      <p class="mod-note">부적절한 ${type === 'union' ? '연합 이름이나 공지' : '함장 이름'}를 신고하거나, 차단해 내 화면에서 가릴 수 있습니다.</p>
      <div class="mod-actions"><button type="button" class="mod-btn danger" data-mod-report>신고하기</button><button type="button" class="mod-btn" data-mod-toggle>${blocked ? '차단 풀기' : '차단하기'}</button></div>`,
    (event, close) => {
      if (event.target.closest('[data-mod-report]')) { close(); openReport({ type, id, name }); }
      else if (event.target.closest('[data-mod-toggle]')) { close(); if (blocked) unblock(type, id); else block(type, id, name); }
    });
  }

  // blockAs: 함께 차단할 대상(메시지 신고면 보낸 함장). text: 신고서에 보여 줄 메시지 내용.
  function openReport({ type, id, name, blockAs = null, text = '' }) {
    if (!canModerate(type, id)) return;
    const blockTarget = blockAs || (type === 'message' ? null : { type, id, name });
    sheet(`<header><small>REPORT</small><h3>${KIND[type]} 신고</h3><button type="button" class="mod-x" data-mod-close aria-label="닫기">×</button></header>
      <p class="mod-target">대상 · <b>${esc(name)}</b>${text ? `<br/><q>${esc(text)}</q>` : ''}</p>
      <fieldset class="mod-reasons"><legend>신고 사유</legend>${REASONS.map(([value, text], index) => `<label><input type="radio" name="mod-reason" value="${value}"${index ? '' : ' checked'}/><span>${text}</span></label>`).join('')}</fieldset>
      <label class="mod-detail"><span>자세한 내용 (선택, 200자)</span><textarea maxlength="200" rows="3" data-mod-detail placeholder="문제가 된 내용을 적어 주세요."></textarea></label>
      ${blockTarget ? `<label class="mod-also"><input type="checkbox" data-mod-also checked${isBlocked(blockTarget.type, blockTarget.id) ? ' disabled' : ''}/><span>이 ${KIND[blockTarget.type]}도 차단해서 내 화면에서 가리기</span></label>` : ''}
      <p class="mod-note">신고는 운영팀이 확인한 뒤 이름·공지 변경이나 삭제, 이용 제한 등으로 조치합니다. 허위 신고는 제재될 수 있습니다.</p>
      <div class="mod-actions"><button type="button" class="mod-btn" data-mod-close>취소</button><button type="button" class="mod-btn danger" data-mod-send>신고 보내기</button></div>`,
    async (event, close, wrap) => {
      const send = event.target.closest('[data-mod-send]');
      if (!send || send.disabled) return;
      const reason = wrap.querySelector('[name="mod-reason"]:checked')?.value || 'other';
      const detail = wrap.querySelector('[data-mod-detail]').value.trim();
      const alsoBlock = Boolean(blockTarget && wrap.querySelector('[data-mod-also]')?.checked && !isBlocked(blockTarget.type, blockTarget.id));
      send.disabled = true; send.textContent = '보내는 중…';
      try {
        if (!window.Online?.call) throw Object.assign(new Error('서버에 연결할 수 없습니다.'), { status: 0 });
        await window.Online.call('/report', { method: 'POST', body: { type, id, reason, detail } });
        close();
        if (alsoBlock) block(blockTarget.type, blockTarget.id, blockTarget.name);
        toast('신고가 접수되었습니다. 운영팀이 확인한 뒤 조치합니다.');
      } catch (error) {
        send.disabled = false; send.textContent = '신고 보내기';
        toast(error?.status === 503 ? '온라인 기능이 열린 뒤에 신고할 수 있습니다. 급한 경우 hansryan19@gmail.com 으로 알려 주세요.' : error?.status === 429 ? '신고를 너무 많이 보냈습니다. 내일 다시 시도해 주세요.' : (error?.message || '신고를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'));
      }
    });
  }

  // 채팅 메시지 메뉴: 메시지 신고, 보낸 함장 차단·풀기
  function openMessage({ id, playerId, name, body }) {
    if (!canModerate('message', id)) return;
    const canBlock = canModerate('player', playerId), blocked = canBlock && isBlocked('player', playerId);
    sheet(`<header><small>CHAT · SAFETY</small><h3>${esc(blocked ? LABEL.player : name)}</h3><button type="button" class="mod-x" data-mod-close aria-label="닫기">×</button></header>
      ${blocked ? '' : `<p class="mod-target"><q>${esc(body)}</q></p>`}
      <div class="mod-actions"><button type="button" class="mod-btn danger" data-mod-report>메시지 신고</button>${canBlock ? `<button type="button" class="mod-btn" data-mod-toggle>${blocked ? '차단 풀기' : '함장 차단'}</button>` : ''}</div>`,
    (event, close) => {
      if (event.target.closest('[data-mod-report]')) { close(); openReport({ type: 'message', id, name, text: body, blockAs: canBlock ? { type: 'player', id: playerId, name } : null }); }
      else if (event.target.closest('[data-mod-toggle]')) { close(); if (blocked) unblock('player', playerId); else block('player', playerId, name); }
    });
  }

  // 차단 목록(설정 › 계정 › 차단 목록에서 쓴다)
  function listMarkup() {
    const v = read();
    const rows = ['player', 'union'].flatMap(type => Object.entries(v[type]).map(([id, name]) => `<li class="mod-row"><span><small>${KIND[type]}</small><b>${esc(name || id)}</b></span><button type="button" class="mod-btn" data-mod-unblock="${type}:${esc(id)}">차단 풀기</button></li>`));
    return rows.length ? `<ul class="mod-list">${rows.join('')}</ul>` : '<p class="mod-empty">차단한 함장이나 연합이 없습니다.</p>';
  }
  function bindList(host, rerender) {
    host.querySelectorAll('[data-mod-unblock]').forEach(button => button.onclick = () => { const [type, ...rest] = button.dataset.modUnblock.split(':'); unblock(type, rest.join(':')); rerender?.(); });
  }
  const count = () => { const v = read(); return Object.keys(v.player).length + Object.keys(v.union).length; };

  window.Moderation = { REASONS, canModerate, isBlocked, label, text, block, unblock, openActions, openReport, openMessage, listMarkup, bindList, count };
})();
