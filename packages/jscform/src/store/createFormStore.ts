import {JSONSchema} from "../utils/types";
import {Ajv, AsyncSchema} from "ajv";
import ajvErrors from "ajv-errors";
import {BehaviorSubject} from "rxjs";
import {cloneDeep, set} from "lodash";
import retrieveSchema from "../utils/retrieveSchema";
import {parseAjvErrors, toNestErrors} from "../utils/errorResolver/parseAjvErrors";

export interface FormStore {
    schema: JSONSchema;
    data: any;
    errors?: any;
    validator?: Ajv;
    context?: any;
}

const ajv = new Ajv({
    $data: true,
    strict: false,
    allErrors: true,
    useDefaults: true,
})
ajvErrors(ajv);

type Listener = (state: any) => void

let cachedState: { data: any, schema: JSONSchema, context?: any, validator?: Ajv } | null = null;

export interface FormStoreApi {
    subscribe: (listener: Listener) => () => void;
    getState: () => { schema: JSONSchema; data: any, errors?: any };
    getInitialState: () => { schema: JSONSchema; data: any, errors?: any };
    setState: (key: string, value: any) => void;
    context?: any;
    validator?: Ajv;
}

export const createFormStore = ({
        schema,
        context,
        data,
        errors,
        validator = ajv
    }: FormStore): FormStoreApi => {

    const state = new BehaviorSubject({schema, data, context, validator, errors});

    const rootSchema = cloneDeep(schema);

    const subscribe = (listener: Listener) => {
        const subscription = state.subscribe(listener);
        return () => subscription.unsubscribe();
    };

    const getInitialState = () => {
        if (cachedState !== state.value) {
            cachedState = state.value
        }
        return cachedState;
    };

    const getState = () => state.value;

    const validate = async (schema: JSONSchema, data: any) => {
        try {
            const validate = validator.compile(schema as unknown as AsyncSchema);
            const isValid = await validate(data);
            const errors = !isValid ? parseAjvErrors(validate.errors) : null;
            return {isValid, errors};
        } catch (e: unknown) {
            const errors = parseAjvErrors((e as any).errors);
            const nestedErrors = errors && toNestErrors(errors);
            return {isValid: false, errors: nestedErrors};
        }
    }

    const setState = async (key: string, value: any) => {
        const currentData = state.value.data || {};
        const newData = set(cloneDeep(currentData), key, value);
        try {
            const [result, newSchema] = await Promise.all([
                validate(rootSchema, newData),
                retrieveSchema(validator, rootSchema, rootSchema, newData, false)
            ]);
            const newState = {
                schema: newSchema,
                data: newData,
                errors: result.errors,
                context: context || {},
                validator: validator || ajv
            };
            state.next(newState);
        } catch (error) {
            console.error("Form state update error:", error);
            // Fallback to previous state on error
            state.next(state.value);
        }
    };

    return {
        subscribe,
        getState,
        getInitialState,
        setState,
        context,
        validator,
    };
};
