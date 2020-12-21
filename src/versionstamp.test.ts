import { vsReader } from './versionstamp';

const reader = (s: string) => Buffer.from(s, 'base64').toString('binary');
const vs = vsReader(reader);
test('compareVS(older, newer) === true, 1', () => {
  const older = 'AAAAOO4jk5UAAA==';
  const newer = 'AAAAOTKy5nUAAA==';
  expect(vs.isOlderVS(older, newer)).toBeTruthy();
  expect(vs.isOlderVS(newer, older)).toBeFalsy();
});

test('compareVS(older, newer) === true, 2', () => {
  const older = 'AAAAOTKy5nUAAA==';
  const newer = 'AAAAOW+nMK8AAA==';
  expect(vs.isOlderVS(older, newer)).toBeTruthy();
  expect(vs.isOlderVS(newer, older)).toBeFalsy();
});

const zero: string = 'AAAAAAAAAAAAAAo=';
const one: string = 'AAAAAAAAAAAAAQo=';

test('0 < 1', () => {
  expect(vs.isOlderVS(zero, one)).toEqual(true);
  expect(vs.isOlderVS(one, zero)).toEqual(false);
});
