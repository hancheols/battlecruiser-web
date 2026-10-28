// 서버 공용 도구: JSON 응답, 무작위 토큰, 해시, 게스트 인증.
export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

const toHex = bytes => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');

export const randomToken = byteLength => toHex(crypto.getRandomValues(new Uint8Array(byteLength)));

export async function sha256Hex(text) {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
}

// 길이가 같은 문자열을 시간 차이 없이 비교한다.
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

// 요청 머리글(X-Guest-Id, Authorization: Bearer 비밀값)로 게스트를 확인한다. 실패하면 null.
export async function authenticate(request, env) {
  const id = request.headers.get('X-Guest-Id') || '';
  const secret = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!/^[0-9a-f]{24}$/.test(id) || !/^[0-9a-f]{64}$/.test(secret)) return null;
  const row = await env.DB.prepare('SELECT id, secret_hash FROM users WHERE id = ?1').bind(id).first();
  if (!row) return null;
  return safeEqual(row.secret_hash, await sha256Hex(secret)) ? { id: row.id } : null;
}
