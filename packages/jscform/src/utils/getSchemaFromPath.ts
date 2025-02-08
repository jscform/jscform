import {JSONSchema} from "./types";


export function getSchemaFromPath(schema: JSONSchema, path: string, splitChar: string = "/"): JSONSchema | null {
    if (!path) return schema;
    let segments = path.split(splitChar);
    // Account for leading `/` or `.`
    if (!segments[0]) segments = segments.slice(1);
    return getSchema(schema, segments);
}

function getSchema(schema: JSONSchema, segments: string[]): JSONSchema | null {
    if (!schema) return null;
    if (!segments.length) return schema;
    if (segments.length === 1 && !segments[0]) return schema;
    let nextSegment = segments[0];
    let subSegments = segments.slice(1);
    let subSchema = null;
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
        // Find oneOf element that has a matching property for next segment:
        const oneOfTarget = schema.oneOf.filter((item: JSONSchema) => {
            return item.properties && item.properties[nextSegment]
        })[0];
        return oneOfTarget ? getSchema(oneOfTarget.properties[nextSegment], subSegments) : null;
    } else if (schema.then) {
        return getSchema(schema.then.properties[nextSegment], subSegments)
    } else if (schema.else) {
        return getSchema(schema.else.properties[nextSegment], subSegments)
    } else if (schema.allOf) {
        // FIXME: Implement allOf
        return null;
    }
    return subSchema;
}
