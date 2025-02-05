import {create} from "zustand";
import {JSONSchema} from "../utils/types";
import {Ajv} from "ajv";

export interface FormStore {
    schema: JSONSchema;
    data: Record<string, any>;
    context?: Record<string, any>;
    validator?: Ajv;
}

const ajv = new Ajv({
    $data: true,
    useDefaults: true,
    strict: false,
    allErrors: true
})

export const createFormStore =
    ({schema, context, data, validator = ajv}: FormStore) => {
        return create(() => {
            return {
                validator,
                schema,
                data,
                context,
            } as FormStore;
        });
    }
