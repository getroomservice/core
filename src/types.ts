import { ReverseTree } from './ReverseTree';

export interface Ref {
  type: 'map' | 'list';
  ref: string;
}

export interface Tombstone {
  t: '';
}

export type NodeValue = string | Ref | Tombstone;

export interface ListCheckpoint {
  afters: string[];
  ids: string[];
  values: string[];
}

export type MapCheckpoint = { [key: string]: NodeValue };

// A previous state of the document that came from superlume
export interface DocumentCheckpoint {
  id: string;
  index: number;
  api_version: number;
  vs: string;
  actors: { [key: number]: string };
  lists: { [key: string]: ListCheckpoint };
  maps: { [key: string]: MapCheckpoint };
}

export interface Document {
  lists: { [key: string]: ReverseTree };
  maps: { [key: string]: { [key: string]: any } };
  localIndex: number;
}

export interface DocumentContext {
  lists: { [key: string]: ReverseTree };
  maps: { [key: string]: { [key: string]: any } };
  localIndex: number;
  actor: string;
  id: string;
}

// Utility type to get the type of property
export type Prop<V, K extends keyof V> = V[K];
