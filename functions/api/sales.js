// ===================================================
// functions/api/sales.js
// GET  /api/sales  → 판매 기록 전체 조회 (D1)
// POST /api/sales  → 판매 기록 저장 (D1)
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
      "SELECT * FROM sales ORDER BY date DESC, createdAt DESC"
    ).all();

    // D1에서는 boolean이 1 또는 0으로 저장되므로 JS boolean으로 가공
    const data = results.map(r => ({
      ...r,
      unpaid: r.unpaid === 1
    }));

    return Response.json(
      { success: true, data },
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

    const unpaidVal = body.unpaid !== false ? 1 : 0;

    await db.prepare(`
      INSERT INTO sales (
        id, createdAt, companyName, date, kilos, unitPrice, kilosTotal,
        addQty, addPrice, addTotal, commissionRate, commissionAmount, total, unpaid, memo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      createdAt,
      body.companyName,
      body.date,
      body.kilos || 0,
      body.unitPrice || 0,
      body.kilosTotal || 0,
      body.addQty || 0,
      body.addPrice || 0,
      body.addTotal || 0,
      body.commissionRate || 0,
      body.commissionAmount || 0,
      body.total || 0,
      unpaidVal,
      body.memo || ''
    ).run();

    const savedRecord = {
      id,
      createdAt,
      ...body,
      unpaid: body.unpaid !== false
    };

    return Response.json({ success: true, data: savedRecord }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
