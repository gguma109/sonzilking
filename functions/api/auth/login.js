const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getDB(env) {
  return env.sonzil || env.sonzilkingdb || env.DB;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
  try {
    const db = getDB(env);
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return Response.json({ success: false, error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400, headers: CORS });
    }

    const passwordHash = await hashPassword(password);
    
    // Check user
    const { results } = await db.prepare(`SELECT id, username, name, nickname FROM users WHERE username = ? AND passwordHash = ?`)
      .bind(username, passwordHash)
      .all();

    if (results.length === 0) {
      return Response.json({ success: false, error: '아이디 또는 비밀번호가 일치하지 않습니다.' }, { status: 401, headers: CORS });
    }

    const user = results[0];
    const token = crypto.randomUUID(); // Simple session token
    const createdAt = new Date().toISOString();
    // Expires in 30 days
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.prepare(`INSERT INTO sessions (token, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)`)
      .bind(token, user.id, createdAt, expiresAt)
      .run();

    return Response.json({ success: true, token, user }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
