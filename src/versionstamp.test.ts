import { isOlderVS } from './versionstamp';

test('compareVS(older, newer) === true, 1', () => {
  const older = 'AAAAOO4jk5UAAA==';
  const newer = 'AAAAOTKy5nUAAA==';
  expect(isOlderVS(older, newer)).toBeTruthy();
  expect(isOlderVS(newer, older)).toBeFalsy();
});

test('compareVS(older, newer) === true, 2', () => {
  const older = 'AAAAOTKy5nUAAA==';
  const newer = 'AAAAOW+nMK8AAA==';
  expect(isOlderVS(older, newer)).toBeTruthy();
  expect(isOlderVS(newer, older)).toBeFalsy();
});

const zero: string = 'AAAAAAAAAAAAAAo=';
const one: string = 'AAAAAAAAAAAAAQo=';
const zeroZero = 'AAAK';
const zeroTwo = 'AAIK';

test('0 < 1', () => {
  expect(isOlderVS(zero, one)).toEqual(true);
  expect(isOlderVS(one, zero)).toEqual(false);
});

test('00 < 1', () => {
  expect(isOlderVS(zeroZero, one)).toEqual(true);
  expect(isOlderVS(one, zeroZero)).toEqual(false);
});

test('02 > 1', () => {
  expect(isOlderVS(one, zeroTwo)).toEqual(true);
  expect(isOlderVS(zeroTwo, one)).toEqual(false);
});
