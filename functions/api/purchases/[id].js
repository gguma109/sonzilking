// functions/api/purchases/[id].js
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getDB(env) {
  return env.sonzil || env.sonzilkingdb || env.DB;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPut({ env, request, params, data }) {
  try {
    const db = getDB(env);
    const body = await request.json();
    const id = params.id;
    const userId = data.userId;

    const fields = [];
    const values = [];

    const updatable = [
      'companyName', 'date', 'kilos', 'unitPrice', 'total', 'kilosText', 'memo'
    ];

    for (const key of updatable) {
      if (body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (fields.length === 0) {
      return Response.json({ success: true, message: "No fields to update" }, { headers: CORS });
    }

    values.push(id);
    values.push(userId);
    
    const info = await db.prepare(`UPDATE purchases SET ${fields.join(', ')} WHERE id = ? AND userId = ?`)
      .bind(...values)
      .run();

    if (info.changes === 0) {
      return Response.json({ success: false, message: "Record not found or unauthorized" }, { status: 404, headers: CORS });
    }

    return Response.json({ success: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestDelete({ env, params, data }) {
  try {
    const db = getDB(env);
    const { id } = params;
    const userId = data.userId;

    const res = await db.prepare('DELETE FROM purchases WHERE id = ? AND userId = ?')
      .bind(id, userId)
      .run();
    return Response.json({ success: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
