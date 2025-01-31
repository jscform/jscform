import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';

import {ANY_OF_KEY, DEFAULT_KEY, DEPENDENCIES_KEY, ONE_OF_KEY, PROPERTIES_KEY,} from './constants';
import getClosestMatchingOption from './getClosestMatchingOption';
import getDiscriminatorFieldFromSchema from './getDiscriminatorFieldFromSchema';
import getSchemaType from './getSchemaType';
import isObject from './isObject';
import isFixedItems from './isFixedItems';
import mergeDefaultsWithFormData from './mergeDefaultsWithFormData';
import mergeObjects from './mergeObjects';
import mergeSchemas from './mergeSchemas';
import {GenericObjectType, JSONSchema, ValidatorType,} from './types';
import isMultiSelect from './isMultiSelect';
import retrieveSchema, {resolveDependencies} from './retrieveSchema';
import pMap from "p-map";
import pReduce from "p-reduce";
import pEachSeries from "p-each-series";

/** Enum that indicates how `schema.additionalItems` should be handled by the `getInnerSchemaForArrayItem()` function.
 */
export enum AdditionalItemsHandling {
    Ignore,
    Invert,
    Fallback,
}

/** Given a `schema` will return an inner schema that for an array item. This is computed differently based on the
 * `additionalItems` enum and the value of `idx`. There are four possible returns:
 * 1. If `idx` is >= 0, then if `schema.items` is an array the `idx`th element of the array is returned if it is a valid
 *    index and not a boolean, otherwise it falls through to 3.
 * 2. If `schema.items` is not an array AND truthy and not a boolean, then `schema.items` is returned since it actually
 *    is a schema, otherwise it falls through to 3.
 * 3. If `additionalItems` is not `AdditionalItemsHandling.Ignore` and `schema.additionalItems` is an object, then
 *    `schema.additionalItems` is returned since it actually is a schema, otherwise it falls through to 4.
 * 4. {} is returned representing an empty schema
 *
 * @param schema - The schema from which to get the particular item
 * @param [additionalItems=AdditionalItemsHandling.Ignore] - How do we want to handle additional items?
 * @param [idx=-1] - Index, if non-negative, will be used to return the idx-th element in a `schema.items` array
 * @returns - The best fit schema object from the `schema` given the `additionalItems` and `idx` modifiers
 */
export function getInnerSchemaForArrayItem(schema: JSONSchema, additionalItems: AdditionalItemsHandling = AdditionalItemsHandling.Ignore, idx = -1): JSONSchema {
    if (idx >= 0) {
        if (Array.isArray(schema.items) && idx < schema.items.length) {
            const item = schema.items[idx];
            if (typeof item !== 'boolean') {
                return item as JSONSchema;
            }
        }
    } else if (schema.items && !Array.isArray(schema.items) && typeof schema.items !== 'boolean') {
        return schema.items as JSONSchema;
    }
    if (additionalItems !== AdditionalItemsHandling.Ignore && isObject(schema.additionalItems)) {
        return schema.additionalItems as JSONSchema;
    }
    return {} as JSONSchema;
}

interface ComputeDefaultsProps {
    parentDefaults?: any;
    rootSchema?: JSONSchema;
    rawFormData?: GenericObjectType;
    includeUndefinedValues?: boolean | 'excludeObjectChildren';
    required?: boolean;
}

/** Computes the defaults for the current `schema` given the `rawFormData` and `parentDefaults` if any. This drills into
 * each level of the schema, recursively, to fill out every level of defaults provided by the schema.
 *
 * @param validator - an implementation of the `ValidatorType` interface that will be used when necessary
 * @param rawSchema - The schema for which the default state is desired
 * @param [props] - Optional props for this function
 * @param [props.parentDefaults] - Any defaults provided by the parent field in the schema
 * @param [props.rootSchema] - The options root schema, used to primarily to look up `$ref`s
 * @param [props.rawFormData] - The current formData, if any, onto which to provide any missing defaults
 * @param [props.includeUndefinedValues=false] - Optional flag, if true, cause undefined values to be added as defaults.
 *          If "excludeObjectChildren", cause undefined values for this object and pass `includeUndefinedValues` as
 *          false when computing defaults for any nested object properties.
 * @param [props._recurseList=[]] - The list of ref names currently being recursed, used to prevent infinite recursion
 * @param [props.experimental_defaultFormStateBehavior] Optional configuration object, if provided, allows users to override default form state behavior
 * @param [props.required] - Optional flag, if true, indicates this schema was required in the parent schema.
 * @returns - The resulting `formData` with all the defaults provided
 */
export async function computeDefaults(
    validator: ValidatorType,
    rawSchema: JSONSchema,
    {
        parentDefaults,
        rawFormData,
        rootSchema = {} as JSONSchema,
        includeUndefinedValues = false,
        required,
    }: ComputeDefaultsProps = {}
): Promise<GenericObjectType | GenericObjectType[] | undefined> {
    const formData: GenericObjectType = (isObject(rawFormData) ? rawFormData : {}) as GenericObjectType;
    const schema: JSONSchema = isObject(rawSchema) ? rawSchema : ({} as JSONSchema);
    // Compute the defaults recursively: give highest priority to deepest nodes.
    let defaults: GenericObjectType | GenericObjectType[] | undefined = parentDefaults;
    // If we get a new schema, then we need to recompute defaults again for the new schema found.
    let schemaToCompute: JSONSchema | null = null;

    if (isObject(defaults) && isObject(schema.default)) {
        // For object defaults, only override parent defaults that are defined in
        // schema.default.
        defaults = mergeObjects(defaults!, schema.default as GenericObjectType) as GenericObjectType;
    } else if (DEFAULT_KEY in schema) {
        defaults = schema.default as unknown as GenericObjectType;
    } else if (DEPENDENCIES_KEY in schema) {
        const resolvedSchema = await resolveDependencies(validator, schema, rootSchema, false, [], formData);
        schemaToCompute = resolvedSchema[0]; // pick the first element from resolve dependencies
    } else if (isFixedItems(schema)) {
        defaults = await pMap(schema.items! as JSONSchema[], async (itemSchema: JSONSchema, idx: number) => {
            return computeDefaults(validator, itemSchema, {
                rootSchema,
                includeUndefinedValues,
                parentDefaults: Array.isArray(parentDefaults) ? parentDefaults[idx] : undefined,
                rawFormData: formData as GenericObjectType,
                required,
            })
        }) as GenericObjectType[];
    } else if (ONE_OF_KEY in schema) {
        const {oneOf, ...remaining} = schema;
        if (oneOf!.length === 0) {
            return undefined;
        }
        const discriminator = getDiscriminatorFieldFromSchema(schema);
        schemaToCompute = oneOf![await getClosestMatchingOption(validator, rootSchema, isEmpty(formData) ? undefined : formData, oneOf as JSONSchema[], 0, discriminator)] as JSONSchema;
        schemaToCompute = mergeSchemas(remaining as JSONSchema, schemaToCompute) as JSONSchema;
    } else if (ANY_OF_KEY in schema) {
        const {anyOf, ...remaining} = schema;
        if (anyOf!.length === 0) {
            return undefined;
        }
        const discriminator = getDiscriminatorFieldFromSchema(schema);
        schemaToCompute = anyOf![await getClosestMatchingOption(validator, rootSchema, isEmpty(formData) ? undefined : formData, anyOf as JSONSchema[], 0, discriminator)] as JSONSchema;
        schemaToCompute = mergeSchemas(remaining as JSONSchema, schemaToCompute) as JSONSchema;
    }

    if (schemaToCompute) {
        return await computeDefaults(validator, schemaToCompute, {
            rootSchema,
            includeUndefinedValues,
            parentDefaults: defaults as GenericObjectType | undefined,
            rawFormData: formData as GenericObjectType,
            required,
        });
    }

    // No defaults defined for this node, fallback to generic typed ones.
    if (defaults === undefined) {
        defaults = schema.default as unknown as GenericObjectType;
    }

    switch (getSchemaType(schema)) {
        // We need to recurse for object schema inner default values.
        case 'object': {
            const retrievedSchema = schema;
            const objectDefaults = await pReduce(Object.keys(retrievedSchema.properties || {}), async (acc: GenericObjectType, key: string) => {
                // Compute the defaults for this node, with the parent defaults we might
                // have from a previous run: defaults[key].
                acc[key] = await computeDefaults(validator, get(retrievedSchema, [PROPERTIES_KEY, key]), {
                    rootSchema,
                    includeUndefinedValues: includeUndefinedValues === true,
                    parentDefaults: get(defaults, [key]),
                    rawFormData: get(formData, [key]),
                    required: retrievedSchema.required?.includes(key),
                });
                return acc;
            }) as GenericObjectType;

            if (retrievedSchema.additionalProperties) {
                // as per spec additionalProperties may be either schema or boolean
                const additionalPropertiesSchema = isObject(retrievedSchema.additionalProperties)
                    ? retrievedSchema.additionalProperties
                    : {};
                const keys = new Set<string>();
                if (isObject(defaults)) {
                    Object.keys(defaults as GenericObjectType)
                        .filter((key) => !retrievedSchema.properties || !retrievedSchema.properties[key])
                        .forEach((key) => keys.add(key));
                }
                const formDataRequired: string[] = [];
                Object.keys(formData as GenericObjectType)
                    .filter((key) => !retrievedSchema.properties || !retrievedSchema.properties[key])
                    .forEach((key) => {
                        keys.add(key);
                        formDataRequired.push(key);
                    });
                await pEachSeries(keys, async (key) => {
                    // Since these are additional properties we don't need to add the `experimental_defaultFormStateBehavior` prop
                    objectDefaults[key] = await computeDefaults(validator, additionalPropertiesSchema as JSONSchema, {
                        rootSchema,
                        includeUndefinedValues: includeUndefinedValues === true,
                        parentDefaults: get(defaults, [key]),
                        rawFormData: get(formData, [key]),
                        required: retrievedSchema.required?.includes(key),
                    });
                });
            }
            return objectDefaults;
        }
        case 'array': {
            const emptyDefault: GenericObjectType | GenericObjectType[] | undefined = [];

            // Inject defaults into existing array defaults
            if (Array.isArray(defaults)) {
                defaults = defaults.map((item, idx) => {
                    const schemaItem: JSONSchema = getInnerSchemaForArrayItem(schema, AdditionalItemsHandling.Fallback, idx);
                    return computeDefaults(validator, schemaItem, {
                        rootSchema,
                        parentDefaults: item,
                        required,
                    });
                }) as GenericObjectType[];
            }

            // Deeply inject defaults into already existing form data
            if (Array.isArray(rawFormData)) {
                const schemaItem: JSONSchema = getInnerSchemaForArrayItem(schema);
                defaults = await pMap(rawFormData, async (item: GenericObjectType, idx: number) => {
                    return await computeDefaults(validator, schemaItem, {
                        rootSchema,
                        rawFormData: item,
                        parentDefaults: get(defaults, [idx]),
                        required,
                    })
                });
            }

            const defaultsLength = Array.isArray(defaults) ? defaults.length : 0;
            if (
                !schema.minItems ||
                await isMultiSelect(validator, schema, rootSchema) ||
                // computeSkipPopulate(validator, schema, rootSchema) || // FIXME: This is not implemented
                schema.minItems <= defaultsLength
            ) {
                return defaults ? defaults : emptyDefault;
            }

            const defaultEntries: any[] = (defaults || []) as any[];
            const fillerSchema: JSONSchema = getInnerSchemaForArrayItem(schema, AdditionalItemsHandling.Invert);
            const fillerDefault = fillerSchema.default;

            // Calculate filler entries for remaining items (minItems - existing raw data/defaults)
            const fillerEntries: any[] = new Array(schema.minItems - defaultsLength).fill(
                await computeDefaults(validator, fillerSchema, {
                    parentDefaults: fillerDefault,
                    rootSchema,
                    required,
                })
            ) as any[];
            // then fill up the rest with either the item default or empty, up to minItems
            return defaultEntries.concat(fillerEntries);
        }
    }

    return defaults;
}

/** Returns the superset of `formData` that includes the given set updated to include any missing fields that have
 * computed to have defaults provided in the `schema`.
 *
 * @param validator - An implementation of the `ValidatorType` interface that will be used when necessary
 * @param theSchema - The schema for which the default state is desired
 * @param [formData] - The current formData, if any, onto which to provide any missing defaults
 * @param [rootSchema] - The root schema, used to primarily to look up `$ref`s
 * @param [includeUndefinedValues=false] - Optional flag, if true, cause undefined values to be added as defaults.
 *          If "excludeObjectChildren", cause undefined values for this object and pass `includeUndefinedValues` as
 *          false when computing defaults for any nested object properties.
 * @param [experimental_defaultFormStateBehavior] Optional configuration object, if provided, allows users to override default form state behavior
 * @returns - The resulting `formData` with all the defaults provided
 */
export default async function getDefaultFormState(
    validator: ValidatorType,
    theSchema: JSONSchema,
    formData?: GenericObjectType,
    rootSchema?: JSONSchema,
    includeUndefinedValues: boolean | 'excludeObjectChildren' = false,
) {
    if (!isObject(theSchema)) {
        throw new Error('Invalid schema: ' + theSchema);
    }
    const schema = await retrieveSchema(validator, theSchema, rootSchema, formData);
    const defaults = await computeDefaults(validator, schema, {
        rootSchema,
        includeUndefinedValues,
        rawFormData: formData,
    });
    if (formData === undefined || formData === null || (typeof formData === 'number' && isNaN(formData))) {
        // No form data? Use schema defaults.
        return defaults;
    }
    if (isObject(formData)) {
        return mergeDefaultsWithFormData(defaults as GenericObjectType, formData);
    }
    if (Array.isArray(formData)) {
        return mergeDefaultsWithFormData(defaults as GenericObjectType[], formData);
    }
    return formData;
}
