// GET  /api/union        — 내 정보와 내 연합(없으면 null)
// GET  /api/union?q=이름  — 연합 검색
// POST /api/union        — { action, ... } 창설·가입·탈퇴·공지·직책·추방·신청 처리·위임·해체
// 토륨 비용은 재화가 게임 저장에 있어 게임 쪽에서 낸다. 권한·인원·이름 중복은 서버가 판단한다.
import { json, authenticate, allow, tooMany, randomToken } from '../_lib/util.js';
import { ensurePlayer, touchPlayer, notReady, fail, isMissingTable, hasBannedWord, isReservedName, nameKey } from '../_lib/players.js';

const CAPACITY = 30;
const JOIN_MODES = ['open', 'approval'];
const LIST_LIMIT = 30;

// 엠블럼은 꾸미기 칸 이름만 받는다(화면은 union-emblem.js normalize 로 다시 거른다).
function cleanEmblem(emblem) {
  if (typeof emblem === 'string') return emblem.length <= 2 ? emblem : null;
  if (!emblem || typeof emblem !== 'object') return null;
  const out = {};
  for (const key of ['w', 's', 'i', 'f', 'm', 'c']) {
    if (typeof emblem[key] !== 'string' || !/^[a-zA-Z0-9_-]{1,24}$/.test(emblem[key])) return null;
    out[key] = emblem[key];
  }
  return out;
}
const cleanNotice = notice => String(notice ?? '').slice(0, 120);
const parseEmblem = text => { try { return JSON.parse(text); } catch (_) { return text; } };

async function myMembership(env, userId) {
  return env.DB.prepare('SELECT union_id, role FROM union_members WHERE user_id = ?1').bind(userId).first();
}
const unionById = (env, id) => env.DB.prepare('SELECT * FROM unions WHERE id = ?1').bind(id).first();
const countMembers = async (env, id) => Number((await env.DB.prepare('SELECT COUNT(*) AS n FROM union_members WHERE union_id = ?1').bind(id).first()).n);
const memberByPublic = (env, unionId, publicId) => env.DB.prepare('SELECT m.user_id, m.role, p.public_id FROM union_members m JOIN players p ON p.user_id = m.user_id WHERE m.union_id = ?1 AND p.public_id = ?2').bind(unionId, String(publicId)).first();

// 인원이 남아 있을 때만 들어간다. 한 계정은 한 연합에만 속한다(기본 키). 들어가면 다른 연합에 낸 신청은 지운다.
async function addMember(env, unionId, userId, role = 'member') {
  const now = Date.now();
  const result = await env.DB.prepare('INSERT INTO union_members (user_id, union_id, role, joined_at) SELECT ?1, ?2, ?3, ?4 WHERE (SELECT COUNT(*) FROM union_members WHERE union_id = ?2) < (SELECT capacity FROM unions WHERE id = ?2) ON CONFLICT(user_id) DO NOTHING').bind(userId, unionId, role, now).run();
  if (!result?.meta?.changes) return false;
  await env.DB.prepare('DELETE FROM union_applications WHERE user_id = ?1').bind(userId).run();
  return true;
}
async function removeUnion(env, unionId) {
  await env.DB.prepare('DELETE FROM union_applications WHERE union_id = ?1').bind(unionId).run();
  await env.DB.prepare('DELETE FROM union_members WHERE union_id = ?1').bind(unionId).run();
  await env.DB.prepare('DELETE FROM unions WHERE id = ?1').bind(unionId).run();
}

async function unionView(env, union, viewerRole) {
  const members = (await env.DB.prepare('SELECT m.role, m.post, m.contribution, m.joined_at, p.public_id, p.name, p.last_seen FROM union_members m JOIN players p ON p.user_id = m.user_id WHERE m.union_id = ?1').bind(union.id).all()).results || [];
  // 신청 목록은 연합장·부연합장에게만 내려보낸다(다른 연합원 화면은 숫자도 쓰지 않는다).
  const applications = ['leader', 'officer'].includes(viewerRole)
    ? (await env.DB.prepare('SELECT a.created_at, p.public_id, p.name FROM union_applications a JOIN players p ON p.user_id = a.user_id WHERE a.union_id = ?1 ORDER BY a.created_at LIMIT 50').bind(union.id).all()).results || []
    : [];
  return {
    id: union.id, name: union.name, emblem: parseEmblem(union.emblem), level: union.level, exp: union.exp, notice: union.notice, joinMode: union.join_mode, capacity: union.capacity, createdAt: union.created_at,
    members: members.map(m => ({ playerId: m.public_id, name: m.name, role: m.role, post: m.post, contribution: m.contribution, joinedAt: m.joined_at, lastSeen: m.last_seen })),
    applications: applications.map(a => ({ playerId: a.public_id, name: a.name, at: a.created_at }))
  };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `union:${user.id}`, 900, 3600000))) return tooMany();
  try {
    const query = new URL(request.url).searchParams.get('q');
    if (query !== null) {
      const needle = `%${query.trim().slice(0, 12).replace(/[\\%_]/g, char => `\\${char}`)}%`;
      const rows = (await env.DB.prepare(`SELECT u.*, (SELECT COUNT(*) FROM union_members m WHERE m.union_id = u.id) AS member_count FROM unions u WHERE u.name LIKE ?1 ESCAPE '\\' ORDER BY member_count DESC, u.created_at DESC LIMIT ?2`).bind(needle, LIST_LIMIT).all()).results || [];
      return json({ unions: rows.map(u => ({ id: u.id, name: u.name, emblem: parseEmblem(u.emblem), level: u.level, joinMode: u.join_mode, capacity: u.capacity, memberCount: u.member_count, notice: u.notice })) });
    }
    const player = await ensurePlayer(env, user.id);
    await touchPlayer(env, player);
    const member = await myMembership(env, user.id);
    const union = member ? await unionById(env, member.union_id) : null;
    return json({ me: { playerId: player.public_id, name: player.name }, union: union ? await unionView(env, union, member.role) : null });
  } catch (error) {
    if (isMissingTable(error)) return notReady();
    throw error;
  }
}

const NOT_IN_UNION = () => fail('가입한 연합이 없습니다.', 409, 'no-union');
const ACTIONS = {
  async create({ env, user, body }) {
    if (await myMembership(env, user.id)) return fail('이미 연합에 가입되어 있습니다.', 409, 'already-member');
    const name = String(body.name || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 12) return fail('연합 이름은 2~12자로 입력해 주세요.');
    if (hasBannedWord(name) || isReservedName(name)) return fail('사용할 수 없는 이름입니다.');
    const notice = cleanNotice(body.notice);
    if (hasBannedWord(notice)) return fail('공지에 사용할 수 없는 말이 있습니다.');
    const emblem = cleanEmblem(body.emblem);
    if (!emblem) return fail('엠블럼이 올바르지 않습니다.');
    const id = `u-${randomToken(8)}`;
    const created = await env.DB.prepare('INSERT INTO unions (id, name, name_key, emblem, notice, join_mode, capacity, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(name_key) DO NOTHING')
      .bind(id, name, nameKey(name), JSON.stringify(emblem), notice, body.joinMode === 'approval' ? 'approval' : 'open', CAPACITY, Date.now()).run();
    if (!created?.meta?.changes) return fail('이미 사용 중인 연합 이름입니다.', 409, 'name-taken');
    if (!(await addMember(env, id, user.id, 'leader'))) { await removeUnion(env, id); return fail('이미 연합에 가입되어 있습니다.', 409, 'already-member'); }
    return json({ status: 'created', union: await unionView(env, await unionById(env, id), 'leader') });
  },

  async join({ env, user, body }) {
    if (await myMembership(env, user.id)) return fail('이미 연합에 가입되어 있습니다.', 409, 'already-member');
    const union = await unionById(env, String(body.unionId));
    if (!union) return fail('연합을 찾을 수 없습니다.', 404, 'no-union');
    if (await countMembers(env, union.id) >= union.capacity) return fail('인원이 가득 찬 연합입니다.', 409, 'full');
    if (union.join_mode === 'approval') {
      const applied = await env.DB.prepare('INSERT INTO union_applications (union_id, user_id, created_at) VALUES (?1, ?2, ?3) ON CONFLICT DO NOTHING').bind(union.id, user.id, Date.now()).run();
      if (!applied?.meta?.changes) return fail('이미 가입 신청을 보냈습니다.', 409, 'already-applied');
      return json({ status: 'applied' });
    }
    if (!(await addMember(env, union.id, user.id))) return fail('인원이 가득 찬 연합입니다.', 409, 'full');
    return json({ status: 'joined' });
  },

  async leave({ env, user, member }) {
    if (!member) return NOT_IN_UNION();
    const count = await countMembers(env, member.union_id);
    if (member.role === 'leader' && count > 1) return fail('연합장은 위임한 뒤에 탈퇴할 수 있습니다.', 409, 'leader-must-transfer');
    if (count <= 1) await removeUnion(env, member.union_id);
    else await env.DB.prepare('DELETE FROM union_members WHERE user_id = ?1').bind(user.id).run();
    return json({ status: 'left' });
  },

  async update({ env, body, member }) {
    if (!member) return NOT_IN_UNION();
    if ('notice' in body) {
      if (!['leader', 'officer'].includes(member.role)) return fail('공지는 연합장과 부연합장만 수정할 수 있습니다.', 403, 'forbidden');
      const notice = cleanNotice(body.notice);
      if (hasBannedWord(notice)) return fail('공지에 사용할 수 없는 말이 있습니다.');
      await env.DB.prepare('UPDATE unions SET notice = ?1 WHERE id = ?2').bind(notice, member.union_id).run();
    }
    if ('joinMode' in body) {
      if (member.role !== 'leader') return fail('가입 방식은 연합장만 바꿀 수 있습니다.', 403, 'forbidden');
      if (!JOIN_MODES.includes(body.joinMode)) return fail('가입 방식이 올바르지 않습니다.');
      await env.DB.prepare('UPDATE unions SET join_mode = ?1 WHERE id = ?2').bind(body.joinMode, member.union_id).run();
    }
    return json({ status: 'ok' });
  },

  async emblem({ env, body, member }) {
    if (!member) return NOT_IN_UNION();
    if (member.role !== 'leader') return fail('엠블럼은 연합장만 바꿀 수 있습니다.', 403, 'forbidden');
    const emblem = cleanEmblem(body.emblem);
    if (!emblem) return fail('엠블럼이 올바르지 않습니다.');
    await env.DB.prepare('UPDATE unions SET emblem = ?1 WHERE id = ?2').bind(JSON.stringify(emblem), member.union_id).run();
    return json({ status: 'ok', union: await unionView(env, await unionById(env, member.union_id), member.role) });
  },

  async setRole({ env, body, member }) {
    if (!member) return NOT_IN_UNION();
    if (member.role !== 'leader') return fail('직책 변경은 연합장만 할 수 있습니다.', 403, 'forbidden');
    const target = await memberByPublic(env, member.union_id, body.target);
    if (!target) return fail('연합원을 찾을 수 없습니다.', 404, 'no-member');
    if (target.role === 'leader') return fail('연합장의 직책은 바꿀 수 없습니다.');
    if (!['officer', 'member'].includes(body.role)) return fail('올바르지 않은 직책입니다.');
    await env.DB.prepare('UPDATE union_members SET role = ?1 WHERE user_id = ?2').bind(body.role, target.user_id).run();
    return json({ status: 'ok' });
  },

  async kick({ env, body, member }) {
    if (!member) return NOT_IN_UNION();
    if (!['leader', 'officer'].includes(member.role)) return fail('추방 권한이 없습니다.', 403, 'forbidden');
    const target = await memberByPublic(env, member.union_id, body.target);
    if (!target) return fail('연합원을 찾을 수 없습니다.', 404, 'no-member');
    if (target.role === 'leader') return fail('연합장은 추방할 수 없습니다.');
    if (member.role === 'officer' && target.role !== 'member') return fail('부연합장은 연합원만 추방할 수 있습니다.', 403, 'forbidden');
    await env.DB.prepare('DELETE FROM union_members WHERE user_id = ?1').bind(target.user_id).run();
    return json({ status: 'ok' });
  },

  async application({ env, body, member }) {
    if (!member) return NOT_IN_UNION();
    if (!['leader', 'officer'].includes(member.role)) return fail('신청 처리 권한이 없습니다.', 403, 'forbidden');
    const applicant = await env.DB.prepare('SELECT a.user_id FROM union_applications a JOIN players p ON p.user_id = a.user_id WHERE a.union_id = ?1 AND p.public_id = ?2').bind(member.union_id, String(body.target)).first();
    if (!applicant) return fail('신청을 찾을 수 없습니다.', 404, 'no-application');
    if (!body.approve) {
      await env.DB.prepare('DELETE FROM union_applications WHERE union_id = ?1 AND user_id = ?2').bind(member.union_id, applicant.user_id).run();
      return json({ status: 'rejected' });
    }
    if (await myMembership(env, applicant.user_id)) {
      await env.DB.prepare('DELETE FROM union_applications WHERE user_id = ?1').bind(applicant.user_id).run();
      return fail('이미 다른 연합에 가입한 함장입니다.', 409, 'already-member');
    }
    if (!(await addMember(env, member.union_id, applicant.user_id))) return fail('인원이 가득 찼습니다.', 409, 'full');
    return json({ status: 'approved' });
  },

  async transfer({ env, user, body, member }) {
    if (!member) return NOT_IN_UNION();
    if (member.role !== 'leader') return fail('연합장만 위임할 수 있습니다.', 403, 'forbidden');
    const target = await memberByPublic(env, member.union_id, body.target);
    if (!target || target.user_id === user.id) return fail('연합원을 찾을 수 없습니다.', 404, 'no-member');
    await env.DB.prepare('UPDATE union_members SET role = ?1 WHERE user_id = ?2').bind('leader', target.user_id).run();
    await env.DB.prepare('UPDATE union_members SET role = ?1 WHERE user_id = ?2').bind('officer', user.id).run();
    return json({ status: 'ok' });
  },

  async disband({ env, member }) {
    if (!member) return NOT_IN_UNION();
    if (member.role !== 'leader') return fail('연합장만 해체할 수 있습니다.', 403, 'forbidden');
    if (await countMembers(env, member.union_id) > 1) return fail('연합원이 남아 있으면 해체할 수 없습니다.', 409, 'has-members');
    await removeUnion(env, member.union_id);
    return json({ status: 'disbanded' });
  }
};

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'db-unavailable' }, 503);
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await allow(env, `union-act:${user.id}`, 300, 3600000))) return tooMany();
  const text = await request.text();
  if (text.length > 8 * 1024) return json({ error: 'too-large' }, 413);
  let body;
  try { body = JSON.parse(text); } catch (_) { return json({ error: 'bad-json' }, 400); }
  const action = Object.hasOwn(ACTIONS, body?.action) ? ACTIONS[body.action] : null;
  if (!action) return json({ error: 'bad-request' }, 400);
  try {
    await ensurePlayer(env, user.id);
    return await action({ env, user, body, member: await myMembership(env, user.id) });
  } catch (error) {
    if (isMissingTable(error)) return notReady();
    throw error;
  }
}
