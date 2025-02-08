import {JSONSchema} from "../utils/types";
import {Ajv} from "ajv";
import {BehaviorSubject} from "rxjs";
import cloneDeep from "lodash/cloneDeep";
import retrieveSchema from "../utils/retrieveSchema";
import _set from "lodash/set";

export interface FormStore {
    schema: JSONSchema;
    data: any;
    validator?: Ajv;
    context?: any;
}

const ajv = new Ajv({
    $data: true,
    useDefaults: true,
    strict: false,
    allErrors: true,
})

type Listener = (state: any) => void

export interface FormStoreApi {
    subscribe: (listener: Listener) => () => void;
    getState: () => { schema: JSONSchema; data: any };
    getInitialState: () => { schema: JSONSchema; data: any };
    setState: (key: string, value: any) => void;
    context?: any;
    validator?: Ajv;
}

let cachedState: { data: any, schema: JSONSchema, context?: any, validator?: Ajv } | null = null;

export const createFormStore = ({schema, context, data, validator = ajv}: FormStore): FormStoreApi => {
    const state = new BehaviorSubject({schema, data, context, validator});
    const rootSchema = cloneDeep(schema);

    const subscribe = (listener: Listener) => {
        const subscription = state.subscribe(listener);
        return () => subscription.unsubscribe();
    }
    const getInitialState = () => {
        if (cachedState !== state.value) {
            cachedState = state.value
        }
        return cachedState;
    }
    const getState = () => {
        return state.value;
    };

    const setState = (key: string, value: any) => {
        (async () => {
            const newData = _set(state.value.data, key, value);
            const newSchema = await retrieveSchema(validator, rootSchema, rootSchema, newData, false);
            state.next({schema: newSchema, data: newData, context, validator});
        })();
    }

    state.subscribe((value) => {
        console.log("State updated", {schema: value.schema, data: value.data});
    });
    return {
        subscribe,
        getState,
        getInitialState,
        setState,
        context,
        validator,
    }
}
