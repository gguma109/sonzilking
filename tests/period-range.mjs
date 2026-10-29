import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// js/api.js는 브라우저 전역 스크립트라 필요한 함수만 꺼내 검사한다.
const source = readFileSync(new URL('../js/api.js', import.meta.url), 'utf8');
const context = { window: {}, document: { addEventListener() {} }, localStorage: {}, navigator: {} };
vm.runInNewContext(`${source}\nthis.getPeriodRangeQuery = getPeriodRangeQuery;`, context);
const range = context.getPeriodRangeQuery;

test('월 선택은 그 달 1일부터 다음 달 1일 전까지', () => {
  assert.equal(range('month', '2026-08'), 'from=2026-08-01&before=2026-09-01');
  assert.equal(range('month', '2026-12'), 'from=2026-12-01&before=2027-01-01');
  assert.equal(range('month', '2028-02'), 'from=2028-02-01&before=2028-03-01');
});

test('일 선택은 그날부터 다음 날 전까지', () => {
  assert.equal(range('day', '2026-08-31'), 'from=2026-08-31&before=2026-09-01');
  assert.equal(range('day', '2026-12-31'), 'from=2026-12-31&before=2027-01-01');
  assert.equal(range('day', '2028-02-28'), 'from=2028-02-28&before=2028-02-29');
});

test('값이 비었거나 형식이 틀리면 조회 조건을 만들지 않는다', () => {
  assert.equal(range('month', ''), '');
  assert.equal(range('day', '2026-08'), '');
  assert.equal(range('month', '2026-08-01'), '');
});
