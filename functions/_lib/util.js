// 서버 공용 도구: JSON 응답, 무작위 토큰, 해시, 게스트 인증.
export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

// 홈페이지(timeswitch.co.kr) 상점이 게임 서버 API 를 부를 수 있게, 그 출처에만 CORS 를 허용한다.
const HOME_ORIGINS = ['https://timeswitch.co.kr', 'https://www.timeswitch.co.kr'];
export function withHomeCors(response, request) {
  const origin = request.headers.get('Origin');
  if (HOME_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  }
  return response;
}

const toHex = bytes => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');

export const randomToken = byteLength => toHex(crypto.getRandomValues(new Uint8Array(byteLength)));

export async function sha256Hex(text) {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
}

// 요청 횟수 제한: bucket(용도+대상 해시)마다 windowMs 동안 limit 번까지 허용한다. 허용이면 true.
// 표가 아직 없는 등 제한 장치 자체가 고장 나면 서비스를 막지 않고 통과시킨다(이때는 제한이 꺼진 상태이므로 마이그레이션 0002 를 적용해야 한다).
export async function allow(env, bucket, limit, windowMs) {
  const now = Date.now();
  try {
    const row = await env.DB.prepare(
      `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(bucket) DO UPDATE SET
         count = CASE WHEN window_start <= ?2 - ?3 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN window_start <= ?2 - ?3 THEN ?2 ELSE window_start END
       RETURNING count`
    ).bind(bucket, now, windowMs).first();
    // 가끔 오래된 칸을 정리한다.
    if (Math.random() < .01) await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(now - 86400000).run();
    return Number(row?.count) <= limit;
  } catch (_) { return true; }
}

export const tooMany = () => json({ error: 'rate-limited' }, 429);

// 접속자 식별(IP)을 해시로 바꿔 제한 칸의 이름으로 쓴다. 원문 IP 는 저장하지 않는다.
// 서버 비밀값 RATE_SALT 를 환경 변수로 설정하면 해시에 섞어 IP 대입 복원을 어렵게 한다(없으면 고정 문자열만 쓴다).
export async function clientKey(request, env = {}) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  return (await sha256Hex(`bc-rate:${env.RATE_SALT || ''}:${ip}`)).slice(0, 24);
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
  const hash = await sha256Hex(secret);
  // 구글 연동으로 다른 기기에서 받은 세션 비밀값(표가 아직 없으면 건너뛴다)
  try {
    const session = await env.DB.prepare('SELECT user_id FROM sessions WHERE token_hash = ?1').bind(hash).first();
    if (session && session.user_id === id) return { id };
  } catch (_) {}
  return safeEqual(row.secret_hash, hash) ? { id: row.id } : null;
}
