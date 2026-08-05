// ===================================================
// functions/api/sales/[id].js
// DELETE /api/sales/:id  → 판매 기록 삭제
// ===================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestDelete({ env, params }) {
  const id = params.id;
  try {
    // 레코드 삭제
    await env.SONJILWANG_KV.delete(`sales:${id}`);

    // 목록에서 제거
    const listJson = await env.SONJILWANG_KV.get('sales:list');
    const ids = listJson ? JSON.parse(listJson) : [];
    await env.SONJILWANG_KV.put('sales:list', JSON.stringify(ids.filter(i => i !== id)));

    return Response.json({ success: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestPut({ env, params, request }) {
  const id = params.id;
  try {
    const body = await request.json();
    const key = `sales:${id}`;
    const val = await env.SONJILWANG_KV.get(key);
    if (!val) {
      return Response.json({ success: false, error: 'Not Found' }, { status: 404, headers: CORS });
    }
    const record = JSON.parse(val);
    const updatedRecord = { ...record, ...body };
    await env.SONJILWANG_KV.put(key, JSON.stringify(updatedRecord));
    return Response.json({ success: true, data: updatedRecord }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
