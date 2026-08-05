// ===================================================
// functions/api/sales/[id].js
// DELETE /api/sales/:id  → 판매 기록 삭제 (D1)
// PUT    /api/sales/:id  → 판매 기록 수납 완료 상태변경 (D1)
// ===================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getDB(env) {
  return env.sonzilkingdb || env.DB;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestDelete({ env, params }) {
  const id = params.id;
  try {
    const db = getDB(env);
    await db.prepare("DELETE FROM sales WHERE id = ?").bind(id).run();
    return Response.json({ success: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestPut({ env, params, request }) {
  const id = params.id;
  try {
    const db = getDB(env);
    const body = await request.json();
    
    // unpaid 필드 업데이트 (boolean -> D1 integer)
    if (body.unpaid !== undefined) {
      const unpaidVal = body.unpaid ? 1 : 0;
      await db.prepare("UPDATE sales SET unpaid = ? WHERE id = ?")
        .bind(unpaidVal, id)
        .run();
    }

    return Response.json({ success: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
