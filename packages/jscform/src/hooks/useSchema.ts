import {useContext, useSyncExternalStore} from "react";
import {FormContext} from "../contexts/FormContext";
import {JSONSchema} from "../utils/types";
import {getSchemaFromPath} from "../utils/getSchemaFromPath";

export const useSchema = (schemaKey: string): JSONSchema | null => {
    const formStore = useContext(FormContext);
    if (!formStore) {
        throw Error("useSchema must be used within a FormProvider");
    }
    const schema = useSyncExternalStore(
        formStore.subscribe,
        () => formStore.getState().schema,
        () => formStore.getInitialState().schema
    );
    return getSchemaFromPath(schema, schemaKey, ".");
}
