import { unescape, escape } from './escape';
import { ReverseTree, parseItemID } from './ReverseTree';
import { DocumentCheckpoint, Tombstone } from './types';

export type ListStore = {
  rt: ReverseTree;
  itemIDs: Array<string>;
};
export type ListMeta = {
  listID: string;
  docID: string;
};

function newList(
  docID: string,
  listID: string,
  actor: string
): {
  store: ListStore;
  meta: ListMeta;
  cmd: string[];
} {
  return {
    store: {
      itemIDs: [],
      rt: new ReverseTree(actor),
    },
    meta: {
      docID,
      listID,
    },
    cmd: ['mcreate', docID, listID],
  };
}

/**
 * Populates the store with the values given from a bootstrap'd
 * checkpoint, typically gotten from Room Service's API.
 * @param store
 * @param rawCheckpoint
 */
function importFromRawCheckpoint(
  store: ListStore,
  actor: string,
  rawCheckpoint: DocumentCheckpoint,
  listID: string
) {
  store.itemIDs = [];
  if (!rawCheckpoint.lists[listID]) {
    return; // no import
  }

  store.rt.import(actor, rawCheckpoint, listID);
  const list = rawCheckpoint.lists[listID];
  const ids = list.ids || [];
  for (let i = 0; i < ids.length; i++) {
    const val = rawCheckpoint.lists[listID].values[i];
    if (typeof val === 'object' && val['t'] === '') {
      continue; // skip tombstones
    }
    store.itemIDs.push(parseItemID(rawCheckpoint, ids[i]));
  }
}

/**
 * Validates an incoming command. Throws an error
 * if invalid.
 * @param meta
 * @param cmd A room service command
 */
function validateCommand(meta: ListMeta, cmd: string[]) {
  if (cmd.length < 3) {
    throw new Error('Unexpected command: ' + cmd);
  }
  const docID = cmd[1];
  const id = cmd[2];

  if (docID !== meta.docID || id !== meta.listID) {
    throw new Error('Command unexpectedly routed to the wrong client');
  }
}

/**
 * Applies a command to the in-memory store.
 * @param store
 * @param cmd A room service command
 */
function applyCommand(store: ListStore, cmd: string[]) {
  const keyword = cmd[0];

  switch (keyword) {
    case 'lins':
      const insAfter = cmd[3];
      const insItemID = cmd[4];
      const insValue = cmd[5];
      store.itemIDs.splice(
        store.itemIDs.findIndex(f => f === insAfter) + 1,
        0,
        insItemID
      );
      store.rt.insert(insAfter, insValue, insItemID);
      break;
    case 'lput':
      const putItemID = cmd[3];
      const putVal = cmd[4];
      store.rt.put(putItemID, putVal);
      break;
    case 'ldel':
      const delItemID = cmd[3];
      store.rt.delete(delItemID);
      store.itemIDs.splice(
        store.itemIDs.findIndex(f => f === delItemID),
        1
      );
      break;
    // These are technically "valid" in some places
    // but can be ignored here
    case 'lcreate':
      break;
    default:
      throw new Error('Unexpected command keyword: ' + keyword);
  }
}

function get<T extends any>(store: ListStore, index: number): T | undefined {
  let itemID = store.itemIDs[index];
  if (!itemID) return undefined;

  const val = store.rt.get(itemID);
  if (!val) return undefined;
  if (typeof val === 'object') {
    if ((val as Tombstone).t === '') {
      return undefined;
    }
    throw new Error('Unimplemented references');
  }

  return unescape(val) as T;
}

function runSet<T extends any>(
  store: ListStore,
  meta: ListMeta,
  index: number,
  val: T
): string[] {
  let itemID = store.itemIDs[index];
  if (!itemID) {
    throw new Error(
      `Index '${index}' doesn't already exist. Try .push() or .insertAfter() instead.`
    );
  }
  const escaped = escape(val as any);

  // Local
  store.rt.put(itemID, escaped);

  // Remote
  return ['lput', meta.docID, meta.listID, itemID, escaped];
}

function runDelete(
  store: ListStore,
  meta: ListMeta,
  index: number
): string[] | false {
  if (store.itemIDs.length === 0) {
    return false;
  }
  let itemID = store.itemIDs[index];
  if (!itemID) {
    console.warn('Unknown index: ', index, store.itemIDs);
    return false;
  }

  // Local
  store.rt.delete(itemID);
  store.itemIDs.splice(index, 1);

  // Remote
  return ['ldel', meta.docID, meta.listID, itemID];
}

function runInsertAt<T extends any>(
  store: ListStore,
  meta: ListMeta,
  index: number,
  val: T
): string[] {
  if (index < 0) {
    throw 'Negative indices unsupported';
  }
  let afterID: string;
  if (index === 0) {
    afterID = 'root';
  } else {
    afterID = store.itemIDs[index - 1];
  }

  if (!afterID) {
    throw new RangeError(`List '${meta.listID}' has no index: '${index}'`);
  }
  const escaped = escape(val as any);

  // Local
  const itemID = store.rt.insert(afterID, escaped);
  store.itemIDs.splice(index, 0, itemID);

  return ['lins', meta.docID, meta.listID, afterID, itemID, escaped];
}

function runInsertAfter<T extends any>(
  store: ListStore,
  meta: ListMeta,
  index: number,
  val: T
): string[] {
  return runInsertAt(store, meta, index + 1, val);
}

function runPushOne<T extends any>(
  store: ListStore,
  meta: ListMeta,
  val: T
): string[] {
  let lastID = store.rt.lastID();
  const escaped = escape(val as any);

  // Local
  const itemID = store.rt.insert(lastID, escaped);
  store.itemIDs.push(itemID);

  // Remote
  return ['lins', meta.docID, meta.listID, lastID, itemID, escaped];
}

function runPush<T extends any>(
  store: ListStore,
  meta: ListMeta,
  ...args: T[]
): string[][] {
  const cmds = [];
  for (let arg of args) {
    cmds.push(runPushOne(store, meta, arg));
  }

  return cmds;
}

function map<T extends any>(
  store: ListStore,
  fn: (val: T, index: number, key: string) => T[]
): T[] {
  return store.rt
    .preOrderTraverse()
    .map((idValue, i) =>
      fn(unescape(idValue.value) as T, i, idValue.id)
    ) as Array<T>;
}

function toArray<T extends any>(store: ListStore): T[] {
  return store.rt.toArray().map(m => unescape(m)) as any[];
}

export const ListInterpreter = {
  importFromRawCheckpoint,
  validateCommand,
  applyCommand,
  get,
  map,
  toArray,
  newList,
  runSet,
  runDelete,
  runInsertAt,
  runInsertAfter,
  runPush,
};
