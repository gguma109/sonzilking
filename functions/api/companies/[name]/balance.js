// ===================================================
// functions/api/companies/[name]/balance.js
// GET /api/companies/:name/balance  → 특정 업체의 미수금 합계 조회 (D1)
// ===================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getDB(env) {
  return env.sonzil || env.sonzilkingdb || env.DB;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env, request, params, data }) {
  const companyName = decodeURIComponent(params.name);
  try {
    const db = getDB(env);
    const url = new URL(request.url);
    const beforeDate = url.searchParams.get('beforeDate');
    const beforeCreatedAt = url.searchParams.get('beforeCreatedAt');
    const excludeSaleId = url.searchParams.get('excludeSaleId') || '';
    const result = beforeDate && beforeCreatedAt ? await db.prepare(`
      SELECT
        COALESCE((SELECT SUM(total) FROM sales
          WHERE userId = ? AND TRIM(LOWER(companyName)) = TRIM(LOWER(?)) AND unpaid = 1
            AND (date < ? OR (date = ? AND createdAt < ? AND id != ?))), 0) -
        COALESCE((SELECT SUM(amount) FROM payments
          WHERE userId = ? AND TRIM(LOWER(companyName)) = TRIM(LOWER(?))), 0) AS balance
    `).bind(
      data.userId, companyName, beforeDate, beforeDate, beforeCreatedAt, excludeSaleId,
      data.userId, companyName
    ).first() : await db.prepare(`
      SELECT
        COALESCE((SELECT SUM(total) FROM sales
          WHERE userId = ? AND TRIM(LOWER(companyName)) = TRIM(LOWER(?)) AND unpaid = 1), 0) -
        COALESCE((SELECT SUM(amount) FROM payments
          WHERE userId = ? AND TRIM(LOWER(companyName)) = TRIM(LOWER(?))), 0) AS balance
    `).bind(data.userId, companyName, data.userId, companyName).first();

    const balance = Math.max(0, result ? (result.balance || 0) : 0);

    return Response.json(
      { success: true, companyName, balance },
      { headers: CORS }
    );
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
