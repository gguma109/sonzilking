const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // 1. CORS Preflight 처리
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // 2. 인증이 필요 없는 라우트 패스
  if (url.pathname.includes('/auth/')) {
    return next();
  }

  // 3. 토큰 검사
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  const token = authHeader.split(' ')[1];
  const db = env.sonzil || env.sonzilkingdb || env.DB;

  try {
    const { results } = await db.prepare('SELECT userId FROM sessions WHERE token = ? AND expiresAt > ?')
      .bind(token, new Date().toISOString())
      .all();

    if (results.length === 0) {
      return Response.json({ success: false, error: 'Invalid or expired session' }, { status: 401, headers: CORS });
    }

    // 4. 하위 함수(API)에서 쓸 수 있도록 userId 전달
    context.data = { userId: results[0].userId };
    
    // 5. 다음 핸들러 실행 후 CORS 헤더 강제 주입
    const response = await next();
    const newResponse = new Response(response.body, response);
    Object.entries(CORS).forEach(([key, value]) => {
      newResponse.headers.set(key, value);
    });
    return newResponse;

  } catch (e) {
    return Response.json({ success: false, error: 'Auth middleware error: ' + e.message }, { status: 500, headers: CORS });
  }
}
