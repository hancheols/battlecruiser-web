// POST /api/report — 다른 이용자의 이름·연합 이름·연합 공지·채팅 메시지 신고.
// 본문: { type: 'player' | 'union' | 'message', id: 공개 번호·연합 id·메시지 번호, reason, detail }
// 신고 당시 이름과 공지를 함께 남겨, 나중에 바뀌어도 운영자가 무엇이 신고됐는지 볼 수 있다.
// 같은 사람이 같은 대상을 아직 처리되지 않은 상태로 다시 신고하면 새로 쌓지 않고 접수된 것으로 답한다.
import { json, authenticate, allow, tooMany, randomToken } from '../_lib/util.js';
import { notReady, fail, isMissingTable } from '../_lib/players.js';

export const REPORT_REASONS = ['abuse', 'sexual', 'hate', 'impersonation', 'spam', 'other'];
const DETAIL_MAX = 200;

async function findTarget(env, type, id) {
  if (type === 'message') {
    if (!/^[0-9]{1,15}$/.test(id)) return null;
    const row = await env.DB.prepare('SELECT user_id, name, body FROM chat_messages WHERE id = ?1').bind(Number(id)).first();
    return row ? { userId: row.user_id, name: row.name, text: row.body } : null;
  }
  if (type === 'player') {
    const row = await env.DB.prepare('SELECT user_id, name FROM players WHERE public_id = ?1').bind(id).first();
    return row ? { userId: row.user_id, name: row.name, text: '' } : null;
  }
  const row = await env.DB.prepare('SELECT id, name, notice FROM unions WHERE id = ?1').bind(id).first();
  if (!row) return null;
  const leader = await env.DB.prepare("SELECT user_id FROM union_members WHERE union_id = ?1 AND role = 'leader'").bind(id).first();
  return { userId: leader?.user_id || null, name: row.name, text: row.notice || '' };
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `report:${user.id}`, 20, 86400000))) return tooMany();
  const body = await request.json().catch(() => null);
  const type = ['player', 'union', 'message'].includes(body?.type) ? body.type : null;
  const id = typeof body?.id === 'string' ? body.id.trim().slice(0, 64) : '';
  const reason = REPORT_REASONS.includes(body?.reason) ? body.reason : null;
  const detail = typeof body?.detail === 'string' ? body.detail.trim().slice(0, DETAIL_MAX) : '';
  if (!type || !id || !reason) return fail('신고 내용을 확인해 주세요.');
  try {
    const target = await findTarget(env, type, id);
    if (!target) return fail('신고할 대상을 찾을 수 없습니다.', 404, 'not-found');
    if (target.userId && target.userId === user.id && type !== 'union') return fail('자기 자신은 신고할 수 없습니다.');
    const open = await env.DB.prepare("SELECT id FROM reports WHERE reporter_id = ?1 AND target_type = ?2 AND target_id = ?3 AND status = 'open'").bind(user.id, type, id).first();
    if (open) return json({ ok: true, duplicate: true });
    await env.DB.prepare('INSERT INTO reports (id, reporter_id, target_type, target_id, target_user_id, target_name, target_text, reason, detail, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, \'open\', ?10)')
      .bind(randomToken(12), user.id, type, id, target.userId, String(target.name || '').slice(0, 64), String(target.text || '').slice(0, 200), reason, detail, Date.now()).run();
    return json({ ok: true });
  } catch (error) {
    if (isMissingTable(error)) return notReady();
    throw error;
  }
}
