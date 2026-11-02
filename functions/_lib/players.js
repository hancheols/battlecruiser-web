// 공개 프로필 도구: 다른 이용자에게 보이는 이름과 공개용 번호를 관리한다.
import { json, randomToken } from './util.js';

// 표(마이그레이션 0005)가 아직 없으면 게임은 이 응답을 보고 기기 저장 모드로 동작한다.
export const notReady = () => json({ error: 'not-ready' }, 503);
export const fail = (message, status = 400, error = 'rejected') => json({ error, message }, status);
export const isMissingTable = error => /no such table/i.test(String(error?.message || error));

// 다른 이용자에게 보이는 글에 넣지 않는 말. 이름은 운영자로 오해될 말도 막는다.
const BANNED = ['시발', '씨발', '씨팔', 'ㅅㅂ', '병신', 'ㅂㅅ', '좆', '개새끼', '개새', '지랄', '니미', '느금', 'fuck', 'shit', 'bitch', 'nigger'];
const RESERVED = ['운영자', '운영팀', '관리자', 'admin', 'timeswitch', '타임스위치'];
const compact = text => String(text || '').toLowerCase().replace(/[\s._'-]/g, '');
export const hasBannedWord = text => { const value = compact(text); return BANNED.some(word => value.includes(word)); };
export const isReservedName = text => { const value = compact(text); return RESERVED.some(word => value.includes(word)); };
export const nameKey = compact;

const NAME_PATTERN = /^[\p{L}\p{N} '-]{1,24}$/u;
const fallbackName = () => `함장-${randomToken(2)}`;
function cleanName(name) {
  const value = String(name || '').trim().replace(/\s+/g, ' ');
  return NAME_PATTERN.test(value) && !hasBannedWord(value) && !isReservedName(value) ? value : null;
}

// 이름을 정한다. 다른 이용자가 이미 쓰는 이름이면 뒤에 숫자를 붙인다(이름 입력 화면을 다시 띄우지 않으려고).
async function freeName(env, userId, wanted) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt ? `${wanted.slice(0, 19)} ${Math.floor(1000 + Math.random() * 9000)}` : wanted;
    const owner = await env.DB.prepare('SELECT user_id FROM players WHERE name_key = ?1').bind(nameKey(candidate)).first();
    if (!owner || owner.user_id === userId) return candidate;
  }
  return fallbackName();
}

// 프로필을 돌려준다. 없으면 만든다. name 을 주면 이름을 바꾼다(올바르지 않은 이름은 무시).
export async function ensurePlayer(env, userId, name) {
  const now = Date.now();
  const existing = await env.DB.prepare('SELECT * FROM players WHERE user_id = ?1').bind(userId).first();
  const wanted = cleanName(name);
  if (existing) {
    if (!wanted || wanted === existing.name || nameKey(wanted) === existing.name_key) return existing;
    const next = await freeName(env, userId, wanted);
    await env.DB.prepare('UPDATE players SET name = ?1, name_key = ?2, updated_at = ?3 WHERE user_id = ?4').bind(next, nameKey(next), now, userId).run();
    return { ...existing, name: next, name_key: nameKey(next), updated_at: now };
  }
  const next = await freeName(env, userId, wanted || fallbackName());
  const publicId = randomToken(8);
  await env.DB.prepare('INSERT INTO players (user_id, public_id, name, name_key, last_seen, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5) ON CONFLICT(user_id) DO NOTHING').bind(userId, publicId, next, nameKey(next), now).run();
  return env.DB.prepare('SELECT * FROM players WHERE user_id = ?1').bind(userId).first();
}

// 접속 표시. 쓰기 횟수를 줄이려고 1분에 한 번만 고친다.
export async function touchPlayer(env, player) {
  const now = Date.now();
  if (now - Number(player.last_seen) < 60000) return;
  await env.DB.prepare('UPDATE players SET last_seen = ?1 WHERE user_id = ?2').bind(now, player.user_id).run();
}
