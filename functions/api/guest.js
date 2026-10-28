// POST /api/guest — 게스트 계정을 만든다. 응답의 id·secret 은 기기에 보관하고, secret 은 서버에 해시로만 남는다.
import { json, randomToken, sha256Hex } from '../_lib/util.js';

export async function onRequestPost({ env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const id = randomToken(12);
  const secret = randomToken(32);
  await env.DB.prepare('INSERT INTO users (id, secret_hash, created_at) VALUES (?1, ?2, ?3)')
    .bind(id, await sha256Hex(secret), Date.now()).run();
  return json({ id, secret }, 201);
}
