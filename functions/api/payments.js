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

export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const companyName = url.searchParams.get('company');
    const db = getDB(env);
    
    let query = `SELECT * FROM payments ORDER BY createdAt DESC`;
    let params = [];
    
    if (companyName) {
      query = `SELECT * FROM payments WHERE companyName = ? ORDER BY createdAt DESC`;
      params = [companyName];
    }
    
    const { results } = await db.prepare(query).bind(...params).all();
    return Response.json({ success: true, data: results }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    const db = getDB(env);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const date = data.date || createdAt.split('T')[0];

    await db.prepare(`INSERT INTO payments (id, createdAt, companyName, date, amount, memo) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, createdAt, data.companyName, date, data.amount, data.memo || '')
      .run();

    return Response.json({ success: true, id, createdAt }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
