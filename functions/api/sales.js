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

// ?from=YYYY-MM-DD&before=YYYY-MM-DD 로 기간을 주면 그 기간만 읽는다(before는 미포함).
export function periodQuery(table, url) {
  const from = url.searchParams.get('from') || '';
  const before = url.searchParams.get('before') || '';
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!valid(from) || !valid(before)) {
    return { sql: `SELECT * FROM ${table} WHERE userId = ? ORDER BY date DESC, createdAt DESC`, params: [] };
  }
  // 두 조건을 나눠야 (userId, date, createdAt) 인덱스의 범위 검색을 각각 쓴다.
  return {
    sql: `SELECT * FROM ${table} WHERE userId = ?1 AND date >= ?2 AND date < ?3
      UNION ALL
      SELECT * FROM ${table} WHERE userId = ?1 AND date = '' AND createdAt >= ?2 AND createdAt < ?3
      ORDER BY date DESC, createdAt DESC`,
    params: [from, before]
  };
}

export async function onRequestGet({ env, request, data }) {
  try {
    const db = getDB(env);
    const userId = data.userId;
    const { sql, params } = periodQuery('sales', new URL(request.url));
    const { results } = await db.prepare(sql).bind(userId, ...params).all();

    // D1에서는 boolean이 1 또는 0으로 저장되므로 JS boolean으로 가공
    const responseData = results.map(r => ({
      ...r,
      unpaid: r.unpaid === 1
    }));

    return Response.json(
      { success: true, data: responseData },
      { headers: CORS }
    );
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestPost({ env, request, data }) {
  try {
    const db = getDB(env);
    const body = await request.json();
    const userId = data.userId;
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = new Date().toISOString();
    const date = body.date;

    await db.prepare(`
      INSERT INTO sales (
        id, userId, createdAt, companyName, date, 
        kilos, unitPrice, kilosTotal, kilosText,
        addQty, addPrice, addTotal, addText,
        commissionRate, commissionAmount, total, unpaid, memo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        id, userId, createdAt, body.companyName, date,
        body.kilos || 0, body.unitPrice || 0, body.kilosTotal || 0, body.kilosText || '',
        body.addQty || 0, body.addPrice || 0, body.addTotal || 0, body.addText || '',
        body.commissionRate || 0, body.commissionAmount || 0, body.total || 0, 
        (body.unpaid === false || body.unpaid === 0) ? 0 : 1, 
        body.memo || ''
      )
      .run();

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
