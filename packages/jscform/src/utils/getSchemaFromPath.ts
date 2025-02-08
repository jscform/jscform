import {JSONSchema} from "./types";

const cache = new WeakMap<object, Map<string, JSONSchema | null>>();

export function getSchemaFromPath(schema: JSONSchema, path: string, splitChar: string = "/"): JSONSchema | null {
    if (!schema) return null;
    let cacheForSchema = cache.get(schema);
    if (!cacheForSchema) {
        cacheForSchema = new Map();
        cache.set(schema, cacheForSchema);
    }
    if (cacheForSchema.has(path)) {
        return cacheForSchema.get(path) as JSONSchema | null;
    }
    if (!path) {
        cacheForSchema.set(path, schema);
        return schema;
    }
    let segments = path.split(splitChar);
    // Account for leading `/` or `.`
    if (!segments[0]) segments = segments.slice(1);
    const result = getSchema(schema, segments);
    cacheForSchema.set(path, result);
    return result;
}

function getSchema(schema: JSONSchema, segments: string[]): JSONSchema | null {
    if (!schema) return null;
    if (!segments.length) return schema;
    if (segments.length === 1 && !segments[0]) return schema;
    let nextSegment = segments[0];
    let subSegments = segments.slice(1);
    if (schema.properties) {
        return getSchema(schema.properties[nextSegment], subSegments);
    } else if (schema.patternProperties) {
        let patterns = schema.patternProperties;
        for (const pattern in patterns) {
            if ((new RegExp(pattern)).test(nextSegment)) {
                return getSchema(patterns[pattern], subSegments);
            }
        }
    } else if (schema.additionalProperties) {
        return getSchema(schema.additionalProperties, subSegments);
    } else if (schema.items) {
        return getSchema(schema.items, subSegments);
    } else if (schema.oneOf) {
        const oneOfTarget = schema.oneOf.find((item: JSONSchema) => item.properties && item.properties[nextSegment]);
        return oneOfTarget ? getSchema(oneOfTarget.properties[nextSegment], subSegments) : null;
    } else if (schema.then) {
        return getSchema(schema.then.properties[nextSegment], subSegments);
    } else if (schema.else) {
        return getSchema(schema.else.properties[nextSegment], subSegments);
    } else if (schema.allOf) {
        // FIXME: Implement allOf
        return null;
    }
    return null;
}
