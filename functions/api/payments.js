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
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await db.prepare(`INSERT INTO payments (id, userId, createdAt, companyName, amount, memo) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, data.userId, createdAt, body.companyName, body.amount, body.memo || '')
      .run();

    return Response.json({ success: true, id, createdAt }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
