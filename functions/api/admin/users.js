const CORS = { 'Content-Type': 'application/json' };

function getDB(env) { return env.sonzil || env.sonzilkingdb || env.DB; }

async function getOwner(db) {
  return db.prepare('SELECT id FROM users ORDER BY createdAt ASC, id ASC LIMIT 1').first();
}

export async function onRequestGet({ env, data }) {
  try {
    const db = getDB(env);
    const owner = await getOwner(db);
    if (!owner || owner.id !== data.userId) {
      return Response.json({ success: false, isAdmin: false, error: '관리자만 접근할 수 있습니다.' }, { status: 403, headers: CORS });
    }
    const { results } = await db.prepare(`
      SELECT u.id, u.username, u.name, u.nickname, u.recoveryEmail, u.createdAt,
        (SELECT COUNT(*) FROM sales WHERE userId = u.id) AS salesCount,
        (SELECT COUNT(*) FROM purchases WHERE userId = u.id) AS purchasesCount,
        (SELECT COUNT(*) FROM payments WHERE userId = u.id) AS paymentsCount,
        (SELECT COUNT(*) FROM notes WHERE userId = u.id) AS notesCount,
        (SELECT COUNT(*) FROM statements WHERE userId = u.id) AS statementsCount
      FROM users u ORDER BY u.createdAt ASC, u.id ASC
    `).all();
    const users = results.map(user => ({
      ...user,
      isOwner: user.id === owner.id,
      totalRecords: Number(user.salesCount) + Number(user.purchasesCount) + Number(user.paymentsCount) + Number(user.notesCount) + Number(user.statementsCount)
    }));
    return Response.json({ success: true, isAdmin: true, data: users }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}
