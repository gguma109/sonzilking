const CORS = { 'Content-Type': 'application/json' };

function getDB(env) { return env.sonzil || env.sonzilkingdb || env.DB; }

async function ensureRoleColumn(db) {
  const { results } = await db.prepare('PRAGMA table_info(users)').all();
  if (!results.some(column => column.name === 'role')) {
    await db.prepare("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'").run();
  }
}

async function getOwnerAndActor(db, userId) {
  await ensureRoleColumn(db);
  const owner = await db.prepare('SELECT id FROM users ORDER BY createdAt ASC, id ASC LIMIT 1').first();
  const actor = await db.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first();
  return { owner, actor };
}

export async function onRequestPut({ request, env, params, data }) {
  try {
    const db = getDB(env);
    const { owner, actor } = await getOwnerAndActor(db, data.userId);
    if (!owner || !actor || owner.id !== actor.id) {
      return Response.json({ success: false, error: '관리자만 운영자 권한을 변경할 수 있습니다.' }, { status: 403, headers: CORS });
    }
    const targetId = String(params.id || '');
    if (!targetId || targetId === owner.id) {
      return Response.json({ success: false, error: '관리자 계정의 권한은 변경할 수 없습니다.' }, { status: 400, headers: CORS });
    }
    const body = await request.json();
    const role = body.role === 'operator' ? 'operator' : body.role === 'member' ? 'member' : '';
    if (!role) {
      return Response.json({ success: false, error: '올바른 권한을 선택해주세요.' }, { status: 400, headers: CORS });
    }
    const target = await db.prepare('SELECT id FROM users WHERE id = ?').bind(targetId).first();
    if (!target) return Response.json({ success: false, error: '회원을 찾을 수 없습니다.' }, { status: 404, headers: CORS });
    await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, targetId).run();
    return Response.json({ success: true, role }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestDelete({ env, params, data }) {
  try {
    const db = getDB(env);
    const { owner, actor } = await getOwnerAndActor(db, data.userId);
    if (!owner || !actor || owner.id !== actor.id) {
      return Response.json({ success: false, error: '관리자만 회원을 삭제할 수 있습니다.' }, { status: 403, headers: CORS });
    }
    const targetId = String(params.id || '');
    if (!targetId || targetId === owner.id) {
      return Response.json({ success: false, error: '관리자 계정은 삭제할 수 없습니다.' }, { status: 400, headers: CORS });
    }
    const target = await db.prepare('SELECT id FROM users WHERE id = ?').bind(targetId).first();
    if (!target) return Response.json({ success: false, error: '회원을 찾을 수 없습니다.' }, { status: 404, headers: CORS });
    await db.batch([
      db.prepare('DELETE FROM statements WHERE userId = ?').bind(targetId),
      db.prepare('DELETE FROM payments WHERE userId = ?').bind(targetId),
      db.prepare('DELETE FROM notes WHERE userId = ?').bind(targetId),
      db.prepare('DELETE FROM purchases WHERE userId = ?').bind(targetId),
      db.prepare('DELETE FROM sales WHERE userId = ?').bind(targetId),
      db.prepare('DELETE FROM sessions WHERE userId = ?').bind(targetId),
      db.prepare('DELETE FROM users WHERE id = ?').bind(targetId)
    ]);
    return Response.json({ success: true }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}
