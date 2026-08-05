// ===================================================
// functions/api/sales.js
// GET  /api/sales  → 판매 기록 전체 조회
// POST /api/sales  → 판매 기록 저장
// ===================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env }) {
  try {
    const listJson = await env.SONJILWANG_KV.get('sales:list');
    const ids = listJson ? JSON.parse(listJson) : [];

    const records = await Promise.all(
      ids.map(id =>
        env.SONJILWANG_KV.get(`sales:${id}`)
          .then(r => (r ? JSON.parse(r) : null))
          .catch(() => null)
      )
    );

    return Response.json(
      { success: true, data: records.filter(Boolean) },
      { headers: CORS }
    );
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json();
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const record = { id, createdAt: new Date().toISOString(), ...body };

    // 개별 레코드 저장
    await env.SONJILWANG_KV.put(`sales:${id}`, JSON.stringify(record));

    // 목록 업데이트 (최신순)
    const listJson = await env.SONJILWANG_KV.get('sales:list');
    const ids = listJson ? JSON.parse(listJson) : [];
    ids.unshift(id);
    await env.SONJILWANG_KV.put('sales:list', JSON.stringify(ids));

    // 업체명 목록 업데이트
    if (body.companyName) {
      await upsertCompany(env, body.companyName);
    }

    return Response.json({ success: true, data: record }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}

async function upsertCompany(env, name) {
  const listJson = await env.SONJILWANG_KV.get('companies:list');
  const companies = listJson ? JSON.parse(listJson) : [];
  if (!companies.includes(name)) {
    companies.push(name);
    await env.SONJILWANG_KV.put('companies:list', JSON.stringify(companies));
  }
}
