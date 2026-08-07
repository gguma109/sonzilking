// functions/api/payments.js
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getDB(env) {
  return env.sonzil || env.sonzilkingdb || env.DB;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env, request, data }) {
  try {
    const url = new URL(request.url);
    const companyName = url.searchParams.get('company');
    const db = getDB(env);
    
    let query = `SELECT * FROM payments WHERE userId = ? ORDER BY createdAt DESC`;
    let params = [];
    
    if (companyName) {
      query = `SELECT * FROM payments WHERE companyName = ? AND userId = ? ORDER BY createdAt DESC`;
      params = [companyName, data.userId];
    } else {
      params = [data.userId];
    }
    
    const { results } = await db.prepare(query).bind(...params).all();
    return Response.json({ success: true, data: results }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    const body = await request.json();
    const db = getDB(env);
    const companyName = String(body.companyName || '').trim();
    const amount = Number(body.amount);

    if (!companyName || !Number.isFinite(amount) || amount <= 0) {
      return Response.json({ success: false, error: '업체명과 올바른 수납 금액을 입력해주세요.' }, { status: 400, headers: CORS });
    }

    const ledger = await db.prepare(`
      SELECT
        COALESCE((SELECT SUM(total) FROM sales WHERE userId = ? AND companyName = ? AND unpaid = 1), 0) -
        COALESCE((SELECT SUM(amount) FROM payments WHERE userId = ? AND companyName = ?), 0) AS balance
    `).bind(data.userId, companyName, data.userId, companyName).first();
    const balance = Math.max(0, Number(ledger?.balance) || 0);

    if (balance <= 0) {
      return Response.json({ success: false, error: '이미 완납된 업체입니다.' }, { status: 409, headers: CORS });
    }
    if (amount > balance) {
      return Response.json({ success: false, error: `남은 미수금 ${Math.round(balance).toLocaleString('ko-KR')}원보다 많이 수납할 수 없습니다.` }, { status: 400, headers: CORS });
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await db.prepare(`INSERT INTO payments (id, userId, createdAt, companyName, amount, memo) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, data.userId, createdAt, companyName, amount, body.memo || '')
      .run();

    return Response.json({ success: true, id, createdAt, remainingBalance: Math.max(0, balance - amount) }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
