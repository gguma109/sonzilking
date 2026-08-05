// ===================================================
// functions/api/companies/[name]/balance.js
// GET /api/companies/:name/balance  ???¹ì • ?…ì²´??ë¯¸ìˆ˜ê¸??©ê³„ ì¡°íšŒ (D1)
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

export async function onRequestGet({ env, params }) {
  const companyName = decodeURIComponent(params.name);
  try {
    const db = getDB(env);
    const result = await db.prepare(`
      SELECT SUM(total) as balance 
      FROM sales 
      WHERE TRIM(LOWER(companyName)) = TRIM(LOWER(?)) AND unpaid = 1
    `).bind(companyName).first();

    const balance = result ? (result.balance || 0) : 0;

    return Response.json(
      { success: true, companyName, balance },
      { headers: CORS }
    );
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
