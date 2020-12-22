export const b64Decode = (function(): (s: string) => string {
  if (isNodejs()) {
    return s => Buffer.from(s, 'base64').toString('binary');
  }
  return window.atob;
})();

export const generateID: () => string = (() => {
  if (isNodejs()) {
    const crypto = require('crypto');
    return () => {
      return crypto.randomBytes(16).toString('base64');
    };
  } else {
    return () => {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      //    note this only works for short sequences because it is recursive
      return btoa(String.fromCharCode.apply(null, Array.from(arr.values())));
    };
  }
})();

function isNodejs() {
  return (
    typeof 'process' !== 'undefined' &&
    process &&
    process.versions &&
    process.versions.node
  );
}
