import assert from 'node:assert/strict';
import { formatDate, formatShortDate, formatDateFull } from '../src/dateUtils.ts';

assert.equal(formatDate(null), 'da definire');
assert.equal(formatDate(''), 'da definire');
assert.equal(formatShortDate(null), '—');
assert.equal(formatShortDate(''), '—');

for (const invalid of ['2026-', '2026-0', '2026-05-', 'not-a-date']) {
  assert.doesNotThrow(() => formatDate(invalid), `formatDate should not throw for ${invalid}`);
  assert.doesNotThrow(() => formatShortDate(invalid), `formatShortDate should not throw for ${invalid}`);
  assert.doesNotThrow(() => formatDateFull(invalid), `formatDateFull should not throw for ${invalid}`);
  assert.equal(formatDate(invalid), 'data non valida');
  assert.equal(formatShortDate(invalid), '—');
  assert.equal(formatDateFull(invalid), 'data non valida');
}

assert.match(formatDate('2026-05-25'), /2026/);
assert.match(formatShortDate('2026-05-25'), /25/);
assert.match(formatDateFull('2026-05-25'), /2026/);

console.log('date formatter regression checks passed');
