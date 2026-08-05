// functions/api/notes/[id].js
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getDB(env) {
  return env.sonzil || env.sonzilkingdb || env.DB;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestDelete({ env, params, data }) {
  try {
    const db = getDB(env);
    await db.prepare(`DELETE FROM notes WHERE id = ? AND userId = ?`).bind(params.id, data.userId).run();
    return Response.json({ success: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
