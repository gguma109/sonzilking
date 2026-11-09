import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const elements = new Map();
const context = vm.createContext({ window: {}, document: {
  addEventListener() {},
  getElementById(id) { if (!elements.has(id)) elements.set(id, { value: '', textContent: '' }); return elements.get(id); }
}, console });
for (const file of ['item_parser.js', 'math_parser.js', 'sales.js']) {
  vm.runInContext(fs.readFileSync(new URL('../js/' + file, import.meta.url), 'utf8'), context);
  if (file === 'item_parser.js') context.ItemParser = context.window.ItemParser;
}
context.formatNumber = value => Number(value).toLocaleString('ko-KR');
const parse = text => context.ItemParser.parseItems(text);

test('three deduction formats, spaces and commas produce signed amounts', () => {
  for (const line of ['배송비차감 - 5000원', '- 5000원', '- 차감 5000원', '-배송비 5,000원']) {
    const result = parse('광어 * 5kg * 13000원\n' + line);
    assert.equal(result.errors.length, 0, line);
    assert.equal(result.total, 60000, line);
    assert.equal(result.items[1].amount, -5000);
    assert.equal(result.items[1].quantity, 0);
  }
});
test('multiple deductions do not erase names or change fish quantities', () => {
  const result = parse('광어 * 5kg * 13000원\n차감 - 5000원\n-배송비 5000원');
  assert.equal(result.total, 55000);
  assert.equal(result.items[0].quantity, 5);
  assert.equal(result.items[1].name, '차감');
  assert.equal(result.items[2].name, '배송비');
});
test('legacy products, multiplication and direct amounts still work', () => {
  assert.equal(parse('광어 × 5kg × 13000원 + 우럭 * 2마리 * 10000원\n고등어 30000원').total, 115000);
});
test('ambiguous deductions and division report errors instead of guessed money', () => {
  for (const line of ['- 차감', '차감 - 5000원 2000원', '--5000원', '광어 * 5kg * 13000원 - 5000원', '광어 * 5/2kg * 13000원']) {
    assert.ok(parse(line).errors.length, line);
  }
});
test('sales preview and statement ledger agree on 55000', () => {
  const text = '광어 * 5kg * 13000원\n차감 - 5000원\n-배송비 5000원';
  context.document.getElementById('calc-kilos').value = text;
  context.document.getElementById('commission-rate').value = '';
  const values = context.calculateSales();
  assert.equal(values.grandTotal, 55000);
  const rows = context.getStatementItems({ kilosText: text, kilosTotal: values.kilosTotal });
  assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), 55000);
  assert.equal(rows[1].amount, -5000);
});

test('formal statement and statistics preserve deductions without negative quantity', () => {
  const scope = vm.createContext({ window: {}, document: { addEventListener() {} }, console });
  for (const file of ['item_parser.js', 'statements.js', 'item_statistics.js']) {
    vm.runInContext(fs.readFileSync(new URL('../js/' + file, import.meta.url), 'utf8'), scope);
    if (file === 'item_parser.js') scope.ItemParser = scope.window.ItemParser;
  }
  const text = '광어 * 5kg * 13000원\n배송비차감 - 5000원\n- 차감 5000원';
  const rows = scope.getFormalStatementItems({ kilosText: text, kilosTotal: 55000 });
  assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), 55000);
  assert.equal(rows[1].name, '배송비차감');
  const entries = scope.ItemParser.parseItems(text).items.map(item => ({ item }));
  const totals = scope.summarizeEntries(entries);
  assert.equal(totals.amount, 55000);
  assert.equal(totals.quantityText, '5kg');
});

test('negative sale offsets old receivables without pretending to be a cash payment', () => {
  const sales = [{ id: 'old', date: '2026-11-08', total: 130000 }, { id: 'today', date: '2026-11-09', total: -5000 }];
  const allocation = context.buildUnpaidAllocation(sales, [{ amount: 10000 }]);
  assert.equal(allocation.totalAmount, 125000);
  assert.equal(allocation.paidAmount, 10000);
  assert.equal(allocation.balance, 115000);
  assert.equal(allocation.sales[0].balance, 115000);
  assert.equal(allocation.sales[1].amount, -5000);
  assert.equal(allocation.sales[1].status, '차감');
});

test('standalone deduction can exceed today sales; surplus stays available for later sales', () => {
  const parsed = parse('광어 * 5kg * 13000원\n차감 - 70000원');
  assert.equal(parsed.total, -5000);
  const allocation = context.buildUnpaidAllocation([{ total: -70000 }, { total: 65000 }, { total: 10000 }], []);
  assert.equal(allocation.balance, 5000);
  assert.equal(allocation.sales.reduce((sum, sale) => sum + sale.balance, 0), 5000);
});
