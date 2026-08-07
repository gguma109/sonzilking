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

export async function onRequestGet({ env, data }) {
  try {
    const db = getDB(env);
    // 판매 총액, 누적 수납액, 남은 미수금을 함께 반환한다.
    // 완납된 업체도 목록에 남겨 상태를 구분할 수 있게 한다.
    const { results } = await db.prepare(`
      WITH ledger AS (
        SELECT companyName, total AS saleAmount, 0 AS paymentAmount
        FROM sales
        WHERE userId = ? AND unpaid = 1
        UNION ALL
        SELECT companyName, 0 AS saleAmount, amount AS paymentAmount
        FROM payments
        WHERE userId = ?
      ), totals AS (
        SELECT
          companyName,
          SUM(saleAmount) AS totalAmount,
          SUM(paymentAmount) AS paidAmount
        FROM ledger
        GROUP BY companyName
      )
      SELECT
        companyName,
        totalAmount,
        paidAmount,
        CASE WHEN totalAmount - paidAmount > 0 THEN totalAmount - paidAmount ELSE 0 END AS balance,
        CASE WHEN totalAmount - paidAmount <= 0 THEN 1 ELSE 0 END AS paidInFull
      FROM totals
      WHERE totalAmount > 0
      ORDER BY paidInFull ASC, balance DESC, companyName ASC
    `).bind(data.userId, data.userId).all();

    return Response.json(
      { success: true, data: results },
      { headers: CORS }
    );
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
