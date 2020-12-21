/**
 * A tool to manipulate version stamps
 */
export class VersionStamper {
  // Node and Browsers do this differently.
  // On Node, it's Buffer.from("mystring", "base64").toString("binary")
  // On Browsers, it's window.atob("mystring")
  private b64Decode: (data: string) => string;
  constructor(b64Decode: (data: string) => string) {
    this.b64Decode = b64Decode;
  }

  /**
   * Given two version stamps, return true
   * if the first parameter is older than
   * the second one.
   * @param older
   * @param newer
   */
  isOlderVS(older: string, newer: string): boolean {
    if (!older) return true;
    if (!newer) return false;

    older = this.b64Decode(older);
    newer = this.b64Decode(newer);

    const maxLength = Math.max(older.length, newer.length);
    older = leftPadZero(older, maxLength);
    newer = leftPadZero(newer, maxLength);

    return older < newer;
  }
}

/**
 * Lets you manipulate version stamps
 *
 * @example
 * ```
 * // In node
 * const vs = vsReader((s) => Buffer.from(s).toString("base64"));
 * ```
 *
 * @example
 * ```
 * // In the browser
 * const vs = vsReader(window.atob)
 * ```
 *
 * @param stringToB64 {Function} converts strings to base64
 */
export function vsReader(
  stringToB64: (data: string) => string
): VersionStamper {
  return new VersionStamper(stringToB64);
}

function leftPadZero(input: string, desiredLen: number) {
  if (input.length < desiredLen) {
    return '\x00'.repeat(desiredLen - input.length) + input;
  }
  return input;
}
