// ===================================================
// functions/api/companies/[name]/balance.js
// GET /api/companies/:name/balance  → 특정 업체의 미수금 합계 조회
// ===================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env, params }) {
  const companyName = decodeURIComponent(params.name);
  try {
    const listJson = await env.SONJILWANG_KV.get('sales:list');
    const ids = listJson ? JSON.parse(listJson) : [];

    // 모든 판매기록에서 해당 업체의 미수(unpaid !== false) 건만 합산
    let balance = 0;

    await Promise.all(
      ids.map(async (id) => {
        const recordStr = await env.SONJILWANG_KV.get(`sales:${id}`);
        if (recordStr) {
          const record = JSON.parse(recordStr);
          if (
            record.companyName &&
            record.companyName.trim().toLowerCase() === companyName.trim().toLowerCase() &&
            record.unpaid !== false
          ) {
            balance += Number(record.total || 0);
          }
        }
      })
    );

    return Response.json(
      { success: true, companyName, balance },
      { headers: CORS }
    );
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
