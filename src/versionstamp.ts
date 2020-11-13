/**
 * A tool to manipulate version stamps
 */
class VersionStamper {
  // Node and Browsers do this differently.
  // On Node, it's Buffer.from("mystring").toString("base64")
  // On Browsers, it's window.atob("mystring")
  private stringToB64: (data: string) => string;
  constructor(stringToB64: (data: string) => string) {
    this.stringToB64 = stringToB64;
  }

  private base64toArrayBuffer(vs: string) {
    var binary = this.stringToB64(vs);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
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

    // These are ALWAYS 10 bytes
    const olderArr = new Uint8Array(
      this.base64toArrayBuffer(older).slice(0, 9)
    );
    const newerArr = new Uint8Array(
      this.base64toArrayBuffer(newer).slice(0, 9)
    );

    for (let i = 0; i < olderArr.byteLength; i++) {
      if (newerArr[i] > olderArr[i]) return true;
      if (newerArr[i] < olderArr[i]) return false;
    }
    return false;
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
