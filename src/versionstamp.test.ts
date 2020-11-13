import { vsReader } from './versionstamp';

const reader = (s: string) => Buffer.from(s).toString('base64');
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
