// ===================================================
// functions/api/companies.js
// GET /api/companies  → 모든 업체명 목록 조회
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
    const listJson = await env.SONJILWANG_KV.get('companies:list');
    const companies = listJson ? JSON.parse(listJson) : [];
    return Response.json(
      { success: true, companies },
      { headers: CORS }
    );
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
