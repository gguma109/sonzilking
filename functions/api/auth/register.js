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
    const { username, password, name, nickname, recoveryEmail } = body;

    if (!username || !password || !name) {
      return Response.json({ success: false, error: '필수 항목을 입력해주세요.' }, { status: 400, headers: CORS });
    }

    const passwordHash = await hashPassword(password);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    try {
      await db.prepare(`
        INSERT INTO users (id, username, passwordHash, name, nickname, recoveryEmail, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(id, username, passwordHash, name, nickname || '', recoveryEmail || '', createdAt)
        .run();
    } catch (dbError) {
      if (dbError.message.includes('UNIQUE constraint failed')) {
        return Response.json({ success: false, error: '이미 존재하는 아이디입니다.' }, { status: 400, headers: CORS });
      }
      throw dbError;
    }

    return Response.json({ success: true, message: '회원가입 성공' }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
