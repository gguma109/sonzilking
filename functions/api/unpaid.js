// ===================================================
// functions/api/unpaid.js
// GET /api/unpaid  → 모든 업체의 미수금 총합 목록 조회 (D1)
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

export async function onRequestGet({ env }) {
  try {
    const db = getDB(env);
    // 진짜 회계 장부식 계산: (판매 총액) - (수금 총액)
    const { results } = await db.prepare(`
      SELECT companyName, SUM(balance) as balance 
      FROM (
        SELECT companyName, total as balance FROM sales
        UNION ALL
        SELECT companyName, -amount as balance FROM payments
      )
      GROUP BY companyName 
      HAVING balance > 0
      ORDER BY balance DESC, companyName ASC
    `).all();

    return Response.json(
      { success: true, data: results },
      { headers: CORS }
    );
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
