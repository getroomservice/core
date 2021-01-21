export const b64Decode = (function(): (s: string) => string {
  if (isWeb()) {
    return window.atob;
  }
  if (isNodejs()) {
    return s => Buffer.from(s, 'base64').toString('binary');
  }
  if (isReactNative()) {
    const base64 = require('base64-js');
    //    note this only works for short sequences because it is recursive
    return (s: string) =>
      String.fromCharCode.apply(
        null,
        Array.from((base64.toByteArray(s) as Uint8Array).values())
      );
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
    //  note React Native also takes this branch, but needs "react-native-get-random-values" npm package installed
    return () => {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      //    note this only works for short sequences because it is recursive
      return btoa(String.fromCharCode.apply(null, Array.from(arr.values())));
    };
  }
})();

function isWeb(): boolean {
  return typeof document !== 'undefined';
}

function isNodejs(): boolean {
  return (
    typeof 'process' !== 'undefined' &&
    !!process &&
    !!process.versions &&
    !!process.versions.node
  );
}

function isReactNative(): boolean {
  return (
    typeof navigator !== 'undefined' && navigator.product === 'ReactNative'
  );
}
