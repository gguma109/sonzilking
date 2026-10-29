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

// 테이블마다 회원별 건수를 한 번에 센다(회원 수만큼 반복해서 세지 않음).
async function countByUser(db, table) {
  const { results } = await db.prepare(`SELECT userId, COUNT(*) AS count FROM ${table} GROUP BY userId`).all();
  return new Map(results.map(row => [row.userId, Number(row.count) || 0]));
}

export async function onRequestGet({ env, request, data }) {
  try {
    const db = getDB(env);
    const { owner, actor, accessRole } = await getAccess(db, data.userId);
    if (!owner || !actor || accessRole === 'member') {
      return Response.json({ success: false, isAdmin: false, error: '관리자 또는 운영자만 접근할 수 있습니다.' }, { status: 403, headers: CORS });
    }
    // 메인 화면은 관리자 메뉴 표시 여부만 필요하다.
    if (new URL(request.url).searchParams.get('check') === '1') {
      return Response.json({ success: true, isAdmin: true, accessRole, currentUserId: actor.id }, { headers: CORS });
    }
    const [{ results }, sales, purchases, payments, notes, statements] = await Promise.all([
      db.prepare('SELECT id, username, name, nickname, recoveryEmail, role, createdAt FROM users ORDER BY createdAt ASC, id ASC').all(),
      countByUser(db, 'sales'),
      countByUser(db, 'purchases'),
      countByUser(db, 'payments'),
      countByUser(db, 'notes'),
      countByUser(db, 'statements')
    ]);
    const users = results.map(user => {
      const counts = {
        salesCount: sales.get(user.id) || 0,
        purchasesCount: purchases.get(user.id) || 0,
        paymentsCount: payments.get(user.id) || 0,
        notesCount: notes.get(user.id) || 0,
        statementsCount: statements.get(user.id) || 0
      };
      return {
        ...user,
        ...counts,
        role: user.id === owner.id ? 'owner' : user.role === 'operator' ? 'operator' : 'member',
        isOwner: user.id === owner.id,
        totalRecords: Object.values(counts).reduce((sum, count) => sum + count, 0)
      };
    });
    return Response.json({ success: true, isAdmin: true, accessRole, currentUserId: actor.id, data: users }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}
