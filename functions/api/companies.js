// ===================================================
// functions/api/companies.js
// GET /api/companies?type=sales|purchases
// PUT /api/companies → 업체명 일괄 변경
// ===================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getDB(env) {
  return env.sonzil || env.sonzilkingdb || env.DB;
}

function normalizeType(value) {
  return value === 'sales' || value === 'purchases' ? value : '';
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env, data }) {
  try {
    const type = normalizeType(new URL(request.url).searchParams.get('type'));
    if (!type) {
      return Response.json({ success: false, error: '판매 또는 수매 업체 유형을 선택해주세요.' }, { status: 400, headers: CORS });
    }

    const db = getDB(env);
    const table = type === 'sales' ? 'sales' : 'purchases';
    const { results } = await db.prepare(`
      SELECT companyName, COUNT(*) AS recordCount, MAX(COALESCE(date, createdAt)) AS lastUsedAt
      FROM ${table}
      WHERE userId = ? AND companyName IS NOT NULL AND TRIM(companyName) != ''
      GROUP BY companyName
      ORDER BY lastUsedAt DESC, companyName ASC
    `).bind(data.userId).all();

    const companies = results.map(row => ({
      name: row.companyName,
      recordCount: Number(row.recordCount) || 0,
      lastUsedAt: row.lastUsedAt || ''
    }));
    return Response.json({ success: true, type, companies }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestPut({ request, env, data }) {
  try {
    const body = await request.json();
    const type = normalizeType(body.type);
    const oldName = String(body.oldName || '').trim();
    const newName = String(body.newName || '').trim();
    if (!type || !oldName || !newName) {
      return Response.json({ success: false, error: '업체 유형과 변경 전·후 업체명을 모두 입력해주세요.' }, { status: 400, headers: CORS });
    }
    if (newName.length > 100) {
      return Response.json({ success: false, error: '업체명은 100자 이내로 입력해주세요.' }, { status: 400, headers: CORS });
    }
    if (oldName === newName) {
      return Response.json({ success: true, updated: 0 }, { headers: CORS });
    }

    const db = getDB(env);
    const existsIn = type === 'sales' ? 'sales' : 'purchases';
    const existing = await db.prepare(`SELECT COUNT(*) AS count FROM ${existsIn} WHERE userId = ? AND companyName = ?`)
      .bind(data.userId, oldName).first();
    if (!existing || Number(existing.count) === 0) {
      return Response.json({ success: false, error: '변경할 업체를 찾을 수 없습니다.' }, { status: 404, headers: CORS });
    }

    let results;
    if (type === 'sales') {
      const updates = [
        db.prepare('UPDATE sales SET companyName = ? WHERE userId = ? AND companyName = ?').bind(newName, data.userId, oldName),
        db.prepare('UPDATE payments SET companyName = ? WHERE userId = ? AND companyName = ?').bind(newName, data.userId, oldName)
      ];
      const statementsTable = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'statements'").first();
      if (statementsTable) {
        updates.push(
          db.prepare('UPDATE statements SET companyName = ?, content = REPLACE(content, ?, ?), updatedAt = ? WHERE userId = ? AND companyName = ?')
            .bind(newName, oldName, newName, new Date().toISOString(), data.userId, oldName)
        );
      }
      results = await db.batch(updates);
    } else {
      const updates = [
        db.prepare('UPDATE purchases SET companyName = ? WHERE userId = ? AND companyName = ?').bind(newName, data.userId, oldName)
      ];
      const statementsTable = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'statements'").first();
      if (statementsTable) {
        updates.push(
          db.prepare("UPDATE statements SET companyName = ?, content = REPLACE(content, ?, ?), updatedAt = ? WHERE userId = ? AND companyName = ? AND saleId LIKE 'purchase:%'")
            .bind(newName, oldName, newName, new Date().toISOString(), data.userId, oldName)
        );
      }
      results = await db.batch(updates);
    }

    const updated = results.reduce((sum, result) => sum + (Number(result.meta?.changes) || 0), 0);
    return Response.json({ success: true, updated }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}
