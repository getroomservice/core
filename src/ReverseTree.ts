import { NodeValue, DocumentCheckpoint } from './types';
import invariant from 'tiny-invariant';
import { isOlderVS } from './versionstamp';

interface Node {
  after?: string;
  value: NodeValue;
  id: string;
  versionstamp?: string;
  local: boolean;
}

interface IdValue {
  id: string;
  value: string;
}

interface Tree {
  childrenById: Map<string, Array<string>>;
  valueById: Map<string, NodeValue>;
}

export function parseItemID(
  checkpoint: DocumentCheckpoint,
  id: string
): string {
  if (id === 'root') {
    return 'root';
  }
  let [index, a] = id.split(':');
  return index + ':' + checkpoint.actors[parseInt(a)];
}

export type LocalOrAck = { ack: boolean; versionstamp: string } | 'local';

/**
 * A Reverse Tree is one where the children point to the
 * parents, instead of the otherway around.
 *
 * We use a reverse tree because the "insert" operation
 * can be done in parallel.
 */
export class ReverseTree {
  //  a token unique to this session used to create node IDs
  session: string;

  nodes: Map<string, Node> = new Map();

  constructor(session: string) {
    this.session = session;
  }

  import(actor: string, checkpoint: DocumentCheckpoint, listID: string) {
    invariant(checkpoint);

    this.session = actor;

    this.nodes = new Map();

    const list = checkpoint.lists[listID];
    const afters = list.afters || [];
    const ids = list.ids || [];
    const values = list.values || [];

    // Rehydrate the cache
    for (let i = 0; i < afters.length; i++) {
      const node = {
        after: parseItemID(checkpoint, afters[i]),
        id: parseItemID(checkpoint, ids[i]),
        value: values[i],
        versionstamp: checkpoint.vs,
        local: false,
      };
      this.nodes.set(node.id, node);
    }
  }

  get(itemID: string): NodeValue | undefined {
    return this.nodes.get(itemID)?.value;
  }

  insert(params: {
    after: 'root' | string;
    value: NodeValue;
    externalNewID?: string;
    localOrAck: LocalOrAck;
  }): string {
    const { after, value, externalNewID, localOrAck } = params;
    let id = externalNewID;
    if (!id) {
      //  TODO: with list GC implemented, count should be incremented higher than
      //  any node id instead of based on current number of active nodes
      id = `${this.nodes.size}:${this.session}`;
    }
    if (this.nodes.has(id)) {
      if (this.nodes.get(id)?.after === undefined) {
        this.nodes.get(id)!.after = after;
      }
      this.put(id, value, localOrAck);
      return id;
    }

    const node: Node = {
      after,
      value,
      id,
      local: localOrAck === 'local',
      versionstamp:
        (typeof localOrAck === 'object' && localOrAck.versionstamp) ||
        undefined,
    };
    this.nodes.set(id, node);
    return id;
  }

  put(itemID: string, value: NodeValue, localOrAck: LocalOrAck) {
    const existing = this.nodes.get(itemID);
    if (!existing) {
      //  handle out of order lput/ldel and lins
      this.nodes.set(itemID, {
        after: undefined,
        value,
        versionstamp:
          (typeof localOrAck === 'object' && localOrAck.versionstamp) ||
          undefined,
        id: itemID,
        local: localOrAck === 'local',
      });
      return;
    }

    if (localOrAck === 'local') {
      existing.value = value;
      existing.local = true;
      return;
    }

    const versionstamp = localOrAck.versionstamp;
    if (
      versionstamp &&
      existing.versionstamp &&
      isOlderVS(versionstamp, existing.versionstamp)
    ) {
      return;
    }

    const isLocalAck = existing.local && localOrAck.ack;
    if (isLocalAck) {
      //  ignore value
    } else {
      existing.value = value;
      existing.local = false;
    }
    existing.versionstamp = versionstamp;
  }

  has(itemID: string) {
    return this.nodes.has(itemID);
  }

  delete(itemID: string, localOrAck: LocalOrAck) {
    this.put(itemID, { t: '' }, localOrAck);
  }

  get length() {
    return Object.keys(this.nodes).length;
  }

  private toTree(): Tree {
    const childrenById = new Map<string, Array<string>>();
    const valueById = new Map<string, NodeValue>();

    for (const node of Array.from(this.nodes.values())) {
      if (node.after === undefined) {
        continue;
      }
      if (!childrenById.has(node.after)) {
        childrenById.set(node.after, []);
      }
      childrenById.get(node.after)?.push(node.id);
      valueById.set(node.id, node.value);
    }

    childrenById.forEach(children => {
      //  sort by logical timestamp descending so that latest inserts appear first
      children.sort((a, b) => {
        const [leftCount, leftActor] = a.split(':');
        const [rightCount, rightActor] = b.split(':');

        if (leftCount === rightCount) {
          return leftActor.localeCompare(rightActor);
        }

        return parseInt(rightCount) - parseInt(leftCount);
      });
    });

    return {
      childrenById,
      valueById,
    };
  }

  lastID(): string {
    if (this.nodes.size === 0) {
      return 'root';
    }

    const root = this.toTree();

    // Search the right side of the tree
    function right(t: Tree, node: string): string {
      const children = t.childrenById.get(node);
      if (!children || children.length === 0) {
        return node;
      }

      return right(t, children[children.length - 1]);
    }

    return right(root, 'root');
  }

  preOrderTraverse() {
    // -- Convert the log into a regular tree
    const tree = this.toTree();

    const seenNodes = new Set<string>();

    // -- Do a depth-first traversal to get the result
    function preOrder(t: Tree, node: string): IdValue[] {
      if (seenNodes.has(node)) {
        console.warn(
          'RoomService list cycle detected. Consider updating @roomservice/browser.'
        );
        return [];
      }
      seenNodes.add(node);

      let result: IdValue[] = [];
      const value = t.valueById.get(node);

      if (value) {
        if (typeof value === 'string') {
          result.push({ value, id: node });
        } else if ('t' in value && value.t === '') {
          //  Skip tombstones
        } else {
          throw new Error('Unimplemented');
        }
      }

      const children = t.childrenById.get(node);
      if (!children || children.length === 0) {
        return result;
      }

      for (let child of children) {
        result = result.concat(preOrder(t, child));
      }

      return result;
    }

    return preOrder(tree, 'root');
  }

  toArray(): Array<any> {
    return this.preOrderTraverse().map(idValue => idValue.value);
  }
}
