// 구글 로그인 ID 토큰(JWT) 검증. 클라이언트 비밀값 없이 구글이 공개한 서명 키로 서명·발급처·대상(우리 클라이언트 ID)·유효 시간을 확인한다.
const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let certCache = { keys: null, expires: 0 };

export async function fetchGoogleKeys() {
  if (certCache.keys && Date.now() < certCache.expires) return certCache.keys;
  const response = await fetch(CERTS_URL);
  if (!response.ok) throw new Error('google-certs-unavailable');
  const body = await response.json();
  certCache = { keys: body.keys || [], expires: Date.now() + 3600000 };
  return certCache.keys;
}

const decodePart = part => JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
function base64UrlToBytes(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

// 성공하면 { subject, email, emailVerified } 를, 어떤 검사든 실패하면 null 을 돌려준다.
export async function verifyGoogleIdToken(token, { clientId, getKeys = fetchGoogleKeys, now = Date.now() } = {}) {
  try {
    if (!clientId || typeof token !== 'string' || token.length > 4096) return null;
    const [headerPart, payloadPart, signaturePart] = token.split('.');
    if (!headerPart || !payloadPart || !signaturePart) return null;
    const header = decodePart(headerPart), payload = decodePart(payloadPart);
    if (header.alg !== 'RS256') return null;
    const jwk = (await getKeys()).find(key => key.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlToBytes(signaturePart), new TextEncoder().encode(`${headerPart}.${payloadPart}`));
    if (!valid) return null;
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) return null;
    if (payload.aud !== clientId) return null;
    if (!payload.sub || typeof payload.sub !== 'string') return null;
    const seconds = Math.floor(now / 1000);
    if (!(Number(payload.exp) > seconds - 30) || (payload.iat && Number(payload.iat) > seconds + 300)) return null;
    return { subject: payload.sub, email: String(payload.email || ''), emailVerified: payload.email_verified === true || payload.email_verified === 'true' };
  } catch (_) { return null; }
}

export function maskEmail(email) {
  const [name = '', domain = ''] = String(email).split('@');
  if (!domain) return '';
  return `${name.slice(0, 2)}***@${domain}`;
}
