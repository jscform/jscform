import { get, isEqual, set, transform, merge, flattenDeep, uniq, cloneDeep, memoize } from 'lodash';
import type {Options} from 'json-schema-merge-allof';
import mergeAllOf, * as merger from 'json-schema-merge-allof';
import pMap from "p-map";
import {
    ADDITIONAL_PROPERTIES_KEY,
    ADDITIONAL_PROPERTY_FLAG,
    ALL_OF_KEY,
    ANY_OF_KEY,
    DEPENDENCIES_KEY,
    IF_KEY,
    ITEMS_KEY,
    ONE_OF_KEY,
    PROPERTIES_KEY,
    REF_KEY,
} from './constants';
import findSchemaDefinition, {splitKeyElementFromObject} from './findSchemaDefinition';
import getDiscriminatorFieldFromSchema from './getDiscriminatorFieldFromSchema';
import guessType from './guessType';
import isObject from './isObject';
import mergeSchemas from './mergeSchemas';
import {FormContextType, JSONSchema, ValidatorType} from './types';
import * as ValidatorUtil from './validatorUtils';
import getFirstMatchingOption from './getFirstMatchingOption';
import resolvers from './mergeAllOf/mergeAllOfResolver'
import pEachSeries from "p-each-series";
import pFilter from "p-filter";

/** Retrieves an expanded schema that has had all of its conditions, additional properties, references and dependencies
 * resolved and merged into the `schema` given a `validator`, `rootSchema` and `rawFormData` that is used to do the
 * potentially recursive resolution.
 *
 * @param validator - An implementation of the `ValidatorType` interface that will be forwarded to all the APIs
 * @param schema - The schema for which retrieving a schema is desired
 * @param [rootSchema={}] - The root schema that will be forwarded to all the APIs
 * @param [rawFormData] - The current formData, if any, to assist retrieving a schema
 * @param expandAllBranches
 * @returns - The schema having its conditions, additional properties, references and dependencies resolved
 */
export default async function retrieveSchema(validator: ValidatorType, schema: JSONSchema, rootSchema: JSONSchema = {} as JSONSchema, rawFormData: any, expandAllBranches: boolean = false): Promise<JSONSchema> {
    return (await retrieveSchemaInternal(validator, schema, rootSchema, rawFormData, expandAllBranches))[0];
}

/** Internal handler that retrieves an expanded schema that has had all of its conditions, additional properties,
 * references and dependencies resolved and merged into the `schema` given a `validator`, `rootSchema` and `rawFormData`
 * that is used to do the potentially recursive resolution. If `expandAllBranches` is true, then all possible branches
 * of the schema and its references, conditions and dependencies are returned.
 *
 * @param validator - An implementation of the `ValidatorType` interface that will be forwarded to all the APIs
 * @param schema - The schema for which retrieving a schema is desired
 * @param rootSchema - The root schema that will be forwarded to all the APIs
 * @param [rawFormData] - The current formData, if any, to assist retrieving a schema
 * @param [expandAllBranches=false] - Flag, if true, will return all possible branches of conditions, any/oneOf and
 *          dependencies as a list of schemas
 * @param [recurseList=[]] - The optional, list of recursive references already processed
 * @returns - The schema(s) resulting from having its conditions, additional properties, references and dependencies
 *          resolved. Multiple schemas may be returned if `expandAllBranches` is true.
 */
export async function retrieveSchemaInternal(validator: ValidatorType, schema: JSONSchema, rootSchema: JSONSchema, rawFormData: any, expandAllBranches = false, recurseList: string[] = []): Promise<JSONSchema[]> {
    if (!isObject(schema)) {
        return [{} as JSONSchema];
    }
    const resolvedSchemas = await resolveSchema(validator, schema, rootSchema, expandAllBranches, recurseList, rawFormData);
    return (await pMap(resolvedSchemas, async (resolvedSchema: JSONSchema) => {
        if (IF_KEY in resolvedSchema) {
            return await resolveCondition(validator, resolvedSchema, rootSchema, expandAllBranches, recurseList, rawFormData);
        }
        if (ALL_OF_KEY in resolvedSchema) {
            // resolve allOf schemas
            if (expandAllBranches) {
                const {allOf, ...restOfSchema} = resolvedSchema;
                return [...(allOf as JSONSchema[]), restOfSchema as JSONSchema];
            }
            try {
                resolvedSchema = mergeAllOf(resolvedSchema as any, {
                    deep: false,
                    resolvers: {...merger.options.resolvers, ...resolvers}
                } as Options) as JSONSchema;
            } catch (e) {
                console.warn('could not merge sub-schemas in allOf:\n', e);
                const {allOf, ...resolvedSchemaWithoutAllOf} = resolvedSchema;
                return resolvedSchemaWithoutAllOf as JSONSchema;
            }
        }
        const hasAdditionalProperties = ADDITIONAL_PROPERTIES_KEY in resolvedSchema && resolvedSchema.additionalProperties !== false;
        if (hasAdditionalProperties) {
            return stubExistingAdditionalProperties(validator, resolvedSchema, rootSchema, rawFormData);
        }
        return resolvedSchema;
    })).flat();
}

/** Resolves a conditional block (if/else/then) by removing the condition and merging the appropriate conditional branch
 * with the rest of the schema. If `expandAllBranches` is true, then the `retrieveSchemaInteral()` results for both
 * conditions will be returned.
 *
 * @param validator - An implementation of the `ValidatorType` interface that is used to detect valid schema conditions
 * @param schema - The schema for which resolving a condition is desired
 * @param rootSchema - The root schema that will be forwarded to all the APIs
 * @param expandAllBranches - Flag, if true, will return all possible branches of conditions, any/oneOf and
 *          dependencies as a list of schemas
 * @param recurseList - The list of recursive references already processed
 * @param [formData] - The current formData to assist retrieving a schema
 * @returns - A list of schemas with the appropriate conditions resolved, possibly with all branches expanded
 */
export async function resolveCondition(validator: ValidatorType, schema: JSONSchema, rootSchema: JSONSchema, expandAllBranches: boolean, recurseList: string[], formData?: FormContextType): Promise<JSONSchema[]> {
    const {if: expression, then, else: otherwise, ...resolvedSchemaLessConditional} = schema;
    const conditionValue = await ValidatorUtil.isValid(validator, expression as JSONSchema, formData || ({} as FormContextType), rootSchema);
    let resolvedSchemas = [resolvedSchemaLessConditional as JSONSchema];
    let schemas: JSONSchema[] = [];
    if (expandAllBranches) {
        if (then && typeof then !== 'boolean') {
            schemas = schemas.concat(await retrieveSchemaInternal(validator, then as JSONSchema, rootSchema, formData, expandAllBranches, recurseList));
        }
        if (otherwise && typeof otherwise !== 'boolean') {
            schemas = schemas.concat(await retrieveSchemaInternal(validator, otherwise as JSONSchema, rootSchema, formData, expandAllBranches, recurseList));
        }
    } else {
        const conditionalSchema = conditionValue ? then : otherwise;
        if (conditionalSchema && typeof conditionalSchema !== 'boolean') {
            schemas = schemas.concat(await retrieveSchemaInternal(validator, conditionalSchema as JSONSchema, rootSchema, formData, expandAllBranches, recurseList));
        }
    }
    if (schemas.length) {
        resolvedSchemas = schemas.map((s) => mergeSchemas(resolvedSchemaLessConditional, s) as JSONSchema);
    }
    return (await pMap(resolvedSchemas, async (s: JSONSchema) => {
        return await retrieveSchemaInternal(validator, s, rootSchema, formData, expandAllBranches, recurseList)
    })).flat();
}

/** Resolves references and dependencies within a schema and its 'allOf' children. Passes the `expandAllBranches` flag
 * down to the `retrieveSchemaInternal()`, `resolveReference()` and `resolveDependencies()` helper calls. If
 * `expandAllBranches` is true, then all possible dependencies and/or allOf branches are returned.
 *
 * @param validator - An implementation of the `ValidatorType` interface that will be forwarded to all the APIs
 * @param schema - The schema for which resolving a schema is desired
 * @param rootSchema - The root schema that will be forwarded to all the APIs
 * @param expandAllBranches - Flag, if true, will return all possible branches of conditions, any/oneOf and dependencies
 *          as a list of schemas
 * @param recurseList - The list of recursive references already processed
 * @param [formData] - The current formData, if any, to assist retrieving a schema
 * @returns - The list of schemas having its references, dependencies and allOf schemas resolved
 */
export async function resolveSchema(validator: ValidatorType, schema: JSONSchema, rootSchema: JSONSchema, expandAllBranches: boolean, recurseList: string[], formData?: FormContextType): Promise<JSONSchema[]> {
    if(REF_KEY in schema) {
        return await resolveReference(validator, schema, rootSchema, expandAllBranches, recurseList, formData);
    }
    const updatedSchemas = await resolveReference(validator, schema, rootSchema, expandAllBranches, recurseList, formData);
    if (updatedSchemas.length > 1 || updatedSchemas[0] !== schema) {
        // return the updatedSchemas array if it has either multiple schemas within it
        // OR the first schema is not the same as the original schema
        return updatedSchemas;
    }
    if (DEPENDENCIES_KEY in schema) {
        const resolvedSchemas = await resolveDependencies(validator, schema, rootSchema, expandAllBranches, recurseList, formData);
        return (await pMap(resolvedSchemas, async (s: JSONSchema) => {
            return await retrieveSchemaInternal(validator, s, rootSchema, formData, expandAllBranches, recurseList);
        })).flat();
    }
    if (ALL_OF_KEY in schema && Array.isArray(schema.allOf)) {
        const allOfSchemaElements: JSONSchema[][] = await pMap(schema.allOf, async (allOfSubSchema: JSONSchema) => {
            return await retrieveSchemaInternal(validator, allOfSubSchema, rootSchema, formData, expandAllBranches, recurseList);
        });
        const allPermutations = getAllPermutationsOfXxxOf(allOfSchemaElements);
        return allPermutations.map((permutation) => ({...schema, allOf: permutation}));
    }
    // No $ref or dependencies or allOf attribute was found, returning the original schema.
    return [cloneDeep(schema)];
}

/** Given a list of lists of allOf, anyOf or oneOf values, create a list of lists of all permutations of the values. The
 * `listOfLists` is expected to be all resolved values of the 1st...nth schemas within an `allOf`, `anyOf` or `oneOf`.
 * From those lists, build a matrix for each `xxxOf` where there is more than one schema for a row in the list of lists.
 *
 * For example:
 * - If there are three xxxOf rows (A, B, C) and they have been resolved such that there is only one A, two B and three
 *   C schemas then:
 *   - The permutation for the first row is `[[A]]`
 *   - The permutations for the second row are `[[A,B1], [A,B2]]`
 *   - The permutations for the third row are `[[A,B1,C1], [A,B1,C2], [A,B1,C3], [A,B2,C1], [A,B2,C2], [A,B2,C3]]`
 *
 * @param listOfLists - The list of lists of elements that represent the allOf, anyOf or oneOf resolved values in order
 * @returns - The list of all permutations of schemas for a set of `xxxOf`s
 */
// Memoized version of getAllPermutationsOfXxxOf for better performance
const memoizedGetAllPermutations = memoize(
    (listOfLists: JSONSchema[][]) => {
        return listOfLists.reduce<JSONSchema[][]>(
            (permutations, list) => {
                if (list.length > 1) {
                    return list.flatMap((element) => 
                        Array.from({ length: permutations.length }, 
                            (_, i) => [...permutations[i]].concat(element))
                    );
                }
                permutations.forEach((permutation: JSONSchema[]) => permutation.push(list[0]));
                return permutations;
            },
            [[]] as JSONSchema[][]
        );
    },
    (listOfLists: JSONSchema[][]) => JSON.stringify(listOfLists)
);

export const getAllPermutationsOfXxxOf = memoizedGetAllPermutations;

/** Resolves all references within a schema and then returns the `retrieveSchemaInternal()` if the resolved schema is
 * actually different than the original. Passes the `expandAllBranches` flag down to the `retrieveSchemaInternal()`
 * helper call.
 *
 * @param validator - An implementation of the `ValidatorType` interface that will be forwarded to all the APIs
 * @param schema - The schema for which resolving a reference is desired
 * @param rootSchema - The root schema that will be forwarded to all the APIs
 * @param expandAllBranches - Flag, if true, will return all possible branches of conditions, any/oneOf and dependencies
 *          as a list of schemas
 * @param recurseList - The list of recursive references already processed
 * @param [formData] - The current formData, if any, to assist retrieving a schema
 * @returns - The list schemas retrieved after having all references resolved
 */
export async function resolveReference(validator: ValidatorType, schema: JSONSchema, rootSchema: JSONSchema, expandAllBranches: boolean, recurseList: string[], formData?: FormContextType): Promise<JSONSchema[]> {
    const updatedSchema = resolveAllReferences(schema, rootSchema, recurseList);
    if (updatedSchema !== schema) {
        // Only call this if the schema was actually changed by the `resolveAllReferences()` function
        return await retrieveSchemaInternal(
            validator,
            updatedSchema,
            rootSchema,
            formData,
            expandAllBranches,
            recurseList
        );
    }
    return [schema];
}

/** Resolves all references within the schema itself as well as any of its properties and array items.
 *
 * @param schema - The schema for which resolving all references is desired
 * @param rootSchema - The root schema that will be forwarded to all the APIs
 * @param recurseList - List of $refs already resolved to prevent recursion
 * @returns - given schema will all references resolved or the original schema if no internal `$refs` were resolved
 */
export function resolveAllReferences(schema: JSONSchema, rootSchema: JSONSchema, recurseList: string[]): JSONSchema {
    if (!isObject(schema)) {
        return schema;
    }
    let resolvedSchema: JSONSchema = schema;
    // resolve top level ref
    if (REF_KEY in resolvedSchema) {
        const {$ref, ...localSchema} = resolvedSchema;
        // Check for a recursive reference and stop the loop
        if (recurseList.includes($ref!)) {
            return resolvedSchema;
        }
        recurseList.push($ref!);
        // Retrieve the referenced schema definition.
        const refSchema = findSchemaDefinition($ref, rootSchema);
        resolvedSchema = {...refSchema, ...localSchema} as JSONSchema;
    }

    if (PROPERTIES_KEY in resolvedSchema) {
        const childrenLists: string[][] = [];
        const updatedProps = transform(
            resolvedSchema[PROPERTIES_KEY]!,
            (result, value, key: string) => {
                const childList: string[] = [...recurseList];
                result[key] = resolveAllReferences(value as JSONSchema, rootSchema, childList);
                childrenLists.push(childList);
            },
            {} as JSONSchema
        );
        merge(recurseList, uniq(flattenDeep(childrenLists)));
        resolvedSchema = {...resolvedSchema, [PROPERTIES_KEY]: updatedProps};
    }

    if (
        ITEMS_KEY in resolvedSchema &&
        !Array.isArray(resolvedSchema.items) &&
        typeof resolvedSchema.items !== 'boolean'
    ) {
        resolvedSchema = {
            ...resolvedSchema,
            items: resolveAllReferences(resolvedSchema.items as JSONSchema, rootSchema, recurseList),
        } as JSONSchema;
    }

    return isEqual(schema, resolvedSchema) ? schema : resolvedSchema;
}

/** Creates new 'properties' items for each key in the `formData`
 *
 * @param validator - An implementation of the `ValidatorType` interface that will be used when necessary
 * @param theSchema - The schema for which the existing additional properties is desired
 * @param [rootSchema] - The root schema, used to primarily to look up `$ref`s * @param validator
 * @param [aFormData] - The current formData, if any, to assist retrieving a schema
 * @returns - The updated schema with additional properties stubbed
 */
export async function stubExistingAdditionalProperties(validator: ValidatorType, theSchema: JSONSchema, rootSchema?: JSONSchema, aFormData?: FormContextType): Promise<JSONSchema> {
    // Clone the schema so that we don't ruin the consumer's original
    const schema: JSONSchema = {
        ...theSchema,
        properties: {...theSchema.properties},
    };
    // make sure formData is an object
    const formData: FormContextType = aFormData && isObject(aFormData) ? aFormData : {};
    await pEachSeries(Object.keys(formData), async (key) => {
        if (key in schema.properties) {
            // No need to stub, our schema already has the property
            return;
        }
        let additionalProperties: JSONSchema['additionalProperties'];
        if (typeof schema.additionalProperties !== 'boolean') {
            if (REF_KEY in schema.additionalProperties!) {
                additionalProperties = await retrieveSchema(validator, {$ref: get(schema.additionalProperties, [REF_KEY])} as JSONSchema, rootSchema, formData as FormContextType);
            } else if ('type' in schema.additionalProperties!) {
                additionalProperties = {...schema.additionalProperties};
            } else if (ANY_OF_KEY in schema.additionalProperties! || ONE_OF_KEY in schema.additionalProperties!) {
                additionalProperties = {type: 'object', ...schema.additionalProperties};
            } else {
                additionalProperties = {type: guessType(get(formData, [key]))};
            }
        } else {
            additionalProperties = {type: guessType(get(formData, [key]))};
        }
        // The type of our new key should match the additionalProperties value;
        schema.properties[key] = additionalProperties;
        // Set our additional property flag so we know it was dynamically added
        set(schema.properties, [key, ADDITIONAL_PROPERTY_FLAG], true);
    })
    return schema;
}

/** Resolves an `anyOf` or `oneOf` within a schema (if present) to the list of schemas returned from
 * `retrieveSchemaInternal()` for the best matching option. If `expandAllBranches` is true, then a list of schemas for ALL
 * options are retrieved and returned.
 *
 * @param validator - An implementation of the `ValidatorType` interface that will be forwarded to all the APIs
 * @param schema - The schema for which retrieving a schema is desired
 * @param rootSchema - The root schema that will be forwarded to all the APIs
 * @param expandAllBranches - Flag, if true, will return all possible branches of conditions, any/oneOf and dependencies
 *          as a list of schemas
 * @param [rawFormData] - The current formData, if any, to assist retrieving a schema, defaults to an empty object
 * @returns - Either an array containing the best matching option or all options if `expandAllBranches` is true
 */
export async function resolveAnyOrOneOfSchemas(validator: ValidatorType, schema: JSONSchema, rootSchema: JSONSchema, expandAllBranches: boolean, rawFormData?: FormContextType) {
    let anyOrOneOf: JSONSchema[] | undefined;
    const {oneOf, anyOf, ...remaining} = schema;
    if (Array.isArray(oneOf)) {
        anyOrOneOf = oneOf as JSONSchema[];
    } else if (Array.isArray(anyOf)) {
        anyOrOneOf = anyOf as JSONSchema[];
    }
    if (anyOrOneOf) {
        // Ensure that during expand all branches we pass an object rather than undefined so that all options are interrogated
        const formData = rawFormData === undefined && expandAllBranches ? ({} as FormContextType) : rawFormData;
        const discriminator = getDiscriminatorFieldFromSchema(schema);
        anyOrOneOf = anyOrOneOf.map((s) => {
            // Due to anyOf/oneOf possibly using the same $ref we always pass a fresh recurse list array so that each option
            // can resolve recursive references independently
            return resolveAllReferences(s, rootSchema, []);
        });
        // Call this to trigger the set of isValid() calls that the schema parser will need
        const option = await getFirstMatchingOption(validator, formData, anyOrOneOf, rootSchema, discriminator);
        if (expandAllBranches) {
            return anyOrOneOf.map((item) => mergeSchemas(remaining as JSONSchema, item) as JSONSchema);
        }
        schema = mergeSchemas(remaining as JSONSchema, anyOrOneOf[option]) as JSONSchema;
    }
    return [schema];
}

/** Resolves dependencies within a schema and its 'anyOf/oneOf' children. Passes the `expandAllBranches` flag down to
 * the `resolveAnyOrOneOfSchema()` and `processDependencies()` helper calls.
 *
 * @param validator - An implementation of the `ValidatorType` interface that will be forwarded to all the APIs
 * @param schema - The schema for which resolving a dependency is desired
 * @param rootSchema - The root schema that will be forwarded to all the APIs
 * @param expandAllBranches - Flag, if true, will return all possible branches of conditions, any/oneOf and dependencies
 *          as a list of schemas
 * @param recurseList - The list of recursive references already processed
 * @param [formData] - The current formData, if any, to assist retrieving a schema
 * @returns - The list of schemas with their dependencies resolved
 */
export async function resolveDependencies(validator: ValidatorType, schema: JSONSchema, rootSchema: JSONSchema, expandAllBranches: boolean, recurseList: string[], formData?: FormContextType): Promise<JSONSchema[]> {
    // Drop the dependencies from the source schema.
    const {dependencies, ...remainingSchema} = schema;
    const resolvedSchemas = await resolveAnyOrOneOfSchemas(validator, remainingSchema as JSONSchema, rootSchema, expandAllBranches, formData);
    return (await pMap(resolvedSchemas, async (resolvedSchema: JSONSchema) => {
        return processDependencies(validator, dependencies, resolvedSchema, rootSchema, expandAllBranches, recurseList, formData);
    })).flat();
}

/** Processes all the `dependencies` recursively into the list of `resolvedSchema`s as needed. Passes the
 * `expandAllBranches` flag down to the `withDependentSchema()` and the recursive `processDependencies()` helper calls.
 *
 * @param validator - An implementation of the `ValidatorType` interface that will be forwarded to all the APIs
 * @param dependencies - The set of dependencies that needs to be processed
 * @param resolvedSchema - The schema for which processing dependencies is desired
 * @param rootSchema - The root schema that will be forwarded to all the APIs
 * @param expandAllBranches - Flag, if true, will return all possible branches of conditions, any/oneOf and dependencies
 *          as a list of schemas
 * @param recurseList - The list of recursive references already processed
 * @param [formData] - The current formData, if any, to assist retrieving a schema
 * @returns - The schema with the `dependencies` resolved into it
 */
export async function processDependencies(validator: ValidatorType, dependencies: JSONSchema['dependencies'], resolvedSchema: JSONSchema, rootSchema: JSONSchema, expandAllBranches: boolean, recurseList: string[], formData?: FormContextType): Promise<JSONSchema[]> {
    let schemas = [resolvedSchema];
    // Process dependencies updating the local schema properties as appropriate.
    for (const dependencyKey in dependencies) {
        // Skip this dependency if its trigger property is not present.
        if (!expandAllBranches && get(formData, [dependencyKey]) === undefined) {
            continue;
        }
        // Skip this dependency if it is not included in the schema (such as when dependencyKey is itself a hidden dependency.)
        if (resolvedSchema.properties && !(dependencyKey in resolvedSchema.properties)) {
            continue;
        }
        const [remainingDependencies, dependencyValue] = splitKeyElementFromObject(dependencyKey, dependencies as FormContextType);
        if (Array.isArray(dependencyValue)) {
            schemas[0] = withDependentProperties(resolvedSchema, dependencyValue);
        } else if (isObject(dependencyValue)) {
            schemas = await withDependentSchema(validator, resolvedSchema, rootSchema, dependencyKey, dependencyValue as JSONSchema, expandAllBranches, recurseList, formData);
        }
        return (await pMap(schemas, async (schema) => {
            return await processDependencies(validator, remainingDependencies, schema, rootSchema, expandAllBranches, recurseList, formData);
        })).flat();
    }
    return schemas;
}

/** Updates a schema with additionally required properties added
 *
 * @param schema - The schema for which resolving a dependent properties is desired
 * @param [additionallyRequired] - An optional array of additionally required names
 * @returns - The schema with the additional required values merged in
 */
export function withDependentProperties(schema: JSONSchema, additionallyRequired?: string[]): JSONSchema {
    if (!additionallyRequired) {
        return schema;
    }
    const required = Array.isArray(schema.required)
        ? Array.from(new Set([...schema.required, ...additionallyRequired]))
        : additionallyRequired;
    return {...schema, required: required} as JSONSchema;
}

/** Merges a dependent schema into the `schema` dealing with oneOfs and references. Passes the `expandAllBranches` flag
 * down to the `retrieveSchemaInternal()`, `resolveReference()` and `withExactlyOneSubschema()` helper calls.
 *
 * @param validator - An implementation of the `ValidatorType` interface that will be forwarded to all the APIs
 * @param schema - The schema for which resolving a dependent schema is desired
 * @param rootSchema - The root schema that will be forwarded to all the APIs
 * @param dependencyKey - The key name of the dependency
 * @param dependencyValue - The potentially dependent schema
 * @param expandAllBranches - Flag, if true, will return all possible branches of conditions, any/oneOf and dependencies
 *          as a list of schemas
 * @param recurseList - The list of recursive references already processed
 * @param [formData]- The current formData to assist retrieving a schema
 * @returns - The list of schemas with the dependent schema resolved into them
 */
export async function withDependentSchema(validator: ValidatorType, schema: JSONSchema, rootSchema: JSONSchema, dependencyKey: string, dependencyValue: JSONSchema, expandAllBranches: boolean, recurseList: string[], formData?: FormContextType): Promise<JSONSchema[]> {
    const dependentSchemas = await retrieveSchemaInternal(validator, dependencyValue, rootSchema, formData, expandAllBranches, recurseList);
    return (await pMap(dependentSchemas, async ({oneOf, ...dependentSchema}) => {
        schema = mergeSchemas(schema, dependentSchema as JSONSchema) as JSONSchema;
        // Since it does not contain oneOf, we return the original schema.
        if (oneOf === undefined) {
            return schema;
        }
        // Resolve $refs inside oneOf.
        const resolvedOneOfs = await pMap(oneOf, async (subSchema: JSONSchema | boolean) => {
            if (typeof subSchema === 'boolean' || !(REF_KEY in subSchema)) {
                return [subSchema as JSONSchema];
            }
            return await resolveReference(validator, subSchema, rootSchema, expandAllBranches, recurseList, formData);
        });
        const allPermutations = getAllPermutationsOfXxxOf(resolvedOneOfs);
        return (await pMap(allPermutations, async (resolvedOneOf) => withExactlyOneSubSchema(validator, schema, rootSchema, dependencyKey, resolvedOneOf, expandAllBranches, recurseList, formData))).flat();
    })).flat();
}

/** Returns a list of `schema`s with the best choice from the `oneOf` options merged into it. If `expandAllBranches` is
 * true, then a list of schemas for ALL options are retrieved and returned. Passes the `expandAllBranches` flag down to
 * the `retrieveSchemaInternal()` helper call.
 *
 * @param validator - An implementation of the `ValidatorType` interface that will be used to validate oneOf options
 * @param schema - The schema for which resolving a oneOf subschema is desired
 * @param rootSchema - The root schema that will be forwarded to all the APIs
 * @param dependencyKey - The key name of the oneOf dependency
 * @param oneOf - The list of schemas representing the oneOf options
 * @param expandAllBranches - Flag, if true, will return all possible branches of conditions, any/oneOf and dependencies
 *          as a list of schemas
 * @param recurseList - The list of recursive references already processed
 * @param [formData] - The current formData to assist retrieving a schema
 * @returns - Either an array containing the best matching option or all options if `expandAllBranches` is true
 */
export async function withExactlyOneSubSchema(validator: ValidatorType, schema: JSONSchema, rootSchema: JSONSchema, dependencyKey: string, oneOf: JSONSchema['oneOf'], expandAllBranches: boolean, recurseList: string[], formData?: FormContextType): Promise<JSONSchema[]> {
    const validSubSchemas: JSONSchema[] = await pFilter(oneOf!, async (subSchema: JSONSchema) => {
        if (!subSchema || !subSchema.properties) {
            return false;
        }
        const {[dependencyKey]: conditionPropertySchema} = subSchema.properties;
        if (conditionPropertySchema) {
            const conditionSchema: JSONSchema = {
                type: 'object',
                properties: {
                    [dependencyKey]: conditionPropertySchema,
                },
            } as JSONSchema;
            return (await ValidatorUtil.isValid(validator, conditionSchema, formData, rootSchema)) || expandAllBranches;
        }
        return false;
    });
    if (!expandAllBranches && validSubSchemas!.length !== 1) {
        console.warn("ignoring oneOf in dependencies because there isn't exactly one subschema that is valid");
        return [schema];
    }
    return (await pMap(validSubSchemas, async (subSchema: JSONSchema) => {
        const [dependentSubSchema] = splitKeyElementFromObject(dependencyKey, subSchema.properties as FormContextType);
        const dependentSchema = {...subSchema, properties: dependentSubSchema};
        const schemas = await retrieveSchemaInternal(validator, dependentSchema, rootSchema, formData, expandAllBranches, recurseList);
        return schemas.map((s) => mergeSchemas(schema, s) as JSONSchema);
    })).flat();
}
