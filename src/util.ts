import { toByteArray } from 'base64-js';
import { nanoid } from 'nanoid';

export const b64Decode = (str: string): string =>
  String.fromCharCode.apply(null, Array.from(toByteArray(str).values()));

export const generateID = (): string => nanoid(16);
