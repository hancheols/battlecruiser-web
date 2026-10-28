// GET /api/save — 저장 데이터를 돌려준다. PUT /api/save — 저장한다.
// 저장 본문: { baseRevision, schemaVersion, data } · data 는 { 저장키: 문자열값 } 객체.
// 동시 저장 충돌을 막으려고, 기준 리비전(baseRevision)이 서버 리비전과 다르면 409 로 거절한다.
import { json, authenticate, allow, tooMany } from '../_lib/util.js';

// 계정당 1분에 저장 20번·불러오기 20번까지(정상 사용은 15초에 한 번 저장).
const PER_USER = { limit: 20, windowMs: 60000 };

const MAX_BYTES = 800 * 1024;
const MAX_KEYS = 200;
const KEY_PATTERN = /^[a-z0-9-]{1,80}$/;

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `load:${user.id}`, PER_USER.limit, PER_USER.windowMs))) return tooMany();
  const row = await env.DB.prepare('SELECT revision, schema_version, data, updated_at FROM saves WHERE user_id = ?1').bind(user.id).first();
  if (!row) return json({ empty: true, revision: 0 });
  return json({ revision: row.revision, schemaVersion: row.schema_version, updatedAt: row.updated_at, data: JSON.parse(row.data) });
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `save:${user.id}`, PER_USER.limit, PER_USER.windowMs))) return tooMany();
  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: 'too-large' }, 413);
  let body;
  try { body = JSON.parse(text); } catch (_) { return json({ error: 'bad-json' }, 400); }
  const { baseRevision, data } = body || {};
  const schemaVersion = Number.isInteger(body?.schemaVersion) ? body.schemaVersion : 1;
  if (!Number.isInteger(baseRevision) || baseRevision < 0 || !data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'bad-request' }, 400);
  const keys = Object.keys(data);
  if (keys.length > MAX_KEYS || keys.some(key => !KEY_PATTERN.test(key) || typeof data[key] !== 'string')) return json({ error: 'bad-data' }, 400);

  const now = Date.now();
  const current = await env.DB.prepare('SELECT revision FROM saves WHERE user_id = ?1').bind(user.id).first();
  const currentRevision = current ? current.revision : 0;
  if (baseRevision !== currentRevision) return json({ error: 'conflict', revision: currentRevision }, 409);
  const nextRevision = currentRevision + 1;
  const stored = JSON.stringify(data);
  const result = current
    ? await env.DB.prepare('UPDATE saves SET revision = ?1, schema_version = ?2, data = ?3, updated_at = ?4 WHERE user_id = ?5 AND revision = ?6')
        .bind(nextRevision, schemaVersion, stored, now, user.id, currentRevision).run()
    : await env.DB.prepare('INSERT OR IGNORE INTO saves (user_id, revision, schema_version, data, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(user.id, nextRevision, schemaVersion, stored, now).run();
  // 위 읽기와 쓰기 사이에 다른 요청이 먼저 저장했다면 변경된 행이 없다.
  if (!result?.meta?.changes) return json({ error: 'conflict' }, 409);
  return json({ revision: nextRevision, updatedAt: now });
}
