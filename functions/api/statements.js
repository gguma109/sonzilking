const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getDB(env) {
  return env.sonzil || env.sonzilkingdb || env.DB;
}

async function ensureTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS statements (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      saleId TEXT NOT NULL,
      companyName TEXT NOT NULL,
      saleDate TEXT NOT NULL,
      total INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(userId, saleId)
    )
  `).run();
}

function formatAmount(value) {
  return Math.round(Number(value) || 0).toLocaleString('ko-KR');
}

function buildStoredText(sale, supplierName) {
  const date = String(sale.date || sale.createdAt || '').slice(0, 10).split('-');
  const issued = date.length === 3 ? `${Number(date[0])}년 ${Number(date[1])}월 ${Number(date[2])}일` : String(sale.date || '');
  const lines = [
    '거 래 명 세 서',
    `발급일: ${issued}`,
    `공급받는자: ${sale.companyName} 귀하`,
    `공급자: ${supplierName || '손질왕'}`,
    ''
  ];
  if (sale.kilosText) lines.push(`1. 판매내역 | ${sale.kilosText} | ${formatAmount(sale.kilosTotal)}원`);
  else if (Number(sale.kilosTotal) > 0) lines.push(`1. 판매금액 | ${formatAmount(sale.kilosTotal)}원`);
  if (sale.addText || Number(sale.addTotal) > 0) lines.push(`${lines.length - 4}. 부대비용${sale.addText ? ` | ${sale.addText}` : ''} | ${formatAmount(sale.addTotal)}원`);
  if (Number(sale.commissionAmount) > 0) lines.push(`${lines.length - 4}. 수수료 ${Number(sale.commissionRate) || 0}% | ${formatAmount(sale.commissionAmount)}원`);
  lines.push('', `금일 합계: ${formatAmount(sale.total)}원`);
  if (sale.memo) lines.push(`메모: ${sale.memo}`);
  lines.push('위 금액을 청구합니다.');
  return lines.join('\n');
}

async function backfillStatements(db, userId) {
  const user = await db.prepare('SELECT name, nickname, username FROM users WHERE id = ?').bind(userId).first();
  const supplierName = user?.nickname || user?.name || user?.username || '손질왕';
  const { results } = await db.prepare(`
    SELECT s.* FROM sales s
    LEFT JOIN statements st ON st.userId = s.userId AND st.saleId = s.id
    WHERE s.userId = ? AND st.id IS NULL
  `).bind(userId).all();
  if (!results.length) return;
  const now = new Date().toISOString();
  const statements = results.map(sale => db.prepare(`
    INSERT OR IGNORE INTO statements (id, userId, saleId, companyName, saleDate, total, content, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), userId, sale.id, sale.companyName, String(sale.date || sale.createdAt).slice(0, 10), Number(sale.total) || 0, buildStoredText(sale, supplierName), now, now));
  await db.batch(statements);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env, data }) {
  try {
    const db = getDB(env);
    await ensureTable(db);
    await backfillStatements(db, data.userId);
    const { results } = await db.prepare('SELECT * FROM statements WHERE userId = ? ORDER BY saleDate DESC, updatedAt DESC')
      .bind(data.userId).all();
    return Response.json({ success: true, data: results }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestPost({ env, request, data }) {
  try {
    const body = await request.json();
    const saleId = String(body.saleId || '').trim();
    const companyName = String(body.companyName || '').trim();
    const saleDate = String(body.saleDate || '').slice(0, 10);
    const content = String(body.content || '').trim();
    const total = Number(body.total) || 0;
    if (!saleId || !companyName || !saleDate || !content) {
      return Response.json({ success: false, error: '거래명세서 정보가 부족합니다.' }, { status: 400, headers: CORS });
    }

    const db = getDB(env);
    await ensureTable(db);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO statements (id, userId, saleId, companyName, saleDate, total, content, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(userId, saleId) DO UPDATE SET
        companyName = excluded.companyName,
        saleDate = excluded.saleDate,
        total = excluded.total,
        content = excluded.content,
        updatedAt = excluded.updatedAt
    `).bind(id, data.userId, saleId, companyName, saleDate, total, content, now, now).run();
    return Response.json({ success: true }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}
