# Core

This is the core logic for the browser, react, and node clients.

## Interpretters

The Core exposes "interpreters" that are responsible for maintaining an object's state through commands.

### Example: MapInterpreter

```ts
import { MapInterpreter } from '@roomservice/core';

// ~~ Create a new list! ~~
const {
  // The `mcreate` command responsible for creating this list
  cmd,
  // An in-memory representation of the list
  store,
  // Metadata associated with the list
  meta,
} = MapInterpreter.newList('doc', 'map');

// Apply incoming commands
MapInterpreter.applyCommand(store, ['mput', 'doc', 'map', 'key', 'value']);

// Run functions and get the resulting commands
const cmd = MapInterpreter.runSet(store, meta, 'dogs', 'cats');
```
