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
    const amount = Number((await request.json()).amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ success: false, error: '올바른 수납 금액을 입력해주세요.' }, { status: 400, headers: CORS });
    }

    const db = getDB(env);
    const payment = await db.prepare('SELECT id, companyName FROM payments WHERE id = ? AND userId = ?')
      .bind(params.id, data.userId).first();
    if (!payment) {
      return Response.json({ success: false, error: '수납 기록을 찾을 수 없습니다.' }, { status: 404, headers: CORS });
    }

    const ledger = await db.prepare(`
      SELECT
        COALESCE((SELECT SUM(total) FROM sales WHERE userId = ? AND companyName = ? AND unpaid = 1), 0) AS salesTotal,
        COALESCE((SELECT SUM(amount) FROM payments WHERE userId = ? AND companyName = ? AND id != ?), 0) AS otherPayments
    `).bind(data.userId, payment.companyName, data.userId, payment.companyName, params.id).first();
    const maximum = Math.max(0, Number(ledger?.salesTotal) - Number(ledger?.otherPayments));
    if (amount > maximum) {
      return Response.json({ success: false, error: `수납 금액은 ${Math.round(maximum).toLocaleString('ko-KR')}원까지 입력할 수 있습니다.` }, { status: 400, headers: CORS });
    }

    await db.prepare('UPDATE payments SET amount = ? WHERE id = ? AND userId = ?')
      .bind(amount, params.id, data.userId).run();
    return Response.json({ success: true }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestDelete({ env, params, data }) {
  try {
    const db = getDB(env);
    const result = await db.prepare('DELETE FROM payments WHERE id = ? AND userId = ?')
      .bind(params.id, data.userId).run();
    if (!result.meta?.changes) {
      return Response.json({ success: false, error: '수납 기록을 찾을 수 없습니다.' }, { status: 404, headers: CORS });
    }
    return Response.json({ success: true }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}
