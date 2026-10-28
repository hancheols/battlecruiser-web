// POST /api/guest — 게스트 계정을 만든다. 응답의 id·secret 은 기기에 보관하고, secret 은 서버에 해시로만 남는다.
import { json, randomToken, sha256Hex, allow, tooMany, clientKey } from '../_lib/util.js';

// 한 접속자(IP)당 1시간에 20개까지, 전체로는 1시간에 5000개까지(같은 통신사 IP를 여럿이 쓰는 경우를 감안한 넉넉한 값).
const PER_IP = { limit: 20, windowMs: 3600000 };
const GLOBAL = { limit: 5000, windowMs: 3600000 };

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  if (!(await allow(env, `guest:${await clientKey(request)}`, PER_IP.limit, PER_IP.windowMs))) return tooMany();
  if (!(await allow(env, 'guest:all', GLOBAL.limit, GLOBAL.windowMs))) return tooMany();
  const id = randomToken(12);
  const secret = randomToken(32);
  await env.DB.prepare('INSERT INTO users (id, secret_hash, created_at) VALUES (?1, ?2, ?3)')
    .bind(id, await sha256Hex(secret), Date.now()).run();
  return json({ id, secret }, 201);
}
