const CORS = { 'Content-Type': 'application/json' };

function getDB(env) { return env.sonzil || env.sonzilkingdb || env.DB; }

async function ensureRoleColumn(db) {
  const { results } = await db.prepare('PRAGMA table_info(users)').all();
  if (!results.some(column => column.name === 'role')) {
    await db.prepare("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'").run();
  }
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPut({ request, env, params, data }) {
  try {
    const db = getDB(env);
    await ensureRoleColumn(db);
    const owner = await db.prepare('SELECT id FROM users ORDER BY createdAt ASC, id ASC LIMIT 1').first();
    const actor = await db.prepare('SELECT id, role FROM users WHERE id = ?').bind(data.userId).first();
    const actorRole = owner?.id === actor?.id ? 'owner' : actor?.role === 'operator' ? 'operator' : 'member';
    if (!owner || !actor || actorRole === 'member') {
      return Response.json({ success: false, error: '관리자 또는 운영자만 비밀번호를 재설정할 수 있습니다.' }, { status: 403, headers: CORS });
    }

    const targetId = String(params.id || '');
    const target = await db.prepare('SELECT id, role FROM users WHERE id = ?').bind(targetId).first();
    if (!target) return Response.json({ success: false, error: '회원을 찾을 수 없습니다.' }, { status: 404, headers: CORS });
    if (target.id === actor.id) {
      return Response.json({ success: false, error: '본인 비밀번호는 내 정보 변경에서 바꿔주세요.' }, { status: 400, headers: CORS });
    }
    const targetRole = target.id === owner.id ? 'owner' : target.role === 'operator' ? 'operator' : 'member';
    if (actorRole === 'operator' && targetRole !== 'member') {
      return Response.json({ success: false, error: '운영자는 일반 회원의 비밀번호만 재설정할 수 있습니다.' }, { status: 403, headers: CORS });
    }

    const body = await request.json();
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 4) {
      return Response.json({ success: false, error: '새 비밀번호는 4자 이상 입력해주세요.' }, { status: 400, headers: CORS });
    }
    const passwordHash = await hashPassword(newPassword);
    await db.batch([
      db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').bind(passwordHash, targetId),
      db.prepare('DELETE FROM sessions WHERE userId = ?').bind(targetId)
    ]);
    return Response.json({ success: true }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}
