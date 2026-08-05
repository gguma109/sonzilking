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

export async function onRequestPut({ params, request, env }) {
  try {
    const db = getDB(env);
    const body = await request.json();
    const id = params.id;

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
    
    await db.prepare(`UPDATE purchases SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return Response.json({ success: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestDelete({ params, env }) {
  try {
    const db = getDB(env);
    await db.prepare(`DELETE FROM purchases WHERE id = ?`).bind(params.id).run();
    return Response.json({ success: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
