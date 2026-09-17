import test from 'node:test';
import assert from 'node:assert/strict';
import { hasReadableContact } from './contactValidation.mjs';

test('rejects blank, whitespace, and punctuation-only OCR', () => {
  for (const text of ['', ' \n\t ', '... ---']) assert.equal(hasReadableContact(text, { fullName: '' }), false);
});
test('rejects missing or empty structured results even when OCR has text', () => {
  for (const parsed of [null, undefined, {}, { fullName: ' ', email: '' }, { notes: 'Random OCR text' }, { fullName: '---' }]) {
    assert.equal(hasReadableContact('Random OCR text', parsed), false);
  }
});
test('allows partial and international contacts for review', () => {
  assert.equal(hasReadableContact('Alex Morgan', { fullName: 'Alex Morgan' }), true);
  assert.equal(hasReadableContact('alex@example.com', { email: 'alex@example.com' }), true);
  assert.equal(hasReadableContact('محمد', { fullName: 'محمد' }), true);
  assert.equal(hasReadableContact('+1 202 555 0148', { phone: '+1 202 555 0148' }), true);
});
