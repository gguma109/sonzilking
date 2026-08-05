// ===================================================
// functions/api/companies.js
// GET /api/companies  → 모든 업체명 목록 조회 (D1)
// ===================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT DISTINCT companyName FROM (
        SELECT companyName FROM sales
        UNION
        SELECT companyName FROM purchases
      ) WHERE companyName IS NOT NULL AND companyName != ''
      ORDER BY companyName ASC
    `).all();

    const companies = results.map(r => r.companyName);

    return Response.json(
      { success: true, companies },
      { headers: CORS }
    );
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
