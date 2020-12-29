import { ReverseTree } from './ReverseTree';

test('reverse tree can insert items', () => {
  const rt = new ReverseTree('me');
  rt.insert({ after: 'root', value: 'dogs', localOrAck: 'local' });
  expect(rt.toArray()).toEqual(['dogs']);
});

test('reverse tree skips unreceived dependencies', () => {
  const rt = new ReverseTree('me');
  rt.import(
    {
      id: 'doc',
      actors: ['me', 'you', 'foo'],
      lists: {
        list: {
          // known, known, unknown, unknown
          ids: ['1:0', '2:0', '1:1', '1:2'],
          afters: ['root', '1:0', '1:2', '1:1'],
          values: ['cat', 'dog', 'bird', 'snake'],
        },
      },
    } as any,
    'list'
  );

  expect(rt.toArray()).toEqual(['cat', 'dog']);
});

test('reverse tree can insert lots of items', () => {
  const rt = new ReverseTree('me');

  const result: string[] = [];
  for (let i = 0; i < 20; i++) {
    result.splice(0, 0, `donut #${i}`);
    rt.insert({ after: 'root', value: `donut #${i}`, localOrAck: 'local' });
  }
  expect(rt.toArray()).toEqual(result);
});

test('reverse tree always returns the last id', () => {
  const rt = new ReverseTree('me');

  for (let i = 0; i < 20; i++) {
    rt.insert({ after: 'root', value: `${i}`, localOrAck: 'local' });
  }

  const arr = rt.toArray();
  //  later inserts after the root come first, so the last node in the array is
  //  the first that was inserted
  expect(rt.nodes.get(`0:me`)!.value).toEqual(arr[arr.length - 1]);
});

test('reverse tree doesnt interweave', () => {
  const rt = new ReverseTree('me');

  function insertFromActor(rt: ReverseTree, actor: string, word: string) {
    let after = 'root';
    for (let i = 0; i < word.length; i++) {
      after = rt.insert({
        after,
        value: word[i],
        externalNewID: `${i}:${actor}`,
        localOrAck: { ack: false, versionstamp: btoa(`${i}`) },
      });
    }
  }

  insertFromActor(rt, 'birds', 'birds');
  insertFromActor(rt, 'dogs', 'dogs');
  insertFromActor(rt, 'cats', 'cats');
  insertFromActor(rt, 'ants', 'ants');
  insertFromActor(rt, 'somereallylongtext', 'somereallylongtext');

  expect(rt.toArray().join('')).toEqual('antsbirdscatsdogssomereallylongtext');
});

test('reverse tree can delete items', () => {
  const rt = new ReverseTree('me');
  const first = rt.insert({ after: 'root', value: 'dog', localOrAck: 'local' });
  const second = rt.insert({ after: first, value: 'cat', localOrAck: 'local' });
  const third = rt.insert({
    after: second,
    value: 'bird',
    localOrAck: 'local',
  });
  expect(rt.toArray()).toEqual(['dog', 'cat', 'bird']);

  rt.delete(first, 'local');
  expect(rt.toArray()).toEqual(['cat', 'bird']);

  rt.delete(second, 'local');
  expect(rt.toArray()).toEqual(['bird']);

  rt.delete(third, 'local');
  expect(rt.toArray()).toEqual([]);
});

test('can add items after a deleted item', () => {
  const rt = new ReverseTree('me');
  const first = rt.insert({ after: 'root', value: 'dog', localOrAck: 'local' });
  const second = rt.insert({ after: first, value: 'cat', localOrAck: 'local' });

  rt.delete(second, 'local');
  rt.insert({ after: second, value: 'bird', localOrAck: 'local' });

  expect(rt.toArray()).toEqual(['dog', 'bird']);
});
