import { MapInterpreter, MapStore, MapMeta } from './map';

test('MapInterpreter can set()', () => {
  const store: MapStore<any> = {
    kv: new Map(),
    tombstoneCleanup: [],
  };
  const meta: MapMeta = {
    docID: 'doc',
    mapID: 'map',
  };
  const cmd = MapInterpreter.runSet(store, meta, 'dog', 'good');
  expect(store.kv.get('dog')?.value).toEqual('good');
  expect(cmd).toEqual(['mput', 'doc', 'map', 'dog', '"good"']);
});

test('MapInterpreter can delete()', () => {
  const store: MapStore<any> = {
    kv: new Map([['snake', { value: 'bad', local: false }]]),
    tombstoneCleanup: [],
  };
  const meta: MapMeta = {
    docID: 'doc',
    mapID: 'map',
  };
  const cmd = MapInterpreter.runDelete(store, meta, 'snake');
  expect(store.kv.get('snake')?.value).toBeUndefined();
  expect(cmd).toEqual(['mdel', 'doc', 'map', 'snake']);
});

test('MapInterpreter can validate a bad command', () => {
  const meta: MapMeta = {
    docID: 'doc',
    mapID: 'map',
  };

  expect(() => {
    MapInterpreter.validateCommand(meta, ['bad', 'cmd']);
  }).toThrow();
});

test('MapInterpreter can delete()', () => {
  const store: MapStore<any> = {
    kv: new Map([['snake', { value: 'bad', local: false }]]),
    tombstoneCleanup: [],
  };
  MapInterpreter.applyCommand(
    store,
    ['mdel', 'doc', 'map', 'snake'],
    btoa('1'),
    false
  );
  expect(store.kv.get('snake')?.value).toBeUndefined();
});

test('MapInterpreter delete() is cleaned up', () => {
  const store: MapStore<any> = {
    kv: new Map([['snake', { value: 'bad', local: false }]]),
    tombstoneCleanup: [],
  };
  MapInterpreter.applyCommand(
    store,
    ['mdel', 'doc', 'map', 'snake'],
    btoa('1'),
    false
  );

  MapInterpreter.applyCommand(
    store,
    ['mput', 'doc', 'map', 'othersnake', 'good'],
    btoa('2'),
    false
  );
  expect(store.kv.has('snake')).toBeFalsy();
});

test('MapInterpreter can create a new map', () => {
  const cmd = MapInterpreter.newMap('doc', 'map').cmd;
  expect(cmd).toEqual(['mcreate', 'doc', 'map']);
});

test('MapInterpreter ignores old versionstamps', () => {
  const { store } = MapInterpreter.newMap('doc', 'map');
  MapInterpreter.applyCommand(
    store,
    ['mput', 'doc', 'map', 'k', 'v1'],
    btoa('2'),
    false
  );
  MapInterpreter.applyCommand(
    store,
    ['mput', 'doc', 'map', 'k', 'v2'],
    btoa('1'),
    false
  );
  expect(store.kv.get('k')!.value).toEqual('v1');
});

test('MapInterpreter local ack inserts work correctly', () => {
  const { store, meta } = MapInterpreter.newMap('doc', 'map');
  MapInterpreter.applyCommand(
    store,
    ['mput', 'doc', 'map', 'k', 'v1'],
    btoa('2'),
    false
  );
  //  local edits value
  MapInterpreter.runSet(store, meta, 'k', 'vlocal');
  expect(store.kv.get('k')!.value).toEqual('vlocal');

  //  old vs ignored
  MapInterpreter.applyCommand(
    store,
    ['mput', 'doc', 'map', 'k', 'v2'],
    btoa('1'),
    false
  );
  expect(store.kv.get('k')!.value).toEqual('vlocal');

  //  old ack ignored
  MapInterpreter.applyCommand(
    store,
    ['mput', 'doc', 'map', 'k', 'v2'],
    btoa('1'),
    true
  );
  expect(store.kv.get('k')!.value).toEqual('vlocal');

  //  new ack value ignored
  MapInterpreter.applyCommand(
    store,
    ['mput', 'doc', 'map', 'k', 'v2'],
    btoa('3'),
    true
  );
  expect(store.kv.get('k')!.value).toEqual('vlocal');
  expect(store.kv.get('k')!.versionstamp).toEqual(btoa('3'));

  //  new ack value still ignored
  MapInterpreter.applyCommand(
    store,
    ['mput', 'doc', 'map', 'k', 'v2'],
    btoa('4'),
    true
  );
  expect(store.kv.get('k')!.value).toEqual('vlocal');
  expect(store.kv.get('k')!.versionstamp).toEqual(btoa('4'));

  //  newer non-ack overwrites local
  MapInterpreter.applyCommand(
    store,
    ['mput', 'doc', 'map', 'k', 'v2'],
    btoa('5'),
    false
  );
  expect(store.kv.get('k')!.value).toEqual('v2');
  expect(store.kv.get('k')!.versionstamp).toEqual(btoa('5'));
});

test('MapInterpreter local ack deletes work correctly', () => {
  const { store, meta } = MapInterpreter.newMap('doc', 'map');
  MapInterpreter.applyCommand(
    store,
    ['mput', 'doc', 'map', 'k', 'v1'],
    btoa('2'),
    false
  );
  //  local edits value
  MapInterpreter.runSet(store, meta, 'k', 'vlocal');
  expect(store.kv.get('k')!.value).toEqual('vlocal');

  //  old vs ignored
  MapInterpreter.applyCommand(
    store,
    ['mdel', 'doc', 'map', 'k'],
    btoa('1'),
    false
  );
  expect(store.kv.get('k')!.value).toEqual('vlocal');

  //  old ack ignored
  MapInterpreter.applyCommand(
    store,
    ['mdel', 'doc', 'map', 'k'],
    btoa('1'),
    true
  );
  expect(store.kv.get('k')!.value).toEqual('vlocal');

  //  new ack value ignored
  MapInterpreter.applyCommand(
    store,
    ['mdel', 'doc', 'map', 'k'],
    btoa('3'),
    true
  );
  expect(store.kv.get('k')!.value).toEqual('vlocal');
  expect(store.kv.get('k')!.versionstamp).toEqual(btoa('3'));

  //  new ack value still ignored
  MapInterpreter.applyCommand(
    store,
    ['mdel', 'doc', 'map', 'k'],
    btoa('4'),
    true
  );
  expect(store.kv.get('k')!.value).toEqual('vlocal');
  expect(store.kv.get('k')!.versionstamp).toEqual(btoa('4'));

  //  newer non-ack overwrites local
  MapInterpreter.applyCommand(
    store,
    ['mdel', 'doc', 'map', 'k'],
    btoa('5'),
    false
  );
  expect(store.kv.get('k')!.value).toBeUndefined();
  expect(store.kv.get('k')!.versionstamp).toEqual(btoa('5'));
});
