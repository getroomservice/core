import { ListInterpreter } from './list';
import { DocumentCheckpoint, ListCheckpoint } from './types';

// helper
function checkpoint(
  listName: string,
  listValue: ListCheckpoint,
  actors: { [key: string]: string }
): DocumentCheckpoint {
  return {
    actors: actors,
    api_version: 0,
    id: 'doc',
    index: 0,
    lists: {
      [listName]: listValue,
    },
    maps: {},
    vs: '',
  };
}

test('new list create correct command', () => {
  expect(ListInterpreter.newList('doc', 'list', 'actor').cmd).toEqual([
    'mcreate',
    'doc',
    'list',
  ]);
});

test('list can import from checkpoint', () => {
  const { store } = ListInterpreter.newList('doc', 'list', 'actor');
  ListInterpreter.importFromRawCheckpoint(
    store,
    checkpoint(
      'list',
      {
        ids: ['0:0', '1:1', '1:0', '2:1'],
        afters: ['root', '0:0', '0:0', '1:1'],
        values: ['"okay"', '"alright cool"', '"right"', '"left"'],
      },
      {
        '0': 'gst_b355e9c9-f1d3-4233-a6c5-e75e1cd0e52c',
        '1': 'gst_b2b6d556-6d0a-4862-b196-6a6e4aa2ff33',
      }
    ),
    'list'
  );

  expect(ListInterpreter.toArray<string>(store)).toEqual([
    'okay',
    'alright cool',
    'left',
    'right',
  ]);
});

test('lists.push() creates multiple commands', () => {
  const { store, meta } = ListInterpreter.newList('doc', 'list', 'act');

  const cmds = ListInterpreter.runPush<any>(store, meta, 1, 2, 3);
  expect(cmds).toEqual([
    ['lins', 'doc', 'list', 'root', '0:act', '1'],
    ['lins', 'doc', 'list', '0:act', '1:act', '2'],
    ['lins', 'doc', 'list', '1:act', '2:act', '3'],
  ]);
});

test("lists don't include extra quotes", () => {
  const { store, meta } = ListInterpreter.newList('doc', 'list', 'coolactor');

  ListInterpreter.runPush<any>(store, meta, '"1"', '2', 3, '');
  expect(ListInterpreter.toArray(store)).toEqual(['"1"', '2', 3, '']);
});

test('lists.map()', () => {
  const { store, meta } = ListInterpreter.newList('doc', 'list', 'act');

  ListInterpreter.runPush<any>(store, meta, 1, 2, 3);
  expect(
    ListInterpreter.map(store, (val, index, key) => {
      return [val, index, key];
    })
  ).toEqual([
    [1, 0, '0:act'],
    [2, 1, '1:act'],
    [3, 2, '2:act'],
  ]);
});

describe('list.applyCommand', () => {
  test('lins', () => {
    const { store } = ListInterpreter.newList('doc', 'list', 'act');

    ListInterpreter.applyCommand(store, [
      'lins',
      'doc',
      'list',
      'root',
      '0:bob',
      '2',
    ]);

    expect(ListInterpreter.get<any>(store, 0)).toEqual(2);
  });

  test('ldel', () => {
    const { store, meta } = ListInterpreter.newList('doc', 'list', 'act');

    // ["dogs", "cats"]
    ListInterpreter.runPush(store, meta, 'dogs', 'cats');

    // delete "dogs"
    ListInterpreter.applyCommand(store, ['ldel', 'doc', 'list', '0:act']);

    // Expect ["cats"]
    expect(ListInterpreter.get<any>(store, 0)).toEqual('cats');
  });

  test('lput', () => {
    const { store, meta } = ListInterpreter.newList('doc', 'list', 'act');

    ListInterpreter.runPush(store, meta, 'dogs', 'cats');
    ListInterpreter.applyCommand(store, [
      'lput',
      'doc',
      'list',
      '0:act',
      'snakes',
    ]);

    expect(ListInterpreter.get<any>(store, 0)).toEqual('snakes');
  });
});

test('list.insertAfter()', () => {
  const { store, meta } = ListInterpreter.newList('doc', 'list', 'act');

  const insertAtCmd = ListInterpreter.runInsertAt(store, meta, 0, 'dogs');
  expect(insertAtCmd).toEqual([
    'lins',
    'doc',
    'list',
    'root',
    '0:act',
    '"dogs"',
  ]);

  const insertAfterCmd = ListInterpreter.runInsertAfter(store, meta, 0, 'cats');
  expect(insertAfterCmd).toEqual([
    'lins',
    'doc',
    'list',
    '0:act',
    '1:act',
    '"cats"',
  ]);

  expect(ListInterpreter.toArray(store)).toEqual(['dogs', 'cats']);
});
