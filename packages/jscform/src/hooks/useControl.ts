import {useContext, useSyncExternalStore} from "react";
import get from "lodash/get";
import {FormContext} from "../contexts/FormContext";
import {JSONSchema} from "../utils/types";
import {getSchemaFromPath} from "../utils/getSchemaFromPath";

export interface UseControlApi {
    schema: JSONSchema | null;
    value: any;
    context: any;
    validator: any;
    onChange: (val: any) => void;
}

export const useControl = (schemaKey: string): UseControlApi => {
    const formStore = useContext(FormContext);
    if (!formStore) {
        throw Error("useForm must be used within a FormProvider");
    }
    const store = useSyncExternalStore(
        formStore.subscribe,
        () => formStore.getState(),
        () => formStore.getInitialState()
    );
    const onChange = (val: any) => {
        formStore.setState(schemaKey, val);
    }
    return {
        schema: getSchemaFromPath(store.schema, schemaKey, "."),
        value: get(store.data, schemaKey.split(".")),
        context: formStore.context,
        validator: formStore.validator,
        onChange,
    };
}

