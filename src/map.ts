import { unescape, escape } from './escape';
import { DocumentCheckpoint } from './types';

export type MapStore<T> = { [key: string]: number | string | object | T };
export type MapMeta = {
  mapID: string;
  docID: string;
};

/**
 * Populates the store with the values given from a bootstrap'd
 * checkpoint, typically gotten from Room Service's API.
 * @param store
 * @param rawCheckpoint
 */
function importFromRawCheckpoint<T>(
  store: MapStore<T>,
  rawCheckpoint: DocumentCheckpoint,
  mapID: string
) {
  for (const key of Object.keys(store)) {
    delete store[key];
  }

  if (!rawCheckpoint.maps[mapID]) {
    return; // no import
  }
  for (let k in rawCheckpoint.maps[mapID]) {
    const val = rawCheckpoint.maps[mapID][k];
    if (typeof val === 'string') {
      store[k] = unescape(val);
    }
  }
}

/**
 * Validates an incoming command. Throws an error
 * if invalid.
 * @param meta
 * @param cmd A room service command
 */
function validateCommand(meta: MapMeta, cmd: string[]) {
  if (cmd.length < 3) {
    throw new Error('Unexpected command: ' + cmd);
  }
  const docID = cmd[1];
  const id = cmd[2];

  if (docID !== meta.docID || id !== meta.mapID) {
    throw new Error('Command unexpectedly routed to the wrong client');
  }
}

/**
 * Applies a command to the in-memory store.
 * @param store
 * @param cmd A room service command
 */
function applyCommand<T>(store: MapStore<T>, cmd: string[]) {
  const keyword = cmd[0];

  const MALFORMED = 'Malformed command ';

  switch (keyword) {
    case 'mput':
      if (cmd.length !== 5) {
        console.error(MALFORMED, cmd);
        break;
      }
      const putKey = cmd[3];
      const putVal = cmd[4];
      store[putKey] = unescape(putVal);
      break;
    case 'mdel':
      if (cmd.length !== 4) {
        console.error(MALFORMED, cmd);
        break;
      }
      const delKey = cmd[3];
      delete store[delKey];
      break;
    // These are technically "valid" in some places
    // but can be ignored here
    case 'mcreate':
      break;
    default:
      throw new Error('Unexpected command keyword: ' + keyword);
  }
}

/**
 * Runs .set() on the store, returns the command for external use.
 * @param store
 * @param meta
 * @param key
 * @param value
 * @return {Array} ['mput', meta.docID, meta.mapID, key, escapedValue]
 */
function runSet<T>(
  store: MapStore<T>,
  meta: MapMeta,
  key: string,
  value: T
): string[] {
  const escaped = escape(value as any);

  // Local
  store[key] = value;

  // Remote
  return ['mput', meta.docID, meta.mapID, key, escaped];
}

/**
 * Runs .delete() on the store, returns the command for external use.
 * @param store
 * @param meta
 * @param key
 * @return {Array} ['mdel', meta.docID, meta.mapID, key]
 */
function runDelete<T>(
  store: MapStore<T>,
  meta: MapMeta,
  key: string
): string[] {
  // local
  delete store[key];

  // remote
  return ['mdel', meta.docID, meta.mapID, key];
}

/**
 * Returns the command to create a new map
 * @param docID
 * @param mapID
 */
function newMap<T extends any>(
  docID: string,
  mapID: string
): {
  store: MapStore<T>;
  meta: MapMeta;
  cmd: string[];
} {
  return {
    cmd: ['mcreate', docID, mapID],
    meta: {
      docID,
      mapID,
    },
    store: {},
  };
}

export const MapInterpreter = {
  validateCommand,
  applyCommand,
  newMap,
  importFromRawCheckpoint,
  runSet,
  runDelete,
};
