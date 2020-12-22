import { b64Decode } from './util';

export function isOlderVS(older: string, newer: string): boolean {
  if (!older) return true;
  if (!newer) return false;

  older = b64Decode(older);
  newer = b64Decode(newer);

  const maxLength = Math.max(older.length, newer.length);
  older = leftPadZero(older, maxLength);
  newer = leftPadZero(newer, maxLength);

  return older < newer;
}

function leftPadZero(input: string, desiredLen: number) {
  if (input.length < desiredLen) {
    return '\x00'.repeat(desiredLen - input.length) + input;
  }
  return input;
}
