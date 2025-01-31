import type {ValidateFunction} from "ajv";
import {GenericObjectType, JSONSchema, ValidatorType} from "./types";
import {ID_KEY, ROOT_SCHEMA_PREFIX} from "./constants";
import withIdRefPrefix from "./withIdRefPrefix";
import hashForSchema from "./hashForSchema";

export async function isValid(validator: ValidatorType, schema: JSONSchema, formData: GenericObjectType | undefined, rootSchema: JSONSchema): Promise<boolean> {
    const rootSchemaId = rootSchema[ID_KEY] ?? ROOT_SCHEMA_PREFIX;
    let validate: ValidateFunction | undefined;
    try {
        if (validator.getSchema(rootSchemaId) === undefined) {
            validator.addSchema(rootSchema, rootSchemaId);
        }
        const schemaWithIdRefPrefix = withIdRefPrefix(schema) as JSONSchema;
        const schemaId = schemaWithIdRefPrefix[ID_KEY] ?? hashForSchema(schemaWithIdRefPrefix);
        validate = validator.getSchema(schemaId);
        if (validate === undefined) {
            validate = validator.addSchema(schemaWithIdRefPrefix, schemaId).getSchema(schemaId) || await validator.compileAsync(schemaWithIdRefPrefix);
        }
    } catch (e) {
        console.error('Error while compiling schema for validation', e);
        return false;
    } finally {
        validator.removeSchema(rootSchemaId);
    }

    try {
        return (await validate(formData)) as boolean
    } catch (e) {
        return false;
    }
}
