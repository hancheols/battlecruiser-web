// GET  /api/chat?channel=global|union&after=<마지막으로 받은 id> — 새 메시지 받기(after 가 0 이면 최근 50개)
// POST /api/chat { channel, body } — 메시지 보내기
// 전체 채팅 쓰기는 구글 계정을 연동한 계정만, 연합 채팅은 같은 연합원만. 글은 80자, 3초에 1개, 같은 내용 연속 금지, 하루 300개.
// 메시지는 30일, 채팅 금지 기록은 끝난 뒤 1년, 처리 끝난 신고는 1년이 지나면 정리한다(1시간에 한 번, 보낼 때).
import { json, authenticate, allow, tooMany } from '../_lib/util.js';
import { ensurePlayer, touchPlayer, notReady, fail, isMissingTable, hasBannedWord } from '../_lib/players.js';

export const CHAT = { maxLength: 80, minGapMs: 3000, perDay: 300, firstPage: 50, page: 100, keepMs: 30 * 86400000, recordKeepMs: 365 * 86400000 };
const length = text => [...text].length;

async function channelFor(env, userId, wanted) {
  if (wanted === 'global') return { key: 'global', unionName: '' };
  if (wanted !== 'union') return null;
  const row = await env.DB.prepare('SELECT u.id, u.name FROM union_members m JOIN unions u ON u.id = m.union_id WHERE m.user_id = ?1').bind(userId).first();
  return row ? { key: `union:${row.id}`, unionName: row.name, unionId: row.id } : { key: null };
}
const isLinked = async (env, userId) => Boolean(await env.DB.prepare('SELECT 1 AS ok FROM identities WHERE user_id = ?1 LIMIT 1').bind(userId).first());
const activeBan = async (env, userId) => env.DB.prepare('SELECT until, reason FROM chat_bans WHERE user_id = ?1 AND until > ?2').bind(userId, Date.now()).first();
const view = (row, userId) => ({ id: row.id, playerId: row.public_id, name: row.name, union: row.union_name, body: row.body, at: row.created_at, mine: row.user_id === userId });

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `chat-read:${user.id}`, 2400, 3600000))) return tooMany();
  const url = new URL(request.url);
  const after = Math.max(0, Math.floor(Number(url.searchParams.get('after')) || 0));
  try {
    const channel = await channelFor(env, user.id, url.searchParams.get('channel'));
    if (!channel) return fail('채널을 확인해 주세요.');
    if (!channel.key) return json({ channel: 'union', messages: [], canWrite: false, reason: 'no-union' });
    const rows = after
      ? (await env.DB.prepare('SELECT * FROM chat_messages WHERE channel = ?1 AND id > ?2 AND deleted_at IS NULL ORDER BY id LIMIT ?3').bind(channel.key, after, CHAT.page).all()).results
      : (await env.DB.prepare('SELECT * FROM (SELECT * FROM chat_messages WHERE channel = ?1 AND deleted_at IS NULL ORDER BY id DESC LIMIT ?2) ORDER BY id').bind(channel.key, CHAT.firstPage).all()).results;
    let canWrite = true, reason = '';
    const ban = await activeBan(env, user.id);
    if (ban) { canWrite = false; reason = 'banned'; }
    else if (channel.key === 'global' && !(await isLinked(env, user.id))) { canWrite = false; reason = 'link-required'; }
    return json({ channel: channel.key === 'global' ? 'global' : 'union', unionName: channel.unionName, messages: rows.map(row => view(row, user.id)), canWrite, reason, banUntil: ban?.until || null });
  } catch (error) {
    if (isMissingTable(error)) return notReady();
    throw error;
  }
}

async function cleanup(env) {
  if (!(await allow(env, 'chat-cleanup', 1, 3600000))) return;
  const now = Date.now();
  await env.DB.prepare('DELETE FROM chat_messages WHERE created_at < ?1').bind(now - CHAT.keepMs).run();
  await env.DB.prepare('DELETE FROM chat_bans WHERE until < ?1').bind(now - CHAT.recordKeepMs).run();
  try { await env.DB.prepare("DELETE FROM reports WHERE status <> 'open' AND handled_at < ?1").bind(now - CHAT.recordKeepMs).run(); } catch (_) {}
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const payload = await request.json().catch(() => null);
  const body = String(payload?.body ?? '').replace(/\s+/g, ' ').trim();
  if (!body) return fail('메시지를 입력해 주세요.');
  if (length(body) > CHAT.maxLength) return fail(`메시지는 ${CHAT.maxLength}자까지 쓸 수 있습니다.`);
  if (hasBannedWord(body)) return fail('사용할 수 없는 말이 있습니다.', 400, 'banned-word');
  try {
    const player = await ensurePlayer(env, user.id);
    const channel = await channelFor(env, user.id, payload?.channel);
    if (!channel) return fail('채널을 확인해 주세요.');
    if (!channel.key) return fail('연합에 가입하면 연합 채팅을 쓸 수 있습니다.', 403, 'no-union');
    const ban = await activeBan(env, user.id);
    if (ban) return json({ error: 'banned', message: '채팅 이용이 제한되어 있습니다.', until: ban.until }, 403);
    if (channel.key === 'global' && !(await isLinked(env, user.id))) return fail('전체 채팅에 글을 쓰려면 구글 계정을 연동해 주세요.', 403, 'link-required');
    const last = await env.DB.prepare('SELECT body, created_at FROM chat_messages WHERE user_id = ?1 ORDER BY id DESC LIMIT 1').bind(user.id).first();
    const now = Date.now();
    if (last && now - Number(last.created_at) < CHAT.minGapMs) return json({ error: 'too-fast', message: '조금 천천히 보내 주세요.' }, 429);
    if (last && last.body === body) return fail('같은 내용을 연달아 보낼 수 없습니다.', 400, 'duplicate');
    if (!(await allow(env, `chat-day:${user.id}`, CHAT.perDay, 86400000))) return json({ error: 'daily-limit', message: '오늘 보낼 수 있는 메시지를 모두 썼습니다.' }, 429);
    // 전체 채팅에는 보낸 사람의 소속 연합 이름을 함께 남긴다(연합 채팅은 모두 같은 연합이라 비워 둔다).
    const unionName = channel.key === 'global'
      ? ((await env.DB.prepare('SELECT u.name FROM union_members m JOIN unions u ON u.id = m.union_id WHERE m.user_id = ?1').bind(user.id).first())?.name || '')
      : '';
    const result = await env.DB.prepare('INSERT INTO chat_messages (channel, user_id, public_id, name, union_name, body, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
      .bind(channel.key, user.id, player.public_id, player.name, unionName, body, now).run();
    await touchPlayer(env, player);
    await cleanup(env);
    const id = Number(result?.meta?.last_row_id) || null;
    return json({ ok: true, message: { id, playerId: player.public_id, name: player.name, union: unionName, body, at: now, mine: true } });
  } catch (error) {
    if (isMissingTable(error)) return notReady();
    throw error;
  }
}
