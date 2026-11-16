/**
 * The arguments of a tool, described once: the same object is the JSON Schema
 * a client reads (`inputSchema`) and what every call is checked against, so
 * what is described cannot drift from what is accepted. Only the few shapes
 * the tools need are supported.
 */

export type Field =
  | { readonly type: 'string'; readonly description: string; readonly pattern?: string; readonly enum?: readonly string[]; readonly maxLength?: number }
  | { readonly type: 'integer' | 'number'; readonly description: string; readonly minimum?: number; readonly maximum?: number }
  | { readonly type: 'boolean'; readonly description: string }
  | { readonly type: 'array'; readonly description: string; readonly items: ObjectSchema; readonly maxItems: number };

export interface ObjectSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, Field>>;
  readonly required?: readonly string[];
  readonly additionalProperties: false;
}

export class InvalidArguments extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidArguments';
  }
}

/** A Solana address or mint: base58, 32 to 44 characters. */
export const ADDRESS_PATTERN = '^[1-9A-HJ-NP-Za-km-z]{32,44}$';
/** A transaction signature: base58, 64 to 90 characters. */
export const SIGNATURE_PATTERN = '^[1-9A-HJ-NP-Za-km-z]{64,90}$';
/** A whole number of base units, as a decimal string. */
export const UNITS_PATTERN = '^[1-9][0-9]{0,29}$';

function checkField(name: string, field: Field, value: unknown): unknown {
  switch (field.type) {
    case 'string': {
      if (typeof value !== 'string') throw new InvalidArguments(`${name} must be a string`);
      if (value.length > (field.maxLength ?? 200)) throw new InvalidArguments(`${name} is too long`);
      if (field.enum && !field.enum.includes(value)) throw new InvalidArguments(`${name} must be one of: ${field.enum.join(', ')}`);
      if (field.pattern && !new RegExp(field.pattern).test(value)) throw new InvalidArguments(`${name} does not have the expected form`);
      return value;
    }
    case 'integer':
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new InvalidArguments(`${name} must be a number`);
      if (field.type === 'integer' && !Number.isInteger(value)) throw new InvalidArguments(`${name} must be a whole number`);
      if (field.minimum !== undefined && value < field.minimum) throw new InvalidArguments(`${name} must be at least ${field.minimum}`);
      if (field.maximum !== undefined && value > field.maximum) throw new InvalidArguments(`${name} must be at most ${field.maximum}`);
      return value;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') throw new InvalidArguments(`${name} must be true or false`);
      return value;
    }
    case 'array': {
      if (!Array.isArray(value)) throw new InvalidArguments(`${name} must be a list`);
      if (value.length > field.maxItems) throw new InvalidArguments(`${name} holds at most ${field.maxItems} items`);
      return value.map((item, i) => checkArguments(field.items, item, `${name}[${i}]`));
    }
  }
}

/** The arguments, checked against the schema: unknown names, missing required ones and wrong shapes are refused. */
export function checkArguments(schema: ObjectSchema, value: unknown, where = 'arguments'): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new InvalidArguments(`${where} must be an object`);
  const input = value as Record<string, unknown>;
  for (const key of Object.keys(input)) if (!Object.prototype.hasOwnProperty.call(schema.properties, key)) throw new InvalidArguments(`${where}: unknown name "${key}"`);
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema.properties)) {
    const given = input[key];
    if (given === undefined || given === null) {
      if (schema.required?.includes(key)) throw new InvalidArguments(`${where}: "${key}" is required`);
      continue;
    }
    out[key] = checkField(where === 'arguments' ? key : `${where}.${key}`, field, given);
  }
  return out;
}
