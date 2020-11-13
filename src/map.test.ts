import { MapInterpreter, MapStore, MapMeta } from './map';

test('MapInterpretter can set()', () => {
  const store: MapStore<any> = {};
  const meta: MapMeta = {
    docID: 'doc',
    mapID: 'map',
  };
  const cmd = MapInterpreter.runSet(store, meta, 'dog', 'good');
  expect(store['dog']).toEqual('good');
  expect(cmd).toEqual(['mput', 'doc', 'map', 'dog', '"good"']);
});

test('MapInterpretter can delete()', () => {
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

test('MapInterpretter can validate a bad command', () => {
  const meta: MapMeta = {
    docID: 'doc',
    mapID: 'map',
  };

  expect(() => {
    MapInterpreter.validateCommand(meta, ['bad', 'cmd']);
  }).toThrow();
});

test('MapInterpretter can delete()', () => {
  const store: MapStore<any> = {
    snake: 'bad',
  };
  MapInterpreter.applyCommand(store, ['mdel', 'doc', 'map', 'snake']);
  expect(store['snake']).toBeFalsy();
});
