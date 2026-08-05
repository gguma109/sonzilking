// ===================================================
// functions/api/purchases/[id].js
// DELETE /api/purchases/:id  → 수매 기록 삭제
// ===================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestDelete({ env, params }) {
  const id = params.id;
  try {
    // 레코드 삭제
    await env.SONJILWANG_KV.delete(`purchases:${id}`);

    // 목록에서 제거
    const listJson = await env.SONJILWANG_KV.get('purchases:list');
    const ids = listJson ? JSON.parse(listJson) : [];
    await env.SONJILWANG_KV.put('purchases:list', JSON.stringify(ids.filter(i => i !== id)));

    return Response.json({ success: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
