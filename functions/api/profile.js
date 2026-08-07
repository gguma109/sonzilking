const CORS = { 'Content-Type': 'application/json' };

function getDB(env) { return env.sonzil || env.sonzilkingdb || env.DB; }

async function ensureProfileColumns(db) {
  const { results } = await db.prepare('PRAGMA table_info(users)').all();
  const existing = new Set(results.map(column => column.name));
  for (const column of ['businessName', 'representativeName', 'registrationNumber', 'businessEmail', 'phone']) {
    if (!existing.has(column)) await db.prepare(`ALTER TABLE users ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`).run();
  }
}

async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function publicUser(user) {
  return { id: user.id, username: user.username, name: user.name, nickname: user.nickname || '', recoveryEmail: user.recoveryEmail || '', createdAt: user.createdAt,
    businessName: user.businessName || '', representativeName: user.representativeName || '', registrationNumber: user.registrationNumber || '', businessEmail: user.businessEmail || '', phone: user.phone || '' };
}

export async function onRequestGet({ env, data }) {
  try {
    const db = getDB(env);
    await ensureProfileColumns(db);
    const user = await db.prepare('SELECT id, username, name, nickname, recoveryEmail, createdAt, businessName, representativeName, registrationNumber, businessEmail, phone FROM users WHERE id = ?').bind(data.userId).first();
    if (!user) return Response.json({ success: false, error: '회원정보를 찾을 수 없습니다.' }, { status: 404, headers: CORS });
    return Response.json({ success: true, user: publicUser(user) }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestPut({ env, request, data }) {
  try {
    const db = getDB(env);
    await ensureProfileColumns(db);
    const body = await request.json();
    const name = String(body.name || '').trim();
    const nickname = String(body.nickname || '').trim();
    const recoveryEmail = String(body.recoveryEmail || '').trim();
    const businessName = String(body.businessName || '').trim();
    const representativeName = String(body.representativeName || '').trim();
    const registrationNumber = String(body.registrationNumber || '').trim();
    const businessEmail = String(body.businessEmail || '').trim();
    const phone = String(body.phone || '').trim();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (!name) return Response.json({ success: false, error: '이름을 입력해주세요.' }, { status: 400, headers: CORS });
    if (newPassword && newPassword.length < 4) return Response.json({ success: false, error: '새 비밀번호는 4자 이상 입력해주세요.' }, { status: 400, headers: CORS });
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(data.userId).first();
    if (!user) return Response.json({ success: false, error: '회원정보를 찾을 수 없습니다.' }, { status: 404, headers: CORS });
    let passwordHash = user.passwordHash;
    if (currentPassword || newPassword) {
      if (!currentPassword || !newPassword) return Response.json({ success: false, error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' }, { status: 400, headers: CORS });
      if (await hashPassword(currentPassword) !== user.passwordHash) return Response.json({ success: false, error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 403, headers: CORS });
      passwordHash = await hashPassword(newPassword);
    }
    await db.prepare('UPDATE users SET name = ?, nickname = ?, recoveryEmail = ?, businessName = ?, representativeName = ?, registrationNumber = ?, businessEmail = ?, phone = ?, passwordHash = ? WHERE id = ?')
      .bind(name, nickname, recoveryEmail, businessName, representativeName, registrationNumber, businessEmail, phone, passwordHash, data.userId).run();
    const updated = await db.prepare('SELECT id, username, name, nickname, recoveryEmail, createdAt, businessName, representativeName, registrationNumber, businessEmail, phone FROM users WHERE id = ?').bind(data.userId).first();
    return Response.json({ success: true, user: publicUser(updated) }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}
