/*
    Map consistency model
    `mput`: Last writer (highest versionstamp) wins. On a local put, we leave
    the existing versionstamp so that newer writes from others will overwrite
    it. The eventual versionstamped confirmation message of the local put
    will establish what versionstamp it was assigned and must be greater than
    the existing versionstamp. Note that acks of a value that was set locally
    update the versionstamp but leave the value so that we don't revert to an
    older value in the case of multiple updates happening locally before an
    ack is received.
    
    `mdel`: Last deleter wins. Instead of just deleting the key, we store the
    versionstamp of the delete (essentially a tombstone). This way, we can
    compare the versionstamp of future `mput`s to know whether they should
    un-delete the value or not. Tombstones are cleaned up after a short
    amount of time as they only need to outlive messages in-flight from Room
    Service.
*/

import { unescape, escape } from './escape';
import { DocumentCheckpoint } from './types';
import { isOlderVS } from './versionstamp';

export type MapStore<T> = {
  //  deletedAt is stored in tombstoneCleanup array so that oldest entries are
  //  checked first. It is also stored in the kv map to handle the delete -> set
  //  -> delete case, otherwise the cleanup from the first delete will
  //  prematurely clean up the second delete.
  kv: Map<
    string,
    {
      value?: number | string | object | T;
      versionstamp?: string;
      deletedAt?: number;
      local: boolean;
    }
  >;
  tombstoneCleanup: Array<{ key: string; deletedAt: number }>;
};
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
  store.kv.clear();
  store.tombstoneCleanup = [];

  if (!rawCheckpoint.maps[mapID]) {
    return; // no import
  }
  for (let k in rawCheckpoint.maps[mapID]) {
    const val = rawCheckpoint.maps[mapID][k];
    if (typeof val === 'string') {
      store.kv.set(k, {
        value: unescape(val),
        versionstamp: rawCheckpoint.vs,
        local: false,
      });
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

const MALFORMED = 'Malformed command ';

/**
 * Applies a command to the in-memory store.
 * @param store
 * @param cmd A room service command
 */
function applyCommand<T>(
  store: MapStore<T>,
  cmd: string[],
  versionstamp: string,
  ack: boolean
) {
  tombstoneCleanup(store);

  const keyword = cmd[0];

  switch (keyword) {
    case 'mput':
      return applyPut(store, cmd, versionstamp, ack);
    case 'mdel':
      return applyDelete(store, cmd, versionstamp, ack);
    // These are technically "valid" in some places
    // but can be ignored here
    case 'mcreate':
      break;
    default:
      throw new Error('Unexpected command keyword: ' + keyword);
  }
}

function applyPut<T>(
  store: MapStore<T>,
  cmd: string[],
  versionstamp: string,
  ack: boolean
) {
  if (cmd.length !== 5) {
    console.error(MALFORMED, cmd);
    return;
  }
  const putKey = cmd[3];
  const putVal = cmd[4];

  const existing = store.kv.get(putKey);
  const existingPutVersionstamp = existing?.versionstamp;
  if (
    existingPutVersionstamp &&
    isOlderVS(versionstamp, existingPutVersionstamp)
  ) {
    return;
  }

  const isPutLocalAck = (existing?.local ?? false) && ack;
  if (isPutLocalAck) {
    existing!.versionstamp = versionstamp;
    return;
  }

  store.kv.set(putKey, {
    value: unescape(putVal),
    versionstamp,
    local: false,
  });
}

function applyDelete<T>(
  store: MapStore<T>,
  cmd: string[],
  versionstamp: string,
  ack: boolean
) {
  if (cmd.length !== 4) {
    console.error(MALFORMED, cmd);
    return;
  }
  const delKey = cmd[3];
  const existingObj = store.kv.get(delKey);
  const existingDelVersionstamp = existingObj?.versionstamp;
  if (
    existingDelVersionstamp &&
    isOlderVS(versionstamp, existingDelVersionstamp)
  ) {
    return;
  }
  const now = performance.now();

  const isLocalAck = (existingObj?.local ?? false) && ack;
  if (isLocalAck) {
    existingObj!.versionstamp = versionstamp;
    return;
  }

  store.kv.set(delKey, {
    value: undefined,
    versionstamp,
    deletedAt: now,
    local: false,
  });
  store.tombstoneCleanup.push({
    key: delKey,
    deletedAt: now,
  });
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
  if (store.kv.has(key)) {
    //  inherit old versionstamp
    store.kv.get(key)!.value = value;
    store.kv.get(key)!.local = true;
  } else {
    store.kv.set(key, {
      value,
      versionstamp: undefined,
      local: true,
    });
  }

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
  tombstoneCleanup(store);

  const now = performance.now();
  const existingVS = store.kv.get(key)?.versionstamp;
  store.kv.set(key, {
    value: undefined,
    versionstamp: existingVS,
    deletedAt: now,
    local: true,
  });
  store.tombstoneCleanup.push({
    key: key,
    deletedAt: now,
  });

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
    store: {
      kv: new Map(),
      tombstoneCleanup: [],
    },
  };
}

const TOMBSTONE_TTL_MS: number = (() => {
  if (process.env.NODE_ENV === 'test') {
    return 0;
  }
  return 10 * 1000;
})();

function tombstoneCleanup<T>(store: MapStore<T>) {
  const now = performance.now();
  while (
    store.tombstoneCleanup.length > 0 &&
    now >= store.tombstoneCleanup[0].deletedAt + TOMBSTONE_TTL_MS
  ) {
    const key = store.tombstoneCleanup.shift()!.key;
    const entry = store.kv.get(key);
    if (!entry) {
      continue;
    }
    if (
      entry.value === undefined &&
      now >= (entry.deletedAt ?? 0) + TOMBSTONE_TTL_MS
    ) {
      store.kv.delete(key);
    }
  }
}

export const MapInterpreter = {
  validateCommand,
  applyCommand,
  newMap,
  importFromRawCheckpoint,
  runSet,
  runDelete,
};
