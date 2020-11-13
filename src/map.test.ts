import { MapInterpreter, MapStore, MapMeta } from './map';

test('MapInterpreter can set()', () => {
  const store: MapStore<any> = {};
  const meta: MapMeta = {
    docID: 'doc',
    mapID: 'map',
  };
  const cmd = MapInterpreter.runSet(store, meta, 'dog', 'good');
  expect(store['dog']).toEqual('good');
  expect(cmd).toEqual(['mput', 'doc', 'map', 'dog', '"good"']);
});

test('MapInterpreter can delete()', () => {
  const store: MapStore<any> = {
    snake: 'bad',
  };
  const meta: MapMeta = {
    docID: 'doc',
    mapID: 'map',
  };
  const cmd = MapInterpreter.runDelete(store, meta, 'snake');
  expect(store['snake']).toBeFalsy();
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
    snake: 'bad',
  };
  MapInterpreter.applyCommand(store, ['mdel', 'doc', 'map', 'snake']);
  expect(store['snake']).toBeFalsy();
});

test('MapInterpreter can create a new map', () => {
  const cmd = MapInterpreter.newMap('doc', 'map').cmd;
  expect(cmd).toEqual(['mcreate', 'doc', 'map']);
});
