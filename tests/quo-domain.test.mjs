import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({});
vm.runInContext(readFileSync('quo-domain.js', 'utf8'), context);
const {paymentSummary, paymentStatusFromTotals} = context;
const plain = value => JSON.parse(JSON.stringify(value));

test('unpaid, partial, settled, overpaid and zero invoices', () => {
  for (const [total, paid, balance, credit, status] of [
    [195000, 0, 195000, 0, 'Unpaid'],
    [195000, 50000, 145000, 0, 'Part Paid'],
    [195000, 195000, 0, 0, 'Paid'],
    [195000, 200000, 0, 5000, 'Paid'],
    [0, 0, 0, 0, 'Paid'], [1, 0, 1, 0, 'Unpaid']
  ]) assert.deepEqual(plain(paymentSummary(total, paid)), {balanceMinor: balance, creditMinor: credit, status});
});

test('invalid minor-unit inputs are rejected on either argument', () => {
  for (const value of [-1, 0.1, NaN, Infinity, -Infinity, '100', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => paymentSummary(value, 0), /non-negative integer/);
    assert.throws(() => paymentSummary(0, value), /non-negative integer/);
  }
  assert.equal(paymentSummary(Number.MAX_SAFE_INTEGER, 0).balanceMinor, Number.MAX_SAFE_INTEGER);
});

test('payment view preserves legacy tolerance and fractional totals', () => {
  for (const total of [0, 0.004, 0.005, 0.006, 0.01, 10.005, 10.006, 1950, 2106.1234, -1]) {
    for (const paid of [0, 0.004, 0.005, 0.006, 0.01, 10, 1949.99, 1950, 2000, -1]) {
      const balance = Math.max(total - paid, 0);
      const expected = balance <= 0.005 ? 'Paid' : paid > 0.005 ? 'Part Paid' : 'Unpaid';
      assert.equal(paymentStatusFromTotals(total, paid, balance), expected, `${total}/${paid}`);
    }
  }
});
