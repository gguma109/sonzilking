const CORS = { 'Content-Type': 'application/json' };

function getDB(env) { return env.sonzil || env.sonzilkingdb || env.DB; }

export async function onRequestDelete({ env, params, data }) {
  try {
    const db = getDB(env);
    const owner = await db.prepare('SELECT id FROM users ORDER BY createdAt ASC, id ASC LIMIT 1').first();
    if (!owner || owner.id !== data.userId) {
      return Response.json({ success: false, error: '관리자만 접근할 수 있습니다.' }, { status: 403, headers: CORS });
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
