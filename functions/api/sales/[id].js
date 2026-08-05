// functions/api/sales/[id].js
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

    // Build SET clause dynamically
    const fields = [];
    const values = [];

    // Fields that can be updated via PUT
    const updatable = [
      'companyName', 'date', 'kilos', 'unitPrice', 'kilosTotal', 'kilosText',
      'addQty', 'addPrice', 'addTotal', 'addText', 
      'commissionRate', 'commissionAmount', 'total', 'memo', 'unpaid'
    ];

    for (const key of updatable) {
      if (body[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'unpaid') {
          values.push((body[key] === false || body[key] === 0) ? 0 : 1);
        } else {
          values.push(body[key]);
        }
      }
    }

    if (fields.length === 0) {
      return Response.json({ success: true, message: "No fields to update" }, { headers: CORS });
    }

    values.push(id);
    
    await db.prepare(`UPDATE sales SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return Response.json({ success: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}

// DELETE is currently handled in functions/api/sales.js for /api/sales/:id? Wait, where is it handled?
// Oh, DELETE is handled by onRequestDelete here!
export async function onRequestDelete({ params, env }) {
  try {
    const db = getDB(env);
    await db.prepare(`DELETE FROM sales WHERE id = ?`).bind(params.id).run();
    return Response.json({ success: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
