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
  const { results } = await db.prepare(`
    SELECT s.* FROM sales s
    WHERE s.userId = ? AND NOT EXISTS (SELECT 1 FROM statements st WHERE st.userId = s.userId AND st.saleId = s.id)
  `).bind(userId).all();
  if (!results.length) return;
  const user = await db.prepare('SELECT name, nickname, username FROM users WHERE id = ?').bind(userId).first();
  const supplierName = user?.nickname || user?.name || user?.username || '손질왕';
  const now = new Date().toISOString();
  const statements = results.map(sale => db.prepare(`
    INSERT OR IGNORE INTO statements (id, userId, saleId, companyName, saleDate, total, content, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), userId, sale.id, sale.companyName, String(sale.date || sale.createdAt).slice(0, 10), Number(sale.total) || 0, buildStoredText(sale, supplierName), now, now));
  await db.batch(statements);
}

async function backfillPurchaseStatements(db, userId) {
  const { results } = await db.prepare(`
    SELECT p.* FROM purchases p
    WHERE p.userId = ? AND NOT EXISTS (SELECT 1 FROM statements st WHERE st.userId = p.userId AND st.saleId = 'purchase:' || p.id)
  `).bind(userId).all();
  if (!results.length) return;
  const user = await db.prepare('SELECT name, nickname, username FROM users WHERE id = ?').bind(userId).first();
  const receiverName = user?.nickname || user?.name || user?.username || '손질왕';
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

// 원본 판매·수매가 사라진 명세서를 지운다. 중복은 UNIQUE(userId, saleId)가 막는다.
async function cleanupStatements(db, userId) {
  await db.prepare(`
    DELETE FROM statements
    WHERE userId = ?
      AND (
        (saleId NOT LIKE 'purchase:%' AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.id = statements.saleId AND s.userId = statements.userId))
        OR
        (saleId LIKE 'purchase:%' AND NOT EXISTS (SELECT 1 FROM purchases p WHERE p.id = SUBSTR(statements.saleId, 10) AND p.userId = statements.userId))
      )
  `).bind(userId).run();
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// Build each company's cumulative unpaid sales once, rather than scanning
// the complete sales table separately for every statement.
export function attachPreviousBalances(records, sales, payments) {
  const groups = new Map();
  const paid = new Map(payments.map(row => [row.companyKey, Number(row.amount) || 0]));
  for (const sale of sales) {
    if (!groups.has(sale.companyKey)) groups.set(sale.companyKey, []);
    groups.get(sale.companyKey).push(sale);
  }
  for (const rows of groups.values()) {
    rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
    let sum = 0;
    for (const row of rows) { sum += Number(row.total) || 0; row.runningTotal = sum; }
  }
  return records.map(record => {
    const { companyKey, sourceDate, sourceCreatedAt, ...result } = record;
    if (record.statementType === 'purchase') return { ...result, previousBalance: null };
    const rows = groups.get(companyKey) || [];
    let lo = 0, hi = rows.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const row = rows[mid];
      if (row.date < sourceDate || (row.date === sourceDate && row.createdAt < sourceCreatedAt)) lo = mid + 1;
      else hi = mid;
    }
    return { ...result, previousBalance: Math.max(0, (lo ? rows[lo - 1].runningTotal : 0) - (paid.get(companyKey) || 0)) };
  });
}

const STATEMENT_SELECT = `
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
    TRIM(LOWER(st.companyName)) AS companyKey,
    s.date AS sourceDate, s.createdAt AS sourceCreatedAt
  FROM statements st
  LEFT JOIN sales s ON st.saleId NOT LIKE 'purchase:%' AND s.id = st.saleId AND s.userId = st.userId
  LEFT JOIN purchases p ON st.saleId LIKE 'purchase:%' AND p.id = SUBSTR(st.saleId, 10) AND p.userId = st.userId`;

// 목록 필터: 구분(판매/수매)과 거래처명 검색
function statementFilter(url) {
  const type = url.searchParams.get('type');
  const query = String(url.searchParams.get('q') || '').trim();
  const clauses = ['st.userId = ?'];
  const params = [];
  if (type === 'sale') clauses.push("st.saleId NOT LIKE 'purchase:%'");
  if (type === 'purchase') clauses.push("st.saleId LIKE 'purchase:%'");
  if (query) {
    clauses.push("st.companyName LIKE ? ESCAPE '\\'");
    params.push(`%${query.replace(/[\\%_]/g, char => `\\${char}`)}%`);
  }
  return { where: clauses.join(' AND '), params };
}

async function loadBalanceSources(db, userId, records) {
  if (!records.some(record => record.statementType === 'sale')) return { sales: [], payments: [] };
  const [sales, payments] = await Promise.all([
    db.prepare('SELECT date, createdAt, total, TRIM(LOWER(companyName)) AS companyKey FROM sales WHERE userId = ? AND unpaid = 1').bind(userId).all(),
    db.prepare('SELECT TRIM(LOWER(companyName)) AS companyKey, SUM(amount) AS amount FROM payments WHERE userId = ? GROUP BY TRIM(LOWER(companyName))').bind(userId).all()
  ]);
  return { sales: sales.results, payments: payments.results };
}

// ?limit=&offset= 으로 최근 명세서부터 나눠 읽는다. maintain=1일 때만 누락·고아 명세서를 정리한다.
// limit이 없으면 예전처럼 전체를 돌려준다(이전 화면 캐시 호환).
export async function onRequestGet({ env, request, data }) {
  try {
    const db = getDB(env);
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(0, Number.parseInt(url.searchParams.get('limit'), 10) || 0));
    const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset'), 10) || 0);
    const paged = limit > 0;
    await ensureTable(db);
    if (!paged || url.searchParams.get('maintain') === '1') {
      await cleanupStatements(db, data.userId);
      await backfillStatements(db, data.userId);
      await backfillPurchaseStatements(db, data.userId);
    }

    const { where, params } = statementFilter(url);
    const pageSql = `${STATEMENT_SELECT} WHERE ${where} ORDER BY st.saleDate DESC, st.updatedAt DESC, st.id DESC${paged ? ' LIMIT ? OFFSET ?' : ''}`;
    const { results } = await db.prepare(pageSql)
      .bind(data.userId, ...params, ...(paged ? [limit + 1, offset] : [])).all();
    const hasMore = paged && results.length > limit;
    const records = hasMore ? results.slice(0, limit) : results;

    const focusId = String(url.searchParams.get('focus') || '');
    let focused = null;
    if (focusId && !records.some(record => record.id === focusId)) {
      focused = await db.prepare(`${STATEMENT_SELECT} WHERE st.userId = ? AND st.id = ?`).bind(data.userId, focusId).first();
    }

    let total = null;
    if (paged && offset === 0) {
      const count = await db.prepare(`SELECT COUNT(*) AS count FROM statements st WHERE ${where}`).bind(data.userId, ...params).first();
      total = Number(count?.count) || 0;
    }

    const all = focused ? [...records, focused] : records;
    const { sales, payments } = await loadBalanceSources(db, data.userId, all);
    const withBalances = attachPreviousBalances(all, sales, payments);
    return Response.json({
      success: true,
      data: focused ? withBalances.slice(0, -1) : withBalances,
      focused: focused ? withBalances[withBalances.length - 1] : null,
      hasMore,
      total
    }, { headers: CORS });
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
