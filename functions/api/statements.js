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

function buildStoredPurchaseText(purchase, receiverName) {
  const date = String(purchase.date || purchase.createdAt || '').slice(0, 10).split('-');
  const issued = date.length === 3 ? `${Number(date[0])}년 ${Number(date[1])}월 ${Number(date[2])}일` : String(purchase.date || '');
  const lines = [
    '거 래 명 세 서',
    '거래유형: 수매',
    `발급일: ${issued}`,
    `공급자: ${purchase.companyName}`,
    `공급받는자: ${receiverName || '손질왕'}`,
    ''
  ];
  if (purchase.kilosText) lines.push(`1. 수매내역 | ${purchase.kilosText} | ${formatAmount(purchase.total)}원`);
  else lines.push(`1. 수매금액 | ${formatAmount(purchase.total)}원`);
  lines.push('', `총 합계: ${formatAmount(purchase.total)}원`);
  if (purchase.memo) lines.push(`메모: ${purchase.memo}`);
  lines.push('위 금액을 지급합니다.');
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

async function backfillPurchaseStatements(db, userId) {
  const user = await db.prepare('SELECT name, nickname, username FROM users WHERE id = ?').bind(userId).first();
  const receiverName = user?.nickname || user?.name || user?.username || '손질왕';
  const { results } = await db.prepare(`
    SELECT p.* FROM purchases p
    LEFT JOIN statements st ON st.userId = p.userId AND st.saleId = 'purchase:' || p.id
    WHERE p.userId = ? AND st.id IS NULL
  `).bind(userId).all();
  if (!results.length) return;
  const now = new Date().toISOString();
  const statements = results.map(purchase => db.prepare(`
    INSERT OR IGNORE INTO statements (id, userId, saleId, companyName, saleDate, total, content, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), userId, `purchase:${purchase.id}`, purchase.companyName,
    String(purchase.date || purchase.createdAt).slice(0, 10), Number(purchase.total) || 0,
    buildStoredPurchaseText(purchase, receiverName), now, now
  ));
  await db.batch(statements);
}

async function cleanupStatements(db, userId) {
  await db.prepare(`
    DELETE FROM statements
    WHERE userId = ?
      AND (
        (saleId NOT LIKE 'purchase:%' AND saleId NOT IN (SELECT id FROM sales WHERE userId = ?))
        OR
        (saleId LIKE 'purchase:%' AND SUBSTR(saleId, 10) NOT IN (SELECT id FROM purchases WHERE userId = ?))
      )
  `).bind(userId, userId, userId).run();

  await db.prepare(`
    DELETE FROM statements
    WHERE userId = ? AND id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY saleId ORDER BY updatedAt DESC, createdAt DESC, id DESC
        ) AS rowNumber
        FROM statements WHERE userId = ?
      ) ranked WHERE rowNumber = 1
    )
  `).bind(userId, userId).run();
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env, data }) {
  try {
    const db = getDB(env);
    await ensureTable(db);
    await cleanupStatements(db, data.userId);
    await backfillStatements(db, data.userId);
    await backfillPurchaseStatements(db, data.userId);
    const { results } = await db.prepare(`
      SELECT st.*,
        CASE WHEN st.saleId LIKE 'purchase:%' THEN 'purchase' ELSE 'sale' END AS statementType,
        COALESCE(s.kilosText, p.kilosText, '') AS kilosText,
        COALESCE(s.kilosTotal, p.total, 0) AS kilosTotal,
        COALESCE(s.addText, '') AS addText,
        COALESCE(s.addTotal, 0) AS addTotal,
        COALESCE(s.commissionRate, 0) AS commissionRate,
        COALESCE(s.commissionAmount, 0) AS commissionAmount,
        COALESCE(s.memo, p.memo, '') AS memo,
        COALESCE(s.total, p.total, st.total, 0) AS transactionTotal,
        CASE WHEN st.saleId LIKE 'purchase:%' THEN NULL ELSE MAX(0,
          COALESCE((SELECT SUM(priorSale.total) FROM sales priorSale
            WHERE priorSale.userId = st.userId
              AND TRIM(LOWER(priorSale.companyName)) = TRIM(LOWER(st.companyName))
              AND priorSale.unpaid = 1
              AND (priorSale.date < s.date OR (priorSale.date = s.date AND priorSale.createdAt < s.createdAt AND priorSale.id != s.id))), 0) -
          COALESCE((SELECT SUM(amount) FROM payments
            WHERE userId = st.userId AND TRIM(LOWER(companyName)) = TRIM(LOWER(st.companyName))), 0)
        ) END AS previousBalance
      FROM statements st
      LEFT JOIN sales s ON st.saleId NOT LIKE 'purchase:%' AND s.id = st.saleId AND s.userId = st.userId
      LEFT JOIN purchases p ON st.saleId LIKE 'purchase:%' AND p.id = SUBSTR(st.saleId, 10) AND p.userId = st.userId
      WHERE st.userId = ? ORDER BY st.saleDate DESC, st.updatedAt DESC
    `)
      .bind(data.userId).all();
    return Response.json({ success: true, data: results }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}

export async function onRequestPost({ env, request, data }) {
  try {
    const body = await request.json();
    const statementType = body.statementType === 'purchase' ? 'purchase' : 'sale';
    const sourceId = String(body.sourceId || body.saleId || '').replace(/^purchase:/, '').trim();
    const saleId = statementType === 'purchase' ? `purchase:${sourceId}` : sourceId;
    let companyName = String(body.companyName || '').trim();
    let saleDate = String(body.saleDate || '').slice(0, 10);
    let content = String(body.content || '').trim();
    let total = Number(body.total) || 0;

    const db = getDB(env);
    await ensureTable(db);
    if (statementType === 'purchase' && sourceId) {
      const purchase = await db.prepare('SELECT * FROM purchases WHERE id = ? AND userId = ?')
        .bind(sourceId, data.userId).first();
      if (!purchase) {
        return Response.json({ success: false, error: '수매 기록을 찾을 수 없습니다.' }, { status: 404, headers: CORS });
      }
      const user = await db.prepare('SELECT name, nickname, username FROM users WHERE id = ?').bind(data.userId).first();
      companyName = purchase.companyName;
      saleDate = String(purchase.date || purchase.createdAt || '').slice(0, 10);
      total = Number(purchase.total) || 0;
      content = buildStoredPurchaseText(purchase, user?.nickname || user?.name || user?.username || '손질왕');
    }
    if (!saleId || !companyName || !saleDate || !content) {
      return Response.json({ success: false, error: '거래명세서 정보가 부족합니다.' }, { status: 400, headers: CORS });
    }

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
    const statement = await db.prepare('SELECT id FROM statements WHERE userId = ? AND saleId = ?')
      .bind(data.userId, saleId).first();
    return Response.json({ success: true, id: statement?.id || id }, { headers: CORS });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers: CORS });
  }
}
