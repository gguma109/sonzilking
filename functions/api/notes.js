// functions/api/notes.js
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getDB(env) {
  return env.sonzil || env.sonzilkingdb || env.DB;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env }) {
  try {
    const db = getDB(env);
    const { results } = await db.prepare(`SELECT * FROM notes ORDER BY createdAt DESC`).all();
    return Response.json({ success: true, data: results }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    const db = getDB(env);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await db.prepare(`INSERT INTO notes (id, createdAt, content) VALUES (?, ?, ?)`)
      .bind(id, createdAt, data.content)
      .run();

    return Response.json({ success: true, id, createdAt }, { headers: CORS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
