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
    const result = await getDB(env).prepare('DELETE FROM statements WHERE id = ? AND userId = ?')
      .bind(params.id, data.userId).run();
    if (!result.meta?.changes) {
      return Response.json({ success: false, error: '거래명세서를 찾을 수 없습니다.' }, { status: 404, headers: CORS });
    }
    return Response.json({ success: true }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}
