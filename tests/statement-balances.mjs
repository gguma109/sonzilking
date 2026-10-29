import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const source = fs.readFileSync(new URL('../functions/api/statements.js', import.meta.url), 'utf8');
const { attachPreviousBalances } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('cumulative balances match the original correlated calculation', () => {
  let seed = 42;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let round = 0; round < 100; round++) {
    const sales = Array.from({ length: 200 }, () => ({
      companyKey: String(Math.floor(random() * 5)),
      date: '2026-10-' + String(Math.floor(random() * 5) + 1).padStart(2, '0'),
      createdAt: String(Math.floor(random() * 4)), total: Math.floor(random() * 10000)
    }));
    const payments = Array.from({ length: 5 }, (_, i) => ({ companyKey: String(i), amount: Math.floor(random() * 100000) }));
    const records = sales.map(s => ({ ...s, sourceDate: s.date, sourceCreatedAt: s.createdAt, statementType: 'sale' }));
    records.push({ companyKey: '0', statementType: 'purchase' }, { companyKey: 'missing', statementType: 'sale' });
    const actual = attachPreviousBalances(records, sales, payments);
    records.forEach((record, i) => {
      const prior = sales.filter(s => s.companyKey === record.companyKey &&
        (s.date < record.sourceDate || (s.date === record.sourceDate && s.createdAt < record.sourceCreatedAt)));
      const expected = record.statementType === 'purchase' ? null : Math.max(0,
        prior.reduce((sum, s) => sum + s.total, 0) - (payments.find(p => p.companyKey === record.companyKey)?.amount || 0));
      assert.equal(actual[i].previousBalance, expected);
      assert.equal('companyKey' in actual[i], false);
    });
  }
});
