const CORS = { 'Content-Type': 'application/json' };

function getDB(env) { return env.sonzil || env.sonzilkingdb || env.DB; }

async function ensureRoleColumn(db) {
  const { results } = await db.prepare('PRAGMA table_info(users)').all();
  if (!results.some(column => column.name === 'role')) {
    await db.prepare("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'").run();
  }
}

async function getAccess(db, userId) {
  await ensureRoleColumn(db);
  const owner = await db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY createdAt ASC, id ASC LIMIT 1").first()
    || await db.prepare('SELECT id FROM users ORDER BY createdAt ASC, id ASC LIMIT 1').first();
  const actor = await db.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first();
  const accessRole = owner?.id === actor?.id ? 'owner' : actor?.role === 'operator' ? 'operator' : 'member';
  return { owner, actor, accessRole };
}

export async function onRequestGet({ env, data }) {
  try {
    const db = getDB(env);
    const { owner, actor, accessRole } = await getAccess(db, data.userId);
    if (!owner || !actor || accessRole === 'member') {
      return Response.json({ success: false, isAdmin: false, error: '관리자 또는 운영자만 접근할 수 있습니다.' }, { status: 403, headers: CORS });
    }
    const { results } = await db.prepare(`
      SELECT u.id, u.username, u.name, u.nickname, u.recoveryEmail, u.role, u.createdAt,
        (SELECT COUNT(*) FROM sales WHERE userId = u.id) AS salesCount,
        (SELECT COUNT(*) FROM purchases WHERE userId = u.id) AS purchasesCount,
        (SELECT COUNT(*) FROM payments WHERE userId = u.id) AS paymentsCount,
        (SELECT COUNT(*) FROM notes WHERE userId = u.id) AS notesCount,
        (SELECT COUNT(*) FROM statements WHERE userId = u.id) AS statementsCount
      FROM users u ORDER BY u.createdAt ASC, u.id ASC
    `).all();
    const users = results.map(user => ({
      ...user,
      role: user.id === owner.id ? 'owner' : user.role === 'operator' ? 'operator' : 'member',
      isOwner: user.id === owner.id,
      totalRecords: Number(user.salesCount) + Number(user.purchasesCount) + Number(user.paymentsCount) + Number(user.notesCount) + Number(user.statementsCount)
    }));
    return Response.json({ success: true, isAdmin: true, accessRole, currentUserId: actor.id, data: users }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}
