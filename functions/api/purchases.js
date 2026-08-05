// ===================================================
// functions/api/purchases.js
// GET  /api/purchases  → 수매 기록 전체 조회 (D1)
// POST /api/purchases  → 수매 기록 저장 (D1)
// ===================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getDB(env) {
  return env.sonzil || env.sonzilkingdb || env.DB;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env }) {
  try {
    const db = getDB(env);
    const { results } = await db.prepare(
      "SELECT * FROM purchases ORDER BY date DESC, createdAt DESC"
    ).all();

    return Response.json(
      { success: true, data: results },
      { headers: CORS }
    );
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const db = getDB(env);
    const body = await request.json();
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = new Date().toISOString();

    await db.prepare(`
      INSERT INTO purchases (id, createdAt, companyName, date, kilos, unitPrice, total, memo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      createdAt,
      body.companyName,
      body.date,
      body.kilos || 0,
      body.unitPrice || 0,
      body.total || 0,
      body.memo || ''
    ).run();

    const savedRecord = {
      id,
      createdAt,
      ...body
    };

    return Response.json({ success: true, data: savedRecord }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
