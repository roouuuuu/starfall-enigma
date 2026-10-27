'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  dateOnly,
  shiftDateOnly,
  businessDayStart,
  businessDayEnd,
  isDateOnly
} = require('../src/utils');

test('business dates follow Asia/Jakarta regardless of host timezone', () => {
  assert.equal(dateOnly(new Date('2026-10-26T16:59:59.999Z')), '2026-10-26');
  assert.equal(dateOnly(new Date('2026-10-26T17:00:00.000Z')), '2026-10-27');
  assert.equal(businessDayStart('2026-10-27'), '2026-10-26T17:00:00.000Z');
  assert.equal(businessDayEnd('2026-10-27'), '2026-10-27T17:00:00.000Z');
  assert.equal(shiftDateOnly('2026-10-31', 1), '2026-11-01');
  assert.equal(shiftDateOnly('2026-03-01', -1), '2026-02-28');
  assert.equal(isDateOnly('2026-02-29'), false);
  assert.equal(isDateOnly('2028-02-29'), true);
});
