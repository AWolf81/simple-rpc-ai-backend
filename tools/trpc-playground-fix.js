/**
 * << README >>
 * Github Issue: https://github.com/sachinraja/trpc-playground/issues/55
 *
 * This file is a workaround for fixing issues with the schema generation for the trpc-playground package
 * with the V11 tRPC release. This file fixes an issue where the typescript types for the router are not resolved correctly
 *
 * This is due to the fact that the trpc package made some breaking changes to the router type
 * Issues this file fixes:
 *  - _def.query and _def.mutation are now replaced by a _def.type field which can be 'query' | 'mutation' | 'subscription'
 *
 * Example Usage with nextjs handler:
 * ```ts
 * import type { NextApiHandler } from 'next'
 * import { zodResolveTypes } from './trpc-playground-fix' // 👈 Import zodResolveTypes from this file
 * import { nextHandler } from 'trpc-playground/handlers/next'
 *
 * import { appRouter } from 'api'
 *
 * const setupHandler = nextHandler({
 *   router: appRouter,
 *   // tRPC api path, pages/api/trpc/[trpc].ts in this case
 *   trpcApiEndpoint: '/api/trpc',
 *   playgroundEndpoint: '/api/trpc-playground',
 *   resolveTypes: zodResolveTypes, // 👈 Pass in the updated zodResolveTypes function with the fixes
 *   request: {
 *     superjson: true,
 *   },
 * })
 *
 * const handler: NextApiHandler = async (req, res) => {
 *   const playgroundHandler = await setupHandler
 *   await playgroundHandler(req, res)
 * }
 *
 * export default handler
 * ```
 */

/**
 * << README >>
 * Github Issue: https://github.com/sachinraja/trpc-playground/issues/55
 *
 * This file is a workaround for fixing issues with the schema generation for the trpc-playground package
 * with the V11 tRPC release. This file fixes an issue where the typescript types for the router are not resolved correctly
 *
 * This is due to the fact that the trpc package made some breaking changes to the router type
 * Issues this file fixes:
 *  - _def.query and _def.mutation are now replaced by a _def.type field which can be 'query' | 'mutation' | 'subscription'
 *
 * Converted to js so we can use it in our dev-panel.js
 */

import lodash from 'lodash';
import { z, ZodFirstPartyTypeKind } from 'zod';
import { createTypeAlias, printNode, zodToTs } from 'zod-to-ts';

const buildTrpcTsType = (router, procedureTypes) => {
  const procedures = getAllProceduresRecursive(router);
  const procedureObject = {};

  Object.entries(procedures)
    .filter(([, { _def }]) => _def.type === 'query' || _def.type === 'mutation')
    .forEach(([name, procedure]) => {
      let procedureTypeDef = '';

      const inputType = procedureTypes.mutations[name] || procedureTypes.queries[name] || '';
      if (procedure._def?.type === 'query')
        procedureTypeDef += `query: (${inputType}) => void,`;
      else if (procedure._def?.type === 'mutation')
        procedureTypeDef += `mutate: (${inputType}) => void,`;

      lodash.set(procedureObject, name, `{${procedureTypeDef}}`);
    });

  const buildNestedTrpcObject = (obj) => {
    return Object.entries(obj)
      .map(([name, value]) => {
        if (typeof value === 'string') return `'${name}': ${value}`;
        return `'${name}': {${buildNestedTrpcObject(value)}}`;
      })
      .join(',');
  };

  return `type Trpc = {${buildNestedTrpcObject(procedureObject)}}\ndeclare var trpc: Trpc;`;
};

/**
 * Recursively extract all procedures from nested routers
 * Handles custom routers merged with base routers
 */
const getAllProceduresRecursive = (router, prefix = '') => {
  const allProcedures = {};

  // Process direct procedures
  if (router._def?.procedures) {
    Object.entries(router._def.procedures).forEach(([name, procedure]) => {
      const fullName = prefix ? `${prefix}.${name}` : name;
      allProcedures[fullName] = procedure;
    });
  }

  // Process nested routers (custom routers are in _def.record)
  if (router._def?.record) {
    Object.entries(router._def.record).forEach(([namespace, subRouter]) => {
      if (subRouter?._def) {
        const nestedProcedures = getAllProceduresRecursive(
          subRouter,
          prefix ? `${prefix}.${namespace}` : namespace
        );
        Object.assign(allProcedures, nestedProcedures);
      }
    });
  }

  return allProcedures;
};

export const zodResolveTypes = async (router) => {
  const allProcedures = getAllProceduresRecursive(router);
  const { schemas, types } = getProcedureSchemas(allProcedures);

  return {
    tsTypes: buildTrpcTsType(router, types),
    ...schemas,
  };
};

export const getInputFromInputParsers = (inputs) => {
  if (inputs.length === 0) return null;
  if (inputs.length === 1) return inputs[0];

  const mergedObj = inputs.reduce((mergedObj, inputParser) => {
    return mergedObj.merge(inputParser);
  }, z.object({}));

  return mergedObj;
};

export const getProcedureSchemas = (procedures) => {
  const procedureSchemas = { queries: {}, mutations: {} };
  const procedureTypes = { queries: {}, mutations: {} };

  Object.entries(procedures)
    .filter(([, { _def }]) => _def.type === 'query' || _def.type === 'mutation')
    .forEach(([procedureName, procedure]) => {
      const inputParser = getInputFromInputParsers(procedure._def.inputs);
      if (typeof inputParser === 'function') {
        return z.any();
      }

      const defaultInputValue = inputParser ? getDefaultForDef(inputParser._def) : '';

      let procedureType = '';
      let docsType = '';

      if (inputParser) {
        const { node } = zodToTs(inputParser);
        procedureType = `input: ${printNode(node)}`;

        docsType = printNode(createTypeAlias(node, 'input', inputParser.description));
      }

      const procedureDefaults = {
        inputLength: defaultInputValue.length,
        value: `await trpc.${procedureName}.${procedure._def.type === 'query' ? 'query' : 'mutate'}(${defaultInputValue})`,
      };

      const procedureObject = procedure._def.type === 'query' ? procedureSchemas.queries : procedureSchemas.mutations;
      const typeProcedureObject = procedure._def.type === 'query' ? procedureTypes.queries : procedureTypes.mutations;

      procedureObject[procedureName] = {
        default: procedureDefaults,
        type: docsType,
      };
      typeProcedureObject[procedureName] = procedureType;
    });

  return { schemas: procedureSchemas, types: procedureTypes };
};

const getDefaultForDef = (def) => {
  if (!def) return '';

  switch (def.typeName) {
    case ZodFirstPartyTypeKind.ZodString: return defaultString();
    case ZodFirstPartyTypeKind.ZodDate: return defaultDate();
    case ZodFirstPartyTypeKind.ZodNumber: return defaultNumber();
    case ZodFirstPartyTypeKind.ZodBigInt: return defaultBigInt();
    case ZodFirstPartyTypeKind.ZodBoolean: return defaultBoolean();
    case ZodFirstPartyTypeKind.ZodUndefined: return defaultUndefined();
    case ZodFirstPartyTypeKind.ZodNull: return defaultNull();
    case ZodFirstPartyTypeKind.ZodObject: return defaultObject(def);
    case ZodFirstPartyTypeKind.ZodArray: return defaultArray(def);
    case ZodFirstPartyTypeKind.ZodTuple: return defaultTuple(def);
    case ZodFirstPartyTypeKind.ZodRecord: return defaultRecord(def);
    case ZodFirstPartyTypeKind.ZodLiteral: return defaultLiteral(def);
    case ZodFirstPartyTypeKind.ZodNullable: return defaultNullable(def);
    case ZodFirstPartyTypeKind.ZodOptional: return defaultOptional(def);
    case ZodFirstPartyTypeKind.ZodDefault: return defaultWithDefault(def);
    case ZodFirstPartyTypeKind.ZodIntersection: return defaultIntersection(def);
    case ZodFirstPartyTypeKind.ZodEnum: return defaultEnum(def);
    case ZodFirstPartyTypeKind.ZodNativeEnum: return defaultNativeEnum(def);
    case ZodFirstPartyTypeKind.ZodLazy: return defaultLazy(def);
    case ZodFirstPartyTypeKind.ZodMap: return defaultMap(def);
    case ZodFirstPartyTypeKind.ZodSet: return defaultSet(def);
    case ZodFirstPartyTypeKind.ZodPromise: return defaultPromise(def);
    case ZodFirstPartyTypeKind.ZodNaN: return 'NaN';
    case ZodFirstPartyTypeKind.ZodDiscriminatedUnion:
    case ZodFirstPartyTypeKind.ZodUnion: return defaultUnion(def);
    default: return '';
  }
};

const defaultString = () => `''`;  // Use single quotes for JavaScript
const defaultDate = () => `new Date()`;
const defaultNumber = () => `0`;
const defaultBigInt = () => `BigInt(0)`;
const defaultBoolean = () => `false`;
const defaultUndefined = () => `undefined`;
const defaultNull = () => `null`;

const defaultObject = (def) => {
  const entries = Object.entries(def.shape());
  if (entries.length === 0) return '{}';

  const props = entries.map(([name, propDef]) =>
    `${name}: ${getDefaultForDef(propDef._def)}`
  ).join(', ');

  return `{ ${props} }`;
};

const defaultArray = (def) => `[${getDefaultForDef(def.type._def)}]`;

const defaultTuple = (def) => {
  let ret = '[';
  for (let i = 0; i < def.items.length; i++) {
    ret += `${getDefaultForDef(def.items[i]?._def)}`;
  }
  ret += ']';
  return ret;
};

const defaultRecord = (_def) => `{ ${getDefaultForDef(_def.keyType._def)}: ${getDefaultForDef(_def.valueType._def)} }`;
const defaultLiteral = (def) => (typeof def.value === 'string' ? `'${def.value}'` : `${def.value}`);
const defaultNullable = (def) => getDefaultForDef(def.innerType._def);
const defaultOptional = (def) => getDefaultForDef(def.innerType._def) ?? `undefined`;
const defaultWithDefault = (def) => {
  // Use the actual default value from the schema
  const defaultValue = def.defaultValue();
  if (typeof defaultValue === 'string') return `'${defaultValue}'`;  // Single quotes
  if (typeof defaultValue === 'boolean' || typeof defaultValue === 'number') return `${defaultValue}`;
  if (defaultValue === null) return 'null';
  if (defaultValue === undefined) return 'undefined';
  // For objects/arrays, try to stringify
  if (typeof defaultValue === 'object') return JSON.stringify(defaultValue);
  return `${defaultValue}`;
};
const defaultEnum = (def) => `'${def.values[0]}'`;  // Single quotes
const defaultUnion = (def) => {
  const options = def.options instanceof Map ? Array.from(def.options.values()) : def.options;
  if (options.length === 0) return '';
  return getDefaultForDef(options[0]._def);
};
const defaultIntersection = (def) => getDefaultForDef(def.right._def);
const defaultNativeEnum = (def) => {
  const val = Object.values(def.values)[Object.values(def.values).length - 1];
  if (val) return typeof val === 'string' ? `'${val}'` : `${val}`;  // Single quotes
  return '';
};
const defaultMap = (_def) => `new Map([[${getDefaultForDef(_def.keyType._def)}, ${getDefaultForDef(_def.valueType._def)}]])`;
const defaultSet = (_def) => `new Set([${getDefaultForDef(_def.valueType._def)}])`;
const defaultPromise = (def) => `Promise.resolve(${getDefaultForDef(def.type._def)})`;
const defaultLazy = (def) => {
  // For lazy types, we need to evaluate the getter function to get the actual schema
  try {
    const schema = def.getter();
    return getDefaultForDef(schema._def);
  } catch (error) {
    // If we can't evaluate the lazy schema, return a placeholder
    return '{}';
  }
};

/*module.exports = {
  zodResolveTypes,
  getInputFromInputParsers,
  getProcedureSchemas,
};*/
